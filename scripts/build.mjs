#!/usr/bin/env node
/**
 * Build: copies the storefront (public/) and admin (admin/) into dist/ for Workers Static Assets, fills in brand
 * placeholders and cache-busting build IDs, writes security headers, the PWA manifest, and the seed SQL
 * (dist-seed/seed.sql) with auto-generated SKUs (GAD-<Cat>-<Brand>-<Color>-<Seq>), stock lots, per-unit serial numbers,
 * bundles / combo deals, Deal of the Day end dates (relative to the build date), trust badges (no documents — no badge
 * shows until real proof is attached) and tech guides. The build fails if any seed copy uses fake urgency or a promise
 * a product can't keep (worker/src/lib/claims.ts).
 *
 * Usage: node scripts/build.mjs
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import brand from "../worker/src/brand.json" with { type: "json" };
import { banners, categories, certificationTypes, collections, coupons, landingPages, posts, products, zones } from "./seed-data.mjs";
import { findMisleadingClaims, claimMessage } from "../worker/src/lib/claims.ts";
import { COMPATIBLE, formatSku, SKU_PATTERN } from "../worker/src/lib/codes.ts";

const BUILD_ID = Date.now().toString(36);
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("public", "dist", { recursive: true });
cpSync("admin", "dist/admin", { recursive: true });

// ---------------------------------------------------------------- brand placeholders
const jsonLdStore = {
  "@context": "https://schema.org",
  "@type": ["Store", "ElectronicsStore"],
  name: brand.name.en,
  alternateName: brand.name.bn,
  description: brand.description.en,
  url: `https://${brand.domain}/`,
  logo: `https://${brand.domain}/img/icon-512.png`,
  image: `https://${brand.domain}/img/og-cover.png`,
  telephone: brand.contact.phone,
  email: brand.contact.email,
  priceRange: "৳৳",
  currenciesAccepted: "BDT",
  paymentAccepted: "Cash on Delivery, bKash, Nagad, Rocket, Card",
  address: { "@type": "PostalAddress", streetAddress: brand.location.address.en, addressLocality: brand.location.city.en, postalCode: brand.location.postcode, addressCountry: "BD" },
  geo: { "@type": "GeoCoordinates", latitude: brand.location.lat, longitude: brand.location.lng },
  areaServed: { "@type": "Country", name: "Bangladesh" },
  openingHours: "Sa-Th 11:00-21:00",
};
const vars = {
  BUILD_ID,
  BRAND_NAME_EN: brand.name.en,
  BRAND_NAME_BN: brand.name.bn,
  TAGLINE_EN: brand.tagline.en,
  TAGLINE_BN: brand.tagline.bn,
  DESCRIPTION_EN: brand.description.en,
  DOMAIN: brand.domain,
  THEME_COLOR: brand.colors.theme,
  PHONE: brand.contact.phone,
  DEFAULT_LANG: brand.defaultLang,
  JSONLD_STORE: JSON.stringify(jsonLdStore).replace(/</g, "\\u003c"),
  // brand.json colours → CSS variables used by store.css / admin.css (injected after the stylesheet, so they win).
  CSS_VARS: [["yellow", "yellow"], ["mint", "mint"], ["lavender", "lavender"], ["peach", "peach"], ["sky", "sky"], ["pink", "pink"], ["primary", "primary"], ["primary-d", "primaryDark"], ["ink", "ink"]]
    .map(([css, key]) => `--${css}:${brand.colors[key]}`).join(";"),
  ADMIN_CSS_VARS: `--a-primary:${brand.colors.primary};--a-primary-deep:${brand.colors.primaryDark}`,
};
const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(html|js|css|webmanifest)$/.test(f)) writeFileSync(p, fill(readFileSync(p, "utf8")));
  }
}
walk("dist");

// ---------------------------------------------------------------- PWA manifest
writeFileSync(
  "dist/manifest.webmanifest",
  JSON.stringify({
    name: brand.name.en,
    short_name: brand.name.en,
    description: brand.description.en,
    start_url: "/?utm_source=pwa",
    display: "standalone",
    background_color: brand.colors.theme,
    theme_color: brand.colors.theme,
    lang: brand.defaultLang,
    icons: [
      { src: "/img/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/img/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  }),
);

// ---------------------------------------------------------------- security & cache headers (static assets)
const csp = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://connect.facebook.net https://www.googletagmanager.com https://www.clarity.ms https://*.clarity.ms https://static.cloudflareinsights.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://www.facebook.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.clarity.ms https://cloudflareinsights.com",
  "frame-src https://challenges.cloudflare.com https://www.googletagmanager.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://sandbox.sslcommerz.com https://securepay.sslcommerz.com",
].join("; ");
writeFileSync(
  "dist/_headers",
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=(self)
  Content-Security-Policy: ${csp}

/admin/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-cache

/js/*
  Cache-Control: public, max-age=600
/css/*
  Cache-Control: public, max-age=600
/img/*
  Cache-Control: public, max-age=604800
/data/*
  Cache-Control: public, max-age=604800
/sw.js
  Cache-Control: no-cache
`,
);

// ---------------------------------------------------------------- seed SQL
// Honest-copy rule: every piece of seed copy is checked before it can reach a database.
const claimProblems = [];
const check = (id, fields) => {
  for (const m of findMisleadingClaims(fields)) claimProblems.push(`${id}.${m.field}: ${claimMessage(m)}`);
};
for (const p of products) {
  check(p.slug, {
    en: p.en, bn: p.bn, descEn: p.descEn, descBn: p.descBn, useEn: p.useEn, useBn: p.useBn, boxEn: p.boxEn, boxBn: p.boxBn,
    ...Object.fromEntries(p.specs.map(([k, v]) => [`spec.${k}`, v])),
    ...Object.fromEntries(p.highlights.flatMap((h, i) => [[`hl${i}en`, h.en], [`hl${i}bn`, h.bn]])),
  });
}
for (const p of posts) check(p.slug, { titleEn: p.titleEn, titleBn: p.titleBn, excerptEn: p.excerptEn, excerptBn: p.excerptBn, bodyEn: p.bodyEn, bodyBn: p.bodyBn });
for (const c of collections) check(c.slug, { en: c.en, bn: c.bn, descEn: c.descEn, descBn: c.descBn });
for (const c of categories) check(c.slug, { descEn: c.descEn, descBn: c.descBn });
for (const b of banners) check(`banner ${b.titleEn}`, { titleEn: b.titleEn, titleBn: b.titleBn, subEn: b.subEn, subBn: b.subBn });
if (claimProblems.length) throw new Error(`Seed copy breaks the honest-copy rules:\n${claimProblems.join("\n")}`);

const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
/** Bangladesh date `days` from the build date (YYYY-MM-DD). */
const dayPlus = (days) => new Date(Date.now() + 6 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const lines = ["-- Generated by scripts/build.mjs from scripts/seed-data.mjs. Safe to run once on an empty database."];
const catBySlug = new Map(categories.map((c) => [c.slug, c]));
const codes = new Set();
categories.forEach((c, i) => {
  if (!/^[A-Z]{2,3}$/.test(c.code)) throw new Error(`${c.slug}: category code must be 2–3 capital letters`);
  if (codes.has(c.code)) throw new Error(`${c.slug}: category code ${c.code} is used twice`);
  codes.add(c.code);
  if (c.parent && !catBySlug.has(c.parent)) throw new Error(`${c.slug}: unknown parent ${c.parent}`);
  lines.push(
    `INSERT INTO categories (slug, code, parent_id, name_en, name_bn, description_en, description_bn, image_url, color, sort_order) VALUES (${q(c.slug)}, ${q(c.code)}, ${c.parent ? `(SELECT id FROM categories WHERE slug = ${q(c.parent)})` : "NULL"}, ${q(c.en)}, ${q(c.bn)}, ${q(c.descEn)}, ${q(c.descBn)}, ${q(c.image ?? null)}, ${q(c.color)}, ${i});`,
  );
});
for (const z of zones) {
  lines.push(
    `INSERT INTO delivery_zones (code, name_en, name_bn, fee, free_shipping_min, division_ids, district_ids, upazila_ids, eta_en, eta_bn, is_default, sort_order) VALUES (${q(z.code)}, ${q(z.en)}, ${q(z.bn)}, ${z.fee}, ${q(z.free ?? null)}, ${q(JSON.stringify(z.divisions ?? []))}, ${q(JSON.stringify(z.districts ?? []))}, ${q(JSON.stringify(z.upazilas ?? []))}, ${q(z.etaEn)}, ${q(z.etaBn)}, ${z.isDefault ? 1 : 0}, ${z.sort});`,
  );
}
const seq = {};
let lotCount = 0;
let serialCount = 0;
const allSkus = new Set();
const tagList = (v) => (v.length ? `,${[...new Set(v)].join(",")},` : "");
for (const p of products) {
  const cat = catBySlug.get(p.cat);
  if (!cat) throw new Error(`${p.slug}: unknown category ${p.cat}`);
  const code = cat.code;
  for (const i of p.images) if (!existsSync(join("public", i))) throw new Error(`${p.slug}: missing image public${i} (run node scripts/render-gadget.mjs)`);
  for (const d of p.compatible) if (!COMPATIBLE.includes(d)) throw new Error(`${p.slug}: unknown device "${d}"`);
  if (!p.specs.length) throw new Error(`${p.slug}: an active product needs a spec sheet`);
  if (p.dealDays != null && !p.sale) throw new Error(`${p.slug}: a deal needs a sale price`);
  if (p.sale && p.sale >= p.price) throw new Error(`${p.slug}: sale price must be below the price`);
  const specs = p.specs.map(([key, value]) => ({ key, value }));
  const highlights = p.highlights.map((h) => ({ name: h.name, benefit_en: h.en, benefit_bn: h.bn }));
  const tags = [p.cat, cat.parent, p.brand.toLowerCase(), ...p.compatible, ...(p.bundle ? ["bundle", "combo"] : [])].filter(Boolean).join(",");
  lines.push(
    `INSERT INTO products (slug, name_en, name_bn, description_en, description_bn, category_id, brand, price, sale_price, discount_type, compatible, specs, highlights, in_box_en, in_box_bn, how_to_use_en, how_to_use_bn, caution_en, caution_bn, warranty_months, origin, deal_until, tags, images, status, is_featured, delivery_mode) VALUES (${q(p.slug)}, ${q(p.en)}, ${q(p.bn)}, ${q(p.descEn)}, ${q(p.descBn)}, (SELECT id FROM categories WHERE slug = ${q(p.cat)}), ${q(p.brand)}, ${p.price}, ${q(p.sale ?? null)}, 'none', ${q(tagList(p.compatible))}, ${q(JSON.stringify(specs))}, ${q(JSON.stringify(highlights))}, ${q(p.boxEn ?? null)}, ${q(p.boxBn ?? null)}, ${q(p.useEn ?? null)}, ${q(p.useBn ?? null)}, ${q(p.caution?.en ?? null)}, ${q(p.caution?.bn ?? null)}, ${p.warranty ?? 0}, ${q(p.origin ?? null)}, ${q(p.dealDays != null ? dayPlus(p.dealDays) : null)}, ${q(tags)}, ${q(JSON.stringify(p.images))}, 'active', ${p.featured ? 1 : 0}, ${q(p.delivery ?? "zone")});`,
  );
  p.variants.forEach((v, i) => {
    seq[code] = (seq[code] ?? 0) + 1;
    // GAD-[Cat]-[Brand]-[Color]-[Seq], e.g. GAD-EB-SON-BLK-0001 — the same format the admin generates.
    const sku = formatSku(code, p.brand, v.color, seq[code], brand.skuPrefix);
    if (!SKU_PATTERN.test(sku)) throw new Error(`${p.slug}: SKU ${sku} doesn't match the format`);
    if (allSkus.has(sku)) throw new Error(`${p.slug}: duplicate SKU ${sku}`);
    allSkus.add(sku);
    const lotTotal = (v.lots ?? []).reduce((s, l) => s + l.qty, 0);
    if (v.lots && lotTotal !== v.stock) throw new Error(`${p.slug} ${v.size ?? v.color}: lots add up to ${lotTotal}, stock is ${v.stock}`);
    if ((v.serials ?? 0) > v.stock) throw new Error(`${p.slug} ${v.color}: more serials than units`);
    lines.push(
      `INSERT INTO product_variants (product_id, sku, size, color, stock, price_override, low_stock_threshold, sort_order) VALUES ((SELECT id FROM products WHERE slug = ${q(p.slug)}), ${q(sku)}, ${q(v.size ?? "Standard")}, ${q(v.color ?? "")}, ${v.stock}, ${q(v.price ?? null)}, 3, ${i});`,
    );
    if (v.stock > 0) lines.push(`INSERT INTO inventory_log (product_id, variant_id, sku, change, stock_after, reason, note, actor) SELECT product_id, id, sku, stock, stock, 'initial', 'Starter stock (sample)', 'seed' FROM product_variants WHERE sku = ${q(sku)};`);
    for (const l of v.lots ?? []) {
      lotCount++;
      lines.push(
        `INSERT INTO inventory_batches (variant_id, batch_no, expiry_date, qty_received, qty_remaining, supplier, note, received_by) VALUES ((SELECT id FROM product_variants WHERE sku = ${q(sku)}), ${q(l.batch)}, '2099-12-31', ${l.qty}, ${l.qty}, 'Sample supplier', 'Starter stock (sample)', 'seed');`,
      );
    }
    // Sample serials: <SKU without prefix and dashes>-<n>, e.g. HPSONBLK0003-0007.
    for (let n = 1; n <= (v.serials ?? 0); n++) {
      serialCount++;
      const serial = `${sku.split("-").slice(1).join("")}-${String(n).padStart(4, "0")}`;
      lines.push(`INSERT INTO serial_numbers (variant_id, serial, note) VALUES ((SELECT id FROM product_variants WHERE sku = ${q(sku)}), ${q(serial)}, 'Sample serial');`);
    }
  });
}
for (const [code, n] of Object.entries(seq)) lines.push(`INSERT INTO counters (name, value) VALUES (${q(`sku:${code}`)}, ${n});`);
// Bundles / combo deals: each lists the products packed inside it ({product_id, quantity}, in that key order).
const slugs = new Set(products.map((p) => p.slug));
for (const p of products.filter((x) => x.bundle?.length)) {
  for (const k of p.bundle) {
    if (!slugs.has(k.slug)) throw new Error(`bundle ${p.slug}: unknown product ${k.slug}`);
    if (products.find((x) => x.slug === k.slug)?.bundle) throw new Error(`bundle ${p.slug}: ${k.slug} is itself a bundle`);
  }
  const separate = p.bundle.reduce((s, k) => {
    const x = products.find((y) => y.slug === k.slug);
    return s + (x.sale ?? x.price) * (k.qty ?? 1);
  }, 0);
  if ((p.sale ?? p.price) >= separate) throw new Error(`bundle ${p.slug}: costs ৳${p.sale ?? p.price}, the products separately ৳${separate} — a combo must save money`);
  const items = JSON.stringify(p.bundle.map((k) => ({ slug: k.slug, qty: k.qty ?? 1 })));
  lines.push(
    `UPDATE products SET bundle_items = (SELECT json_group_array(json_object('product_id', x.id, 'quantity', json_extract(j.value, '$.qty'))) FROM json_each(${q(items)}) j JOIN products x ON x.slug = json_extract(j.value, '$.slug')) WHERE slug = ${q(p.slug)};`,
  );
}
certificationTypes.forEach((c, i) => {
  lines.push(
    `INSERT INTO certification_types (code, name_en, name_bn, description_en, description_bn, icon, issuer, sort_order) VALUES (${q(c.code)}, ${q(c.en)}, ${q(c.bn)}, ${q(c.descEn)}, ${q(c.descBn)}, ${q(c.icon)}, ${q(c.issuer ?? null)}, ${i});`,
  );
});
for (const p of posts) {
  for (const s of p.products) if (!slugs.has(s)) throw new Error(`post ${p.slug}: unknown product ${s}`);
  if (!existsSync(join("public", p.cover))) throw new Error(`${p.slug}: missing image public${p.cover}`);
  const ids = `(SELECT json_group_array(id) FROM (SELECT x.id FROM json_each(${q(JSON.stringify(p.products))}) j JOIN products x ON x.slug = j.value ORDER BY j.key))`;
  const at = new Date(Date.now() - p.daysAgo * 86400_000).toISOString();
  lines.push(
    `INSERT INTO posts (slug, title_en, title_bn, excerpt_en, excerpt_bn, body_en, body_bn, cover_url, product_ids, author, status, published_at) VALUES (${q(p.slug)}, ${q(p.titleEn)}, ${q(p.titleBn)}, ${q(p.excerptEn)}, ${q(p.excerptBn)}, ${q(p.bodyEn)}, ${q(p.bodyBn)}, ${q(p.cover)}, ${ids}, ${q(p.author)}, 'published', ${q(at)});`,
  );
}
for (const b of banners) {
  lines.push(
    `INSERT INTO banners (placement, title_en, title_bn, subtitle_en, subtitle_bn, cta_en, cta_bn, link_url, image_url, color, sort_order, is_active) VALUES (${q(b.placement)}, ${q(b.titleEn)}, ${q(b.titleBn)}, ${q(b.subEn)}, ${q(b.subBn)}, ${q(b.ctaEn)}, ${q(b.ctaBn)}, ${q(b.link)}, ${q(b.image ?? null)}, ${q(b.color)}, ${b.sort}, ${b.active ?? 1});`,
  );
}
collections.forEach((c, i) => {
  for (const s of c.products) if (!slugs.has(s)) throw new Error(`collection ${c.slug}: unknown product ${s}`);
  const ids = `(SELECT json_group_array(id) FROM (SELECT p.id FROM json_each(${q(JSON.stringify(c.products))}) j JOIN products p ON p.slug = j.value ORDER BY j.key))`;
  lines.push(
    `INSERT INTO collections (slug, name_en, name_bn, description_en, description_bn, image_url, device, product_ids, is_featured, sort_order) VALUES (${q(c.slug)}, ${q(c.en)}, ${q(c.bn)}, ${q(c.descEn)}, ${q(c.descBn)}, ${q(c.image)}, ${q(c.device ?? null)}, ${ids}, ${c.featured ? 1 : 0}, ${i});`,
  );
});
for (const c of coupons) lines.push(`INSERT INTO coupons (code, description, type, value, min_order, per_customer_limit) VALUES (${q(c.code)}, ${q(c.description)}, ${q(c.type)}, ${c.value}, ${c.min}, ${q(c.perCustomer ?? null)});`);
for (const l of landingPages) {
  lines.push(
    `INSERT INTO landing_pages (slug, title_en, title_bn, subtitle_en, subtitle_bn, offer_en, offer_bn, product_id, color, cta_en, cta_bn) VALUES (${q(l.slug)}, ${q(l.titleEn)}, ${q(l.titleBn)}, ${q(l.subEn)}, ${q(l.subBn)}, ${q(l.offerEn)}, ${q(l.offerBn)}, (SELECT id FROM products WHERE slug = ${q(l.product)}), ${q(l.color)}, 'Order now — Cash on Delivery', 'এখনই অর্ডার করুন — ক্যাশ অন ডেলিভারি');`,
  );
}
mkdirSync("dist-seed", { recursive: true });
writeFileSync("dist-seed/seed.sql", lines.join("\n") + "\n");

if (!existsSync("dist/index.html")) throw new Error("public/index.html is missing");
console.log(`✔ Built dist/ (build ${BUILD_ID}) and dist-seed/seed.sql (${products.length} products, ${allSkus.size} SKUs, ${lotCount} lots, ${serialCount} serials, ${products.filter((p) => p.bundle).length} bundles, ${collections.length} collections, ${posts.length} guides)`);
