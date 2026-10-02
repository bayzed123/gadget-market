/**
 * Checkout API — live delivery fee, server-side cart quote, abandoned-checkout autosave, phone OTP,
 * order placement (COD / MFS / card redirect), order tracking and the PDF invoice.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { ApiError, body, clientIp, E, normalizeBdPhone, SQL_NOW, validate } from "../lib/http";
import { checkoutSchema, draftSchema, otpSendSchema, otpVerifySchema, quoteSchema } from "../lib/schemas";
import { getSetting, loadZones, publicUrl, rateLimit, verifyTurnstile } from "../lib/store";
import { createOrder, quote, STATUS_LABELS, type OrderRow } from "../lib/orders";
import { notifyOrder, sendSms, renderTemplate } from "../lib/notify";
import { bkashConfigured, bkashCreate, sslczConfigured, sslczInitiate } from "../lib/payments";
import { deliveryFee, resolveZone } from "../lib/pricing";
import { courierStatusLabel, trackingUrl } from "../lib/couriers";
import { randomDigits, randomToken, safeEqualStr } from "../lib/crypto";
import { eventIds, sendCapi } from "../lib/marketing";
import { invoicePdf, type InvoiceItem } from "../lib/invoice";
import { optionalCustomer } from "../middleware";
import { otpAvailable } from "./public";

const app = new Hono<AppEnv>();

// ---------- Delivery fee by Division / District / Upazila ----------
app.get("/delivery-fee", async (c) => {
  const q = validate(
    z.object({
      division_id: z.coerce.number().int().min(0).default(0),
      district_id: z.coerce.number().int().positive(),
      upazila_id: z.coerce.number().int().min(0).default(0),
      subtotal: z.coerce.number().int().min(0).default(0),
    }),
    c.req.query(),
  );
  const zone = resolveZone(await loadZones(c.env), q.division_id, q.district_id, q.upazila_id);
  if (!zone) throw E.badRequest("We don't deliver to this area yet.", "এই এলাকায় এখনো ডেলিভারি দেওয়া হয় না।");
  return c.json({
    zone: { code: zone.code, name_en: zone.name_en, name_bn: zone.name_bn, eta_en: zone.eta_en, eta_bn: zone.eta_bn, free_shipping_min: zone.free_shipping_min },
    fee: deliveryFee(zone, q.subtotal),
  });
});

app.post("/cart/quote", async (c) => {
  await rateLimit(c, "quote", 120, 300);
  const b = await body(c, quoteSchema);
  const address = b.address ?? null;
  return c.json(await quote(c.env, b.items, address, b.couponCode, b.phone ? normalizeBdPhone(b.phone) : null, b.giftWrap));
});

// ---------- Abandoned-checkout capture (autosaved on field blur) ----------
app.post("/checkout/draft", async (c) => {
  await rateLimit(c, "draft", 60, 300);
  const b = await body(c, draftSchema);
  const phone = b.phone ? normalizeBdPhone(b.phone) : null;
  let cart: unknown[] = [];
  let cartTotal = 0;
  if (b.items.length) {
    try {
      const q = await quote(c.env, b.items, null);
      cart = q.lines.map((l) => ({ variantId: l.variantId, sku: l.sku, name_en: l.name_en, name_bn: l.name_bn, size: l.size, quantity: l.quantity, unitPrice: l.unitPrice }));
      cartTotal = q.subtotal;
    } catch {
      /* stock may have changed — keep the contact details anyway */
    }
  }
  const existing = await c.env.DB.prepare("SELECT id, status, lead_sent_at FROM abandoned_checkouts WHERE session_id = ?").bind(b.sessionId).first<{ id: number; status: string; lead_sent_at: string | null }>();
  if (existing && existing.status !== "open") return c.json({ ok: true, status: existing.status });
  await c.env.DB.prepare(
    `INSERT INTO abandoned_checkouts (session_id, name, phone, email, division, district, upazila, area, cart, cart_total, last_step, utm_source, utm_medium, utm_campaign, ip, lang)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       name = COALESCE(NULLIF(excluded.name, ''), abandoned_checkouts.name),
       phone = COALESCE(excluded.phone, abandoned_checkouts.phone),
       email = COALESCE(NULLIF(excluded.email, ''), abandoned_checkouts.email),
       division = COALESCE(NULLIF(excluded.division, ''), abandoned_checkouts.division),
       district = COALESCE(NULLIF(excluded.district, ''), abandoned_checkouts.district),
       upazila = COALESCE(NULLIF(excluded.upazila, ''), abandoned_checkouts.upazila),
       area = COALESCE(NULLIF(excluded.area, ''), abandoned_checkouts.area),
       cart = CASE WHEN excluded.cart_total > 0 THEN excluded.cart ELSE abandoned_checkouts.cart END,
       cart_total = CASE WHEN excluded.cart_total > 0 THEN excluded.cart_total ELSE abandoned_checkouts.cart_total END,
       last_step = excluded.last_step, lang = excluded.lang,
       utm_source = COALESCE(abandoned_checkouts.utm_source, excluded.utm_source),
       utm_medium = COALESCE(abandoned_checkouts.utm_medium, excluded.utm_medium),
       utm_campaign = COALESCE(abandoned_checkouts.utm_campaign, excluded.utm_campaign),
       updated_at = ${SQL_NOW}`,
  )
    .bind(
      b.sessionId, b.name ?? null, phone, b.email ?? null, b.division ?? null, b.district ?? null, b.upazila ?? null, b.area ?? null,
      JSON.stringify(cart), cartTotal, b.lastStep, b.utm?.source ?? null, b.utm?.medium ?? null, b.utm?.campaign ?? null, clientIp(c), b.lang,
    )
    .run();

  // Meta "Lead" the first time a checkout captures a phone number (browser fires the same event_id).
  let leadEventId: string | null = null;
  if (phone && !existing?.lead_sent_at) {
    leadEventId = eventIds.lead(b.sessionId);
    await c.env.DB.prepare(`UPDATE abandoned_checkouts SET lead_sent_at = ${SQL_NOW} WHERE session_id = ?`).bind(b.sessionId).run();
    c.executionCtx.waitUntil(
      sendCapi(c.env, {
        name: "Lead",
        eventId: leadEventId,
        sourceUrl: `${publicUrl(c.env, c.req.url)}/checkout`,
        user: { phone, email: b.email, name: b.name, district: b.district, ip: clientIp(c), userAgent: c.req.header("user-agent"), fbp: b.fbp, fbc: b.fbc },
        custom: { value: cartTotal, content_ids: (cart as { sku: string }[]).map((l) => l.sku) },
      }),
    );
  }
  return c.json({ ok: true, leadEventId });
});

/** Recovery link (/checkout?resume=<session>) restores the cart and details captured before the customer left. */
app.get("/checkout/resume/:sid", async (c) => {
  await rateLimit(c, "resume", 30, 300);
  const row = await c.env.DB.prepare("SELECT name, phone, email, division, district, upazila, area, cart, status FROM abandoned_checkouts WHERE session_id = ?")
    .bind(c.req.param("sid"))
    .first<{ name: string | null; phone: string | null; email: string | null; division: string | null; district: string | null; upazila: string | null; area: string | null; cart: string; status: string }>();
  if (!row || row.status === "converted" || row.status === "recovered") throw E.notFound("Checkout");
  const cart = JSON.parse(row.cart || "[]") as { variantId: number; quantity: number }[];
  const coupon = await c.env.KV.get(`recovery:${c.req.param("sid")}`);
  return c.json({ items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), customer: { name: row.name, phone: row.phone, email: row.email }, address: { division: row.division, district: row.district, upazila: row.upazila, area: row.area }, coupon });
});

// ---------- Phone verification (SMS OTP) ----------
app.post("/otp/send", async (c) => {
  await rateLimit(c, "otp-ip", 10, 3600);
  const b = await body(c, otpSendSchema);
  if (!otpAvailable(c.env)) throw E.badRequest("SMS verification is not available right now — we'll call you to confirm instead.", "এখন SMS যাচাই চালু নেই — কনফার্ম করতে আমরা আপনাকে কল করবো।");
  await rateLimit(c, "otp-phone", 4, 3600, b.phone);
  await verifyTurnstile(c, b.turnstileToken);
  const code = randomDigits(6);
  await c.env.KV.put(`otp:checkout:${b.phone}`, JSON.stringify({ code, tries: 0 }), { expirationTtl: 600 });
  const msg = (await renderTemplate(c.env, "otp", b.lang, { code })) ?? `Code: ${code}`;
  c.executionCtx.waitUntil(sendSms(c.env, b.phone, msg, "otp"));
  const dev = c.env.ENVIRONMENT === "development";
  return c.json({ ok: true, en: "We've sent a 6-digit code by SMS.", bn: "৬ সংখ্যার একটি কোড SMS এ পাঠানো হয়েছে।", ...(dev ? { devCode: code } : {}) });
});

app.post("/otp/verify", async (c) => {
  await rateLimit(c, "otp-verify", 20, 3600);
  const b = await body(c, otpVerifySchema);
  const key = `otp:checkout:${b.phone}`;
  const raw = await c.env.KV.get(key);
  const stored = raw ? (JSON.parse(raw) as { code: string; tries: number }) : null;
  if (!stored || stored.tries >= 5) throw E.badRequest("The code has expired. Please request a new one.", "কোডের মেয়াদ শেষ। নতুন কোড চান।");
  if (!safeEqualStr(stored.code, b.code)) {
    await c.env.KV.put(key, JSON.stringify({ ...stored, tries: stored.tries + 1 }), { expirationTtl: 600 });
    throw new ApiError(422, "validation", "The code is not correct.", "কোডটি সঠিক নয়।", [{ field: "code", en: "The code is not correct.", bn: "কোডটি সঠিক নয়।" }]);
  }
  await c.env.KV.delete(key);
  const token = randomToken(24);
  await c.env.KV.put(`otpok:${token}`, b.phone, { expirationTtl: 3600 });
  return c.json({ ok: true, otpToken: token, en: "Number verified.", bn: "নম্বর যাচাই হয়েছে।" });
});

// ---------- Place order ----------
app.post("/orders", optionalCustomer, async (c) => {
  await rateLimit(c, "checkout", 15, 600);
  const input = await body(c, checkoutSchema);
  await verifyTurnstile(c, input.turnstileToken);

  const [payments, fraud] = await Promise.all([getSetting(c.env, "payments"), getSetting(c.env, "fraud")]);
  const pm = input.paymentMethod;
  const enabled =
    (pm === "COD" && payments.cod.enabled) ||
    (pm === "bKash" && payments.bkash.enabled) ||
    (pm === "Nagad" && payments.nagad.enabled) ||
    (pm === "Rocket" && payments.rocket.enabled) ||
    (pm === "Card" && payments.card.enabled && sslczConfigured(c.env));
  if (!enabled) throw E.badRequest("This payment method is not available right now.", "এই পেমেন্ট পদ্ধতি এখন চালু নেই।");
  const bkashApi = pm === "bKash" && payments.bkash.mode === "api" && bkashConfigured(c.env);
  if (["bKash", "Nagad", "Rocket"].includes(pm) && !bkashApi && !input.paymentRef?.trim()) {
    throw new ApiError(422, "validation", "Please enter the Transaction ID (TrxID) from your payment SMS.", "পেমেন্ট SMS থেকে ট্রানজেকশন আইডি (TrxID) লিখুন।", [
      { field: "paymentRef", en: "Required", bn: "আবশ্যক" },
    ]);
  }

  // Phone verification: the OTP token must belong to this exact number.
  let otpVerified = false;
  if (input.otpToken) {
    const phone = await c.env.KV.get(`otpok:${input.otpToken}`);
    otpVerified = phone === input.customer.phone;
  }
  if (pm === "COD" && fraud.requireOtp && otpAvailable(c.env) && !otpVerified) {
    throw new ApiError(422, "otp_required", "Please verify your mobile number with the SMS code to place a Cash on Delivery order.", "ক্যাশ অন ডেলিভারি অর্ডারের জন্য SMS কোড দিয়ে মোবাইল নম্বর যাচাই করুন।", [
      { field: "phone", en: "Verify this number", bn: "এই নম্বরটি যাচাই করুন" },
    ]);
  }

  const { order, quote: q, autoConfirmed } = await createOrder(c.env, input, { customerId: c.get("customer")?.id ?? null, ip: clientIp(c), otpVerified }, (p) => c.executionCtx.waitUntil(p));
  if (input.otpToken) await c.env.KV.delete(`otpok:${input.otpToken}`);
  c.executionCtx.waitUntil(notifyOrder(c.env, order, autoConfirmed ? "confirmed" : "placed"));

  // Server-side Purchase (Meta CAPI) — the confirmation page fires the Pixel with the same event_id.
  const purchaseId = eventIds.purchase(order.order_no);
  c.executionCtx.waitUntil(
    sendCapi(c.env, {
      name: "Purchase",
      eventId: purchaseId,
      sourceUrl: `${publicUrl(c.env, c.req.url)}/checkout`,
      user: { phone: order.customer_phone, email: order.customer_email, name: order.customer_name, district: order.district, externalId: order.customer_phone, ip: clientIp(c), userAgent: c.req.header("user-agent"), fbp: input.fbp, fbc: input.fbc },
      custom: { value: order.total, content_ids: q.lines.map((l) => l.sku), content_type: "product", num_items: q.lines.reduce((s, l) => s + l.quantity, 0), order_id: order.order_no },
    }),
  );

  let redirectUrl: string | null = null;
  const base = publicUrl(c.env, c.req.url);
  const payOrder = { ...order, item_count: q.lines.reduce((s, l) => s + l.quantity, 0) };
  try {
    if (bkashApi) {
      const r = await bkashCreate(c.env, payOrder, base);
      await c.env.KV.put(`bkash:pay:${r.gatewayRef}`, order.order_no, { expirationTtl: 3600 });
      redirectUrl = r.redirectUrl;
    } else if (pm === "Card") {
      redirectUrl = (await sslczInitiate(c.env, payOrder, base)).redirectUrl;
    }
  } catch (e) {
    console.error("payment init failed", e);
    await c.env.DB.prepare("UPDATE orders SET admin_notes = COALESCE(admin_notes || char(10), '') || ? WHERE id = ?").bind(`Payment start failed: ${String(e).slice(0, 200)}`, order.id).run();
  }
  return c.json(
    {
      orderNo: order.order_no,
      token: order.public_token,
      status: order.status,
      total: order.total,
      redirectUrl,
      purchaseEventId: purchaseId,
      items: q.lines.map((l) => ({ sku: l.sku, name: l.name_en, quantity: l.quantity, price: l.unitPrice })),
    },
    201,
  );
});

// ---------- Order tracking ----------
async function findOrder(c: { env: AppEnv["Bindings"] }, ref: string, token?: string, phone?: string): Promise<OrderRow | null> {
  const id = ref.trim().toUpperCase();
  const o = await c.env.DB.prepare("SELECT * FROM orders WHERE (order_no = ? OR invoice_no = ?) AND deleted_at IS NULL").bind(id, id).first<OrderRow>();
  if (!o) return null;
  const tokenOk = token && safeEqualStr(o.public_token, token);
  const phoneOk = phone && normalizeBdPhone(phone) === o.customer_phone;
  return tokenOk || phoneOk ? o : null;
}

app.get("/orders/track", async (c) => {
  await rateLimit(c, "track", 30, 300);
  const q = validate(z.object({ order: z.string().max(40), token: z.string().max(64).optional(), phone: z.string().max(20).optional() }), c.req.query());
  const o = await findOrder(c, q.order, q.token, q.phone);
  if (!o) throw E.notFound("Order");
  const [items, history, returns] = await Promise.all([
    c.env.DB.prepare("SELECT product_id, name_en, name_bn, sku, size, color, image, batches, quantity, unit_price, line_total FROM order_items WHERE order_id = ?").bind(o.id).all(),
    c.env.DB.prepare("SELECT status, created_at FROM order_status_history WHERE order_id = ? AND status != 'confirmation_attempted' ORDER BY id").bind(o.id).all(),
    c.env.DB.prepare("SELECT reason, status, refund_amount, created_at FROM return_requests WHERE order_id = ? ORDER BY id DESC").bind(o.id).all(),
  ]);
  const payments = await getSetting(c.env, "payments");
  return c.json({
    order: {
      order_no: o.order_no,
      invoice_no: o.invoice_no,
      public_token: q.token ? o.public_token : undefined,
      status: o.status,
      status_label: STATUS_LABELS[o.status],
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      payment_ref: o.payment_ref,
      subtotal: o.subtotal,
      discount: o.discount,
      delivery_fee: o.delivery_fee,
      gift_wrap: Boolean(o.gift_wrap),
      gift_wrap_fee: o.gift_wrap_fee,
      vat_amount: o.vat_amount,
      total: o.total,
      coupon_code: o.coupon_code ?? o.referral_code,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone.replace(/^(\d{3})\d{5}/, "$1*****"),
      address: `${o.area}, ${o.upazila}, ${o.district}`,
      courier_partner: o.courier_partner,
      tracking_id: o.tracking_id,
      courier_status: courierStatusLabel(o.courier_status),
      tracking_url: trackingUrl(o.courier_partner, o.tracking_id),
      gift_message: o.gift_message,
      otp_verified: Boolean(o.otp_verified),
      created_at: o.created_at,
      delivered_at: o.delivered_at,
      can_return: o.status === "delivered" && Boolean(o.delivered_at) && Date.now() - Date.parse(o.delivered_at!) < 7 * 86400_000,
    },
    mfs: ["bKash", "Nagad", "Rocket"].includes(o.payment_method)
      ? { number: payments[o.payment_method.toLowerCase() as "bkash" | "nagad" | "rocket"].manualNumber }
      : null,
    items: items.results,
    history: history.results,
    returns: returns.results,
  });
});

/** PDF invoice (available once the order is confirmed and has an invoice number). */
app.get("/orders/:orderNo/invoice.pdf", async (c) => {
  await rateLimit(c, "invoice", 30, 300);
  const o = await findOrder(c, c.req.param("orderNo"), c.req.query("token"), c.req.query("phone"));
  if (!o) throw E.notFound("Order");
  if (!o.invoice_no) throw E.badRequest("The invoice will be ready once your order is confirmed.", "অর্ডার কনফার্ম হলে ইনভয়েস তৈরি হবে।");
  const [items, store, tax] = await Promise.all([
    c.env.DB.prepare("SELECT i.sku, i.name_en, i.size, i.color, i.batches, i.warranty_months, i.quantity, i.unit_price, i.line_total, (SELECT GROUP_CONCAT(sn.serial, ', ') FROM serial_numbers sn WHERE sn.order_item_id = i.id) AS serials FROM order_items i WHERE i.order_id = ? ORDER BY i.id").bind(o.id).all<InvoiceItem>(),
    getSetting(c.env, "store"),
    getSetting(c.env, "tax"),
  ]);
  const pdf = invoicePdf(o, items.results, store, tax);
  return new Response(pdf, {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${o.invoice_no}.pdf"`, "cache-control": "private, no-store" },
  });
});

export default app;
