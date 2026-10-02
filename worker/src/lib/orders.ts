/**
 * Orders: server-side pricing, order creation (with fraud checks and abandoned-checkout linking) and the
 * delivery pipeline shared by the admin, the courier webhooks and the background jobs.
 *
 *   Pending → Confirmation Attempted → Confirmed → Packed → Shipped → Delivered
 *   Off-ramps: Cancelled (before shipping) · Refused (courier attempted, customer declined) · Returned (after delivery)
 */
import type { Env } from "../env";
import type { CheckoutInput } from "./schemas";
import { ApiError, E, parseJson, SQL_NOW } from "./http";
import { deliveryFee, effectiveUnitPrice, evaluateCoupon, resolveZone, vatFor, COUPON_MESSAGES, type CouponRule } from "./pricing";
import { expandCategoryIds, getSetting, loadZones } from "./store";
import { randomCode, randomToken } from "./crypto";
import { BRAND } from "../brand";
import { assignInvoiceNo } from "./sku";
import { computeRisk, confirmGate, courierLookup, dispatchGate, historyForPhone, refreshCustomerRisk, velocityFlags, type RiskLevel } from "./risk";
import { createConsignment, type Courier } from "./couriers";
import { notifyOrder, sendTemplate } from "./notify";
import { allocationStatements, planAllocations, restoreStatements, type Allocation } from "./batches";

export type OrderStatus = "pending" | "confirmation_attempted" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled" | "refused" | "returned";

export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmation_attempted", "confirmed", "cancelled"],
  confirmation_attempted: ["confirmation_attempted", "confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "refused"],
  delivered: ["returned"],
  cancelled: [],
  refused: [],
  returned: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from]?.includes(to) ?? false;
/**
 * Cancelled and refused parcels were never opened, so their units go back on sale (into the same batches).
 * Returned items have been with the customer — an opened gadget is inspected before it can be resold, so returns do not
 * go back on sale automatically; staff add a sealed unit back (or write a faulty one off) by hand in Inventory.
 */
export const restoresStock = (to: OrderStatus) => to === "cancelled" || to === "refused";
export const FINAL_OUTCOMES: OrderStatus[] = ["delivered", "cancelled", "refused", "returned"];

export const STATUS_LABELS: Record<OrderStatus, { en: string; bn: string }> = {
  pending: { en: "Pending", bn: "অপেক্ষমাণ" },
  confirmation_attempted: { en: "Confirmation attempted", bn: "কনফার্মের চেষ্টা হয়েছে" },
  confirmed: { en: "Confirmed", bn: "কনফার্মড" },
  packed: { en: "Packed", bn: "প্যাকড" },
  shipped: { en: "Shipped", bn: "পাঠানো হয়েছে" },
  delivered: { en: "Delivered", bn: "ডেলিভারি হয়েছে" },
  cancelled: { en: "Cancelled", bn: "বাতিল" },
  refused: { en: "Refused at delivery", bn: "ডেলিভারির সময় নেননি" },
  returned: { en: "Returned", bn: "ফেরত এসেছে" },
};

export interface OrderRow {
  id: number;
  order_no: string;
  invoice_no: string | null;
  public_token: string;
  session_id: string | null;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  division_id: number;
  district_id: number;
  upazila_id: number;
  division: string;
  district: string;
  upazila: string;
  area: string;
  zone_code: string;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  vat_amount: number;
  total: number;
  coupon_code: string | null;
  referral_code: string | null;
  payment_method: "COD" | "bKash" | "Nagad" | "Rocket" | "Card";
  payment_status: string;
  payment_ref: string | null;
  status: OrderStatus;
  courier_partner: Courier | null;
  tracking_id: string | null;
  consignment_id: string | null;
  courier_status: string | null;
  customer_note: string | null;
  gift_message: string | null;
  lang: "bn" | "en";
  admin_notes: string | null;
  refund_amount: number;
  refund_note: string | null;
  otp_verified: number;
  confirmation_method: string | null;
  risk_level: RiskLevel;
  risk_reasons: string;
  flags: string;
  fraud_check: string | null;
  ip: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  ad_ref: string | null;
  gift_wrap: number;
  gift_wrap_fee: number;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  review_requested_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function newOrderNo(): string {
  const d = new Date(Date.now() + 6 * 3600_000);
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `${BRAND.orderPrefix}-${ymd}-${randomCode(4)}`;
}

interface VariantJoin {
  variant_id: number;
  product_id: number;
  sku: string;
  size: string;
  color: string;
  stock: number;
  price_override: number | null;
  price: number;
  sale_price: number | null;
  name_en: string;
  name_bn: string;
  images: string;
  category_id: number | null;
  status: string;
  delivery_mode: "zone" | "free";
}

export interface QuoteLine {
  variantId: number;
  productId: number;
  categoryId: number | null;
  sku: string;
  name_en: string;
  name_bn: string;
  size: string;
  color: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  freeDelivery: boolean;
}

/** Why the delivery charge is zero, so the shop can say "Free delivery" instead of showing a charge. */
export type FreeDeliveryReason = "products" | "coupon" | "threshold";

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  couponId: number | null;
  referralCode: string | null;
  zone: { code: string; name_en: string; name_bn: string; eta_en?: string | null; eta_bn?: string | null } | null;
  deliveryFee: number;
  /** Set when delivery is free (all items ship free, a free-delivery coupon, or the area's free-over amount). */
  freeDelivery: FreeDeliveryReason | null;
  /** Gift box (box, ribbon and a handwritten card) — a flat add-on set in Settings → Store information. */
  giftWrap: boolean;
  giftWrapFee: number;
  vat: number;
  vatInclusive: boolean;
  total: number;
}

export interface AddressIds {
  division_id: number;
  district_id: number;
  upazila_id: number;
}

/** Prices a cart on the server — the browser's prices are never trusted. Address is optional (fee shown later). */
export async function quote(
  env: Env,
  items: { variantId: number; quantity: number }[],
  address?: AddressIds | null,
  couponCode?: string,
  phone?: string | null,
  giftWrap = false,
): Promise<Quote> {
  const merged = new Map<number, number>();
  for (const it of items) merged.set(it.variantId, (merged.get(it.variantId) ?? 0) + it.quantity);
  const ids = [...merged.keys()];
  const { results } = await env.DB.prepare(
    `SELECT v.id AS variant_id, v.product_id, v.sku, v.size, v.color, v.stock, v.price_override,
            p.price, p.sale_price, p.name_en, p.name_bn, p.images, p.category_id, p.status, p.delivery_mode
       FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE v.id IN (${ids.map(() => "?").join(",")}) AND p.deleted_at IS NULL`,
  )
    .bind(...ids)
    .all<VariantJoin>();
  const byId = new Map(results.map((r) => [r.variant_id, r]));

  const lines: QuoteLine[] = [];
  for (const [variantId, quantity] of merged) {
    const v = byId.get(variantId);
    if (!v || v.status !== "active") {
      throw new ApiError(409, "unavailable", "An item in your cart is no longer available. Please remove it and try again.", "আপনার কার্টের একটি পণ্য আর পাওয়া যাচ্ছে না। সেটি সরিয়ে আবার চেষ্টা করুন।");
    }
    if (v.stock < quantity) {
      const opt = [v.size !== "Standard" ? v.size : "", v.color].filter(Boolean).join(", ");
      throw new ApiError(
        409,
        "out_of_stock",
        v.stock === 0 ? `"${v.name_en}"${opt ? ` (${opt})` : ""} just sold out.` : `Only ${v.stock} left of "${v.name_en}"${opt ? ` (${opt})` : ""}. Please reduce the quantity.`,
        v.stock === 0 ? `"${v.name_bn}"${opt ? ` (${opt})` : ""} এইমাত্র শেষ হয়ে গেছে।` : `"${v.name_bn}"${opt ? ` (${opt})` : ""} মাত্র ${v.stock}টি আছে। পরিমাণ কমিয়ে দিন।`,
      );
    }
    const unitPrice = effectiveUnitPrice(v, v);
    lines.push({
      variantId,
      productId: v.product_id,
      categoryId: v.category_id,
      sku: v.sku,
      name_en: v.name_en,
      name_bn: v.name_bn,
      size: v.size,
      color: v.color,
      image: parseJson<string[]>(v.images, [])[0] ?? null,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      freeDelivery: v.delivery_mode === "free",
    });
  }
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  let discount = 0;
  let couponFreeDelivery = false;
  let couponId: number | null = null;
  let appliedCode: string | null = null;
  let referralCode: string | null = null;
  const code = couponCode?.trim();
  if (code) {
    const row = await env.DB.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND deleted_at IS NULL")
      .bind(code)
      .first<Omit<CouponRule, "category_ids"> & { id: number; category_ids: string }>();
    if (row) {
      const rule: CouponRule = { ...row, category_ids: await expandCategoryIds(env, parseJson<number[]>(row.category_ids, [])) };
      const res = evaluateCoupon(rule, lines.map((l) => ({ category_id: l.categoryId, line_total: l.lineTotal })), phone);
      if (!res.ok) throw new ApiError(422, "coupon", COUPON_MESSAGES[res.reason].en, COUPON_MESSAGES[res.reason].bn);
      discount = res.discount;
      couponFreeDelivery = Boolean(res.freeDelivery);
      couponId = row.id;
      appliedCode = row.code;
    } else {
      // Give-and-get referral code: a discount on the friend's first order.
      const ref = await env.DB.prepare("SELECT r.code, r.friend_discount, r.is_active, c.phone AS owner_phone FROM referral_codes r JOIN customers c ON c.id = r.customer_id WHERE r.code = ? COLLATE NOCASE")
        .bind(code)
        .first<{ code: string; friend_discount: number; is_active: number; owner_phone: string }>();
      const settings = await getSetting(env, "referral");
      if (!ref || !ref.is_active || !settings.enabled) throw new ApiError(422, "coupon", COUPON_MESSAGES.not_found.en, COUPON_MESSAGES.not_found.bn);
      if (phone && phone === ref.owner_phone) throw new ApiError(422, "coupon", COUPON_MESSAGES.referral_own.en, COUPON_MESSAGES.referral_own.bn);
      if (phone) {
        const prior = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE customer_phone = ? AND status NOT IN ('cancelled') AND deleted_at IS NULL").bind(phone).first<{ n: number }>();
        if ((prior?.n ?? 0) > 0) throw new ApiError(422, "coupon", COUPON_MESSAGES.referral_used.en, COUPON_MESSAGES.referral_used.bn);
      }
      if (subtotal < settings.minOrder) throw new ApiError(422, "coupon", COUPON_MESSAGES.min_order.en, COUPON_MESSAGES.min_order.bn);
      discount = Math.min(ref.friend_discount || settings.friendDiscount, subtotal);
      referralCode = ref.code;
    }
  }

  // Delivery: free when every item ships free or a free-delivery coupon applies; otherwise the charge is
  // auto-calculated from the customer's area (and may still be free over the area's free-delivery amount).
  let freeDelivery: FreeDeliveryReason | null = lines.length > 0 && lines.every((l) => l.freeDelivery) ? "products" : couponFreeDelivery ? "coupon" : null;
  let zone: Quote["zone"] = null;
  let fee = 0;
  if (address) {
    const z = resolveZone(await loadZones(env), address.division_id, address.district_id, address.upazila_id);
    if (!z) throw E.badRequest("We don't deliver to this area yet.", "এই এলাকায় এখনো ডেলিভারি দেওয়া হয় না।");
    zone = { code: z.code, name_en: z.name_en, name_bn: z.name_bn, eta_en: z.eta_en, eta_bn: z.eta_bn };
    if (!freeDelivery) {
      fee = deliveryFee(z, subtotal - discount);
      if (fee === 0) freeDelivery = "threshold";
    }
  }
  const [tax, store] = await Promise.all([getSetting(env, "tax"), getSetting(env, "store")]);
  const vat = vatFor(subtotal - discount, tax);
  const wrap = Boolean(giftWrap && store.gift_wrap_enabled !== false && lines.length > 0);
  const giftWrapFee = wrap ? Math.max(0, Math.round(Number(store.gift_wrap_fee) || 0)) : 0;

  return {
    lines,
    subtotal,
    discount,
    couponCode: appliedCode,
    couponId,
    referralCode,
    zone,
    deliveryFee: fee,
    freeDelivery,
    giftWrap: wrap,
    giftWrapFee,
    vat: vat.vat,
    vatInclusive: tax.inclusive,
    total: subtotal - discount + fee + giftWrapFee + vat.addToTotal,
  };
}

export interface CreateContext {
  customerId: number | null;
  ip: string;
  otpVerified: boolean;
}

export interface CreatedOrder {
  order: OrderRow;
  quote: Quote;
  autoConfirmed: boolean;
}

/**
 * Creates the order, its items, status history, stock decrements and inventory log in one D1 batch
 * (a D1 batch is a single transaction). Stock decrements are guarded by CHECK (stock >= 0): if another
 * checkout took the last unit, the whole order rolls back.
 */
export async function createOrder(env: Env, input: CheckoutInput, ctx: CreateContext, waitUntil?: (p: Promise<unknown>) => void): Promise<CreatedOrder> {
  const phone = input.customer.phone;

  const addr = input.address;

  const q = await quote(env, input.items, addr, input.couponCode, phone, input.giftWrap);
  if (!q.zone) throw E.badRequest("We don't deliver to this area yet.", "এই এলাকায় এখনো ডেলিভারি দেওয়া হয় না।");

  const cust = await env.DB.prepare("SELECT id, is_blocked FROM customers WHERE phone = ?").bind(phone).first<{ id: number; is_blocked: number }>();
  if (cust?.is_blocked) throw new ApiError(403, "blocked", "We couldn't place this order. Please call us for help.", "অর্ডারটি সম্পন্ন করা যায়নি। সাহায্যের জন্য আমাদের কল করুন।");

  // Per-customer coupon limit (matched on the mobile number; cancelled orders don't count).
  if (q.couponId) {
    const c = await env.DB.prepare("SELECT per_customer_limit FROM coupons WHERE id = ?").bind(q.couponId).first<{ per_customer_limit: number | null }>();
    if (c?.per_customer_limit) {
      const used = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE coupon_code = ? COLLATE NOCASE AND customer_phone = ? AND status != 'cancelled' AND deleted_at IS NULL")
        .bind(q.couponCode, phone)
        .first<{ n: number }>();
      if ((used?.n ?? 0) >= c.per_customer_limit) throw new ApiError(422, "coupon", "You have already used this coupon the maximum number of times.", "আপনি এই কুপনটি সর্বোচ্চ সংখ্যকবার ব্যবহার করেছেন।");
    }
  }

  // Fraud checks: delivery history + courier network history → risk; velocity → flags.
  const fraud = await getSetting(env, "fraud");
  const [history, courier, flags] = await Promise.all([
    historyForPhone(env, phone),
    fraud.courierCheck ? courierLookup(env, phone) : Promise.resolve(null),
    velocityFlags(env, { phone, ip: ctx.ip, upazila_id: addr.upazila_id, area: addr.area }, fraud),
  ]);
  const risk = computeRisk(history, courier, fraud.trustedMinDelivered);
  const reasons = [risk.reason];

  // Attribution: UTM from the landing page, else a recent click-to-WhatsApp ad lead for this phone.
  let utmSource = input.utm?.source || null;
  let utmMedium = input.utm?.medium || null;
  let utmCampaign = input.utm?.campaign || null;
  let adRef = input.adRef || null;
  if (!utmSource) {
    const lead = await env.DB.prepare("SELECT ad_ref FROM wa_leads WHERE phone = ? AND created_at >= datetime('now', '-30 days') ORDER BY id DESC LIMIT 1").bind(phone).first<{ ad_ref: string }>();
    if (lead) {
      utmSource = "whatsapp";
      utmMedium = "ctwa";
      utmCampaign = lead.ad_ref;
      adRef = lead.ad_ref;
    }
  }

  const orderNo = newOrderNo();
  const token = randomToken(18);
  const isManualMfs = ["bKash", "Nagad", "Rocket"].includes(input.paymentMethod) && Boolean(input.paymentRef);
  const orderIdSql = "(SELECT id FROM orders WHERE order_no = ?)";

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)
       ON CONFLICT(phone) DO UPDATE SET email = COALESCE(customers.email, excluded.email), updated_at = ${SQL_NOW}`,
    ).bind(input.customer.name, phone, input.customer.email),
    env.DB.prepare(
      `INSERT INTO orders (order_no, public_token, session_id, customer_id, customer_name, customer_phone, customer_email,
         division_id, district_id, upazila_id, division, district, upazila, area, zone_code,
         subtotal, discount, delivery_fee, gift_wrap, gift_wrap_fee, vat_amount, total, coupon_code, referral_code, payment_method, payment_status, payment_ref,
         customer_note, gift_message, lang, otp_verified, risk_level, risk_reasons, flags, fraud_check, ip,
         utm_source, utm_medium, utm_campaign, ad_ref)
       VALUES (?, ?, ?, COALESCE(?, (SELECT id FROM customers WHERE phone = ?)), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      orderNo, token, input.sessionId ?? null, ctx.customerId, phone, input.customer.name, phone, input.customer.email,
      addr.division_id, addr.district_id, addr.upazila_id, addr.division, addr.district, addr.upazila, addr.area, q.zone.code,
      q.subtotal, q.discount, q.deliveryFee, q.giftWrap ? 1 : 0, q.giftWrapFee, q.vat, q.total, q.couponCode, q.referralCode, input.paymentMethod,
      isManualMfs ? input.paymentRef!.trim() : null, input.note || null, input.giftMessage || null, input.lang,
      ctx.otpVerified ? 1 : 0, risk.level, JSON.stringify(reasons), JSON.stringify(flags), courier ? JSON.stringify(courier) : null, ctx.ip,
      utmSource, utmMedium, utmCampaign, adRef,
    ),
  ];
  // Stock lots: units are taken from the oldest lot (FIFO); the order line remembers which.
  const plan = await planAllocations(env, q.lines);
  for (const l of q.lines) {
    const alloc = plan.get(l.variantId) ?? [];
    stmts.push(
      env.DB.prepare(
        `INSERT INTO order_items (order_id, product_id, variant_id, category_id, sku, name_en, name_bn, size, color, image, batches, warranty_months, quantity, unit_price, line_total)
         VALUES (${orderIdSql}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT warranty_months FROM products WHERE id = ?), 0), ?, ?, ?)`,
      ).bind(orderNo, l.productId, l.variantId, l.categoryId, l.sku, l.name_en, l.name_bn, l.size, l.color, l.image, JSON.stringify(alloc), l.productId, l.quantity, l.unitPrice, l.lineTotal),
      ...allocationStatements(env, alloc),
      env.DB.prepare(`UPDATE product_variants SET stock = stock - ?, updated_at = ${SQL_NOW} WHERE id = ?`).bind(l.quantity, l.variantId),
      env.DB.prepare("UPDATE products SET sold_count = sold_count + ? WHERE id = ?").bind(l.quantity, l.productId),
      env.DB.prepare(
        "INSERT INTO inventory_log (product_id, variant_id, sku, change, stock_after, reason, note, actor) VALUES (?, ?, ?, ?, (SELECT stock FROM product_variants WHERE id = ?), 'order', ?, 'customer')",
      ).bind(l.productId, l.variantId, l.sku, -l.quantity, l.variantId, orderNo),
    );
  }
  if (q.couponId) stmts.push(env.DB.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?").bind(q.couponId));
  if (q.referralCode) stmts.push(env.DB.prepare("UPDATE referral_codes SET uses = uses + 1 WHERE code = ? COLLATE NOCASE").bind(q.referralCode));
  const placedNote = [
    isManualMfs ? `${input.paymentMethod} TrxID: ${input.paymentRef}` : `Placed with ${input.paymentMethod}`,
    ctx.otpVerified ? "phone verified by SMS code" : "phone not verified",
    flags.length ? `flags: ${flags.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  stmts.push(env.DB.prepare(`INSERT INTO order_status_history (order_id, status, note, actor) VALUES (${orderIdSql}, 'pending', ?, 'customer')`).bind(orderNo, placedNote));
  if (ctx.otpVerified) stmts.push(env.DB.prepare(`UPDATE customers SET phone_verified_at = ${SQL_NOW} WHERE phone = ?`).bind(phone));

  // Abandoned-checkout capture: link the draft(s) for this session / phone to the order.
  // Drafts older than the abandoned window were already surfaced to staff → "recovered"; fresh ones → "converted".
  const ab = await getSetting(env, "abandoned");
  const cutoff = new Date(Date.now() - ab.minutes * 60_000).toISOString();
  stmts.push(
    env.DB.prepare(
      `UPDATE abandoned_checkouts SET status = CASE WHEN updated_at < ? THEN 'recovered' ELSE 'converted' END, order_id = ${orderIdSql}, updated_at = ${SQL_NOW}
        WHERE status = 'open' AND (session_id = ? OR phone = ?)`,
    ).bind(cutoff, orderNo, input.sessionId ?? "-", phone),
  );

  try {
    await env.DB.batch(stmts);
  } catch (e) {
    if (String(e).includes("CHECK")) {
      throw new ApiError(409, "out_of_stock", "Sorry — an item just sold out. Please review your cart.", "দুঃখিত — একটি পণ্য এইমাত্র শেষ হয়ে গেছে। কার্ট দেখে আবার চেষ্টা করুন।");
    }
    throw e;
  }
  let order = (await env.DB.prepare("SELECT * FROM orders WHERE order_no = ?").bind(orderNo).first<OrderRow>())!;
  await refreshCustomerRisk(env, phone, fraud.trustedMinDelivered);

  // Trusted-customer fast lane: verified number + trusted history + no velocity flags → confirmed automatically.
  let autoConfirmed = false;
  if (fraud.autoConfirmTrusted && ctx.otpVerified && risk.level === "low" && flags.length === 0 && input.paymentMethod === "COD") {
    order = await applyStatus(env, order, { status: "confirmed", note: "Auto-confirmed: trusted customer, verified number", notify: false }, "system", waitUntil);
    autoConfirmed = true;
  }
  return { order, quote: q, autoConfirmed };
}

// ---------------------------------------------------------------- pipeline
export interface StatusChange {
  status: OrderStatus;
  note?: string;
  courier?: Courier;
  trackingId?: string;
  createConsignment?: boolean;
  notify: boolean;
}

/** Builds the D1 statements that put stock back (into the batches the units came from) for an order. */
export async function restockStatements(env: Env, o: OrderRow, reason: "cancel" | "refused" | "return", actor: string): Promise<D1PreparedStatement[]> {
  const { results } = await env.DB.prepare("SELECT product_id, variant_id, sku, quantity, batches FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL")
    .bind(o.id)
    .all<{ product_id: number; variant_id: number; sku: string; quantity: number; batches: string }>();
  const out: D1PreparedStatement[] = [];
  for (const it of results) {
    out.push(
      ...restoreStatements(env, parseJson<Allocation[]>(it.batches, [])),
      env.DB.prepare(`UPDATE product_variants SET stock = stock + ?, updated_at = ${SQL_NOW} WHERE id = ?`).bind(it.quantity, it.variant_id),
      env.DB.prepare("UPDATE products SET sold_count = MAX(0, sold_count - ?) WHERE id = ?").bind(it.quantity, it.product_id),
      env.DB.prepare(
        "INSERT INTO inventory_log (product_id, variant_id, sku, change, stock_after, reason, note, actor) VALUES (?, ?, ?, ?, (SELECT stock FROM product_variants WHERE id = ?), ?, ?, ?)",
      ).bind(it.product_id, it.variant_id, it.sku, it.quantity, it.variant_id, reason, o.order_no, actor),
    );
  }
  return out;
}

async function attemptsFor(env: Env, orderId: number) {
  const { results } = await env.DB.prepare("SELECT outcome FROM order_confirmation_attempts WHERE order_id = ?").bind(orderId).all<{ outcome: "no_answer" | "confirmed" | "declined" }>();
  return results;
}

/** Moves an order along the pipeline, enforcing the confirmation and dispatch gates. Shared by admin, webhooks and jobs. */
export async function applyStatus(env: Env, o: OrderRow, ch: StatusChange, actor: string, waitUntil?: (p: Promise<unknown>) => void): Promise<OrderRow> {
  if (!canTransition(o.status, ch.status)) {
    const from = STATUS_LABELS[o.status], to = STATUS_LABELS[ch.status];
    throw new ApiError(409, "bad_transition", `An order that is "${from.en}" cannot be moved to "${to.en}".`, `"${from.bn}" অবস্থার অর্ডার "${to.bn}" এ নেওয়া যাবে না।`);
  }
  let confirmationMethod = o.confirmation_method;
  if (ch.status === "confirmed") {
    const gate = confirmGate(o, await attemptsFor(env, o.id));
    if (!gate.ok) throw new ApiError(409, "needs_confirmation", gate.reason.en, gate.reason.bn);
    confirmationMethod = gate.method;
  }

  let courier = ch.courier ?? o.courier_partner;
  let tracking = ch.trackingId?.trim() || o.tracking_id;
  let consignment = o.consignment_id;
  if (ch.status === "shipped") {
    const gate = dispatchGate(o, await attemptsFor(env, o.id));
    if (!gate.ok) throw new ApiError(409, "needs_call", gate.reason.en, gate.reason.bn);
    if (!courier) throw new ApiError(422, "validation", "Choose a courier before marking as shipped.", "শিপড করার আগে কুরিয়ার নির্বাচন করুন।", [{ field: "courier", en: "Required", bn: "আবশ্যক" }]);
    if (ch.createConsignment && !tracking) {
      try {
        const r = await createConsignment(env, courier, o);
        if (r) {
          tracking = r.trackingId;
          consignment = r.consignmentId;
        }
      } catch (e) {
        throw new ApiError(502, "courier", `Courier booking failed: ${String(e).slice(0, 160)}`, "কুরিয়ার বুকিং ব্যর্থ হয়েছে। ট্র্যাকিং আইডি হাতে লিখে দিন।");
      }
    }
    if (!tracking) throw new ApiError(422, "validation", "Enter the courier tracking ID.", "কুরিয়ারের ট্র্যাকিং আইডি লিখুন।", [{ field: "trackingId", en: "Required", bn: "আবশ্যক" }]);
  }

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `UPDATE orders SET status = ?, courier_partner = ?, tracking_id = ?, consignment_id = ?, confirmation_method = ?,
         payment_status = CASE WHEN ? = 'delivered' AND payment_method = 'COD' AND payment_status = 'pending' THEN 'paid' ELSE payment_status END,
         confirmed_at = CASE WHEN ? = 'confirmed' THEN ${SQL_NOW} ELSE confirmed_at END,
         shipped_at = CASE WHEN ? = 'shipped' THEN ${SQL_NOW} ELSE shipped_at END,
         delivered_at = CASE WHEN ? = 'delivered' THEN ${SQL_NOW} ELSE delivered_at END,
         courier_status = CASE WHEN ? IN ('delivered','refused') THEN ? ELSE courier_status END,
         updated_at = ${SQL_NOW} WHERE id = ? AND status = ?`,
    ).bind(ch.status, courier, tracking, consignment, confirmationMethod, ch.status, ch.status, ch.status, ch.status, ch.status, ch.status, o.id, o.status),
    env.DB.prepare("INSERT INTO order_status_history (order_id, status, note, actor) VALUES (?, ?, ?, ?)").bind(o.id, ch.status, ch.note ?? null, actor),
  ];
  if (restoresStock(ch.status)) {
    stmts.push(...(await restockStatements(env, o, ch.status === "cancelled" ? "cancel" : "refused", actor)));
    if (ch.status === "cancelled") {
      if (o.coupon_code) stmts.push(env.DB.prepare("UPDATE coupons SET used_count = MAX(0, used_count - 1) WHERE code = ? COLLATE NOCASE").bind(o.coupon_code));
      if (o.referral_code) stmts.push(env.DB.prepare("UPDATE referral_codes SET uses = MAX(0, uses - 1) WHERE code = ? COLLATE NOCASE").bind(o.referral_code));
    }
  }
  const res = await env.DB.batch(stmts);
  if (!res[0]?.meta.changes) throw E.conflict("This order was just changed by someone else. Please refresh.", "অর্ডারটি এইমাত্র অন্য কেউ পরিবর্তন করেছে। রিফ্রেশ করুন।");

  if (ch.status === "confirmed") await assignInvoiceNo(env, o.id);
  const updated = (await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(o.id).first<OrderRow>())!;

  const after: Promise<unknown>[] = [];
  if (ch.status === "delivered") after.push(onDelivered(env, updated));
  if (FINAL_OUTCOMES.includes(ch.status)) {
    const fraud = await getSetting(env, "fraud");
    after.push(refreshCustomerRisk(env, updated.customer_phone, fraud.trustedMinDelivered));
  }
  if (ch.notify && ch.status !== "confirmation_attempted") after.push(notifyOrder(env, updated, ch.status === "pending" ? "placed" : ch.status));
  const job = Promise.allSettled(after);
  if (waitUntil) waitUntil(job);
  else await job;
  return updated;
}

/** Logs a confirmation call / message with its outcome. "Confirmed" confirms the order; "Declined" cancels it. */
export async function logAttempt(
  env: Env,
  o: OrderRow,
  a: { outcome: "no_answer" | "confirmed" | "declined"; method: "call" | "whatsapp" | "sms"; note?: string },
  staff: { id: number | null; name: string },
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<OrderRow> {
  await env.DB.prepare("INSERT INTO order_confirmation_attempts (order_id, method, outcome, note, staff_id, staff_name) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(o.id, a.method, a.outcome, a.note ?? null, staff.id, staff.name)
    .run();
  const early = o.status === "pending" || o.status === "confirmation_attempted";
  if (a.outcome === "no_answer" && early) {
    return applyStatus(env, o, { status: "confirmation_attempted", note: `No answer (${a.method})${a.note ? `: ${a.note}` : ""}`, notify: false }, staff.name, waitUntil);
  }
  if (a.outcome === "confirmed" && early) {
    return applyStatus(env, o, { status: "confirmed", note: `Confirmed by ${a.method}${a.note ? `: ${a.note}` : ""}`, notify: true }, staff.name, waitUntil);
  }
  if (a.outcome === "declined" && canTransition(o.status, "cancelled")) {
    return applyStatus(env, o, { status: "cancelled", note: `Customer declined on ${a.method}${a.note ? `: ${a.note}` : ""}`, notify: true }, staff.name, waitUntil);
  }
  return (await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(o.id).first<OrderRow>())!;
}

/** After delivery: reward the referrer. */
async function onDelivered(env: Env, o: OrderRow): Promise<void> {
  if (o.referral_code) {
    const ref = await env.DB.prepare("SELECT r.id, r.reward, c.phone, c.name FROM referral_codes r JOIN customers c ON c.id = r.customer_id WHERE r.code = ? COLLATE NOCASE")
      .bind(o.referral_code)
      .first<{ id: number; reward: number; phone: string; name: string }>();
    if (ref) {
      const settings = await getSetting(env, "referral");
      const code = `THANKS-${randomCode(6)}`;
      const expires = new Date(Date.now() + 90 * 86400_000).toISOString();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO coupons (code, description, kind, type, value, min_order, usage_limit, per_customer_limit, customer_phone, expires_at) VALUES (?, ?, 'referral_reward', 'flat', ?, 0, 1, 1, ?, ?)",
        ).bind(code, `Referral reward for ${o.order_no}`, ref.reward || settings.reward, ref.phone, expires),
        env.DB.prepare("UPDATE referral_codes SET rewards_earned = rewards_earned + 1 WHERE id = ?").bind(ref.id),
      ]);
      await sendTemplate(env, ref.phone, "referral_reward", o.lang, { name: ref.name.split(" ")[0], coupon: code });
    }
  }
}
