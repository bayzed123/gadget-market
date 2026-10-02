/**
 * Customer accounts — register/login with mobile number, password reset by SMS code, profile, order history,
 * saved addresses, wishlist, "buy again" (cables, chargers and cases get lost and worn), return requests, warranty
 * claims tied to a past order, and referral code.
 */
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AppEnv } from "../env";
import { ApiError, body, E, SQL_NOW } from "../lib/http";
import { bdPhone, loginSchema, registerSchema, returnRequestSchema, savedAddressSchema, warrantyClaimSchema } from "../lib/schemas";
import { hashPassword, randomCode, randomDigits, randomToken, safeEqualStr, verifyPassword } from "../lib/crypto";
import { CUSTOMER_COOKIE, CUSTOMER_TTL, getSetting, loadZones, rateLimit, verifyTurnstile } from "../lib/store";
import { optionalCustomer, requireCustomer } from "../middleware";
import { renderTemplate, sendSms, sendTemplate } from "../lib/notify";
import { nextClaimNo, warrantyUntil } from "../lib/sku";
import { bdToday } from "../lib/batches";
import { resolveZone } from "../lib/pricing";
import { PRODUCT_CARD_COLUMNS, toCard, type CardRow } from "./public";

const app = new Hono<AppEnv>();

async function startSession(c: Context<AppEnv>, cust: { id: number; name: string; phone: string }) {
  const token = randomToken();
  await c.env.KV.put(`s:c:${token}`, JSON.stringify({ id: cust.id, name: cust.name, phone: cust.phone }), { expirationTtl: CUSTOMER_TTL });
  setCookie(c, CUSTOMER_COOKIE, token, { httpOnly: true, secure: c.env.ENVIRONMENT !== "development", sameSite: "Lax", path: "/", maxAge: CUSTOMER_TTL });
}

app.post("/auth/register", async (c) => {
  await rateLimit(c, "register", 5, 3600);
  const b = await body(c, registerSchema);
  await verifyTurnstile(c, b.turnstileToken);
  const existing = await c.env.DB.prepare("SELECT id, password_hash FROM customers WHERE phone = ?").bind(b.phone).first<{ id: number; password_hash: string | null }>();
  if (existing?.password_hash) throw E.conflict("An account with this mobile number already exists. Please sign in.", "এই মোবাইল নম্বরে আগেই অ্যাকাউন্ট আছে। সাইন ইন করুন।");
  const hash = await hashPassword(b.password);
  let id: number;
  if (existing) {
    // A guest who ordered before claims their record, so past orders appear in their history.
    await c.env.DB.prepare(`UPDATE customers SET name = ?, email = COALESCE(?, email), password_hash = ?, updated_at = ${SQL_NOW} WHERE id = ?`).bind(b.name, b.email, hash, existing.id).run();
    await c.env.DB.prepare("UPDATE orders SET customer_id = ? WHERE customer_phone = ? AND customer_id IS NULL").bind(existing.id, b.phone).run();
    id = existing.id;
  } else {
    const r = await c.env.DB.prepare("INSERT INTO customers (name, phone, email, password_hash) VALUES (?, ?, ?, ?)").bind(b.name, b.phone, b.email, hash).run();
    id = Number(r.meta.last_row_id);
  }
  await startSession(c, { id, name: b.name, phone: b.phone });
  return c.json({ ok: true, customer: { id, name: b.name, phone: b.phone } }, 201);
});

app.post("/auth/login", async (c) => {
  await rateLimit(c, "cust-login", 10, 900);
  const b = await body(c, loginSchema);
  await verifyTurnstile(c, b.turnstileToken);
  const cust = await c.env.DB.prepare("SELECT id, name, phone, password_hash, is_blocked FROM customers WHERE phone = ? AND deleted_at IS NULL")
    .bind(b.phone)
    .first<{ id: number; name: string; phone: string; password_hash: string | null; is_blocked: number }>();
  if (!cust || !(await verifyPassword(b.password, cust.password_hash))) {
    throw new ApiError(401, "bad_credentials", "Mobile number or password is incorrect.", "মোবাইল নম্বর বা পাসওয়ার্ড সঠিক নয়।");
  }
  if (cust.is_blocked) throw new ApiError(403, "blocked", "This account is paused. Please call us for help.", "এই অ্যাকাউন্টটি বন্ধ আছে। সাহায্যের জন্য কল করুন।");
  await c.env.DB.prepare(`UPDATE customers SET last_login_at = ${SQL_NOW} WHERE id = ?`).bind(cust.id).run();
  await startSession(c, cust);
  return c.json({ ok: true, customer: { id: cust.id, name: cust.name, phone: cust.phone } });
});

app.post("/auth/logout", async (c) => {
  const token = getCookie(c, CUSTOMER_COOKIE);
  if (token) await c.env.KV.delete(`s:c:${token}`);
  deleteCookie(c, CUSTOMER_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// Password reset via a 6-digit SMS code (KV, 10 minutes, max 5 tries).
app.post("/auth/reset/request", async (c) => {
  await rateLimit(c, "reset", 5, 3600);
  const { phone, lang } = await body(c, z.object({ phone: bdPhone, lang: z.enum(["bn", "en"]).default("bn") }));
  const cust = await c.env.DB.prepare("SELECT id FROM customers WHERE phone = ? AND password_hash IS NOT NULL AND deleted_at IS NULL").bind(phone).first();
  let devCode: string | undefined;
  if (cust) {
    const code = randomDigits(6);
    await c.env.KV.put(`otp:reset:${phone}`, JSON.stringify({ code, tries: 0 }), { expirationTtl: 600 });
    const msg = (await renderTemplate(c.env, "otp", lang, { code })) ?? code;
    c.executionCtx.waitUntil(sendSms(c.env, phone, msg, "otp"));
    if (c.env.ENVIRONMENT === "development") devCode = code;
  }
  // Same answer whether or not the number exists (prevents account enumeration).
  return c.json({ ok: true, en: "If this number has an account, we've sent a 6-digit code by SMS.", bn: "এই নম্বরে অ্যাকাউন্ট থাকলে ৬ সংখ্যার একটি কোড SMS এ পাঠানো হয়েছে।", devCode });
});

app.post("/auth/reset/confirm", async (c) => {
  await rateLimit(c, "reset-confirm", 10, 3600);
  const b = await body(c, z.object({ phone: bdPhone, code: z.string().regex(/^\d{6}$/), password: z.string().min(8).max(128) }));
  const key = `otp:reset:${b.phone}`;
  const raw = await c.env.KV.get(key);
  const stored = raw ? (JSON.parse(raw) as { code: string; tries: number }) : null;
  if (!stored || stored.tries >= 5) throw E.badRequest("The code has expired. Please request a new one.", "কোডের মেয়াদ শেষ। নতুন কোড চান।");
  if (!safeEqualStr(stored.code, b.code)) {
    await c.env.KV.put(key, JSON.stringify({ ...stored, tries: stored.tries + 1 }), { expirationTtl: 600 });
    throw E.badRequest("The code is not correct.", "কোডটি সঠিক নয়।");
  }
  await c.env.KV.delete(key);
  await c.env.DB.prepare(`UPDATE customers SET password_hash = ?, phone_verified_at = ${SQL_NOW}, updated_at = ${SQL_NOW} WHERE phone = ?`).bind(await hashPassword(b.password), b.phone).run();
  return c.json({ ok: true, en: "Password updated. Please sign in.", bn: "পাসওয়ার্ড পরিবর্তন হয়েছে। সাইন ইন করুন।" });
});

/** Who is signed in (null for guests) — lets the storefront check without triggering a 401. */
app.get("/session", optionalCustomer, async (c) => {
  const s = c.get("customer");
  if (!s) return c.json({ customer: null });
  const cust = await c.env.DB.prepare("SELECT id, name, phone, email, created_at FROM customers WHERE id = ? AND deleted_at IS NULL").bind(s.id).first();
  return c.json({ customer: cust ?? null });
});

// ---------------------------------------------------------------- signed-in account
const me = new Hono<AppEnv>();
me.use("*", requireCustomer);
const cid = (c: Context<AppEnv>) => c.get("customer")!.id;

me.get("/", async (c) => {
  const cust = await c.env.DB.prepare("SELECT id, name, phone, email, created_at FROM customers WHERE id = ?").bind(cid(c)).first();
  if (!cust) throw E.unauthorized();
  return c.json({ customer: cust });
});

me.put("/", async (c) => {
  const b = await body(
    c,
    z.object({
      name: z.string().trim().min(1).max(80),
      email: z.union([z.literal(""), z.email()]).optional().transform((v) => v || null),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8).max(128).optional(),
    }),
  );
  if (b.newPassword) {
    const row = await c.env.DB.prepare("SELECT password_hash FROM customers WHERE id = ?").bind(cid(c)).first<{ password_hash: string }>();
    if (!(await verifyPassword(b.currentPassword ?? "", row?.password_hash))) throw E.badRequest("Current password is incorrect.", "বর্তমান পাসওয়ার্ড সঠিক নয়।");
    await c.env.DB.prepare("UPDATE customers SET password_hash = ? WHERE id = ?").bind(await hashPassword(b.newPassword), cid(c)).run();
  }
  await c.env.DB.prepare(`UPDATE customers SET name = ?, email = ?, updated_at = ${SQL_NOW} WHERE id = ?`).bind(b.name, b.email, cid(c)).run();
  return c.json({ ok: true, en: "Saved.", bn: "সংরক্ষণ করা হয়েছে।" });
});

me.get("/orders", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.order_no, o.invoice_no, o.public_token, o.status, o.total, o.payment_method, o.payment_status, o.created_at, o.delivered_at, o.courier_partner, o.tracking_id,
            (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS item_count,
            (SELECT image FROM order_items WHERE order_id = o.id LIMIT 1) AS image,
            (SELECT status FROM return_requests WHERE order_id = o.id ORDER BY id DESC LIMIT 1) AS return_status
       FROM orders o WHERE (o.customer_id = ? OR o.customer_phone = ?) AND o.deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 100`,
  )
    .bind(cid(c), c.get("customer")!.phone)
    .all();
  return c.json({ orders: results });
});

// ---------- Addresses ----------
me.get("/addresses", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC").bind(cid(c)).all();
  return c.json({ addresses: results });
});

async function saveAddress(c: Context<AppEnv>, id: number | null) {
  const a = await body(c, savedAddressSchema);
  const customer = cid(c);
  const zone = resolveZone(await loadZones(c.env), a.division_id, a.district_id, a.upazila_id);
  if (a.is_default) await c.env.DB.prepare("UPDATE addresses SET is_default = 0 WHERE customer_id = ?").bind(customer).run();
  if (id) {
    const r = await c.env.DB.prepare(
      "UPDATE addresses SET label=?, recipient_name=?, phone=?, division_id=?, district_id=?, upazila_id=?, division=?, district=?, upazila=?, area=?, zone_code=?, is_default=? WHERE id=? AND customer_id=?",
    )
      .bind(a.label, a.recipient_name, a.phone, a.division_id, a.district_id, a.upazila_id, a.division, a.district, a.upazila, a.area, zone?.code ?? null, a.is_default, id, customer)
      .run();
    if (!r.meta.changes) throw E.notFound("Address");
    return c.json({ ok: true, id });
  }
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM addresses WHERE customer_id = ?").bind(customer).first<{ n: number }>();
  if ((count?.n ?? 0) >= 10) throw E.badRequest("You can save up to 10 addresses.", "সর্বোচ্চ ১০টি ঠিকানা সংরক্ষণ করা যায়।");
  const r = await c.env.DB.prepare(
    "INSERT INTO addresses (customer_id, label, recipient_name, phone, division_id, district_id, upazila_id, division, district, upazila, area, zone_code, is_default) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
  )
    .bind(customer, a.label, a.recipient_name, a.phone, a.division_id, a.district_id, a.upazila_id, a.division, a.district, a.upazila, a.area, zone?.code ?? null, a.is_default || (count?.n ?? 0) === 0 ? 1 : 0)
    .run();
  return c.json({ ok: true, id: Number(r.meta.last_row_id) }, 201);
}
me.post("/addresses", (c) => saveAddress(c, null));
me.put("/addresses/:id{[0-9]+}", (c) => saveAddress(c, Number(c.req.param("id"))));
me.delete("/addresses/:id{[0-9]+}", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("DELETE FROM addresses WHERE id = ? AND customer_id = ?").bind(id, cid(c)).run();
  return c.json({ ok: true });
});

// ---------- Wishlist ----------
me.get("/wishlist", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ${PRODUCT_CARD_COLUMNS} FROM wishlist w JOIN products p ON p.id = w.product_id WHERE w.customer_id = ? AND p.deleted_at IS NULL AND p.status = 'active' ORDER BY w.created_at DESC`,
  )
    .bind(cid(c))
    .all<CardRow>();
  return c.json({ items: results.map(toCard) });
});
me.post("/wishlist/:productId{[0-9]+}", async (c) => {
  await c.env.DB.prepare("INSERT OR IGNORE INTO wishlist (customer_id, product_id) SELECT ?, id FROM products WHERE id = ?").bind(cid(c), Number(c.req.param("productId"))).run();
  return c.json({ ok: true });
});
me.delete("/wishlist/:productId{[0-9]+}", async (c) => {
  await c.env.DB.prepare("DELETE FROM wishlist WHERE customer_id = ? AND product_id = ?").bind(cid(c), Number(c.req.param("productId"))).run();
  return c.json({ ok: true });
});

// ---------- Buy again: products the customer already uses, most recently ordered first ----------
me.get("/regulars", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ${PRODUCT_CARD_COLUMNS}, cat.name_en AS category_en, cat.name_bn AS category_bn,
            last.last_ordered, last.times, last.variant_id
       FROM (SELECT i.product_id, MAX(o.created_at) AS last_ordered, COUNT(DISTINCT o.id) AS times,
                    (SELECT i2.variant_id FROM order_items i2 JOIN orders o2 ON o2.id = i2.order_id
                      WHERE i2.product_id = i.product_id AND (o2.customer_id = ? OR o2.customer_phone = ?) ORDER BY o2.created_at DESC LIMIT 1) AS variant_id
               FROM order_items i JOIN orders o ON o.id = i.order_id
              WHERE (o.customer_id = ? OR o.customer_phone = ?) AND o.status IN ('confirmed','packed','shipped','delivered') AND o.deleted_at IS NULL
              GROUP BY i.product_id) last
       JOIN products p ON p.id = last.product_id LEFT JOIN categories cat ON cat.id = p.category_id
      WHERE p.deleted_at IS NULL
      ORDER BY last.last_ordered DESC`,
  )
    .bind(cid(c), c.get("customer")!.phone, cid(c), c.get("customer")!.phone)
    .all<CardRow & { category_en: string; category_bn: string; last_ordered: string; times: number; variant_id: number | null }>();
  return c.json({
    items: results.map((r) => ({ ...toCard(r), category_en: r.category_en, category_bn: r.category_bn, last_ordered: r.last_ordered, times: r.times, variant_id: r.variant_id })),
  });
});

// ---------- Return requests (self-service, within 7 days of delivery) ----------
me.post("/returns", async (c) => {
  await rateLimit(c, "returns", 10, 3600);
  const b = await body(c, returnRequestSchema);
  const o = await c.env.DB.prepare("SELECT id, status, delivered_at FROM orders WHERE order_no = ? AND (customer_id = ? OR customer_phone = ?) AND deleted_at IS NULL")
    .bind(b.orderNo, cid(c), c.get("customer")!.phone)
    .first<{ id: number; status: string; delivered_at: string | null }>();
  if (!o) throw E.notFound("Order");
  if (o.status !== "delivered" || !o.delivered_at) throw E.badRequest("Returns can be requested after the order is delivered.", "ডেলিভারির পরেই রিটার্নের অনুরোধ করা যায়।");
  if (Date.now() - Date.parse(o.delivered_at) > 7 * 86400_000) throw E.badRequest("The 7-day return window for this order has passed. Please call us.", "এই অর্ডারের ৭ দিনের রিটার্ন সময় শেষ। আমাদের কল করুন।");
  const open = await c.env.DB.prepare("SELECT 1 FROM return_requests WHERE order_id = ? AND status IN ('requested','approved','received')").bind(o.id).first();
  if (open) throw E.conflict("A return request for this order is already in progress.", "এই অর্ডারের রিটার্ন অনুরোধ ইতিমধ্যে চলছে।");
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO return_requests (order_id, customer_id, reason, details) VALUES (?, ?, ?, ?)").bind(o.id, cid(c), b.reason, b.details),
    c.env.DB.prepare("INSERT INTO order_status_history (order_id, status, note, actor) VALUES (?, 'delivered', ?, 'customer')").bind(o.id, `Return requested: ${b.reason}`),
  ]);
  return c.json({ ok: true, en: "Return request sent. We'll call you within 1 working day.", bn: "রিটার্নের অনুরোধ পাঠানো হয়েছে। ১ কর্মদিবসের মধ্যে আমরা কল করবো।" }, 201);
});

me.get("/returns", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT r.id, r.reason, r.details, r.status, r.refund_amount, r.admin_note, r.created_at, o.order_no FROM return_requests r JOIN orders o ON o.id = r.order_id WHERE r.customer_id = ? ORDER BY r.id DESC",
  )
    .bind(cid(c))
    .all();
  return c.json({ returns: results });
});

// ---------- Warranty claims (tied to an item of a delivered order, while its warranty runs) ----------
type WarrantyItem = {
  order_id: number; order_no: string; delivered_at: string; order_item_id: number; product_id: number | null; sku: string; name_en: string; name_bn: string;
  size: string | null; color: string | null; image: string | null; warranty_months: number; open_claim: string | null; serials: string | null;
};

/** Delivered items that carry a warranty, with the end date (delivery day + the warranty they were sold with). */
async function warrantyItems(c: Context<AppEnv>, where = "", args: unknown[] = []): Promise<(WarrantyItem & { warranty_until: string | null; in_warranty: boolean })[]> {
  const { results } = await c.env.DB.prepare(
    `SELECT o.id AS order_id, o.order_no, o.delivered_at, i.id AS order_item_id, i.product_id, i.sku, i.name_en, i.name_bn, i.size, i.color, i.image, i.warranty_months,
            (SELECT w.claim_no FROM warranty_claims w WHERE w.order_item_id = i.id AND w.status IN ('submitted','under_review','approved') LIMIT 1) AS open_claim,
            (SELECT GROUP_CONCAT(sn.serial, ', ') FROM serial_numbers sn WHERE sn.order_item_id = i.id) AS serials
       FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE (o.customer_id = ? OR o.customer_phone = ?) AND o.status = 'delivered' AND o.delivered_at IS NOT NULL AND o.deleted_at IS NULL AND i.warranty_months > 0 ${where}
      ORDER BY o.delivered_at DESC LIMIT 200`,
  )
    .bind(cid(c), c.get("customer")!.phone, ...args)
    .all<WarrantyItem>();
  const today = bdToday();
  return results.map((r) => {
    // Delivery day in Bangladesh time, so a parcel delivered at 11pm UTC counts from the right day.
    const until = warrantyUntil(bdToday(new Date(r.delivered_at)), r.warranty_months);
    return { ...r, warranty_until: until, in_warranty: Boolean(until && until >= today) };
  });
}

me.get("/warranty", async (c) => {
  const [items, claims] = await Promise.all([
    warrantyItems(c),
    c.env.DB.prepare(
      `SELECT w.id, w.claim_no, w.sku, w.serial, w.issue, w.details, w.status, w.resolution, w.customer_note, w.warranty_until, w.created_at, w.updated_at,
              o.order_no, i.name_en, i.name_bn, i.image
         FROM warranty_claims w JOIN orders o ON o.id = w.order_id JOIN order_items i ON i.id = w.order_item_id
        WHERE w.customer_id = ? OR w.phone = ? ORDER BY w.id DESC LIMIT 100`,
    )
      .bind(cid(c), c.get("customer")!.phone)
      .all(),
  ]);
  return c.json({ items, claims: claims.results });
});

me.post("/warranty", async (c) => {
  await rateLimit(c, "warranty", 6, 3600);
  const b = await body(c, warrantyClaimSchema);
  const [item] = await warrantyItems(c, "AND o.order_no = ? AND i.id = ?", [b.orderNo, b.orderItemId]);
  if (!item) throw E.badRequest("Pick an item from one of your delivered orders that has a warranty.", "আপনার ডেলিভারি হওয়া অর্ডারের ওয়ারেন্টিযুক্ত একটি পণ্য বেছে নিন।");
  if (!item.in_warranty) {
    throw E.badRequest(
      `The warranty for this item ended on ${item.warranty_until}. We can still help with a paid repair — please call us.`,
      `এই পণ্যের ওয়ারেন্টি ${item.warranty_until} তারিখে শেষ হয়েছে। টাকার বিনিময়ে মেরামতে সাহায্য করতে পারি — আমাদের কল করুন।`,
    );
  }
  if (item.open_claim) throw E.conflict(`Claim ${item.open_claim} for this item is already in progress.`, `এই পণ্যের ক্লেইম ${item.open_claim} ইতিমধ্যে চলছে।`);
  // When the shop logged serials for this order line, the claim must name one of them (it is the same unit).
  const sold = (item.serials ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const serial = b.serial?.trim().toUpperCase() || (sold.length === 1 ? sold[0]! : null);
  if (sold.length && (!serial || !sold.includes(serial))) {
    throw new ApiError(422, "validation", "That serial number doesn't match the unit we sent. Check the label on the box or the device.", "সিরিয়াল নম্বরটি আমাদের পাঠানো ইউনিটের সাথে মিলছে না। বক্স বা ডিভাইসের লেবেল দেখুন।", [
      { field: "serial", en: "Doesn't match this order.", bn: "এই অর্ডারের সাথে মিলছে না।" },
    ]);
  }
  const claimNo = await nextClaimNo(c.env);
  const phone = c.get("customer")!.phone;
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO warranty_claims (claim_no, order_id, order_item_id, customer_id, product_id, sku, serial, issue, details, photo_url, phone, warranty_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(claimNo, item.order_id, item.order_item_id, cid(c), item.product_id, item.sku, serial, b.issue, b.details, b.photo_url, phone, item.warranty_until),
      c.env.DB.prepare("INSERT INTO order_status_history (order_id, status, note, actor) VALUES (?, 'delivered', ?, 'customer')").bind(item.order_id, `Warranty claim ${claimNo}: ${b.issue} (${item.sku})`),
    ]);
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw E.conflict("A claim for this item is already in progress.", "এই পণ্যের ক্লেইম ইতিমধ্যে চলছে।");
    throw e;
  }
  const lang = c.req.header("accept-language")?.startsWith("en") ? "en" : "bn";
  c.executionCtx.waitUntil(sendTemplate(c.env, phone, "claim_received", lang, { claim_no: claimNo, product: lang === "en" ? item.name_en : item.name_bn }, item.order_id).then(() => undefined));
  return c.json(
    { ok: true, claimNo, en: `Claim ${claimNo} sent. We'll check it and call you within 2 working days.`, bn: `ক্লেইম ${claimNo} পাঠানো হয়েছে। যাচাই করে ২ কর্মদিবসের মধ্যে কল করবো।` },
    201,
  );
});

// ---------- Referral (give-and-get) ----------
me.get("/referral", async (c) => {
  const settings = await getSetting(c.env, "referral");
  if (!settings.enabled) return c.json({ enabled: false });
  let row = await c.env.DB.prepare("SELECT code, uses, rewards_earned, reward, friend_discount FROM referral_codes WHERE customer_id = ?").bind(cid(c)).first();
  if (!row) {
    const first = c.get("customer")!.name.split(" ")[0]!.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "FRIEND";
    const code = `${first}${randomCode(4)}`;
    await c.env.DB.prepare("INSERT OR IGNORE INTO referral_codes (code, customer_id, reward, friend_discount) VALUES (?, ?, ?, ?)").bind(code, cid(c), settings.reward, settings.friendDiscount).run();
    row = await c.env.DB.prepare("SELECT code, uses, rewards_earned, reward, friend_discount FROM referral_codes WHERE customer_id = ?").bind(cid(c)).first();
  }
  const rewards = await c.env.DB.prepare("SELECT code, value, expires_at, used_count FROM coupons WHERE kind = 'referral_reward' AND customer_phone = ? AND deleted_at IS NULL ORDER BY id DESC").bind(c.get("customer")!.phone).all();
  return c.json({ enabled: true, referral: row, rewards: rewards.results, minOrder: settings.minOrder });
});

app.route("/me", me);
export default app;

