// Storefront entry: layout chrome, client-side router, cart drawer, language switching, tracking, PWA.
import { t, lang, setLang, applyStatic, L, money, tt } from "./i18n.js";
import { $, $$, html, icon, cart, config, overlay, api, wishlist, captureUtm } from "./core.js";
import { initTracking, pageView } from "./track.js";
import { warrantyNote, renderCompareTray, startCountdowns } from "./ui.js";

const routes = [
  [/^\/$/, () => import("./views/home.js")],
  [/^\/shop(?:\/(?<category>[a-z0-9-]+))?$/, () => import("./views/shop.js")],
  [/^\/search$/, () => import("./views/shop.js")],
  [/^\/product\/(?<slug>[a-z0-9-]+)$/, () => import("./views/product.js")],
  [/^\/cart$/, () => import("./views/checkout.js"), "cart"],
  [/^\/checkout$/, () => import("./views/checkout.js"), "checkout"],
  [/^\/order\/(?<orderNo>[A-Za-z0-9-]+)$/, () => import("./views/order.js")],
  [/^\/track$/, () => import("./views/order.js")],
  [/^\/account(?:\/(?<tab>[a-z]+))?$/, () => import("./views/account.js")],
  [/^\/deals$/, () => import("./views/shop.js"), "deals"],
  [/^\/finder$/, () => import("./views/finder.js")],
  [/^\/compare$/, () => import("./views/compare.js")],
  [/^\/bundles$/, () => import("./views/collections.js"), "bundles"],
  [/^\/collections(?:\/(?<slug>[a-z0-9-]+))?$/, () => import("./views/collections.js")],
  [/^\/guides(?:\/(?<slug>[a-z0-9-]+))?$/, () => import("./views/journal.js")],
  [/^\/lp\/(?<slug>[a-z0-9-]+)$/, () => import("./views/landing.js"), "landing"],
  [/^\/(?<page>about|contact)$/, () => import("./views/pages.js")],
  [/^\/policy\/(?<policy>returns|delivery|privacy|warranty)$/, () => import("./views/pages.js")],
];

const main = document.getElementById("main");
let navToken = 0;

export function navigate(url, { replace = false } = {}) {
  const u = new URL(url, location.origin);
  if (u.origin !== location.origin) return (location.href = u.href);
  replace ? history.replaceState({}, "", u) : history.pushState({}, "", u);
  render();
}

async function render() {
  const token = ++navToken;
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const q = new URL(location.href).searchParams;
  let match = null, loader = null, variant;
  for (const [re, load, v] of routes) {
    const m = path.match(re);
    if (m) { match = m; loader = load; variant = v; break; }
  }
  // Campaign landing pages are nav-free: one hero, one offer, one button.
  document.body.classList.toggle("lp-mode", variant === "landing");
  updateNavState(path);
  try {
    const mod = loader ? await loader() : await import("./views/pages.js");
    if (token !== navToken) return;
    main.classList.remove("page-enter");
    void main.offsetWidth;
    main.classList.add("page-enter");
    await mod.default(main, { params: match?.groups ?? {}, query: q, variant, notFound: !loader, navigate });
  } catch (e) {
    console.error(e);
    main.innerHTML = String(html`<div class="container section"><div class="state"><p class="error-box">${t("somethingWrong")}</p><button class="btn" type="button" onclick="location.reload()">${t("retry")}</button></div></div>`);
  }
  if (!location.hash) window.scrollTo({ top: 0 });
  renderCompareTray();
  pageView();
}

// ---------- Chrome ----------
function buildNav(cats) {
  const top = cats.filter((c) => !c.parent_id).slice(0, 7);
  $("#main-nav").innerHTML = String(html`
    <a href="/shop">${t("shop")}</a>
    <a href="/deals" class="nav-deal">${icon("flame")} ${t("deals")}</a>
    <a href="/finder" class="nav-gift">${icon("chip")} ${t("finder")}</a>
    <a href="/bundles" class="nav-sets">${icon("box")} ${t("bundles")}</a>
    ${top.map((c) => html`<a href="/shop/${c.slug}">${L(c, "name")}</a>`)}
    <a href="/guides">${t("guides")}</a>`);
  $("#bottom-nav").innerHTML = String(html`
    <a href="/">${icon("home")}<span>${t("home")}</span></a>
    <a href="/shop">${icon("grid")}<span>${t("shop")}</span></a>
    <a href="/deals">${icon("flame")}<span>${t("deals")}</span></a>
    <a href="/cart" class="bn-cart">${icon("bag")}<span>${t("cart")}</span><b class="badge-dot" id="cart-count-2" hidden>0</b></a>
    <a href="/account">${icon("user")}<span>${t("account")}</span></a>`);
  updateCartBadge();
}

function buildFooter(cfg) {
  const b = cfg.brand, s = cfg.store;
  if (s.logo_url) $("#logo-img").src = s.logo_url;
  $("#brand-name").textContent = lang() === "bn" ? s.name_bn || b.name.bn : s.name_en || b.name.en;
  $("#brand-tagline").textContent = tt(b.tagline);
  const social = [[s.facebook_url, "facebook", "Facebook"], [s.instagram_url, "instagram", "Instagram"]].filter(([u]) => u);
  $("#footer").innerHTML = String(html`
    <div class="footer-wave" aria-hidden="true"></div>
    <div class="container footer-grid">
      <div>
        <div class="logo"><img src="${s.logo_url || "/img/logo.svg"}" alt="" width="44" height="44"><span class="logo-text"><b>${lang() === "bn" ? s.name_bn : s.name_en}</b><small>${tt(b.tagline)}</small></span></div>
        <p class="small">${t("footerAbout")}</p>
        <div class="social">
          ${social.map(([u, i, label]) => html`<a class="icon-btn" href="${u}" target="_blank" rel="noopener" aria-label="${label}">${icon(i)}</a>`)}
          <a class="icon-btn" href="/wa" aria-label="WhatsApp">${icon("whatsapp")}</a>
        </div>
      </div>
      <div><h4>${t("shop")}</h4><ul>
        <li><a href="/shop?sort=newest">${t("newArrivals")}</a></li><li><a href="/deals">${t("dealOfDay")}</a></li><li><a href="/bundles">${t("bundles")}</a></li><li><a href="/collections">${t("collections")}</a></li>
        <li><a href="/finder">${t("finder")}</a></li><li><a href="/compare">${t("compareTitle")}</a></li><li><a href="/track">${t("track")}</a></li><li><a href="/account/warranty">${t("claimNew")}</a></li></ul></div>
      <div><h4>${t("policies")}</h4><ul>
        <li><a href="/policy/warranty">${t("warrantyPolicy")}</a></li><li><a href="/policy/returns">${t("returnsPolicy")}</a></li><li><a href="/policy/delivery">${t("deliveryPolicy")}</a></li>
        <li><a href="/policy/privacy">${t("privacyPolicy")}</a></li><li><a href="/guides">${t("guidesTitle")}</a></li><li><a href="/about">${t("about")}</a></li></ul></div>
      <div><h4>${t("visitUs")}</h4>
        <ul class="info-list small">
          <li>${icon("pin")}<span>${lang() === "bn" ? s.address_bn : s.address_en}, ${lang() === "bn" ? "বাংলাদেশ" : "Bangladesh"}</span></li>
          <li>${icon("phone")}<a href="tel:${s.phone}">${s.phone}</a></li>
          <li>${icon("clock")}<span>${lang() === "bn" ? s.hours_bn : s.hours_en}</span></li>
        </ul>
        <div class="pay-badges" aria-label="${t("weAccept")}"><span>COD</span><span>bKash</span><span>Nagad</span><span>Rocket</span><span>VISA</span></div>
      </div>
    </div>
    <div class="container">${warrantyNote(s, { compact: true })}</div>
    <div class="container footer-bottom"><span>© ${new Date().getFullYear()} ${s.name_en}</span><span>${lang() === "bn" ? s.city_bn : s.city_en}, ${lang() === "bn" ? "বাংলাদেশ" : "Bangladesh"}</span></div>`);
  const ann = $("#announce");
  const text = lang() === "bn" ? s.announcement_bn : s.announcement_en;
  ann.hidden = !text;
  ann.textContent = text ?? "";
  const ref = new URL(location.href).searchParams.get("ref") || "";
  $("#wa-float").href = `/wa?lang=${lang()}${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`;
}

function updateNavState(path) {
  $$("#main-nav a, #bottom-nav a").forEach((a) => {
    const href = a.getAttribute("href");
    const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
    active ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
  });
}

function updateCartBadge() {
  const n = cart.count();
  for (const b of [$("#cart-count"), $("#cart-count-2")]) {
    if (!b) continue;
    b.hidden = n === 0;
    b.textContent = String(n);
  }
}

export function openCartDrawer() {
  const items = cart.items();
  const body = items.length
    ? html`${items.map((i) => html`<div class="line"><img src="${i.image}" alt="" width="64" height="64" loading="lazy"><div><b>${lang() === "bn" ? i.name_bn : i.name_en}</b><div class="meta">${[i.size !== "Standard" ? i.size : "", i.color].filter(Boolean).join(" · ")} × ${i.quantity}</div></div><b>${money(i.unitPrice * i.quantity)}</b></div>`)}`
    : html`<div class="state"><div class="blob-icon">${icon("bag")}</div><p class="muted">${t("cartEmpty")}</p></div>`;
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const footer = items.length
    ? html`<div class="totals"><div><span>${t("subtotal")}</span><b>${money(subtotal)}</b></div></div><a class="btn primary block" href="/checkout" data-close>${t("proceedCheckout")}</a><a class="btn ghost block" href="/cart" data-close>${t("viewCart")}</a>`
    : html`<a class="btn primary block" href="/shop" data-close>${t("continueShopping")}</a>`;
  overlay("drawer", { title: t("yourCart"), body, footer });
}

/**
 * Popup banner (Admin → Banners & logo → Popup): shown once per visitor per version of the banner, never on
 * checkout, cart, order or campaign pages, and never on top of another dialog.
 */
function maybeShowPopup(p) {
  if (!p || /^\/(checkout|cart|order|lp|track|account)/.test(location.pathname) || document.querySelector(".popup-scrim")) return;
  const key = `gmk_popup_${p.id}_${p.updated_at}`;
  try { if (localStorage.getItem(key)) return; } catch { return; }
  const scrim = document.createElement("div");
  scrim.className = "popup-scrim";
  scrim.innerHTML = String(html`<div class="popup-banner ${p.color ?? "yellow"}" role="dialog" aria-modal="true" aria-labelledby="popup-title">
      <button class="icon-btn popup-close" type="button" data-close aria-label="${t("popupClose")}">${icon("close")}</button>
      ${p.image_url ? html`<img src="${p.image_url}" alt="" width="360" height="360">` : ""}
      <h2 id="popup-title">${L(p, "title")}</h2>
      ${p.subtitle_en ? html`<p>${L(p, "subtitle")}</p>` : ""}
      ${p.link_url ? html`<a class="btn primary lg" href="${p.link_url}" data-close>${L(p, "cta") || t("shop")}</a>` : ""}
    </div>`);
  const prev = document.activeElement;
  const close = () => {
    try { localStorage.setItem(key, "1"); } catch { /* private mode: show again next time */ }
    scrim.remove();
    document.removeEventListener("keydown", onKey);
    prev?.focus?.();
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  scrim.addEventListener("click", (e) => { if (e.target === scrim || e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKey);
  document.body.append(scrim);
  scrim.querySelector(".popup-close").focus();
}

let catsCache;
async function chrome() {
  try {
    const [cfg, cats] = await Promise.all([config(), (catsCache ??= api("/categories"))]);
    buildNav(cats.categories);
    buildFooter(cfg);
    setTimeout(() => maybeShowPopup(cfg.popup), 1500);
  } catch (e) {
    console.warn("chrome failed", e);
  }
}

async function boot() {
  captureUtm();
  setLang(lang());
  applyStatic();
  $$(".lang-toggle button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.lang === lang()));
    b.addEventListener("click", () => {
      setLang(b.dataset.lang);
      $$(".lang-toggle button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lang === lang())));
      applyStatic();
      chrome();
      render();
    });
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || a.target || a.hasAttribute("download") || e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) return;
    const u = new URL(a.href, location.origin);
    if (u.origin !== location.origin || /^\/(admin|api|media|wa|feeds)\b/.test(u.pathname) || /\.[a-z]+$/.test(u.pathname)) return;
    e.preventDefault();
    navigate(u.pathname + u.search + u.hash);
  });
  window.addEventListener("popstate", render);
  $("#cart-btn").addEventListener("click", openCartDrawer);
  $("#search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#search-input").value.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  });
  document.addEventListener("cart:change", updateCartBadge);
  document.addEventListener("compare:change", renderCompareTray);
  startCountdowns();
  updateCartBadge();
  await initTracking();
  await chrome();
  render();
  wishlist.sync();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});
}

boot();
