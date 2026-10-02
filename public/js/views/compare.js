// Spec comparison: 2–3 products side by side (ids from the URL, else the compare tray). Rows come from the products'
// own spec sheets, lined up by key on the server; rows whose values differ are highlighted, and can be shown alone.
import { t, L, tt, money, num } from "../i18n.js";
import { $, api, html, icon, errMsg, raw } from "../core.js";
import { emptyState, compare, renderCompareTray, warrantyBadge, deviceLabel, addToCart } from "../ui.js";

export default async function comparePage(el, { query, navigate }) {
  const fromUrl = (query.get("ids") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const ids = (fromUrl.length ? fromUrl : compare.ids()).slice(0, 3);
  document.title = `${t("compareTitle")} | ${document.title.split("|").pop().trim()}`;
  const head = html`<nav class="crumbs" aria-label="breadcrumb"><a href="/">${t("home")}</a> ${icon("chevron")} <span>${t("compareTitle")}</span></nav>
    <h1>${t("compareTitle")}</h1><p class="muted">${t("compareSub")}</p>`;
  if (ids.length < 2) {
    el.innerHTML = String(html`<div class="container section">${head}${emptyState(t("compareNeed2"), "", html`<a class="btn primary" href="/shop">${t("shop")}</a>`)}</div>`);
    return;
  }
  el.innerHTML = String(html`<div class="container section">${head}<div class="skel line"></div></div>`);
  let r;
  try {
    r = await api(`/compare?ids=${ids.join(",")}`);
  } catch (e) {
    el.innerHTML = String(html`<div class="container section">${head}<p class="error-box">${errMsg(e)}</p></div>`);
    return;
  }
  const price = (p) => (p.sale_price && p.sale_price < p.price ? p.sale_price : p.price);
  const draw = (onlyDiff) => {
    const rows = onlyDiff ? r.rows.filter((x) => x.differs) : r.rows;
    el.innerHTML = String(html`<div class="container section">${head}
      <div class="compare-tools row"><label class="check"><input type="checkbox" id="only-diff" ${onlyDiff ? raw("checked") : ""}> ${t("compareDiff")}</label>
        <button class="btn ghost sm" type="button" id="clear">${t("compareClear")}</button></div>
      <div class="compare-wrap card"><table class="compare-table" style="--cols:${r.items.length}">
        <thead><tr><th scope="col"></th>${r.items.map((p) => html`<th scope="col">
          <a class="cmp-head" href="/product/${p.slug}"><img src="${p.images?.[0] ?? "/img/logo.svg"}" alt="" width="160" height="160" loading="lazy"><span class="brand-line">${p.brand ?? ""}</span><b>${L(p, "name")}</b></a>
          <div class="price-row"><b class="price">${money(price(p))}</b>${price(p) < p.price ? html`<s class="muted">${money(p.price)}</s>` : ""}</div>
          ${p.in_stock ? html`<button class="btn primary sm" type="button" data-add="${p.slug}">${icon("bag")} ${t("addToCart")}</button>` : html`<span class="muted small">${t("outOfStock")}</span>`}
          <button class="link-btn small" type="button" data-remove="${p.id}">${t("remove")}</button></th>`)}</tr></thead>
        <tbody>
          <tr><th scope="row">${t("warranty")}</th>${r.items.map((p) => html`<td>${warrantyBadge(p.warranty_months)}</td>`)}</tr>
          <tr><th scope="row">${t("worksWith")}</th>${r.items.map((p) => html`<td>${(p.compatible ?? []).map(deviceLabel).join(", ") || "—"}</td>`)}</tr>
          ${rows.map((x) => html`<tr class="${x.differs ? "differs" : ""}"><th scope="row">${tt(x)}</th>${x.values.map((v) => html`<td>${v ?? t("notListed")}</td>`)}</tr>`)}
          <tr><th scope="row">${t("reviews")}</th>${r.items.map((p) => html`<td class="mono">${p.rating_count ? `${num(Number(p.rating_avg).toFixed(1))} ★ (${num(p.rating_count)})` : "—"}</td>`)}</tr>
        </tbody></table></div></div>`);
    $("#only-diff", el).addEventListener("change", (e) => draw(e.target.checked));
    $("#clear", el).addEventListener("click", () => { compare.clear(); navigate("/shop"); });
    el.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => {
      const id = Number(b.dataset.remove);
      if (compare.has(id)) compare.toggle(id);
      const left = ids.filter((x) => x !== id);
      navigate(`/compare?ids=${left.join(",")}`, { replace: true });
    }));
    el.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", async () => {
      const d = await api(`/products/${b.dataset.add}`).catch(() => null);
      const v = d?.variants.find((x) => x.stock > 0);
      if (v) addToCart(d.product, v, 1);
    }));
  };
  draw(false);
  renderCompareTray();
}
