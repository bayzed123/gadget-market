/**
 * Stock-lot tracking.
 *
 * Every stock intake is recorded as a lot (supplier invoice or shipment number). Gadgets don't expire, so a lot's
 * expiry defaults to "2099-12-31" (NO_EXPIRY) and lots are simply used oldest-first (FIFO); the few items that do
 * carry a date (e.g. dated batteries) can still be given one, and then the earliest date goes first (FEFO). A
 * variant's `stock` stays the single number the shop sells from; lots say which physical units those are:
 *   - orders take units from the oldest lot and remember which lots they used, so a cancelled or refused parcel
 *     goes back into the same lot (and the invoice can name the lot);
 *   - dated lots past their date are never allocated, and the daily job writes their remaining units off;
 *   - the dashboard warns about dated lots expiring within `store.expiry_alert_days` (default 60).
 * Stock added with a plain adjustment is "untracked" and simply has no lot. */
import type { Env } from "../env";
import { SQL_NOW } from "./http";

export interface Allocation {
  batch_id: number;
  batch_no: string;
  expiry: string;
  qty: number;
}

/** Today's date in Bangladesh (UTC+6) as YYYY-MM-DD. */
export function bdToday(d = new Date()): string {
  return new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 10);
}

/** Bangladesh date `days` from today, YYYY-MM-DD. */
export function bdDatePlus(days: number, d = new Date()): string {
  return bdToday(new Date(d.getTime() + days * 86400_000));
}

/** Whole days from today (Bangladesh) until an expiry date; negative when already expired. */
export function daysUntil(expiry: string, d = new Date()): number {
  return Math.round((Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${bdToday(d)}T00:00:00Z`)) / 86400_000);
}

/** Pure FIFO/FEFO split: takes `qty` from the lots in the order given (already sorted by expiry, then age). */
export function splitFefo(batches: { id: number; batch_no: string; expiry_date: string; qty_remaining: number }[], qty: number): Allocation[] {
  const out: Allocation[] = [];
  let left = qty;
  for (const b of batches) {
    if (left <= 0) break;
    const take = Math.min(left, b.qty_remaining);
    if (take > 0) {
      out.push({ batch_id: b.id, batch_no: b.batch_no, expiry: b.expiry_date, qty: take });
      left -= take;
    }
  }
  return out;
}

/** Plans allocations for a set of order lines: earliest date first, then oldest lot (unexpired lots only). */
export async function planAllocations(env: Env, lines: { variantId: number; quantity: number }[]): Promise<Map<number, Allocation[]>> {
  const out = new Map<number, Allocation[]>();
  if (!lines.length) return out;
  const ids = [...new Set(lines.map((l) => l.variantId))];
  const { results } = await env.DB.prepare(
    `SELECT id, variant_id, batch_no, expiry_date, qty_remaining FROM inventory_batches
      WHERE variant_id IN (${ids.map(() => "?").join(",")}) AND qty_remaining > 0 AND expiry_date >= ?
      ORDER BY expiry_date, id`,
  )
    .bind(...ids, bdToday())
    .all<{ id: number; variant_id: number; batch_no: string; expiry_date: string; qty_remaining: number }>();
  for (const l of lines) out.set(l.variantId, splitFefo(results.filter((b) => b.variant_id === l.variantId), l.quantity));
  return out;
}

/** Statements that take allocated units out of their batches. CHECK (qty_remaining >= 0) rolls back a race. */
export function allocationStatements(env: Env, allocations: Allocation[]): D1PreparedStatement[] {
  return allocations.map((a) => env.DB.prepare("UPDATE inventory_batches SET qty_remaining = qty_remaining - ? WHERE id = ?").bind(a.qty, a.batch_id));
}

/** Statements that put units back into the batches an order line came from (cancelled / refused before opening). */
export function restoreStatements(env: Env, allocations: Allocation[]): D1PreparedStatement[] {
  return allocations.map((a) =>
    env.DB.prepare("UPDATE inventory_batches SET qty_remaining = MIN(qty_received, qty_remaining + ?) WHERE id = ? AND written_off_at IS NULL").bind(a.qty, a.batch_id),
  );
}

/**
 * Keeps batch quantities from exceeding the variant's stock after a manual "remove" or "set" adjustment:
 * the excess comes off the newest lots (the ones that would be sold last).
 */
export async function reconcileVariantBatches(env: Env, variantId: number): Promise<void> {
  const v = await env.DB.prepare("SELECT stock FROM product_variants WHERE id = ?").bind(variantId).first<{ stock: number }>();
  if (!v) return;
  const { results } = await env.DB.prepare("SELECT id, qty_remaining FROM inventory_batches WHERE variant_id = ? AND qty_remaining > 0 ORDER BY expiry_date DESC, id DESC")
    .bind(variantId)
    .all<{ id: number; qty_remaining: number }>();
  let excess = results.reduce((s, b) => s + b.qty_remaining, 0) - v.stock;
  const stmts: D1PreparedStatement[] = [];
  for (const b of results) {
    if (excess <= 0) break;
    const take = Math.min(excess, b.qty_remaining);
    stmts.push(env.DB.prepare("UPDATE inventory_batches SET qty_remaining = qty_remaining - ? WHERE id = ?").bind(take, b.id));
    excess -= take;
  }
  if (stmts.length) await env.DB.batch(stmts);
}

/** Daily job: writes off every unit in batches past their expiry date, so expired stock is never sold. */
export async function expireDueBatches(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT b.id, b.variant_id, b.batch_no, b.expiry_date, b.qty_remaining, v.product_id, v.sku FROM inventory_batches b JOIN product_variants v ON v.id = b.variant_id
      WHERE b.qty_remaining > 0 AND b.expiry_date < ? LIMIT 200`,
  )
    .bind(bdToday())
    .all<{ id: number; variant_id: number; batch_no: string; expiry_date: string; qty_remaining: number; product_id: number; sku: string }>();
  if (!results.length) return 0;
  const stmts: D1PreparedStatement[] = [];
  for (const b of results) {
    stmts.push(
      env.DB.prepare(
        "INSERT INTO inventory_log (product_id, variant_id, sku, change, stock_after, reason, note, actor) SELECT product_id, id, sku, -MIN(stock, ?), MAX(0, stock - ?), 'expired', ?, 'system' FROM product_variants WHERE id = ?",
      ).bind(b.qty_remaining, b.qty_remaining, `Lot ${b.batch_no} expired ${b.expiry_date}`, b.variant_id),
      env.DB.prepare(`UPDATE product_variants SET stock = MAX(0, stock - ?), updated_at = ${SQL_NOW} WHERE id = ?`).bind(b.qty_remaining, b.variant_id),
      env.DB.prepare(`UPDATE inventory_batches SET qty_remaining = 0, written_off_at = ${SQL_NOW} WHERE id = ?`).bind(b.id),
    );
  }
  await env.DB.batch(stmts);
  return results.length;
}

/** Batches with units left that expire within `days` (including today). */
export async function countExpiringBatches(env: Env, days: number): Promise<number> {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM inventory_batches WHERE qty_remaining > 0 AND expiry_date >= ? AND expiry_date <= ?")
    .bind(bdToday(), bdDatePlus(days))
    .first<{ n: number }>();
  return r?.n ?? 0;
}
