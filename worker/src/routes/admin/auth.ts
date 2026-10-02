/**
 * Staff sign-in.
 *  - Super Admin & Manager: password + a 6-digit authenticator code (two-factor is required; first sign-in walks
 *    them through setup and nothing else works until it's done).
 *  - Order Processor & Read-only Viewer: password, or simply their mobile number + an SMS code.
 * Also: sign-out, profile, and one-time bootstrap of the first Super Admin.
 */
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AdminSession, AppEnv, Role } from "../../env";
import { ApiError, body, clientIp, E, SQL_NOW } from "../../lib/http";
import { adminLoginId, adminLoginSchema, bdPhone } from "../../lib/schemas";
import { hashPassword, newTotpSecret, randomDigits, randomToken, safeEqualStr, verifyPassword, verifyTotp } from "../../lib/crypto";
import { ADMIN_COOKIE, ADMIN_TTL, audit, getSetting, rateLimit, verifyTurnstile } from "../../lib/store";
import { ROLE_MATRIX, ROLES_REQUIRING_2FA, ROLES_WITH_PHONE_LOGIN } from "../../lib/rbac";
import { requireAdmin } from "../../middleware";
import { sendSms } from "../../lib/notify";
import { BRAND } from "../../brand";

const app = new Hono<AppEnv>();

interface AdminRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  password_hash: string | null;
  is_active: number;
  totp_secret: string | null;
  totp_enabled: number;
}

async function startSession(c: Context<AppEnv>, a: AdminRow, needs2fa: boolean) {
  const token = randomToken();
  const session: AdminSession = { id: a.id, name: a.name, email: a.email, role: a.role, iat: Date.now(), ...(needs2fa ? { needs2fa: true } : {}) };
  await c.env.KV.put(`s:a:${token}`, JSON.stringify(session), { expirationTtl: ADMIN_TTL });
  setCookie(c, ADMIN_COOKIE, token, { httpOnly: true, secure: c.env.ENVIRONMENT !== "development", sameSite: "Strict", path: "/", maxAge: ADMIN_TTL });
  await c.env.DB.prepare(`UPDATE admins SET last_login_at = ${SQL_NOW}, last_seen_at = ${SQL_NOW} WHERE id = ?`).bind(a.id).run();
  c.set("admin", session);
  await audit(c, needs2fa ? "login_pending_2fa" : "login", "admin", a.id);
  return session;
}

/** Detect: every failure is logged; the owner gets an SMS after 5 failures from one IP within an hour. */
async function loginFailed(c: Context<AppEnv>, who: string, reason: string) {
  await c.env.DB.prepare("INSERT INTO audit_log (admin_id, admin_name, action, entity, entity_id, details, ip) VALUES (NULL, ?, 'login_failed', 'admin', NULL, ?, ?)")
    .bind(who, JSON.stringify({ reason }), clientIp(c))
    .run();
  const key = `fail:admin:${clientIp(c)}`;
  const n = Number((await c.env.KV.get(key)) ?? "0") + 1;
  await c.env.KV.put(key, String(n), { expirationTtl: 3600 });
  if (n === 5) {
    const cfg = await getSetting(c.env, "notifications");
    if (cfg.ownerPhone) c.executionCtx.waitUntil(sendSms(c.env, cfg.ownerPhone, `${BRAND.name.en} security alert: 5 failed admin sign-ins from IP ${clientIp(c)} (last tried: ${who}).`, "security"));
  }
}

const selectAdmin = "SELECT id, name, email, phone, role, password_hash, is_active, totp_secret, totp_enabled FROM admins WHERE deleted_at IS NULL AND ";

app.post("/login", async (c) => {
  await rateLimit(c, "admin-login", 10, 900);
  const b = await body(c, adminLoginSchema);
  await verifyTurnstile(c, b.turnstileToken);
  const a = await c.env.DB.prepare(`${selectAdmin} email = ?`).bind(b.email).first<AdminRow>();
  const ok = a && a.is_active && (await verifyPassword(b.password, a.password_hash));
  if (!ok) {
    await loginFailed(c, b.email, "password");
    throw new ApiError(401, "bad_credentials", "Username/email or password is incorrect.", "ইউজারনেম/ইমেইল বা পাসওয়ার্ড সঠিক নয়।");
  }
  const needs = ROLES_REQUIRING_2FA.includes(a.role);
  if (a.totp_enabled && a.totp_secret) {
    if (!b.totp) throw new ApiError(401, "totp_required", "Enter the 6-digit code from your authenticator app.", "অথেন্টিকেটর অ্যাপের ৬ সংখ্যার কোড দিন।");
    if (!(await verifyTotp(a.totp_secret, b.totp.replace(/\s/g, "")))) {
      await loginFailed(c, b.email, "totp");
      throw new ApiError(401, "totp_invalid", "That code didn't match. Check your phone's time and try the newest code.", "কোডটি মেলেনি। ফোনের সময় ঠিক আছে কিনা দেখে নতুন কোড দিন।");
    }
  }
  const session = await startSession(c, a, needs && !a.totp_enabled);
  return c.json({ admin: session, permissions: ROLE_MATRIX[a.role], needs2fa: Boolean(session.needs2fa) });
});

// ---------- Phone + SMS code sign-in (Order Processor, Read-only Viewer) ----------
app.post("/otp/request", async (c) => {
  await rateLimit(c, "admin-otp", 5, 900);
  const { phone } = await body(c, z.object({ phone: bdPhone }));
  const a = await c.env.DB.prepare(`${selectAdmin} phone = ?`).bind(phone).first<AdminRow>();
  let devCode: string | undefined;
  if (a && a.is_active && ROLES_WITH_PHONE_LOGIN.includes(a.role)) {
    const code = randomDigits(6);
    await c.env.KV.put(`otp:admin:${phone}`, JSON.stringify({ code, tries: 0 }), { expirationTtl: 600 });
    c.executionCtx.waitUntil(sendSms(c.env, phone, `${code} is your ${BRAND.name.en} staff sign-in code. It expires in 10 minutes.`, "staff_otp"));
    if (c.env.ENVIRONMENT === "development") devCode = code;
  }
  return c.json({ ok: true, en: "If this number belongs to a staff account, a code has been sent by SMS.", bn: "এই নম্বরটি স্টাফ অ্যাকাউন্টের হলে SMS এ একটি কোড পাঠানো হয়েছে।", devCode });
});

app.post("/otp/verify", async (c) => {
  await rateLimit(c, "admin-otp-verify", 10, 900);
  const b = await body(c, z.object({ phone: bdPhone, code: z.string().trim().regex(/^\d{6}$/) }));
  const key = `otp:admin:${b.phone}`;
  const raw = await c.env.KV.get(key);
  const stored = raw ? (JSON.parse(raw) as { code: string; tries: number }) : null;
  if (!stored || stored.tries >= 5) throw E.badRequest("The code has expired. Please request a new one.", "কোডের মেয়াদ শেষ। নতুন কোড চান।");
  if (!safeEqualStr(stored.code, b.code)) {
    await c.env.KV.put(key, JSON.stringify({ ...stored, tries: stored.tries + 1 }), { expirationTtl: 600 });
    await loginFailed(c, b.phone, "sms_code");
    throw E.badRequest("The code is not correct.", "কোডটি সঠিক নয়।");
  }
  await c.env.KV.delete(key);
  const a = await c.env.DB.prepare(`${selectAdmin} phone = ?`).bind(b.phone).first<AdminRow>();
  if (!a || !a.is_active || !ROLES_WITH_PHONE_LOGIN.includes(a.role)) throw E.forbidden();
  const session = await startSession(c, a, false);
  return c.json({ admin: session, permissions: ROLE_MATRIX[a.role], needs2fa: false });
});

app.post("/logout", async (c) => {
  const token = getCookie(c, ADMIN_COOKIE);
  if (token) await c.env.KV.delete(`s:a:${token}`);
  deleteCookie(c, ADMIN_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

app.get("/me", requireAdmin, async (c) => {
  const a = c.get("admin")!;
  const row = await c.env.DB.prepare("SELECT phone, totp_enabled FROM admins WHERE id = ?").bind(a.id).first<{ phone: string | null; totp_enabled: number }>();
  return c.json({ admin: { ...a, phone: row?.phone ?? null, totp_enabled: Boolean(row?.totp_enabled) }, permissions: ROLE_MATRIX[a.role], needs2fa: Boolean(a.needs2fa) });
});

app.put("/me", requireAdmin, async (c) => {
  const b = await body(c, z.object({ name: z.string().trim().min(1).max(80), currentPassword: z.string().optional(), newPassword: z.string().min(10).max(128).optional() }));
  const a = c.get("admin")!;
  if (b.newPassword) {
    const row = await c.env.DB.prepare("SELECT password_hash FROM admins WHERE id = ?").bind(a.id).first<{ password_hash: string | null }>();
    if (row?.password_hash && !(await verifyPassword(b.currentPassword ?? "", row.password_hash))) throw E.badRequest("Current password is incorrect.", "বর্তমান পাসওয়ার্ড সঠিক নয়।");
    await c.env.DB.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").bind(await hashPassword(b.newPassword), a.id).run();
  }
  await c.env.DB.prepare(`UPDATE admins SET name = ?, updated_at = ${SQL_NOW} WHERE id = ?`).bind(b.name, a.id).run();
  const token = getCookie(c, ADMIN_COOKIE)!;
  await c.env.KV.put(`s:a:${token}`, JSON.stringify({ ...a, name: b.name }), { expirationTtl: ADMIN_TTL });
  await audit(c, "update", "profile", a.id, { passwordChanged: Boolean(b.newPassword) });
  return c.json({ ok: true, en: "Profile saved.", bn: "প্রোফাইল সংরক্ষণ করা হয়েছে।" });
});

// ---------- Two-factor (authenticator app) ----------
app.post("/2fa/setup", requireAdmin, async (c) => {
  const a = c.get("admin")!;
  const secret = newTotpSecret();
  await c.env.KV.put(`totp:pending:${a.id}`, secret, { expirationTtl: 900 });
  const label = encodeURIComponent(`${BRAND.name.en}:${a.email}`);
  const otpauth = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(BRAND.name.en)}&algorithm=SHA1&digits=6&period=30`;
  return c.json({ secret, otpauth });
});

app.post("/2fa/enable", requireAdmin, async (c) => {
  const a = c.get("admin")!;
  const { code } = await body(c, z.object({ code: z.string().trim() }));
  const secret = await c.env.KV.get(`totp:pending:${a.id}`);
  if (!secret) throw E.badRequest("Setup timed out. Please start again.", "সেটআপের সময় শেষ। আবার শুরু করুন।");
  if (!(await verifyTotp(secret, code.replace(/\s/g, "")))) {
    throw new ApiError(422, "validation", "That code didn't match. Try the newest code in the app.", "কোডটি মেলেনি। অ্যাপের নতুন কোডটি দিন।", [{ field: "code", en: "Incorrect code", bn: "কোড সঠিক নয়" }]);
  }
  await c.env.DB.prepare(`UPDATE admins SET totp_secret = ?, totp_enabled = 1, updated_at = ${SQL_NOW} WHERE id = ?`).bind(secret, a.id).run();
  await c.env.KV.delete(`totp:pending:${a.id}`);
  const token = getCookie(c, ADMIN_COOKIE)!;
  const { needs2fa: _n, ...rest } = a;
  await c.env.KV.put(`s:a:${token}`, JSON.stringify(rest), { expirationTtl: ADMIN_TTL });
  await audit(c, "2fa_enabled", "admin", a.id);
  return c.json({ ok: true, permissions: ROLE_MATRIX[a.role], en: "Two-step sign-in is on. Keep your phone safe.", bn: "দুই-ধাপের সাইন-ইন চালু হয়েছে। ফোনটি নিরাপদে রাখুন।" });
});

app.post("/2fa/disable", requireAdmin, async (c) => {
  const a = c.get("admin")!;
  if (ROLES_REQUIRING_2FA.includes(a.role)) throw E.badRequest("Two-step sign-in is required for your role.", "আপনার রোলের জন্য দুই-ধাপের সাইন-ইন বাধ্যতামূলক।");
  await c.env.DB.prepare("UPDATE admins SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?").bind(a.id).run();
  await audit(c, "2fa_disabled", "admin", a.id);
  return c.json({ ok: true });
});

/** Creates the first Super Admin. Works only while the admins table is empty and BOOTSTRAP_TOKEN matches. */
app.post("/bootstrap", async (c) => {
  await rateLimit(c, "bootstrap", 5, 3600);
  const b = await body(c, z.object({ token: z.string().min(16), name: z.string().trim().min(1).max(80), email: adminLoginId, password: z.string().min(10).max(128) }));
  if (!c.env.BOOTSTRAP_TOKEN || !safeEqualStr(b.token, c.env.BOOTSTRAP_TOKEN)) throw E.forbidden();
  const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM admins").first<{ n: number }>();
  if ((n?.n ?? 0) > 0) throw E.conflict("An admin already exists. Sign in instead.", "অ্যাডমিন আগেই তৈরি করা আছে। সাইন ইন করুন।");
  await c.env.DB.prepare("INSERT INTO admins (name, email, password_hash, role) VALUES (?, ?, ?, 'super_admin')").bind(b.name, b.email, await hashPassword(b.password)).run();
  return c.json({ ok: true, en: "Super Admin created. Sign in to finish two-step setup, then remove BOOTSTRAP_TOKEN.", bn: "সুপার অ্যাডমিন তৈরি হয়েছে। সাইন ইন করে দুই-ধাপের সেটআপ শেষ করুন।" }, 201);
});

export default app;
