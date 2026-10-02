// Home: hero (banners from Admin → Banners), trust strip, Deal of the Day (real end time + real stock), category tiles,
// shop by device, offers, gadget finder teaser, combo deals, setups, new arrivals, best sellers, tech explainer, trust
// badges we hold, tech guides, reviews, newsletter.
import { t, L, num, lang, money } from "../i18n.js";
import { $, $$, api, html, icon, raw, toast, errMsg, config } from "../core.js";
import { productGrid, skeletonGrid, bindCards, stars, collectionCards, postCards, countdown, deviceLabel, DEVICE_ICONS, warrantyBadge, deviceChips } from "../ui.js";

export const CAT_ICONS = { audio: "headphones", wearables: "watch", power: "battery", "mobile-accessories": "phone", gaming: "gamepad", "smart-home": "smarthome", "computer-accessories": "keyboard" };
const HOME_DEVICES = ["iphone", "android", "laptop", "mac", "windows", "ps5", "switch", "smart_tv"];

export default async function home(el) {
  el.innerHTML = String(html`<section class="hero-wrap"><div class="container"><div class="skel hero-skel"></div></div></section><div class="container section">${skeletonGrid(4)}</div>`);
  let data, cats, cfg;
  try {
    [data, cats, cfg] = await Promise.all([api("/home"), api("/categories"), config()]);
  } catch (e) {
    el.innerHTML = String(html`<div class="container section"><p class="error-box">${errMsg(e)}</p></div>`);
    return;
  }
  const heroes = data.banners.filter((b) => b.placement === "hero");
  const offers = data.banners.filter((b) => b.placement === "offer");
  const marketing = data.banners.filter((b) => b.placement === "marketing");
  const top = cats.categories.filter((c) => !c.parent_id);
  const zone = cfg.zones.find((z) => z.free_shipping_min);
  const [deal, ...moreDeals] = data.deals ?? [];

  el.innerHTML = String(html`
    <section class="hero-wrap">
      <div class="container">
        <div class="hero-slider" id="hero">
          ${heroes.length ? "" : html`<div class="story-hero" data-slide="0"><div class="hero-text"><span class="eyebrow">${icon("chip")} ${t("ourStory")}</span><h1>${t("storyTitle")}</h1><p>${t("storyBody")}</p><a class="btn primary lg" href="/shop">${t("shop")} ${icon("chevron")}</a></div><div class="hero-art" aria-hidden="true"><img src="/img/og-cover.png" alt="" width="560" height="560"></div></div>`}
          ${heroes.map((b, i) => html`<div class="story-hero ${b.color ?? "sky"}" ${i ? raw("hidden") : ""} data-slide="${i}">
            <div class="hero-text">
              ${i === 0 ? html`<span class="eyebrow">${icon("chip")} ${t("storyTitle")}</span>` : ""}
              <h1>${L(b, "title")}</h1>
              ${b.subtitle_en ? html`<p>${L(b, "subtitle")}</p>` : ""}
              ${i === 0 ? html`<ul class="story-points"><li>${icon("compare")} ${t("trustSpecs")}</li><li>${icon("shield")} ${t("trustWarranty")}</li><li>${icon("clock")} ${t("trustStock")}</li></ul>` : ""}
              ${b.link_url ? html`<a class="btn primary lg" href="${b.link_url}">${L(b, "cta") || t("shop")} ${icon("chevron")}</a>` : ""}
            </div>
            <div class="hero-art" aria-hidden="true">${b.image_url ? html`<img src="${b.image_url}" alt="" width="560" height="560" ${i ? "" : raw('fetchpriority="high"')}>` : html`<img src="/img/logo.svg" alt="" width="300" height="300">`}</div>
          </div>`)}
          ${heroes.length > 1 ? html`<div class="dots">${heroes.map((_, i) => html`<button type="button" data-dot="${i}" aria-label="${i + 1}" aria-current="${i === 0}"></button>`)}</div>` : ""}
        </div>
        <ul class="trust-strip">
          <li>${icon("cash")}<span>${t("codAvailable")}</span></li>
          <li>${icon("truck")}<span>${zone ? t("freeOver", { n: zone.free_shipping_min }) : t("delivery")}</span></li>
          <li>${icon("shield")}<span>${t("trustWarranty")}</span></li>
          <li>${icon("return")}<span>${t("easyReturns")}</span></li>
        </ul>
      </div>
    </section>

    ${deal ? html`<section class="container section" id="deals">
      <div class="section-head"><h2>${icon("flame")} ${t("dealOfDay")}</h2><a href="/shop?deal=1">${t("allDeals")} ${icon("chevron")}</a></div>
      <p class="muted small">${t("dealOfDaySub")}</p>
      <div class="deal-hero card">
        <a class="deal-img" href="/product/${deal.slug}"><img src="${deal.images?.[0]}" alt="" width="520" height="520" loading="lazy"></a>
        <div class="deal-body">
          ${deal.brand ? html`<span class="brand-line">${deal.brand}</span>` : ""}
          <h3><a href="/product/${deal.slug}">${L(deal, "name")}</a></h3>
          ${deviceChips(deal.compatible, 4)}
          <div class="price-row big"><b class="price">${money(deal.sale_price ?? deal.price)}</b>${deal.sale_price ? html`<s class="muted">${money(deal.price)}</s><span class="tag-inline sale">-${num(deal.discount_percent)}%</span>` : ""}</div>
          <div class="deal-timer"><span class="muted small">${t("dealEnds")}</span>${countdown(deal.deal_until)}</div>
          <p class="stock-line ${deal.stock <= 5 ? "low" : ""}">${icon("box")} ${t("stockCount", { n: num(deal.stock) })}</p>
          <div class="row">${warrantyBadge(deal.warranty_months)}<a class="btn primary lg" href="/product/${deal.slug}">${t("buyNow")} ${icon("chevron")}</a></div>
        </div>
      </div>
      ${moreDeals.length ? html`<div class="deal-more">${productGrid(moreDeals)}</div>` : ""}
    </section>` : ""}

    <section class="container section">
      <div class="section-head"><h2>${t("shopByCategory")}</h2></div>
      <div class="cat-tiles">
        ${top.map((c) => html`<a class="cat-tile ${c.color ?? "sky"}" href="/shop/${c.slug}">
          <span class="blob">${c.image_url ? html`<img src="${c.image_url}" alt="" loading="lazy" width="96" height="96">` : icon(CAT_ICONS[c.slug] ?? "chip")}</span>
          <b>${L(c, "name")}</b><small class="muted mono">${num(c.product_count)}</small></a>`)}
      </div>
    </section>

    <section class="container section">
      <div class="section-head"><h2>${t("worksWith")}…</h2></div>
      <div class="device-tiles">
        ${HOME_DEVICES.map((d) => html`<a class="device-tile" href="/shop?device=${d}"><span class="dt-icon">${icon(DEVICE_ICONS[d] ?? "phone")}</span><b>${deviceLabel(d)}</b></a>`)}
      </div>
    </section>

    ${offers.length ? html`<section class="container section offers">${offers.map((b) => html`<a class="offer-banner ${b.color ?? "mint"}" href="${b.link_url || "/shop"}">
        ${b.image_url ? html`<img src="${b.image_url}" alt="" loading="lazy" width="220" height="220">` : ""}
        <span class="offer-text"><b>${L(b, "title")}</b>${b.subtitle_en ? html`<span>${L(b, "subtitle")}</span>` : ""}</span>
        <span class="btn primary">${L(b, "cta") || t("shop")} ${icon("chevron")}</span></a>`)}</section>` : ""}

    <section class="container section">
      <div class="gift-guide quiz-teaser">
        <div class="gift-guide-text">
          <span class="eyebrow">${icon("chip")} ${t("finder")}</span>
          <h2>${t("finderTeaser")}</h2>
          <p>${t("finderSub")}</p>
          <div class="gift-ages">${["iphone", "android", "laptop", "windows", "switch"].map((d) => html`<a class="chip lg dev" href="/finder?device=${d}">${deviceLabel(d)}</a>`)}</div>
          <a class="btn primary" href="/finder">${t("finder")} ${icon("chevron")}</a>
        </div>
      </div>
    </section>

    ${data.bundles?.length ? html`<section class="container section">
      <div class="section-head"><h2>${t("bundles")}</h2><a href="/bundles">${t("viewAll")} ${icon("chevron")}</a></div>
      <p class="muted">${t("bundlesSub")}</p>
      ${productGrid(data.bundles.slice(0, 4))}
    </section>` : ""}

    <section class="container section">
      <div class="section-head"><h2>${t("newArrivals")}</h2><a href="/shop?sort=newest">${t("viewAll")} ${icon("chevron")}</a></div>
      ${productGrid(data.newArrivals.slice(0, 8))}
    </section>

    ${data.bestSellers.length ? html`<section class="container section">
      <div class="section-head"><h2>${t("bestSellers")}</h2><a href="/shop?sort=popular">${t("viewAll")} ${icon("chevron")}</a></div>
      ${productGrid(data.bestSellers.slice(0, 8))}
    </section>` : ""}

    ${data.collections?.length ? html`<section class="container section">
      <div class="section-head"><h2>${t("collections")}</h2><a href="/collections">${t("viewAll")} ${icon("chevron")}</a></div>
      ${collectionCards(data.collections.slice(0, 3))}
    </section>` : ""}

    ${marketing.length ? html`<section class="container section"><div class="promo-cards">${marketing.map((b) => html`<a class="promo-card ${b.color ?? "sky"}" href="${b.link_url || "/shop"}">
        <span class="promo-text"><b>${L(b, "title")}</b>${b.subtitle_en ? html`<span>${L(b, "subtitle")}</span>` : ""}<span class="link">${L(b, "cta") || t("shop")} →</span></span>
        ${b.image_url ? html`<img src="${b.image_url}" alt="" loading="lazy" width="200" height="200">` : ""}</a>`)}</div></section>` : ""}

    ${data.spotlight?.items?.length ? html`<section class="container section">
      <div class="spotlight">
        <div class="spotlight-text">
          <span class="eyebrow">${icon("bolt")} ${t("spotlight")}</span>
          <h2>${L(data.spotlight, "title")}</h2>
          <p>${L(data.spotlight, "text")}</p>
          <a class="btn" href="/search?q=${encodeURIComponent(data.spotlight.ingredient)}">${t("shopSpotlight", { i: data.spotlight.ingredient })} ${icon("chevron")}</a>
        </div>
        <div class="spotlight-items">${productGrid(data.spotlight.items.slice(0, 4))}</div>
      </div>
    </section>` : ""}

    ${data.certifications?.length ? html`<section class="container section">
      <div class="section-head"><h2>${t("certificationsTitle")}</h2><a href="/about">${t("about")} ${icon("chevron")}</a></div>
      <p class="muted">${t("certificationsSub")}</p>
      <div class="cert-strip">${data.certifications.map((c) => html`<span class="cert-item" title="${c.issuer ?? ""}">${icon(c.icon || "shield")} ${L(c, "name")}</span>`)}</div>
    </section>` : ""}

    ${data.journal?.length ? html`<section class="container section">
      <div class="section-head"><h2>${t("guidesTitle")}</h2><a href="/guides">${t("viewAll")} ${icon("chevron")}</a></div>
      ${postCards(data.journal.slice(0, 3))}
    </section>` : ""}

    <section class="container section">
      <div class="section-head"><h2>${t("customerPhotos")}</h2></div>
      ${data.testimonials.length
        ? html`<div class="reviews-row">${data.testimonials.map((r) => html`<figure class="review-card">${r.photo_url ? html`<img class="review-photo" src="${r.photo_url}" alt="" loading="lazy" width="320" height="320">` : ""}<div class="row">${stars(r.rating)}</div><blockquote>“${r.body}”</blockquote><figcaption><b>${r.name}</b>${r.verified_purchase ? html` · <span class="verified">${icon("check")} ${t("verifiedPurchase")}</span>` : ""}<br><a class="small review-product" href="/product/${r.slug}">${r.product_image ? html`<img src="${r.product_image}" alt="" width="36" height="36" loading="lazy">` : ""}${L(r, "product")}</a></figcaption></figure>`)}</div>`
        : html`<p class="muted note-card">${t("noReviewsYet")}</p>`}
    </section>

    <section class="container section">
      <form class="newsletter" id="newsletter">
        <div><h2>${t("newsletter")}</h2><p class="muted">${t("newsletterSub")}</p></div>
        <div class="newsletter-row">
          <label class="sr-only" for="nl-contact">${t("emailOrPhone")}</label>
          <input class="input" id="nl-contact" name="contact" required placeholder="${t("emailOrPhone")}" autocomplete="email">
          <button class="btn primary" type="submit">${t("subscribe")}</button>
        </div>
      </form>
    </section>`);

  bindCards(el);
  // Simple, accessible hero slider (auto-advances; pauses when the tab is hidden).
  const slides = $$("[data-slide]", el), dots = $$("[data-dot]", el);
  let cur = 0;
  const show = (i) => {
    cur = (i + slides.length) % slides.length;
    slides.forEach((s, j) => (s.hidden = j !== cur));
    dots.forEach((d, j) => d.setAttribute("aria-current", String(j === cur)));
  };
  dots.forEach((d) => d.addEventListener("click", () => show(Number(d.dataset.dot))));
  if (slides.length > 1) {
    const timer = setInterval(() => { if (!document.hidden && el.isConnected) show(cur + 1); else if (!el.isConnected) clearInterval(timer); }, 6000);
  }
  $("#newsletter", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      const r = await api("/newsletter", { method: "POST", body: { contact: f.contact.value, lang: lang() } });
      toast(r[lang()] ?? r.en);
      f.reset();
    } catch (err) {
      toast(errMsg(err), "error");
    }
  });
}
