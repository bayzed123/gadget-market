/**
 * Admin order management — list (with CSV), detail (risk, fraud-check, confirmation gates, one-tap call/WhatsApp),
 * edit, pipeline moves, confirmation-call logging, bulk actions, courier booking, invoice PDF, refunds, Trash.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../env";
import { ApiError, body, E, intParam, likeText, parseJson, SQL_NOW } from "../../lib/http";
import { attemptSchema, ORDER_STATUSES, orderEditSchema, refundSchema, statusChangeSchema } from "../../lib/schemas";
import { perm } from "../../middleware";
import { audit, getSetting } from "../../lib/store";
import { applyStatus, logAttempt, STATUS_LABELS, TRANSITIONS, type OrderRow, type OrderStatus } from "../../lib/orders";
import { courierStatusLabel, trackingUrl } from "../../lib/couriers";
import { notifyOrder, render } from "../../lib/notify";
import { confirmGate, courierLookup, dispatchGate, FLAG_LABELS, historyForPhone, RISK_BADGES, type VelocityFlag } from "../../lib/risk";
import { invoicePdf, type InvoiceItem } from "../../lib/invoice";
import { BRAND } from "../../brand";
import { csvResponse } from "./crud";

const app = new Hono<AppEnv>();
const wait = (c: { executionCtx: { waitUntil(p: Promise<unknown>): void } }) => (p: Promise<unknown>) => c.executionCtx.waitUntil(p);

const CSV_COLUMNS = [
  "order_no", "invoice_no", "created_at", "status", "customer_name", "customer_phone", "division", "district", "upazila", "area", "items", "skus",
  "subtotal", "discount", "delivery_fee", "gift_wrap_fee", "vat_amount", "total", "payment_method", "payment_status", "payment_ref", "coupon_code", "courier_partner", "tracking_id",
  "risk_level", "otp_verified", "confirmation_method", "utm_source", "utm_medium", "utm_campaign",
];

app.get("/", perm("orders.read"), async (c) => {
  const q = c.req.query();
  const where: string[] = [q.trash === "1" ? "o.deleted_at IS NOT NULL" : "o.deleted_at IS NULL"];
  const args: unknown[] = [];
  const eq = (param: string, col: string) => {
    if (q[param]) {
      where.push(`${col} = ?`);
      args.push(q[param]);
    }
  };
  if (q.status === "needs_call") {
    // Awaiting a confirmation call: not yet confirmed, or confirmed but not Trusted and no call logged (dispatch gate).
    where.push(`(o.status IN ('pending','confirmation_attempted') OR (o.status IN ('confirmed','packed') AND o.payment_status != 'paid' AND o.risk_level != 'low'
      AND NOT EXISTS (SELECT 1 FROM order_confirmation_attempts a WHERE a.order_id = o.id AND a.outcome = 'confirmed')))`);
  } else eq("status", "o.status");
  eq("payment_method", "o.payment_method");
  eq("payment_status", "o.payment_status");
  eq("courier", "o.courier_partner");
  eq("risk", "o.risk_level");
  eq("utm_campaign", "o.utm_campaign");
  if (q.flagged === "1") where.push("o.flags != '[]'");
  if (q.from) {
    where.push("date(o.created_at, '+6 hours') >= ?");
    args.push(q.from);
  }
  if (q.to) {
    where.push("date(o.created_at, '+6 hours') <= ?");
    args.push(q.to);
  }
  if (q.q) {
    const like = likeText(q.q);
    where.push(
      "(o.order_no LIKE ? OR o.invoice_no LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.customer_email LIKE ? OR o.payment_ref LIKE ? OR o.tracking_id LIKE ? OR o.area LIKE ? OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.sku LIKE ?))",
    );
    args.push(like, like, like, like, like, like, like, like, like);
  }
  const w = where.join(" AND ");
  const sort = q.sort === "total" ? "o.total DESC" : q.sort === "oldest" ? "o.created_at ASC" : "o.created_at DESC";
  if (q.format === "csv") {
    const { results } = await c.env.DB.prepare(
      `SELECT o.*, (SELECT GROUP_CONCAT(i.name_en || ' x' || i.quantity, '; ') FROM order_items i WHERE i.order_id = o.id) AS items,
              (SELECT GROUP_CONCAT(i.sku, ' ') FROM order_items i WHERE i.order_id = o.id) AS skus
         FROM orders o WHERE ${w} ORDER BY ${sort} LIMIT 20000`,
    )
      .bind(...args)
      .all<Record<string, unknown>>();
    await audit(c, "export", "order", null, { rows: results.length });
    return csvResponse("orders", results, CSV_COLUMNS);
  }
  const limit = intParam(q.limit, 20, 1, 200);
  const page = intParam(q.page, 1, 1, 100000);
  const [count, rows, counts] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM orders o WHERE ${w}`).bind(...args).first<{ n: number }>(),
    c.env.DB.prepare(
      `SELECT o.id, o.order_no, o.invoice_no, o.customer_name, o.customer_phone, o.district, o.upazila, o.total, o.payment_method, o.payment_status,
              o.status, o.courier_partner, o.tracking_id, o.courier_status, o.risk_level, o.otp_verified, o.flags, o.utm_source, o.utm_campaign, o.created_at,
              (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS item_count,
              (SELECT COUNT(*) FROM order_confirmation_attempts a WHERE a.order_id = o.id) AS attempts,
              (SELECT COUNT(*) FROM order_confirmation_attempts a WHERE a.order_id = o.id AND a.outcome = 'confirmed') AS confirmed_calls
         FROM orders o WHERE ${w} ORDER BY ${sort} LIMIT ? OFFSET ?`,
    )
      .bind(...args, limit, (page - 1) * limit)
      .all<Record<string, unknown> & { risk_level: "low" | "medium" | "high"; flags: string }>(),
    c.env.DB.prepare("SELECT status, COUNT(*) AS n FROM orders WHERE deleted_at IS NULL GROUP BY status").all<{ status: string; n: number }>(),
  ]);
  const total = count?.n ?? 0;
  return c.json({
    items: rows.results.map((r) => ({ ...r, risk_badge: RISK_BADGES[r.risk_level], flags: parseJson<string[]>(r.flags, []) })),
    total,
    page,
    pages: Math.ceil(total / limit),
    statusCounts: Object.fromEntries(counts.results.map((r) => [r.status, r.n])),
  });
});

async function loadOrder(c: { env: AppEnv["Bindings"] }, id: number): Promise<OrderRow> {
  const o = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL").bind(id).first<OrderRow>();
  if (!o) throw E.notFound("Order");
  return o;
}

/** "01712345678" → "8801712345678" for wa.me links. */
const waNumber = (p: string) => p.replace(/\D/g, "").replace(/^0/, "880");

app.get("/:id{[0-9]+}", perm("orders.read"), async (c) => {
  const id = Number(c.req.param("id"));
  const o = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!o) throw E.notFound("Order");
  const [items, history, notes, attempts, returns, history2, waTpl, store, fraud] = await Promise.all([
    c.env.DB.prepare(
      `SELECT i.*, (SELECT GROUP_CONCAT(sn.serial, ', ') FROM serial_numbers sn WHERE sn.order_item_id = i.id) AS serials,
              (SELECT COUNT(*) FROM serial_numbers sn WHERE sn.variant_id = i.variant_id) > 0 AS serial_tracked
         FROM order_items i WHERE i.order_id = ? ORDER BY i.id`,
    )
      .bind(id)
      .all(),
    c.env.DB.prepare("SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id").bind(id).all(),
    c.env.DB.prepare("SELECT channel, template, status, error, created_at FROM notifications WHERE order_id = ? ORDER BY id DESC LIMIT 30").bind(id).all(),
    c.env.DB.prepare("SELECT * FROM order_confirmation_attempts WHERE order_id = ? ORDER BY id").bind(id).all<{ outcome: "no_answer" | "confirmed" | "declined" }>(),
    c.env.DB.prepare("SELECT * FROM return_requests WHERE order_id = ? ORDER BY id DESC").bind(id).all(),
    historyForPhone(c.env, o.customer_phone),
    getSetting(c.env, "wa_templates"),
    getSetting(c.env, "store"),
    getSetting(c.env, "fraud"),
  ]);
  // Courier network history — looked up when the order is opened (cached 24h).
  let courier = parseJson<unknown>(o.fraud_check, null);
  if (!courier && fraud.courierCheck) {
    courier = await courierLookup(c.env, o.customer_phone);
    if (courier) await c.env.DB.prepare("UPDATE orders SET fraud_check = ? WHERE id = ?").bind(JSON.stringify(courier), id).run();
  }
  const lang = o.lang === "en" ? "en" : "bn";
  const vars = { name: o.customer_name.split(" ")[0], order_no: o.order_no, invoice_no: o.invoice_no ?? o.order_no, total: o.total, area: `${o.area}, ${o.upazila}`, courier: o.courier_partner ?? "", tracking: o.tracking_id ?? "", store: lang === "bn" ? BRAND.name.bn : BRAND.name.en };
  const whatsapp = Object.fromEntries(
    Object.entries(waTpl as Record<string, { en: string; bn: string }>).map(([k, t]) => [k, { text: render(t[lang] || t.en, vars), url: `https://wa.me/${waNumber(o.customer_phone)}?text=${encodeURIComponent(render(t[lang] || t.en, vars))}` }]),
  );
  const cGate = confirmGate(o, attempts.results);
  const dGate = dispatchGate(o, attempts.results);
  return c.json({
    order: {
      ...o,
      tracking_url: trackingUrl(o.courier_partner, o.tracking_id),
      courier_status_label: courierStatusLabel(o.courier_status),
      risk_badge: RISK_BADGES[o.risk_level],
      risk_reasons: parseJson(o.risk_reasons, []),
      flags: parseJson<VelocityFlag[]>(o.flags, []).map((f) => ({ code: f, ...FLAG_LABELS[f] })),
      fraud_check: courier,
    },
    items: items.results,
    history: history.results,
    notifications: notes.results,
    attempts: attempts.results,
    returns: returns.results,
    customerHistory: history2,
    gates: { confirm: cGate, dispatch: dGate },
    contact: { tel: `tel:${o.customer_phone}`, whatsapp, storePhone: store.phone },
    nextStatuses: TRANSITIONS[o.status].filter((s) => s !== "confirmation_attempted"),
    statusLabels: STATUS_LABELS,
  });
});

app.put("/:id{[0-9]+}", perm("orders.update"), async (c) => {
  const id = Number(c.req.param("id"));
  const b = await body(c, orderEditSchema);
  const entries = Object.entries(b).filter(([, v]) => v !== undefined);
  if (!entries.length) return c.json({ ok: true });
  await c.env.DB.prepare(`UPDATE orders SET ${entries.map(([k]) => `${k} = ?`).join(", ")}, updated_at = ${SQL_NOW} WHERE id = ?`)
    .bind(...entries.map(([, v]) => v), id)
    .run();
  await audit(c, "update", "order", id, Object.fromEntries(entries));
  return c.json({ ok: true, en: "Order updated.", bn: "অর্ডার আপডেট হয়েছে।" });
});

app.post("/:id{[0-9]+}/status", perm("orders.update"), async (c) => {
  const id = Number(c.req.param("id"));
  const ch = await body(c, statusChangeSchema);
  const o = await loadOrder(c, id);
  const updated = await applyStatus(c.env, o, ch, c.get("admin")!.name, wait(c));
  await audit(c, "status", "order", id, { from: o.status, to: ch.status, courier: updated.courier_partner, tracking: updated.tracking_id });
  const label = STATUS_LABELS[ch.status];
  return c.json({ order: updated, en: `Order moved to "${label.en}".`, bn: `অর্ডারটি "${label.bn}" এ নেওয়া হয়েছে।` });
});

/** One-tap confirmation-call logging: No answer / Confirmed / Declined. */
app.post("/:id{[0-9]+}/attempts", perm("orders.update"), async (c) => {
  const id = Number(c.req.param("id"));
  const a = await body(c, attemptSchema);
  const o = await loadOrder(c, id);
  const admin = c.get("admin")!;
  const updated = await logAttempt(c.env, o, a, { id: admin.id, name: admin.name }, wait(c));
  await audit(c, "confirmation_attempt", "order", id, a);
  const msg = {
    no_answer: { en: "Logged: no answer. The order stays in your call list.", bn: "লেখা হয়েছে: কেউ ধরেনি। অর্ডারটি কল তালিকায় থাকবে।" },
    confirmed: { en: "Logged: customer confirmed.", bn: "লেখা হয়েছে: গ্রাহক কনফার্ম করেছেন।" },
    declined: { en: "Logged: customer declined. The order was cancelled and stock put back.", bn: "লেখা হয়েছে: গ্রাহক না করেছেন। অর্ডার বাতিল ও স্টক ফেরত হয়েছে।" },
  }[a.outcome];
  return c.json({ order: updated, ...msg });
});

/** Bulk actions with a plain confirmation in the UI ("You're about to mark 5 orders as Shipped — continue?"). */
app.post("/bulk-status", perm("orders.update"), async (c) => {
  const b = await body(
    c,
    z.object({
      ids: z.array(z.number().int().positive()).min(1).max(100),
      status: z.enum(ORDER_STATUSES),
      courier: z.enum(["Steadfast", "Pathao", "RedX"]).optional(),
      createConsignment: z.boolean().default(true),
      notify: z.boolean().default(true),
    }),
  );
  const done: number[] = [];
  const failed: { id: number; order_no?: string; reason: string; reason_bn: string }[] = [];
  for (const id of b.ids) {
    const o = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL").bind(id).first<OrderRow>();
    if (!o) continue;
    try {
      await applyStatus(c.env, o, { status: b.status as OrderStatus, courier: b.courier, createConsignment: b.createConsignment, notify: b.notify }, c.get("admin")!.name, wait(c));
      done.push(id);
    } catch (e) {
      failed.push({ id, order_no: o.order_no, reason: e instanceof ApiError ? e.en : String(e), reason_bn: e instanceof ApiError ? e.bn : String(e) });
    }
  }
  await audit(c, "bulk_status", "order", done.join(","), { status: b.status, failed });
  const label = STATUS_LABELS[b.status as OrderStatus];
  return c.json({ done, failed, en: `${done.length} order(s) marked as ${label.en}.`, bn: `${done.length}টি অর্ডার "${label.bn}" করা হয়েছে।` });
});

/** Re-runs the courier fraud-check lookup (bypasses the 24h cache). */
app.post("/:id{[0-9]+}/fraud-check", perm("orders.update"), async (c) => {
  const id = Number(c.req.param("id"));
  const o = await loadOrder(c, id);
  await c.env.KV.delete(`fraud:${o.customer_phone}`);
  const res = await courierLookup(c.env, o.customer_phone);
  if (!res) {
    return c.json({ result: null, en: "No courier-check service is connected (Settings → Health Check).", bn: "কোনো কুরিয়ার-চেক সার্ভিস যুক্ত নেই।" });
  }
  await c.env.DB.prepare("UPDATE orders SET fraud_check = ? WHERE id = ?").bind(JSON.stringify(res), id).run();
  return c.json({ result: res, en: "Courier history updated.", bn: "কুরিয়ার রেকর্ড আপডেট হয়েছে।" });
});

app.get("/:id{[0-9]+}/invoice.pdf", perm("orders.read"), async (c) => {
  const id = Number(c.req.param("id"));
  const o = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!o) throw E.notFound("Order");
  if (!o.invoice_no) throw E.badRequest("Confirm the order first — the invoice number is created at confirmation.", "আগে অর্ডার কনফার্ম করুন — কনফার্মের সময় ইনভয়েস নম্বর তৈরি হয়।");
  const [items, store, tax] = await Promise.all([
    c.env.DB.prepare("SELECT i.sku, i.name_en, i.size, i.color, i.batches, i.warranty_months, i.quantity, i.unit_price, i.line_total, (SELECT GROUP_CONCAT(sn.serial, ', ') FROM serial_numbers sn WHERE sn.order_item_id = i.id) AS serials FROM order_items i WHERE i.order_id = ? ORDER BY i.id").bind(id).all<InvoiceItem>(),
    getSetting(c.env, "store"),
    getSetting(c.env, "tax"),
  ]);
  return new Response(invoicePdf(o, items.results, store, tax), {
    headers: { "content-type": "application/pdf", "content-disposition": `${c.req.query("download") ? "attachment" : "inline"}; filename="${o.invoice_no}.pdf"`, "cache-control": "private, no-store" },
  });
});

app.post("/:id{[0-9]+}/refund", perm("orders.refund"), async (c) => {
  const id = Number(c.req.param("id"));
  const b = await body(c, refundSchema);
  const o = await loadOrder(c, id);
  const newTotal = o.refund_amount + b.amount;
  if (newTotal > o.total) throw E.badRequest(`Refund cannot exceed the order total (৳${o.total}).`, `রিফান্ড অর্ডারের মোট টাকার (৳${o.total}) বেশি হতে পারে না।`);
  const ps = newTotal >= o.total ? "refunded" : "partially_refunded";
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE orders SET refund_amount = ?, refund_note = ?, payment_status = ?, updated_at = ${SQL_NOW} WHERE id = ?`).bind(newTotal, b.note, ps, id),
    c.env.DB.prepare("INSERT INTO order_status_history (order_id, status, note, actor) VALUES (?, ?, ?, ?)").bind(id, o.status, `Refund ৳${b.amount}: ${b.note}`, c.get("admin")!.name),
  ]);
  await audit(c, "refund", "order", id, b);
  return c.json({ ok: true, en: "Refund recorded. Remember to send the money to the customer.", bn: "রিফান্ড রেকর্ড হয়েছে। গ্রাহককে টাকা পাঠাতে ভুলবেন না।" });
});

app.post("/:id{[0-9]+}/notify", perm("orders.update"), async (c) => {
  const o = await loadOrder(c, Number(c.req.param("id")));
  await notifyOrder(c.env, o, o.status === "pending" || o.status === "confirmation_attempted" ? "placed" : o.status);
  return c.json({ ok: true, en: "Message sent again.", bn: "মেসেজ আবার পাঠানো হয়েছে।" });
});

app.delete("/:id{[0-9]+}", perm("orders.delete"), async (c) => {
  const id = Number(c.req.param("id"));
  const o = await c.env.DB.prepare("SELECT status FROM orders WHERE id = ?").bind(id).first<{ status: OrderStatus }>();
  if (!o) throw E.notFound("Order");
  if (!["cancelled", "refused", "returned", "delivered"].includes(o.status))
    throw E.badRequest("Cancel the order first — that puts the stock back.", "আগে অর্ডারটি বাতিল করুন — তাতে স্টক ফেরত যাবে।");
  await c.env.DB.prepare(`UPDATE orders SET deleted_at = ${SQL_NOW} WHERE id = ?`).bind(id).run();
  await audit(c, "delete", "order", id);
  return c.json({ ok: true, en: "Moved to Trash.", bn: "ট্র্যাশে পাঠানো হয়েছে।" });
});

app.post("/:id{[0-9]+}/restore", perm("orders.delete"), async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("UPDATE orders SET deleted_at = NULL WHERE id = ?").bind(id).run();
  await audit(c, "restore", "order", id);
  return c.json({ ok: true, en: "Restored.", bn: "ফিরিয়ে আনা হয়েছে।" });
});

export default app;
