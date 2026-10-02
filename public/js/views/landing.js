// Campaign landing page (/lp/<slug>): nav-free — one hero, one offer, one button. UTM defaults to the page slug.
import { t, L, lang, money } from "../i18n.js";
import { $, api, html, icon, errMsg, cart, toast, config } from "../core.js";
import { addToCart, deviceChips, warrantyNote, warrantyBadge } from "../ui.js";

export default async function landing(el, { params, query, navigate }) {
  let d;
  try {
    d = await api(`/lp/${params.slug}`);
  } catch (e) {
    el.innerHTML = String(html`<div class="container section"><p class="error-box">${errMsg(e)}</p><a class="btn" href="/">${t("backHome")}</a></div>`);
    return;
  }
  // Attribute orders to this campaign unless the ad already carried UTM tags.
  if (!query.get("utm_campaign")) {
    try {
      const cur = JSON.parse(localStorage.getItem("gmk_utm") ?? "null");
      if (!cur?.campaign) localStorage.setItem("gmk_utm", JSON.stringify({ source: cur?.source ?? "landing", medium: cur?.medium ?? "lp", campaign: params.slug, at: Date.now() }));
    } catch { /* ignore */ }
  }
  const lp = d.page, p = d.product;
  const cfgStore = (await config().catch(() => ({}))).store;
  const v = d.variants?.find((x) => x.stock > 0);
  el.innerHTML = String(html`<section class="lp ${lp.color ?? "yellow"}">
    <div class="container lp-inner">
      <a class="logo" href="/"><img src="/img/logo.svg" alt="" width="40" height="40"></a>
      <div class="lp-grid">
        <div>
          <h1>${L(lp, "title")}</h1>
          ${lp.subtitle_en ? html`<p class="lead">${L(lp, "subtitle")}</p>` : ""}
          ${lp.offer_en ? html`<p class="offer">${icon("flame")} ${L(lp, "offer")}</p>` : ""}
          ${p ? html`${deviceChips(p.compatible, 5)}<p class="price-row big"><b class="price">${money(p.sale_price ?? p.price)}</b>${p.sale_price ? html`<s class="muted">${money(p.price)}</s>` : ""}</p>` : ""}
          ${lp.coupon_code ? html`<p class="code-box"><span class="muted small">${t("coupon")}</span><b>${lp.coupon_code}</b></p>` : ""}
          <button class="btn primary xl" type="button" id="cta">${L(lp, "cta") || t("buyNow")} ${icon("chevron")}</button>
          ${p ? warrantyBadge(p.warranty_months, { big: true }) : ""}
          <ul class="perks"><li>${icon("cash")} ${t("codAvailable")}</li><li>${icon("return")} ${t("easyReturns")}</li><li>${icon("whatsapp")} <a href="/wa?ref=${encodeURIComponent(lp.slug)}&lang=${lang()}">${t("chatWhatsApp")}</a></li></ul>
          ${p && p.warranty_months ? warrantyNote(cfgStore, { compact: true }) : ""}
        </div>
        <div class="lp-art"><img src="${lp.image_url || p?.images?.[0] || "/img/og-cover.svg"}" alt="" width="520" height="520"></div>
      </div>
    </div></section>`);
  $("#cta", el).addEventListener("click", () => {
    if (lp.coupon_code) cart.setCoupon(lp.coupon_code);
    if (p && v) {
      addToCart({ ...p, images: p.images }, v, 1);
      navigate("/checkout");
    } else if (p) navigate(`/product/${p.slug}`);
    else { toast(t("shop")); navigate("/shop"); }
  });
}
