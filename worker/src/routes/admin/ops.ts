/** Admin operations: abandoned checkouts, return/refund requests and referral codes. */
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Env } from "../../env";
import { body, E, intParam, likeText, parseJson, SQL_NOW } from "../../lib/http";
import { abandonedUpdateSchema, returnUpdateSchema } from "../../lib/schemas";
import { perm } from "../../middleware";
import { audit, getSetting, publicUrl } from "../../lib/store";
import { applyStatus, type OrderRow } from "../../lib/orders";
import { render, sendTemplate } from "../../lib/notify";
import { randomCode } from "../../lib/crypto";
import { BRAND } from "../../brand";
import { csvResponse } from "./crud";

const app = new Hono<AppEnv>();
const waNumber = (p: string) => p.replace(/\D/g, "").replace(/^0/, "880");

// ---------------------------------------------------------------- abandoned checkouts
/**
 * Sends the recovery message for an abandoned checkout, with a link that restores the cart and details.
 * When a recovery discount is configured, a single-use, time-limited coupon for that phone is added.
 */
export async function sendRecovery(env: Env, row: { id: number; session_id: string; name: string | null; phone: string; lang: string }, base: string): Promise<boolean> {
  const ab = await getSetting(env, "abandoned");
  let coupon = "";
  if (ab.recoveryDiscount > 0) {
    const code = `COMEBACK-${randomCode(5)}`;
    const expires = new Date(Date.now() + ab.recoveryValidHours * 3600_000).toISOString();
    await env.DB.prepare("INSERT INTO coupons (code, description, kind, type, value, usage_limit, per_customer_limit, customer_phone, expires_at) VALUES (?, ?, 'recovery', 'flat', ?, 1, 1, ?, ?)")
      .bind(code, `Abandoned-checkout recovery #${row.id}`, ab.recoveryDiscount, row.phone, expires)
      .run();
    await env.KV.put(`recovery:${row.session_id}`, code, { expirationTtl: ab.recoveryValidHours * 3600 });
    coupon = row.lang === "en" ? `Use code ${code} for Tk ${ab.recoveryDiscount} off (valid ${ab.recoveryValidHours}h).` : `কোড ${code} দিলে ৳${ab.recoveryDiscount} ছাড় (${ab.recoveryValidHours} ঘণ্টা)।`;
  }
  const link = `${base}/checkout?resume=${encodeURIComponent(row.session_id)}`;
  const ok = await sendTemplate(env, row.phone, "abandoned", row.lang, { name: (row.name ?? "").split(" ")[0], link, coupon });
  await env.DB.prepare(`UPDATE abandoned_checkouts SET recovery_sent_at = ${SQL_NOW}, contact_attempts = contact_attempts + 1, last_contacted_at = ${SQL_NOW} WHERE id = ?`).bind(row.id).run();
  return ok;
}

app.get("/abandoned", perm("abandoned.read"), async (c) => {
  const q = c.req.query();
  const ab = await getSetting(c.env, "abandoned");
  const cutoff = new Date(Date.now() - ab.minutes * 60_000).toISOString();
  const where: string[] = [];
  const args: unknown[] = [];
  const status = q.status || "open";
  if (status === "open") {
    // Abandoned = still open, has a phone number, and untouched for longer than the window.
    where.push("a.status = 'open' AND a.phone IS NOT NULL AND a.updated_at < ?");
    args.push(cutoff);
  } else if (status === "in_progress") {
    where.push("a.status = 'open' AND a.updated_at >= ?");
    args.push(cutoff);
  } else if (status !== "all") {
    where.push("a.status = ?");
    args.push(status);
  } else where.push("a.status != 'converted'");
  if (q.q) {
    const like = likeText(q.q);
    where.push("(a.name LIKE ? OR a.phone LIKE ? OR a.district LIKE ? OR a.area LIKE ?)");
    args.push(like, like, like, like);
  }
  const w = where.join(" AND ");
  const sql = `SELECT a.*, o.order_no FROM abandoned_checkouts a LEFT JOIN orders o ON o.id = a.order_id WHERE ${w} ORDER BY a.updated_at DESC`;
  if (q.format === "csv") {
    const rows = await c.env.DB.prepare(`${sql} LIMIT 20000`).bind(...args).all<Record<string, unknown> & { cart: string }>();
    await audit(c, "export", "abandoned_checkout", null, { rows: rows.results.length });
    return csvResponse(
      "abandoned-checkouts",
      rows.results.map((r) => ({ ...r, cart: parseJson<{ sku: string; quantity: number }[]>(r.cart, []).map((l) => `${l.sku} x${l.quantity}`).join("; ") })),
      ["updated_at", "name", "phone", "email", "district", "upazila", "area", "cart", "cart_total", "last_step", "status", "order_no", "contact_attempts", "utm_source", "utm_campaign"],
    );
  }
  const limit = intParam(q.limit, 20, 1, 200);
  const page = intParam(q.page, 1, 1, 100000);
  const [count, rows, counts] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM abandoned_checkouts a WHERE ${w}`).bind(...args).first<{ n: number }>(),
    c.env.DB.prepare(`${sql} LIMIT ? OFFSET ?`).bind(...args, limit, (page - 1) * limit).all<Record<string, unknown> & { cart: string; phone: string | null; name: string | null; lang: string }>(),
    c.env.DB.prepare(
      `SELECT SUM(CASE WHEN status = 'open' AND phone IS NOT NULL AND updated_at < ? THEN 1 ELSE 0 END) AS open,
              SUM(CASE WHEN status = 'recovered' THEN 1 ELSE 0 END) AS recovered, SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) AS ignored FROM abandoned_checkouts`,
    )
      .bind(cutoff)
      .first(),
  ]);
  const store = await getSetting(c.env, "store");
  const total = count?.n ?? 0;
  return c.json({
    items: rows.results.map((r) => {
      const msg = r.lang === "en" ? `Hi ${r.name ?? ""}! This is ${store.name_en}. We saw you were ordering — can we help you finish?` : `আসসালামু আলাইকুম ${r.name ?? ""}! ${store.name_bn} থেকে বলছি। আপনার অর্ডারটি শেষ করতে কোনো সাহায্য লাগবে?`;
      return {
        ...r,
        cart: parseJson(r.cart, []),
        tel: r.phone ? `tel:${r.phone}` : null,
        whatsapp: r.phone ? `https://wa.me/${waNumber(r.phone)}?text=${encodeURIComponent(render(msg, {}))}` : null,
      };
    }),
    total,
    page,
    pages: Math.ceil(total / limit),
    counts,
    windowMinutes: ab.minutes,
  });
});

app.post("/abandoned/:id{[0-9]+}", perm("abandoned.update"), async (c) => {
  const id = Number(c.req.param("id"));
  const b = await body(c, abandonedUpdateSchema);
  const row = await c.env.DB.prepare("SELECT id, session_id, name, phone, lang, status FROM abandoned_checkouts WHERE id = ?").bind(id).first<{ id: number; session_id: string; name: string | null; phone: string | null; lang: string; status: string }>();
  if (!row) throw E.notFound("Checkout");
  let msg = { en: "Updated.", bn: "আপডেট হয়েছে।" };
  switch (b.action) {
    case "contacted":
      await c.env.DB.prepare(`UPDATE abandoned_checkouts SET contact_attempts = contact_attempts + 1, last_contacted_at = ${SQL_NOW} WHERE id = ?`).bind(id).run();
      msg = { en: "Logged: customer contacted.", bn: "লেখা হয়েছে: গ্রাহকের সাথে যোগাযোগ হয়েছে।" };
      break;
    case "recovered":
      await c.env.DB.prepare(`UPDATE abandoned_checkouts SET status = 'recovered', updated_at = ${SQL_NOW} WHERE id = ?`).bind(id).run();
      msg = { en: "Marked as recovered.", bn: "উদ্ধার হয়েছে হিসেবে চিহ্নিত।" };
      break;
    case "ignored":
      await c.env.DB.prepare(`UPDATE abandoned_checkouts SET status = 'ignored', updated_at = ${SQL_NOW} WHERE id = ?`).bind(id).run();
      msg = { en: "Marked as not interested.", bn: "আগ্রহী নন হিসেবে চিহ্নিত।" };
      break;
    case "reopen":
      await c.env.DB.prepare("UPDATE abandoned_checkouts SET status = 'open' WHERE id = ? AND order_id IS NULL").bind(id).run();
      break;
    case "send_recovery": {
      if (!row.phone) throw E.badRequest("No phone number was captured for this checkout.", "এই চেকআউটে কোনো ফোন নম্বর নেই।");
      const ok = await sendRecovery(c.env, { ...row, phone: row.phone }, publicUrl(c.env, c.req.url));
      msg = ok ? { en: "Recovery message sent.", bn: "রিকভারি মেসেজ পাঠানো হয়েছে।" } : { en: "Couldn't send — SMS/WhatsApp isn't connected. Call or use the WhatsApp button instead.", bn: "পাঠানো যায়নি — SMS/হোয়াটসঅ্যাপ যুক্ত নেই। কল করুন বা হোয়াটসঅ্যাপ বাটন ব্যবহার করুন।" };
      break;
    }
  }
  await audit(c, b.action, "abandoned_checkout", id, b.note ? { note: b.note } : undefined);
  return c.json({ ok: true, ...msg });
});

// ---------------------------------------------------------------- return requests
app.get("/returns", perm("returns.read"), async (c) => {
  const q = c.req.query();
  const where = q.status ? "r.status = ?" : "1=1";
  const args = q.status ? [q.status] : [];
  const sql = `SELECT r.*, o.order_no, o.id AS order_id, o.customer_name, o.customer_phone, o.total, o.payment_method, o.status AS order_status, o.delivered_at
    FROM return_requests r JOIN orders o ON o.id = r.order_id WHERE ${where} ORDER BY CASE r.status WHEN 'requested' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, r.id DESC`;
  if (q.format === "csv") {
    const rows = await c.env.DB.prepare(`${sql} LIMIT 20000`).bind(...args).all<Record<string, unknown>>();
    return csvResponse("returns", rows.results, ["created_at", "order_no", "customer_name", "customer_phone", "reason", "details", "status", "refund_amount", "refund_method", "admin_note"]);
  }
  const limit = intParam(q.limit, 20, 1, 200);
  const page = intParam(q.page, 1, 1, 100000);
  const [count, rows] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM return_requests r WHERE ${where}`).bind(...args).first<{ n: number }>(),
    c.env.DB.prepare(`${sql} LIMIT ? OFFSET ?`).bind(...args, limit, (page - 1) * limit).all(),
  ]);
  const total = count?.n ?? 0;
  return c.json({ items: rows.results, total, page, pages: Math.ceil(total / limit) });
});

/**
 * Approve / reject a return. "Received" moves the order to Returned (stock goes back automatically) and
 * "Refunded" records the refund on the order.
 */
app.put("/returns/:id{[0-9]+}", perm("returns.update"), async (c) => {
  const id = Number(c.req.param("id"));
  const b = await body(c, returnUpdateSchema);
  const r = await c.env.DB.prepare("SELECT * FROM return_requests WHERE id = ?").bind(id).first<{ id: number; order_id: number; status: string; refund_amount: number }>();
  if (!r) throw E.notFound("Return");
  const o = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(r.order_id).first<OrderRow>();
  if (!o) throw E.notFound("Order");
  const allowed: Record<string, string[]> = { requested: ["approved", "rejected"], approved: ["received", "rejected"], received: ["refunded"], rejected: [], refunded: [] };
  if (!allowed[r.status]?.includes(b.status)) throw E.badRequest(`A "${r.status}" return can't be marked "${b.status}".`, `"${r.status}" রিটার্ন "${b.status}" করা যাবে না।`);
  const actor = c.get("admin")!.name;
  if (b.status === "received" && o.status === "delivered") {
    await applyStatus(c.env, o, { status: "returned", note: `Return #${id} received${b.admin_note ? `: ${b.admin_note}` : ""}`, notify: true }, actor, (p) => c.executionCtx.waitUntil(p));
  }
  if (b.status === "refunded") {
    const amount = b.refund_amount ?? r.refund_amount ?? 0;
    if (amount <= 0) throw E.badRequest("Enter the refund amount.", "রিফান্ডের পরিমাণ লিখুন।");
    const newTotal = o.refund_amount + amount;
    if (newTotal > o.total) throw E.badRequest(`Refund cannot exceed the order total (৳${o.total}).`, `রিফান্ড অর্ডারের মোট টাকার (৳${o.total}) বেশি হতে পারে না।`);
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE orders SET refund_amount = ?, refund_note = ?, payment_status = ?, updated_at = ${SQL_NOW} WHERE id = ?`).bind(newTotal, `Return #${id}${b.refund_method ? ` via ${b.refund_method}` : ""}`, newTotal >= o.total ? "refunded" : "partially_refunded", o.id),
      c.env.DB.prepare("INSERT INTO order_status_history (order_id, status, note, actor) VALUES (?, ?, ?, ?)").bind(o.id, o.status, `Refund ৳${amount} for return #${id}`, actor),
    ]);
  }
  await c.env.DB.prepare(`UPDATE return_requests SET status = ?, refund_amount = COALESCE(?, refund_amount), refund_method = COALESCE(?, refund_method), admin_note = COALESCE(?, admin_note), updated_at = ${SQL_NOW} WHERE id = ?`)
    .bind(b.status, b.refund_amount ?? null, b.refund_method, b.admin_note, id)
    .run();
  await audit(c, `return_${b.status}`, "return_request", id, b);
  return c.json({ ok: true, en: "Return updated.", bn: "রিটার্ন আপডেট হয়েছে।" });
});

// ---------------------------------------------------------------- referral codes
app.get("/referrals", perm("customers.read"), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.code, r.uses, r.rewards_earned, r.reward, r.friend_discount, r.is_active, r.created_at, c.name, c.phone,
            (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.referral_code = r.code AND o.status = 'delivered') AS delivered_revenue
       FROM referral_codes r JOIN customers c ON c.id = r.customer_id ORDER BY r.uses DESC, r.id DESC LIMIT 500`,
  ).all();
  if (c.req.query("format") === "csv") return csvResponse("referrals", results as Record<string, unknown>[]);
  return c.json({ items: results, brand: BRAND.name });
});

app.put("/referrals/:id{[0-9]+}", perm("customers.write"), async (c) => {
  const id = Number(c.req.param("id"));
  const b = await body(c, z.object({ is_active: z.boolean() }));
  await c.env.DB.prepare("UPDATE referral_codes SET is_active = ? WHERE id = ?").bind(b.is_active ? 1 : 0, id).run();
  await audit(c, "update", "referral_code", id, b);
  return c.json({ ok: true, en: "Saved.", bn: "সংরক্ষণ করা হয়েছে।" });
});

export default app;
