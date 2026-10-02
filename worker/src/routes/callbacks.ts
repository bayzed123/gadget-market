/** Payment gateway callbacks and courier / WhatsApp webhooks (CSRF-exempt; each verifies its own authenticity). */
import { Hono } from "hono";
import type { AppEnv, Env } from "../env";
import { SQL_NOW } from "../lib/http";
import { bkashExecute, sslczValidate, sslczConfigured } from "../lib/payments";
import { mapPathaoStatus, mapSteadfastStatus, type CourierOutcome } from "../lib/couriers";
import { hmacSha256, safeEqualStr, toHex } from "../lib/crypto";
import { applyStatus, type OrderRow } from "../lib/orders";
import { notifyOrder } from "../lib/notify";

const app = new Hono<AppEnv>();

async function markPaid(env: Env, orderNo: string, ref: string, amount: number | undefined, source: string): Promise<OrderRow | null> {
  const o = await env.DB.prepare("SELECT * FROM orders WHERE order_no = ?").bind(orderNo).first<OrderRow>();
  if (!o) return null;
  if (amount != null && Math.round(amount) < o.total) {
    await env.DB.prepare("UPDATE orders SET admin_notes = COALESCE(admin_notes || char(10), '') || ? WHERE id = ?").bind(`${source}: paid amount ${amount} is less than total ${o.total}`, o.id).run();
    return o;
  }
  await env.DB.batch([
    env.DB.prepare(`UPDATE orders SET payment_status = 'paid', payment_ref = ?, updated_at = ${SQL_NOW} WHERE id = ?`).bind(ref, o.id),
    env.DB.prepare("INSERT INTO order_status_history (order_id, status, note, actor) VALUES (?, ?, ?, ?)").bind(o.id, o.status, `Payment received (${ref})`, source),
  ]);
  return o;
}

// ---- bKash: the browser returns here after the customer approves/cancels on the bKash page ----
app.get("/payments/bkash/callback", async (c) => {
  const paymentID = c.req.query("paymentID") ?? "";
  const status = c.req.query("status");
  const orderNo = paymentID ? await c.env.KV.get(`bkash:pay:${paymentID}`) : null;
  if (!orderNo) return c.redirect("/checkout?payment=failed");
  const o = await c.env.DB.prepare("SELECT public_token FROM orders WHERE order_no = ?").bind(orderNo).first<{ public_token: string }>();
  const confirmUrl = `/order/${orderNo}?token=${o?.public_token ?? ""}`;
  if (status !== "success") {
    await c.env.DB.prepare("UPDATE orders SET payment_status = 'failed' WHERE order_no = ? AND payment_status = 'pending'").bind(orderNo).run();
    return c.redirect(`${confirmUrl}&payment=${status === "cancel" ? "cancelled" : "failed"}`);
  }
  const r = await bkashExecute(c.env, paymentID);
  if (r.ok && r.trxID && r.invoice === orderNo) {
    await markPaid(c.env, orderNo, r.trxID, r.amount, "bKash");
    await c.env.KV.delete(`bkash:pay:${paymentID}`);
    return c.redirect(`${confirmUrl}&payment=paid`);
  }
  await c.env.DB.prepare("UPDATE orders SET payment_status = 'failed' WHERE order_no = ? AND payment_status = 'pending'").bind(orderNo).run();
  return c.redirect(`${confirmUrl}&payment=failed`);
});

// ---- SSLCommerz: the IPN (server-to-server) is the source of truth; the browser return just shows status ----
app.post("/payments/sslcommerz/ipn", async (c) => {
  if (!sslczConfigured(c.env)) return c.text("not configured", 404);
  const form = await c.req.parseBody();
  const valId = String(form["val_id"] ?? "");
  if (!valId) return c.text("missing val_id", 400);
  const v = await sslczValidate(c.env, valId);
  if (v.ok && v.tranId) await markPaid(c.env, v.tranId, v.bankTranId ?? valId, v.amount, "SSLCommerz");
  return c.text("OK");
});

app.post("/payments/sslcommerz/return", async (c) => {
  const form = await c.req.parseBody();
  const tranId = String(form["tran_id"] ?? "");
  const result = c.req.query("result");
  const token = String(form["value_a"] ?? "");
  if (result === "success" && form["val_id"] && sslczConfigured(c.env)) {
    const v = await sslczValidate(c.env, String(form["val_id"]));
    if (v.ok && v.tranId === tranId) await markPaid(c.env, tranId, v.bankTranId ?? String(form["val_id"]), v.amount, "SSLCommerz");
  } else if (tranId) {
    await c.env.DB.prepare("UPDATE orders SET payment_status = 'failed' WHERE order_no = ? AND payment_status = 'pending'").bind(tranId).run();
  }
  return c.redirect(`/order/${encodeURIComponent(tranId)}?token=${encodeURIComponent(token)}&payment=${result === "success" ? "paid" : result}`, 303);
});

// ---- Courier status ingestion (shared by Steadfast and Pathao) ----
const OUT_FOR_DELIVERY = /out[ _-]?for[ _-]?delivery|assigned to (?:the )?(?:rider|delivery ?man)|ডেলিভারির জন্য/i;

async function ingestCourierUpdate(env: Env, o: OrderRow, courier: string, subStatus: string, outcome: CourierOutcome, message: string | undefined, waitUntil: (p: Promise<unknown>) => void) {
  const actor = `courier:${courier}`;
  const isOfd = OUT_FOR_DELIVERY.test(subStatus) || OUT_FOR_DELIVERY.test(message ?? "");
  const sub = isOfd ? "out_for_delivery" : subStatus;
  if (outcome && outcome !== o.status && o.status === "shipped") {
    try {
      await applyStatus(env, o, { status: outcome, note: message ?? `${courier}: ${subStatus}`, notify: true }, actor, waitUntil);
      return;
    } catch (e) {
      console.warn("courier transition skipped", e);
    }
  }
  const firstOfd = isOfd && o.courier_status !== "out_for_delivery";
  await env.DB.batch([
    env.DB.prepare(`UPDATE orders SET courier_status = ?, updated_at = ${SQL_NOW} WHERE id = ?`).bind(sub.slice(0, 60), o.id),
    env.DB.prepare("INSERT INTO order_status_history (order_id, status, note, actor) VALUES (?, ?, ?, ?)").bind(o.id, o.status, (message ?? `${courier}: ${subStatus}`).slice(0, 300), actor),
  ]);
  if (firstOfd && o.status === "shipped") waitUntil(notifyOrder(env, o, "out_for_delivery"));
}

// Steadfast delivery-status webhook (Bearer token configured in the Steadfast merchant panel).
app.post("/webhooks/steadfast", async (c) => {
  const expected = c.env.STEADFAST_WEBHOOK_TOKEN;
  const auth = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !safeEqualStr(auth, expected)) return c.json({ status: "error", message: "unauthorized" }, 401);
  const p = (await c.req.json().catch(() => ({}))) as { notification_type?: string; consignment_id?: number | string; invoice?: string; status?: string; tracking_message?: string };
  const o = await c.env.DB.prepare("SELECT * FROM orders WHERE consignment_id = ? OR order_no = ?").bind(String(p.consignment_id ?? ""), p.invoice ?? "").first<OrderRow>();
  if (!o) return c.json({ status: "success", message: "ignored" });
  const sub = p.status ?? (p.notification_type === "tracking_update" ? "in_transit" : "update");
  await ingestCourierUpdate(c.env, o, "Steadfast", sub, p.status ? mapSteadfastStatus(p.status) : null, p.tracking_message, (x) => c.executionCtx.waitUntil(x));
  return c.json({ status: "success", message: "Webhook received successfully." });
});

// Pathao webhook (signature header configured in the Pathao merchant panel).
app.post("/webhooks/pathao", async (c) => {
  const secret = c.env.PATHAO_WEBHOOK_SECRET;
  const sig = c.req.header("x-pathao-signature") ?? "";
  if (!secret || !safeEqualStr(sig, secret)) return c.json({ message: "unauthorized" }, 401);
  const p = (await c.req.json().catch(() => ({}))) as { consignment_id?: string; merchant_order_id?: string; event?: string; order_status?: string };
  c.header("X-Pathao-Merchant-Webhook-Integration-Secret", secret);
  const o = await c.env.DB.prepare("SELECT * FROM orders WHERE consignment_id = ? OR order_no = ?").bind(p.consignment_id ?? "", p.merchant_order_id ?? "").first<OrderRow>();
  if (!o) return c.json({ message: "ignored" }, 202);
  const sub = (p.order_status ?? p.event ?? "update").toLowerCase().replace(/[\s.]+/g, "_");
  await ingestCourierUpdate(c.env, o, "Pathao", sub, mapPathaoStatus(sub), `Pathao: ${p.order_status ?? p.event}`, (x) => c.executionCtx.waitUntil(x));
  return c.json({ message: "ok" }, 202);
});

// ---- WhatsApp Cloud API webhook: captures Click-to-WhatsApp ad referrals for attribution ----
app.get("/webhooks/whatsapp", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token") ?? "";
  if (mode === "subscribe" && c.env.WHATSAPP_VERIFY_TOKEN && safeEqualStr(token, c.env.WHATSAPP_VERIFY_TOKEN)) return c.text(c.req.query("hub.challenge") ?? "");
  return c.text("forbidden", 403);
});

app.post("/webhooks/whatsapp", async (c) => {
  const raw = await c.req.text();
  if (c.env.WHATSAPP_APP_SECRET) {
    const sig = (c.req.header("x-hub-signature-256") ?? "").replace(/^sha256=/, "");
    const expected = toHex(await hmacSha256(c.env.WHATSAPP_APP_SECRET, raw));
    if (!safeEqualStr(sig, expected)) return c.text("bad signature", 401);
  } else if (c.env.ENVIRONMENT === "production") {
    return c.text("WHATSAPP_APP_SECRET not configured", 503);
  }
  type Msg = { from?: string; text?: { body?: string }; referral?: { source_id?: string; source_url?: string; headline?: string; ctwa_clid?: string } };
  const data = JSON.parse(raw || "{}") as { entry?: { changes?: { value?: { messages?: Msg[] } }[] }[] };
  const stmts: D1PreparedStatement[] = [];
  for (const entry of data.entry ?? [])
    for (const change of entry.changes ?? [])
      for (const m of change.value?.messages ?? []) {
        const ref = m.referral?.source_id ?? /\[ref:([A-Za-z0-9_-]{2,60})\]/i.exec(m.text?.body ?? "")?.[1];
        if (!ref || !m.from) continue;
        const phone = m.from.replace(/^880/, "0");
        stmts.push(
          c.env.DB.prepare("INSERT INTO wa_leads (phone, ad_ref, ctwa_clid, headline, source_url, first_text) VALUES (?, ?, ?, ?, ?, ?)").bind(
            phone, ref, m.referral?.ctwa_clid ?? null, m.referral?.headline ?? null, m.referral?.source_url ?? null, (m.text?.body ?? "").slice(0, 300),
          ),
        );
      }
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.text("ok");
});

export default app;
