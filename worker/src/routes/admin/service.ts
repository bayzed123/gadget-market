/**
 * After-sales desk: warranty claims (Submitted → Under review → Approved / Rejected → Resolved, with notes), product
 * questions (answer → published on the product page) and serial numbers given to an order line when it is packed.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../env";
import { ApiError, body, E, intParam, likeText, SQL_NOW } from "../../lib/http";
import { questionAnswerSchema, warrantyClaimUpdateSchema } from "../../lib/schemas";
import { perm } from "../../middleware";
import { audit } from "../../lib/store";
import { sendTemplate } from "../../lib/notify";
import { csvResponse } from "./crud";

const app = new Hono<AppEnv>();

// ---------------------------------------------------------------- warranty claims
export type ClaimStatus = "submitted" | "under_review" | "approved" | "rejected" | "resolved";

/** The only moves a claim can make. Rejected and Resolved are final. */
export const CLAIM_FLOW: Record<ClaimStatus, ClaimStatus[]> = {
  submitted: ["under_review", "rejected"],
  under_review: ["approved", "rejected"],
  approved: ["resolved"],
  rejected: [],
  resolved: [],
};

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, { en: string; bn: string }> = {
  submitted: { en: "Submitted", bn: "জমা হয়েছে" },
  under_review: { en: "Under review", bn: "যাচাই চলছে" },
  approved: { en: "Approved", bn: "অনুমোদিত" },
  rejected: { en: "Rejected", bn: "বাতিল" },
  resolved: { en: "Resolved", bn: "সমাধান হয়েছে" },
};

export function canMoveClaim(from: ClaimStatus, to: ClaimStatus): boolean {
  return from === to || CLAIM_FLOW[from].includes(to);
}

app.get("/warranty-claims", perm("warranty.read"), async (c) => {
  const q = c.req.query();
  const where = ["1=1"];
  const args: unknown[] = [];
  if (q.status === "open") where.push("w.status IN ('submitted','under_review','approved')");
  else if (q.status && q.status in CLAIM_FLOW) {
    where.push("w.status = ?");
    args.push(q.status);
  }
  if (q.q) {
    const like = likeText(q.q);
    where.push("(w.claim_no LIKE ? OR w.serial LIKE ? OR w.sku LIKE ? OR w.phone LIKE ? OR o.order_no LIKE ? OR p.name_en LIKE ?)");
    args.push(like, like, like, like, like, like);
  }
  const w = where.join(" AND ");
  const from = `FROM warranty_claims w JOIN orders o ON o.id = w.order_id LEFT JOIN products p ON p.id = w.product_id WHERE ${w}`;
  const sql = `SELECT w.id, w.claim_no, w.status, w.resolution, w.issue, w.sku, w.serial, w.phone, w.warranty_until, w.created_at, w.updated_at,
      o.order_no, o.customer_name, p.name_en AS product_en, p.name_bn AS product_bn, p.brand ${from}
    ORDER BY CASE w.status WHEN 'submitted' THEN 0 WHEN 'under_review' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END, w.created_at DESC`;
  if (q.format === "csv") {
    const rows = await c.env.DB.prepare(`${sql} LIMIT 20000`).bind(...args).all<Record<string, unknown>>();
    await audit(c, "export", "warranty_claim", null, { rows: rows.results.length });
    return csvResponse("warranty-claims", rows.results, ["claim_no", "created_at", "status", "resolution", "order_no", "customer_name", "phone", "product_en", "sku", "serial", "issue", "warranty_until"]);
  }
  const limit = intParam(q.limit, 30, 1, 200);
  const page = intParam(q.page, 1, 1, 100000);
  const [count, rows, counts] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n ${from}`).bind(...args).first<{ n: number }>(),
    c.env.DB.prepare(`${sql} LIMIT ? OFFSET ?`).bind(...args, limit, (page - 1) * limit).all(),
    c.env.DB.prepare("SELECT status, COUNT(*) AS n FROM warranty_claims GROUP BY status").all<{ status: string; n: number }>(),
  ]);
  const total = count?.n ?? 0;
  return c.json({ items: rows.results, total, page, pages: Math.ceil(total / limit), counts: Object.fromEntries(counts.results.map((r) => [r.status, r.n])) });
});

app.get("/warranty-claims/:id{[0-9]+}", perm("warranty.read"), async (c) => {
  const id = Number(c.req.param("id"));
  const claim = await c.env.DB.prepare(
    `SELECT w.*, o.order_no, o.invoice_no, o.customer_name, o.customer_phone, o.delivered_at, o.district, o.upazila, o.area,
            i.name_en, i.name_bn, i.size, i.color, i.image, i.unit_price, i.quantity, i.warranty_months, p.slug, p.brand
       FROM warranty_claims w JOIN orders o ON o.id = w.order_id JOIN order_items i ON i.id = w.order_item_id LEFT JOIN products p ON p.id = w.product_id WHERE w.id = ?`,
  )
    .bind(id)
    .first<Record<string, unknown> & { order_item_id: number; customer_id: number | null; phone: string; status: ClaimStatus }>();
  if (!claim) throw E.notFound("Warranty claim");
  const [serials, history, earlier] = await Promise.all([
    c.env.DB.prepare("SELECT id, serial, status FROM serial_numbers WHERE order_item_id = ?").bind(claim.order_item_id).all(),
    c.env.DB.prepare("SELECT action, admin_name AS actor, details, created_at FROM audit_log WHERE entity = 'warranty_claim' AND entity_id = ? ORDER BY id").bind(String(id)).all(),
    // Earlier claims from the same phone number — repeat claims are worth a closer look.
    c.env.DB.prepare("SELECT id, claim_no, status, resolution, sku, created_at FROM warranty_claims WHERE phone = ? AND id != ? ORDER BY id DESC LIMIT 10").bind(claim.phone, id).all(),
  ]);
  return c.json({ claim: { ...claim, next: CLAIM_FLOW[claim.status] }, serials: serials.results, history: history.results, earlier: earlier.results });
});

app.put("/warranty-claims/:id{[0-9]+}", perm("warranty.update"), async (c) => {
  const id = Number(c.req.param("id"));
  const b = await body(c, warrantyClaimUpdateSchema);
  const row = await c.env.DB.prepare(
    "SELECT w.id, w.claim_no, w.status, w.resolution, w.phone, w.order_id, w.order_item_id, w.serial, i.name_en, i.name_bn FROM warranty_claims w JOIN order_items i ON i.id = w.order_item_id WHERE w.id = ?",
  )
    .bind(id)
    .first<{ id: number; claim_no: string; status: ClaimStatus; resolution: string | null; phone: string; order_id: number; order_item_id: number; serial: string | null; name_en: string; name_bn: string }>();
  if (!row) throw E.notFound("Warranty claim");
  const to = b.status ?? row.status;
  if (!canMoveClaim(row.status, to)) {
    const label = CLAIM_STATUS_LABELS;
    throw new ApiError(
      409,
      "conflict",
      `A claim that is "${label[row.status].en}" can't move to "${label[to].en}".${CLAIM_FLOW[row.status].length ? ` Next: ${CLAIM_FLOW[row.status].map((s) => label[s].en).join(" or ")}.` : " It is closed."}`,
      `"${label[row.status].bn}" অবস্থার ক্লেইম "${label[to].bn}" করা যায় না।${CLAIM_FLOW[row.status].length ? ` পরের ধাপ: ${CLAIM_FLOW[row.status].map((s) => label[s].bn).join(" বা ")}।` : " এটি বন্ধ।"}`,
    );
  }
  const resolution = b.resolution !== undefined ? b.resolution : row.resolution;
  if (to === "resolved" && (!resolution || resolution === "none")) {
    throw new ApiError(422, "validation", "Choose how it was resolved: repair, replace or refund.", "কীভাবে সমাধান হলো বেছে নিন: মেরামত, বদল বা টাকা ফেরত।", [{ field: "resolution", en: "Required to resolve.", bn: "সমাধানের জন্য দরকার।" }]);
  }
  if (to === "rejected" && !(b.customer_note ?? "").trim()) {
    throw new ApiError(422, "validation", "Tell the customer why the claim was rejected.", "ক্লেইম কেন বাতিল হলো গ্রাহককে জানান।", [{ field: "customer_note", en: "Required when rejecting.", bn: "বাতিল করলে দরকার।" }]);
  }
  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `UPDATE warranty_claims SET status = ?, resolution = ?, customer_note = COALESCE(?, customer_note), staff_note = COALESCE(?, staff_note), updated_at = ${SQL_NOW} WHERE id = ?`,
    ).bind(to, to === "rejected" ? "none" : resolution ?? null, b.customer_note ?? null, b.staff_note ?? null, id),
  ];
  // A replaced or refunded unit came back faulty: its serial is marked so it is never sold again.
  if (to === "resolved" && (resolution === "replace" || resolution === "refund") && row.serial) {
    stmts.push(c.env.DB.prepare("UPDATE serial_numbers SET status = 'faulty', note = ? WHERE serial = ? COLLATE NOCASE").bind(`Warranty ${row.claim_no}`, row.serial));
  }
  if (to !== row.status) {
    stmts.push(c.env.DB.prepare("INSERT INTO order_status_history (order_id, status, note, actor) VALUES (?, 'delivered', ?, ?)").bind(row.order_id, `Warranty ${row.claim_no}: ${CLAIM_STATUS_LABELS[to].en}`, c.get("admin")!.name));
  }
  await c.env.DB.batch(stmts);
  await audit(c, to === row.status ? "update" : to, "warranty_claim", id, { from: row.status, to, resolution, customer_note: b.customer_note, staff_note: b.staff_note });
  if (b.notify && to !== row.status) {
    const vars = (lang: "en" | "bn") => ({
      claim_no: row.claim_no,
      status: CLAIM_STATUS_LABELS[to][lang],
      note: b.customer_note ?? "",
      product: lang === "en" ? row.name_en : row.name_bn,
    });
    c.executionCtx.waitUntil(sendTemplate(c.env, row.phone, "claim_update", "bn", vars("bn"), row.order_id).then(() => undefined));
  }
  return c.json({ ok: true, status: to, en: `Claim ${row.claim_no}: ${CLAIM_STATUS_LABELS[to].en}.`, bn: `ক্লেইম ${row.claim_no}: ${CLAIM_STATUS_LABELS[to].bn}।` });
});

// ---------------------------------------------------------------- product questions
app.get("/questions", perm("questions.read"), async (c) => {
  const q = c.req.query();
  const where = ["1=1"];
  const args: unknown[] = [];
  if (q.status && ["pending", "published", "hidden"].includes(q.status)) {
    where.push("q.status = ?");
    args.push(q.status);
  }
  if (q.product_id) {
    where.push("q.product_id = ?");
    args.push(Number(q.product_id));
  }
  if (q.q) {
    const like = likeText(q.q);
    where.push("(q.question LIKE ? OR q.answer LIKE ? OR q.name LIKE ? OR p.name_en LIKE ?)");
    args.push(like, like, like, like);
  }
  const w = where.join(" AND ");
  const limit = intParam(q.limit, 30, 1, 200);
  const page = intParam(q.page, 1, 1, 100000);
  const [count, rows] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM product_questions q JOIN products p ON p.id = q.product_id WHERE ${w}`).bind(...args).first<{ n: number }>(),
    c.env.DB.prepare(
      `SELECT q.*, p.name_en AS product_en, p.name_bn AS product_bn, p.slug FROM product_questions q JOIN products p ON p.id = q.product_id WHERE ${w}
        ORDER BY (q.status = 'pending') DESC, q.created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...args, limit, (page - 1) * limit)
      .all(),
  ]);
  const total = count?.n ?? 0;
  return c.json({ items: rows.results, total, page, pages: Math.ceil(total / limit) });
});

/** Answering a question publishes it (unless a status is given); hiding keeps it off the product page. */
app.put("/questions/:id{[0-9]+}", perm("questions.answer"), async (c) => {
  const id = Number(c.req.param("id"));
  const b = await body(c, questionAnswerSchema);
  const row = await c.env.DB.prepare("SELECT id, answer FROM product_questions WHERE id = ?").bind(id).first<{ id: number; answer: string | null }>();
  if (!row) throw E.notFound("Question");
  const answer = b.answer ?? row.answer;
  const status = b.status ?? (answer ? "published" : "pending");
  if (status === "published" && !answer) throw E.badRequest("Write the answer before publishing.", "প্রকাশের আগে উত্তর লিখুন।");
  await c.env.DB.prepare(
    `UPDATE product_questions SET answer = ?, status = ?, answered_by = CASE WHEN ? IS NOT NULL AND (answer IS NULL OR answer != ?) THEN ? ELSE answered_by END,
       answered_at = CASE WHEN ? IS NOT NULL AND answered_at IS NULL THEN ${SQL_NOW} ELSE answered_at END WHERE id = ?`,
  )
    .bind(answer, status, b.answer ?? null, b.answer ?? "", c.get("admin")!.name, b.answer ?? null, id)
    .run();
  await audit(c, "answer", "question", id, { status });
  return c.json({ ok: true, en: status === "published" ? "Answer published on the product page." : "Saved.", bn: status === "published" ? "উত্তর পণ্যের পাতায় প্রকাশিত হয়েছে।" : "সংরক্ষণ করা হয়েছে।" });
});

app.delete("/questions/:id{[0-9]+}", perm("questions.answer"), async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("DELETE FROM product_questions WHERE id = ?").bind(id).run();
  await audit(c, "delete", "question", id);
  return c.json({ ok: true, en: "Deleted.", bn: "মুছে ফেলা হয়েছে।" });
});

// ---------------------------------------------------------------- serials on an order line
/** In-stock serials that can go into this order line, and the ones it already has. */
app.get("/order-items/:id{[0-9]+}/serials", perm("orders.read"), async (c) => {
  const id = Number(c.req.param("id"));
  const item = await c.env.DB.prepare("SELECT id, variant_id, quantity, sku FROM order_items WHERE id = ?").bind(id).first<{ id: number; variant_id: number | null; quantity: number; sku: string }>();
  if (!item) throw E.notFound("Order item");
  const [assigned, available] = await Promise.all([
    c.env.DB.prepare("SELECT id, serial, status FROM serial_numbers WHERE order_item_id = ? ORDER BY id").bind(id).all(),
    c.env.DB.prepare("SELECT id, serial FROM serial_numbers WHERE variant_id = ? AND status = 'in_stock' ORDER BY received_at, id LIMIT 200").bind(item.variant_id ?? 0).all(),
  ]);
  return c.json({ item, assigned: assigned.results, available: available.results });
});

/**
 * Gives an order line its serial numbers (one per unit) when it is packed. Units already given to the line and left
 * out of the new list go back on the shelf.
 */
app.put("/order-items/:id{[0-9]+}/serials", perm("orders.update"), async (c) => {
  const id = Number(c.req.param("id"));
  const b = await body(c, z.object({ serials: z.array(z.string().trim().toUpperCase().min(1).max(60)).max(100) }));
  const item = await c.env.DB.prepare("SELECT i.id, i.variant_id, i.quantity, i.sku, o.status FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.id = ?").bind(id).first<{
    id: number; variant_id: number | null; quantity: number; sku: string; status: string;
  }>();
  if (!item) throw E.notFound("Order item");
  if (["cancelled", "refused", "returned"].includes(item.status)) throw E.conflict("This order is closed.", "এই অর্ডারটি বন্ধ।");
  const wanted = [...new Set(b.serials)];
  if (wanted.length > item.quantity) throw E.badRequest(`This line has ${item.quantity} unit(s) — give at most ${item.quantity} serial(s).`, `এই লাইনে ${item.quantity}টি ইউনিট — সর্বোচ্চ ${item.quantity}টি সিরিয়াল দিন।`);
  const rows = wanted.length
    ? (
        await c.env.DB.prepare(`SELECT id, serial, variant_id, status, order_item_id FROM serial_numbers WHERE serial IN (${wanted.map(() => "?").join(",")}) COLLATE NOCASE`)
          .bind(...wanted)
          .all<{ id: number; serial: string; variant_id: number; status: string; order_item_id: number | null }>()
      ).results
    : [];
  for (const s of wanted) {
    const r = rows.find((x) => x.serial.toUpperCase() === s);
    if (!r) throw new ApiError(422, "validation", `Serial ${s} isn't in stock. Log it under Inventory → Serial numbers first.`, `সিরিয়াল ${s} স্টকে নেই। আগে ইনভেন্টরি → সিরিয়াল নম্বরে যোগ করুন।`, [{ field: "serials", en: `${s}: unknown`, bn: `${s}: অজানা` }]);
    if (r.variant_id !== item.variant_id) throw new ApiError(422, "validation", `Serial ${s} belongs to another product option.`, `সিরিয়াল ${s} অন্য অপশনের।`, [{ field: "serials", en: `${s}: wrong option`, bn: `${s}: ভুল অপশন` }]);
    if (r.order_item_id !== id && r.status !== "in_stock") throw E.conflict(`Serial ${s} is ${r.status.replace("_", " ")}, not on the shelf.`, `সিরিয়াল ${s} এখন শেলফে নেই।`);
  }
  const keepIds = rows.map((r) => r.id);
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE serial_numbers SET status = 'in_stock', order_item_id = NULL, sold_at = NULL WHERE order_item_id = ?${keepIds.length ? ` AND id NOT IN (${keepIds.map(() => "?").join(",")})` : ""}`).bind(id, ...keepIds),
    ...keepIds.map((sid) => c.env.DB.prepare(`UPDATE serial_numbers SET status = 'sold', order_item_id = ?, sold_at = COALESCE(sold_at, ${SQL_NOW}) WHERE id = ?`).bind(id, sid)),
  ]);
  await audit(c, "serials_assign", "order_item", id, { serials: wanted });
  return c.json({ ok: true, en: `${wanted.length} serial(s) saved for ${item.sku}.`, bn: `${item.sku} এর ${wanted.length}টি সিরিয়াল সংরক্ষিত।` });
});

export default app;
