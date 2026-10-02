/**
 * Fraud prevention: customer risk scoring, velocity checks, the courier phone-history lookup and the
 * confirmation / dispatch gates. The owner sees plain-language badges, never raw scores:
 *   low    → 🟢 Trusted              (skips the manual confirmation call when the number is verified)
 *   medium → 🟡 New                  (needs OTP or a logged call to confirm, and a call before dispatch)
 *   high   → 🔴 Verify before shipping
 */
import type { Env } from "../env";
import { parseJson } from "./http";

export type RiskLevel = "low" | "medium" | "high";
export type Bi = { en: string; bn: string };

export interface DeliveryHistory {
  totalOrders: number;
  delivered: number;
  refusedOrReturned: number;
  cancelled: number;
  blocked?: boolean;
}

/** Normalised courier-network history for a phone number (from a fraud-checker service). */
export interface CourierHistory {
  total: number;
  delivered: number;
  returned: number;
  source: string;
}

export interface RiskResult {
  level: RiskLevel;
  reason: Bi;
}

export function computeRisk(h: DeliveryHistory, courier: CourierHistory | null = null, trustedMinDelivered = 3): RiskResult {
  if (h.blocked) return { level: "high", reason: { en: "Blocked by staff.", bn: "স্টাফ ব্লক করেছেন।" } };
  if (h.refusedOrReturned >= 2) {
    return { level: "high", reason: { en: `Refused or returned ${h.refusedOrReturned} parcels before.`, bn: `আগে ${h.refusedOrReturned}টি পার্সেল নেননি বা ফেরত দিয়েছেন।` } };
  }
  if (h.refusedOrReturned >= 1 && h.refusedOrReturned * 2 >= h.delivered) {
    return { level: "high", reason: { en: "Refused or returned a parcel and has few deliveries.", bn: "একটি পার্সেল নেননি/ফেরত দিয়েছেন, সফল ডেলিভারি কম।" } };
  }
  if (courier && courier.total >= 3) {
    const rate = courier.delivered / courier.total;
    if (rate < 0.6) {
      const pct = Math.round((1 - rate) * 100);
      return { level: "high", reason: { en: `Courier history: ${pct}% of ${courier.total} parcels were not accepted.`, bn: `কুরিয়ার রেকর্ড: ${courier.total}টির মধ্যে ${pct}% পার্সেল নেওয়া হয়নি।` } };
    }
  }
  if (h.delivered >= trustedMinDelivered && h.refusedOrReturned === 0) {
    return { level: "low", reason: { en: `${h.delivered} orders delivered, none refused.`, bn: `${h.delivered}টি অর্ডার ডেলিভারি হয়েছে, কোনোটি ফেরত নেই।` } };
  }
  if (h.delivered === 0 && h.totalOrders <= 1) {
    if (courier && courier.total >= 3 && courier.delivered / courier.total >= 0.9) {
      return { level: "medium", reason: { en: `New to us; courier history looks good (${courier.delivered}/${courier.total} delivered).`, bn: `আমাদের নতুন গ্রাহক; কুরিয়ার রেকর্ড ভালো (${courier.total}টির ${courier.delivered}টি ডেলিভারি)।` } };
    }
    return { level: "medium", reason: { en: "New customer — first order.", bn: "নতুন গ্রাহক — প্রথম অর্ডার।" } };
  }
  return { level: "medium", reason: { en: `${h.delivered} delivered so far — not enough history to trust yet.`, bn: `এখন পর্যন্ত ${h.delivered}টি ডেলিভারি — এখনো যথেষ্ট রেকর্ড নেই।` } };
}

export const RISK_BADGES: Record<RiskLevel, Bi & { emoji: string }> = {
  low: { emoji: "🟢", en: "Trusted", bn: "বিশ্বস্ত" },
  medium: { emoji: "🟡", en: "New", bn: "নতুন" },
  high: { emoji: "🔴", en: "Verify before shipping", bn: "পাঠানোর আগে যাচাই করুন" },
};

// ---------------------------------------------------------------- confirmation & dispatch gates
export interface GateOrder {
  payment_status: string;
  otp_verified: number;
  risk_level: RiskLevel;
}
export interface GateAttempt {
  outcome: "no_answer" | "confirmed" | "declined";
}

export type Gate = { ok: true; method: "prepaid" | "otp" | "call" | "trusted" } | { ok: false; reason: Bi };

/** A COD (unpaid) order can reach "Confirmed" only after OTP verification or a logged confirmation call. */
export function confirmGate(o: GateOrder, attempts: GateAttempt[]): Gate {
  if (o.payment_status === "paid") return { ok: true, method: "prepaid" };
  if (attempts.some((a) => a.outcome === "confirmed")) return { ok: true, method: "call" };
  if (o.otp_verified) return { ok: true, method: o.risk_level === "low" ? "trusted" : "otp" };
  return {
    ok: false,
    reason: {
      en: "This order can't be confirmed yet: the phone number isn't verified. Call the customer and log the call as \"Confirmed\" first.",
      bn: "এই অর্ডার এখনো কনফার্ম করা যাবে না: ফোন নম্বর যাচাই হয়নি। আগে গ্রাহককে কল করে \"কনফার্ম\" হিসেবে লিখে রাখুন।",
    },
  };
}

/** Anything above "Trusted" needs a logged confirmation call before it is handed to the courier (unless prepaid). */
export function dispatchGate(o: GateOrder, attempts: GateAttempt[]): Gate {
  if (o.payment_status === "paid") return { ok: true, method: "prepaid" };
  if (attempts.some((a) => a.outcome === "confirmed")) return { ok: true, method: "call" };
  if (o.risk_level === "low" && o.otp_verified) return { ok: true, method: "trusted" };
  return {
    ok: false,
    reason: {
      en: "Call the customer before shipping: this customer isn't marked Trusted yet. Log the call as \"Confirmed\", then ship.",
      bn: "পাঠানোর আগে গ্রাহককে কল করুন: এই গ্রাহক এখনো \"বিশ্বস্ত\" নন। কলটি \"কনফার্ম\" হিসেবে লিখে তারপর পাঠান।",
    },
  };
}

// ---------------------------------------------------------------- history & velocity (D1)
export async function historyForPhone(env: Env, phone: string): Promise<DeliveryHistory> {
  const [row, cust] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
              SUM(CASE WHEN status IN ('refused','returned') THEN 1 ELSE 0 END) AS rr,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
         FROM orders WHERE customer_phone = ? AND deleted_at IS NULL`,
    )
      .bind(phone)
      .first<{ total: number; delivered: number | null; rr: number | null; cancelled: number | null }>(),
    env.DB.prepare("SELECT is_blocked FROM customers WHERE phone = ?").bind(phone).first<{ is_blocked: number }>(),
  ]);
  return {
    totalOrders: row?.total ?? 0,
    delivered: row?.delivered ?? 0,
    refusedOrReturned: row?.rr ?? 0,
    cancelled: row?.cancelled ?? 0,
    blocked: Boolean(cust?.is_blocked),
  };
}

/** Recomputes a customer's counters and risk level from their orders (called after every outcome change). */
export async function refreshCustomerRisk(env: Env, phone: string, trustedMinDelivered = 3): Promise<RiskResult> {
  const h = await historyForPhone(env, phone);
  const courier = parseJson<CourierHistory | null>(await env.KV.get(`fraud:${phone}`), null);
  const r = computeRisk(h, courier, trustedMinDelivered);
  await env.DB.prepare(
    `UPDATE customers SET total_orders = ?, delivered_count = ?, refused_or_returned_count = ?, cancelled_count = ?,
            risk_level = ?, risk_reason = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE phone = ?`,
  )
    .bind(h.totalOrders, h.delivered, h.refusedOrReturned, h.cancelled, r.level, JSON.stringify(r.reason), phone)
    .run();
  return r;
}

export type VelocityFlag = "velocity_phone" | "velocity_address" | "velocity_ip";

export const FLAG_LABELS: Record<VelocityFlag, Bi> = {
  velocity_phone: { en: "Several orders from this phone in a short time", bn: "অল্প সময়ে এই ফোন থেকে একাধিক অর্ডার" },
  velocity_address: { en: "Several orders to this address in a short time", bn: "অল্প সময়ে এই ঠিকানায় একাধিক অর্ডার" },
  velocity_ip: { en: "Several orders from the same internet connection", bn: "একই ইন্টারনেট সংযোগ থেকে একাধিক অর্ডার" },
};

/** Flags repeated orders from one phone, address or IP inside the window (counts include the new order). */
export async function velocityFlags(
  env: Env,
  o: { phone: string; ip: string; upazila_id: number; area: string },
  s: { velocityWindowMin: number; velocityMaxPerPhone: number; velocityMaxPerAddress: number; velocityMaxPerIp: number },
): Promise<VelocityFlag[]> {
  const since = new Date(Date.now() - s.velocityWindowMin * 60_000).toISOString();
  const areaKey = o.area.toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, " ").trim().slice(0, 40);
  const row = await env.DB.prepare(
    `SELECT SUM(CASE WHEN customer_phone = ? THEN 1 ELSE 0 END) AS phone,
            SUM(CASE WHEN upazila_id = ? AND lower(area) LIKE ? THEN 1 ELSE 0 END) AS addr,
            SUM(CASE WHEN ip = ? AND ? != 'unknown' THEN 1 ELSE 0 END) AS ip
       FROM orders WHERE created_at >= ? AND deleted_at IS NULL`,
  )
    .bind(o.phone, o.upazila_id, `%${areaKey.replace(/[%_]/g, "")}%`, o.ip, o.ip, since)
    .first<{ phone: number | null; addr: number | null; ip: number | null }>();
  const flags: VelocityFlag[] = [];
  if ((row?.phone ?? 0) + 1 > s.velocityMaxPerPhone) flags.push("velocity_phone");
  if (areaKey.length >= 6 && (row?.addr ?? 0) + 1 > s.velocityMaxPerAddress) flags.push("velocity_address");
  if ((row?.ip ?? 0) + 1 > s.velocityMaxPerIp) flags.push("velocity_ip");
  return flags;
}

// ---------------------------------------------------------------- courier fraud-checker lookup
/**
 * Looks the phone up with a courier fraud-checker aggregator (FRAUD_CHECK_API_URL / FRAUD_CHECK_API_KEY),
 * which reports past delivered vs returned parcels across Steadfast, Pathao, RedX and others.
 * Results are cached for 24 hours. Returns null when no service is configured or the call fails.
 */
export async function courierLookup(env: Env, phone: string): Promise<CourierHistory | null> {
  const cached = await env.KV.get(`fraud:${phone}`);
  if (cached) return parseJson<CourierHistory | null>(cached, null);
  if (!env.FRAUD_CHECK_API_URL) return null;
  try {
    const url = new URL(env.FRAUD_CHECK_API_URL);
    url.searchParams.set("phone", phone);
    const res = await fetch(url, { headers: { authorization: `Bearer ${env.FRAUD_CHECK_API_KEY ?? ""}`, accept: "application/json" } });
    if (!res.ok) return null;
    const h = normalizeCourierResponse(await res.json());
    if (h) await env.KV.put(`fraud:${phone}`, JSON.stringify(h), { expirationTtl: 86400 });
    return h;
  } catch {
    return null;
  }
}

/** Accepts the common response shapes of Bangladeshi courier-check aggregators. */
export function normalizeCourierResponse(data: unknown): CourierHistory | null {
  const d = data as Record<string, any>;
  const s = d?.courierData?.summary ?? d?.summary ?? d?.data?.summary ?? d?.data ?? d;
  const total = Number(s?.total_parcel ?? s?.total_parcels ?? s?.total ?? NaN);
  const delivered = Number(s?.success_parcel ?? s?.delivered_parcel ?? s?.success ?? s?.delivered ?? NaN);
  const returned = Number(s?.cancelled_parcel ?? s?.returned_parcel ?? s?.cancel ?? s?.returned ?? (Number.isFinite(total) && Number.isFinite(delivered) ? total - delivered : NaN));
  if (!Number.isFinite(total) || !Number.isFinite(delivered)) return null;
  return { total, delivered, returned: Number.isFinite(returned) ? returned : Math.max(0, total - delivered), source: "courier-check" };
}
