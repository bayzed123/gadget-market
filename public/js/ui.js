// Reusable storefront pieces: product cards, "works with" device chips, warranty badge, the Deal-of-the-Day countdown,
// spec table, compare tray, collection / bundle / guide cards, trust badges, the warranty-terms note, loading/empty/error
// states.
import { t, L, money, num, lang, tt, date, digits } from "./i18n.js";
import { html, raw, icon, wishlist, toast, cart } from "./core.js";
import { track } from "./track.js";

/** Devices a product works with (same codes as worker/src/lib/codes.ts COMPATIBLE). */
export const DEVICE_LABELS = {
  iphone: { en: "iPhone", bn: "আইফোন" },
  android: { en: "Android", bn: "অ্যান্ড্রয়েড" },
  usb_c: { en: "USB-C", bn: "USB-C" },
  lightning: { en: "Lightning", bn: "লাইটনিং" },
  laptop: { en: "Laptop", bn: "ল্যাপটপ" },
  mac: { en: "Mac", bn: "ম্যাক" },
  windows: { en: "Windows PC", bn: "উইন্ডোজ পিসি" },
  ps5: { en: "PS5", bn: "PS5" },
  xbox: { en: "Xbox", bn: "এক্সবক্স" },
  switch: { en: "Switch", bn: "সুইচ" },
  smart_tv: { en: "Smart TV", bn: "স্মার্ট টিভি" },
};
export const DEVICE_ICONS = { iphone: "phone", android: "phone", usb_c: "plug", lightning: "bolt", laptop: "laptop", mac: "laptop", windows: "laptop", ps5: "gamepad", xbox: "gamepad", switch: "gamepad", smart_tv: "tv" };
export const deviceLabel = (k) => (DEVICE_LABELS[k] ? tt(DEVICE_LABELS[k]) : k);

/** Spec-sheet labels (same keys as worker/src/lib/codes.ts SPEC_KEYS); any other key is shown as typed. */
export const SPEC_LABELS = {
  model: { en: "Model", bn: "মডেল" }, battery: { en: "Battery", bn: "ব্যাটারি" }, capacity: { en: "Capacity", bn: "ক্যাপাসিটি" },
  playtime: { en: "Playtime", bn: "চলবে" }, charging_time: { en: "Charging time", bn: "চার্জ হতে সময়" }, wattage: { en: "Output / wattage", bn: "আউটপুট / ওয়াট" },
  input: { en: "Input", bn: "ইনপুট" }, ports: { en: "Ports", bn: "পোর্ট" }, connectivity: { en: "Connectivity", bn: "কানেক্টিভিটি" },
  bluetooth: { en: "Bluetooth", bn: "ব্লুটুথ" }, range: { en: "Range", bn: "রেঞ্জ" }, driver: { en: "Driver", bn: "ড্রাইভার" },
  anc: { en: "Noise cancelling", bn: "নয়েজ ক্যান্সেলিং" }, microphone: { en: "Microphone", bn: "মাইক্রোফোন" }, display: { en: "Display", bn: "ডিসপ্লে" },
  sensors: { en: "Sensors", bn: "সেন্সর" }, water: { en: "Water resistance", bn: "পানি প্রতিরোধ" }, length: { en: "Length", bn: "দৈর্ঘ্য" },
  material: { en: "Material", bn: "উপাদান" }, dimensions: { en: "Dimensions", bn: "মাপ" }, weight: { en: "Weight", bn: "ওজন" },
  compatibility: { en: "Compatibility", bn: "সাপোর্ট করে" }, in_box: { en: "In the box", bn: "বক্সে যা আছে" },
};
export const specLabel = (k) => (SPEC_LABELS[k] ? tt(SPEC_LABELS[k]) : k.replace(/_/g, " "));

export const stars = (n, size = "sm") =>
  raw(`<span class="stars ${size}" aria-label="${Number(n).toFixed(1)} / 5">${[1, 2, 3, 4, 5].map((i) => `<svg class="icon ${i <= Math.round(n) ? "on" : ""}" aria-hidden="true"><use href="#i-star"/></svg>`).join("")}</span>`);

/** "Works with" chips. */
export const deviceChips = (list, max = 3) => {
  const l = list ?? [];
  if (!l.length) return "";
  return html`<span class="device-chips">${l.slice(0, max).map((d) => html`<span class="chip dev">${deviceLabel(d)}</span>`)}${l.length > max ? html`<span class="chip dev">+${num(l.length - max)}</span>` : ""}</span>`;
};

/** "12-month warranty" / "1-year warranty" / "No warranty". */
export const warrantyText = (m) => (!m ? t("noWarranty") : m % 12 === 0 ? t("warrantyYears", { n: num(m / 12) }) : t("warrantyMonths", { n: num(m) }));
export const warrantyBadge = (m, { big = false } = {}) =>
  html`<span class="warranty-badge ${m ? "" : "none"} ${big ? "big" : ""}">${icon("shield")} <span>${warrantyText(m)}</span></span>`;

/** The end of a deal day in Bangladesh (UTC+6): YYYY-MM-DD → ms. */
export const dealEndMs = (day) => {
  const [y, m, d] = String(day).slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d, 18, 0, 0); // 24:00 in Dhaka
};

/**
 * A live countdown to a real deal end (from the database — never invented). Every [data-countdown] on the page is
 * ticked by one timer; when it reaches zero it says the deal has ended instead of looping.
 */
export const countdown = (day, { compact = false } = {}) =>
  html`<span class="countdown ${compact ? "compact" : ""}" data-countdown="${dealEndMs(day)}" role="timer" aria-label="${t("dealEnds")}">${countdownParts(dealEndMs(day) - Date.now(), compact)}</span>`;
function countdownParts(ms, compact) {
  if (ms <= 0) return html`<span class="cd-ended">${t("dealEnded")}</span>`;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => digits(String(n).padStart(2, "0"));
  const cell = (v, l) => html`<span class="cd-cell"><b>${v}</b><small>${l}</small></span>`;
  if (compact) return html`${icon("clock")} <b class="mono">${d ? `${digits(d)}${lang() === "bn" ? "দি" : "d"} ` : ""}${pad(h)}:${pad(m)}:${pad(sec)}</b>`;
  return html`${d ? cell(digits(d), t("days")) : ""}${cell(pad(h), t("hours"))}${cell(pad(m), t("mins"))}${cell(pad(sec), t("secs"))}`;
}
let ticking = false;
export function startCountdowns() {
  if (ticking) return;
  ticking = true;
  const tick = () => {
    const els = document.querySelectorAll("[data-countdown]");
    els.forEach((el) => {
      const left = Number(el.dataset.countdown) - Date.now();
      el.innerHTML = String(countdownParts(left, el.classList.contains("compact")));
      if (left <= 0) el.removeAttribute("data-countdown");
    });
    setTimeout(tick, 1000);
  };
  tick();
}

// ---------- compare (2–3 products, kept in this browser) ----------
const CMP = "gmk_compare";
export const compare = {
  ids() {
    try { return JSON.parse(localStorage.getItem(CMP) || "[]").filter(Number.isInteger).slice(0, 3); } catch { return []; }
  },
  has(id) { return this.ids().includes(id); },
  toggle(id) {
    let ids = this.ids();
    if (ids.includes(id)) ids = ids.filter((x) => x !== id);
    else if (ids.length >= 3) { toast(t("compareMax"), "error"); return false; }
    else ids.push(id);
    try { localStorage.setItem(CMP, JSON.stringify(ids)); } catch { /* private mode */ }
    document.dispatchEvent(new CustomEvent("compare:change"));
    return ids.includes(id);
  },
  clear() {
    try { localStorage.removeItem(CMP); } catch { /* ignore */ }
    document.dispatchEvent(new CustomEvent("compare:change"));
  },
};
/** The floating "Compare (n)" bar. */
export function renderCompareTray() {
  let el = document.getElementById("compare-tray");
  const ids = compare.ids();
  if (!el) {
    el = document.createElement("div");
    el.id = "compare-tray";
    el.className = "compare-tray";
    document.body.append(el);
    el.addEventListener("click", (e) => { if (e.target.closest("[data-compare-clear]")) compare.clear(); });
  }
  el.hidden = !ids.length || location.pathname === "/compare";
  el.innerHTML = String(html`${icon("compare")}<span>${ids.length < 2 ? t("compareNeed2") : t("compareTitle")}</span>
    <a class="btn primary sm" href="/compare?ids=${ids.join(",")}" ${ids.length < 2 ? raw('aria-disabled="true"') : ""}>${t("compareNow", { n: num(ids.length) })}</a>
    <button class="btn ghost sm" type="button" data-compare-clear>${t("compareClear")}</button>`);
}

export function productCard(p) {
  const saved = wishlist.ids().has(p.id);
  const cmp = compare.has(p.id);
  const price = p.sale_price && p.sale_price < p.price ? p.sale_price : p.price;
  return html`<article class="card product-card">
    <a class="thumb" href="/product/${p.slug}" aria-label="${L(p, "name")}">
      <img src="${p.images?.[0] ?? "/img/logo.svg"}" alt="" loading="lazy" width="400" height="400">
      ${p.discount_percent ? html`<span class="tag sale">-${num(p.discount_percent)}%</span>` : ""}
      ${!p.in_stock ? html`<span class="tag soldout">${t("outOfStock")}</span>` : ""}
      ${p.is_bundle ? html`<span class="tag kit">${icon("box")} ${t("bundle")}</span>` : ""}
      ${p.deal_until && p.in_stock ? html`<span class="tag deal">${countdown(p.deal_until, { compact: true })}</span>` : ""}
    </a>
    <button class="wish ${saved ? "on" : ""}" type="button" data-wish="${p.id}" aria-pressed="${saved}" aria-label="${t("wishlist")}">${icon("heart")}</button>
    <div class="body">
      ${p.brand ? html`<span class="brand-line">${p.brand}</span>` : ""}
      <h3><a href="/product/${p.slug}">${L(p, "name")}</a></h3>
      ${deviceChips(p.compatible, 3)}
      ${p.rating_count ? html`<div class="rating">${stars(p.rating_avg)} <span class="muted small">(${num(p.rating_count)})</span></div>` : ""}
      <div class="price-row"><b class="price">${money(price)}</b>${price < p.price ? html`<s class="muted">${money(p.price)}</s>` : ""}</div>
      <div class="card-foot">
        <span class="wb">${icon("shield")} ${p.warranty_months ? (p.warranty_months % 12 === 0 ? `${num(p.warranty_months / 12)}${lang() === "bn" ? " বছর" : "Y"}` : `${num(p.warranty_months)}${lang() === "bn" ? " মাস" : "M"}`) : "—"}</span>
        ${p.is_bundle ? "" : html`<button class="cmp ${cmp ? "on" : ""}" type="button" data-compare="${p.id}" aria-pressed="${cmp}">${icon("compare")} ${cmp ? t("compareAdded") : t("compare")}</button>`}
      </div>
    </div>
  </article>`;
}

/** Spec sheet as a two-column table; values in monospace. */
export const specTable = (specs) =>
  specs?.length
    ? html`<table class="spec-table"><tbody>${specs.map((s) => html`<tr><th scope="row">${specLabel(s.key)}</th><td>${s.value}</td></tr>`)}</tbody></table>`
    : "";

/** Setup ("collection") cards: cover photo, name, device, product count and the combined price. */
export const collectionCards = (items) => html`<div class="collection-grid">${items.map((c) => html`<a class="collection-card" href="/collections/${c.slug}">
    <span class="cc-img"><img src="${c.image_url ?? "/img/logo.svg"}" alt="" loading="lazy" width="480" height="480"></span>
    <span class="cc-body"><span class="eyebrow">${c.device ? html`${icon(DEVICE_ICONS[c.device] ?? "phone")} ${deviceLabel(c.device)}` : html`${icon("grid")} ${t("collections")}`}</span><b>${L(c, "name")}</b>
      <small class="muted">${t("pieces", { n: num(c.piece_count) })}${c.set_price ? html` · ${t("setPrice", { price: money(c.set_price) })}` : ""}</small>
      <span class="link">${t("shopTheSet")} →</span></span></a>`)}</div>`;

/** Tech-guide cards. */
export const postCards = (items) => html`<div class="journal-grid">${items.map((p) => html`<a class="journal-card" href="/guides/${p.slug}">
    <span class="jc-img"><img src="${p.cover_url ?? "/img/og-cover.png"}" alt="" loading="lazy" width="560" height="360"></span>
    <span class="jc-body">${p.published_at ? html`<span class="eyebrow">${icon("book")} ${date(p.published_at)}</span>` : ""}<b>${L(p, "title")}</b>
      <small class="muted">${L(p, "excerpt")}</small><span class="link">${t("readMore")} →</span></span></a>`)}</div>`;

/** Trust badges (only ever badges the shop holds proof for — the API filters them). */
export const certBadges = (list, { note = true } = {}) =>
  list?.length
    ? html`<div class="certs" aria-label="${t("certified")}">${list.map((c) => html`<span class="cert-badge" title="${[c.issuer ? `${t("issuer")}: ${c.issuer}` : "", c.valid_until ? `${t("validUntil")}: ${date(c.valid_until)}` : ""].filter(Boolean).join(" · ")}">${icon(c.icon || "shield")} ${L(c, "name")}</span>`)}${note ? html`<p class="small muted">${t("certNote")}</p>` : ""}</div>`
    : "";

/**
 * The warranty terms: shown next to every warranty badge, at checkout, in the footer and on the invoice. The wording
 * is edited in one place — Admin → Settings → Store information.
 */
const DEFAULT_WARRANTY_NOTE = {
  en: "Warranty covers manufacturing defects from the delivery date, against the invoice. Physical damage, water damage beyond the stated rating, and opened or repaired units are not covered. File a claim from your account or bring the unit with its box.",
  bn: "ডেলিভারির দিন থেকে ইনভয়েসের ভিত্তিতে ম্যানুফ্যাকচারিং ত্রুটির জন্য ওয়ারেন্টি প্রযোজ্য। ভেঙে যাওয়া, উল্লেখিত রেটিংয়ের বেশি পানিতে ক্ষতি, খোলা বা অন্যত্র মেরামত করা ইউনিট ওয়ারেন্টির বাইরে। অ্যাকাউন্ট থেকে ক্লেইম করুন অথবা বক্সসহ ইউনিটটি নিয়ে আসুন।",
};
export const warrantyNote = (store, { compact = false } = {}) => {
  const text = (lang() === "bn" ? store?.warranty_note_bn || store?.warranty_note_en : store?.warranty_note_en || store?.warranty_note_bn) || tt(DEFAULT_WARRANTY_NOTE);
  return html`<aside class="disclaimer ${compact ? "compact" : ""}" role="note">${icon("shield")}<p>${compact ? "" : html`<b>${t("warrantyTerms")}:</b> `}${text}</p></aside>`;
};
/** @deprecated name kept for older views. */
export const disclaimer = warrantyNote;

export const productGrid = (items) => html`<div class="grid products">${items.map(productCard)}</div>`;
export const skeletonGrid = (n = 8) => raw(`<div class="grid products">${Array.from({ length: n }, () => '<div class="card skel-card"><div class="skel sq"></div><div class="skel line"></div><div class="skel line short"></div></div>').join("")}</div>`);
export const emptyState = (title, sub = "", action = "") => html`<div class="state"><div class="blob-icon">${icon("search")}</div><h3>${title}</h3>${sub ? html`<p class="muted">${sub}</p>` : ""}${action}</div>`;
export const errorState = (msg) => html`<div class="state"><p class="error-box">${msg}</p><button class="btn" type="button" data-retry>${t("retry")}</button></div>`;

/** Wires wishlist hearts and compare toggles inside a container (event delegation), and starts the countdowns. */
export function bindCards(root) {
  startCountdowns();
  root.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-compare]");
    if (c) {
      e.preventDefault();
      const on = compare.toggle(Number(c.dataset.compare));
      c.classList.toggle("on", on);
      c.setAttribute("aria-pressed", String(on));
      c.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-compare"/></svg> ${on ? t("compareAdded") : t("compare")}`;
      return;
    }
    const b = e.target.closest("[data-wish]");
    if (!b) return;
    e.preventDefault();
    const on = await wishlist.toggle(Number(b.dataset.wish));
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

/** Adds a variant to the cart and fires AddToCart (Pixel + Conversions API relay + GA4). */
export function addToCart(product, variant, qty = 1) {
  const unitPrice = variant.price_override ?? (product.sale_price && product.sale_price < product.price ? product.sale_price : product.price);
  cart.add({ variantId: variant.id, productId: product.id, slug: product.slug, sku: variant.sku, name_en: product.name_en, name_bn: product.name_bn, size: variant.size, color: variant.color, image: product.images?.[0], unitPrice }, qty);
  track("AddToCart", { value: unitPrice * qty, items: [{ sku: variant.sku, name: product.name_en, price: unitPrice, quantity: qty }] });
  toast(t("added"));
}

export const STATUS_STEPS = ["pending", "confirmed", "packed", "shipped", "delivered"];
