// Admin shell: sign-in (password + 2FA, or phone + SMS code for staff roles), mandatory 2FA setup for Super
// Admin / Manager, three-pane layout, hash router, notification bell, staff presence, global search.
import { t, lang, setLang, num, money, dt, tt } from "./i18n.js";
import { html, icon, api, $, $$, session, can, toast, errMsg, msg, debounce, showErrors, closeOverlays } from "./core.js";

// Main group follows the brief's sidebar order (Dashboard → Reports); Staff & roles, Settings and Help close the menu.
const NAV = [
  { group: null, items: [
    ["dashboard", "dashboard", "dashboard.view"],
    ["products", "products", "products.read"],
    ["categories", "categories", "categories.read"],
    ["orders", "orders", "orders.read"],
    ["customers", "customers", "customers.read"],
    ["coupons", "coupons", "coupons.read"],
    ["warranty", "wrench", "warranty.read"],
    ["inventory", "inventory", "inventory.read"],
    ["reports", "reports", "reports.view"],
  ] },
  { group: "sales", items: [
    ["abandoned", "cart-off", "abandoned.read"],
    ["returns", "return", "returns.read"],
    ["questions", "question", "questions.read"],
    ["reviews", "reviews", "reviews.read"],
  ] },
  { group: "marketing", items: [
    ["collections", "grid", "collections.read"],
    ["posts", "book", "posts.read"],
    ["landing", "megaphone", "landing.read"],
    ["banners", "banners", "banners.read"],
    ["referrals", "sparkle", "customers.read"],
    ["certifications", "shield", "certifications.read"],
  ] },
  { group: "system", items: [
    ["zones", "zones", "zones.read"],
    ["audit", "audit", "audit.view"],
    ["staff", "staff", "staff.read"],
    ["settings", "settings", "settings.read"],
    ["help", "help", null],
  ] },
];

const VIEWS = {
  dashboard: () => import("./views/dashboard.js"),
  orders: () => import("./views/orders.js"),
  abandoned: () => import("./views/abandoned.js"),
  returns: () => import("./views/returns.js"),
  warranty: () => import("./views/warranty.js"),
  questions: () => import("./views/questions.js"),
  products: () => import("./views/products.js"),
  categories: () => import("./views/categories.js"),
  inventory: () => import("./views/inventory.js"),
  referrals: () => import("./views/referrals.js"),
  reports: () => import("./views/reports.js"),
  settings: () => import("./views/settings.js"),
  help: () => import("./views/help.js"),
  profile: () => import("./views/profile.js"),
  audit: () => import("./views/audit.js"),
  customers: () => import("./views/resource.js"),
  coupons: () => import("./views/resource.js"),
  banners: () => import("./views/resource.js"),
  collections: () => import("./views/resource.js"),
  certifications: () => import("./views/resource.js"),
  posts: () => import("./views/resource.js"),
  landing: () => import("./views/resource.js"),
  reviews: () => import("./views/resource.js"),
  zones: () => import("./views/resource.js"),
  staff: () => import("./views/resource.js"),
};

let brand = { name: { en: "{{BRAND_NAME_EN}}", bn: "{{BRAND_NAME_BN}}" }, logo: "/img/logo.svg" }; // filled from brand.json at build time
let lastSeen = new Date(Date.now() - 86400_000).toISOString();
let started = false;

async function boot() {
  setLang(lang());
  try {
    const cfg = await fetch("/api/config").then((r) => r.json());
    brand = { name: { en: cfg.store.name_en || cfg.brand.name.en, bn: cfg.store.name_bn || cfg.brand.name.bn }, logo: cfg.store.logo_url || "/img/logo.svg" };
  } catch { /* keep defaults */ }
  session.brand = brand;
  try {
    const me = await api("/auth/me");
    session.admin = me.admin;
    session.perms = new Set(me.permissions);
    if (me.needs2fa) return twoFaSetup();
  } catch {
    return loginScreen();
  }
  start();
}

function start() {
  shell();
  if (!started) {
    started = true;
    window.addEventListener("hashchange", route);
    setInterval(heartbeat, 60_000);
    setInterval(loadBell, 60_000);
  }
  if (location.hash === "#/login" || !location.hash) location.hash = "#/dashboard";
  route();
  heartbeat();
}

const brandMark = () => html`<span class="brand-mark"><img src="${brand.logo}" alt=""></span>`;

function loginScreen(error, mode = "password") {
  document.title = `${t("signInTitle")} — ${brand.name.en}`;
  $("#root").innerHTML = String(html`<div class="login-wrap"><form class="card login-card" id="login" novalidate>
    <div class="brand" style="padding:0 0 18px">${brandMark()}<span><b>${brand.name[lang()] ?? brand.name.en}</b><small class="muted">${t("signInTitle")}</small></span></div>
    ${mode === "password" ? html`
      <label class="field"><span>${t("loginId")}</span><input class="input" name="email" type="text" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" required></label>
      <label class="field"><span>${t("password")}</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
      <label class="field" id="totp-field" hidden><span>${t("code")}</span><input class="input otp-code" name="totp" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label>`
    : html`
      <label class="field"><span>${t("phone")}</span><input class="input" name="phone" inputmode="tel" placeholder="01XXXXXXXXX" required></label>
      <p><button class="btn sm" type="button" id="send-code">${t("sendCode")}</button></p>
      <label class="field"><span>${t("code")}</span><input class="input otp-code" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label>`}
    ${error ? html`<p class="error-box">${error}</p>` : ""}
    <button class="btn primary" style="width:100%">${t("signIn")}</button>
    <p style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button type="button" class="btn ghost sm" id="switch">${mode === "password" ? t("phoneLogin") : t("passwordLogin")}</button>
      <button type="button" class="btn ghost sm" id="lang">${lang() === "bn" ? "English" : "বাংলা"}</button></p></form></div>`);
  $("#lang").onclick = () => { setLang(lang() === "bn" ? "en" : "bn"); loginScreen(null, mode); };
  $("#switch").onclick = () => loginScreen(null, mode === "password" ? "phone" : "password");
  $("#send-code")?.addEventListener("click", async () => {
    try {
      const r = await api("/auth/otp/request", { method: "POST", body: { phone: $("#login").phone.value } });
      toast(msg(r) || t("otpSent"));
      if (r.devCode) toast(`DEV code: ${r.devCode}`);
    } catch (e) { toast(errMsg(e), "err"); }
  });
  $("#login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector("button.primary");
    btn.disabled = true;
    btn.textContent = t("signingIn");
    try {
      const r = mode === "password"
        ? await api("/auth/login", { method: "POST", body: { email: f.email.value, password: f.password.value, totp: f.totp.value || undefined } })
        : await api("/auth/otp/verify", { method: "POST", body: { phone: f.phone.value, code: f.code.value } });
      session.admin = r.admin;
      session.perms = new Set(r.permissions);
      if (r.needs2fa) return twoFaSetup();
      start();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = t("signIn");
      if (err.data?.code === "totp_required") {
        $("#totp-field").hidden = false;
        f.totp.focus();
        toast(err.message);
        return;
      }
      showErrors(f, err);
      toast(errMsg(err), "err");
    }
  });
}

/** First sign-in for Super Admin / Manager: nothing else works until two-step sign-in is set up. */
async function twoFaSetup() {
  let setup;
  try {
    setup = await api("/auth/2fa/setup", { method: "POST" });
  } catch (e) {
    return loginScreen(errMsg(e));
  }
  $("#root").innerHTML = String(html`<div class="login-wrap"><form class="card login-card" id="tfa">
    <div class="brand" style="padding:0 0 12px">${brandMark()}<span><b>${t("twoFaTitle")}</b><small class="muted">${session.admin.name}</small></span></div>
    <p>${t("twoFaSetup")}</p>
    <div class="qr" id="qr"></div>
    <p class="small muted">${t("twoFaKey")}: <b style="word-break:break-all">${setup.secret}</b><br><a href="${setup.otpauth}">otpauth://</a></p>
    <label class="field"><span>${t("code")}</span><input class="input otp-code" name="code" inputmode="numeric" maxlength="6" required autocomplete="one-time-code"></label>
    <button class="btn primary" style="width:100%">${t("confirm")}</button>
    <p style="text-align:center"><button class="btn ghost sm" type="button" id="out">${t("signOut")}</button></p></form></div>`);
  // Wire the form first: on a slow network the code may be typed before the QR library arrives.
  $("#out").onclick = async () => { await api("/auth/logout", { method: "POST" }).catch(() => {}); location.reload(); };
  $("#tfa").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const r = await api("/auth/2fa/enable", { method: "POST", body: { code: e.target.code.value } });
      session.perms = new Set(r.permissions);
      toast(msg(r));
      start();
    } catch (err) { showErrors(e.target, err); toast(errMsg(err), "err"); }
  });
  // QR code (small MIT library from jsDelivr), loaded in the background; the typed key works without it.
  new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"; s.onload = res; s.onerror = rej; document.head.append(s); })
    .then(() => {
      const qr = window.qrcode(0, "M");
      qr.addData(setup.otpauth);
      qr.make();
      if ($("#qr")) $("#qr").innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2 });
    })
    .catch(() => { if ($("#qr")) $("#qr").hidden = true; });
}

function shell() {
  const collapsed = localStorage.getItem("gmk_admin_collapsed") === "1";
  $("#root").innerHTML = String(html`<div class="shell ${collapsed ? "collapsed" : ""}" id="shell">
    <aside class="side" id="side" aria-label="Menu">
      <div class="brand">${brandMark()}<span class="brand-text"><b>${brand.name[lang()] ?? brand.name.en}</b><small>Admin</small></span></div>
      <nav class="nav" id="nav">${NAV.map((g) => html`${g.group ? html`<div class="nav-group">${t(g.group)}</div>` : ""}${g.items.filter(([, , p]) => !p || can(p)).map(([key, ico]) => html`<a href="#/${key}" data-key="${key}" title="${t(key)}">${icon(ico)}<span class="label">${t(key)}</span>${["orders", "abandoned", "warranty", "questions"].includes(key) ? html`<span class="count" id="count-${key}" hidden></span>` : ""}</a>`)}`)}</nav>
      <div class="side-foot"><a class="btn sm ghost" href="/" target="_blank" style="color:#fff;width:100%;margin-bottom:8px">${icon("external")}<span class="label">${t("viewShop")}</span></a><button class="collapse-btn" id="collapse" type="button">${icon("chevrons")}<span class="label">${t("collapse")}</span></button></div>
    </aside>
    <main class="work" id="work">
      <div class="topbar"><button class="icon-btn menu-btn" id="menu" aria-label="Menu">${icon("menu")}</button><span class="title" id="page-title"></span>
        <button class="icon-btn only-narrow" id="rail-btn" aria-label="${t("notifications")}">${icon("bell")}<span class="dot" id="bell-dot-2" hidden></span></button></div>
      <div id="view"></div>
    </main>
    <aside class="rail" id="rail" aria-label="${t("notifications")}"></aside>
  </div>`);
  renderRail();
  $("#collapse").onclick = () => {
    const s = $("#shell");
    s.classList.toggle("collapsed");
    localStorage.setItem("gmk_admin_collapsed", s.classList.contains("collapsed") ? "1" : "0");
  };
  const side = $("#side");
  const closeSide = () => { side.classList.remove("open"); $(".scrim")?.remove(); };
  $("#menu").onclick = () => {
    side.classList.add("open");
    const s = document.createElement("div"); s.className = "scrim"; s.onclick = closeSide; document.body.append(s);
  };
  $("#nav").addEventListener("click", () => closeSide());
  $("#rail-btn").onclick = () => {
    const rail = $("#rail");
    rail.classList.toggle("drawer");
    if (rail.classList.contains("drawer")) {
      const s = document.createElement("div"); s.className = "scrim"; s.onclick = () => { rail.classList.remove("drawer"); s.remove(); }; document.body.append(s);
    } else $(".scrim")?.remove();
  };
  loadBell();
}

function renderRail() {
  const a = session.admin;
  const initials = a.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  $("#rail").innerHTML = String(html`
    <div class="search-box"><label class="sr-only" for="gsearch">${t("search")}</label>${icon("search")}<input class="input" id="gsearch" type="search" placeholder="${t("search")}" autocomplete="off"><div class="search-results" id="gresults"></div></div>
    <div class="card" style="padding:14px">
      <div class="profile"><span class="avatar">${initials}</span><div style="min-width:0;flex:1"><b style="display:block;overflow:hidden;text-overflow:ellipsis">${a.name}</b><span class="muted small">${a.role.replace("_", " ")}</span></div>
        <div class="menu"><button class="icon-btn" id="pm" aria-haspopup="true" aria-expanded="false" aria-label="${t("profile")}">${icon("user")}</button>
          <div class="menu-list" id="pm-list" hidden><a href="#/profile">${icon("settings")} ${t("profile")}</a><button type="button" id="lang-sw">🌐 ${lang() === "bn" ? "English" : "বাংলা"}</button><button type="button" id="logout">${icon("logout")} ${t("signOut")}</button></div></div>
      </div></div>
    <div class="card" style="padding:14px"><div class="card-title"><h3 style="margin:0">${t("notifications")}</h3><span class="icon-btn" style="width:40px;height:40px">${icon("bell")}<span class="dot" id="bell-dot" hidden></span></span></div><div class="notif" id="bell"></div></div>
    <div class="card" style="padding:14px"><h3>${t("onlineNow")}</h3><div class="online" id="online"><span class="muted small">…</span></div></div>`);
  $("#pm").onclick = () => { const l = $("#pm-list"); l.hidden = !l.hidden; $("#pm").setAttribute("aria-expanded", String(!l.hidden)); };
  $("#logout").onclick = async () => { await api("/auth/logout", { method: "POST" }).catch(() => {}); location.hash = ""; location.reload(); };
  $("#lang-sw").onclick = () => { setLang(lang() === "bn" ? "en" : "bn"); shell(); route(); };
  const search = debounce(async (q) => {
    const box = $("#gresults");
    if (q.length < 2) { box.innerHTML = ""; return; }
    try {
      const r = await api(`/search?q=${encodeURIComponent(q)}`);
      const none = !r.orders.length && !r.products.length && !r.customers.length;
      box.innerHTML = String(html`${r.orders.map((o) => html`<a href="#/orders/${o.id}">🧾 <b>${o.invoice_no ?? o.order_no}</b> · ${o.customer_name} · ${money(o.total)}<span class="sr-meta">${o.order_no} · ${o.customer_phone} · ${t(`s_${o.status}`)}</span></a>`)}
        ${r.customers.map((c) => html`<a href="#/customers?q=${encodeURIComponent(c.phone)}">👤 <b>${c.name}</b> · ${c.phone}<span class="sr-meta">${num(c.total_orders)} ${lang() === "bn" ? "অর্ডার" : "orders"}</span></a>`)}
        ${r.products.map((p) => html`<a href="#/products/${p.id}">🧸 ${lang() === "bn" ? p.name_bn : p.name_en} · ${money(p.sale_price ?? p.price)}<span class="sr-meta">SKU ${p.variant_sku ?? "—"}</span></a>`)}
        ${none ? html`<span class="muted small" style="padding:8px 12px;display:block">${lang() === "bn" ? "কিছু পাওয়া যায়নি" : "No matches"}</span>` : ""}`);
    } catch { box.innerHTML = ""; }
  }, 250);
  $("#gsearch").addEventListener("input", (e) => search(e.target.value.trim()));
  document.addEventListener("click", (e) => { if (!e.target.closest(".menu")) $("#pm-list")?.setAttribute("hidden", ""); });
}

async function loadBell() {
  if (!can("dashboard.view") || !$("#bell")) return;
  try {
    const r = await api(`/notifications?since=${encodeURIComponent(lastSeen)}`);
    const n = r.newOrders.length + r.pendingReviews.length + r.returnRequests.length + (r.lowStock.length ? 1 : 0);
    ["#bell-dot", "#bell-dot-2"].forEach((id) => { const d = $(id); if (d) { d.hidden = n === 0; d.textContent = num(n); } });
    $("#bell").innerHTML = n === 0 ? String(html`<span class="muted small">${t("nothingNew")}</span>`) : String(html`
      ${r.newOrders.map((o) => html`<a href="#/orders/${o.id}"><span class="ico" style="background:var(--k1)">${icon("orders")}</span><span><b>${t("newOrders")}: ${o.order_no}</b><br>${o.customer_name} · ${money(o.total)}</span></a>`)}
      ${r.lowStock.length ? html`<a href="#/inventory?stock=low"><span class="ico" style="background:var(--k3)">${icon("alert")}</span><span><b>${t("lowStock")}</b><br>${r.lowStock.slice(0, 3).map((v) => `${lang() === "bn" ? v.name_bn : v.name_en} (${v.sku}): ${v.stock}`).join(", ")}</span></a>` : ""}
      ${r.pendingReviews.map((rv) => html`<a href="#/reviews?status=pending"><span class="ico" style="background:var(--k2)">${icon("reviews")}</span><span><b>${t("pendingReviews")}</b><br>${rv.name} · ${"★".repeat(rv.rating)} · ${rv.name_en}</span></a>`)}
      ${r.returnRequests.map((x) => html`<a href="#/returns"><span class="ico" style="background:var(--k4)">${icon("return")}</span><span><b>${t("returnRequests")}</b><br>${x.order_no}</span></a>`)}`);
  } catch { /* offline — try again next minute */ }
  if (can("orders.read")) api("/orders?status=needs_call&limit=1").then((r) => setCount("orders", r.total)).catch(() => {});
  if (can("abandoned.read")) api("/abandoned?limit=1").then((r) => setCount("abandoned", r.total)).catch(() => {});
  if (can("warranty.read")) api("/warranty-claims?status=open&limit=1").then((r) => setCount("warranty", r.total)).catch(() => {});
  if (can("questions.read")) api("/questions?status=pending&limit=1").then((r) => setCount("questions", r.total)).catch(() => {});
}
function setCount(key, n) {
  const c = $(`#count-${key}`);
  if (c) { c.hidden = !n; c.textContent = num(n); }
}

async function heartbeat() {
  try {
    const r = await api(`/presence?page=${encodeURIComponent(location.hash)}`, { method: "POST" });
    const others = r.online.filter((o) => o.id !== session.admin.id);
    $("#online").innerHTML = others.length
      ? String(html`${others.map((o) => html`<div><span class="avatar">${o.name.slice(0, 1)}</span><span><b>${o.name}</b><br><span class="muted small">${o.role.replace("_", " ")} · ${o.page.replace("#/", "") || "dashboard"}</span></span></div>`)}`)
      : String(html`<span class="muted small">${t("onlyYou")}</span>`);
  } catch { /* ignore */ }
}

async function route() {
  if (!session.admin || !$("#view")) return;
  closeOverlays();
  const [path, qs] = location.hash.replace(/^#\/?/, "").split("?");
  const [key = "dashboard", id] = (path || "dashboard").split("/");
  if (key === "login") { location.hash = "#/dashboard"; return; }
  const loader = VIEWS[key];
  $$("#nav a").forEach((a) => (a.dataset.key === key ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  // A fresh container per navigation: a slow view that finishes after the user has moved on writes into a
  // detached element instead of drawing over the page they are now looking at.
  const view = document.createElement("div");
  view.id = "view";
  $("#view").replaceWith(view);
  const title = t(key);
  $("#page-title").textContent = title;
  document.title = `${title} — ${brand.name.en} Admin`;
  if (!loader) { view.innerHTML = String(html`<div class="card state">404</div>`); return; }
  view.innerHTML = String(html`<div class="skel"></div><div class="skel"></div>`);
  try {
    const mod = await loader();
    await mod.default(view, { key, id, query: new URLSearchParams(qs ?? ""), refreshBell: loadBell });
  } catch (e) {
    console.error(e);
    view.innerHTML = String(html`<div class="card"><p class="error-box">${errMsg(e)}</p></div>`);
  }
  if (!view.isConnected) return;
  $("#work")?.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

export { toast, msg, tt, dt };
boot();
