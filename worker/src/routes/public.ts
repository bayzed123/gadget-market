/** Public storefront API — config, catalogue, bundles, compare, collections, trust badges, home page (Deal of the Day), tech guides, reviews, product Q&A, back-in-stock, newsletter, events relay, gadget finder, landing pages, push. */
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { body, clientIp, E, intParam, likeText, parseJson, validate } from "../lib/http";
import { eventSchema, finderSchema, newsletterSchema, questionSchema, reviewSchema, stockNotifySchema } from "../lib/schemas";
import { expandCategoryIds, getSetting, loadZones, rateLimit } from "../lib/store";
import { discountPercent } from "../lib/pricing";
import { COMPATIBLE, COMPATIBLE_LABELS, isCompatible, SPEC_KEYS } from "../lib/sku";
import { bkashConfigured, sslczConfigured } from "../lib/payments";
import { smsConfigured } from "../lib/notify";
import { sendCapi } from "../lib/marketing";
import { pushConfigured } from "../lib/push";
import { optionalCustomer } from "../middleware";
import { BRAND } from "../brand";

const app = new Hono<AppEnv>();

/** OTP can be used when an SMS gateway is connected (or in local development, where codes are shown on screen). */
export const otpAvailable = (env: AppEnv["Bindings"]) => smsConfigured(env) || env.ENVIRONMENT === "development";

// ---------- Store configuration ----------
app.get("/config", async (c) => {
  const now = new Date().toISOString();
  const [store, payments, integrations, fraud, referral, tax, zones, popup] = await Promise.all([
    getSetting(c.env, "store"),
    getSetting(c.env, "payments"),
    getSetting(c.env, "integrations"),
    getSetting(c.env, "fraud"),
    getSetting(c.env, "referral"),
    getSetting(c.env, "tax"),
    loadZones(c.env),
    // The popup banner (if any): shown once to each visitor by the storefront.
    c.env.DB.prepare(
      `SELECT id, title_en, title_bn, subtitle_en, subtitle_bn, cta_en, cta_bn, link_url, image_url, color, updated_at FROM banners
        WHERE placement = 'popup' AND is_active = 1 AND deleted_at IS NULL AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?)
        ORDER BY sort_order, id DESC LIMIT 1`,
    )
      .bind(now, now)
      .first(),
  ]);
  c.header("Cache-Control", "public, max-age=60");
  return c.json({
    brand: BRAND,
    store,
    devices: COMPATIBLE.map((k) => ({ code: k, ...COMPATIBLE_LABELS[k] })),
    specKeys: SPEC_KEYS,
    giftWrap: { enabled: store.gift_wrap_enabled !== false, fee: Math.max(0, Math.round(Number(store.gift_wrap_fee) || 0)) },
    integrations: {
      metaPixelId: integrations.metaPixelId,
      ga4Id: integrations.ga4Id,
      googleAdsId: integrations.googleAdsId,
      googleAdsLabel: integrations.googleAdsLabel,
      clarityId: integrations.clarityId,
      cfBeacon: integrations.cfBeacon,
    },
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || null,
    otp: { available: otpAvailable(c.env), required: fraud.requireOtp && otpAvailable(c.env) },
    referral: { enabled: referral.enabled, friendDiscount: referral.friendDiscount, reward: referral.reward, minOrder: referral.minOrder },
    tax: { enabled: tax.enabled, rate: tax.rate, inclusive: tax.inclusive },
    push: { publicKey: pushConfigured(c.env) ? c.env.VAPID_PUBLIC_KEY : null },
    payments: {
      COD: { enabled: payments.cod.enabled },
      bKash: { enabled: payments.bkash.enabled, mode: payments.bkash.mode === "api" && bkashConfigured(c.env) ? "api" : "manual", number: payments.bkash.manualNumber, accountType: payments.bkash.accountType },
      Nagad: { enabled: payments.nagad.enabled, mode: "manual", number: payments.nagad.manualNumber, accountType: payments.nagad.accountType },
      Rocket: { enabled: payments.rocket.enabled, mode: "manual", number: payments.rocket.manualNumber, accountType: payments.rocket.accountType },
      Card: { enabled: payments.card.enabled && sslczConfigured(c.env) },
    },
    popup: popup ?? null,
    zones: zones.map((z) => ({ code: z.code, name_en: z.name_en, name_bn: z.name_bn, fee: z.fee, free_shipping_min: z.free_shipping_min, eta_en: z.eta_en, eta_bn: z.eta_bn })),
  });
});

// ---------- Catalogue ----------
app.get("/categories", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.parent_id, c.slug, c.code, c.name_en, c.name_bn, c.description_en, c.description_bn, c.color, c.sort_order,
            COALESCE(c.image_url, (SELECT json_extract(p.images, '$[0]') FROM products p
               WHERE p.status = 'active' AND p.deleted_at IS NULL AND (p.category_id = c.id OR p.category_id IN (SELECT id FROM categories x WHERE x.parent_id = c.id))
               ORDER BY p.is_featured DESC, p.sold_count DESC LIMIT 1)) AS image_url,
            (SELECT COUNT(*) FROM products p WHERE (p.category_id = c.id OR p.category_id IN (SELECT id FROM categories x WHERE x.parent_id = c.id)) AND p.status = 'active' AND p.deleted_at IS NULL) AS product_count
       FROM categories c WHERE c.deleted_at IS NULL AND c.is_active = 1 ORDER BY c.sort_order, c.id`,
  ).all();
  c.header("Cache-Control", "public, max-age=120");
  return c.json({ categories: results });
});

const csv = (max: number) => z.string().max(max).optional().transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []));
const listQuery = z.object({
  category: z.string().max(80).optional(),
  q: z.string().max(100).optional(),
  bundle: z.enum(["0", "1"]).optional(),
  device: csv(160),
  deal: z.enum(["0", "1"]).optional(),
  brand: csv(300),
  min: z.coerce.number().int().min(0).optional(),
  max: z.coerce.number().int().min(0).optional(),
  in_stock: z.enum(["0", "1"]).optional(),
  on_sale: z.enum(["0", "1"]).optional(),
  featured: z.enum(["0", "1"]).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "popular", "rating"]).default("newest"),
  page: z.string().optional(),
  limit: z.string().optional(),
  ids: z.string().max(500).optional(),
});

/**
 * Certifications shown to shoppers: the type is active, the product's assignment is active and unexpired, and proof is
 * on file — a product-level document, or the business-wide certificate on the type (also unexpired). `ce` is the
 * certifications row.
 */
export const HELD_CERT_SQL = `ce.is_active = 1 AND (ce.valid_until IS NULL OR ce.valid_until >= date('now'))
  AND EXISTS (SELECT 1 FROM certification_types t WHERE t.code = ce.type AND t.is_active = 1 AND t.deleted_at IS NULL
    AND ((ce.document_url IS NOT NULL AND length(trim(ce.document_url)) > 0)
      OR (t.document_url IS NOT NULL AND length(trim(t.document_url)) > 0 AND (t.valid_until IS NULL OR t.valid_until >= date('now')))))`;
/** Certification types the business genuinely holds (business-wide certificate on file and unexpired) — the home strip. */
export const HELD_TYPE_SQL = "t.is_active = 1 AND t.deleted_at IS NULL AND t.document_url IS NOT NULL AND length(trim(t.document_url)) > 0 AND (t.valid_until IS NULL OR t.valid_until >= date('now'))";

/** A deal is live through the end of its deal_until day, Bangladesh time (UTC+6). */
export const DEAL_LIVE_SQL = "p.deal_until IS NOT NULL AND p.deal_until >= date('now', '+6 hours')";

export const PRODUCT_CARD_COLUMNS = `p.id, p.slug, p.name_en, p.name_bn, p.brand, p.price, p.sale_price, p.images, p.compatible, p.warranty_months, p.rating_avg, p.rating_count,
  p.sold_count, p.is_featured, p.delivery_mode, p.created_at, p.category_id, (p.bundle_items != '[]') AS is_bundle,
  CASE WHEN ${DEAL_LIVE_SQL} THEN p.deal_until END AS deal_until,
  (SELECT v.size FROM product_variants v WHERE v.product_id = p.id ORDER BY v.sort_order, v.id LIMIT 1) AS size_label,
  (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS variant_count,
  (SELECT COALESCE(SUM(stock),0) FROM product_variants v WHERE v.product_id = p.id) AS stock,
  (SELECT COUNT(*) FROM certifications ce WHERE ce.product_id = p.id AND ${HELD_CERT_SQL}) AS cert_count`;

export type CardRow = { id: number; images: string; price: number; sale_price: number | null; stock: number; compatible: string; is_bundle?: number | boolean } & Record<string, unknown>;
/** ",iphone,usb_c," → ["iphone","usb_c"] */
export const splitTags = (v: unknown) => String(v ?? "").split(",").filter(Boolean);
export function toCard(r: CardRow) {
  return {
    ...r,
    images: parseJson<string[]>(r.images, []).slice(0, 2),
    compatible: splitTags(r.compatible),
    is_bundle: Boolean(r.is_bundle),
    discount_percent: discountPercent(r.price, r.sale_price),
    in_stock: r.stock > 0,
  };
}

interface Filter {
  where: string[];
  args: unknown[];
}

/** Builds WHERE clauses shared by the listing and its facet counts. */
async function buildFilter(env: AppEnv["Bindings"], f: z.infer<typeof listQuery>, skip: "device" | "brand" | null = null): Promise<Filter | null> {
  const where = ["p.status = 'active'", "p.deleted_at IS NULL"];
  const args: unknown[] = [];
  if (f.category) {
    const cat = await env.DB.prepare("SELECT id FROM categories WHERE slug = ? AND deleted_at IS NULL AND is_active = 1").bind(f.category).first<{ id: number }>();
    if (!cat) return null;
    const ids = await expandCategoryIds(env, [cat.id]);
    where.push(`p.category_id IN (${ids.map(() => "?").join(",")})`);
    args.push(...ids);
  }
  if (f.q) {
    const like = likeText(f.q);
    // Spec-aware search: "bluetooth 5.3" or "65W" finds products with it on their spec sheet.
    where.push("(p.name_en LIKE ? OR p.name_bn LIKE ? OR p.tags LIKE ? OR p.brand LIKE ? OR p.specs LIKE ? OR EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.sku LIKE ?))");
    args.push(like, like, like, like, like, like);
  }
  if (f.bundle === "1") where.push("p.bundle_items != '[]'");
  if (f.bundle === "0") where.push("p.bundle_items = '[]'");
  if (f.deal === "1") where.push(`${DEAL_LIVE_SQL} AND p.sale_price IS NOT NULL`);
  const devices = f.device.filter(isCompatible);
  if (devices.length && skip !== "device") {
    // "Works with iPhone" — any of the chosen devices.
    where.push(`(${devices.map(() => "p.compatible LIKE ?").join(" OR ")})`);
    args.push(...devices.map((a) => `%,${a},%`));
  }
  if (f.brand.length && skip !== "brand") {
    where.push(`p.brand IN (${f.brand.map(() => "?").join(",")})`);
    args.push(...f.brand);
  }
  if (f.min != null) {
    where.push("COALESCE(p.sale_price, p.price) >= ?");
    args.push(f.min);
  }
  if (f.max != null) {
    where.push("COALESCE(p.sale_price, p.price) <= ?");
    args.push(f.max);
  }
  if (f.in_stock === "1") where.push("EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock > 0)");
  if (f.on_sale === "1") where.push("p.sale_price IS NOT NULL AND p.sale_price < p.price");
  if (f.featured === "1") where.push("p.is_featured = 1");
  if (f.ids) {
    const ids = f.ids.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50);
    if (!ids.length) return null;
    where.push(`p.id IN (${ids.map(() => "?").join(",")})`);
    args.push(...ids);
  }
  return { where, args };
}

app.get("/products", async (c) => {
  const f = validate(listQuery, c.req.query());
  const flt = await buildFilter(c.env, f);
  if (!flt) return c.json({ items: [], total: 0, page: 1, pages: 0 });
  const order = {
    newest: "p.created_at DESC",
    price_asc: "COALESCE(p.sale_price, p.price) ASC",
    price_desc: "COALESCE(p.sale_price, p.price) DESC",
    popular: "p.sold_count DESC",
    rating: "p.rating_avg DESC, p.rating_count DESC",
  }[f.sort];
  const limit = intParam(f.limit, 12, 1, 48);
  const page = intParam(f.page, 1, 1, 10000);
  const w = flt.where.join(" AND ");
  const [count, rows] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM products p WHERE ${w}`).bind(...flt.args).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE ${w} ORDER BY ${order}, p.id DESC LIMIT ? OFFSET ?`)
      .bind(...flt.args, limit, (page - 1) * limit)
      .all<CardRow>(),
  ]);
  const total = count?.n ?? 0;
  c.header("Cache-Control", "public, max-age=30");
  return c.json({ items: rows.results.map(toCard), total, page, pages: Math.ceil(total / limit) });
});

/** Filter options with live counts for the listing sidebar ("works with" device, brand, price range). */
app.get("/facets", async (c) => {
  const f = validate(listQuery, c.req.query());
  const [fCon, fBrand, fAll] = await Promise.all([
    buildFilter(c.env, f, "device"),
    buildFilter(c.env, f, "brand"),
    buildFilter(c.env, { ...f, min: undefined, max: undefined }),
  ]);
  if (!fCon || !fBrand || !fAll) return c.json({ devices: [], brands: [], price: { min: 0, max: 0 } });
  const count = (flt: Filter, extra: string, arg: string) =>
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM products p WHERE ${flt.where.join(" AND ")} AND ${extra}`)
      .bind(...flt.args, arg)
      .first<{ n: number }>()
      .then((r) => r?.n ?? 0);
  const [devices, brands, price] = await Promise.all([
    Promise.all(COMPATIBLE.map(async (k) => ({ code: k, ...COMPATIBLE_LABELS[k], count: await count(fCon, "p.compatible LIKE ?", `%,${k},%`) }))),
    c.env.DB.prepare(`SELECT p.brand AS name, COUNT(*) AS count FROM products p WHERE ${fBrand.where.join(" AND ")} AND p.brand IS NOT NULL AND p.brand != '' GROUP BY p.brand ORDER BY p.brand`)
      .bind(...fBrand.args)
      .all<{ name: string; count: number }>(),
    c.env.DB.prepare(`SELECT MIN(COALESCE(p.sale_price,p.price)) AS min, MAX(COALESCE(p.sale_price,p.price)) AS max FROM products p WHERE ${fAll.where.join(" AND ")}`)
      .bind(...fAll.args)
      .first<{ min: number | null; max: number | null }>(),
  ]);
  c.header("Cache-Control", "public, max-age=60");
  return c.json({
    devices: devices.filter((x) => x.count > 0 || f.device.includes(x.code)),
    brands: brands.results,
    price: { min: price?.min ?? 0, max: price?.max ?? 0 },
  });
});


app.get("/products/:slug", async (c) => {
  const p = await c.env.DB.prepare("SELECT * FROM products WHERE slug = ? AND status = 'active' AND deleted_at IS NULL")
    .bind(c.req.param("slug"))
    .first<Record<string, unknown> & { id: number; category_id: number | null; images: string; price: number; sale_price: number | null; compatible: string; specs: string; highlights: string; bundle_items: string; deal_until: string | null }>();
  if (!p) throw E.notFound("Product");
  const compatible = splitTags(p.compatible);
  const bundle = parseJson<{ product_id: number; quantity: number }[]>(p.bundle_items, []);
  const [variants, certs, reviews, related, upsell, crumbs, looks, inBundles, questions, dealLive] = await Promise.all([
    // The stock shown is the real count — the shop never invents "only 2 left".
    c.env.DB.prepare("SELECT v.id, v.sku, v.size, v.color, v.stock, v.price_override, v.low_stock_threshold FROM product_variants v WHERE v.product_id = ? ORDER BY v.sort_order, v.id")
      .bind(p.id)
      .all(),
    // Only trust badges the business genuinely holds (proof on file, unexpired) — official warranty, BTRC approval …
    c.env.DB.prepare(
      `SELECT ce.type, t.name_en, t.name_bn, t.icon, t.description_en, t.description_bn, COALESCE(ce.issuer, t.issuer) AS issuer, ce.certificate_no, COALESCE(ce.valid_until, t.valid_until) AS valid_until
         FROM certifications ce JOIN certification_types t ON t.code = ce.type WHERE ce.product_id = ? AND ${HELD_CERT_SQL} ORDER BY t.sort_order, t.id`,
    )
      .bind(p.id)
      .all(),
    c.env.DB.prepare("SELECT id, name, rating, body, reply, photo_url, verified_purchase, created_at FROM reviews WHERE product_id = ? AND status = 'approved' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50").bind(p.id).all(),
    c.env.DB.prepare(`SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE p.category_id = ? AND p.id != ? AND p.status='active' AND p.deleted_at IS NULL ORDER BY p.sold_count DESC LIMIT 8`)
      .bind(p.category_id, p.id)
      .all<CardRow>(),
    // Works well with: products from other categories that work with the same devices (earbuds → a USB-C charger).
    compatible.length
      ? c.env.DB.prepare(
          `SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE (p.category_id IS NULL OR p.category_id != ?) AND p.id != ? AND p.status='active' AND p.deleted_at IS NULL AND p.bundle_items = '[]'
             AND (${compatible.map(() => "p.compatible LIKE ?").join(" OR ")}) ORDER BY p.is_featured DESC, p.sold_count DESC LIMIT 6`,
        )
          .bind(p.category_id ?? 0, p.id, ...compatible.map((a) => `%,${a},%`))
          .all<CardRow>()
      : Promise.resolve({ results: [] as CardRow[] }),
    c.env.DB.prepare(
      `WITH RECURSIVE chain(id, parent_id, slug, name_en, name_bn, depth) AS (
         SELECT id, parent_id, slug, name_en, name_bn, 0 FROM categories WHERE id = ?
         UNION ALL SELECT c.id, c.parent_id, c.slug, c.name_en, c.name_bn, chain.depth + 1 FROM categories c JOIN chain ON c.id = chain.parent_id)
       SELECT slug, name_en, name_bn FROM chain ORDER BY depth DESC`,
    )
      .bind(p.category_id ?? 0)
      .all(),
    // "Goes well with": every active collection this product belongs to.
    c.env.DB.prepare(
      `SELECT c.id, c.slug, c.name_en, c.name_bn, c.product_ids FROM collections c, json_each(c.product_ids) j
        WHERE j.value = ? AND c.is_active = 1 AND c.deleted_at IS NULL GROUP BY c.id ORDER BY c.is_featured DESC, c.sort_order, c.id LIMIT 3`,
    )
      .bind(p.id)
      .all<{ id: number; slug: string; name_en: string; name_bn: string; product_ids: string }>(),
    // Bundles / combo deals that contain this product.
    c.env.DB.prepare(
      `SELECT ${PRODUCT_CARD_COLUMNS} FROM products p, json_each(p.bundle_items) j
        WHERE json_extract(j.value, '$.product_id') = ? AND p.status = 'active' AND p.deleted_at IS NULL GROUP BY p.id LIMIT 4`,
    )
      .bind(p.id)
      .all<CardRow>(),
    c.env.DB.prepare("SELECT id, name, question, answer, answered_by, created_at, answered_at FROM product_questions WHERE product_id = ? AND status = 'published' ORDER BY answered_at DESC, id DESC LIMIT 30").bind(p.id).all(),
    p.deal_until ? c.env.DB.prepare("SELECT date('now', '+6 hours') <= ? AS live").bind(p.deal_until).first<{ live: number }>() : Promise.resolve(null),
  ]);
  const lookIds = [...new Set(looks.results.flatMap((l) => parseJson<number[]>(l.product_ids, [])).filter((id) => id !== p.id))];
  const wanted = [...new Set([...lookIds, ...bundle.map((b) => b.product_id)])];
  const cards = wanted.length
    ? (
        await c.env.DB.prepare(`SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE p.id IN (${wanted.map(() => "?").join(",")}) AND p.deleted_at IS NULL`)
          .bind(...wanted)
          .all<CardRow & { status?: string }>()
      ).results
    : [];
  const cardById = new Map(cards.map((r) => [r.id, toCard(r)]));
  const goesWellWith = looks.results
    .map((l) => ({
      slug: l.slug,
      name_en: l.name_en,
      name_bn: l.name_bn,
      items: parseJson<number[]>(l.product_ids, []).filter((id) => id !== p.id).map((id) => cardById.get(id)).filter(Boolean),
    }))
    .filter((l) => l.items.length > 0);
  // A bundle's contents with the real separate price of each product, so "you save" is computed, never invented.
  const bundleItems = bundle.map((b) => ({ quantity: b.quantity, product: cardById.get(b.product_id) ?? null })).filter((x) => x.product);
  const separate = bundleItems.reduce((sum, x) => sum + x.quantity * Number(x.product!.sale_price ?? x.product!.price), 0);
  const bundlePrice = Number(p.sale_price ?? p.price);
  c.header("Cache-Control", "public, max-age=20");
  return c.json({
    product: {
      ...p,
      images: parseJson<string[]>(p.images, []),
      compatible,
      specs: parseJson<{ key: string; value: string }[]>(p.specs, []),
      highlights: parseJson<unknown[]>(p.highlights, []),
      // The Deal of the Day countdown only runs while the deal is real (sale price set, end date not passed).
      deal_until: dealLive?.live && p.sale_price != null ? p.deal_until : null,
      bundle_items: undefined,
      is_bundle: bundle.length > 0,
      discount_percent: discountPercent(p.price, p.sale_price),
    },
    variants: variants.results,
    certifications: certs.results,
    reviews: reviews.results,
    related: related.results.map(toCard),
    upsell: upsell.results.map(toCard),
    goesWellWith,
    bundle: bundle.length ? { items: bundleItems, separate_price: separate, saving: Math.max(0, separate - bundlePrice) } : null,
    inBundles: inBundles.results.map(toCard),
    questions: questions.results,
    breadcrumbs: crumbs.results,
  });
});

// ---------- Home page ----------
app.get("/home", async (c) => {
  const now = new Date().toISOString();
  const card = (where: string, order: string, limit = 8) =>
    c.env.DB.prepare(`SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE p.status = 'active' AND p.deleted_at IS NULL ${where} ORDER BY ${order} LIMIT ${limit}`).all<CardRow>();
  const store = await getSetting(c.env, "store");
  const spotlight = store.spotlight;
  const [banners, newArrivals, bestSellers, spotlightItems, testimonials, collections, bundles, held, posts, deals] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, placement, title_en, title_bn, subtitle_en, subtitle_bn, cta_en, cta_bn, link_url, image_url, color FROM banners
        WHERE placement <> 'popup' AND deleted_at IS NULL AND is_active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?) ORDER BY placement, sort_order, id`,
    )
      .bind(now, now)
      .all(),
    card("AND p.bundle_items = '[]'", "p.created_at DESC"),
    card("AND p.sold_count > 0", "p.sold_count DESC"),
    // Tech explainer: products that call the term out as a key feature (or carry it on the spec sheet).
    spotlight?.ingredient
      ? c.env.DB.prepare(
          `SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE p.status = 'active' AND p.deleted_at IS NULL
             AND (EXISTS (SELECT 1 FROM json_each(p.highlights) h WHERE lower(json_extract(h.value, '$.name')) LIKE ?) OR lower(p.specs) LIKE ?)
           ORDER BY p.is_featured DESC, p.sold_count DESC LIMIT 4`,
        )
          .bind(`%${spotlight.ingredient.toLowerCase()}%`, `%${spotlight.ingredient.toLowerCase()}%`)
          .all<CardRow>()
      : Promise.resolve({ results: [] as CardRow[] }),
    c.env.DB.prepare(
      `SELECT r.id, r.name, r.rating, r.body, r.photo_url, r.verified_purchase, p.name_en AS product_en, p.name_bn AS product_bn, p.slug,
              json_extract(p.images, '$[0]') AS product_image
         FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.status = 'approved' AND r.deleted_at IS NULL AND r.rating >= 4
        ORDER BY (r.photo_url IS NOT NULL) DESC, r.created_at DESC LIMIT 6`,
    ).all(),
    listCollections(c.env, true),
    card("AND p.bundle_items != '[]'", "p.is_featured DESC, p.sold_count DESC", 4),
    // Trust strip: only the badges the business genuinely holds (document on file, unexpired).
    c.env.DB.prepare(`SELECT code, name_en, name_bn, icon, issuer, description_en, description_bn FROM certification_types t WHERE ${HELD_TYPE_SQL} ORDER BY sort_order, id`).all(),
    c.env.DB.prepare(
      `SELECT slug, title_en, title_bn, excerpt_en, excerpt_bn, cover_url, published_at FROM posts
        WHERE status = 'published' AND deleted_at IS NULL AND (published_at IS NULL OR published_at <= ?) ORDER BY COALESCE(published_at, created_at) DESC LIMIT 3`,
    )
      .bind(now)
      .all(),
    // Deal of the Day: live deals with a real end date and stock, the one ending soonest first.
    card(`AND ${DEAL_LIVE_SQL} AND p.sale_price IS NOT NULL AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock > 0)`, "p.deal_until ASC, p.sold_count DESC", 4),
  ]);
  c.header("Cache-Control", "public, max-age=60");
  return c.json({
    deals: deals.results.map(toCard),
    banners: banners.results,
    newArrivals: newArrivals.results.map(toCard),
    bestSellers: bestSellers.results.map(toCard),
    spotlight: spotlight?.ingredient ? { ...spotlight, items: spotlightItems.results.map(toCard) } : null,
    testimonials: testimonials.results,
    collections,
    bundles: bundles.results.map(toCard),
    certifications: held.results,
    journal: posts.results,
  });
});

// ---------- Trust badges ----------
/** The badges the shop genuinely holds (authorised reseller, BTRC …), for the About page and the trust strip. */
app.get("/certifications", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT code, name_en, name_bn, icon, issuer, description_en, description_bn, valid_until FROM certification_types t WHERE ${HELD_TYPE_SQL} ORDER BY sort_order, id`,
  ).all();
  c.header("Cache-Control", "public, max-age=120");
  return c.json({ certifications: results });
});

// ---------- Collections ----------
/** Active collections with a cover image (their own, or the first product's photo), product count and combined price. */
async function listCollections(env: AppEnv["Bindings"], featuredOnly = false) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.slug, c.name_en, c.name_bn, c.description_en, c.description_bn, c.device, c.is_featured, c.product_ids,
            COALESCE(c.image_url, (SELECT json_extract(p.images, '$[0]') FROM products p WHERE p.id = json_extract(c.product_ids, '$[0]'))) AS image_url,
            (SELECT COALESCE(SUM(COALESCE(p.sale_price, p.price)), 0) FROM products p, json_each(c.product_ids) j WHERE p.id = j.value AND p.status = 'active' AND p.deleted_at IS NULL) AS set_price,
            (SELECT COUNT(*) FROM products p, json_each(c.product_ids) j WHERE p.id = j.value AND p.status = 'active' AND p.deleted_at IS NULL) AS piece_count
       FROM collections c WHERE c.is_active = 1 AND c.deleted_at IS NULL ${featuredOnly ? "AND c.is_featured = 1" : ""}
      ORDER BY c.sort_order, c.id LIMIT 24`,
  ).all<Record<string, unknown> & { product_ids: string; piece_count: number }>();
  return results.filter((r) => r.piece_count > 0).map(({ product_ids: _ids, ...r }) => r);
}

app.get("/collections", async (c) => {
  c.header("Cache-Control", "public, max-age=60");
  return c.json({ collections: await listCollections(c.env) });
});

app.get("/collections/:slug", async (c) => {
  const col = await c.env.DB.prepare("SELECT * FROM collections WHERE slug = ? AND is_active = 1 AND deleted_at IS NULL").bind(c.req.param("slug")).first<Record<string, unknown> & { product_ids: string }>();
  if (!col) throw E.notFound("Collection");
  const ids = parseJson<number[]>(col.product_ids, []);
  const rows = ids.length
    ? (await c.env.DB.prepare(`SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE p.id IN (${ids.map(() => "?").join(",")}) AND p.status = 'active' AND p.deleted_at IS NULL`).bind(...ids).all<CardRow>()).results
    : [];
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
  const items = ids.map((id) => byId.get(id)).filter(Boolean);
  c.header("Cache-Control", "public, max-age=30");
  return c.json({ collection: { ...col, product_ids: undefined }, items });
});

// ---------- Tech guides ----------
app.get("/journal", async (c) => {
  const page = intParam(c.req.query("page"), 1, 1, 1000);
  const limit = 9;
  const now = new Date().toISOString();
  const where = "status = 'published' AND deleted_at IS NULL AND (published_at IS NULL OR published_at <= ?)";
  const [count, rows] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM posts WHERE ${where}`).bind(now).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT slug, title_en, title_bn, excerpt_en, excerpt_bn, cover_url, author, published_at FROM posts WHERE ${where} ORDER BY COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?`)
      .bind(now, limit, (page - 1) * limit)
      .all(),
  ]);
  c.header("Cache-Control", "public, max-age=60");
  return c.json({ items: rows.results, total: count?.n ?? 0, page, pages: Math.ceil((count?.n ?? 0) / limit) });
});

app.get("/journal/:slug", async (c) => {
  const post = await c.env.DB.prepare("SELECT * FROM posts WHERE slug = ? AND status = 'published' AND deleted_at IS NULL AND (published_at IS NULL OR published_at <= ?)")
    .bind(c.req.param("slug"), new Date().toISOString())
    .first<Record<string, unknown> & { product_ids: string }>();
  if (!post) throw E.notFound("Article");
  const ids = parseJson<number[]>(post.product_ids, []);
  const rows = ids.length
    ? (await c.env.DB.prepare(`SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE p.id IN (${ids.map(() => "?").join(",")}) AND p.status = 'active' AND p.deleted_at IS NULL`).bind(...ids).all<CardRow>()).results
    : [];
  c.header("Cache-Control", "public, max-age=60");
  return c.json({ post: { ...post, product_ids: undefined }, products: rows.map(toCard) });
});

// ---------- Reviews ----------
app.post("/reviews", optionalCustomer, async (c) => {
  await rateLimit(c, "review", 5, 3600);
  const r = await body(c, reviewSchema);
  const exists = await c.env.DB.prepare("SELECT id FROM products WHERE id = ? AND deleted_at IS NULL").bind(r.productId).first();
  if (!exists) throw E.notFound("Product");
  // "Verified purchase" only when the review comes from a delivered order link (order number + private token).
  let orderId: number | null = null;
  if (r.orderNo && r.token) {
    const o = await c.env.DB.prepare(
      "SELECT o.id FROM orders o WHERE o.order_no = ? AND o.public_token = ? AND o.status = 'delivered' AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.product_id = ?)",
    )
      .bind(r.orderNo, r.token, r.productId)
      .first<{ id: number }>();
    orderId = o?.id ?? null;
  }
  await c.env.DB.prepare("INSERT INTO reviews (product_id, order_id, customer_id, name, rating, body, status, verified_purchase) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)")
    .bind(r.productId, orderId, c.get("customer")?.id ?? null, r.name, r.rating, r.body, orderId ? 1 : 0)
    .run();
  return c.json({ ok: true, en: "Thank you! Your review will appear after a quick check.", bn: "ধন্যবাদ! যাচাইয়ের পর আপনার রিভিউ দেখানো হবে।" }, 201);
});

// ---------- Back-in-stock "notify me" ----------
app.post("/stock-notify", async (c) => {
  await rateLimit(c, "stock-notify", 10, 3600);
  const b = await body(c, stockNotifySchema);
  const p = await c.env.DB.prepare("SELECT id FROM products WHERE id = ? AND deleted_at IS NULL").bind(b.productId).first();
  if (!p) throw E.notFound("Product");
  const dupe = await c.env.DB.prepare(
    "SELECT id FROM stock_notify_requests WHERE product_id = ? AND COALESCE(variant_id,0) = ? AND notified_at IS NULL AND (phone = ? OR email = ?)",
  )
    .bind(b.productId, b.variantId ?? 0, b.phone ?? "-", b.email ?? "-")
    .first();
  if (!dupe) {
    await c.env.DB.prepare("INSERT INTO stock_notify_requests (product_id, variant_id, phone, email, lang) VALUES (?, ?, ?, ?, ?)")
      .bind(b.productId, b.variantId ?? null, b.phone, b.email, b.lang)
      .run();
  }
  return c.json({ ok: true, en: "We'll let you know as soon as it's back.", bn: "স্টকে এলেই আপনাকে জানাবো।" }, 201);
});

app.post("/newsletter", async (c) => {
  await rateLimit(c, "newsletter", 5, 3600);
  const b = await body(c, newsletterSchema);
  await c.env.DB.prepare("INSERT OR IGNORE INTO newsletter_subscribers (contact, lang) VALUES (?, ?)").bind(b.contact, b.lang).run();
  return c.json({ ok: true, en: "Thanks for subscribing!", bn: "সাবস্ক্রাইব করার জন্য ধন্যবাদ!" }, 201);
});

// ---------- Conversions API relay (browser events that only happen client-side) ----------
app.post("/events", async (c) => {
  await rateLimit(c, "events", 120, 300);
  const b = await body(c, eventSchema);
  c.executionCtx.waitUntil(
    sendCapi(c.env, {
      name: b.name,
      eventId: b.eventId,
      sourceUrl: b.url,
      user: { ip: clientIp(c), userAgent: c.req.header("user-agent"), fbp: b.fbp, fbc: b.fbc, phone: c.get("customer")?.phone },
      custom: b.value != null ? { value: b.value, content_ids: b.contentIds, content_type: "product", num_items: b.numItems } : undefined,
    }),
  );
  return c.json({ ok: true }, 202);
});

// ---------- Product Q&A ----------
app.post("/questions", optionalCustomer, async (c) => {
  await rateLimit(c, "question", 5, 3600);
  const q = await body(c, questionSchema);
  const exists = await c.env.DB.prepare("SELECT id FROM products WHERE id = ? AND status = 'active' AND deleted_at IS NULL").bind(q.productId).first();
  if (!exists) throw E.notFound("Product");
  await c.env.DB.prepare("INSERT INTO product_questions (product_id, customer_id, name, question) VALUES (?, ?, ?, ?)").bind(q.productId, c.get("customer")?.id ?? null, q.name, q.question).run();
  return c.json({ ok: true, en: "Thanks! Your question will appear here with our answer.", bn: "ধন্যবাদ! উত্তরসহ আপনার প্রশ্নটি এখানে দেখানো হবে।" }, 201);
});

// ---------- Spec comparison (2–3 products side by side) ----------
app.get("/compare", async (c) => {
  const ids = [...new Set((c.req.query("ids") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 3);
  if (ids.length < 2) throw E.badRequest("Pick 2 or 3 products to compare.", "তুলনা করতে ২ বা ৩টি পণ্য বেছে নিন।");
  const { results } = await c.env.DB.prepare(
    `SELECT ${PRODUCT_CARD_COLUMNS}, p.specs FROM products p WHERE p.id IN (${ids.map(() => "?").join(",")}) AND p.status = 'active' AND p.deleted_at IS NULL`,
  )
    .bind(...ids)
    .all<CardRow & { specs: string }>();
  const items = ids.map((id) => results.find((r) => r.id === id)).filter((r): r is CardRow & { specs: string } => Boolean(r));
  const specs = items.map((r) => new Map(parseJson<{ key: string; value: string }[]>(r.specs, []).map((s) => [s.key.toLowerCase(), s.value])));
  // Rows: known keys in the standard order, then any other keys in the order they first appear.
  const keys = [...new Set(specs.flatMap((m) => [...m.keys()]))];
  const known = Object.keys(SPEC_KEYS);
  keys.sort((a, b) => (known.includes(a) ? known.indexOf(a) : 999) - (known.includes(b) ? known.indexOf(b) : 999));
  const rows = keys.map((key) => {
    const values = specs.map((m) => m.get(key) ?? null);
    return { key, en: SPEC_KEYS[key]?.en ?? key, bn: SPEC_KEYS[key]?.bn ?? key, values, differs: new Set(values.map((v) => (v ?? "").toLowerCase())).size > 1 };
  });
  c.header("Cache-Control", "public, max-age=30");
  return c.json({ items: items.map(({ specs: _s, ...r }) => toCard(r as CardRow)), rows });
});

// ---------- Gadget finder (device + budget → one essential from each of a few categories) ----------
type FinderRow = CardRow & { cat_sort: number; cat_name_en: string; cat_name_bn: string; top_id: number };

/**
 * Picks the best match for the device from each top-level category (audio, power, mobile accessories …), best rated
 * and best selling first, while staying within the budget. When the budget is tight, the cheapest matching product of
 * a category is used so the money covers more categories. Ready-made bundles are left out (suggested separately).
 */
export function pickSetup(rows: FinderRow[], device: string, budget: number, maxItems = 4) {
  const price = (r: FinderRow) => Number(r.sale_price ?? r.price);
  const score = (r: FinderRow) => (r.is_featured ? 1 : 0) + Number(r.rating_avg ?? 0) / 5 + Math.min(1, Number(r.sold_count ?? 0) / 200);
  const byCat = new Map<number, FinderRow[]>();
  for (const r of rows) {
    if (!splitTags(r.compatible).includes(device)) continue;
    if (!byCat.has(r.top_id)) byCat.set(r.top_id, []);
    byCat.get(r.top_id)!.push(r);
  }
  const groups = [...byCat.values()].map((list) => list.sort((a, b) => score(b) - score(a) || price(a) - price(b)));
  // The shop's category order (power and cables before gaming gear), strongest match breaking ties.
  groups.sort((a, b) => a[0]!.cat_sort - b[0]!.cat_sort || score(b[0]!) - score(a[0]!));
  const picks: FinderRow[] = [];
  let left = budget;
  groups.slice(0, maxItems).forEach((list, i, used) => {
    const reserve = used.slice(i + 1).reduce((sum, g) => sum + Math.min(...g.map(price)), 0);
    const cheapest = [...list].sort((a, b) => price(a) - price(b)).find((r) => price(r) <= left);
    const choice = list.find((r) => price(r) <= left - reserve) ?? cheapest;
    if (choice) {
      picks.push(choice);
      left -= price(choice);
    }
  });
  picks.sort((a, b) => a.cat_sort - b.cat_sort);
  return { picks, total: budget - left };
}

app.get("/finder", async (c) => {
  await rateLimit(c, "finder", 30, 300);
  const q = validate(finderSchema, c.req.query());
  const { results } = await c.env.DB.prepare(
    `SELECT ${PRODUCT_CARD_COLUMNS}, COALESCE(top.sort_order, 0) AS cat_sort, top.name_en AS cat_name_en, top.name_bn AS cat_name_bn, COALESCE(top.id, 0) AS top_id
       FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN categories top ON top.id = COALESCE(c.parent_id, c.id)
      WHERE p.status = 'active' AND p.deleted_at IS NULL AND p.bundle_items = '[]' AND p.compatible LIKE ?
        AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock > 0)
      LIMIT 300`,
  )
    .bind(`%,${q.device},%`)
    .all<FinderRow>();
  const { picks, total } = pickSetup(results, q.device, q.budget);
  const bundles = await c.env.DB.prepare(
    `SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE p.status = 'active' AND p.deleted_at IS NULL AND p.bundle_items != '[]' AND p.compatible LIKE ?
       AND COALESCE(p.sale_price, p.price) <= ? ORDER BY p.is_featured DESC, p.sold_count DESC LIMIT 2`,
  )
    .bind(`%,${q.device},%`, q.budget)
    .all<CardRow>();
  const device = COMPATIBLE_LABELS[q.device];
  return c.json({
    items: picks.map(({ cat_sort: _s, cat_name_en, cat_name_bn, top_id: _t, ...card }) => ({ category_en: cat_name_en, category_bn: cat_name_bn, product: toCard(card as CardRow) })),
    total,
    bundles: bundles.results.map(toCard),
    reason: {
      en: `In-stock gear tagged as working with ${device.en}, one from each shelf, within ৳${q.budget}. Check the "Works with" list and the wattage on each spec sheet before you order.`,
      bn: `${device.bn}-এর সাথে চলে এমন স্টকে থাকা পণ্য, প্রতিটি তাক থেকে একটি করে, ৳${q.budget} এর মধ্যে। অর্ডারের আগে প্রতিটির "সাপোর্ট করে" তালিকা ও স্পেক শিটে ওয়াট দেখে নিন।`,
    },
  });
});

// ---------- Campaign landing pages ----------
app.get("/lp/:slug", async (c) => {
  const lp = await c.env.DB.prepare("SELECT * FROM landing_pages WHERE slug = ? AND is_active = 1 AND deleted_at IS NULL").bind(c.req.param("slug")).first<Record<string, unknown> & { id: number; product_id: number | null }>();
  if (!lp) throw E.notFound("Page");
  c.executionCtx.waitUntil(c.env.DB.prepare("UPDATE landing_pages SET views = views + 1 WHERE id = ?").bind(lp.id).run());
  let product: unknown = null;
  let variants: unknown[] = [];
  if (lp.product_id) {
    const p = await c.env.DB.prepare(`SELECT ${PRODUCT_CARD_COLUMNS} FROM products p WHERE p.id = ? AND p.status = 'active' AND p.deleted_at IS NULL`).bind(lp.product_id).first<CardRow>();
    if (p) {
      product = toCard(p);
      variants = (await c.env.DB.prepare("SELECT id, sku, size, color, stock, price_override FROM product_variants WHERE product_id = ? ORDER BY sort_order, id").bind(p.id).all()).results;
    }
  }
  return c.json({ page: lp, product, variants });
});

// ---------- Web Push (PWA) ----------
app.post("/push/subscribe", optionalCustomer, async (c) => {
  await rateLimit(c, "push", 10, 3600);
  const b = await body(
    c,
    z.object({
      endpoint: z.url().max(1000),
      keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }).optional(),
      phone: z.string().max(20).optional(),
      promo: z.boolean().default(false),
    }),
  );
  const phone = c.get("customer")?.phone ?? (b.phone ? b.phone.replace(/\D/g, "").replace(/^880/, "0") : null);
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, phone, customer_id, promo_opt_in) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET phone = COALESCE(excluded.phone, push_subscriptions.phone), customer_id = COALESCE(excluded.customer_id, push_subscriptions.customer_id), promo_opt_in = excluded.promo_opt_in`,
  )
    .bind(b.endpoint, b.keys?.p256dh ?? null, b.keys?.auth ?? null, phone && /^01\d{9}$/.test(phone) ? phone : null, c.get("customer")?.id ?? null, b.promo ? 1 : 0)
    .run();
  return c.json({ ok: true }, 201);
});

/** The service worker calls this after a push "tickle" to fetch the message it should show. */
app.get("/push/latest", async (c) => {
  const endpoint = c.req.query("endpoint") ?? "";
  const row = await c.env.DB.prepare("SELECT last_message FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).first<{ last_message: string | null }>();
  return c.json(parseJson(row?.last_message, { title: BRAND.name.en, body: "", url: "/" }));
});

export default app;
