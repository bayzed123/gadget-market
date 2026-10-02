# Gadget Market · গ্যাজেট মার্কেট

Gadget and tech-accessories shop for **Dhaka, Bangladesh** — online store, spec comparison, a gadget finder, combo
bundles, warranty claims and a full admin dashboard on **one Cloudflare Worker** (Hono + TypeScript, D1, KV, R2),
deployed from GitHub Actions.

Bangla first, English on a toggle. Dark-first look: near-black (#0D0E12) surfaces, electric blue and cyan accents,
sharp 8px corners, glassy panels, Space Grotesk + Inter, JetBrains Mono for specs, SKUs and prices. Cash on Delivery
across Bangladesh.

| | |
|---|---|
| Shop | audio, wearables, power (power banks, chargers, cables), mobile accessories, gaming, smart home, computer accessories — 32 starter products (3 combo bundles), 54 SKUs |
| Location | Dhaka (placeholder address and phone — change them in Admin → Settings) |
| Hard rule | urgency is real: the Deal of the Day ends when it says, stock counts are the real ones, and copy with fake urgency or impossible promises ("only 2 left!", "lifetime warranty", "100% waterproof") can't be saved |

## What's inside

**For shoppers**
- Filters by **"works with"** (iPhone, Android, USB-C, laptop, Mac, Windows, PS5, Xbox, Switch, smart TV), category,
  brand, price, bundle or single product and live deals; sort by newest, popularity, price and rating. Search also
  looks inside spec sheets, so "65W" finds every 65-watt product.
- Product pages with a gallery, the **spec sheet**, "Works with" chips, key features, what's in the box, a
  **warranty badge with the warranty terms next to it**, real stock, quantity, add to cart / buy now, Q&A, reviews and
  related products.
- **Deal of the Day** with an honest countdown to the real end (midnight, Bangladesh time); the sale price ends by
  itself that night.
- **Spec comparison** of 2–3 products, rows lined up by spec name, differences highlighted.
- **Gadget finder** — pick your device and a budget → one in-stock essential from each shelf that works with it, plus
  matching combos.
- **Combo bundles** listing what's inside with the real saving; collections ("goes well with"), buying guides.
- Account: orders, wishlist, saved addresses, "buy again", returns and a **warranty-claim form tied to an order line**
  (checked against the warranty end date and the serial number we sent).
- Guest checkout with Division → District → Upazila, live delivery fee from Dhaka, gift box, SMS code, COD / bKash /
  Nagad / Rocket / cards.

**For the team (`/admin/`)** — dark, sidebar in the brief's order: Dashboard, Products, Categories, Orders, Customers,
Coupons, Warranty claims, Inventory, Reports, Staff & roles, Settings, Help.
- Dashboard KPIs: today's orders and sales, cash still to collect (COD), low stock, **open warranty claims**, combos
  sold; plus calls to make, payments to check, claims to handle and questions to answer.
- Products with auto SKUs `GAD-[Cat]-[Brand]-[Color]-[Seq]` (e.g. `GAD-EB-SON-BLK-0007`), a spec-sheet editor
  (standard names line up in the comparison), devices, key features, in the box, warranty months, Deal of the Day
  end date, colour / option variants, bundle contents, trust badges (shown only with a document on file), CSV
  import / export.
- **Warranty claims**: Submitted → Under review → Approved / Rejected → Resolved (repair, replace or refund), with a
  note for the customer (sent by SMS) and a staff note; a replaced unit's serial is retired.
- **Inventory**: stock lots by supplier invoice (optional expiry for dated items), and an optional **serial-number
  log** — serials are picked per order line when packing and printed on the invoice (`INV-GAD-YYYYMMDD-####`, PDF).
- Orders with fake-order protection (🟢 / 🟡 / 🔴), one-tap call / WhatsApp, abandoned-checkout recovery, Meta Pixel
  + Conversions API, GA4, Clarity, UTM attribution, campaign landing pages, reports (incl. warranty claims by product),
  roles (Super Admin, Manager, Order Processor, Viewer), two-step sign-in, activity log, nightly backups.

## Quick start (local)

```bash
npm ci
cp worker/.dev.vars.example worker/.dev.vars
npm run build && npm run db:migrate:local && npm run db:seed:local
node scripts/create-admin.mjs "Owner" owner super_admin 'A-Long-Password-123' > .admin.sql
npx wrangler d1 execute DB --local -c worker/wrangler.toml --file=.admin.sql && rm .admin.sql
npm run dev        # http://localhost:8787  and  http://localhost:8787/admin/
```

Tests: `npm run typecheck`, `npm test` (Vitest — 145 unit + integration tests in the Workers runtime),
`npm run test:e2e` (Playwright, phone + desktop: finder → product → COD checkout, staff confirmation, combos,
comparison, guides). A unit test runs every starter product, spec value, bundle, guide, collection and banner through
the honest-copy check, and the build refuses seed data that fails it or a bundle that doesn't save money.

## Deploy (GitHub → Cloudflare)

Add these **repository secrets** (GitHub → Settings → Secrets and variables → Actions), then push to `main`:

| Secret | |
|---|---|
| `CLOUDFLARE_API_TOKEN` | required — "Edit Cloudflare Workers" token plus D1, KV and R2 edit permissions |
| `CLOUDFLARE_ACCOUNT_ID` | required |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | the first Super Admin (created on the first deploy only) |

CI tests every push; the Deploy workflow creates the D1 database, KV namespace and R2 bucket if needed, applies the
migration, seeds an empty database once and deploys. Integrations (SMS, WhatsApp, bKash, SSLCommerz, Steadfast, Pathao,
Meta CAPI, Turnstile, Workers AI …) switch on when their secrets are added — see [docs/SETUP.md](docs/SETUP.md).
**No secrets are stored in this repository.**

## Photos

The starter product photos are **photoreal 3D studio renders** (`scripts/render-gadget/`: earbuds and cases,
headphones, speakers, watches and straps, power banks, GaN chargers, braided cables, phones in cases, controllers,
keyboards, smart plugs and bulbs …), not cartoon art and not copied from anywhere. The brands on them are fictional.
Before launch, upload photos of your real stock in **Admin → Products** — don't reuse photos from other shops or
brand sites unless you're licensed to.

## Before you launch — please check

These are placeholders I had to assume; change them in the admin:
- **Location & contact**: the shop address on New Elephant Road, phone `+8801700000000`, opening hours.
- **Delivery fees**: Dhaka City ৳70 (free over ৳3,000), Dhaka district ৳100 (free over ৳5,000), Dhaka division ৳120,
  elsewhere ৳130.
- **Starter catalogue**: brands (Sonix, Arcwave, Voltra, Shieldr, Nexplay, Lumio, Keyra) are **fictional**; products,
  specs, prices, warranties, lot numbers and serials are samples — replace them with your real stock.
- **Trust badges**: none has a document, so **no badge shows** until you attach a real warranty letter, BTRC approval
  or distribution letter.
- **Warranty terms**: a plain default is used (Settings → Store information); match it to your suppliers' terms.

## Docs

| | |
|---|---|
| [docs/SPECIFICATION.md](docs/SPECIFICATION.md) | the A–Z specification: brand, pages, admin, architecture (Mermaid diagrams), data model, specs & compatibility, deals, bundles, serials & warranty claims, honest urgency, security, testing, API, glossary, assumptions |
| [docs/SETUP.md](docs/SETUP.md) | local development, Cloudflare + GitHub, secrets, custom domain, go-live checklist |
| [docs/SECURITY.md](docs/SECURITY.md) | security, privacy, backups and recovery |
| [docs/WHITELABEL.md](docs/WHITELABEL.md) | re-brand the shop for another client |
| [docs/BUILD-PROMPT.md](docs/BUILD-PROMPT.md) | the build brief this repository implements |
