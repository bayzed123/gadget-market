#!/usr/bin/env node
/**
 * Copies optional integration secrets from the environment (GitHub Actions secrets) into the
 * Cloudflare Worker, using `wrangler secret bulk`. Only names that are set are sent; nothing is printed.
 * Run after `wrangler deploy` (the Worker must exist).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";

export const WORKER_SECRETS = [
  "BOOTSTRAP_TOKEN", "BKASH_APP_KEY", "BKASH_APP_SECRET", "BKASH_USERNAME", "BKASH_PASSWORD", "BKASH_BASE_URL",
  "NAGAD_MERCHANT_ID", "NAGAD_MERCHANT_PRIVATE_KEY", "NAGAD_PG_PUBLIC_KEY", "SSLCZ_STORE_ID", "SSLCZ_STORE_PASSWD",
  "SSLCZ_SANDBOX", "STEADFAST_API_KEY", "STEADFAST_SECRET_KEY", "STEADFAST_WEBHOOK_TOKEN", "PATHAO_CLIENT_ID",
  "PATHAO_CLIENT_SECRET", "PATHAO_USERNAME", "PATHAO_PASSWORD", "PATHAO_STORE_ID", "PATHAO_WEBHOOK_SECRET",
  "REDX_API_TOKEN", "FRAUD_CHECK_API_URL", "FRAUD_CHECK_API_KEY", "SMS_API_URL", "SMS_API_KEY", "SMS_SENDER_ID",
  "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "RESEND_API_KEY",
  "EMAIL_FROM", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "META_CAPI_TOKEN", "META_TEST_EVENT_CODE",
  "GA4_API_SECRET", "TURNSTILE_SITE_KEY", "TURNSTILE_SECRET",
];

const present = Object.fromEntries(WORKER_SECRETS.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
const names = Object.keys(present);
if (!names.length) {
  console.log("• No optional integration secrets set in GitHub — skipping (COD + manual bKash/Nagad work without them).");
  process.exit(0);
}
const file = ".secrets.json";
writeFileSync(file, JSON.stringify(present), { mode: 0o600 });
try {
  execFileSync("npx", ["wrangler", "secret", "bulk", file, "-c", "worker/wrangler.toml"], { stdio: ["ignore", "ignore", "inherit"] });
  console.log(`✔ Synced ${names.length} Worker secret(s): ${names.join(", ")}`);
} finally {
  unlinkSync(file);
}
