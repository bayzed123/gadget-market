/**
 * SKU, invoice and warranty-claim numbering (hard requirement), plus the shop's fixed vocabularies.
 *
 *   SKU      GAD-<CategoryCode>-<BrandCode>-<ColorCode>-<Sequence>   e.g. GAD-EB-JBL-BLK-0007, GAD-PB-ANK-WHT-0012
 *   Invoice  INV-GAD-<YYYYMMDD>-<####>                                e.g. INV-GAD-20261001-0007
 *   Claim    WC-<YYMMDD>-<####>                                       e.g. WC-261001-0003
 *
 * Sequences come from the `counters` table (one atomic UPDATE … RETURNING). SKUs are unique in the database
 * (uq_variants_sku); invoice numbers are unique (uq_orders_invoice), restart at 0001 every Bangladesh day and are
 * assigned once — when the order is confirmed.
 */
import type { Env } from "../env";
import { BRAND } from "../brand";
import { bdDateStamp } from "./http";
import { nextCounter } from "./store";
import { catCode, formatSku as formatSkuPure } from "./codes";

export { COMPATIBLE, COMPATIBLE_LABELS, isCompatible, SPEC_KEYS, specLabel, brandCode, colorCode, catCode, SKU_PATTERN, type Compatible } from "./codes";

export function formatSku(categoryCode: string, brand: string | null | undefined, color: string | null | undefined, seq: number, prefix = BRAND.skuPrefix): string {
  return formatSkuPure(categoryCode, brand, color, seq, prefix);
}


/** Generates the next free SKU for a category (the sequence runs per category). Skips numbers already taken by hand. */
export async function generateSku(env: Env, categoryCode: string, brand: string | null | undefined, color: string | null | undefined, taken: Set<string> = new Set()): Promise<string> {
  const cat = catCode(categoryCode);
  for (let i = 0; i < 20; i++) {
    const sku = formatSku(cat, brand, color, await nextCounter(env, `sku:${cat}`));
    if (taken.has(sku)) continue;
    const exists = await env.DB.prepare("SELECT 1 FROM product_variants WHERE sku = ?").bind(sku).first();
    if (!exists) return sku;
  }
  throw new Error("Could not find a free SKU number");
}

export function formatInvoiceNo(dateStamp: string, seq: number, prefix = BRAND.invoicePrefix): string {
  return `${prefix}-${dateStamp}-${String(seq).padStart(4, "0")}`;
}

export const INVOICE_PATTERN = /^INV-[A-Z]{2,5}-\d{8}-\d{4,}$/;

/** Gives a confirmed order its invoice number (idempotent — an order keeps the number it already has). */
export async function assignInvoiceNo(env: Env, orderId: number): Promise<string> {
  const existing = await env.DB.prepare("SELECT invoice_no FROM orders WHERE id = ?").bind(orderId).first<{ invoice_no: string | null }>();
  if (existing?.invoice_no) return existing.invoice_no;
  const stamp = bdDateStamp();
  const invoiceNo = formatInvoiceNo(stamp, await nextCounter(env, `inv:${stamp}`));
  const r = await env.DB.prepare("UPDATE orders SET invoice_no = ? WHERE id = ? AND invoice_no IS NULL").bind(invoiceNo, orderId).run();
  if (!r.meta.changes) {
    const again = await env.DB.prepare("SELECT invoice_no FROM orders WHERE id = ?").bind(orderId).first<{ invoice_no: string | null }>();
    return again?.invoice_no ?? invoiceNo;
  }
  return invoiceNo;
}

/** WC-261001-0003: warranty claims, numbered per Bangladesh day. */
export async function nextClaimNo(env: Env): Promise<string> {
  const stamp = bdDateStamp().slice(2);
  return `WC-${stamp}-${String(await nextCounter(env, `wc:${stamp}`)).padStart(4, "0")}`;
}

/** Warranty end date for a unit delivered on `deliveredOn` (YYYY-MM-DD) with `months` of cover; null when there is none. */
export function warrantyUntil(deliveredOn: string, months: number): string | null {
  if (!months || months <= 0 || !/^\d{4}-\d{2}-\d{2}/.test(deliveredOn)) return null;
  const [y, m, d] = deliveredOn.slice(0, 10).split("-").map(Number) as [number, number, number];
  const end = new Date(Date.UTC(y, m - 1 + months, d));
  // Month overflow (31 Jan + 1 month) lands on the last day of the target month, not in the month after.
  if (end.getUTCDate() !== d) end.setUTCDate(0);
  return end.toISOString().slice(0, 10);
}
