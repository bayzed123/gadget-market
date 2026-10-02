#!/usr/bin/env node
/**
 * Doctor — a read-only health check of the whole shop: GitHub secrets, the Cloudflare API token and its
 * permissions, the D1 / KV / R2 resources, database migrations and first-run data, the deployed Worker and
 * its secrets, and the live storefront + admin + API. Every problem is printed with the exact fix.
 *
 *   node scripts/doctor.mjs                         # everything (needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
 *   SITE_URL=https://shop.example node scripts/doctor.mjs --live-only
 *
 * Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, WORKER_NAME (default from worker/wrangler.toml),
 *      SITE_URL or PUBLIC_URL (default https://<worker>.<your-subdomain>.workers.dev), CF_API_BASE (tests only).
 * Nothing is changed and no secret value is ever printed. Exits 1 when any check fails (warnings don't fail).
 * In GitHub Actions the report is also written to the job summary.
 */
import { appendFileSync, readdirSync, readFileSync } from "node:fs";

const TOML = readFileSync("worker/wrangler.toml", "utf8");
const BRAND_NAME = JSON.parse(readFileSync("worker/src/brand.json", "utf8")).name.en;
const WORKER = process.env.WORKER_NAME || /^name\s*=\s*"([^"]+)"/m.exec(TOML)?.[1] || "gadget-market";
const DB_NAME = `${WORKER}-db`;
const KV_TITLE = `${WORKER}-kv`;
const BUCKET = `${WORKER}-media`;
const API = (process.env.CF_API_BASE || "https://api.cloudflare.com/client/v4").replace(/\/$/, "");
const TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const LIVE_ONLY = process.argv.includes("--live-only");
const TOKENS_PAGE = "dash.cloudflare.com → My Profile → API Tokens → edit the token";
const SECRETS_PAGE = "GitHub → Settings → Secrets and variables → Actions";

const rows = []; // { section, status: "ok" | "warn" | "fail", check, detail, fix }
let section = "";
const add = (status, check, detail = "", fix = "") => {
  rows.push({ section, status, check, detail, fix });
  const icon = { ok: "✅", warn: "⚠️ ", fail: "❌" }[status];
  console.log(`  ${icon} ${check}${detail ? ` — ${detail}` : ""}`);
  if (fix && status !== "ok") console.log(`       ↳ fix: ${fix}`);
};
const heading = (name) => {
  section = name;
  console.log(`\n${name}`);
};

/** Cloudflare REST call. Resolves to { ok, status, result, error } and never throws. */
async function cf(path, init = {}) {
  try {
    const res = await fetch(API + path, { ...init, headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", ...init.headers } });
    const body = await res.json().catch(() => ({}));
    const error = (body.errors ?? []).map((e) => `${e.code} ${e.message}`).join("; ") || (res.ok ? "" : `HTTP ${res.status}`);
    return { ok: res.ok && body.success !== false, status: res.status, result: body.result, error };
  } catch (e) {
    return { ok: false, status: 0, result: null, error: e.message };
  }
}

async function d1Query(uuid, sql) {
  const r = await cf(`/accounts/${ACCOUNT}/d1/database/${uuid}/query`, { method: "POST", body: JSON.stringify({ sql }) });
  if (!r.ok) throw new Error(r.error);
  return r.result?.[0]?.results ?? [];
}

// ---------------------------------------------------------------- GitHub secrets
heading("GitHub secrets");
if (TOKEN) add("ok", "CLOUDFLARE_API_TOKEN is set");
else add(LIVE_ONLY ? "warn" : "fail", "CLOUDFLARE_API_TOKEN is missing", "", `${SECRETS_PAGE} → New repository secret (a Cloudflare API token)`);
if (ACCOUNT) add(/^[0-9a-f]{32}$/i.test(ACCOUNT) ? "ok" : "fail", "CLOUDFLARE_ACCOUNT_ID is set", /^[0-9a-f]{32}$/i.test(ACCOUNT) ? "" : "it should be 32 hex characters", "Copy the Account ID from the right side of the Cloudflare dashboard home page");
else add(LIVE_ONLY ? "warn" : "fail", "CLOUDFLARE_ACCOUNT_ID is missing", "", `${SECRETS_PAGE} → New repository secret`);
if ("ADMIN_USERNAME" in process.env || "ADMIN_PASSWORD" in process.env) {
  const u = process.env.ADMIN_USERNAME ?? "", p = process.env.ADMIN_PASSWORD ?? "";
  if (u && p) add(p.length >= 10 ? "ok" : "fail", "ADMIN_USERNAME / ADMIN_PASSWORD set", p.length >= 10 ? "used only to create the first Super Admin" : "password is shorter than 10 characters", "Use a password of at least 10 characters");
  else add("warn", "ADMIN_USERNAME / ADMIN_PASSWORD not both set", "only needed to create the first Super Admin", `${SECRETS_PAGE}`);
}

// ---------------------------------------------------------------- Cloudflare
let siteUrl = (process.env.SITE_URL || process.env.PUBLIC_URL || "").replace(/\/$/, "");
let db = null;
const canCloudflare = !LIVE_ONLY && TOKEN && ACCOUNT;
if (canCloudflare) {
  heading("Cloudflare token & permissions");
  let v = await cf("/user/tokens/verify");
  if (!v.ok) v = await cf(`/accounts/${ACCOUNT}/tokens/verify`);
  if (v.ok && v.result?.status === "active") add("ok", "API token is valid and active", v.result.expires_on ? `expires ${v.result.expires_on}` : "no expiry");
  else add("fail", "API token is not valid", v.result?.status ?? v.error, "Create a new token (template “Edit Cloudflare Workers”, plus D1 Edit) and replace the CLOUDFLARE_API_TOKEN secret");

  const acct = await cf(`/accounts/${ACCOUNT}`);
  add(acct.ok ? "ok" : "fail", "Token can open the account", acct.ok ? acct.result?.name ?? "" : acct.error, `Check CLOUDFLARE_ACCOUNT_ID, and in ${TOKENS_PAGE} → Account Resources → include this account`);

  const perm = (label, name) => `In ${TOKENS_PAGE} → Permissions → add “Account · ${name} · Edit”`;
  const scripts = await cf(`/accounts/${ACCOUNT}/workers/scripts`);
  add(scripts.ok ? "ok" : "fail", "Workers Scripts access", scripts.ok ? `${scripts.result?.length ?? 0} Worker(s) in the account` : scripts.error, perm("Workers", "Workers Scripts"));
  const d1s = await cf(`/accounts/${ACCOUNT}/d1/database?per_page=100`);
  add(d1s.ok ? "ok" : "fail", "D1 access", d1s.ok ? "" : d1s.error, perm("D1", "D1"));
  const kvs = await cf(`/accounts/${ACCOUNT}/storage/kv/namespaces?per_page=100`);
  add(kvs.ok ? "ok" : "fail", "Workers KV access", kvs.ok ? "" : kvs.error, perm("KV", "Workers KV Storage"));
  const r2 = await cf(`/accounts/${ACCOUNT}/r2/buckets`);
  add(r2.ok ? "ok" : "warn", "R2 access", r2.ok ? "" : `${r2.error} — photos are then stored in KV`, `Enable R2 once (Cloudflare dashboard → R2), then ${TOKENS_PAGE} → add “Account · Workers R2 Storage · Edit”`);

  heading("Cloudflare resources");
  const worker = scripts.ok ? scripts.result?.find((s) => s.id === WORKER) : null;
  if (scripts.ok) add(worker ? "ok" : "fail", `Worker “${WORKER}” is deployed`, worker ? `last modified ${worker.modified_on}` : "not found", "Run the Deploy workflow (Actions → Deploy → Run workflow)");
  if (d1s.ok) {
    db = d1s.result?.find((d) => d.name === DB_NAME) ?? null;
    add(db ? "ok" : "fail", `D1 database “${DB_NAME}”`, db ? `${db.uuid}${db.file_size ? `, ${(db.file_size / 1024 / 1024).toFixed(1)} MB` : ""}` : "not found", "Run the Deploy workflow — it creates the database");
  }
  if (kvs.ok) {
    const kv = kvs.result?.find((k) => k.title === KV_TITLE || k.title === `${WORKER}-${KV_TITLE}`);
    add(kv ? "ok" : "fail", `KV namespace “${KV_TITLE}”`, kv ? kv.id : "not found", "Run the Deploy workflow — it creates the namespace");
  }
  if (r2.ok) {
    const b = (r2.result?.buckets ?? r2.result ?? []).find?.((x) => x.name === BUCKET);
    add(b ? "ok" : "warn", `R2 bucket “${BUCKET}”`, b ? "" : "not found — photos are stored in KV", "Run the Deploy workflow after enabling R2");
  }
  if (worker) {
    const sec = await cf(`/accounts/${ACCOUNT}/workers/scripts/${WORKER}/secrets`);
    if (sec.ok) {
      const names = (sec.result ?? []).map((s) => s.name);
      add("ok", "Worker secrets", names.length ? `${names.length} set: ${names.sort().join(", ")}` : "none (Cash on Delivery works without any)");
      if (names.includes("BOOTSTRAP_TOKEN")) add("warn", "BOOTSTRAP_TOKEN is still set", "only needed before the first admin exists", `Delete it from ${SECRETS_PAGE} and from the Worker (Cloudflare → Workers → ${WORKER} → Settings → Variables)`);
    } else add("warn", "Could not list Worker secrets", sec.error);
    if (!siteUrl) {
      const sub = await cf(`/accounts/${ACCOUNT}/workers/subdomain`);
      if (sub.ok && sub.result?.subdomain) siteUrl = `https://${WORKER}.${sub.result.subdomain}.workers.dev`;
    }
  }

  if (db) {
    heading("Database");
    try {
      const applied = new Set((await d1Query(db.uuid, "SELECT name FROM d1_migrations")).map((r) => r.name));
      const files = readdirSync("worker/migrations").filter((f) => f.endsWith(".sql")).sort();
      const pending = files.filter((f) => !applied.has(f));
      add(pending.length ? "fail" : "ok", "Migrations", pending.length ? `not applied yet: ${pending.join(", ")}` : `all ${files.length} applied`, "Run the Deploy workflow — it applies migrations before deploying");
      const [c] = await d1Query(
        db.uuid,
        `SELECT (SELECT COUNT(*) FROM categories WHERE deleted_at IS NULL) AS categories,
                (SELECT COUNT(*) FROM categories WHERE deleted_at IS NULL AND is_active = 1) AS active_categories,
                (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL AND status = 'active') AS products,
                (SELECT COUNT(*) FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.deleted_at IS NULL AND p.status = 'active' AND v.stock <= v.low_stock_threshold) AS low_stock,
                (SELECT COUNT(*) FROM delivery_zones WHERE is_active = 1) AS zones,
                (SELECT COUNT(*) FROM admins WHERE is_active = 1) AS admins,
                (SELECT COUNT(*) FROM admins WHERE is_active = 1 AND role = 'super_admin') AS super_admins,
                (SELECT COUNT(*) FROM orders) AS orders`,
      );
      add(c.categories > 0 ? "ok" : "fail", "Starter data", `${c.categories} categories (${c.active_categories} active), ${c.products} active products`, "Run the Deploy workflow — it seeds an empty database once");
      add(c.zones > 0 ? "ok" : "fail", "Delivery zones", `${c.zones} active`, "Admin → Delivery zones → add at least one (with “default” for the rest of Bangladesh)");
      add(c.super_admins > 0 ? "ok" : "fail", "Super Admin", `${c.admins} active staff, ${c.super_admins} Super Admin`, `Add ADMIN_USERNAME + ADMIN_PASSWORD in ${SECRETS_PAGE} and re-run Deploy`);
      add(c.low_stock > 0 ? "warn" : "ok", "Stock", c.low_stock ? `${c.low_stock} product option(s) at or below their low-stock level` : "no low-stock items", "Admin → Inventory & stock");
      add("ok", "Orders so far", String(c.orders));
    } catch (e) {
      add("fail", "Could not read the database", e.message, `In ${TOKENS_PAGE} → add “Account · D1 · Edit”`);
    }
  }
}

// ---------------------------------------------------------------- Live site
heading("Live shop");
if (!siteUrl) {
  add(LIVE_ONLY ? "fail" : "warn", "No site address to test", "", "Set the SITE_URL input / PUBLIC_URL repository variable, or add the Cloudflare secrets so the workers.dev address can be found");
} else {
  console.log(`  ${siteUrl}`);
  const get = async (path, accept = "*/*") => {
    const t = Date.now();
    try {
      const res = await fetch(siteUrl + path, { headers: { accept, "user-agent": `${WORKER}-doctor` }, redirect: "follow" });
      const text = await res.text();
      return { res, text, ms: Date.now() - t };
    } catch (e) {
      return { res: null, text: "", ms: Date.now() - t, error: e.cause?.code ?? e.message };
    }
  };
  const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
  // Right after a deploy the new version may not have reached every Cloudflare location yet (a first workers.dev
  // deploy can answer 404 for about a minute). When DOCTOR_WAIT_SECONDS is set, wait until the health check and the
  // storefront both answer three times in a row before judging the live site.
  const waitFor = Number(process.env.DOCTOR_WAIT_SECONDS ?? 0);
  if (waitFor > 0) {
    const until = Date.now() + waitFor * 1000;
    let good = 0;
    while (good < 3 && Date.now() < until) {
      const [a, b] = await Promise.all([get("/api/health"), get("/")]);
      good = a.res?.ok && json(a.text)?.ok === true && b.res?.ok ? good + 1 : 0;
      if (good < 3) await new Promise((r) => setTimeout(r, 3000));
    }
    if (good < 3) console.log(`  (the site was still settling after ${waitFor}s — results below may show a deploy in progress)`);
  }
  const page = async (label, path, test, fix) => {
    const r = await get(path);
    const ok = r.res?.ok && (!test || test(r));
    add(ok ? (r.ms > 3000 ? "warn" : "ok") : "fail", label, r.res ? `${r.res.status} in ${r.ms} ms${ok && r.ms > 3000 ? " (slow)" : ""}` : r.error, fix);
    return r;
  };

  const h = await page("Health check /api/health", "/api/health", (r) => json(r.text)?.ok === true, "Open the latest Deploy run and read the Deploy Worker step");
  const env = json(h.text)?.env;
  if (env && env !== "production") add("warn", "Worker environment", env, "ENVIRONMENT should be “production” in worker/wrangler.toml");
  const home = await page("Storefront /", "/", (r) => /<html/i.test(r.text) && /app\.js|type="module"/.test(r.text), "The dist/ assets did not deploy — re-run Deploy");
  if (home.res) {
    const hdr = (n) => home.res.headers.get(n);
    const missing = ["content-security-policy", "x-content-type-options", "referrer-policy"].filter((n) => !hdr(n));
    add(missing.length ? "warn" : "ok", "Security headers", missing.length ? `missing ${missing.join(", ")}` : "CSP, nosniff and referrer policy present");
    const hsts = h.res?.headers.get("strict-transport-security"); // sent by the Worker (API and dynamic pages)
    if (siteUrl.startsWith("https://")) add(hsts ? "ok" : "warn", "HSTS", hsts ?? "not sent", "ENVIRONMENT must be “production” for the Worker to send it");
  }
  await page("Admin dashboard /admin/", "/admin/", (r) => /<html/i.test(r.text), "The admin assets did not deploy — re-run Deploy");
  const cfg = await page("Store settings /api/config", "/api/config", (r) => Boolean(json(r.text)?.store), "Check the Worker logs (Cloudflare → Workers → Logs)");
  const cfgJ = json(cfg.text);
  if (cfgJ?.popup) add("ok", "Popup banner", `showing “${cfgJ.popup.title_en}”`);
  const homeApi = await page("Home page data /api/home", "/api/home", (r) => Array.isArray(json(r.text)?.banners), "Check the Worker logs; a missing migration shows up here as “no such column”");
  const banners = json(homeApi.text)?.banners ?? [];
  if (homeApi.res?.ok) add(banners.some((b) => b.placement === "hero") ? "ok" : "warn", "Banners", banners.length ? Object.entries(banners.reduce((m, b) => ({ ...m, [b.placement]: (m[b.placement] ?? 0) + 1 }), {})).map(([k, n]) => `${n} ${k}`).join(", ") : "none active", "Admin → Banners & logo → add a Hero slider banner");
  await page("Categories /api/categories", "/api/categories", (r) => (json(r.text)?.categories?.length ?? 0) > 0, "Admin → Categories → switch at least one category on");
  const list = await page("Product list /api/products", "/api/products?limit=4", (r) => (json(r.text)?.items?.length ?? 0) > 0, "Admin → Products → set at least one product to Active");
  const first = json(list.text)?.items?.[0];
  if (first) {
    await page(`Product page /product/${first.slug}`, `/product/${first.slug}`, (r) => r.text.includes(first.name_en) || r.text.includes(first.slug), "Check the Worker logs for the product route");
    const img = first.images?.[0];
    if (img) await page("Product photo", img.startsWith("http") ? new URL(img).pathname : img, null, "Re-upload the photo in Admin → Products");
  }
  await page("Delivery fee /api/delivery-fee", "/api/delivery-fee?division_id=6&district_id=47&upazila_id=9026&subtotal=500", (r) => typeof json(r.text)?.fee === "number", "Admin → Delivery zones → make sure a zone covers Dhaka and one is marked default");
  await page("robots.txt", "/robots.txt", (r) => /user-agent/i.test(r.text));
  await page("sitemap.xml", "/sitemap.xml", (r) => r.text.includes("<urlset"));
}

// ---------------------------------------------------------------- Summary
const fails = rows.filter((r) => r.status === "fail");
const warns = rows.filter((r) => r.status === "warn");
console.log(`\n${fails.length ? "❌" : warns.length ? "⚠️ " : "✅"} ${rows.length - fails.length - warns.length} passed, ${warns.length} warning(s), ${fails.length} problem(s)`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  let md = `## 🩺 ${BRAND_NAME} doctor\n\n**${fails.length ? "❌ Needs attention" : warns.length ? "⚠️ Working, with warnings" : "✅ All good"}** — ${rows.length - fails.length - warns.length} passed, ${warns.length} warning(s), ${fails.length} problem(s)${siteUrl ? ` · ${siteUrl}` : ""}\n`;
  for (const s of [...new Set(rows.map((r) => r.section))]) {
    md += `\n### ${s}\n\n| | Check | Result | How to fix |\n|---|---|---|---|\n`;
    for (const r of rows.filter((x) => x.section === s)) md += `| ${{ ok: "✅", warn: "⚠️", fail: "❌" }[r.status]} | ${esc(r.check)} | ${esc(r.detail)} | ${r.status === "ok" ? "" : esc(r.fix)} |\n`;
  }
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
process.exit(fails.length ? 1 : 0);
