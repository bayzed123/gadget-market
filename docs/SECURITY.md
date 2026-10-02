# Security, privacy & recovery

Scoped for a small Bangladeshi retail shop: one Cloudflare Worker, a handful of staff, customer names, phones and
addresses, and payments handled by hosted gateways. Organised by the six NIST Cybersecurity Framework 2.0 functions.

## Govern

| Item | Decision |
|---|---|
| Owner of security | the shop owner (Super Admin); the developer maintains the code and Cloudflare/GitHub access |
| Roles | Super Admin, Manager, Order Processor, Read-only Viewer — least privilege; permission matrix in [SPECIFICATION.md §20](SPECIFICATION.md#roles) |
| Accounts that touch money / customer data | Super Admin and Manager must use password + authenticator (TOTP) |
| Trust rule | trust badges (official brand warranty, BTRC approved, authorised distributor, QC tested …) show only with an attached document that is still in date — business-wide on the certification type or per product (`HELD_CERT_SQL`) |
| Honest urgency | stock counts come from real stock; the Deal of the Day countdown ends at the deal's real end date (midnight, Bangladesh time) and the sale price ends by itself that night (`endExpiredDeals`); no fake "people viewing" or resetting timers |
| Honest-copy rule | product, spec, bundle, collection, guide, banner, landing and settings copy, the CSV import and AI drafts are checked in English and Bangla for fabricated urgency ("only 2 left", "15 people viewing", "offer ends today") and promises a product can't keep ("lifetime warranty", "100% waterproof" without an IP rating, "unbreakable", "best in Bangladesh") and refused with a plain-language fix (`worker/src/lib/claims.ts`); the build fails if starter data breaks the rule |
| Warranty rule | every product shows its warranty in months next to the warranty terms (edited only in Settings → Store information, every change in the activity log); the warranty months are copied onto each order line, so later edits never change what a customer bought; claims are checked against the delivery date and the serial number sent |
| Stock rule | stock is received by lot (supplier invoice); dated lots (e.g. batteries) ship first-expiring-first and leave sellable stock when they expire; serial numbers are optional per unit and can be sold once; returned opened units are inspected before they go back on sale |
| Change control | all changes via GitHub pull requests; CI (type check + unit/integration + E2E) must pass before merge; deploy only from `main` |
| Reviews | quarterly: staff list and roles, GitHub/Cloudflare members, API tokens, secrets still needed |

## Identify

| Asset | Where | Sensitivity |
|---|---|---|
| Customer name, phone, address, email, order history | D1 `customers`, `addresses`, `orders` | personal data |
| Partial checkout data (abandoned) | D1 `abandoned_checkouts` | personal data, deleted after 30 days |
| Staff accounts, password hashes, TOTP secrets | D1 `admins` | credentials |
| Sessions, OTP codes, rate-limit counters | KV (short TTL) | credentials |
| Product photos, **certificate documents**, backups | R2 | backups contain personal data |
| Payment / courier / SMS / WhatsApp / Meta keys | Worker secrets, GitHub secrets | secrets |
| Card data | never stored or seen — SSLCommerz hosted page | out of scope (PCI SAQ-A style) |

Third parties receiving data: SMS gateway (phone + message), WhatsApp Cloud API, Resend (email), couriers (name, phone, address, COD amount),
courier fraud-check (phone), Meta CAPI (SHA-256-hashed phone/email), GA4/Clarity (browser analytics — mention in the privacy policy).

## Protect

**Identity & access**
- Passwords: PBKDF2-SHA-256, 100 000 iterations, 16-byte random salt, constant-time comparison; minimum 10 characters.
- TOTP (RFC 6238, 30 s, ±1 step) required for Super Admin and Manager before any other action works; a Super Admin can reset a lost authenticator for other staff (audited).
- Staff roles may sign in with phone + SMS code instead (4 codes/hour/phone, codes expire in 10 minutes, attempts limited).
- Sessions: 256-bit random tokens in `HttpOnly; Secure; SameSite=Strict` cookies, stored server-side in KV (staff 12 h, customers 30 days). Deactivating a staff member revokes their live sessions immediately.
- RBAC on every `/api/admin/*` route (`perm()`); hidden buttons are only a convenience.

**Application**
- CSRF: every state-changing request requires `X-Requested-With` and a same-origin `Origin`.
- Input validation with zod on every body and query; bilingual field errors; parameterised SQL everywhere (no string-built values).
- Output encoding: the storefront and admin render through an auto-escaping `html` template; JSON-LD is serialised safely.
- Headers: HSTS (production, preload), Content-Security-Policy (scripts only from self and the listed analytics/CDN hosts), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Content-Type-Options: nosniff`.
- Rate limits (KV, per IP or phone): staff sign-in 10/15 min, staff SMS code 5/15 min, customer sign-in 10/15 min, registration 5/h, SMS codes 4/h per phone and 10/h per IP, checkout 15/10 min, drafts 60/5 min, reviews 5/h, tracking and invoices 30/5 min, gadget finder 30/5 min, product questions 5/h, warranty claims 6/h, bootstrap 5/h.
- Cloudflare Turnstile on checkout, SMS-code requests, customer sign-in/registration and staff sign-in (when configured).
- Uploads: images (JPG/PNG/WebP/AVIF ≤ 5 MB) and certificate documents (also PDF, ≤ 10 MB) by type allow-list, random object names, served with the stored content type.
- Webhooks: Steadfast bearer token and Pathao signature compared in constant time; WhatsApp `X-Hub-Signature-256` HMAC checked; SSLCommerz IPN re-validated with the gateway before an order is marked paid; bKash payments executed/queried server-side.
- CSV exports prefix cells starting with `= + - @` so spreadsheets don't run them as formulas.
- Settings API refuses anything that looks like a secret — secrets live only in Wrangler / GitHub secrets.

**Data**
- Payments: hosted redirects only (SSLCommerz, bKash); the Worker never receives card numbers.
- Meta CAPI: phone (E.164) and email are SHA-256 hashed before sending.
- Abandoned-checkout data is purged automatically after the retention period (default 30 days).
- Customer order pages need the order's secret token or the phone number; tracking masks the phone.
- Secrets are never committed: `.dev.vars`, `.secrets.json`, `.admin.sql` are git-ignored; the CI writes secrets to a temp file with mode 600 and deletes it.

## Detect

- **Activity log** (Admin → Activity log): every create/update/delete/restore, status change, bulk action, refund, export, upload, backup, sign-in and failed sign-in, with staff name and IP. Exportable to CSV.
- **Health Check** strip shows failed Meta CAPI calls in the last 24 h and whether backups are running.
- **Notifications** bell: new orders, low stock, reviews, return requests. Unusual spikes of orders from one phone/address/IP are flagged on the order (velocity).
- **Cloudflare observability** is enabled (`[observability]` in `wrangler.toml`): Worker logs and errors in the dashboard; add a Cloudflare notification for Worker error-rate spikes.
- Weekly: skim the activity log for sign-ins at odd hours, exports you didn't expect, and refunds.

## Respond — incident plan

| Step | What to do | Who |
|---|---|---|
| 1. Contain | Staff account misused → Admin → Staff & roles → turn off *Can sign in* (sessions end at once). Suspected key leak → rotate the key at the provider, then `npx wrangler secret put NAME -c worker/wrangler.toml` (or update the GitHub secret and re-run the deploy). Cloudflare or GitHub account compromise → change password, revoke API tokens (Cloudflare → API Tokens; GitHub → Settings → Developer settings), enforce 2FA on both. | owner + developer |
| 2. Scope | Activity log (CSV export) for the time window; Cloudflare Worker logs; payment gateway and courier dashboards for unexpected refunds or consignments. | developer |
| 3. Fix | Patch via pull request (CI must pass), deploy from `main`. If data was altered, restore (below). | developer |
| 4. Notify | Tell affected customers plainly (SMS/WhatsApp) what happened and what to watch for; notify payment providers if payments are involved; follow the Bangladesh data-protection rules in force at the time. | owner |
| 5. Learn | Write a short note: what happened, how it was found, what changed. Add a test if it was a bug. | both |

Keep an up-to-date contact list (developer, Cloudflare account owner, bKash/SSLCommerz merchant support, courier account managers) outside the system.

## Recover — D1 backup & restore

Three layers:

1. **D1 Time Travel** (built in, 30 days on the paid plan / 7 days on free) — point-in-time restore of the whole database:
   ```bash
   npx wrangler d1 time-travel info DB -c worker/wrangler.toml                               # current bookmark
   npx wrangler d1 time-travel restore DB --timestamp=2026-09-30T08:00:00Z -c worker/wrangler.toml
   ```
   Best for "undo the last few hours" (a bad bulk change, an accidental import).
2. **Nightly JSON backup to R2** — a cron at 21:00 UTC (03:00 Bangladesh time) writes `backups/YYYY-MM-DD.json` (every table, including stock lots, serial numbers, warranty claims, product questions and guides) to the R2 bucket and keeps the newest 30. *Settings → Connected services & backups → Back up now* makes one on demand. Restore:
   ```bash
   npx wrangler r2 object get gadget-market-media/backups/2026-09-30.json --remote --file=backup.json -c worker/wrangler.toml
   node scripts/restore-backup.mjs backup.json > restore.sql      # empties those tables and re-inserts the rows
   npx wrangler d1 execute DB --remote -c worker/wrangler.toml --file=restore.sql
   rm backup.json restore.sql                                     # they contain customer data
   ```
   Tested locally: a backup restored into a freshly migrated database reproduced the order, item, SKU, counter and abandoned-checkout counts exactly.
3. **Off-platform copy** (monthly or before risky changes): `npx wrangler d1 export DB --remote --output=gadget-market-$(date +%F).sql -c worker/wrangler.toml` and keep it encrypted outside Cloudflare.

**Restore drill (every quarter):** restore the latest R2 backup into a local database (`--local --persist-to .wrangler/drill`) with the commands above and check order counts against the dashboard.

After any restore: run *Back up now*, check the Health Check strip, place and cancel a test order, and note the restore in the activity log.

## Certification integrity (part of security)

Badges such as *Certified organic*, *BSTI approved*, *Halal certified* or *Lab tested* are claims shoppers rely on. A badge
shows in the shop only when the shop **holds** that certificate:

- **Business-wide:** a document is attached to the certification type (Admin → Certifications), or
- **Per product:** a `certifications` row with its own `document_url`.

In both cases the certificate must be active and not past `valid_until`. Saving a badge without proof is allowed
(so the owner can prepare), but it never shows, and expired certificates drop off by themselves. The checks run in
`HELD_CERT_SQL` / `HELD_TYPE_SQL`, the storefront API, the JSON-LD and the product feeds, and an integration test covers
them. Certificates are never imported from CSV; each is attached by hand, and every upload is in the activity log.
