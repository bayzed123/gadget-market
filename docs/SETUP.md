# Setup — local development, Cloudflare, GitHub and going live

## 1. Requirements

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 (20+ works) | `nvm install 22` |
| Wrangler | 4.x | installed as a project dependency — always run `npx wrangler …` |
| Cloudflare account | free plan is enough to start | Workers, D1, KV; R2 must be enabled once in the dashboard |
| GitHub repository | — | holds the code and runs the deploy |

Every `wrangler` command in this project needs `-c worker/wrangler.toml` (the npm scripts already pass it).

## 2. Local development

```bash
npm ci
cp worker/.dev.vars.example worker/.dev.vars     # ENVIRONMENT=development, PUBLIC_URL, BOOTSTRAP_TOKEN …
npm run build                                   # dist/ (storefront + admin) and dist-seed/seed.sql
npm run db:migrate:local                        # creates the local D1 in .wrangler/
npm run db:seed:local                           # categories, zones, settings, banners, sample products, combo bundles, stock lots, sample serial numbers, trust-badge types, buying guides
node scripts/create-admin.mjs "Owner" owner super_admin 'A-Long-Password-123' > .admin.sql
npx wrangler d1 execute DB --local -c worker/wrangler.toml --file=.admin.sql && rm .admin.sql
npm run dev                                     # http://localhost:8787 and /admin/
```

- The first sign-in as Super Admin asks you to set up two-step sign-in: scan the QR code with Google Authenticator (or any authenticator app) and type the 6-digit code.
- Staff with phone sign-in: `node scripts/create-admin.mjs "Rahim" rahim order_processor 01XXXXXXXXX`.
- In development, SMS codes appear on screen (`DEV code: 123456`); nothing is sent.
- Local `.dev.vars` can hold test keys (e.g. Turnstile's always-pass test keys shown in the example). **Never commit it** — it's in `.gitignore`.
- After editing files in `public/` or `admin/`, run `npm run build` again (or restart `npm run dev`).

| Command | What it does |
|---|---|
| `npm run typecheck` | build + `tsc --noEmit` |
| `npm test` | Vitest (unit + integration) in the Workers runtime with local D1/KV/R2 |
| `npm run test:e2e` | Playwright on a fresh local database (Pixel 5 + desktop). In a sandbox with a preinstalled Chromium set `PW_CHROMIUM_PATH` |
| `node scripts/render-gadget.mjs` | re-render the starter product photos (needs Chromium; set `PW_CHROMIUM_PATH`) |
| `npm run geo` | rebuild `public/data/bd-geo.json` from a sibling checkout of `bayeziddev/Bangladesh-geocode` |

## 3. Cloudflare + GitHub (automatic — recommended)

1. **Create an API token** — Cloudflare dashboard → My Profile → API Tokens → *Create Token* → template **Edit Cloudflare Workers**, then add the permissions **D1: Edit**, **Workers KV Storage: Edit** and **Workers R2 Storage: Edit** for your account.
2. **Enable R2 once** — dashboard → R2 → *Enable*. (Without it, photos and certificate documents fall back to KV.)
3. **Add repository secrets** — GitHub → Settings → Secrets and variables → Actions → *New repository secret*:

   | Secret | Required | Purpose |
   |---|---|---|
   | `CLOUDFLARE_API_TOKEN` | ✅ | the token from step 1 |
   | `CLOUDFLARE_ACCOUNT_ID` | ✅ | dashboard → Workers & Pages → right sidebar |
   | `ADMIN_USERNAME`, `ADMIN_PASSWORD` (≥ 10 chars), `ADMIN_NAME` | recommended | first Super Admin, created on the first deploy only |

4. Optional repository **variables** (same page, *Variables* tab): `WORKER_NAME` (default `gadget-market`), `PUBLIC_URL` (e.g. `https://gadgetmarket.com.bd`).
5. **Push to `main`.** Three workflows in `.github/workflows/` take it from there:
   - **CI** (`ci.yml`, every push and pull request) builds, type-checks and runs Vitest and Playwright.
   - **Deploy** (`deploy.yml`) starts when CI passes on `main` (or by hand: *Actions → Deploy → Run workflow*) and deploys exactly the commit CI tested:
     - `scripts/provision.mjs` finds or creates D1 `gadget-market-db`, KV `gadget-market-kv` and R2 `gadget-market-media`, writes their IDs into `worker/wrangler.toml` (in the runner only), applies migrations, seeds the database **only when it has no categories yet**, and creates the first Super Admin **only when there is none**;
     - `wrangler deploy`, then `scripts/sync-secrets.mjs` copies any integration secrets you added to GitHub into the Worker;
     - smoke-tests `/api/health`, runs the doctor, and prints the store and admin URLs in the run summary.
   - **Doctor** (`doctor.yml`) runs every morning at 08:17 Bangladesh time and by hand. It is read-only and checks:
     - the GitHub secrets, and whether the Cloudflare token is valid and has the Workers, D1, KV and R2 permissions;
     - that the Worker, database, KV and R2 exist, and that every migration is applied;
     - the starter data, delivery zones, Super Admin and low stock, plus which Worker secrets are set;
     - the live storefront, admin, API, a product page and photo, the delivery fee, robots.txt, the sitemap and the security headers.

     Each problem comes with the exact fix, in the run's *Summary* tab. A failed scheduled run emails the repository owner. Run it locally with `CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… node scripts/doctor.mjs`, or `SITE_URL=https://… node scripts/doctor.mjs --live-only` for the website checks only.

Pull requests run CI only; nothing is deployed until merge. Use GitHub's *production* environment protection rules if you want a manual approval before deploys. **If a deploy fails, run Doctor first**: it names the missing permission, resource or migration.

## 4. Manual setup (alternative)

```bash
npx wrangler login
npx wrangler d1 create gadget-market-db               # copy database_id into worker/wrangler.toml
npx wrangler kv namespace create gadget-market-kv     # copy id into [[kv_namespaces]]
npx wrangler r2 bucket create gadget-market-media
npm run build
npm run db:migrate:remote
npm run db:seed:remote                                # once, on an empty database
node scripts/create-admin.mjs "Owner" owner super_admin 'A-Long-Password-123' > .admin.sql
npx wrangler d1 execute DB --remote -c worker/wrangler.toml --file=.admin.sql && rm .admin.sql
npm run deploy
npx wrangler secret put SMS_API_KEY -c worker/wrangler.toml   # repeat for each integration you use
```

## 5. Integration secrets

Add them as GitHub secrets (synced on deploy) **or** directly with `npx wrangler secret put NAME -c worker/wrangler.toml`.
None is required — COD and manual bKash/Nagad/Rocket work without any. The dashboard Health Check shows what's connected.

| Feature | Secrets |
|---|---|
| SMS (OTP, order messages, recovery messages, review requests) | `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID` |
| WhatsApp Cloud API | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` |
| bKash Tokenized Checkout | `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_BASE_URL` |
| Nagad (reserved) | `NAGAD_MERCHANT_ID`, `NAGAD_MERCHANT_PRIVATE_KEY`, `NAGAD_PG_PUBLIC_KEY` |
| SSLCommerz (cards) | `SSLCZ_STORE_ID`, `SSLCZ_STORE_PASSWD`, `SSLCZ_SANDBOX` (`true` while testing) |
| Steadfast | `STEADFAST_API_KEY`, `STEADFAST_SECRET_KEY`, `STEADFAST_WEBHOOK_TOKEN` |
| Pathao | `PATHAO_CLIENT_ID`, `PATHAO_CLIENT_SECRET`, `PATHAO_USERNAME`, `PATHAO_PASSWORD`, `PATHAO_STORE_ID`, `PATHAO_WEBHOOK_SECRET` |
| RedX (reserved) | `REDX_API_TOKEN` |
| Courier fraud check | `FRAUD_CHECK_API_URL` (the phone is sent as `?phone=`), `FRAUD_CHECK_API_KEY` (sent as a Bearer token) |
| Meta Conversions API | `META_CAPI_TOKEN`, optional `META_TEST_EVENT_CODE` (remove after testing) |
| GA4 Measurement Protocol (reserved — GA4 currently runs in the browser) | `GA4_API_SECRET` |
| Web push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:you@…`) |
| Bot protection | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` |
| First admin without CI | `BOOTSTRAP_TOKEN` — then `POST /api/admin/auth/bootstrap`; delete the secret afterwards |

Non-secret IDs (Meta Pixel ID, GA4 ID, Google Ads ID/label, Clarity ID, Cloudflare Web Analytics token) are entered in
**Admin → Settings → Ads & tracking**.

**Webhook URLs to register with providers:** Steadfast `https://<domain>/api/webhooks/steadfast` (Bearer = `STEADFAST_WEBHOOK_TOKEN`),
Pathao `https://<domain>/api/webhooks/pathao` (signature = `PATHAO_WEBHOOK_SECRET`), WhatsApp `https://<domain>/api/webhooks/whatsapp`
(verify token = `WHATSAPP_VERIFY_TOKEN`), SSLCommerz IPN `https://<domain>/api/payments/sslcommerz/ipn`.

## 6. Custom domain

1. Add the domain to Cloudflare (dashboard → *Add a site*) and switch the registrar's nameservers to Cloudflare's.
2. In `worker/wrangler.toml` uncomment the `routes` block (`gadgetmarket.com.bd` and `www.gadgetmarket.com.bd`, `custom_domain = true`).
3. Set the repository variable `PUBLIC_URL=https://gadgetmarket.com.bd` and push — links in SMS, feeds, sitemap and canonical tags use it.
4. SSL/TLS mode **Full (strict)**; turn on *Always Use HTTPS*. HSTS is sent by the Worker in production.
5. Submit `https://gadgetmarket.com.bd/sitemap.xml` in Google Search Console and `/feeds/google.xml` in Merchant Center.

## 7. Go-live checklist

- [ ] Shop name, phone, WhatsApp, the Dhaka address and hours (Admin → Settings → Store information) — the dashboard checklist guides this.
- [ ] Delivery zones and fees checked (Admin → Delivery zones).
- [ ] Payment methods: COD on; bKash/Nagad receiving numbers entered or APIs connected.
- [ ] SMS gateway connected (needed for OTP — without it, COD orders always need a confirmation call).
- [ ] Sample products replaced with real ones (real photos, the composition exactly as printed, traditional use in "traditionally used for" wording, sizes and prices); certificates attached only where you truly hold them (Admin → Certifications) — without a document no badge shows.
- [ ] Sample stock replaced: in *Inventory → Stock lots* write off the sample lots and receive your real stock with its supplier invoice numbers (and serial numbers for high-value items under *Inventory → Serial numbers*); the sample serials can be marked faulty or left unsold.
- [ ] Warranty terms (Settings → Store information) match your suppliers' terms, in English and Bangla; every product's warranty months checked; return policy reviewed for opened items.
- [ ] Combo bundles: contents, price (it must save money) and stock checked (Admin → Products → *Bundles only*); gadget-finder results look right for each device; spec sheets complete (Admin → Products → *No spec sheet* shows none).
- [ ] Product photos are your own or licensed for commercial use — not copied from Pinterest or other shops.
- [ ] Staff accounts created with the right roles; Super Admin and Manager have 2FA.
- [ ] Meta Pixel / CAPI, GA4, Clarity IDs entered; test with `META_TEST_EVENT_CODE`, then remove it.
- [ ] A test order placed, confirmed (invoice PDF opens, with the lot to pack and the serial number assigned), shipped and delivered end to end.
- [ ] *Settings → Connected services & backups → Back up now* succeeds; nightly backups appear in R2 `backups/`.
