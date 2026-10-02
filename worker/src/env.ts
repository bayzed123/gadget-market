/** Cloudflare bindings + secrets. Secrets are set with `wrangler secret put NAME` (or GitHub secrets) — never committed. */
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  /** R2 bucket for photos, certificate documents and nightly backups. Optional: uploads fall back to KV. */
  MEDIA?: R2Bucket;
  ASSETS: Fetcher;
  /** Optional Workers AI binding for the gift recommender. */
  AI?: Ai;

  ENVIRONMENT: string; // "development" | "production"
  PUBLIC_URL: string; // e.g. https://gadgetmarket.com.bd

  /** One-time token that allows creating the first Super Admin through /api/admin/auth/bootstrap. */
  BOOTSTRAP_TOKEN?: string;

  // Payments (hosted redirects only — card numbers never touch this Worker)
  BKASH_APP_KEY?: string;
  BKASH_APP_SECRET?: string;
  BKASH_USERNAME?: string;
  BKASH_PASSWORD?: string;
  BKASH_BASE_URL?: string;
  NAGAD_MERCHANT_ID?: string;
  NAGAD_MERCHANT_PRIVATE_KEY?: string;
  NAGAD_PG_PUBLIC_KEY?: string;
  SSLCZ_STORE_ID?: string;
  SSLCZ_STORE_PASSWD?: string;
  SSLCZ_SANDBOX?: string; // "true" | "false"

  // Couriers
  STEADFAST_API_KEY?: string;
  STEADFAST_SECRET_KEY?: string;
  STEADFAST_WEBHOOK_TOKEN?: string;
  PATHAO_CLIENT_ID?: string;
  PATHAO_CLIENT_SECRET?: string;
  PATHAO_USERNAME?: string;
  PATHAO_PASSWORD?: string;
  PATHAO_STORE_ID?: string;
  PATHAO_WEBHOOK_SECRET?: string;
  REDX_API_TOKEN?: string;
  /** Courier-history lookup by phone (third-party aggregator); expected to return delivered/returned counts. */
  FRAUD_CHECK_API_URL?: string;
  FRAUD_CHECK_API_KEY?: string;

  // Notifications
  SMS_API_URL?: string;
  SMS_API_KEY?: string;
  SMS_SENDER_ID?: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  /** Web Push (VAPID). Public key: base64url uncompressed P-256 point. Private key: base64url "d". */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;

  // Marketing (server-side events)
  META_CAPI_TOKEN?: string;
  META_TEST_EVENT_CODE?: string;
  GA4_API_SECRET?: string;

  // Bot protection
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
}

export type Role = "super_admin" | "manager" | "order_processor" | "viewer";

export interface AdminSession {
  id: number;
  name: string;
  email: string;
  role: Role;
  /** True until a Super Admin / Manager finishes two-factor setup; only 2FA routes work meanwhile. */
  needs2fa?: boolean;
  /** Session start (ms). Sessions older than a password change / deactivation are rejected. */
  iat?: number;
}

export interface CustomerSession {
  id: number;
  name: string;
  phone: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    admin?: AdminSession;
    customer?: CustomerSession;
    lang: "bn" | "en";
  };
};
