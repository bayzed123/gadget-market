/** Small data-access helpers shared by routes: settings, zones, counters, audit log, rate limiting, sessions, Turnstile. */
import type { Context } from "hono";
import type { AppEnv, Env, AdminSession, CustomerSession } from "../env";
import { parseJson, clientIp, E } from "./http";
import type { Zone } from "./pricing";
import { SETTING_DEFAULTS, type SettingKey } from "./settings";

// ---------- Settings (D1 table, cached in KV for 60s, merged over defaults) ----------
type SettingValue<K extends SettingKey> = (typeof SETTING_DEFAULTS)[K];

export async function getSetting<K extends SettingKey>(env: Env, key: K): Promise<SettingValue<K>> {
  const fallback = SETTING_DEFAULTS[key];
  const cacheKey = `setting:${key}`;
  let stored: unknown = null;
  const cached = await env.KV.get(cacheKey);
  if (cached) stored = parseJson<unknown>(cached, null);
  else {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
    stored = row ? parseJson<unknown>(row.value, null) : null;
    await env.KV.put(cacheKey, JSON.stringify(stored), { expirationTtl: 60 });
  }
  if (stored && typeof stored === "object" && !Array.isArray(stored)) return { ...fallback, ...(stored as object) } as SettingValue<K>;
  return fallback;
}

export async function putSetting(env: Env, key: SettingKey, value: unknown): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  )
    .bind(key, JSON.stringify(value))
    .run();
  await env.KV.delete(`setting:${key}`);
}

// ---------- Counters (SKU sequences, invoice numbers) ----------
/** Atomically increments and returns a named counter. One SQL statement, so concurrent calls never collide. */
export async function nextCounter(env: Env, name: string): Promise<number> {
  const row = await env.DB.prepare("INSERT INTO counters (name, value) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET value = value + 1 RETURNING value")
    .bind(name)
    .first<{ value: number }>();
  return row!.value;
}

// ---------- Delivery zones ----------
interface ZoneRow {
  id: number;
  code: string;
  name_en: string;
  name_bn: string;
  fee: number;
  free_shipping_min: number | null;
  division_ids: string;
  district_ids: string;
  upazila_ids: string;
  eta_en: string | null;
  eta_bn: string | null;
  is_default: number;
  is_active: number;
}
export async function loadZones(env: Env): Promise<(Zone & { id: number })[]> {
  const { results } = await env.DB.prepare("SELECT * FROM delivery_zones WHERE deleted_at IS NULL AND is_active = 1 ORDER BY sort_order, id").all<ZoneRow>();
  return results.map((z) => ({
    ...z,
    division_ids: parseJson<number[]>(z.division_ids, []),
    district_ids: parseJson<number[]>(z.district_ids, []),
    upazila_ids: parseJson<number[]>(z.upazila_ids, []),
  }));
}

// ---------- Audit log ----------
export async function audit(c: Context<AppEnv>, action: string, entity: string, entityId: string | number | null, details?: unknown): Promise<void> {
  const admin = c.get("admin");
  await c.env.DB.prepare("INSERT INTO audit_log (admin_id, admin_name, action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(admin?.id ?? null, admin?.name ?? "system", action, entity, entityId == null ? null : String(entityId), details ? JSON.stringify(details).slice(0, 4000) : null, clientIp(c))
    .run();
}

// ---------- Rate limiting (fixed window in KV) ----------
/** Returns the new count. Throws 429 when the limit is exceeded. `key` defaults to the client IP. */
export async function rateLimit(c: Context<AppEnv>, bucket: string, limit: number, windowSec: number, key = clientIp(c)): Promise<number> {
  const k = `rl:${bucket}:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const current = Number((await c.env.KV.get(k)) ?? "0");
  if (current >= limit) throw E.tooMany();
  await c.env.KV.put(k, String(current + 1), { expirationTtl: Math.max(60, windowSec) });
  return current + 1;
}

// ---------- Sessions ----------
export const ADMIN_COOKIE = "gmk_admin";
export const CUSTOMER_COOKIE = "gmk_cust";
export const ADMIN_TTL = 60 * 60 * 12; // 12 hours
export const CUSTOMER_TTL = 60 * 60 * 24 * 30; // 30 days

export async function readAdminSession(env: Env, token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  return parseJson<AdminSession | null>(await env.KV.get(`s:a:${token}`), null);
}
export async function readCustomerSession(env: Env, token: string | undefined): Promise<CustomerSession | null> {
  if (!token) return null;
  return parseJson<CustomerSession | null>(await env.KV.get(`s:c:${token}`), null);
}

// ---------- Cloudflare Turnstile (bot protection on checkout and sign-in) ----------
export async function verifyTurnstile(c: Context<AppEnv>, token: string | undefined): Promise<void> {
  if (!c.env.TURNSTILE_SECRET) return; // not configured → skip (rate limits and velocity checks still apply)
  if (!token) throw E.badRequest("Please complete the security check.", "নিরাপত্তা যাচাই সম্পন্ন করুন।");
  const form = new FormData();
  form.append("secret", c.env.TURNSTILE_SECRET);
  form.append("response", token);
  form.append("remoteip", clientIp(c));
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const data = (await res.json()) as { success: boolean };
  if (!data.success) throw E.badRequest("Security check failed. Please try again.", "নিরাপত্তা যাচাই ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
}

/** Expand category ids to include all descendants (for filters and coupon rules). */
export async function expandCategoryIds(env: Env, ids: number[]): Promise<number[]> {
  if (!ids.length) return [];
  const { results } = await env.DB.prepare("SELECT id, parent_id FROM categories WHERE deleted_at IS NULL").all<{ id: number; parent_id: number | null }>();
  const out = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of results) {
      if (r.parent_id != null && out.has(r.parent_id) && !out.has(r.id)) {
        out.add(r.id);
        grew = true;
      }
    }
  }
  return [...out];
}

export function publicUrl(env: Env, reqUrl?: string): string {
  if (env.PUBLIC_URL) return env.PUBLIC_URL.replace(/\/$/, "");
  return reqUrl ? new URL(reqUrl).origin : "";
}
