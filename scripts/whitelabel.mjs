#!/usr/bin/env node
/**
 * White-label helper (see docs/WHITELABEL.md).
 *
 *   node scripts/whitelabel.mjs                    # where every brand setting lives right now (file:line + value)
 *   node scripts/whitelabel.mjs --find "Gadget Market"  # every remaining occurrence of an old name (repeatable flag)
 *
 * Line numbers move when files are edited, so the guide's numbers can always be refreshed with this script.
 * Read-only: nothing is changed.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const lines = (file) => readFileSync(join(ROOT, file), "utf8").split("\n");

/** [label, file, regex matched against each line] — the first match is reported. */
const SPOTS = [
  ["Shop identity (slug)", "worker/src/brand.json", /"slug":/],
  ["Shop name (English + Bangla)", "worker/src/brand.json", /"name":/],
  ["Tagline", "worker/src/brand.json", /"tagline":/],
  ["SEO description", "worker/src/brand.json", /"description":/],
  ["Domain", "worker/src/brand.json", /"domain":/],
  ["Default language", "worker/src/brand.json", /"defaultLang":/],
  ["Order number prefix", "worker/src/brand.json", /"orderPrefix":/],
  ["SKU prefix", "worker/src/brand.json", /"skuPrefix":/],
  ["Invoice prefix", "worker/src/brand.json", /"invoicePrefix":/],
  ["Address / city / map pin", "worker/src/brand.json", /"location":/],
  ["Phone / WhatsApp / email / hours", "worker/src/brand.json", /"contact":/],
  ["Social links", "worker/src/brand.json", /"social":/],
  ["Brand colours", "worker/src/brand.json", /"colors":/],
  ["Worker name", "worker/wrangler.toml", /^name\s*=/],
  ["Public URL (custom domain)", "worker/wrangler.toml", /^PUBLIC_URL\s*=/],
  ["D1 database name", "worker/wrangler.toml", /^database_name\s*=/],
  ["R2 bucket name", "worker/wrangler.toml", /^bucket_name\s*=/],
  ["Custom domain routes", "worker/wrangler.toml", /^# routes = \[|^routes = \[/],
  ["Nightly jobs schedule", "worker/wrangler.toml", /^crons\s*=/],
  ["Default Worker name in CI", ".github/workflows/deploy.yml", /WORKER_NAME:/],
  ["Default Worker name in Doctor", ".github/workflows/doctor.yml", /WORKER_NAME:/],
  ["Package name", "package.json", /"name":/],
  ["Storefront font (Google Fonts link)", "public/index.html", /fonts\.googleapis\.com\/css2/],
  ["Storefront font (CSS)", "public/css/store.css", /--font:/],
  ["Storefront accent colours", "public/css/store.css", /--accent:/],
  ["Admin font (Google Fonts link)", "admin/index.html", /fonts\.googleapis\.com\/css2/],
  ["Admin font (CSS)", "admin/css/admin.css", /font-family: "Inter"/],
  ["Top announcement bar (default)", "worker/src/lib/settings.ts", /announcement_en:/],
  ["Starter categories", "scripts/seed-data.mjs", /^export const categories/],
  ["Delivery zones & fees", "scripts/seed-data.mjs", /^export const zones/],
  ["Starter products", "scripts/seed-data.mjs", /^export const products/],
  ["Starter banners", "scripts/seed-data.mjs", /^export const banners/],
  ["Starter collections", "scripts/seed-data.mjs", /^export const collections/],
  ["Starter trust-badge types", "scripts/seed-data.mjs", /^export const certificationTypes/],
  ["Starter buying guides", "scripts/seed-data.mjs", /^export const posts/],
  ["Starter coupons", "scripts/seed-data.mjs", /^export const coupons/],
  ["Gift-box fee (default)", "worker/src/lib/settings.ts", /gift_wrap_fee:/],
  ["Dated-lot warning window (default)", "worker/src/lib/settings.ts", /expiry_alert_days:/],
  ["Warranty terms (default)", "worker/src/lib/claims.ts", /^export const DEFAULT_WARRANTY_NOTE/],
  ["Honest-copy rules", "worker/src/lib/claims.ts", /^const RULES/],
  ["Devices (\"works with\", finder)", "worker/src/lib/codes.ts", /^export const COMPATIBLE =/],
  ["Spec-sheet names (comparison rows)", "worker/src/lib/codes.ts", /^export const SPEC_KEYS/],
  ["Campaign landing pages", "scripts/seed-data.mjs", /^export const landingPages/],
];

/** Finds where a JS/JSON block that starts on `start` closes (matching brackets), for "from – to" ranges. */
function blockEnd(all, start) {
  let depth = 0;
  let seen = false;
  for (let i = start; i < all.length; i++) {
    for (const ch of all[i].replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "")) {
      if ("[{(".includes(ch)) { depth++; seen = true; }
      else if ("]})".includes(ch)) depth--;
    }
    if (seen && depth <= 0) return i;
  }
  return start;
}

const finds = process.argv.flatMap((a, i, arr) => (a === "--find" && arr[i + 1] ? [arr[i + 1]] : []));
if (!finds.length) {
  console.log("White-label settings — file:line (from–to) → current value\n");
  for (const [label, file, re] of SPOTS) {
    let all;
    try { all = lines(file); } catch { console.log(`  ${label.padEnd(36)} ${file} (missing)`); continue; }
    const i = all.findIndex((l) => re.test(l));
    if (i < 0) { console.log(`  ${label.padEnd(36)} ${file} (not found)`); continue; }
    const end = /[[{(]\s*$/.test(all[i].replace(/\/\/.*$/, "").trim()) || /= \[$/.test(all[i].trim()) ? blockEnd(all, i) : i;
    const where = end > i ? `${file}:${i + 1}–${end + 1}` : `${file}:${i + 1}`;
    const value = all[i].trim().replace(/\s+/g, " ").slice(0, 90);
    console.log(`  ${label.padEnd(36)} ${where.padEnd(42)} ${value}`);
  }
  console.log("\nImages to replace: public/img/logo.svg, public/img/icon-192.png, public/img/icon-512.png, public/favicon.ico,");
  console.log("                   public/img/og-cover.png (+ og-cover.svg), public/img/products/* (scripts/render-gadget/)");
  console.log('\nAfter renaming, run:  node scripts/whitelabel.mjs --find "Old Shop Name" --find "old-slug"');
  process.exit(0);
}

// ---- --find: list every remaining occurrence ----
const SKIP = new Set(["node_modules", "dist", "dist-seed", ".git", ".wrangler", "test-results", "playwright-report", "package-lock.json"]);
const TEXT = /\.(m?js|ts|json|toml|ya?ml|html|css|svg|md|sql|webmanifest|txt|example)$/;
let hits = 0;
function scan(dir) {
  for (const f of readdirSync(dir)) {
    if (SKIP.has(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { scan(p); continue; }
    if (!TEXT.test(f) && !f.startsWith(".dev.vars")) continue;
    const all = readFileSync(p, "utf8").split("\n");
    all.forEach((l, i) => {
      if (finds.some((s) => l.toLowerCase().includes(s.toLowerCase()))) {
        hits++;
        console.log(`${relative(ROOT, p)}:${i + 1}  ${l.trim().slice(0, 140)}`);
      }
    });
  }
}
scan(ROOT);
console.log(hits ? `\n${hits} line(s) still mention ${finds.map((s) => `“${s}”`).join(" / ")}` : `\n✅ No mentions of ${finds.map((s) => `“${s}”`).join(" / ")} left`);
