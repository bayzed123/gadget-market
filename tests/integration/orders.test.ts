// Checkout → fraud checks → confirmation gates → invoice → delivery outcomes, oldest-lot-first stock allocation,
// serial numbers on order lines → warranty claims, plus abandoned-checkout capture.
import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import createOrderFixture from "../fixtures/create-order.request.json";
import createOrderResponse from "../fixtures/create-order.response.json";
import { address, call, otpToken, setSetting, stockOf, superAdmin, variantId } from "./helpers";
import { INVOICE_PATTERN } from "../../worker/src/lib/sku";

let admin = "";
const BUDS = "GAD-EB-SON-BLK-0001"; // variant 1 in the fixture: Sonix Buds Pro, ৳2,990 on deal
const CHARGER = "GAD-CH-VOL-WHT-0001"; // ৳990
const POWERBANK = "GAD-PB-VOL-BLK-0001"; // two stock lots: an older small one and a newer one
const HEADPHONES = "GAD-HP-SON-BLK-0001"; // serial numbers logged for every unit

beforeAll(async () => {
  admin = await superAdmin();
  // Plenty of stock for the many test orders below (stock and its single batch stay in step).
  for (const sku of [BUDS, CHARGER]) {
    await env.DB.batch([
      env.DB.prepare("UPDATE product_variants SET stock = 500 WHERE sku = ?").bind(sku),
      env.DB.prepare("UPDATE inventory_batches SET qty_received = 500, qty_remaining = 500 WHERE variant_id = (SELECT id FROM product_variants WHERE sku = ?)").bind(sku),
    ]);
  }
});

async function placeOrder(overrides: Record<string, unknown> = {}, phone = "01711223344") {
  return call("/api/orders", { method: "POST", json: { ...createOrderFixture, customer: { name: "Nusrat Jahan", phone, email: "" }, ...overrides } });
}

async function orderId(orderNo: string) {
  return (await env.DB.prepare("SELECT id FROM orders WHERE order_no = ?").bind(orderNo).first<{ id: number }>())!.id;
}

describe("checkout", () => {
  it("rejects requests without the CSRF header", async () => {
    const { exports } = await import("cloudflare:workers");
    const res = await exports.default.fetch(new Request("https://shop.test/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(createOrderFixture) }));
    expect(res.status).toBe(403);
  });

  it("returns bilingual field errors", async () => {
    const { res, data } = await placeOrder({}, "12345");
    expect(res.status).toBe(422);
    expect(data.code).toBe("validation");
    expect(data.fields[0].field).toBe("customer.phone");
  });

  it("requires phone verification for COD when SMS is available", async () => {
    const { res, data } = await placeOrder({}, "01799990001");
    expect(res.status).toBe(422);
    expect(data.code).toBe("otp_required");
  });

  it("places a verified COD order with SKUs, UTM attribution and a Purchase event id", async () => {
    const before = await stockOf(BUDS);
    const token = await otpToken("01799990002");
    const { res, data } = await placeOrder({ otpToken: token, sessionId: "sess-verified-0000000002" }, "01799990002");
    expect(res.status).toBe(201);
    expect(Object.keys(data).sort()).toEqual(Object.keys(createOrderResponse).sort());
    expect(data.status).toBe("pending"); // a first-time customer is not auto-confirmed
    expect(data.purchaseEventId).toBe(`purchase-${data.orderNo}`);
    expect(data.items[0].sku).toBe(BUDS);
    expect(await stockOf(BUDS)).toBe(before - 2);
    const o = await env.DB.prepare("SELECT otp_verified, risk_level, utm_source, utm_campaign, invoice_no FROM orders WHERE order_no = ?").bind(data.orderNo).first<Record<string, unknown>>();
    expect(o).toMatchObject({ otp_verified: 1, risk_level: "medium", utm_source: "facebook", utm_campaign: "11-11-gadget-sale", invoice_no: null });
    // The server-side event is sent in the background (waitUntil), so give it a moment.
    let ev: Record<string, unknown> | null = null;
    for (let i = 0; i < 40 && !ev; i++) {
      await new Promise((r) => setTimeout(r, 25));
      ev = await env.DB.prepare("SELECT event_name, event_id, status FROM marketing_events WHERE event_id = ?").bind(data.purchaseEventId).first();
    }
    expect(ev).toMatchObject({ event_name: "Purchase", status: "skipped" }); // Pixel/CAPI not connected in tests
  });
});

describe("confirmation gates", () => {
  let unverified = "";
  beforeAll(async () => {
    await setSetting(admin, "fraud", { requireOtp: false });
    const { res, data } = await placeOrder({}, "01799990003");
    expect(res.status).toBe(201);
    unverified = data.orderNo;
  });

  it("blocks confirming an unverified COD order until a call is logged", async () => {
    const id = await orderId(unverified);
    const blocked = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "confirmed" } });
    expect(blocked.res.status).toBe(409);
    expect(blocked.data.code).toBe("needs_confirmation");

    const noAnswer = await call(`/api/admin/orders/${id}/attempts`, { method: "POST", cookie: admin, json: { outcome: "no_answer" } });
    expect(noAnswer.data.order.status).toBe("confirmation_attempted");

    const confirmed = await call(`/api/admin/orders/${id}/attempts`, { method: "POST", cookie: admin, json: { outcome: "confirmed", note: "Spoke to her sister" } });
    expect(confirmed.res.status).toBe(200);
    expect(confirmed.data.order.status).toBe("confirmed");
    expect(confirmed.data.order.confirmation_method).toBe("call");
    expect(confirmed.data.order.invoice_no).toMatch(INVOICE_PATTERN);

    const detail = await call(`/api/admin/orders/${id}`, { cookie: admin });
    expect(detail.data.attempts.map((a: any) => a.outcome)).toEqual(["no_answer", "confirmed"]);
    expect(detail.data.contact.tel).toBe("tel:01799990003");
    expect(detail.data.contact.whatsapp.confirmed.url).toContain("https://wa.me/8801799990003");
  });

  it("issues sequential invoice numbers and a PDF invoice", async () => {
    const token = await otpToken("01799990004");
    const second = await placeOrder({ otpToken: token }, "01799990004");
    const id2 = await orderId(second.data.orderNo);
    const c2 = await call(`/api/admin/orders/${id2}/status`, { method: "POST", cookie: admin, json: { status: "confirmed" } });
    expect(c2.res.status).toBe(200);
    expect(c2.data.order.confirmation_method).toBe("otp");
    const first = await env.DB.prepare("SELECT invoice_no FROM orders WHERE order_no = ?").bind(unverified).first<{ invoice_no: string }>();
    const n1 = Number(first!.invoice_no.split("-").pop());
    const n2 = Number(c2.data.order.invoice_no.split("-").pop());
    expect(n2).toBe(n1 + 1);

    const pdf = await call(`/api/admin/orders/${id2}/invoice.pdf`, { cookie: admin, raw: true });
    expect(pdf.res.headers.get("content-type")).toBe("application/pdf");
    const text = new TextDecoder().decode(await pdf.res.arrayBuffer());
    expect(text.startsWith("%PDF")).toBe(true);
    expect(text).toContain(c2.data.order.invoice_no);
    expect(text).toContain(BUDS);

    // Customers can download it with their private link too.
    const pub = await call(`/api/orders/${second.data.orderNo}/invoice.pdf?token=${second.data.token}`, { raw: true });
    expect(pub.res.headers.get("content-type")).toBe("application/pdf");
    await pub.res.arrayBuffer();
  });

  it("requires a confirmation call before shipping a non-trusted COD order", async () => {
    const token = await otpToken("01799990005");
    const o = await placeOrder({ otpToken: token }, "01799990005");
    const id = await orderId(o.data.orderNo);
    await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "confirmed" } });
    await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "packed" } });
    const ship = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "shipped", courier: "RedX", trackingId: "RX123" } });
    expect(ship.res.status).toBe(409);
    expect(ship.data.code).toBe("needs_call");
    await call(`/api/admin/orders/${id}/attempts`, { method: "POST", cookie: admin, json: { outcome: "confirmed" } });
    const ok = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "shipped", courier: "RedX", trackingId: "RX123" } });
    expect(ok.res.status).toBe(200);
    expect(ok.data.order.tracking_id).toBe("RX123");
  });
});

describe("distinct outcomes: cancelled, refused at delivery, returned", () => {
  async function shippedOrder(phone: string) {
    const token = await otpToken(phone);
    const o = await placeOrder({ otpToken: token, items: [{ variantId: await variantId(CHARGER), quantity: 1 }] }, phone);
    const id = await orderId(o.data.orderNo);
    await call(`/api/admin/orders/${id}/attempts`, { method: "POST", cookie: admin, json: { outcome: "confirmed" } });
    await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "packed" } });
    const s = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "shipped", courier: "Steadfast", trackingId: `SF-${phone}` } });
    expect(s.res.status).toBe(200);
    return { id, orderNo: o.data.orderNo as string, token: o.data.token as string };
  }

  it("declining on the call cancels the order and puts stock back", async () => {
    const before = await stockOf(BUDS);
    const o = await placeOrder({}, "01799990006");
    expect(await stockOf(BUDS)).toBe(before - 2);
    const id = await orderId(o.data.orderNo);
    const r = await call(`/api/admin/orders/${id}/attempts`, { method: "POST", cookie: admin, json: { outcome: "declined" } });
    expect(r.data.order.status).toBe("cancelled");
    expect(await stockOf(BUDS)).toBe(before);
    const cust = await env.DB.prepare("SELECT cancelled_count, refused_or_returned_count FROM customers WHERE phone = '01799990006'").first();
    expect(cust).toMatchObject({ cancelled_count: 1, refused_or_returned_count: 0 });
  });

  it("refused at delivery is recorded separately and restocks", async () => {
    const sku = CHARGER;
    const before = await stockOf(sku);
    const { id } = await shippedOrder("01799990007");
    expect(await stockOf(sku)).toBe(before - 1);
    const cannotCancel = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "cancelled" } });
    expect(cannotCancel.res.status).toBe(409);
    const refused = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "refused", note: "Customer not home, refused on call" } });
    expect(refused.data.order.status).toBe("refused");
    expect(await stockOf(sku)).toBe(before);
    const cust = await env.DB.prepare("SELECT refused_or_returned_count, cancelled_count FROM customers WHERE phone = '01799990007'").first();
    expect(cust).toMatchObject({ refused_or_returned_count: 1, cancelled_count: 0 });
  });

  it("a delivered order can be returned through a customer return request — without restocking it", async () => {
    const phone = "01799990008";
    const { id, orderNo } = await shippedOrder(phone);
    const stockBefore = await stockOf(CHARGER);
    const d = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "delivered" } });
    expect(d.data.order.payment_status).toBe("paid");
    // Customer signs up with the same phone (claims the guest order) and requests a return.
    const reg = await call("/api/auth/register", { method: "POST", json: { name: "Rafi", phone, password: "Gadget-pass-123" } });
    const cust = reg.res.headers.get("set-cookie")!.split(";")[0]!;
    const rr = await call("/api/me/returns", { method: "POST", cookie: cust, json: { orderNo, reason: "damaged", details: "Case hinge arrived broken" } });
    expect(rr.res.status).toBe(201);
    const list = await call("/api/admin/returns?status=requested", { cookie: admin });
    const ret = list.data.items.find((x: any) => x.order_no === orderNo);
    await call(`/api/admin/returns/${ret.id}`, { method: "PUT", cookie: admin, json: { status: "approved" } });
    await call(`/api/admin/returns/${ret.id}`, { method: "PUT", cookie: admin, json: { status: "received" } });
    const refund = await call(`/api/admin/returns/${ret.id}`, { method: "PUT", cookie: admin, json: { status: "refunded", refund_amount: 300, refund_method: "bKash" } });
    expect(refund.res.status).toBe(200);
    const o = await env.DB.prepare("SELECT status, refund_amount, payment_status FROM orders WHERE id = ?").bind(id).first();
    expect(o).toMatchObject({ status: "returned", refund_amount: 300, payment_status: "partially_refunded" });
    // An opened, returned unit is inspected before it goes back on sale, so it isn't restocked automatically.
    expect(await stockOf(CHARGER)).toBe(stockBefore);
    const report = await call("/api/admin/reports/outcomes", { cookie: admin });
    const sf = report.data.rows.find((r: any) => r.label === "Steadfast");
    expect(sf).toMatchObject({ refused_at_delivery: 1, returned: 1 });
  });
});

describe("trusted fast lane & velocity checks", () => {
  it("auto-confirms a verified order from a customer with 3+ delivered orders", async () => {
    const phone = "01799990009";
    for (let i = 0; i < 3; i++) {
      await env.DB.prepare(
        `INSERT INTO orders (order_no, public_token, customer_name, customer_phone, division_id, district_id, upazila_id, division, district, upazila, area, zone_code, subtotal, total, payment_method, payment_status, status)
         VALUES (?, 't', 'Old', ?, 6, 47, 9026, 'Dhaka', 'Dhaka', 'Mirpur', 'x', 'dhaka_city', 500, 570, 'COD', 'paid', 'delivered')`,
      )
        .bind(`OLD-${phone}-${i}`, phone)
        .run();
      await env.DB.prepare("UPDATE orders SET created_at = ? WHERE order_no = ?")
        .bind(new Date(Date.now() - (40 + i) * 86400_000).toISOString(), `OLD-${phone}-${i}`)
        .run();
    }
    const token = await otpToken(phone);
    const { data } = await placeOrder({ otpToken: token }, phone);
    expect(data.status).toBe("confirmed");
    const o = await env.DB.prepare("SELECT confirmation_method, risk_level, invoice_no FROM orders WHERE order_no = ?").bind(data.orderNo).first<Record<string, string>>();
    expect(o).toMatchObject({ confirmation_method: "trusted", risk_level: "low" });
    expect(o!.invoice_no).toMatch(INVOICE_PATTERN);
  });

  it("flags several orders from one phone in a short window", async () => {
    const phone = "01799990010";
    await placeOrder({}, phone);
    await placeOrder({}, phone);
    const third = await placeOrder({}, phone);
    const o = await env.DB.prepare("SELECT flags FROM orders WHERE order_no = ?").bind(third.data.orderNo).first<{ flags: string }>();
    expect(JSON.parse(o!.flags)).toContain("velocity_phone");
    const flagged = await call("/api/admin/orders?flagged=1", { cookie: admin });
    expect(flagged.data.items.some((x: any) => x.order_no === third.data.orderNo)).toBe(true);
  });
});

describe("abandoned checkout capture", () => {
  it("autosaves partial details, surfaces them after the window, and links a later order", async () => {
    const sid = "sess-abandoned-000000000001";
    const d = await call("/api/checkout/draft", {
      method: "POST",
      json: { sessionId: sid, name: "Shirin", phone: "01799990011", district: "Dhaka", upazila: "Mirpur", items: [{ variantId: 1, quantity: 1 }], lastStep: "address", utm: { source: "facebook", campaign: "retarget" } },
    });
    expect(d.data.leadEventId).toBe(`lead-${sid}`);
    // Not abandoned yet (still inside the 30-minute window)…
    let list = await call("/api/admin/abandoned", { cookie: admin });
    expect(list.data.items.some((x: any) => x.session_id === sid)).toBe(false);
    // …pretend 45 minutes passed.
    await env.DB.prepare("UPDATE abandoned_checkouts SET updated_at = ? WHERE session_id = ?").bind(new Date(Date.now() - 45 * 60_000).toISOString(), sid).run();
    list = await call("/api/admin/abandoned", { cookie: admin });
    const row = list.data.items.find((x: any) => x.session_id === sid);
    expect(row).toMatchObject({ name: "Shirin", phone: "01799990011", last_step: "address", cart_total: 2990 });
    expect(row.cart[0].sku).toBe(BUDS);
    expect(row.whatsapp).toContain("wa.me/8801799990011");

    const csv = await call("/api/admin/abandoned?format=csv", { cookie: admin });
    expect(csv.res.headers.get("content-type")).toContain("text/csv");
    expect(csv.data).toContain("01799990011");

    const resume = await call(`/api/checkout/resume/${sid}`);
    expect(resume.data.items).toEqual([{ variantId: 1, quantity: 1 }]);

    await placeOrder({ sessionId: sid }, "01799990011");
    const after = await env.DB.prepare("SELECT status, order_id FROM abandoned_checkouts WHERE session_id = ?").bind(sid).first<{ status: string; order_id: number }>();
    expect(after!.status).toBe("recovered");
    expect(after!.order_id).toBeGreaterThan(0);
  });

  it("staff can mark an abandoned checkout as not interested", async () => {
    const sid = "sess-abandoned-000000000002";
    await call("/api/checkout/draft", { method: "POST", json: { sessionId: sid, name: "Tuli", phone: "01799990012", items: [], lastStep: "contact" } });
    await env.DB.prepare("UPDATE abandoned_checkouts SET updated_at = ? WHERE session_id = ?").bind(new Date(Date.now() - 3600_000).toISOString(), sid).run();
    const row = (await call("/api/admin/abandoned", { cookie: admin })).data.items.find((x: any) => x.session_id === sid);
    const r = await call(`/api/admin/abandoned/${row.id}`, { method: "POST", cookie: admin, json: { action: "ignored" } });
    expect(r.res.status).toBe(200);
    const ignored = await call("/api/admin/abandoned?status=ignored", { cookie: admin });
    expect(ignored.data.items.some((x: any) => x.session_id === sid)).toBe(true);
  });
});

describe("order list exports & bulk actions", () => {
  it("exports orders and customers to CSV", async () => {
    const orders = await call("/api/admin/orders?format=csv", { cookie: admin });
    expect(orders.res.headers.get("content-type")).toContain("text/csv");
    expect(orders.data.split("\n")[0]).toContain("invoice_no");
    const customers = await call("/api/admin/customers?format=csv", { cookie: admin });
    expect(customers.data.split("\n")[0]).toContain("risk_level");
  });

  it("marks several orders in one step and reports which ones could not move", async () => {
    const ids: number[] = [];
    for (const phone of ["01799990013", "01799990014"]) {
      const token = await otpToken(phone);
      const o = await placeOrder({ otpToken: token }, phone);
      ids.push(await orderId(o.data.orderNo));
    }
    const confirmed = await call("/api/admin/orders/bulk-status", { method: "POST", cookie: admin, json: { ids, status: "confirmed" } });
    expect(confirmed.data.done).toEqual(ids);
    const shipped = await call("/api/admin/orders/bulk-status", { method: "POST", cookie: admin, json: { ids, status: "shipped", courier: "RedX" } });
    // Not packed yet → both stay put, with a plain reason each.
    expect(shipped.data.failed.length).toBe(2);
    expect(shipped.data.failed[0].reason).toMatch(/cannot be moved/);
  });

  it("tracks an order with the phone number and masks it", async () => {
    const { data } = await placeOrder({}, "01799990015");
    const t = await call(`/api/orders/track?order=${data.orderNo}&phone=01799990015`);
    expect(t.data.order.customer_phone).toBe("017*****015");
    expect(t.data.order.status_label.en).toBe("Pending");
    const wrong = await call(`/api/orders/track?order=${data.orderNo}&phone=01700000000`);
    expect(wrong.res.status).toBe(404);
  });

  it("reports revenue by campaign", async () => {
    const r = await call("/api/admin/reports/sales?group=campaign", { cookie: admin });
    expect(r.data.rows.some((x: any) => x.label === "11-11-gadget-sale" && x.source === "facebook")).toBe(true);
  });

  it("dashboard shows KPIs, attention list and health check", async () => {
    const d = await call("/api/admin/dashboard", { cookie: admin });
    expect(d.data.kpis.pendingCod.value).toBeGreaterThan(0);
    expect(d.data.salesChart.length).toBe(12);
    const a = await call("/api/admin/attention", { cookie: admin });
    expect(a.data.confirmationCalls.length).toBeGreaterThan(0);
    const h = await call("/api/admin/health", { cookie: admin });
    expect(h.data.lines.find((l: any) => l.key === "facebook").en).toContain("not connected yet");
  });
});

describe("gift box", () => {
  it("adds the fee to the order, shows it on the order and prints it on the invoice", async () => {
    await setSetting(admin, "fraud", { requireOtp: false });
    const token = await otpToken("01799990020");
    const { res, data } = await placeOrder({ otpToken: token, giftWrap: true, giftMessage: "Happy birthday, Apu!" }, "01799990020");
    expect(res.status).toBe(201);
    expect(data.total).toBe(2 * 2990 + 60); // delivery is free in Dhaka City over ৳3,000
    const o = await env.DB.prepare("SELECT id, gift_wrap, gift_wrap_fee, total, gift_message FROM orders WHERE order_no = ?").bind(data.orderNo).first<Record<string, number | string>>();
    expect(o).toMatchObject({ gift_wrap: 1, gift_wrap_fee: 60, total: 6040, gift_message: "Happy birthday, Apu!" });
    const pub = await call(`/api/orders/track?order=${data.orderNo}&token=${data.token}`);
    expect(pub.data.order).toMatchObject({ gift_wrap: true, gift_wrap_fee: 60 });
    await call(`/api/admin/orders/${o!.id}/status`, { method: "POST", cookie: admin, json: { status: "confirmed" } });
    const pdf = await call(`/api/admin/orders/${o!.id}/invoice.pdf`, { cookie: admin, raw: true });
    const text = new TextDecoder().decode(await pdf.res.arrayBuffer());
    expect(text).toContain("Gift box");
    expect(text).toContain("Tk 60");
  });

  it("follows the owner's settings: fee changes apply, and turning it off ignores the request", async () => {
    const store = (await call("/api/admin/settings", { cookie: admin })).data.settings.store;
    await setSetting(admin, "store", { ...store, gift_wrap_enabled: true, gift_wrap_fee: 120 });
    const items = [{ variantId: await variantId(BUDS), quantity: 1 }];
    const q1 = await call("/api/cart/quote", { method: "POST", json: { items, address: address.mirpur, giftWrap: true } });
    expect(q1.data).toMatchObject({ giftWrap: true, giftWrapFee: 120 });
    await setSetting(admin, "store", { ...store, gift_wrap_enabled: false });
    const q2 = await call("/api/cart/quote", { method: "POST", json: { items, address: address.mirpur, giftWrap: true } });
    expect(q2.data).toMatchObject({ giftWrap: false, giftWrapFee: 0 });
    const bad = await call("/api/admin/settings/store", { method: "PUT", cookie: admin, json: { ...store, gift_wrap_fee: -5 } });
    expect(bad.res.status).toBe(422);
    await setSetting(admin, "store", store);
  });
});

describe("stock lots: first-expiring (dated) or oldest lot first", () => {
  const batchesOf = (sku: string) =>
    env.DB.prepare("SELECT b.batch_no, b.expiry_date, b.qty_remaining FROM inventory_batches b JOIN product_variants v ON v.id = b.variant_id WHERE v.sku = ? ORDER BY b.expiry_date, b.id").bind(sku).all<{ batch_no: string; expiry_date: string; qty_remaining: number }>();

  it("packs from the oldest lot first, splits across lots and puts units back into the same lots on cancel", async () => {
    await setSetting(admin, "fraud", { requireOtp: false });
    const before = (await batchesOf(POWERBANK)).results;
    expect(before.length).toBe(2);
    const [soon, later] = before;
    const qty = soon!.qty_remaining + 2;
    const o = await placeOrder({ items: [{ variantId: await variantId(POWERBANK), quantity: qty }] }, "01799990016");
    expect(o.res.status).toBe(201);
    const item = await env.DB.prepare("SELECT i.batches FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.order_no = ?").bind(o.data.orderNo).first<{ batches: string }>();
    const alloc = JSON.parse(item!.batches);
    expect(alloc.map((a: any) => [a.batch_no, a.qty])).toEqual([[soon!.batch_no, soon!.qty_remaining], [later!.batch_no, 2]]);
    expect(alloc[0].expiry).toBe(soon!.expiry_date);
    const mid = (await batchesOf(POWERBANK)).results;
    expect(mid.map((b) => b.qty_remaining)).toEqual([0, later!.qty_remaining - 2]);

    // The picker sees the lot on the order and on the packing slip / invoice.
    const id = await orderId(o.data.orderNo);
    const detail = await call(`/api/admin/orders/${id}`, { cookie: admin });
    expect(JSON.parse(detail.data.items[0].batches)[0].batch_no).toBe(soon!.batch_no);

    const r = await call(`/api/admin/orders/${id}/attempts`, { method: "POST", cookie: admin, json: { outcome: "declined" } });
    expect(r.data.order.status).toBe("cancelled");
    expect((await batchesOf(POWERBANK)).results.map((b) => b.qty_remaining)).toEqual(before.map((b) => b.qty_remaining));
  });

  it("receives a dated lot first in line, warns before it expires and writes off damaged units", async () => {
    const vid = await variantId(CHARGER);
    const stock = await stockOf(CHARGER);
    const bad = await call("/api/admin/inventory/batches", { method: "POST", cookie: admin, json: { variantId: vid, batch_no: "cb2610x", quantity: 10, manufactured_on: "2027-01-01", expiry_date: "2026-12-01" } });
    expect(bad.res.status).toBe(422);
    const soonDate = new Date(Date.now() + 20 * 86400_000).toISOString().slice(0, 10);
    const ok = await call("/api/admin/inventory/batches", { method: "POST", cookie: admin, json: { variantId: vid, batch_no: "cb2610x", quantity: 10, expiry_date: soonDate, supplier: "Test supplier" } });
    expect(ok.res.status).toBe(201);
    expect(await stockOf(CHARGER)).toBe(stock + 10);
    const dupe = await call("/api/admin/inventory/batches", { method: "POST", cookie: admin, json: { variantId: vid, batch_no: "CB2610X", quantity: 1, expiry_date: soonDate } });
    expect(dupe.res.status).toBe(409);

    const expiring = await call("/api/admin/inventory/batches?status=expiring", { cookie: admin });
    const row = expiring.data.items.find((b: any) => b.batch_no === "CB2610X");
    expect(row).toMatchObject({ expiry_state: "soon", qty_remaining: 10, sku: CHARGER });
    const att = await call("/api/admin/attention", { cookie: admin });
    expect(att.data.expiringBatches.some((b: any) => b.batch_no === "CB2610X")).toBe(true);
    const inv = await call(`/api/admin/inventory?stock=expiring&q=${CHARGER}`, { cookie: admin });
    expect(inv.data.items[0].next_expiry).toBe(soonDate);

    const wo = await call(`/api/admin/inventory/batches/${row.id}/write-off`, { method: "POST", cookie: admin, json: { quantity: 3, note: "Dented boxes" } });
    expect(wo.res.status).toBe(200);
    expect(await stockOf(CHARGER)).toBe(stock + 7);
    const log = await call(`/api/admin/inventory/log?q=${CHARGER}`, { cookie: admin });
    expect(log.data.items.some((l: any) => l.change === -3 && l.note?.includes("Dented boxes"))).toBe(true);
  });

  it("takes expired dated lots off sale in the nightly job", async () => {
    const vid = await variantId(CHARGER);
    const stock = await stockOf(CHARGER);
    await env.DB.prepare("INSERT INTO inventory_batches (variant_id, batch_no, expiry_date, qty_received, qty_remaining) VALUES (?, 'OLD2401', '2024-01-31', 4, 4)").bind(vid).run();
    await env.DB.prepare("UPDATE product_variants SET stock = stock + 4 WHERE id = ?").bind(vid).run();
    const run = await call("/api/admin/jobs/run", { method: "POST", cookie: admin });
    expect(run.res.status).toBe(200);
    expect(await stockOf(CHARGER)).toBe(stock);
    const old = await env.DB.prepare("SELECT qty_remaining, written_off_at FROM inventory_batches WHERE batch_no = 'OLD2401'").first<{ qty_remaining: number; written_off_at: string | null }>();
    expect(old!.qty_remaining).toBe(0);
    expect(old!.written_off_at).toBeTruthy();
  });
});

describe("serial numbers and warranty claims", () => {
  const phone = "01799990030";
  let orderNo = "";
  let itemId = 0;
  let serial = "";
  let customer = "";

  beforeAll(async () => {
    await setSetting(admin, "fraud", { requireOtp: false });
    const token = await otpToken(phone);
    const o = await placeOrder({ otpToken: token, items: [{ variantId: await variantId(HEADPHONES), quantity: 1 }] }, phone);
    expect(o.res.status).toBe(201);
    orderNo = o.data.orderNo;
    const id = await orderId(orderNo);
    itemId = (await env.DB.prepare("SELECT id FROM order_items WHERE order_id = ?").bind(id).first<{ id: number }>())!.id;
  });

  it("gives each packed unit a serial from the shelf, and checks the option and the quantity", async () => {
    const r = await call(`/api/admin/order-items/${itemId}/serials`, { cookie: admin });
    expect(r.data.item.sku).toBe(HEADPHONES);
    expect(r.data.available.length).toBeGreaterThan(0);
    serial = r.data.available[0].serial;
    const other = (await env.DB.prepare("SELECT serial FROM serial_numbers sn JOIN product_variants v ON v.id = sn.variant_id WHERE v.sku != ? LIMIT 1").bind(HEADPHONES).first<{ serial: string }>())!.serial;
    expect((await call(`/api/admin/order-items/${itemId}/serials`, { method: "PUT", cookie: admin, json: { serials: [other] } })).res.status).toBe(422);
    expect((await call(`/api/admin/order-items/${itemId}/serials`, { method: "PUT", cookie: admin, json: { serials: [serial, r.data.available[1].serial] } })).res.status).toBe(400);
    const ok = await call(`/api/admin/order-items/${itemId}/serials`, { method: "PUT", cookie: admin, json: { serials: [serial.toLowerCase()] } });
    expect(ok.res.status).toBe(200);
    expect(await env.DB.prepare("SELECT status, order_item_id FROM serial_numbers WHERE serial = ?").bind(serial).first()).toMatchObject({ status: "sold", order_item_id: itemId });

    const id = await orderId(orderNo);
    await call(`/api/admin/orders/${id}/attempts`, { method: "POST", cookie: admin, json: { outcome: "confirmed" } });
    await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "packed" } });
    await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "shipped", courier: "Pathao", trackingId: "PT-30" } });
    const d = await call(`/api/admin/orders/${id}/status`, { method: "POST", cookie: admin, json: { status: "delivered" } });
    expect(d.data.order.status).toBe("delivered");
    // The serial and the warranty are printed on the invoice.
    const pdf = await call(`/api/admin/orders/${id}/invoice.pdf`, { cookie: admin, raw: true });
    const text = new TextDecoder().decode(await pdf.res.arrayBuffer());
    expect(text).toContain(`S/N: ${serial}`);
    expect(text).toContain("Warranty: 1 year");
  });

  it("lets the customer claim while the warranty runs, for the unit we sent", async () => {
    const reg = await call("/api/auth/register", { method: "POST", json: { name: "Arif", phone, password: "Gadget-pass-123" } });
    customer = reg.res.headers.get("set-cookie")!.split(";")[0]!;
    const w = await call("/api/me/warranty", { cookie: customer });
    const item = w.data.items.find((i: any) => i.order_item_id === itemId);
    expect(item).toMatchObject({ sku: HEADPHONES, warranty_months: 12, in_warranty: true });
    expect(item.serials).toBe(serial);
    const claim = { orderNo, orderItemId: itemId, issue: "no_sound", details: "The left ear cup has no sound since yesterday." };
    const wrong = await call("/api/me/warranty", { method: "POST", cookie: customer, json: { ...claim, serial: "NOT-OUR-UNIT" } });
    expect(wrong.res.status).toBe(422);
    const ok = await call("/api/me/warranty", { method: "POST", cookie: customer, json: { ...claim, serial } });
    expect(ok.res.status).toBe(201);
    expect(ok.data.claimNo).toMatch(/^WC-\d{6}-\d{4}$/);
    expect((await call("/api/me/warranty", { method: "POST", cookie: customer, json: { ...claim, serial } })).res.status).toBe(409);
  });

  it("moves a claim Submitted → Under review → Approved → Resolved, and retires a replaced unit's serial", async () => {
    const list = await call("/api/admin/warranty-claims?status=open", { cookie: admin });
    const row = list.data.items.find((x: any) => x.order_no === orderNo);
    expect(row).toMatchObject({ status: "submitted", serial });
    const put = (json: Record<string, unknown>) => call(`/api/admin/warranty-claims/${row.id}`, { method: "PUT", cookie: admin, json });
    expect((await put({ status: "resolved", resolution: "replace" })).res.status).toBe(409); // can't skip the review
    expect((await put({ status: "under_review", staff_note: "Left driver dead on test" })).res.status).toBe(200);
    expect((await put({ status: "approved", customer_note: "We'll swap it for a new unit." })).res.status).toBe(200);
    expect((await put({ status: "resolved" })).res.status).toBeGreaterThanOrEqual(400); // needs a resolution
    expect((await put({ status: "resolved", resolution: "replace", customer_note: "Replacement sent with the courier." })).res.status).toBe(200);
    const detail = await call(`/api/admin/warranty-claims/${row.id}`, { cookie: admin });
    expect(detail.data.claim).toMatchObject({ status: "resolved", resolution: "replace", next: [] });
    expect(detail.data.serials).toMatchObject([{ serial, status: "faulty" }]);
    expect(detail.data.history.length).toBeGreaterThanOrEqual(3);
    const mine = await call("/api/me/warranty", { cookie: customer });
    expect(mine.data.claims[0]).toMatchObject({ status: "resolved", resolution: "replace" });
    const report = await call("/api/admin/reports/warranty", { cookie: admin });
    expect(report.data.rows.find((r: any) => r.label === "Sonix Wave 500 Wireless ANC Headphones")).toMatchObject({ claims: 1, replaced: 1 });
    const d = await call("/api/admin/dashboard", { cookie: admin });
    expect(d.data.kpis.openClaims.value).toBe(0);
  });
});
