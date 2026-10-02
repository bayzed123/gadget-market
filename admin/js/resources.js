// Declarative definitions for the simpler admin modules. The generic view (views/resource.js) turns each one
// into a searchable, filterable list (with CSV export) and create/edit slide-overs, delete→Trash and restore.
import { t, tt, num, money, dt, lang } from "./i18n.js";
import { html, pill, api, raw, riskBadge, toast, msg, errMsg, session, uploadImage } from "./core.js";

const L = (en, bn) => ({ en, bn });
const yes = (v) => (v ? pill("active", t("yesNo_1")) : pill("inactive", t("yesNo_0")));
// Tile / banner tones. The stored keys stay generic; the dark shop shows them as a deep tint with a neon accent.
export const COLORS = [["sky", L("Electric blue", "ইলেকট্রিক নীল")], ["mint", L("Cyan / teal", "সায়ান / টিল")], ["lavender", L("Violet", "বেগুনি")], ["yellow", L("Amber", "অ্যাম্বার")], ["peach", L("Coral", "কোরাল")], ["pink", L("Magenta", "ম্যাজেন্টা")]];
/** Devices a product works with. Keep in sync with worker/src/lib/codes.ts (COMPATIBLE / COMPATIBLE_LABELS). */
export const DEVICES = [["iphone", L("iPhone", "আইফোন")], ["android", L("Android phones", "অ্যান্ড্রয়েড ফোন")], ["usb_c", L("USB-C devices", "USB-C ডিভাইস")], ["lightning", L("Lightning (older iPhone)", "লাইটনিং (পুরোনো আইফোন)")], ["laptop", L("Laptops", "ল্যাপটপ")], ["mac", L("Mac", "ম্যাক")], ["windows", L("Windows PC", "উইন্ডোজ পিসি")], ["ps5", L("PlayStation 5", "প্লেস্টেশন ৫")], ["xbox", L("Xbox", "এক্সবক্স")], ["switch", L("Nintendo Switch", "নিনটেন্ডো সুইচ")], ["smart_tv", L("Smart TV", "স্মার্ট টিভি")]];
/** Standard spec-sheet names (they line up in the shop's comparison table). Keep in sync with worker/src/lib/codes.ts SPEC_KEYS. */
export const SPEC_KEYS = [["model", L("Model", "মডেল")], ["battery", L("Battery", "ব্যাটারি")], ["capacity", L("Capacity", "ক্যাপাসিটি")], ["playtime", L("Playtime", "চলবে")], ["charging_time", L("Charging time", "চার্জ হতে সময়")], ["wattage", L("Output / wattage", "আউটপুট / ওয়াট")], ["input", L("Input", "ইনপুট")], ["ports", L("Ports", "পোর্ট")], ["connectivity", L("Connectivity", "কানেক্টিভিটি")], ["bluetooth", L("Bluetooth", "ব্লুটুথ")], ["range", L("Range", "রেঞ্জ")], ["driver", L("Driver", "ড্রাইভার")], ["anc", L("Noise cancelling", "নয়েজ ক্যান্সেলিং")], ["microphone", L("Microphone", "মাইক্রোফোন")], ["display", L("Display", "ডিসপ্লে")], ["sensors", L("Sensors", "সেন্সর")], ["water", L("Water resistance", "পানি প্রতিরোধ")], ["length", L("Length", "দৈর্ঘ্য")], ["material", L("Material", "উপাদান")], ["dimensions", L("Dimensions", "মাপ")], ["weight", L("Weight", "ওজন")], ["compatibility", L("Compatibility", "সাপোর্ট করে")]];
/** Badge icons available for certification types. Keep in sync with certificationTypeSchema. */
export const CERT_ICONS = [["shield", L("Shield (official warranty / authorised)", "ঢাল (অফিশিয়াল ওয়ারেন্টি / অনুমোদিত)")], ["check", L("Tick (QC tested)", "টিক (QC পরীক্ষিত)")], ["star", L("Star", "তারা")], ["flask", L("Flask (lab / safety tested)", "ফ্লাস্ক (ল্যাব / নিরাপত্তা পরীক্ষিত)")], ["leaf", L("Leaf (eco packaging)", "পাতা (পরিবেশবান্ধব প্যাকেজিং)")], ["drop", L("Drop (water-resistance tested)", "ফোঁটা (পানি প্রতিরোধ পরীক্ষিত)")], ["crescent", L("Crescent", "চাঁদ")]];
export const NO_CLAIMS = L("Only write what the spec sheet supports. No “100% waterproof” (give the IP rating), “unbreakable”, “lifetime warranty”, “best in Bangladesh”, fake stock counts or “offer ends today” — copy like that is refused when you save.", "স্পেক শিটে যা আছে শুধু তাই লিখুন। “১০০% ওয়াটারপ্রুফ” (IP রেটিং দিন), “ভাঙবে না”, “আজীবন ওয়ারেন্টি”, “বাংলাদেশের সেরা”, বানানো স্টক সংখ্যা বা “আজই অফার শেষ” লিখবেন না — এমন লেখা সংরক্ষণ হবে না।");

const PLACEMENTS = [
  ["hero", L("Hero slider (top of home page)", "হিরো স্লাইডার (হোমপেজের উপরে)")],
  ["offer", L("Offer banner (wide strip under the hero)", "অফার ব্যানার (হিরোর নিচে চওড়া স্ট্রিপ)")],
  ["marketing", L("Marketing card (middle of home page)", "মার্কেটিং কার্ড (হোমপেজের মাঝে)")],
  ["popup", L("Popup (once per visitor)", "পপআপ (প্রতি ভিজিটরকে একবার)")],
];
const PLACEMENT_SHORT = { hero: L("Hero slider", "হিরো স্লাইডার"), offer: L("Offer banner", "অফার ব্যানার"), marketing: L("Marketing card", "মার্কেটিং কার্ড"), popup: L("Popup", "পপআপ") };

/** "Shop logo" card: shows the current logo, uploads a new one and saves it to Settings → Shop information. */
async function logoCard(el) {
  const Lx = (en, bn) => (lang() === "bn" ? bn : en);
  let store;
  try { store = (await api("/settings")).settings.store; } catch { return; }
  const canEdit = session.perms.has("settings.manage");
  el.innerHTML = String(html`<div class="card logo-card"><div class="logo-preview"><img src="${store.logo_url || "/img/logo.svg"}" alt="" id="logo-now"></div>
    <div><h3 style="margin:0 0 4px">${Lx("Shop logo", "দোকানের লোগো")}</h3><p class="muted small" style="margin:0 0 10px">${Lx("Shows in the shop header, footer and admin. Square PNG/JPG/WebP works best.", "দোকানের হেডার, ফুটার ও অ্যাডমিনে দেখায়। বর্গাকার PNG/JPG/WebP ভালো হয়।")}</p>
    ${canEdit ? html`<div class="chips"><label class="btn primary sm">${Lx("Upload new logo", "নতুন লোগো আপলোড")}<input type="file" accept="image/*" id="logo-up" hidden></label>${store.logo_url ? html`<button class="btn sm" type="button" id="logo-reset">${Lx("Use default logo", "ডিফল্ট লোগো")}</button>` : ""}</div>` : html`<p class="small muted">${Lx("Only a Super Admin can change the logo.", "শুধু সুপার অ্যাডমিন লোগো বদলাতে পারেন।")}</p>`}</div></div>`);
  const save = async (url) => {
    const r = await api("/settings/store", { method: "PUT", body: { ...store, logo_url: url } });
    store.logo_url = url;
    toast(msg(r));
    logoCard(el);
  };
  el.querySelector("#logo-up")?.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { toast(t("uploading")); await save((await uploadImage(f, "branding")).url); } catch (err) { toast(errMsg(err), "err"); }
  });
  el.querySelector("#logo-reset")?.addEventListener("click", async () => { try { await save(""); } catch (err) { toast(errMsg(err), "err"); } });
}

let catOptions;
export const categoryOptions = async () =>
  (catOptions ??= api("/categories?limit=200&sort=sort_order").then((r) => r.items.map((c) => [c.id, (c.parent_name ? `${c.parent_name} › ` : "") + (lang() === "bn" ? c.name_bn : c.name_en)])));
let prodOptions;
const productOptions = async () => (prodOptions ??= api("/products?limit=200&status=active").then((r) => r.items.map((p) => [p.id, lang() === "bn" ? p.name_bn : p.name_en])));
let pickOptions;
/** Active products with photo and price for the collection picker. */
const productPickerOptions = async () =>
  (pickOptions ??= api("/products?limit=200&status=active&sort=name").then((r) => r.items.map((p) => [p.id, lang() === "bn" ? p.name_bn : p.name_en, p.image, p.sale_price ?? p.price])));
let geo;
const geoData = async () => (geo ??= fetch("/data/bd-geo.json").then((r) => r.json()));

/** Fills the slug from the English name until the slug is edited by hand. */
function slugFromName(form, from = "name_en") {
  const name = form.elements[from], slug = form.elements.slug;
  let touched = Boolean(slug.value);
  slug.addEventListener("input", () => (touched = true));
  name.addEventListener("input", () => { if (!touched) slug.value = name.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80); });
}

export const RESOURCES = {
  customers: {
    endpoint: "/customers",
    perm: "customers",
    csv: true,
    title: L("Customers", "গ্রাহক"),
    nameOf: (r) => r.name,
    filters: [
      { name: "risk_level", label: L("Risk", "ঝুঁকি"), options: [["", L("Everyone", "সবাই")], ["low", L("🟢 Trusted", "🟢 বিশ্বস্ত")], ["medium", L("🟡 New", "🟡 নতুন")], ["high", L("🔴 Verify before shipping", "🔴 পাঠানোর আগে যাচাই")]] },
      { name: "is_blocked", label: L("Status", "অবস্থা"), options: [["", L("All", "সব")], ["0", L("Active", "চালু")], ["1", L("Blocked", "ব্লক করা")]] },
    ],
    columns: [
      { label: L("Name", "নাম"), render: (r) => html`<b>${r.name}</b>${r.has_account ? html` <span class="pill active">${lang() === "bn" ? "অ্যাকাউন্ট" : "Account"}</span>` : ""}<br><span class="muted small">${r.email ?? ""}</span>` },
      { label: L("Phone", "ফোন"), render: (r) => html`<a href="tel:${r.phone}">${r.phone}</a>` },
      { label: L("Risk", "ঝুঁকি"), render: (r) => riskBadge(r.risk_level, r.risk_badge, r.risk_reason) },
      { label: L("Delivered / Refused·Returned / Cancelled", "ডেলিভারি / নেননি·ফেরত / বাতিল"), render: (r) => `${num(r.delivered_count)} / ${num(r.refused_or_returned_count)} / ${num(r.cancelled_count)}` },
      { label: L("Spent", "মোট কেনা"), render: (r) => money(r.total_spent) },
      { label: L("Status", "অবস্থা"), render: (r) => (r.is_blocked ? pill("blocked", lang() === "bn" ? "ব্লক" : "Blocked") : pill("active", t("active"))) },
    ],
    fields: async () => [
      { name: "name", label: L("Full name", "পুরো নাম"), required: true },
      { name: "phone", label: L("Mobile number", "মোবাইল নম্বর"), required: true, placeholder: "01XXXXXXXXX" },
      { name: "email", label: L("Email", "ইমেইল"), type: "email" },
      { name: "is_blocked", label: L("Block this customer (they can't order or sign in)", "এই গ্রাহককে ব্লক করুন (অর্ডার বা সাইন ইন করতে পারবেন না)"), type: "checkbox", span: 2 },
      { name: "notes", label: L("Internal notes (only staff can see)", "অভ্যন্তরীণ নোট (শুধু স্টাফ দেখবেন)"), type: "textarea", span: 2 },
    ],
    rowActions: (r) => html`<button class="btn sm" data-act="toggle-block">${r.is_blocked ? (lang() === "bn" ? "আনব্লক" : "Unblock") : lang() === "bn" ? "ব্লক" : "Block"}</button>`,
    onAction: async (act, r) => {
      if (act === "toggle-block") return api(`/customers/${r.id}`, { method: "PUT", body: { name: r.name, phone: r.phone, email: r.email ?? "", notes: r.notes ?? "", is_blocked: r.is_blocked ? 0 : 1 } });
    },
    detail: (r) => html`<p>${riskBadge(r.risk_level, r.risk_badge, r.risk_reason)} <span class="muted small">${r.risk_reason ? tt(r.risk_reason) : ""}</span></p>
      <h3>${t("orders")}</h3>${(r.orders ?? []).length ? html`<table class="table">${r.orders.map((o) => html`<tr><td data-label="#"><a href="#/orders/${o.id}">${o.order_no}</a></td><td data-label="${t("status")}">${pill(o.status, t(`s_${o.status}`))}</td><td data-label="${t("total")}">${money(o.total)}</td><td data-label="${t("date")}">${dt(o.created_at)}</td></tr>`)}</table>` : html`<p class="muted">—</p>`}
      ${(r.addresses ?? []).length ? html`<h3>${lang() === "bn" ? "সংরক্ষিত ঠিকানা" : "Saved addresses"}</h3>${r.addresses.map((a) => html`<p class="small"><b>${a.label}</b>: ${a.area}, ${a.upazila}, ${a.district}</p>`)}` : ""}
`,
  },

  coupons: {
    endpoint: "/coupons",
    perm: "coupons",
    csv: true,
    title: L("Coupons & discounts", "কুপন ও ছাড়"),
    nameOf: (r) => r.code,
    filters: [
      { name: "type", label: L("Type", "ধরন"), options: [["", L("All types", "সব ধরন")], ["percent", L("Percentage", "শতাংশ")], ["flat", L("Flat amount", "নির্দিষ্ট টাকা")], ["free_delivery", L("Free delivery", "ফ্রি ডেলিভারি")]] },
      { name: "kind", label: L("Made by", "কে তৈরি করেছে"), options: [["", L("All", "সব")], ["standard", L("Staff", "স্টাফ")], ["recovery", L("Cart recovery", "কার্ট রিকভারি")], ["referral_reward", L("Referral reward", "রেফারেল রিওয়ার্ড")]] },
    ],
    columns: [
      { label: L("Code", "কোড"), render: (r) => html`<b style="letter-spacing:.06em">${r.code}</b><br><span class="muted small">${r.description ?? ""}</span>` },
      { label: L("Discount", "ছাড়"), render: (r) => (r.type === "free_delivery" ? `🚚 ${lang() === "bn" ? "ফ্রি ডেলিভারি" : "Free delivery"}` : (r.type === "percent" ? `${num(r.value)}%` : money(r.value)) + (r.max_discount ? ` (≤ ${money(r.max_discount)})` : "")) },
      { label: L("Min. order", "সর্বনিম্ন অর্ডার"), render: (r) => money(r.min_order) },
      { label: L("Used", "ব্যবহৃত"), render: (r) => `${num(r.used_count)}${r.usage_limit ? ` / ${num(r.usage_limit)}` : ""}` },
      { label: L("Expires", "মেয়াদ"), render: (r) => (r.expires_at ? dt(r.expires_at) : "—") },
      { label: L("Status", "অবস্থা"), render: (r) => (r.expires_at && Date.parse(r.expires_at) < Date.now() ? pill("inactive", lang() === "bn" ? "মেয়াদোত্তীর্ণ" : "Expired") : yes(r.is_active)) },
    ],
    fields: async () => [
      { name: "code", label: L("Coupon code", "কুপন কোড"), required: true, placeholder: "EID25", hint: L("Customers type this at checkout.", "গ্রাহক চেকআউটে এটি লিখবেন।") },
      { name: "description", label: L("Description (for staff)", "বিবরণ (স্টাফের জন্য)") },
      { name: "type", label: L("Discount type", "ছাড়ের ধরন"), type: "select", options: [["percent", L("Percentage (%)", "শতাংশ (%)")], ["flat", L("Flat amount (৳)", "নির্দিষ্ট টাকা (৳)")], ["free_delivery", L("Free delivery (no delivery charge)", "ফ্রি ডেলিভারি (ডেলিভারি চার্জ নেই)")]], required: true },
      { name: "value", label: L("Discount value", "ছাড়ের পরিমাণ"), type: "number", required: true, min: 0 },
      { name: "min_order", label: L("Minimum order (৳)", "সর্বনিম্ন অর্ডার (৳)"), type: "money", default: 0 },
      { name: "max_discount", label: L("Maximum discount (৳, optional)", "সর্বোচ্চ ছাড় (৳, ঐচ্ছিক)"), type: "money" },
      { name: "starts_at", label: L("Starts", "শুরু"), type: "date" },
      { name: "expires_at", label: L("Expires", "শেষ"), type: "date" },
      { name: "usage_limit", label: L("Total uses allowed (optional)", "মোট কতবার ব্যবহার করা যাবে (ঐচ্ছিক)"), type: "number", min: 1 },
      { name: "per_customer_limit", label: L("Uses per customer (optional)", "প্রতি গ্রাহক কতবার (ঐচ্ছিক)"), type: "number", min: 1 },
      { name: "category_ids", label: L("Only for these categories (empty = whole shop)", "শুধু এই ক্যাটাগরিতে (খালি রাখলে পুরো দোকানে)"), type: "multiselect", options: await categoryOptions(), span: 2, hint: L("Hold Ctrl/⌘ (or long-press on phone) to select several.", "একাধিক বাছতে Ctrl/⌘ চেপে ধরুন (ফোনে লম্বা চাপ দিন)।") },
      { name: "is_active", label: L("Coupon is active", "কুপন চালু আছে"), type: "checkbox", default: 1, span: 2 },
    ],
    /** "Free delivery" coupons have no amount — hide the amount fields for them. */
    onForm: (form) => {
      const sync = () => {
        const free = form.type.value === "free_delivery";
        for (const n of ["value", "max_discount"]) form[n].closest(".field").hidden = free;
        if (free) form.value.value = "0";
        else if (form.value.value === "0") form.value.value = "";
      };
      form.type.addEventListener("change", sync);
      sync();
    },
  },

  banners: {
    endpoint: "/banners",
    perm: "banners",
    title: L("Banners & logo", "ব্যানার ও লোগো"),
    intro: L("Hero slider: top of the home page. Offer banner: a wide strip under the hero. Marketing cards: a row of promo cards in the middle of the home page. Popup: shows once to each visitor (not on checkout). Set start/stop dates to run a campaign on its own.", "হিরো স্লাইডার: হোমপেজের উপরে। অফার ব্যানার: হিরোর নিচে চওড়া স্ট্রিপ। মার্কেটিং কার্ড: হোমপেজের মাঝে প্রোমো কার্ড। পপআপ: প্রতি ভিজিটরকে একবার দেখায় (চেকআউটে নয়)। শুরু/শেষের তারিখ দিলে ক্যাম্পেইন নিজে থেকেই চলবে।"),
    nameOf: (r) => r.title_en,
    filters: [{ name: "placement", label: L("Placement", "অবস্থান"), options: [["", L("All", "সব")], ...PLACEMENTS] }],
    columns: [
      { label: L("Image", "ছবি"), render: (r) => (r.image_url ? html`<img class="thumb" src="${r.image_url}" alt="">` : "—") },
      { label: L("Title", "শিরোনাম"), render: (r) => html`<b>${lang() === "bn" ? r.title_bn : r.title_en}</b><br><span class="muted small">${r.link_url ?? ""}</span>` },
      { label: L("Placement", "অবস্থান"), render: (r) => pill(r.placement, tt(PLACEMENT_SHORT[r.placement] ?? L(r.placement, r.placement))) },
      { label: L("Showing", "দেখাচ্ছে"), render: (r) => yes(r.is_active && (!r.ends_at || Date.parse(r.ends_at) > Date.now()) && (!r.starts_at || Date.parse(r.starts_at) <= Date.now())) },
    ],
    fields: async () => [
      { name: "placement", label: L("Where to show", "কোথায় দেখাবে"), type: "select", options: PLACEMENTS, required: true, span: 2 },
      { name: "title_en", label: L("Title (English)", "শিরোনাম (ইংরেজি)"), required: true },
      { name: "title_bn", label: L("Title (Bangla)", "শিরোনাম (বাংলা)"), required: true },
      { name: "subtitle_en", label: L("Subtitle (English)", "উপশিরোনাম (ইংরেজি)") },
      { name: "subtitle_bn", label: L("Subtitle (Bangla)", "উপশিরোনাম (বাংলা)") },
      { name: "cta_en", label: L("Button text (English)", "বাটনের লেখা (ইংরেজি)") },
      { name: "cta_bn", label: L("Button text (Bangla)", "বাটনের লেখা (বাংলা)") },
      { name: "link_url", label: L("Button link", "বাটনের লিংক"), placeholder: "/collections/work-from-home", span: 2 },
      { name: "image_url", label: L("Image", "ছবি"), type: "image", span: 2 },
      { name: "color", label: L("Background colour", "পেছনের রং"), type: "select", options: COLORS },
      { name: "sort_order", label: L("Order (smaller shows first)", "ক্রম (ছোট সংখ্যা আগে)"), type: "number", default: 0 },
      { name: "starts_at", label: L("Start showing", "দেখানো শুরু"), type: "date" },
      { name: "ends_at", label: L("Stop showing", "দেখানো বন্ধ"), type: "date" },
      { name: "is_active", label: L("Active", "চালু"), type: "checkbox", default: 1 },
    ],
    /** Logo card above the banner list: preview, upload and save in one place. */
    top: logoCard,
  },

  collections: {
    endpoint: "/collections",
    perm: "collections",
    csv: true,
    title: L("Collections", "সংগ্রহ"),
    intro: L("Group gear that goes well together — e.g. a work-from-home desk with a keyboard, a mouse and a USB-C hub, or an iPhone travel kit. Each product's page shows the others under “Goes well with”, and featured collections appear on the home page. Pick a device to show the collection in that device's “Works with” page.", "একসাথে ভালো যায় এমন গ্যাজেট রাখুন — যেমন কিবোর্ড, মাউস ও USB-C হাব দিয়ে ওয়ার্ক-ফ্রম-হোম ডেস্ক, বা আইফোন ট্রাভেল কিট। প্রতিটি পণ্যের পেজে বাকিগুলো “একসাথে ভালো যায়” অংশে দেখাবে, আর ফিচার করা সংগ্রহ হোমপেজে আসবে। ডিভাইস বেছে দিলে সংগ্রহটি সেই ডিভাইসের পেজে দেখাবে।"),
    nameOf: (r) => r.name_en,
    filters: [
      { name: "device", label: L("Works with", "সাপোর্ট করে"), options: [["", L("All", "সব")], ...DEVICES] },
      { name: "is_active", label: L("Status", "অবস্থা"), options: [["", L("All", "সব")], ["1", L("Active", "চালু")], ["0", L("Hidden", "লুকানো")]] },
    ],
    columns: [
      { label: L("Cover", "কভার"), render: (r) => (r.image_url ? html`<img class="thumb" src="${r.image_url}" alt="">` : "—") },
      { label: L("Collection", "সংগ্রহ"), render: (r) => html`<b>${lang() === "bn" ? r.name_bn : r.name_en}</b>${r.is_featured ? " ★" : ""}<br><span class="muted small">/collections/${r.slug}</span>` },
      { label: L("Works with", "সাপোর্ট করে"), render: (r) => (r.device ? tt(Object.fromEntries(DEVICES)[r.device]) : lang() === "bn" ? "সব ডিভাইস" : "Any device") },
      { label: L("Products", "পণ্য"), render: (r) => num(r.piece_count) },
      { label: L("Together", "সব মিলিয়ে"), render: (r) => money(r.set_value) },
      { label: L("Showing", "দেখাচ্ছে"), render: (r) => yes(r.is_active) },
    ],
    fields: async () => [
      { name: "name_en", label: L("Name (English)", "নাম (ইংরেজি)"), required: true },
      { name: "name_bn", label: L("Name (Bangla)", "নাম (বাংলা)"), required: true },
      { name: "slug", label: L("Web address (slug)", "ওয়েব ঠিকানা (slug)"), required: true, placeholder: "work-from-home" },
      { name: "device", label: L("Works with (optional)", "সাপোর্ট করে (ঐচ্ছিক)"), type: "select", allowEmpty: true, options: DEVICES },
      { name: "description_en", label: L("Description (English)", "বিবরণ (ইংরেজি)"), type: "textarea", rows: 2, hint: NO_CLAIMS },
      { name: "description_bn", label: L("Description (Bangla)", "বিবরণ (বাংলা)"), type: "textarea", rows: 2 },
      { name: "image_url", label: L("Cover photo (optional — the first product's photo is used otherwise)", "কভার ছবি (ঐচ্ছিক — না দিলে প্রথম পণ্যের ছবি)"), type: "image", span: 2 },
      { name: "product_ids", label: L("Products (tick in the order to show them; 2–24)", "পণ্য (যে ক্রমে দেখাবেন সে ক্রমে টিক দিন; ২–২৪টি)"), type: "picker", options: await productPickerOptions() },
      { name: "is_featured", label: L("Feature on the home page", "হোমপেজে ফিচার করুন"), type: "checkbox" },
      { name: "sort_order", label: L("Order (smaller shows first)", "ক্রম (ছোট সংখ্যা আগে)"), type: "number", default: 0 },
      { name: "is_active", label: L("Active", "চালু"), type: "checkbox", default: 1 },
    ],
    onForm: (form) => slugFromName(form),
  },

  certifications: {
    endpoint: "/certifications",
    perm: "certifications",
    csv: true,
    title: L("Trust badges", "ট্রাস্ট ব্যাজ"),
    intro: L("The trust badges you can show — official brand warranty, BTRC approved, authorised distributor, QC tested … A badge appears in the shop only when proof is on file: attach the business-wide document here (e.g. your distribution letter), or a product's own document (e.g. its BTRC approval) in the product form. Expired documents stop showing automatically.", "যে ট্রাস্ট ব্যাজ দেখাতে পারেন — অফিশিয়াল ব্র্যান্ড ওয়ারেন্টি, বিটিআরসি অনুমোদিত, অনুমোদিত পরিবেশক, QC পরীক্ষিত … প্রমাণ থাকলেই কেবল দোকানে ব্যাজ দেখাবে: পুরো ব্যবসার ডকুমেন্ট এখানে যুক্ত করুন (যেমন পরিবেশক চিঠি), অথবা কোনো পণ্যের নিজস্ব ডকুমেন্ট (যেমন বিটিআরসি অনুমোদন) পণ্যের ফর্মে। মেয়াদ শেষ হলে ব্যাজ নিজে থেকেই সরে যায়।"),
    nameOf: (r) => r.name_en,
    filters: [{ name: "is_active", label: L("Status", "অবস্থা"), options: [["", L("All", "সব")], ["1", L("Active", "চালু")], ["0", L("Hidden", "লুকানো")]] }],
    columns: [
      { label: L("Badge", "ব্যাজ"), render: (r) => html`<span class="pill">${raw(`<svg class="icon" aria-hidden="true"><use href="#i-${r.icon}"/></svg>`)} ${lang() === "bn" ? r.name_bn : r.name_en}</span><br><span class="muted small">${r.code}</span>` },
      { label: L("Issued by", "প্রদানকারী"), render: (r) => r.issuer ?? "—" },
      { label: L("Business certificate", "ব্যবসার সনদ"), render: (r) => (r.held ? pill("active", lang() === "bn" ? "যুক্ত ✓" : "On file ✓") : r.document_url ? pill("cancelled", lang() === "bn" ? "মেয়াদ শেষ" : "Expired") : html`<span class="muted small">${lang() === "bn" ? "নেই — শুধু পণ্যের সনদে দেখাবে" : "None — shows only with a product certificate"}</span>`) },
      { label: L("Valid until", "মেয়াদ"), render: (r) => (r.valid_until ? dt(r.valid_until) : "—") },
      { label: L("Products", "পণ্য"), render: (r) => num(r.product_count) },
      { label: L("Active", "চালু"), render: (r) => yes(r.is_active) },
    ],
    fields: async () => [
      { name: "name_en", label: L("Name (English)", "নাম (ইংরেজি)"), required: true, placeholder: "BTRC approved" },
      { name: "name_bn", label: L("Name (Bangla)", "নাম (বাংলা)"), required: true, placeholder: "বিটিআরসি অনুমোদিত" },
      { name: "code", label: L("Code", "কোড"), required: true, placeholder: "btrc", hint: L("Short, lowercase, underscores — e.g. btrc, official_warranty, qc_tested. Can't be changed once products use it.", "ছোট হাতের ইংরেজি ও আন্ডারস্কোর — যেমন btrc, official_warranty, qc_tested।") },
      { name: "icon", label: L("Badge icon", "ব্যাজের আইকন"), type: "select", options: CERT_ICONS },
      { name: "issuer", label: L("Issued by", "প্রদানকারী"), placeholder: "BTRC" },
      { name: "valid_until", label: L("Valid until (business certificate)", "মেয়াদ (ব্যবসার সনদ)"), type: "date" },
      { name: "document_url", label: L("Business-wide certificate (PDF or photo, optional)", "পুরো ব্যবসার সনদ (PDF বা ছবি, ঐচ্ছিক)"), type: "document", span: 2, hint: L("Attach it only if the document covers everything with this badge (e.g. one distribution letter for a whole brand). Otherwise leave it blank and attach each product's own document in the product form.", "শুধু তখনই দিন যখন ডকুমেন্টটি এই ব্যাজের সব পণ্যে প্রযোজ্য (যেমন পুরো ব্র্যান্ডের একটি পরিবেশক চিঠি)। নাহলে খালি রাখুন এবং প্রতিটি পণ্যের ডকুমেন্ট পণ্যের ফর্মে দিন।") },
      { name: "document_name", label: L("Document name", "ডকুমেন্টের নাম"), span: 2 },
      { name: "description_en", label: L("What it means (English)", "এর মানে কী (ইংরেজি)"), type: "textarea", rows: 2 },
      { name: "description_bn", label: L("What it means (Bangla)", "এর মানে কী (বাংলা)"), type: "textarea", rows: 2 },
      { name: "sort_order", label: L("Order (smaller shows first)", "ক্রম (ছোট সংখ্যা আগে)"), type: "number", default: 0 },
      { name: "is_active", label: L("Active", "চালু"), type: "checkbox", default: 1 },
    ],
  },

  posts: {
    endpoint: "/posts",
    perm: "posts",
    csv: true,
    title: L("Buying guides", "কেনার গাইড"),
    intro: L("Short, practical guides — which charger for which phone, what an IP rating means, ANC vs ENC … Good for Google and for answering customers' questions. The same honest-copy check as products applies.", "ছোট, কাজের গাইড — কোন ফোনে কোন চার্জার, IP রেটিং মানে কী, ANC বনাম ENC … গুগলে খুঁজে পেতে ও গ্রাহকের প্রশ্নের উত্তরে কাজে লাগে। পণ্যের মতোই সৎ-লেখা যাচাই হয়।"),
    nameOf: (r) => r.title_en,
    filters: [{ name: "status", label: L("Status", "অবস্থা"), options: [["", L("All", "সব")], ["published", L("Published", "প্রকাশিত")], ["draft", L("Draft", "ড্রাফট")]] }],
    columns: [
      { label: L("Cover", "কভার"), render: (r) => (r.cover_url ? html`<img class="thumb" src="${r.cover_url}" alt="">` : "—") },
      { label: L("Article", "লেখা"), render: (r) => html`<b>${lang() === "bn" ? r.title_bn : r.title_en}</b><br><a class="small" href="/guides/${r.slug}" target="_blank" rel="noopener">/guides/${r.slug}</a>` },
      { label: L("Author", "লেখক"), render: (r) => r.author ?? "—" },
      { label: L("Published", "প্রকাশ"), render: (r) => (r.status === "published" ? html`${pill("active", lang() === "bn" ? "প্রকাশিত" : "Published")}<br><span class="muted small">${r.published_at ? dt(r.published_at) : ""}</span>` : pill("pending", lang() === "bn" ? "ড্রাফট" : "Draft")) },
    ],
    fields: async () => [
      { name: "title_en", label: L("Title (English)", "শিরোনাম (ইংরেজি)"), required: true },
      { name: "title_bn", label: L("Title (Bangla)", "শিরোনাম (বাংলা)"), required: true },
      { name: "slug", label: L("Web address (slug)", "ওয়েব ঠিকানা (slug)"), required: true, placeholder: "which-charger-for-iphone-15" },
      { name: "author", label: L("Author", "লেখক") },
      { name: "excerpt_en", label: L("Short summary (English)", "সংক্ষেপ (ইংরেজি)"), type: "textarea", rows: 2, hint: NO_CLAIMS },
      { name: "excerpt_bn", label: L("Short summary (Bangla)", "সংক্ষেপ (বাংলা)"), type: "textarea", rows: 2 },
      { name: "body_en", label: L("Article (English) — leave a blank line between paragraphs", "লেখা (ইংরেজি) — অনুচ্ছেদের মাঝে একটি ফাঁকা লাইন"), type: "textarea", rows: 10, span: 2 },
      { name: "body_bn", label: L("Article (Bangla) — leave a blank line between paragraphs", "লেখা (বাংলা) — অনুচ্ছেদের মাঝে একটি ফাঁকা লাইন"), type: "textarea", rows: 10, span: 2 },
      { name: "cover_url", label: L("Cover photo", "কভার ছবি"), type: "image", span: 2 },
      { name: "product_ids", label: L("Products mentioned (up to 6)", "যে পণ্যের কথা আছে (সর্বোচ্চ ৬টি)"), type: "picker", options: await productPickerOptions() },
      { name: "status", label: L("Status", "অবস্থা"), type: "select", options: [["draft", L("Draft — not visible", "ড্রাফট — দেখা যাবে না")], ["published", L("Published", "প্রকাশিত")]] },
      { name: "published_at", label: L("Publish date (blank = now; a future date schedules it)", "প্রকাশের তারিখ (খালি = এখন; ভবিষ্যতের তারিখ দিলে তখন প্রকাশ হবে)"), type: "date" },
    ],
    onForm: (form) => slugFromName(form, "title_en"),
  },

  landing: {
    endpoint: "/landing",
    perm: "landing",
    title: L("Campaign landing pages", "ক্যাম্পেইন ল্যান্ডিং পেজ"),
    intro: L("A simple page for one ad: one headline, one offer, one button — no menus to distract. Share /lp/<address> in your ad; orders are tracked to the campaign.", "একটি বিজ্ঞাপনের জন্য সহজ পেজ: একটি শিরোনাম, একটি অফার, একটি বাটন — কোনো মেনু নেই। বিজ্ঞাপনে /lp/<ঠিকানা> দিন; অর্ডার ক্যাম্পেইনে গণনা হবে।"),
    nameOf: (r) => r.title_en,
    filters: [],
    columns: [
      { label: L("Page", "পেজ"), render: (r) => html`<b>${lang() === "bn" ? r.title_bn : r.title_en}</b><br><a class="small" href="/lp/${r.slug}" target="_blank">/lp/${r.slug}</a>` },
      { label: L("Product", "পণ্য"), render: (r) => r.product_name ?? "—" },
      { label: L("Views", "ভিউ"), render: (r) => num(r.views) },
      { label: L("Orders", "অর্ডার"), render: (r) => num(r.orders) },
      { label: L("Active", "চালু"), render: (r) => yes(r.is_active) },
    ],
    fields: async () => [
      { name: "slug", label: L("Web address", "ওয়েব ঠিকানা"), required: true, placeholder: "anc-earbuds-offer", hint: L("lowercase-with-dashes → /lp/anc-earbuds-offer", "ছোট হাতের ইংরেজি ও ড্যাশ") },
      { name: "product_id", label: L("Product (button adds it to the cart)", "পণ্য (বাটন কার্টে যোগ করবে)"), type: "select", numeric: true, allowEmpty: true, options: await productOptions() },
      { name: "title_en", label: L("Headline (English)", "শিরোনাম (ইংরেজি)"), required: true },
      { name: "title_bn", label: L("Headline (Bangla)", "শিরোনাম (বাংলা)"), required: true },
      { name: "subtitle_en", label: L("Sub-headline (English)", "উপশিরোনাম (ইংরেজি)") },
      { name: "subtitle_bn", label: L("Sub-headline (Bangla)", "উপশিরোনাম (বাংলা)") },
      { name: "offer_en", label: L("Offer (English)", "অফার (ইংরেজি)") },
      { name: "offer_bn", label: L("Offer (Bangla)", "অফার (বাংলা)") },
      { name: "coupon_code", label: L("Coupon applied automatically (optional)", "স্বয়ংক্রিয় কুপন (ঐচ্ছিক)") },
      { name: "color", label: L("Background colour", "পেছনের রং"), type: "select", options: COLORS },
      { name: "cta_en", label: L("Button text (English)", "বাটনের লেখা (ইংরেজি)") },
      { name: "cta_bn", label: L("Button text (Bangla)", "বাটনের লেখা (বাংলা)") },
      { name: "image_url", label: L("Image (optional — product photo is used otherwise)", "ছবি (ঐচ্ছিক)"), type: "image", span: 2 },
      { name: "is_active", label: L("Active", "চালু"), type: "checkbox", default: 1 },
    ],
  },

  reviews: {
    endpoint: "/reviews",
    perm: "reviews",
    writePerm: "reviews.moderate",
    csv: true,
    title: L("Reviews", "রিভিউ"),
    nameOf: (r) => `${r.name} — ${r.product_name}`,
    noCreate: true,
    filters: [
      { name: "status", label: L("Status", "অবস্থা"), options: [["", L("All", "সব")], ["pending", L("Waiting", "অপেক্ষমাণ")], ["approved", L("Approved", "অনুমোদিত")], ["rejected", L("Rejected", "বাতিল")]] },
    ],
    columns: [
      { label: L("Photo", "ছবি"), render: (r) => (r.photo_url ? html`<img class="thumb" src="${r.photo_url}" alt="">` : "—") },
      { label: L("Review", "রিভিউ"), render: (r) => html`<span style="color:var(--a-primary)">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>${r.verified_purchase ? html` <span class="pill active">${lang() === "bn" ? "যাচাইকৃত ক্রেতা" : "Verified buyer"}</span>` : ""}<br>${r.body}${r.reply ? html`<br><span class="muted small">↳ ${r.reply}</span>` : ""}` },
      { label: L("By", "লিখেছেন"), render: (r) => html`<b>${r.name}</b><br><span class="muted small">${dt(r.created_at)}</span>` },
      { label: L("Product", "পণ্য"), render: (r) => html`<a href="/product/${r.product_slug}" target="_blank" rel="noopener">${r.product_name}</a>` },
      { label: L("Status", "অবস্থা"), render: (r) => pill(r.status) },
    ],
    fields: async () => [
      { name: "status", label: L("Status", "অবস্থা"), type: "select", options: [["pending", L("Waiting", "অপেক্ষমাণ")], ["approved", L("Approved — show on the website", "অনুমোদিত — ওয়েবসাইটে দেখাবে")], ["rejected", L("Rejected — hide", "বাতিল — লুকানো")]], span: 2 },
      { name: "reply", label: L("Public reply from the shop (optional)", "দোকানের পক্ষ থেকে উত্তর (ঐচ্ছিক)"), type: "textarea", span: 2 },
      { name: "photo_url", label: L("Customer photo (optional)", "ক্রেতার ছবি (ঐচ্ছিক)"), type: "image", span: 2, hint: L("Only a photo this customer sent you (WhatsApp / Messenger) and agreed to share — never a stock or model photo.", "শুধু এই ক্রেতা নিজে যে ছবি পাঠিয়েছেন এবং দেখাতে রাজি হয়েছেন — কখনো স্টক বা মডেলের ছবি নয়।") },
    ],
    rowActions: (r) => html`${r.status !== "approved" ? html`<button class="btn sm" data-act="approved">✓ ${t("approve")}</button>` : ""} ${r.status !== "rejected" ? html`<button class="btn sm" data-act="rejected">✕ ${t("reject")}</button>` : ""}`,
    onAction: (act, r) => api(`/reviews/${r.id}`, { method: "PUT", body: { status: act } }),
  },

  zones: {
    endpoint: "/zones",
    perm: "zones",
    title: L("Delivery areas & fees", "ডেলিভারি এলাকা ও চার্জ"),
    nameOf: (r) => r.name_en,
    filters: [],
    intro: L("The most specific rule wins: an upazila/thana rule beats a district rule, a district beats a division, and the default zone covers everywhere else. Fees here are shown live at checkout.", "সবচেয়ে নির্দিষ্ট নিয়মটি প্রযোজ্য: উপজেলা/থানা → জেলা → বিভাগ → ডিফল্ট জোন। এখানের চার্জ চেকআউটে সরাসরি দেখানো হয়।"),
    columns: [
      { label: L("Zone", "জোন"), render: (r) => html`<b>${lang() === "bn" ? r.name_bn : r.name_en}</b><br><span class="muted small">${r.code}${r.is_default ? " · default" : ""}</span>` },
      { label: L("Fee", "চার্জ"), render: (r) => money(r.fee) },
      { label: L("Free over", "যত টাকার উপরে ফ্রি"), render: (r) => (r.free_shipping_min ? money(r.free_shipping_min) : "—") },
      { label: L("Covers", "এলাকা"), render: (r) => (r.is_default ? (lang() === "bn" ? "বাকি সব এলাকা" : "Everywhere else") : [r.division_ids.length ? `${num(r.division_ids.length)} ${lang() === "bn" ? "বিভাগ" : "divisions"}` : "", r.district_ids.length ? `${num(r.district_ids.length)} ${lang() === "bn" ? "জেলা" : "districts"}` : "", r.upazila_ids.length ? `${num(r.upazila_ids.length)} ${lang() === "bn" ? "উপজেলা" : "upazilas"}` : ""].filter(Boolean).join(", ")) },
      { label: L("Delivery time", "ডেলিভারির সময়"), render: (r) => (lang() === "bn" ? r.eta_bn : r.eta_en) ?? "—" },
    ],
    fields: async () => {
      const g = await geoData();
      const nm = (en, bn) => (lang() === "bn" ? bn : en);
      const dname = Object.fromEntries(g.districts.map(([id, , en, bn]) => [id, nm(en, bn)]));
      return [
        { name: "name_en", label: L("Zone name (English)", "জোনের নাম (ইংরেজি)"), required: true },
        { name: "name_bn", label: L("Zone name (Bangla)", "জোনের নাম (বাংলা)"), required: true },
        { name: "code", label: L("Short code", "শর্ট কোড"), required: true, placeholder: "dhaka_city", hint: L("lowercase_with_underscores", "ছোট হাতের ইংরেজি ও _") },
        { name: "fee", label: L("Delivery fee (৳)", "ডেলিভারি চার্জ (৳)"), type: "money", required: true },
        { name: "free_shipping_min", label: L("Free delivery on orders over (৳, optional)", "এর বেশি অর্ডারে ফ্রি ডেলিভারি (৳, ঐচ্ছিক)"), type: "money" },
        { name: "sort_order", label: L("Order", "ক্রম"), type: "number", default: 0 },
        { name: "eta_en", label: L("Delivery time (English)", "ডেলিভারির সময় (ইংরেজি)"), placeholder: "2–3 days" },
        { name: "eta_bn", label: L("Delivery time (Bangla)", "ডেলিভারির সময় (বাংলা)"), placeholder: "২–৩ দিন" },
        { name: "division_ids", label: L("Whole divisions", "পুরো বিভাগ"), type: "multiselect", options: g.divisions.map(([id, en, bn]) => [id, nm(en, bn)]), span: 2 },
        { name: "district_ids", label: L("Districts", "জেলা"), type: "multiselect", options: g.districts.map(([id, , en, bn]) => [id, nm(en, bn)]).sort((a, b) => a[1].localeCompare(b[1])), span: 2 },
        { name: "upazila_ids", label: L("Specific upazilas / thanas", "নির্দিষ্ট উপজেলা / থানা"), type: "multiselect", options: g.upazilas.map(([id, d, en, bn]) => [id, `${nm(en, bn)} (${dname[d]})`]).sort((a, b) => a[1].localeCompare(b[1])), span: 2 },
        { name: "is_default", label: L("Default zone (used when nothing else matches)", "ডিফল্ট জোন (অন্য কিছু না মিললে)"), type: "checkbox" },
        { name: "is_active", label: L("Active", "চালু"), type: "checkbox", default: 1 },
      ];
    },
  },

  staff: {
    endpoint: "/staff",
    perm: "staff",
    writePerm: "staff.manage",
    deletePerm: "staff.manage",
    title: L("Staff & roles", "স্টাফ ও রোল"),
    intro: L("Super Admins and Managers sign in with a password plus a code from their phone's authenticator app. Order Processors and Viewers can simply sign in with their mobile number and an SMS code.", "সুপার অ্যাডমিন ও ম্যানেজার পাসওয়ার্ড + অথেন্টিকেটর অ্যাপের কোড দিয়ে সাইন ইন করেন। অর্ডার প্রসেসর ও ভিউয়ার শুধু মোবাইল নম্বর ও SMS কোড দিয়ে সাইন ইন করতে পারেন।"),
    nameOf: (r) => r.name,
    filters: [{ name: "role", label: L("Role", "রোল"), options: [["", L("All", "সব")], ["super_admin", "Super Admin"], ["manager", "Manager"], ["order_processor", "Order Processor"], ["viewer", "Viewer"]] }],
    columns: [
      { label: L("Name", "নাম"), render: (r) => html`<b>${r.name}</b><br><span class="muted small">${r.email}${r.phone ? ` · ${r.phone}` : ""}</span>` },
      { label: L("Role", "রোল"), render: (r) => pill("confirmed", r.role.replace("_", " ")) },
      { label: L("2-step", "২-ধাপ"), render: (r) => (r.totp_enabled ? pill("active", "✓") : ["super_admin", "manager"].includes(r.role) ? pill("pending", lang() === "bn" ? "প্রথম সাইন-ইনে" : "at first sign-in") : "—") },
      { label: L("Last seen", "শেষ দেখা"), render: (r) => dt(r.last_seen_at ?? r.last_login_at, true) },
      { label: L("Status", "অবস্থা"), render: (r) => yes(r.is_active) },
    ],
    fields: async () => [
      { name: "name", label: L("Name", "নাম"), required: true },
      { name: "email", label: L("Username or email (to sign in)", "ইউজারনেম বা ইমেইল (সাইন ইনের জন্য)"), required: true },
      { name: "phone", label: L("Mobile number (for SMS sign-in)", "মোবাইল নম্বর (SMS সাইন-ইনের জন্য)"), placeholder: "01XXXXXXXXX" },
      { name: "role", label: L("Role", "রোল"), type: "select", required: true, options: [["order_processor", L("Order Processor — handles orders", "অর্ডার প্রসেসর — অর্ডার সামলান")], ["manager", L("Manager — everything except staff & settings", "ম্যানেজার — স্টাফ ও সেটিংস ছাড়া সব")], ["viewer", L("Read-only Viewer", "শুধু দেখতে পারবেন")], ["super_admin", L("Super Admin — full control", "সুপার অ্যাডমিন — সম্পূর্ণ নিয়ন্ত্রণ")]] },
      { name: "password", label: L("Password (min 10 characters; leave empty to keep)", "পাসওয়ার্ড (কমপক্ষে ১০ অক্ষর; পরিবর্তন না করলে খালি রাখুন)"), type: "password", span: 2 },
      { name: "is_active", label: L("Can sign in", "সাইন ইন করতে পারবেন"), type: "checkbox", default: 1, span: 2 },
    ],
    rowActions: (r) => (r.totp_enabled ? html`<button class="btn sm" data-act="reset2fa">${t("reset2fa")}</button>` : ""),
    onAction: async (act, r) => {
      if (act === "reset2fa") { const x = await api(`/staff/${r.id}/reset-2fa`, { method: "POST" }); toast(msg(x)); }
    },
    extra: async () => {
      const r = await api("/roles");
      const roles = Object.keys(r.matrix);
      const groups = [...new Set(r.permissions.map((p) => p.split(".")[0]))];
      return html`<div class="card" style="margin-top:20px"><h2>${t("roleMatrix")}</h2><div style="overflow-x:auto"><table class="table"><thead><tr><th></th>${roles.map((ro) => html`<th>${tt(r.labels[ro])}</th>`)}</tr></thead>
        <tbody>${groups.map((g) => html`<tr><td data-label=""><b>${g}</b></td>${roles.map((ro) => html`<td data-label="${tt(r.labels[ro])}">${r.permissions.filter((p) => p.startsWith(g + ".")).map((p) => raw(r.matrix[ro].includes(p) ? `<span class="pill active" style="margin:2px">${p.split(".")[1]}</span>` : ""))}</td>`)}</tr>`)}</tbody></table></div></div>`;
    },
  },
};
