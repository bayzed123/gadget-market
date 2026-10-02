// Shared helpers for the API tests (real Worker + local D1/KV/R2 through Miniflare).
import { expect } from "vitest";
import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { totpAt } from "../../worker/src/lib/crypto";
import adminLogin from "../fixtures/admin-login.request.json";

export const BASE = "https://shop.test";

export interface CallInit extends RequestInit {
  json?: unknown;
  cookie?: string;
  ip?: string;
  raw?: boolean;
}

let ipCounter = 10;
/** A fresh client IP per call keeps rate limits and IP velocity checks from interfering between tests. */
export const nextIp = () => `203.0.113.${ipCounter++ % 250}`;

export async function call(path: string, init: CallInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-requested-with", "fetch");
  headers.set("origin", BASE);
  headers.set("cf-connecting-ip", init.ip ?? nextIp());
  if (init.json !== undefined) headers.set("content-type", "application/json");
  if (init.cookie) headers.set("cookie", init.cookie);
  const res = await exports.default.fetch(new Request(BASE + path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body }));
  if (init.raw) return { res, data: null as any };
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { res, data };
}

export const cookieOf = (res: Response) => res.headers.get("set-cookie")!.split(";")[0]!;

/** Bootstraps the first Super Admin, signs in and completes the mandatory two-factor setup. */
export async function superAdmin(): Promise<string> {
  const b = await call("/api/admin/auth/bootstrap", { method: "POST", json: { token: "test-bootstrap-token-0123456789", name: "Owner", ...adminLogin } });
  expect([201, 409]).toContain(b.res.status);
  const secretRow = await env.DB.prepare("SELECT totp_secret FROM admins WHERE email = ?").bind(adminLogin.email).first<{ totp_secret: string | null }>();
  if (secretRow?.totp_secret) {
    const login = await call("/api/admin/auth/login", { method: "POST", json: { ...adminLogin, totp: await totpAt(secretRow.totp_secret, Math.floor(Date.now() / 30000)) } });
    expect(login.res.status).toBe(200);
    return cookieOf(login.res);
  }
  const login = await call("/api/admin/auth/login", { method: "POST", json: adminLogin });
  expect(login.res.status).toBe(200);
  expect(login.data.needs2fa).toBe(true);
  const cookie = cookieOf(login.res);
  const setup = await call("/api/admin/auth/2fa/setup", { method: "POST", cookie });
  const code = await totpAt(setup.data.secret, Math.floor(Date.now() / 30000));
  const en = await call("/api/admin/auth/2fa/enable", { method: "POST", cookie, json: { code } });
  expect(en.res.status).toBe(200);
  return cookie;
}

/** Verifies a phone at checkout (development mode returns the code in the response). */
export async function otpToken(phone: string): Promise<string> {
  const s = await call("/api/otp/send", { method: "POST", json: { phone } });
  expect(s.res.status).toBe(200);
  const v = await call("/api/otp/verify", { method: "POST", json: { phone, code: s.data.devCode } });
  expect(v.res.status).toBe(200);
  return v.data.otpToken;
}

export const address = {
  tangail: { division_id: 6, district_id: 44, upazila_id: 342, division: "Dhaka", district: "Tangail", upazila: "Tangail Sadar", area: "House 5, Victoria Road" },
  ghatail: { division_id: 6, district_id: 44, upazila_id: 336, division: "Dhaka", district: "Tangail", upazila: "Ghatail", area: "College Road, House 9" },
  mirpur: { division_id: 6, district_id: 47, upazila_id: 9026, division: "Dhaka", district: "Dhaka", upazila: "Mirpur", area: "House 12, Road 3, Section 10" },
  savar: { division_id: 6, district_id: 47, upazila_id: 365, division: "Dhaka", district: "Dhaka", upazila: "Savar", area: "Bank Colony, Road 2" },
  chattogram: { division_id: 1, district_id: 8, upazila_id: 65, division: "Chattagram", district: "Chattogram", upazila: "Rangunia", area: "Station Road, House 4" },
};

export async function variantId(sku: string): Promise<number> {
  const r = await env.DB.prepare("SELECT id FROM product_variants WHERE sku = ?").bind(sku).first<{ id: number }>();
  return r!.id;
}

export async function stockOf(sku: string): Promise<number> {
  const r = await env.DB.prepare("SELECT stock FROM product_variants WHERE sku = ?").bind(sku).first<{ stock: number }>();
  return r!.stock;
}

export async function setSetting(cookie: string, key: string, value: unknown) {
  const r = await call(`/api/admin/settings/${key}`, { method: "PUT", cookie, json: value });
  expect(r.res.status).toBe(200);
}
