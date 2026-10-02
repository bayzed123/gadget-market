/**
 * Web Push for installed-PWA customers (order updates and opt-in promotions, no SMS cost).
 * Uses VAPID with an empty push body: the service worker wakes up and fetches the message text from
 * /api/push/latest, so no payload encryption is needed and nothing sensitive travels through push services.
 */
import type { Env } from "../env";
import { b64url, unb64url } from "./crypto";

async function vapidKey(env: Env): Promise<CryptoKey> {
  const pub = unb64url(env.VAPID_PUBLIC_KEY!); // 65 bytes: 0x04 || X || Y
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", d: env.VAPID_PRIVATE_KEY!, x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), ext: true };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export function pushConfigured(env: Env): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export async function vapidJwt(env: Env, audience: string): Promise<string> {
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || "mailto:hello@example.com" })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await vapidKey(env), enc.encode(`${header}.${claims}`));
  return `${header}.${claims}.${b64url(sig)}`;
}

/** Sends a "tickle" push. Returns false (and the caller removes the subscription) when it has expired. */
export async function sendPushTickle(env: Env, endpoint: string): Promise<"sent" | "gone" | "failed"> {
  const aud = new URL(endpoint).origin;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { TTL: "86400", Urgency: "normal", authorization: `vapid t=${await vapidJwt(env, aud)}, k=${env.VAPID_PUBLIC_KEY}`, "content-length": "0" },
  });
  if (res.status === 404 || res.status === 410) return "gone";
  return res.ok ? "sent" : "failed";
}
