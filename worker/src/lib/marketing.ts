/**
 * Server-side conversion tracking — Meta Conversions API (CAPI).
 *
 * The browser fires the same events through the Meta Pixel with the same `event_id`, so Meta deduplicates
 * them; the server copy survives ad-blockers and iOS restrictions. Phone / email / names are normalised and
 * SHA-256 hashed before they leave the Worker, as Meta requires.
 *
 * Standard events: PageView, ViewContent, AddToCart, InitiateCheckout (relayed from the browser through
 * /api/events), Purchase (sent the moment the order is created) and Lead (sent when an abandoned checkout
 * first captures a phone number).
 */
import type { Env } from "../env";
import { sha256Hex } from "./crypto";
import { getSetting } from "./store";

export const CAPI_EVENTS = ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase", "Lead"] as const;
export type CapiEventName = (typeof CAPI_EVENTS)[number];

export interface CapiUser {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  district?: string | null;
  externalId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

export interface CapiEvent {
  name: CapiEventName;
  eventId: string;
  sourceUrl?: string;
  user: CapiUser;
  custom?: { value?: number; currency?: string; content_ids?: string[]; content_type?: string; num_items?: number; order_id?: string };
}

/** 01712345678 → 8801712345678 (E.164 without "+", as Meta expects before hashing). */
export const capiPhone = (p: string) => p.replace(/\D/g, "").replace(/^0/, "880");

export async function buildUserData(u: CapiUser): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  if (u.phone) out.ph = [await sha256Hex(capiPhone(u.phone))];
  if (u.email) out.em = [await sha256Hex(u.email.trim().toLowerCase())];
  if (u.name) {
    const [fn, ...rest] = u.name.trim().toLowerCase().split(/\s+/);
    if (fn) out.fn = [await sha256Hex(fn)];
    if (rest.length) out.ln = [await sha256Hex(rest.join(" "))];
  }
  if (u.district) out.ct = [await sha256Hex(u.district.toLowerCase().replace(/[^a-z]/g, ""))];
  out.country = [await sha256Hex("bd")];
  if (u.externalId) out.external_id = [await sha256Hex(u.externalId)];
  if (u.ip && u.ip !== "unknown") out.client_ip_address = u.ip;
  if (u.userAgent) out.client_user_agent = u.userAgent;
  if (u.fbp) out.fbp = u.fbp;
  if (u.fbc) out.fbc = u.fbc;
  return out;
}

async function logEvent(env: Env, name: string, id: string, status: "sent" | "failed" | "skipped", error: string | null) {
  await env.DB.prepare("INSERT INTO marketing_events (provider, event_name, event_id, status, error) VALUES ('meta_capi', ?, ?, ?, ?)").bind(name, id, status, error).run();
}

export async function sendCapi(env: Env, ev: CapiEvent): Promise<boolean> {
  const { metaPixelId } = await getSetting(env, "integrations");
  if (!metaPixelId || !env.META_CAPI_TOKEN) {
    // PageView relays are frequent; only log the business events when tracking isn't connected.
    if (ev.name !== "PageView") await logEvent(env, ev.name, ev.eventId, "skipped", "Pixel ID or META_CAPI_TOKEN not set");
    return false;
  }
  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: ev.name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: ev.eventId,
        action_source: "website",
        event_source_url: ev.sourceUrl,
        user_data: await buildUserData(ev.user),
        custom_data: ev.custom ? { currency: "BDT", ...ev.custom } : undefined,
      },
    ],
  };
  if (env.META_TEST_EVENT_CODE) payload.test_event_code = env.META_TEST_EVENT_CODE;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(metaPixelId)}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    await logEvent(env, ev.name, ev.eventId, res.ok ? "sent" : "failed", res.ok ? null : `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.ok;
  } catch (e) {
    await logEvent(env, ev.name, ev.eventId, "failed", String(e).slice(0, 300));
    return false;
  }
}

/** Shared event ids — the browser computes the same strings, which is what lets Meta deduplicate. */
export const eventIds = {
  purchase: (orderNo: string) => `purchase-${orderNo}`,
  lead: (sessionId: string) => `lead-${sessionId}`,
};
