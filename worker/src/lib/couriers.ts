/**
 * Courier integrations. Steadfast is the primary partner (booking API + status webhook). Pathao can book through
 * its merchant API when credentials are set; RedX (and Pathao without keys) take a tracking ID typed by staff.
 * Courier sub-statuses (in review, hold, out for delivery …) are stored on the order as `courier_status`;
 * only final outcomes move the order pipeline.
 */
import type { Env } from "../env";

export type Courier = "Steadfast" | "Pathao" | "RedX";

export interface ConsignmentOrder {
  order_no: string;
  invoice_no?: string | null;
  customer_name: string;
  customer_phone: string;
  area: string;
  upazila: string;
  district: string;
  total: number;
  payment_status: string;
  customer_note: string | null;
}

export interface ConsignmentResult {
  consignmentId: string;
  trackingId: string;
}

const STEADFAST_BASE = "https://portal.packzy.com/api/v1";

export function steadfastConfigured(env: Env): boolean {
  return Boolean(env.STEADFAST_API_KEY && env.STEADFAST_SECRET_KEY);
}
export function pathaoConfigured(env: Env): boolean {
  return Boolean(env.PATHAO_CLIENT_ID && env.PATHAO_CLIENT_SECRET && env.PATHAO_USERNAME && env.PATHAO_PASSWORD && env.PATHAO_STORE_ID);
}

const codAmount = (o: ConsignmentOrder) => (o.payment_status === "paid" ? 0 : o.total);

export async function steadfastCreate(env: Env, order: ConsignmentOrder): Promise<ConsignmentResult> {
  const res = await fetch(`${STEADFAST_BASE}/create_order`, {
    method: "POST",
    headers: { "Api-Key": env.STEADFAST_API_KEY!, "Secret-Key": env.STEADFAST_SECRET_KEY!, "content-type": "application/json" },
    body: JSON.stringify({
      invoice: order.order_no,
      recipient_name: order.customer_name,
      recipient_phone: order.customer_phone,
      recipient_address: `${order.area}, ${order.upazila}, ${order.district}`.slice(0, 250),
      cod_amount: codAmount(order),
      note: order.customer_note ?? "",
    }),
  });
  const data = (await res.json()) as { status?: number; message?: string; consignment?: { consignment_id: number; tracking_code: string } };
  if (data.status !== 200 || !data.consignment) throw new Error(`Steadfast: ${data.message ?? `HTTP ${res.status}`}`);
  return { consignmentId: String(data.consignment.consignment_id), trackingId: data.consignment.tracking_code };
}

async function pathaoToken(env: Env): Promise<string> {
  const cached = await env.KV.get("pathao:token");
  if (cached) return cached;
  const res = await fetch("https://api-hermes.pathao.com/aladdin/api/v1/issue-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: env.PATHAO_CLIENT_ID, client_secret: env.PATHAO_CLIENT_SECRET, username: env.PATHAO_USERNAME, password: env.PATHAO_PASSWORD, grant_type: "password" }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error(`Pathao token failed (HTTP ${res.status})`);
  await env.KV.put("pathao:token", data.access_token, { expirationTtl: Math.max(300, (data.expires_in ?? 3600) - 600) });
  return data.access_token;
}

export async function pathaoCreate(env: Env, order: ConsignmentOrder): Promise<ConsignmentResult> {
  const res = await fetch("https://api-hermes.pathao.com/aladdin/api/v1/orders", {
    method: "POST",
    headers: { authorization: `Bearer ${await pathaoToken(env)}`, "content-type": "application/json" },
    body: JSON.stringify({
      store_id: Number(env.PATHAO_STORE_ID),
      merchant_order_id: order.order_no,
      recipient_name: order.customer_name,
      recipient_phone: order.customer_phone,
      recipient_address: `${order.area}, ${order.upazila}, ${order.district}`.slice(0, 220),
      delivery_type: 48,
      item_type: 2,
      item_quantity: 1,
      item_weight: 0.5,
      amount_to_collect: codAmount(order),
      special_instruction: order.customer_note ?? "",
    }),
  });
  const data = (await res.json()) as { data?: { consignment_id?: string }; message?: string };
  if (!data.data?.consignment_id) throw new Error(`Pathao: ${data.message ?? `HTTP ${res.status}`}`);
  return { consignmentId: data.data.consignment_id, trackingId: data.data.consignment_id };
}

export type CourierOutcome = "delivered" | "refused" | null;

/** Steadfast statuses → order outcome. "cancelled" means the parcel came back undelivered (customer refused). */
export function mapSteadfastStatus(s: string): CourierOutcome {
  switch (s) {
    case "delivered":
    case "partial_delivered":
    case "delivered_approval_pending":
    case "partial_delivered_approval_pending":
      return "delivered";
    case "cancelled":
    case "cancelled_approval_pending":
      return "refused";
    default:
      return null; // in_review, pending, hold, unknown → sub-status only
  }
}

/** Pathao webhook events → order outcome. */
export function mapPathaoStatus(s: string): CourierOutcome {
  const k = s.toLowerCase().replace(/[\s.-]+/g, "_");
  if (k.includes("delivered") && !k.includes("partial")) return "delivered";
  if (k.includes("partial_delivery") || k === "partial_delivered") return "delivered";
  if (k.includes("return") || k.includes("delivery_failed")) return "refused";
  return null;
}

/** Friendly, bilingual labels for courier sub-statuses shown on the order and tracking pages. */
export function courierStatusLabel(s: string | null): { en: string; bn: string } | null {
  if (!s) return null;
  const k = s.toLowerCase();
  if (k.includes("out_for_delivery") || k.includes("out for delivery")) return { en: "Out for delivery", bn: "ডেলিভারির পথে" };
  if (k.includes("hold")) return { en: "On hold at courier", bn: "কুরিয়ারে অপেক্ষমাণ" };
  if (k.includes("review") || k === "pending") return { en: "Received by courier", bn: "কুরিয়ার গ্রহণ করেছে" };
  if (k.includes("transit") || k.includes("pickup") || k.includes("picked")) return { en: "In transit", bn: "পথে আছে" };
  return { en: s.replace(/_/g, " "), bn: s.replace(/_/g, " ") };
}

export function trackingUrl(courier: Courier | null, trackingId: string | null): string | null {
  if (!courier || !trackingId) return null;
  const id = encodeURIComponent(trackingId);
  switch (courier) {
    case "Steadfast":
      return `https://steadfast.com.bd/t/${id}`;
    case "Pathao":
      return `https://merchant.pathao.com/tracking?consignment_id=${id}`;
    case "RedX":
      return `https://redx.com.bd/track-parcel/?trackingId=${id}`;
  }
}

export async function createConsignment(env: Env, courier: Courier, order: ConsignmentOrder): Promise<ConsignmentResult | null> {
  if (courier === "Steadfast" && steadfastConfigured(env)) return steadfastCreate(env, order);
  if (courier === "Pathao" && pathaoConfigured(env)) return pathaoCreate(env, order);
  return null; // staff enter the tracking ID from the courier's merchant panel
}
