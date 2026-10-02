// Product detail: gallery with zoom, "works with" device tags, colour / capacity options, the real stock count, a
// Deal-of-the-Day countdown to the real end date, warranty badge with the terms next to it, key features, the spec
// sheet, what's in the box, trust badges the shop holds proof for, bundle contents with the real separate price,
// bundles this product is in, compare, Q&A, reviews, "works well with", related products, back-in-stock.
import { t, L, lang, money, num, date } from "../i18n.js";
import { $, $$, api, html, icon, errMsg, toast, overlay, wishlist, normalizePhone, showFieldErrors, config } from "../core.js";
import { productGrid, bindCards, stars, addToCart, emptyState, certBadges, warrantyNote, warrantyBadge, deviceLabel, specTable, countdown, compare, renderCompareTray } from "../ui.js";
import { track } from "../track.js";

const lines = (s) => (s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

export default async function product(el, { params, navigate }) {
  el.innerHTML = String(html`<div class="container section"><div class="pdp"><div class="skel sq big"></div><div><div class="skel line"></div><div class="skel line short"></div><div class="skel line"></div></div></div></div>`);
  let d;
  try {
    d = await api(`/products/${params.slug}`);
  } catch (e) {
    el.innerHTML = String(html`<div class="container section">${e.status === 404 ? emptyState(t("notFound"), "", html`<a class="btn primary" href="/shop">${t("shop")}</a>`) : html`<p class="error-box">${errMsg(e)}</p>`}</div>`);
    return;
  }
  const p = d.product;
  const variants = d.variants;
  const sizes = [...new Set(variants.map((v) => v.size))];
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];
  let size = variants.find((v) => v.stock > 0)?.size ?? sizes[0];
  let color = variants.find((v) => v.stock > 0 && v.size === size)?.color ?? colors[0] ?? "";
  let qty = 1;
  const current = () => variants.find((v) => v.size === size && (v.color || "") === (color || "")) ?? null;
  const priceOf = (v) => v?.price_override ?? (p.sale_price && p.sale_price < p.price ? p.sale_price : p.price);
  const basePrice = (v) => v?.price_override ?? p.price;
  document.title = `${L(p, "name")} | ${document.title.split("|").pop().trim()}`;
  const cfg = await config().catch(() => ({}));
  const highlights = p.highlights ?? [];
  const model = (p.specs ?? []).find((x) => x.key === "model")?.value;

  el.innerHTML = String(html`
    <div class="container section">
      <nav class="crumbs" aria-label="breadcrumb"><a href="/">${t("home")}</a>${d.breadcrumbs.map((c) => html` ${icon("chevron")} <a href="/shop/${c.slug}">${L(c, "name")}</a>`)} ${icon("chevron")} <span>${L(p, "name")}</span></nav>
      <div class="pdp">
        <div class="gallery">
          <div class="main-img" id="zoom" title="${t("zoomHint")}"><img id="main-img" src="${p.images[0] ?? "/img/logo.svg"}" alt="${L(p, "name")}" width="800" height="800"><span class="zoom-hint">${icon("search")}</span></div>
          ${p.images.length > 1 ? html`<div class="thumbs">${p.images.map((src, i) => html`<button type="button" data-img="${src}" aria-label="${i + 1}" aria-current="${i === 0}"><img src="${src}" alt="" width="80" height="80" loading="lazy"></button>`)}</div>` : ""}
        </div>
        <div class="buy-box">
          ${p.is_bundle ? html`<span class="chip lg dev">${icon("box")} ${t("bundle")}</span>` : ""}
          ${p.brand ? html`<span class="brand-line">${p.brand}</span>` : ""}
          <h1>${L(p, "name")}</h1>
          <p class="muted small mono">${[model ? `${t("model")}: ${model}` : "", p.origin ? t("madeIn", { c: p.origin }) : ""].filter(Boolean).join(" · ")} <span id="sku-line"></span></p>
          ${p.rating_count ? html`<a class="rating" href="#reviews">${stars(p.rating_avg)} <span class="muted small">${num(p.rating_avg.toFixed(1))} · ${num(p.rating_count)} ${t("reviews")}</span></a>` : ""}
          <div class="price-row big"><b class="price" id="price"></b><s class="muted" id="was"></s><span class="tag sale" id="off" hidden></span></div>
          ${p.deal_until ? html`<div class="deal-timer inline"><span class="eyebrow">${icon("flame")} ${t("dealOfDay")} · ${t("dealEnds")}</span>${countdown(p.deal_until)}</div>` : ""}
          ${p.compatible?.length ? html`<div class="compat"><b class="eyebrow">${icon("check")} ${t("worksWith")}</b><div class="device-chips">${p.compatible.map((c) => html`<a class="chip dev" href="/shop?device=${c}">${deviceLabel(c)}</a>`)}</div></div>` : ""}

          <div class="warranty-row">${warrantyBadge(p.warranty_months, { big: true })}<span class="muted small">${p.warranty_months ? t("warrantyFromDelivery") : ""}</span></div>

          ${highlights.length ? html`<div class="hero-ingredients highlights">
            <b class="eyebrow">${icon("bolt")} ${t("highlights")}</b>
            <ul>${highlights.map((h) => html`<li><b>${h.name}</b>${h.benefit_en || h.benefit_bn ? html`<span>${L(h, "benefit")}</span>` : ""}</li>`)}</ul>
          </div>` : ""}

          ${d.bundle ? html`<div class="kit-box">
            <h2>${icon("box")} ${t("bundleContains")}</h2>
            <ul class="kit-items">${d.bundle.items.map((x) => html`<li><img src="${x.product.images?.[0] ?? "/img/logo.svg"}" alt="" width="52" height="52" loading="lazy"><a href="/product/${x.product.slug}">${L(x.product, "name")}</a><span class="qty-x mono">× ${num(x.quantity)}</span></li>`)}</ul>
            ${d.bundle.saving > 0 ? html`<p class="kit-save small"><span class="muted">${t("bundleSeparate", { price: money(d.bundle.separate_price) })}</span><b>${t("bundleSave", { price: money(d.bundle.saving) })}</b></p>` : ""}
          </div>` : ""}

          ${certBadges(d.certifications)}

          ${sizes.length > 1 || sizes[0] !== "Standard" ? html`<div class="opt">
            <div class="opt-head"><b>${t("size")}</b></div>
            <div class="swatches" id="sizes">${sizes.map((s) => html`<button type="button" class="swatch" data-size="${s}">${s}</button>`)}</div></div>` : ""}
          ${colors.length ? html`<div class="opt"><div class="opt-head"><b>${t("color")}</b> <span class="muted" id="color-name"></span></div>
            <div class="swatches" id="colors">${colors.map((c) => html`<button type="button" class="swatch" data-color="${c}">${c}</button>`)}</div></div>` : ""}

          <p class="stock-line" id="stock-line" aria-live="polite"></p>
          <p class="delivery-line ${p.delivery_mode === "free" ? "free" : ""}">${icon("truck")} ${p.delivery_mode === "free" ? html`<b>${t("freeDelivery")}</b>` : t("deliveryAuto")}</p>

          <div class="buy-actions" id="buy-actions">
            <div class="qty" role="group" aria-label="${t("qty")}"><button type="button" data-q="-1" aria-label="-">${icon("minus")}</button><output id="qty">1</output><button type="button" data-q="1" aria-label="+">${icon("plus")}</button></div>
            <button class="btn primary lg" type="button" id="add">${icon("bag")} ${t("addToCart")}</button>
            <button class="btn accent lg" type="button" id="buy">${t("buyNow")}</button>
          </div>
          <div class="notify" id="notify" hidden>
            <form id="notify-form" class="inline-form"><p class="small">${t("notifyMeSub")}</p>
              <div class="row"><input class="input" name="phone" inputmode="tel" placeholder="01XXXXXXXXX" required><button class="btn primary" type="submit">${icon("bell")} ${t("notifyMe")}</button></div></form>
          </div>

          <div class="secondary-actions">
            <button class="icon-text" type="button" id="wish">${icon("heart")} ${t("wishlist")}</button>
            ${p.is_bundle ? "" : html`<button class="icon-text" type="button" id="cmp">${icon("compare")} <span>${t("compareAdd")}</span></button>`}
            <button class="icon-text" type="button" id="share">${icon("share")} ${t("share")}</button>
          </div>
          <ul class="perks small">
            <li>${icon("cash")} ${t("codAvailable")}</li>
            <li>${icon("return")} ${t("easyReturns")}</li>
            ${cfg.giftWrap?.enabled ? html`<li>${icon("gift")} ${t("giftWrapNote", { fee: money(cfg.giftWrap.fee) })}</li>` : ""}
            <li>${icon("whatsapp")} <a href="/wa?product=${p.slug}&lang=${lang()}">${t("chatWhatsApp")}</a></li>
          </ul>
        </div>
      </div>

      <div class="pdp-details">
        ${p.specs?.length ? html`<section class="spec-section"><h2>${icon("chip")} ${t("specs")}</h2>${specTable(p.specs)}
          ${p.is_bundle ? "" : html`<button class="btn sm" type="button" id="cmp2">${icon("compare")} ${t("compareAdd")}</button>`}</section>` : ""}
        ${p.description_en || p.description_bn ? html`<section><h2>${t("description")}</h2><p>${L(p, "description")}</p></section>` : ""}
        ${p.in_box_en || p.in_box_bn ? html`<section><h2>${icon("box")} ${t("inTheBox")}</h2><ul class="in-box">${L(p, "in_box").split(/,\s*(?![^()]*\))/).map((x) => html`<li>${icon("check")} ${x}</li>`)}</ul></section>` : ""}
        ${p.how_to_use_en || p.how_to_use_bn ? html`<section><h2>${t("howToUse")}</h2><ol class="use-steps">${lines(L(p, "how_to_use")).map((x) => html`<li>${x}</li>`)}</ol></section>` : ""}
        <section><h2>${t("care")}</h2>
          ${p.caution_en || p.caution_bn ? html`<ul class="good-to-know"><li>${icon("info")} ${L(p, "caution")}</li></ul>` : ""}
          ${warrantyNote(cfg.store)}
        </section>
      </div>

      <section class="section" id="qa">
        <div class="section-head"><h2>${icon("question")} ${t("qa")}</h2></div>
        ${d.questions?.length
          ? html`<div class="qa-list">${d.questions.map((q) => html`<article class="qa-item card"><p class="q"><b>Q.</b> ${q.question} <small class="muted">— ${q.name}</small></p><p class="a"><b>A.</b> ${q.answer}${q.answered_by ? html` <small class="muted">· ${t("answeredBy", { a: q.answered_by })}</small>` : ""}</p></article>`)}</div>`
          : html`<p class="muted note-card">${t("noQuestions")}</p>`}
        <form class="qa-form card" id="qa-form">
          <b>${t("askQuestion")}</b>
          <div class="row"><input class="input" name="name" required maxlength="60" placeholder="${t("yourName")}" autocomplete="given-name"><input class="input grow" name="question" required minlength="8" maxlength="500" placeholder="${t("yourQuestion")}"></div>
          <button class="btn primary" type="submit">${t("send")}</button>
        </form>
      </section>

      <section class="section" id="reviews">
        <div class="section-head"><h2>${t("reviews")}</h2></div>
        ${d.reviews.length
          ? html`<div class="reviews-list">${d.reviews.map((r) => html`<article class="review-card">${r.photo_url ? html`<img class="review-photo" src="${r.photo_url}" alt="" loading="lazy" width="320" height="320">` : ""}<div class="row">${stars(r.rating)} <b>${r.name}</b></div>${r.verified_purchase ? html`<span class="verified">${icon("check")} ${t("verifiedPurchase")}</span>` : ""}<p>${r.body}</p>${r.reply ? html`<p class="reply"><b>${lang() === "bn" ? "দোকানের উত্তর" : "Shop reply"}:</b> ${r.reply}</p>` : ""}<small class="muted">${date(r.created_at)}</small></article>`)}</div>`
          : html`<p class="muted note-card">${t("noReviewsYet")}</p>`}
      </section>

      ${d.inBundles?.length ? html`<section class="section"><div class="section-head"><h2>${t("inBundles")}</h2><a href="/bundles">${t("allBundles")} ${icon("chevron")}</a></div>${productGrid(d.inBundles.slice(0, 4))}</section>` : ""}
      ${(d.goesWellWith ?? []).map((look) => html`<section class="section look">
        <div class="section-head"><h2>${t("goesWellWith")} <small class="muted">· ${L(look, "name")}</small></h2><a href="/collections/${look.slug}">${t("shopTheSet")} ${icon("chevron")}</a></div>
        ${productGrid(look.items.slice(0, 4))}</section>`)}
      ${d.upsell.length && !(d.goesWellWith ?? []).length ? html`<section class="section"><div class="section-head"><h2>${t("goesWellWith")}</h2></div>${productGrid(d.upsell.slice(0, 4))}</section>` : ""}
      ${d.related.length ? html`<section class="section"><div class="section-head"><h2>${t("relatedProducts")}</h2></div>${productGrid(d.related.slice(0, 4))}</section>` : ""}
    </div>`);

  bindCards(el);
  track("ViewContent", { value: priceOf(current()), items: [{ sku: current()?.sku ?? p.slug, name: p.name_en, price: priceOf(current()), quantity: 1 }] });

  function refresh() {
    const v = current();
    $$("[data-size]", el).forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.size === size));
      b.classList.toggle("unavailable", !variants.some((x) => x.size === b.dataset.size && x.stock > 0));
    });
    $$("[data-color]", el).forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.color === color));
      b.classList.toggle("unavailable", !variants.some((x) => x.size === size && x.color === b.dataset.color && x.stock > 0));
    });
    if ($("#color-name", el)) $("#color-name", el).textContent = color;
    const price = priceOf(v);
    const was = basePrice(v);
    $("#price", el).textContent = money(price);
    $("#was", el).textContent = price < was ? money(was) : "";
    const off = $("#off", el);
    off.hidden = !(price < was);
    off.textContent = `-${num(Math.round(((was - price) / was) * 100))}%`;
    const line = $("#stock-line", el);
    // Honest urgency: the count shown is the real stock of the chosen option, straight from inventory — never typed copy.
    if (!v) line.innerHTML = String(html`<span class="muted">${t("chooseOption")}</span>`);
    else if (v.stock <= 0) line.innerHTML = String(html`<span class="out">${t("outOfStock")}</span>`);
    else line.innerHTML = String(html`<span class="${v.stock <= v.low_stock_threshold ? "low" : "ok"}">${icon("check")} ${t("stockCount", { n: num(v.stock) })}</span>`);
    $("#sku-line", el).textContent = v ? `· SKU ${v.sku}` : "";
    const soldOut = !v || v.stock <= 0;
    $("#buy-actions", el).hidden = soldOut;
    $("#notify", el).hidden = !soldOut || !v;
    qty = Math.min(qty, Math.max(1, v?.stock ?? 1));
    $("#qty", el).textContent = num(qty);
  }

  $$("[data-size]", el).forEach((b) => b.addEventListener("click", () => {
    size = b.dataset.size;
    if (!variants.some((v) => v.size === size && v.color === color)) color = variants.find((v) => v.size === size && v.stock > 0)?.color ?? variants.find((v) => v.size === size)?.color ?? "";
    refresh();
  }));
  $$("[data-color]", el).forEach((b) => b.addEventListener("click", () => { color = b.dataset.color; refresh(); }));
  $$("[data-q]", el).forEach((b) => b.addEventListener("click", () => {
    const max = Math.min(20, current()?.stock ?? 1);
    qty = Math.max(1, Math.min(max, qty + Number(b.dataset.q)));
    $("#qty", el).textContent = num(qty);
  }));
  $$("[data-img]", el).forEach((b) => b.addEventListener("click", () => {
    $("#main-img", el).src = b.dataset.img;
    $$("[data-img]", el).forEach((x) => x.setAttribute("aria-current", String(x === b)));
  }));
  // Zoom: hover pans a 2.2× view on desktop; tap/click opens the full-size photo.
  const zoom = $("#zoom", el);
  const mainImg = $("#main-img", el);
  zoom.addEventListener("mousemove", (e) => {
    const r = zoom.getBoundingClientRect();
    mainImg.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    zoom.classList.add("zooming");
  });
  zoom.addEventListener("mouseleave", () => zoom.classList.remove("zooming"));
  zoom.addEventListener("click", () => overlay("modal", { title: L(p, "name"), body: html`<img class="zoom-full" src="${mainImg.src}" alt="${L(p, "name")}" width="1200" height="1200">` }));
  $("#add", el).addEventListener("click", () => { const v = current(); if (v) addToCart(p, v, qty); });
  $("#buy", el).addEventListener("click", () => { const v = current(); if (v) { addToCart(p, v, qty); navigate("/checkout"); } });

  $("#notify-form", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const phone = normalizePhone(f.phone.value);
    if (!phone) return showFieldErrors(f, { data: { fields: [{ field: "phone", en: "Enter a valid mobile number", bn: "সঠিক মোবাইল নম্বর দিন" }] } });
    try {
      const r = await api("/stock-notify", { method: "POST", body: { productId: p.id, variantId: current()?.id, phone, lang: lang() } });
      toast(r[lang()] ?? t("notifyDone"));
      f.reset();
    } catch (err) {
      toast(errMsg(err), "error");
    }
  });

  const cmpBtns = ["#cmp", "#cmp2"].map((sel) => $(sel, el)).filter(Boolean);
  const paintCmp = () => cmpBtns.forEach((b) => {
    const on = compare.has(p.id);
    b.classList.toggle("on", on);
    b.lastChild.textContent = ` ${on ? t("compareAdded") : t("compareAdd")}`;
  });
  cmpBtns.forEach((b) => b.addEventListener("click", () => { compare.toggle(p.id); paintCmp(); renderCompareTray(); }));
  paintCmp();

  $("#qa-form", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      const r = await api("/questions", { method: "POST", body: { productId: p.id, name: f.name.value, question: f.question.value } });
      toast(r[lang()] ?? t("questionThanks"));
      f.reset();
    } catch (err) {
      showFieldErrors(f, err);
      toast(errMsg(err), "error");
    }
  });

  const wishBtn = $("#wish", el);
  wishBtn.classList.toggle("on", wishlist.ids().has(p.id));
  wishBtn.addEventListener("click", async () => wishBtn.classList.toggle("on", await wishlist.toggle(p.id)));

  $("#share", el).addEventListener("click", async () => {
    const url = location.href.split("?")[0];
    if (navigator.share) navigator.share({ title: L(p, "name"), url }).catch(() => {});
    else { await navigator.clipboard?.writeText(url); toast(t("copied")); }
  });

  refresh();
}
