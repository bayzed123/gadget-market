/** Request validation (Zod). Every message is bilingual so the admin and storefront can show it inline. */
import { z } from "zod";
import { normalizeBdPhone } from "./http";
import { salePriceFor } from "./pricing";
import { claimMessage, findMisleadingClaims } from "./claims";
import { COMPATIBLE } from "./sku";

export const bdPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const p = normalizeBdPhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX) / সঠিক মোবাইল নম্বর দিন" });
      return z.NEVER;
    }
    return p;
  });

const text = (max: number) => z.string().trim().max(max);
const reqText = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
const money = z.coerce.number().int().min(0).max(10_000_000);
const flag = z.union([z.boolean(), z.number()]).transform((v) => (v ? 1 : 0));
const email = z.union([z.literal(""), z.email()]).optional().nullable().transform((v) => v || null);
const isoDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), { message: "Enter a valid date / সঠিক তারিখ দিন" });
const idList = z.array(z.coerce.number().int().positive()).default([]);
const slug = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "Use lowercase letters, numbers and dashes only / শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা ও ড্যাশ" });
/** SKU: letters, digits and dashes, stored upper-case. Blank = generated automatically. */
const skuText = z
  .string()
  .trim()
  .toUpperCase()
  .max(60)
  .regex(/^[A-Z0-9-]*$/, "Use letters, numbers and dashes only / শুধু অক্ষর, সংখ্যা ও ড্যাশ ব্যবহার করুন")
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
const device = z.enum(COMPATIBLE);
/** Stock lots that never expire carry this date, so first-expiry-first-out falls back to first-in-first-out. */
export const NO_EXPIRY = "2099-12-31";
const optDevice = device.optional().nullable().or(z.literal("").transform(() => null));
/** YYYY-MM-DD */
const dayDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-06-30 / তারিখ ২০২৭-০৬-৩০ এভাবে দিন").refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date / সঠিক তারিখ দিন");

/** Adds a bilingual issue for every misleading phrase (fake urgency, impossible promises) in the given copy fields. */
function noMisleadingClaims(fields: Record<string, unknown>, ctx: z.RefinementCtx) {
  for (const m of findMisleadingClaims(fields)) ctx.addIssue({ code: "custom", path: [m.field], message: claimMessage(m) });
}

export const address = z.object({
  division_id: z.coerce.number().int().positive(),
  district_id: z.coerce.number().int().positive(),
  upazila_id: z.coerce.number().int().positive(),
  division: reqText(60),
  district: reqText(60),
  upazila: reqText(80),
  area: z.string().trim().min(5, "Add house, road and area so the courier can find you / বাড়ি, রোড ও এলাকা লিখুন").max(300),
});

const utm = z
  .object({ source: text(100).optional(), medium: text(100).optional(), campaign: text(150).optional() })
  .optional()
  .default({});

const cartItems = z
  .array(z.object({ variantId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().min(1).max(20) }))
  .min(1)
  .max(50);

// ---------------------------------------------------------------- storefront
export const checkoutSchema = z.object({
  customer: z.object({ name: reqText(80), phone: bdPhone, email }),
  address,
  items: cartItems,
  couponCode: text(40).optional(),
  paymentMethod: z.enum(["COD", "bKash", "Nagad", "Rocket", "Card"]),
  paymentRef: text(60).optional(), // TrxID for manual MFS payments
  note: text(500).optional(),
  giftMessage: text(300).optional(),
  giftWrap: z.boolean().default(false),
  lang: z.enum(["bn", "en"]).default("bn"),
  turnstileToken: z.string().optional(),
  otpToken: z.string().max(100).optional(),
  sessionId: z.string().trim().max(64).optional(),
  utm,
  adRef: text(120).optional(),
  fbp: text(200).optional(),
  fbc: text(300).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const quoteSchema = z.object({
  items: cartItems,
  address: z.object({ division_id: z.coerce.number().int().positive(), district_id: z.coerce.number().int().positive(), upazila_id: z.coerce.number().int().positive() }).optional(),
  couponCode: text(40).optional(),
  phone: z.string().optional(),
  giftWrap: z.boolean().default(false),
});

/** Abandoned-checkout autosave (sent on field blur, debounced). Everything is optional — it's a draft. */
export const draftSchema = z.object({
  sessionId: z.string().trim().min(16).max(64),
  name: text(80).optional(),
  phone: z.string().trim().max(20).optional(),
  email: text(120).optional(),
  division: text(60).optional(),
  district: text(60).optional(),
  upazila: text(80).optional(),
  area: text(300).optional(),
  items: z.array(z.object({ variantId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().min(1).max(20) })).max(50).default([]),
  lastStep: z.enum(["cart", "contact", "address", "payment"]).default("contact"),
  utm,
  lang: z.enum(["bn", "en"]).default("bn"),
  fbp: text(200).optional(),
  fbc: text(300).optional(),
});

export const otpSendSchema = z.object({ phone: bdPhone, turnstileToken: z.string().optional(), lang: z.enum(["bn", "en"]).default("bn") });
export const otpVerifySchema = z.object({ phone: bdPhone, code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code / ৬ সংখ্যার কোড দিন") });

/** A customer's warranty claim, filed from their account against one line of a delivered order. */
export const WARRANTY_ISSUES = ["not_charging", "no_sound", "not_turning_on", "connection", "battery", "physical", "other"] as const;
export const warrantyClaimSchema = z.object({
  orderNo: reqText(40),
  orderItemId: z.coerce.number().int().positive(),
  issue: z.enum(WARRANTY_ISSUES),
  details: z.string().trim().min(10, "Tell us what happens, in a sentence or two / কী সমস্যা হচ্ছে এক-দুই লাইনে লিখুন").max(1500),
  serial: optText(60),
  photo_url: optText(500),
});
/** Staff moving a claim along: Submitted → Under review → Approved / Rejected → Resolved. */
export const warrantyClaimUpdateSchema = z.object({
  status: z.enum(["submitted", "under_review", "approved", "rejected", "resolved"]).optional(),
  resolution: z.enum(["repair", "replace", "refund", "none"]).optional().nullable(),
  customer_note: optText(1000),
  staff_note: optText(1000),
  notify: z.boolean().default(true),
});

/** A shopper's question on a product page, published once staff answer it. */
export const questionSchema = z.object({
  productId: z.coerce.number().int().positive(),
  name: reqText(60),
  question: z.string().trim().min(8, "Ask a full question / পুরো প্রশ্নটি লিখুন").max(500),
});
export const questionAnswerSchema = z.object({
  answer: optText(1500),
  status: z.enum(["pending", "published", "hidden"]).optional(),
});

/** Serial numbers received for one size/colour: one per line (or comma-separated), each unique in the shop. */
export const serialIntakeSchema = z.object({
  variantId: z.coerce.number().int().positive(),
  serials: z
    .string()
    .trim()
    .min(1, "Paste at least one serial number / অন্তত একটি সিরিয়াল নম্বর দিন")
    .max(20_000)
    .transform((v) => [...new Set(v.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))])
    .refine((list) => list.every((x) => /^[A-Z0-9][A-Z0-9-]{3,59}$/.test(x)), "Serials are 4–60 letters, digits and dashes / সিরিয়াল ৪–৬০ অক্ষর, সংখ্যা ও ড্যাশ")
    .refine((list) => list.length <= 500, "Up to 500 serials at a time / একবারে সর্বোচ্চ ৫০০টি"),
  batchId: z.coerce.number().int().positive().optional().nullable(),
  note: optText(200),
});

export const reviewSchema = z.object({
  productId: z.coerce.number().int().positive(),
  name: reqText(60),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(5).max(1000),
  orderNo: text(40).optional(),
  token: text(80).optional(),
});

export const registerSchema = z.object({
  name: reqText(80),
  phone: bdPhone,
  email,
  password: z.string().min(8).max(128),
  turnstileToken: z.string().optional(),
});

export const loginSchema = z.object({
  phone: bdPhone,
  password: z.string().min(1).max(128),
  turnstileToken: z.string().optional(),
});

export const savedAddressSchema = address.extend({
  label: text(30).default("Home"),
  recipient_name: reqText(80),
  phone: bdPhone,
  is_default: flag.default(0),
});

/** Gadget finder: the shopper's device and a budget → one in-stock product from each shelf that works with it. */
export const finderSchema = z.object({
  device: device,
  budget: z.coerce.number().int().min(300).max(200_000).default(3000),
});

export const returnRequestSchema = z.object({
  orderNo: reqText(40),
  reason: z.enum(["damaged", "wrong_item", "not_working", "not_as_described", "changed_mind", "other"]),
  details: optText(1000),
});

export const stockNotifySchema = z
  .object({
    productId: z.coerce.number().int().positive(),
    variantId: z.coerce.number().int().positive().optional().nullable(),
    phone: z.string().trim().optional(),
    email: z.union([z.literal(""), z.email()]).optional(),
    lang: z.enum(["bn", "en"]).default("bn"),
  })
  .transform((v, ctx) => {
    const phone = v.phone ? normalizeBdPhone(v.phone) : null;
    if (v.phone && !phone) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid mobile number / সঠিক মোবাইল নম্বর দিন" });
    if (!phone && !v.email) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a mobile number or email / মোবাইল নম্বর বা ইমেইল দিন" });
    return { ...v, phone, email: v.email || null };
  });

export const newsletterSchema = z.object({ contact: reqText(120), lang: z.enum(["bn", "en"]).default("bn") }).transform((v, ctx) => {
  const phone = normalizeBdPhone(v.contact);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contact);
  if (!phone && !isEmail) ctx.addIssue({ code: "custom", path: ["contact"], message: "Enter an email or mobile number / ইমেইল বা মোবাইল নম্বর দিন" });
  return { contact: phone ?? v.contact.toLowerCase(), lang: v.lang };
});

export const eventSchema = z.object({
  name: z.enum(["PageView", "ViewContent", "AddToCart", "InitiateCheckout"]),
  eventId: z.string().trim().min(8).max(80),
  url: z.string().max(500).optional(),
  value: z.coerce.number().min(0).max(10_000_000).optional(),
  contentIds: z.array(z.string().max(60)).max(50).optional(),
  numItems: z.coerce.number().int().min(0).max(1000).optional(),
  fbp: text(200).optional(),
  fbc: text(300).optional(),
});

// ---------------------------------------------------------------- admin
export const adminLoginId = z.string().trim().toLowerCase().min(3).max(120).regex(/^[a-z0-9._@+-]+$/, "Use letters, numbers, dot, dash or underscore");

export const adminLoginSchema = z.object({
  email: adminLoginId,
  password: z.string().min(1).max(128),
  totp: z.string().trim().optional(),
  turnstileToken: z.string().optional(),
});

export const variantSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  sku: skuText,
  size: text(40).default("Standard").transform((v) => v || "Standard"),
  color: text(40).default(""),
  stock: z.coerce.number().int().min(0).max(100000),
  price_override: money.optional().nullable(),
  low_stock_threshold: z.coerce.number().int().min(0).max(1000).default(3),
});

/**
 * A certification assigned to a product. The product-level document is optional; the storefront only shows the
 * badge when proof exists (this document or the business-wide one on the certification type) — see HELD_CERT_SQL in routes/public.ts.
 */
export const certificationSchema = z.object({
  type: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{2,40}$/, "Pick a certification / সার্টিফিকেশন বেছে নিন"),
  issuer: optText(120),
  certificate_no: optText(80),
  document_url: optText(500),
  document_name: optText(200),
  valid_until: isoDate,
  is_active: flag.default(1),
});

/** A certification type (organic, halal, lab-tested …) with its badge icon and, once held, the business certificate. */
export const certificationTypeSchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{2,40}$/, "Use lowercase letters and underscores, e.g. lab_tested / ছোট হাতের অক্ষর ও আন্ডারস্কোর দিন, যেমন lab_tested"),
  name_en: reqText(80),
  name_bn: reqText(80),
  description_en: optText(500),
  description_bn: optText(500),
  icon: z.enum(["leaf", "shield", "flask", "crescent", "check", "star", "drop"]).default("shield"),
  issuer: optText(120),
  document_url: optText(500),
  document_name: optText(200),
  valid_until: isoDate,
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: flag.default(1),
});

/** A bundle (combo deal) lists the products packed inside it (each at least once, no repeats, not itself). */
const bundleItem = z.object({ product_id: z.coerce.number().int().positive(), quantity: z.coerce.number().int().min(1).max(20).default(1) });

export const productSchema = z
  .object({
    slug,
    name_en: reqText(160),
    name_bn: reqText(160),
    description_en: optText(5000),
    description_bn: optText(5000),
    category_id: z.coerce.number().int().positive(),
    brand: optText(80),
    price: money.refine((v) => v > 0, { message: "Price must be more than 0 / দাম ০ এর বেশি হতে হবে" }),
    sale_price: money.optional().nullable(),
    discount_type: z.enum(["none", "percent", "flat"]).default("none"),
    discount_value: money.default(0),
    compatible: z.array(device).default([]),
    /** The spec sheet, in display order. Known keys (lib/sku.ts SPEC_KEYS) get bilingual labels; others show as typed. */
    specs: z
      .array(z.object({ key: z.string().trim().min(1, "Name the spec / স্পেকের নাম দিন").max(40), value: reqText(200) }))
      .max(40, "Up to 40 spec lines / সর্বোচ্চ ৪০টি স্পেক")
      .default([]),
    highlights: z
      .array(z.object({ name: reqText(80), benefit_en: optText(200), benefit_bn: optText(200) }))
      .max(4, "Call out up to 4 key features / সর্বোচ্চ ৪টি মূল ফিচার")
      .default([]),
    in_box_en: optText(1000),
    in_box_bn: optText(1000),
    warranty_months: z.coerce.number().int().min(0).max(60).default(0),
    /** Deal of the Day: the sale price ends here (the home page counts down to it). Empty = an ordinary sale. */
    deal_until: isoDate,
    bundle_items: z.array(bundleItem).max(12).default([]),
    how_to_use_en: optText(2000),
    how_to_use_bn: optText(2000),
    caution_en: optText(600),
    caution_bn: optText(600),
    origin: optText(80),
    tags: text(300).default(""),
    images: z.array(z.string().trim().max(500)).max(12).default([]),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    is_featured: flag.default(0),
    /** "zone" = delivery charge auto-calculated from the customer's area; "free" = ships free. */
    delivery_mode: z.enum(["zone", "free"]).default("zone"),
    meta_title: optText(160),
    meta_description: optText(320),
    variants: z.array(variantSchema).min(1).max(200),
    certifications: z.array(certificationSchema).max(9).default([]),
  })
  .superRefine((p, ctx) => {
    if (p.discount_type === "percent" && (p.discount_value < 1 || p.discount_value > 90)) {
      ctx.addIssue({ code: "custom", path: ["discount_value"], message: "Discount must be 1–90% / ছাড় ১–৯০% হতে হবে" });
    }
    if (p.discount_type === "flat" && (p.discount_value < 1 || p.discount_value >= p.price)) {
      ctx.addIssue({ code: "custom", path: ["discount_value"], message: "Discount must be less than the price / ছাড় দামের চেয়ে কম হতে হবে" });
    }
    if (p.discount_type === "none" && p.sale_price != null && p.sale_price > 0 && p.sale_price >= p.price) {
      ctx.addIssue({ code: "custom", path: ["sale_price"], message: "Sale price must be lower than the regular price / ছাড়ের দাম আসল দামের চেয়ে কম হতে হবে" });
    }
    const seen = new Set<string>();
    p.variants.forEach((v, i) => {
      const k = `${v.size}|${v.color}`.toLowerCase();
      if (seen.has(k)) ctx.addIssue({ code: "custom", path: ["variants", i, "size"], message: "Duplicate option / একই অপশন দুবার দেওয়া হয়েছে" });
      seen.add(k);
    });
    const skus = new Set<string>();
    p.variants.forEach((v, i) => {
      if (!v.sku) return;
      if (skus.has(v.sku)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "Each option needs its own SKU / প্রতিটি অপশনের আলাদা SKU দরকার" });
      skus.add(v.sku);
    });
    const types = new Set<string>();
    p.certifications.forEach((c, i) => {
      if (types.has(c.type)) ctx.addIssue({ code: "custom", path: ["certifications", i, "type"], message: "This badge is listed twice / এই ব্যাজ দুবার দেওয়া হয়েছে" });
      types.add(c.type);
    });
    if (p.status === "active" && !p.specs.length) {
      ctx.addIssue({ code: "custom", path: ["specs"], message: "Add the spec sheet before publishing / প্রকাশের আগে স্পেসিফিকেশন দিন" });
    }
    const specKeys = new Set<string>();
    p.specs.forEach((sp, i) => {
      const k = sp.key.toLowerCase();
      if (specKeys.has(k)) ctx.addIssue({ code: "custom", path: ["specs", i, "key"], message: "This spec is listed twice / এই স্পেক দুবার দেওয়া হয়েছে" });
      specKeys.add(k);
    });
    if (p.deal_until && !(p.sale_price || p.discount_type !== "none")) {
      ctx.addIssue({ code: "custom", path: ["deal_until"], message: "A deal needs a sale price or discount / ডিলে ছাড়ের দাম বা ডিসকাউন্ট দিন" });
    }
    const inKit = new Set<number>();
    p.bundle_items.forEach((b, i) => {
      if (inKit.has(b.product_id)) ctx.addIssue({ code: "custom", path: ["bundle_items", i, "product_id"], message: "This product is already in the bundle / এই পণ্যটি বান্ডেলে আগেই আছে" });
      inKit.add(b.product_id);
    });
    if (p.bundle_items.length === 1) ctx.addIssue({ code: "custom", path: ["bundle_items"], message: "A bundle needs at least 2 products / বান্ডেলে অন্তত ২টি পণ্য দিন" });
    noMisleadingClaims(
      {
        name_en: p.name_en, name_bn: p.name_bn, description_en: p.description_en, description_bn: p.description_bn,
        how_to_use_en: p.how_to_use_en, how_to_use_bn: p.how_to_use_bn, meta_title: p.meta_title, meta_description: p.meta_description,
        ...Object.fromEntries(p.highlights.flatMap((h, i) => [[`highlights.${i}.benefit_en`, h.benefit_en], [`highlights.${i}.benefit_bn`, h.benefit_bn]])),
        ...Object.fromEntries(p.specs.map((sp, i) => [`specs.${i}.value`, sp.value])),
      },
      ctx,
    );
  })
  .transform((p) => ({
    ...p,
    sale_price: salePriceFor(p.price, p.discount_type, p.discount_value, p.sale_price || null),
    discount_value: p.discount_type === "none" ? 0 : p.discount_value,
  }));
export type ProductInput = z.infer<typeof productSchema>;

/** Optional tile tone (mustard, olive, clay, terracotta, stone, rose-clay); blank "—" arrives as "" and means none. */
const tileColor = z
  .enum(["yellow", "mint", "lavender", "peach", "sky", "pink"])
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

export const categorySchema = z.object({
  slug,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,4}$/, "2–4 capital letters used in SKUs, e.g. OIL / SKU-তে ব্যবহৃত ২–৪টি বড় হাতের অক্ষর, যেমন OIL"),
  parent_id: z.coerce.number().int().positive().optional().nullable(),
  name_en: reqText(80),
  name_bn: reqText(80),
  description_en: optText(1000),
  description_bn: optText(1000),
  image_url: optText(500),
  color: tileColor,
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: flag.default(1),
});

export const customerSchema = z.object({
  name: reqText(80),
  phone: bdPhone,
  email,
  is_blocked: flag.default(0),
  notes: optText(2000),
});

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/, { message: "Letters, numbers, - and _ only / শুধু অক্ষর, সংখ্যা, - ও _" })
      .transform((v) => v.toUpperCase()),
    description: optText(200),
    type: z.enum(["percent", "flat", "free_delivery"]),
    value: z.coerce.number().int().min(0).max(1_000_000).default(0),
    min_order: money.default(0),
    max_discount: money.optional().nullable(),
    starts_at: isoDate,
    expires_at: isoDate,
    usage_limit: z.coerce.number().int().min(1).optional().nullable(),
    per_customer_limit: z.coerce.number().int().min(1).optional().nullable(),
    category_ids: idList,
    is_active: flag.default(1),
  })
  .transform((c) => (c.type === "free_delivery" ? { ...c, value: 0, max_discount: null } : c))
  .superRefine((c, ctx) => {
    if (c.type !== "free_delivery" && c.value < 1) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter the discount amount / ছাড়ের পরিমাণ লিখুন" });
    if (c.type === "percent" && c.value > 90) ctx.addIssue({ code: "custom", path: ["value"], message: "Percentage cannot exceed 90% / শতাংশ ৯০% এর বেশি হতে পারবে না" });
    if (c.starts_at && c.expires_at && Date.parse(c.expires_at) <= Date.parse(c.starts_at))
      ctx.addIssue({ code: "custom", path: ["expires_at"], message: "Expiry must be after the start date / মেয়াদ শেষের তারিখ শুরুর পরে হতে হবে" });
  });

export const bannerSchema = z.object({
  placement: z.enum(["hero", "offer", "marketing", "popup"]),
  title_en: reqText(120),
  title_bn: reqText(120),
  subtitle_en: optText(240),
  subtitle_bn: optText(240),
  cta_en: optText(40),
  cta_bn: optText(40),
  link_url: optText(500),
  image_url: optText(500),
  color: tileColor,
  starts_at: isoDate,
  ends_at: isoDate,
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: flag.default(1),
});

/** Collection ("setup"): hand-picked products, optionally for one device. Drives "Goes well with" on product pages. */
export const collectionSchema = z
  .object({
  slug,
  name_en: reqText(120),
  name_bn: reqText(120),
  description_en: optText(1000),
  description_bn: optText(1000),
  image_url: optText(500),
  device: optDevice,
  product_ids: z
    .array(z.coerce.number().int().positive())
    .max(24)
    .default([])
    .transform((ids) => [...new Set(ids)])
    .refine((ids) => ids.length >= 2, { message: "Pick at least 2 products for a collection / কালেকশনে অন্তত ২টি পণ্য দিন" }),
  is_featured: flag.default(0),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: flag.default(1),
  })
  .superRefine((c, ctx) => noMisleadingClaims({ name_en: c.name_en, name_bn: c.name_bn, description_en: c.description_en, description_bn: c.description_bn }, ctx));

export const landingSchema = z.object({
  slug,
  title_en: reqText(120),
  title_bn: reqText(120),
  subtitle_en: optText(300),
  subtitle_bn: optText(300),
  offer_en: optText(200),
  offer_bn: optText(200),
  image_url: optText(500),
  product_id: z.coerce.number().int().positive().optional().nullable(),
  coupon_code: optText(30),
  cta_en: optText(40),
  cta_bn: optText(40),
  color: tileColor,
  is_active: flag.default(1),
});

export const reviewModerationSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  reply: optText(1000),
  name: reqText(60).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  body: z.string().trim().min(1).max(1000).optional(),
  product_id: z.coerce.number().int().positive().optional(),
  /** Customer photo (e.g. sent on WhatsApp) — shown with the review on the home page. */
  photo_url: optText(500),
});

/** Tech guide (buying guides, how-tos). Copy goes through the same honest-copy check as products. */
export const postSchema = z
  .object({
    slug,
    title_en: reqText(160),
    title_bn: reqText(160),
    excerpt_en: optText(400),
    excerpt_bn: optText(400),
    body_en: optText(20000),
    body_bn: optText(20000),
    cover_url: optText(500),
    product_ids: idList.transform((ids) => [...new Set(ids)].slice(0, 6)),
    author: optText(80),
    status: z.enum(["draft", "published"]).default("draft"),
    published_at: isoDate,
  })
  .superRefine((p, ctx) =>
    noMisleadingClaims({ title_en: p.title_en, title_bn: p.title_bn, excerpt_en: p.excerpt_en, excerpt_bn: p.excerpt_bn, body_en: p.body_en, body_bn: p.body_bn }, ctx),
  );

/** Stock intake: a lot (shipment) with its lot / supplier-invoice number; expiry only for stock that dates. Adds qty to the variant's stock. */
export const batchSchema = z
  .object({
    variantId: z.coerce.number().int().positive(),
    batch_no: z.string().trim().toUpperCase().min(1, "Enter the lot or supplier-invoice number / লট বা সাপ্লায়ার-ইনভয়েস নম্বর দিন").max(40),
    /** Most gadgets don't expire: leave it empty and the lot is stored as "no expiry" (2099-12-31). */
    expiry_date: dayDate.optional().nullable().or(z.literal("").transform(() => null)).transform((v) => v ?? NO_EXPIRY),
    manufactured_on: dayDate.optional().nullable().or(z.literal("").transform(() => null)),
    quantity: z.coerce.number().int().min(1).max(100_000),
    supplier: optText(120),
    cost_price: money.optional().nullable().or(z.literal("").transform(() => null)),
    note: optText(300),
  })
  .superRefine((b, ctx) => {
    if (b.manufactured_on && b.manufactured_on >= b.expiry_date)
      ctx.addIssue({ code: "custom", path: ["expiry_date"], message: "Expiry must be after the manufacturing date / মেয়াদ উৎপাদনের তারিখের পরে হতে হবে" });
  });

export const batchWriteOffSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(100_000),
  note: reqText(300),
});

export const zoneSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/, { message: "lowercase_with_underscores" }),
  name_en: reqText(80),
  name_bn: reqText(80),
  fee: money,
  free_shipping_min: money.optional().nullable(),
  division_ids: idList,
  district_ids: idList,
  upazila_ids: idList,
  eta_en: optText(60),
  eta_bn: optText(60),
  is_default: flag.default(0),
  is_active: flag.default(1),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export const staffSchema = z.object({
  name: reqText(80),
  email: adminLoginId,
  phone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v, ctx) => {
      if (!v) return null;
      const p = normalizeBdPhone(v);
      if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid mobile number / সঠিক মোবাইল নম্বর দিন" });
      return p;
    }),
  role: z.enum(["super_admin", "manager", "order_processor", "viewer"]),
  is_active: flag.default(1),
  password: z.string().min(10).max(128).optional(),
});

export const ORDER_STATUSES = ["pending", "confirmation_attempted", "confirmed", "packed", "shipped", "delivered", "cancelled", "refused", "returned"] as const;

export const statusChangeSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: text(500).optional(),
  courier: z.enum(["Steadfast", "Pathao", "RedX"]).optional(),
  trackingId: text(80).optional(),
  createConsignment: z.boolean().optional(),
  notify: z.boolean().default(true),
});

export const attemptSchema = z.object({
  outcome: z.enum(["no_answer", "confirmed", "declined"]),
  method: z.enum(["call", "whatsapp", "sms"]).default("call"),
  note: text(500).optional(),
});

export const orderEditSchema = z.object({
  customer_name: reqText(80).optional(),
  customer_phone: bdPhone.optional(),
  customer_email: email,
  area: reqText(300).optional(),
  admin_notes: optText(2000),
  payment_status: z.enum(["pending", "paid", "failed", "refunded", "partially_refunded"]).optional(),
  payment_ref: optText(60),
  courier_partner: z.enum(["Steadfast", "Pathao", "RedX"]).optional().nullable(),
  tracking_id: optText(80),
  courier_status: optText(60),
});

export const refundSchema = z.object({
  amount: z.coerce.number().int().min(1),
  note: reqText(500),
});

export const stockAdjustSchema = z.object({
  variantId: z.coerce.number().int().positive(),
  mode: z.enum(["set", "add", "remove"]),
  quantity: z.coerce.number().int().min(0).max(100000),
  reason: z.enum(["restock", "adjustment", "return", "expired"]).default("adjustment"),
  note: text(300).optional(),
});

export const returnUpdateSchema = z.object({
  status: z.enum(["approved", "rejected", "received", "refunded"]),
  refund_amount: z.coerce.number().int().min(0).optional(),
  refund_method: optText(60),
  admin_note: optText(1000),
});

export const abandonedUpdateSchema = z.object({
  action: z.enum(["contacted", "recovered", "ignored", "reopen", "send_recovery"]),
  note: text(300).optional(),
});
