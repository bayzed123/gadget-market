import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "./env";
import { ApiError, E } from "./lib/http";
import { can, type Permission } from "./lib/rbac";
import { ADMIN_COOKIE, CUSTOMER_COOKIE, readAdminSession, readCustomerSession } from "./lib/store";

/** Security headers for every Worker-generated response (static assets get the same via dist/_headers). */
export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  const h = c.res.headers;
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (!h.has("X-Frame-Options")) h.set("X-Frame-Options", "DENY");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), payment=(self)");
  if (c.env.ENVIRONMENT === "production") h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  if (c.req.path.startsWith("/api/") && !h.has("Cache-Control")) h.set("Cache-Control", "no-store");
};

/** Paths that receive POSTs from payment gateways / couriers / Meta (they authenticate differently). */
const CSRF_EXEMPT = [/^\/api\/payments\//, /^\/api\/webhooks\//];

/**
 * CSRF defence for cookie-authenticated APIs: state-changing requests must come from our own origin
 * and carry the X-Requested-With header that our fetch wrapper adds (cross-site forms cannot set it).
 */
export const csrf: MiddlewareHandler<AppEnv> = async (c, next) => {
  const m = c.req.method;
  if (m === "GET" || m === "HEAD" || m === "OPTIONS" || CSRF_EXEMPT.some((r) => r.test(c.req.path))) return next();
  const origin = c.req.header("origin");
  const self = new URL(c.req.url).origin;
  if (origin && origin !== self) throw E.forbidden();
  if (c.req.header("x-requested-with") !== "fetch") throw E.forbidden();
  return next();
};

/** Language preference from ?lang= or the gmk_lang cookie (Bangla by default). */
export const language: MiddlewareHandler<AppEnv> = async (c, next) => {
  const q = c.req.query("lang");
  const ck = getCookie(c, "gmk_lang");
  c.set("lang", q === "en" || q === "bn" ? q : ck === "en" ? "en" : "bn");
  return next();
};

export const optionalCustomer: MiddlewareHandler<AppEnv> = async (c, next) => {
  const s = await readCustomerSession(c.env, getCookie(c, CUSTOMER_COOKIE));
  if (s) c.set("customer", s);
  return next();
};

export const requireCustomer: MiddlewareHandler<AppEnv> = async (c, next) => {
  const s = await readCustomerSession(c.env, getCookie(c, CUSTOMER_COOKIE));
  if (!s) throw E.unauthorized();
  c.set("customer", s);
  return next();
};

/**
 * Admin session gate. A Super Admin / Manager who has not finished two-factor setup can only reach the
 * 2FA setup routes. Also records "last seen" (throttled to once a minute) for the staff-online panel.
 */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const s = await readAdminSession(c.env, getCookie(c, ADMIN_COOKIE));
  if (!s) throw E.unauthorized();
  const revoked = await c.env.KV.get(`staff:revoked:${s.id}`);
  if (revoked && Number(revoked) > (s.iat ?? 0)) throw E.unauthorized();
  if (s.needs2fa && !/\/auth\/(2fa|me|logout)/.test(c.req.path)) {
    throw new ApiError(403, "needs_2fa", "Please finish two-step sign-in setup first.", "প্রথমে দুই-ধাপের সাইন-ইন সেটআপ সম্পন্ন করুন।");
  }
  c.set("admin", s);
  const seenKey = `seen:${s.id}`;
  if (!(await c.env.KV.get(seenKey))) {
    await c.env.KV.put(seenKey, "1", { expirationTtl: 60 });
    c.executionCtx.waitUntil(c.env.DB.prepare("UPDATE admins SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").bind(s.id).run());
  }
  return next();
};

/** Route-level permission check. The admin UI also hides actions, but this is the real gate. */
export const perm =
  (p: Permission): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const a = c.get("admin");
    if (!a) throw E.unauthorized();
    if (!can(a.role, p)) throw E.forbidden();
    return next();
  };
