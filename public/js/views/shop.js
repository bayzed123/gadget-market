// Shop & search: category listing with "works with" (device), bundle / single, deal, brand, price and stock filters;
// sort by newest, popularity, price and rating; load more. Search also matches spec sheets, so "65W" or "bluetooth 5.3"
// finds every product with it on its spec sheet.
import { t, L, num, lang } from "../i18n.js";
import { $, $$, api, html, icon, raw, errMsg, overlay } from "../core.js";
import { productGrid, productCard, skeletonGrid, bindCards, emptyState, errorState, deviceLabel } from "../ui.js";

export default async function shop(el, { params, query, navigate, variant }) {
  const category = params.category ?? query.get("category") ?? "";
  const q = query.get("q") ?? "";
  const filters = {
    bundle: ["0", "1"].includes(query.get("bundle")) ? query.get("bundle") : "",
    device: (query.get("device") ?? "").split(",").filter(Boolean),
    deal: query.get("deal") === "1" || variant === "deals",
    brand: (query.get("brand") ?? "").split(",").filter(Boolean),
    min: query.get("min") ?? "",
    max: query.get("max") ?? "",
    in_stock: query.get("in_stock") === "1",
    on_sale: query.get("on_sale") === "1",
    sort: query.get("sort") ?? "newest",
  };
  const qs = (page = 1) => {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (q) p.set("q", q);
    if (filters.bundle) p.set("bundle", filters.bundle);
    if (filters.device.length) p.set("device", filters.device.join(","));
    if (filters.deal) p.set("deal", "1");
    if (filters.brand.length) p.set("brand", filters.brand.join(","));
    if (filters.min) p.set("min", filters.min);
    if (filters.max) p.set("max", filters.max);
    if (filters.in_stock) p.set("in_stock", "1");
    if (filters.on_sale) p.set("on_sale", "1");
    p.set("sort", filters.sort);
    p.set("page", String(page));
    p.set("limit", "12");
    return p;
  };
  const pushUrl = () => {
    const p = qs();
    p.delete("category");
    p.delete("page");
    p.delete("limit");
    if (p.get("sort") === "newest") p.delete("sort");
    navigate(`${location.pathname}${p.toString() ? `?${p}` : ""}`, { replace: true });
  };

  const cats = await api("/categories").catch(() => ({ categories: [] }));
  const cat = cats.categories.find((c) => c.slug === category);
  const parent = cat?.parent_id ? cats.categories.find((c) => c.id === cat.parent_id) : null;
  const children = cats.categories.filter((c) => c.parent_id === (cat?.parent_id ?? cat?.id ?? -1));
  const title = q ? t("searchResultsFor", { q }) : cat ? L(cat, "name") : filters.deal ? t("deals") : filters.device.length === 1 ? t("worksWithDevice", { d: deviceLabel(filters.device[0]) }) : t("shop");
  document.title = `${title} | ${document.title.split("|").pop().trim()}`;

  el.innerHTML = String(html`
    <div class="container section">
      <nav class="crumbs" aria-label="breadcrumb"><a href="/">${t("home")}</a> ${icon("chevron")} <a href="/shop">${t("shop")}</a>${parent ? html` ${icon("chevron")} <a href="/shop/${parent.slug}">${L(parent, "name")}</a>` : ""}${cat ? html` ${icon("chevron")} <span>${L(cat, "name")}</span>` : ""}</nav>
      <div class="listing-head">
        <div><h1>${title}</h1>${cat?.description_en ? html`<p class="muted">${L(cat, "description")}</p>` : ""}</div>
        ${children.length ? html`<div class="subcats">${children.map((c) => html`<a class="chip lg ${c.slug === category ? "active" : ""}" href="/shop/${c.slug}">${L(c, "name")}</a>`)}</div>` : ""}
      </div>
      <div class="listing">
        <aside class="filters" id="filters" aria-label="${t("filters")}"></aside>
        <div>
          <div class="toolbar">
            <button class="btn sm only-mobile" type="button" id="open-filters">${icon("filter")} ${t("filters")}</button>
            <span class="muted" id="count"></span>
            <label class="sort">${t("sortBy")}
              <select class="input sm" id="sort">${["newest", "popular", "price_asc", "price_desc", "rating"].map((s) => html`<option value="${s}" ${filters.sort === s ? raw("selected") : ""}>${t(`sort_${s}`)}</option>`)}</select>
            </label>
          </div>
          <div id="active-filters" class="active-filters"></div>
          <div id="results">${skeletonGrid(8)}</div>
          <div class="center"><button class="btn" type="button" id="more" hidden>${t("loadMore")}</button></div>
        </div>
      </div>
    </div>`);

  const results = $("#results", el);
  bindCards(results);
  let page = 1;

  async function renderFilters(target) {
    const facetsQs = qs();
    const f = await api(`/facets?${facetsQs}`).catch(() => ({ devices: [], brands: [], price: { min: 0, max: 0 } }));
    target.innerHTML = String(html`<form class="filter-form">
      ${f.devices.length ? html`<fieldset><legend>${t("worksWith")}</legend>
        ${f.devices.map((m) => html`<label class="check"><input type="checkbox" name="device" value="${m.code}" ${filters.device.includes(m.code) ? raw("checked") : ""}> <span>${lang() === "bn" ? m.bn : m.en}</span> <small class="muted mono">${num(m.count)}</small></label>`)}
      </fieldset>` : ""}
      <fieldset><legend>${t("productType")}</legend>
        ${[["", t("shop")], ["0", t("singleProducts")], ["1", t("bundleOnly")]].map(([v, l]) => html`<label class="check"><input type="radio" name="bundle" value="${v}" ${filters.bundle === v ? raw("checked") : ""}> <span>${l}</span></label>`)}
      </fieldset>
      ${!category ? html`<fieldset><legend>${t("category")}</legend>${cats.categories.filter((c) => !c.parent_id).map((c) => html`<a class="filter-link" href="/shop/${c.slug}${location.search}">${L(c, "name")}</a>`)}</fieldset>` : ""}
      ${f.brands.length ? html`<fieldset><legend>${t("brand")}</legend>${f.brands.map((b) => html`<label class="check"><input type="checkbox" name="brand" value="${b.name}" ${filters.brand.includes(b.name) ? raw("checked") : ""}> <span>${b.name}</span> <small class="muted mono">${num(b.count)}</small></label>`)}</fieldset>` : ""}
      <fieldset><legend>${t("price")} (৳)</legend>
        <div class="price-range"><input class="input sm" type="number" inputmode="numeric" name="min" placeholder="${t("min")} ${f.price.min ?? ""}" value="${filters.min}" min="0"><span>–</span><input class="input sm" type="number" inputmode="numeric" name="max" placeholder="${t("max")} ${f.price.max ?? ""}" value="${filters.max}" min="0"></div>
      </fieldset>
      <fieldset>
        <label class="check"><input type="checkbox" name="in_stock" ${filters.in_stock ? raw("checked") : ""}> ${t("inStockOnly")}</label>
        <label class="check"><input type="checkbox" name="on_sale" ${filters.on_sale ? raw("checked") : ""}> ${t("onSale")}</label>
        <label class="check"><input type="checkbox" name="deal" ${filters.deal ? raw("checked") : ""}> ${icon("flame")} ${t("dealOfDay")}</label>
      </fieldset>
      <div class="filter-actions"><button class="btn primary block" type="submit">${t("apply")}</button><button class="btn ghost block" type="button" data-clear>${t("clearAll")}</button></div>
    </form>`);
    const form = $("form", target);
    const apply = () => {
      filters.bundle = $('input[name="bundle"]:checked', form)?.value ?? "";
      filters.device = $$('input[name="device"]:checked', form).map((i) => i.value);
      filters.deal = form.deal.checked;
      filters.brand = $$('input[name="brand"]:checked', form).map((i) => i.value);
      filters.min = form.min.value;
      filters.max = form.max.value;
      filters.in_stock = form.in_stock.checked;
      filters.on_sale = form.on_sale.checked;
      pushUrl();
    };
    form.addEventListener("submit", (e) => { e.preventDefault(); apply(); target.closest(".drawer")?.querySelector("[data-close]")?.click(); });
    // Checkboxes apply instantly on desktop; the drawer waits for "Apply" on phones.
    if (!target.closest(".drawer")) form.addEventListener("change", (e) => { if (e.target.type === "checkbox" || e.target.type === "radio") apply(); });
    $("[data-clear]", form).addEventListener("click", () => {
      Object.assign(filters, { bundle: "", device: [], deal: false, brand: [], min: "", max: "", in_stock: false, on_sale: false });
      pushUrl();
    });
  }

  function activeChips() {
    const chips = [
      ...(filters.bundle ? [["bundle", filters.bundle === "1" ? t("bundleOnly") : t("singleProducts")]] : []),
      ...(filters.deal ? [["deal", t("dealOfDay")]] : []),
      ...filters.device.map((m) => [`device:${m}`, deviceLabel(m)]),
      ...filters.brand.map((b) => [`brand:${b}`, b]),
      ...(filters.min || filters.max ? [["price", `৳${filters.min || 0}–${filters.max || "∞"}`]] : []),
    ];
    $("#active-filters", el).innerHTML = String(html`${chips.map(([k, l]) => html`<button class="chip removable" type="button" data-rm="${k}">${l} ${icon("close")}</button>`)}`);
    $$("[data-rm]", el).forEach((b) =>
      b.addEventListener("click", () => {
        const [k, v] = b.dataset.rm.split(":");
        if (k === "bundle") filters.bundle = "";
        if (k === "deal") filters.deal = false;
        if (k === "device") filters.device = filters.device.filter((x) => x !== v);
        if (k === "brand") filters.brand = filters.brand.filter((x) => x !== v);
        if (k === "price") filters.min = filters.max = "";
        pushUrl();
      }),
    );
  }

  async function load(append = false) {
    try {
      const r = await api(`/products?${qs(page)}`);
      $("#count", el).textContent = t("results", { n: num(r.total) });
      if (!r.items.length && !append) {
        results.innerHTML = String(emptyState(t("noResults"), t("noResultsSub"), html`<a class="btn" href="/shop">${t("clearAll")}</a>`));
      } else if (append) {
        results.querySelector(".grid").insertAdjacentHTML("beforeend", String(html`${r.items.map(productCard)}`));
      } else {
        results.innerHTML = String(productGrid(r.items));
      }
      $("#more", el).hidden = r.page >= r.pages;
    } catch (e) {
      results.innerHTML = String(errorState(errMsg(e)));
      $("[data-retry]", results)?.addEventListener("click", () => load(append));
    }
  }

  await renderFilters($("#filters", el));
  activeChips();
  $("#sort", el).addEventListener("change", (e) => { filters.sort = e.target.value; pushUrl(); });
  $("#more", el).addEventListener("click", () => { page++; load(true); });
  $("#open-filters", el).addEventListener("click", async () => {
    const { panel } = overlay("drawer", { title: t("filters"), body: html`<div id="drawer-filters"></div>` });
    await renderFilters($("#drawer-filters", panel));
  });
  await load();
}
