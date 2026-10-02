-- Gadget Market — initial schema (Cloudflare D1 / SQLite).
-- Conventions: money is stored in whole Taka (INTEGER); timestamps are ISO-8601 UTC strings;
-- "deleted_at" marks a soft-deleted row (Trash) that can be restored from the admin.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- settings & counters
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Atomic sequences: SKU numbers per category code, invoice numbers per day (UPDATE … RETURNING).
CREATE TABLE counters (
  name   TEXT PRIMARY KEY,
  value  INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------- staff
CREATE TABLE admins (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,              -- sign-in ID: email or simple username
  phone           TEXT UNIQUE,                        -- used for phone + OTP sign-in (staff roles)
  password_hash   TEXT,
  role            TEXT NOT NULL CHECK (role IN ('super_admin','manager','order_processor','viewer')),
  is_active       INTEGER NOT NULL DEFAULT 1,
  totp_secret     TEXT,                               -- base32, set during 2FA setup
  totp_enabled    INTEGER NOT NULL DEFAULT 0,
  last_login_at   TEXT,
  last_seen_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at      TEXT
);

-- ---------------------------------------------------------------- catalogue
CREATE TABLE categories (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id       INTEGER REFERENCES categories(id),
  slug            TEXT NOT NULL UNIQUE,
  code            TEXT NOT NULL,                      -- 2–3 letters used in SKUs, e.g. EB (earbuds), PB (power banks)
  name_en         TEXT NOT NULL,
  name_bn         TEXT NOT NULL,
  description_en  TEXT,
  description_bn  TEXT,
  image_url       TEXT,
  color           TEXT,                               -- tile tone key: yellow|mint|lavender|peach|sky|pink (shown as earthy tints)
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at      TEXT
);
CREATE INDEX idx_categories_parent ON categories(parent_id, sort_order);

CREATE TABLE products (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  slug              TEXT NOT NULL UNIQUE,
  name_en           TEXT NOT NULL,
  name_bn           TEXT NOT NULL,
  description_en    TEXT,
  description_bn    TEXT,
  category_id       INTEGER REFERENCES categories(id),
  brand             TEXT,
  price             INTEGER NOT NULL CHECK (price > 0),
  sale_price        INTEGER,
  discount_type     TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none','percent','flat')),
  discount_value    INTEGER NOT NULL DEFAULT 0,
  -- Devices it works with, stored as ",iphone,usb_c," so a LIKE '%,iphone,%' filter is exact (see lib/sku.ts COMPATIBLE).
  compatible        TEXT NOT NULL DEFAULT '',
  -- The spec sheet: JSON [{key, value}] in display order. Known keys (battery, wattage, ports …) get bilingual labels.
  specs             TEXT NOT NULL DEFAULT '[]',
  highlights        TEXT NOT NULL DEFAULT '[]',       -- JSON [{name, benefit_en, benefit_bn}] — key features called out on the page
  in_box_en         TEXT,                             -- what's in the box, one item per line
  in_box_bn         TEXT,
  how_to_use_en     TEXT,                             -- setup / how to use, one step per line
  how_to_use_bn     TEXT,
  caution_en        TEXT,                             -- safety notes, e.g. "Use a 20W-or-higher adapter"
  caution_bn        TEXT,
  warranty_months   INTEGER NOT NULL DEFAULT 0 CHECK (warranty_months BETWEEN 0 AND 60),  -- 0 = no warranty
  origin            TEXT,                             -- brand origin / made in, e.g. "Made in China · Official BD import"
  -- Deal of the Day: while deal_until is in the future the sale price applies and the home page counts down to it.
  -- A deal that has ended is cleared by the frequent job and never priced, so the countdown is never made up.
  deal_until        TEXT,
  -- Bundles / combo deals: a bundle is its own product (packed and stocked as one box) that lists the products inside.
  bundle_items      TEXT NOT NULL DEFAULT '[]',       -- JSON [{product_id, quantity}] — empty for ordinary products
  delivery_mode     TEXT NOT NULL DEFAULT 'zone' CHECK (delivery_mode IN ('zone','free')),
  tags              TEXT NOT NULL DEFAULT '',
  images            TEXT NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  is_featured       INTEGER NOT NULL DEFAULT 0,
  sold_count        INTEGER NOT NULL DEFAULT 0,
  rating_avg        REAL NOT NULL DEFAULT 0,
  rating_count      INTEGER NOT NULL DEFAULT 0,
  meta_title        TEXT,
  meta_description  TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at        TEXT
);
CREATE INDEX idx_products_list ON products(status, deleted_at, category_id);
CREATE INDEX idx_products_created ON products(created_at);

CREATE TABLE product_variants (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id           INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku                  TEXT NOT NULL,
  size                 TEXT NOT NULL DEFAULT 'Standard',  -- the option: model, capacity, wattage, length … e.g. "20W", "1.2 m", "10000 mAh"
  color                TEXT NOT NULL DEFAULT '',          -- part of the SKU (BLK, WHT, BLU …)
  stock                INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  price_override       INTEGER,
  low_stock_threshold  INTEGER NOT NULL DEFAULT 3,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- SKUs are unique across the whole store, enforced by the database.
CREATE UNIQUE INDEX uq_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_product ON product_variants(product_id, sort_order);

-- Trust badges the shop can assign (official warranty, BTRC approved, authorised reseller …), each with its own icon. A type
-- counts as genuinely held only when proof is on file: the business-wide certificate here, or a product-level one.
CREATE TABLE certification_types (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT NOT NULL UNIQUE,               -- official_warranty, btrc, authorised … (lowercase)
  name_en         TEXT NOT NULL,
  name_bn         TEXT NOT NULL,
  description_en  TEXT,
  description_bn  TEXT,
  icon            TEXT NOT NULL DEFAULT 'shield',     -- leaf | shield | flask | crescent | check | star | drop
  issuer          TEXT,                               -- who certified the business, e.g. "BSTI", "Islamic Foundation"
  document_url    TEXT,                               -- the business-wide certificate (PDF / photo)
  document_name   TEXT,
  valid_until     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at      TEXT
);

-- Certifications assigned to a product, with an optional product-specific certificate (e.g. a lab report for one
-- batch). The storefront shows a badge only when the type is active and proof exists — this row's document or the
-- type's business-wide document — and neither has expired.
CREATE TABLE certifications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type            TEXT NOT NULL REFERENCES certification_types(code) ON UPDATE CASCADE,
  issuer          TEXT,
  certificate_no  TEXT,
  document_url    TEXT CHECK (document_url IS NULL OR length(trim(document_url)) > 0),
  document_name   TEXT,
  valid_until     TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  added_by        TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX uq_cert_product_type ON certifications(product_id, type);

-- Collections: hand-picked groups of products for a concern ("Better sleep", "Family immunity"). The product page
-- shows the other products of every active collection it belongs to as "Goes well with".
CREATE TABLE collections (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT NOT NULL UNIQUE,
  name_en         TEXT NOT NULL,
  name_bn         TEXT NOT NULL,
  description_en  TEXT,
  description_bn  TEXT,
  image_url       TEXT,
  device          TEXT CHECK (device IN ('iphone','android','usb_c','lightning','laptop','mac','windows','ps5','xbox','switch','smart_tv')),  -- the device the setup is for
  product_ids     TEXT NOT NULL DEFAULT '[]',         -- JSON array of product ids, in display order
  is_featured     INTEGER NOT NULL DEFAULT 0,         -- shown on the home page
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at      TEXT
);

CREATE TABLE banners (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  placement    TEXT NOT NULL DEFAULT 'hero' CHECK (placement IN ('hero','offer','marketing','popup')),
  title_en     TEXT NOT NULL,
  title_bn     TEXT NOT NULL,
  subtitle_en  TEXT,
  subtitle_bn  TEXT,
  cta_en       TEXT,
  cta_bn       TEXT,
  link_url     TEXT,
  image_url    TEXT,
  color        TEXT,
  starts_at    TEXT,
  ends_at      TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at   TEXT
);
CREATE INDEX idx_banners_live ON banners(placement, is_active, deleted_at);

-- ---------------------------------------------------------------- customers
CREATE TABLE customers (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  name                        TEXT NOT NULL,
  phone                       TEXT NOT NULL UNIQUE,
  email                       TEXT,
  password_hash               TEXT,
  is_blocked                  INTEGER NOT NULL DEFAULT 0,
  notes                       TEXT,
  -- Delivery history for risk scoring (kept up to date by the order pipeline).
  total_orders                INTEGER NOT NULL DEFAULT 0,
  delivered_count             INTEGER NOT NULL DEFAULT 0,
  refused_or_returned_count   INTEGER NOT NULL DEFAULT 0,
  cancelled_count             INTEGER NOT NULL DEFAULT 0,
  risk_level                  TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high')),
  risk_reason                 TEXT,
  phone_verified_at           TEXT,
  referred_by_code            TEXT,
  last_login_at               TEXT,
  created_at                  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at                  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at                  TEXT
);

CREATE TABLE addresses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label           TEXT NOT NULL DEFAULT 'Home',
  recipient_name  TEXT NOT NULL,
  phone           TEXT NOT NULL,
  division_id     INTEGER NOT NULL,
  district_id     INTEGER NOT NULL,
  upazila_id      INTEGER NOT NULL,
  division        TEXT NOT NULL,
  district        TEXT NOT NULL,
  upazila         TEXT NOT NULL,
  area            TEXT NOT NULL,
  zone_code       TEXT,
  is_default      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_addresses_customer ON addresses(customer_id);

CREATE TABLE wishlist (
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (customer_id, product_id)
);

-- ---------------------------------------------------------------- delivery
CREATE TABLE delivery_zones (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  code               TEXT NOT NULL UNIQUE,
  name_en            TEXT NOT NULL,
  name_bn            TEXT NOT NULL,
  fee                INTEGER NOT NULL DEFAULT 0,
  free_shipping_min  INTEGER,
  division_ids       TEXT NOT NULL DEFAULT '[]',
  district_ids       TEXT NOT NULL DEFAULT '[]',
  upazila_ids        TEXT NOT NULL DEFAULT '[]',
  eta_en             TEXT,
  eta_bn             TEXT,
  is_default         INTEGER NOT NULL DEFAULT 0,
  is_active          INTEGER NOT NULL DEFAULT 1,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at         TEXT
);

-- ---------------------------------------------------------------- promotions
CREATE TABLE coupons (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  code                TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description         TEXT,
  kind                TEXT NOT NULL DEFAULT 'standard' CHECK (kind IN ('standard','recovery','referral_reward')),
  type                TEXT NOT NULL CHECK (type IN ('percent','flat','free_delivery')),
  value               INTEGER NOT NULL DEFAULT 0 CHECK (value >= 0 AND (type = 'free_delivery' OR value > 0)),
  min_order           INTEGER NOT NULL DEFAULT 0,
  max_discount        INTEGER,
  starts_at           TEXT,
  expires_at          TEXT,
  usage_limit         INTEGER,
  per_customer_limit  INTEGER,
  used_count          INTEGER NOT NULL DEFAULT 0,
  category_ids        TEXT NOT NULL DEFAULT '[]',
  customer_phone      TEXT,                           -- reserved for one customer (rewards/recovery)
  is_active           INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at          TEXT
);

-- Give-and-get referral codes: the friend gets a discount on their first order, the owner of the
-- code gets a reward coupon once that order is delivered.
CREATE TABLE referral_codes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  code              TEXT NOT NULL UNIQUE COLLATE NOCASE,
  customer_id       INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  uses              INTEGER NOT NULL DEFAULT 0,
  rewards_earned    INTEGER NOT NULL DEFAULT 0,       -- number of reward coupons issued
  reward            INTEGER NOT NULL DEFAULT 100,     -- Taka value of each reward coupon
  friend_discount   INTEGER NOT NULL DEFAULT 100,     -- Taka off the friend's first order
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX uq_referral_customer ON referral_codes(customer_id);

CREATE TABLE landing_pages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT NOT NULL UNIQUE,
  title_en        TEXT NOT NULL,
  title_bn        TEXT NOT NULL,
  subtitle_en     TEXT,
  subtitle_bn     TEXT,
  offer_en        TEXT,
  offer_bn        TEXT,
  image_url       TEXT,
  product_id      INTEGER REFERENCES products(id),
  coupon_code     TEXT,
  cta_en          TEXT,
  cta_bn          TEXT,
  color           TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  views           INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at      TEXT
);

-- ---------------------------------------------------------------- tech guides (journal)
-- Tech guides (buying guides, how-tos, explainers). Copy is checked for fake urgency and impossible promises like products.
CREATE TABLE posts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT NOT NULL UNIQUE,
  title_en        TEXT NOT NULL,
  title_bn        TEXT NOT NULL,
  excerpt_en      TEXT,
  excerpt_bn      TEXT,
  body_en         TEXT,                               -- plain text, blank line = new paragraph
  body_bn         TEXT,
  cover_url       TEXT,
  product_ids     TEXT NOT NULL DEFAULT '[]',         -- JSON array of related product ids
  author          TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at      TEXT
);
CREATE INDEX idx_posts_published ON posts(status, published_at);

-- ---------------------------------------------------------------- orders
CREATE TABLE orders (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no             TEXT NOT NULL UNIQUE,
  invoice_no           TEXT,                          -- INV-GAD-YYYYMMDD-#### set at confirmation
  public_token         TEXT NOT NULL,
  session_id           TEXT,
  customer_id          INTEGER REFERENCES customers(id),
  customer_name        TEXT NOT NULL,
  customer_phone       TEXT NOT NULL,
  customer_email       TEXT,
  division_id          INTEGER NOT NULL,
  district_id          INTEGER NOT NULL,
  upazila_id           INTEGER NOT NULL,
  division             TEXT NOT NULL,
  district             TEXT NOT NULL,
  upazila              TEXT NOT NULL,
  area                 TEXT NOT NULL,
  zone_code            TEXT NOT NULL,
  subtotal             INTEGER NOT NULL,
  discount             INTEGER NOT NULL DEFAULT 0,
  delivery_fee         INTEGER NOT NULL DEFAULT 0,
  gift_wrap            INTEGER NOT NULL DEFAULT 0,       -- customer asked for a gift box
  gift_wrap_fee        INTEGER NOT NULL DEFAULT 0,
  vat_amount           INTEGER NOT NULL DEFAULT 0,
  total                INTEGER NOT NULL,
  coupon_code          TEXT,
  referral_code        TEXT,
  payment_method       TEXT NOT NULL CHECK (payment_method IN ('COD','bKash','Nagad','Rocket','Card')),
  payment_status       TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded','partially_refunded')),
  payment_ref          TEXT,
  -- Pipeline. Cancelled (before shipping), Refused (courier attempted, customer declined) and
  -- Returned (accepted, then sent back) are separate outcomes on purpose.
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmation_attempted','confirmed','packed','shipped','delivered','cancelled','refused','returned')),
  courier_partner      TEXT CHECK (courier_partner IN ('Steadfast','Pathao','RedX')),
  tracking_id          TEXT,
  consignment_id       TEXT,
  courier_status       TEXT,                          -- latest courier sub-status, e.g. out_for_delivery
  customer_note        TEXT,
  gift_message         TEXT,
  lang                 TEXT NOT NULL DEFAULT 'bn',
  admin_notes          TEXT,
  refund_amount        INTEGER NOT NULL DEFAULT 0,
  refund_note          TEXT,
  -- Fraud prevention
  otp_verified         INTEGER NOT NULL DEFAULT 0,
  confirmation_method  TEXT CHECK (confirmation_method IN ('otp','call','trusted','prepaid','manual')),
  risk_level           TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high')),
  risk_reasons         TEXT NOT NULL DEFAULT '[]',
  flags                TEXT NOT NULL DEFAULT '[]',     -- e.g. ["velocity_phone","velocity_ip"]
  fraud_check          TEXT,                          -- courier phone-history lookup (JSON)
  ip                   TEXT,
  -- Attribution
  utm_source           TEXT,
  utm_medium           TEXT,
  utm_campaign         TEXT,
  ad_ref               TEXT,                          -- click-to-WhatsApp / ad identifier
  confirmed_at         TEXT,
  shipped_at           TEXT,
  delivered_at         TEXT,
  review_requested_at  TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at           TEXT
);
CREATE UNIQUE INDEX uq_orders_invoice ON orders(invoice_no) WHERE invoice_no IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(status, deleted_at, created_at);
CREATE INDEX idx_orders_phone ON orders(customer_phone, created_at);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_ip ON orders(ip, created_at);

CREATE TABLE order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id),
  variant_id   INTEGER REFERENCES product_variants(id),
  category_id  INTEGER,
  sku          TEXT NOT NULL,
  name_en      TEXT NOT NULL,
  name_bn      TEXT NOT NULL,
  size         TEXT,
  color        TEXT,
  image        TEXT,
  batches      TEXT NOT NULL DEFAULT '[]',               -- stock lots the units came from: [{batch_id, batch_no, expiry, qty}]
  warranty_months INTEGER NOT NULL DEFAULT 0,            -- the product's warranty when it was sold (claims use this, not today's value)
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  unit_price   INTEGER NOT NULL,
  line_total   INTEGER NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

CREATE TABLE order_status_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  note        TEXT,
  actor       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_history_order ON order_status_history(order_id);

-- Every confirmation call / message attempt, logged with its outcome (one-tap buttons in the admin).
CREATE TABLE order_confirmation_attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  attempted_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  method        TEXT NOT NULL DEFAULT 'call' CHECK (method IN ('call','whatsapp','sms')),
  outcome       TEXT NOT NULL CHECK (outcome IN ('no_answer','confirmed','declined')),
  note          TEXT,
  staff_id      INTEGER REFERENCES admins(id),
  staff_name    TEXT NOT NULL
);
CREATE INDEX idx_attempts_order ON order_confirmation_attempts(order_id);

CREATE TABLE return_requests (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id     INTEGER REFERENCES customers(id),
  reason          TEXT NOT NULL CHECK (reason IN ('damaged','wrong_item','not_working','not_as_described','changed_mind','other')),
  details         TEXT,
  status          TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','received','refunded')),
  refund_amount   INTEGER NOT NULL DEFAULT 0,
  refund_method   TEXT,
  admin_note      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_returns_order ON return_requests(order_id);

-- ---------------------------------------------------------------- abandoned checkouts
CREATE TABLE abandoned_checkouts (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id         TEXT NOT NULL UNIQUE,
  name               TEXT,
  phone              TEXT,
  email              TEXT,
  division           TEXT,
  district           TEXT,
  upazila            TEXT,
  area               TEXT,
  cart               TEXT NOT NULL DEFAULT '[]',       -- snapshot: [{variantId, sku, name_en, name_bn, quantity, unitPrice}]
  cart_total         INTEGER NOT NULL DEFAULT 0,
  last_step          TEXT NOT NULL DEFAULT 'contact' CHECK (last_step IN ('cart','contact','address','payment')),
  -- open = still filling in / not followed up; converted = finished checkout within the window (hidden);
  -- recovered = became an order after being abandoned or marked by staff; ignored = "Not interested".
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','converted','recovered','ignored')),
  order_id           INTEGER REFERENCES orders(id),
  contact_attempts   INTEGER NOT NULL DEFAULT 0,
  last_contacted_at  TEXT,
  recovery_sent_at   TEXT,
  lead_sent_at       TEXT,
  utm_source         TEXT,
  utm_medium         TEXT,
  utm_campaign       TEXT,
  ip                 TEXT,
  lang               TEXT NOT NULL DEFAULT 'bn',
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_abandoned_status ON abandoned_checkouts(status, updated_at);
CREATE INDEX idx_abandoned_phone ON abandoned_checkouts(phone);

-- ---------------------------------------------------------------- reviews & stock
CREATE TABLE reviews (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id         INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id           INTEGER REFERENCES orders(id),
  customer_id        INTEGER REFERENCES customers(id),
  name               TEXT NOT NULL,
  rating             INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  verified_purchase  INTEGER NOT NULL DEFAULT 0,
  reply              TEXT,
  replied_by         TEXT,
  photo_url          TEXT,                             -- customer photo (added by staff), shown on the home page
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at         TEXT
);
CREATE INDEX idx_reviews_product ON reviews(product_id, status);

CREATE TABLE inventory_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER,
  variant_id   INTEGER,
  sku          TEXT,
  change       INTEGER NOT NULL,
  stock_after  INTEGER,
  reason       TEXT NOT NULL CHECK (reason IN ('initial','order','cancel','refused','return','restock','adjustment','import','expired')),
  note         TEXT,
  actor        TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_inventory_variant ON inventory_log(variant_id, created_at);

-- Stock lots: each shipment received, with its lot / supplier-invoice number, supplier and cost. A variant's stock is
-- the sum of qty_remaining of its lots (plus any untracked stock from before lots were used). Orders take units from
-- the oldest lot first (first-in-first-out), so a warranty claim can be traced to the shipment the unit came from.
-- Most electronics have no expiry: those lots carry 2099-12-31 ("no expiry"). Lots that do expire (e.g. batteries
-- sold by date) are packed first-expiry-first-out and written off by the daily job when they pass it.
CREATE TABLE inventory_batches (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id     INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  batch_no       TEXT NOT NULL,
  expiry_date    TEXT NOT NULL DEFAULT '2099-12-31',   -- YYYY-MM-DD; 2099-12-31 = no expiry
  manufactured_on TEXT,
  qty_received   INTEGER NOT NULL CHECK (qty_received > 0),
  qty_remaining  INTEGER NOT NULL CHECK (qty_remaining >= 0),
  supplier       TEXT,
  cost_price     INTEGER,
  note           TEXT,
  received_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  received_by    TEXT,
  written_off_at TEXT,
  CHECK (qty_remaining <= qty_received)
);
CREATE UNIQUE INDEX uq_batches_variant_no ON inventory_batches(variant_id, batch_no);
CREATE INDEX idx_batches_fefo ON inventory_batches(variant_id, expiry_date) WHERE qty_remaining > 0;
CREATE INDEX idx_batches_expiry ON inventory_batches(expiry_date) WHERE qty_remaining > 0;

CREATE TABLE stock_notify_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id   INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
  phone        TEXT,
  email        TEXT,
  lang         TEXT NOT NULL DEFAULT 'bn',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  notified_at  TEXT,
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX idx_stock_notify ON stock_notify_requests(product_id, notified_at);

CREATE TABLE newsletter_subscribers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  contact     TEXT NOT NULL UNIQUE,                  -- email or mobile number
  lang        TEXT NOT NULL DEFAULT 'bn',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ---------------------------------------------------------------- messaging, marketing & logs
CREATE TABLE notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  channel     TEXT NOT NULL CHECK (channel IN ('sms','whatsapp','email','push')),
  recipient   TEXT NOT NULL,
  template    TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('sent','failed','skipped')),
  error       TEXT,
  order_id    INTEGER,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_notifications_order ON notifications(order_id);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- Server-side Conversions API deliveries (so the owner's Health Check can show real status).
CREATE TABLE marketing_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  provider    TEXT NOT NULL,                          -- meta_capi | ga4_mp
  event_name  TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('sent','failed','skipped')),
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_marketing_created ON marketing_events(created_at);

-- Click-to-WhatsApp ad attribution (from the WhatsApp Cloud API webhook "referral" object or /wa?ref=).
CREATE TABLE wa_leads (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  phone        TEXT,
  ad_ref       TEXT NOT NULL,
  ctwa_clid    TEXT,
  headline     TEXT,
  source_url   TEXT,
  first_text   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_wa_leads_phone ON wa_leads(phone, created_at);

CREATE TABLE push_subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT,
  auth         TEXT,
  phone        TEXT,
  customer_id  INTEGER,
  promo_opt_in INTEGER NOT NULL DEFAULT 0,
  last_message TEXT,                                   -- JSON {title, body, url}; the service worker fetches it
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_push_phone ON push_subscriptions(phone);

-- ---------------------------------------------------------------- warranty, serials, questions
-- Warranty claims: a customer files one against a delivered order line; staff move it
-- Submitted → Under review → Approved / Rejected → Resolved, with notes the customer can see and notes they can't.
CREATE TABLE warranty_claims (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_no        TEXT NOT NULL UNIQUE,                      -- WC-YYMMDD-#### (Bangladesh date)
  order_id        INTEGER NOT NULL REFERENCES orders(id),
  order_item_id   INTEGER NOT NULL REFERENCES order_items(id),
  customer_id     INTEGER REFERENCES customers(id),
  product_id      INTEGER REFERENCES products(id),
  sku             TEXT NOT NULL,
  serial          TEXT,                                      -- the unit's serial number, if known
  issue           TEXT NOT NULL CHECK (issue IN ('not_charging','no_sound','not_turning_on','connection','battery','physical','other')),
  details         TEXT NOT NULL,
  photo_url       TEXT,
  phone           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','approved','rejected','resolved')),
  resolution      TEXT CHECK (resolution IN ('repair','replace','refund','none')),
  customer_note   TEXT,                                      -- shown to the customer
  staff_note      TEXT,                                      -- internal
  warranty_until  TEXT,                                      -- YYYY-MM-DD, worked out from the delivery date + warranty months
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_claims_status ON warranty_claims(status, created_at);
CREATE INDEX idx_claims_order ON warranty_claims(order_id);
CREATE UNIQUE INDEX uq_claims_open_item ON warranty_claims(order_item_id) WHERE status IN ('submitted','under_review','approved');

-- Optional per-unit serial numbers for higher-value electronics: received into stock, given to an order line
-- when it is packed, and looked up when a warranty claim comes in.
CREATE TABLE serial_numbers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id      INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  serial          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  status          TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock','sold','returned','faulty')),
  order_item_id   INTEGER REFERENCES order_items(id),
  batch_id        INTEGER REFERENCES inventory_batches(id),
  note            TEXT,
  received_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sold_at         TEXT
);
CREATE INDEX idx_serials_variant ON serial_numbers(variant_id, status);
CREATE INDEX idx_serials_item ON serial_numbers(order_item_id);

-- Customer questions on a product page; shown once staff have answered them.
CREATE TABLE product_questions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  question        TEXT NOT NULL,
  answer          TEXT,
  answered_by     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','hidden')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  answered_at     TEXT
);
CREATE INDEX idx_questions_product ON product_questions(product_id, status);

-- ---------------------------------------------------------------- audit
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id    INTEGER,
  admin_name  TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  details     TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);
