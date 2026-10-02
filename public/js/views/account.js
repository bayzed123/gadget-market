// Customer account: sign in / register / reset (mobile number), orders with tracking, "buy again" (products they've
// bought before, with one-tap reorder), warranty claims tied to a delivered order item (with the claim's progress),
// wishlist, saved addresses, returns, refer-a-friend, profile.
import { t, L, lang, money, num, date } from "../i18n.js";
import { $, $$, api, html, icon, raw, errMsg, toast, me, wishlist, bindGeo, showFieldErrors, overlay, turnstile, config } from "../core.js";
import { productGrid, bindCards, emptyState, productCard, addToCart } from "../ui.js";

const TABS = ["orders", "warranty", "regulars", "wishlist", "addresses", "returns", "referral", "profile"];
const TAB_LABEL = { orders: "myOrders", regulars: "myRoutine", warranty: "warrantyClaims" };
const ISSUES = ["not_charging", "no_sound", "not_turning_on", "connection", "battery", "physical", "other"];
const CLAIM_STEPS = ["submitted", "under_review", "approved", "resolved"];

export default async function account(el, { params, query, navigate }) {
  const tab = TABS.includes(params.tab) ? params.tab : "orders";
  const who = await me(true);
  if (!who && tab !== "wishlist") return authForms(el, { query, navigate });
  el.innerHTML = String(html`<div class="container section">
    <div class="account-head"><h1>${who ? (lang() === "bn" ? `আসসালামু আলাইকুম, ${who.name.split(" ")[0]}` : `Hello, ${who.name.split(" ")[0]}`) : t("wishlist")}</h1>
      ${who ? html`<button class="btn ghost sm" type="button" id="logout">${t("signOut")}</button>` : ""}</div>
    ${who ? html`<nav class="tabs" aria-label="${t("account")}">${TABS.map((k) => html`<a href="/account/${k}" ${k === tab ? raw('aria-current="page"') : ""}>${t(TAB_LABEL[k] ?? k)}</a>`)}</nav>` : ""}
    <div id="tab" class="tab-body"><div class="skel line"></div></div></div>`);
  $("#logout", el)?.addEventListener("click", async () => { await api("/auth/logout", { method: "POST" }); await me(true); navigate("/"); });
  const body = $("#tab", el);
  try {
    await ({ orders, warranty, regulars, wishlist: wishlistTab, addresses, returns, referral, profile })[tab](body, { who, query, navigate });
  } catch (e) {
    body.innerHTML = String(html`<p class="error-box">${errMsg(e)}</p>`);
  }
}

// ---------------------------------------------------------------- auth
async function authForms(el, { query, navigate }) {
  let mode = query.get("mode") ?? "login";
  const next = query.get("next") || "/account";
  const draw = async () => {
    el.innerHTML = String(html`<div class="container section narrow"><div class="card pad auth">
      <h1>${mode === "register" ? t("register") : mode === "reset" ? t("resetPassword") : t("signIn")}</h1>
      <form id="auth" class="stack" novalidate>
        ${mode === "register" ? html`<label class="field"><span>${t("fullName")}</span><input class="input" name="name" required autocomplete="name"></label>` : ""}
        <label class="field"><span>${t("mobile")}</span><input class="input" name="phone" required inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX"></label>
        ${mode === "reset" ? html`<div class="row"><button class="btn" type="button" id="send-code">${t("sendCode")}</button></div><label class="field"><span>${t("code")}</span><input class="input" name="code" inputmode="numeric" maxlength="6"></label>` : ""}
        <label class="field"><span>${mode === "reset" ? t("newPassword") : t("password")}</span><input class="input" name="password" type="password" required minlength="${mode === "login" ? 1 : 8}" autocomplete="${mode === "login" ? "current-password" : "new-password"}"></label>
        <div id="ts"></div>
        <button class="btn primary block" type="submit">${mode === "register" ? t("register") : mode === "reset" ? t("save") : t("signIn")}</button>
      </form>
      <p class="center small">${mode === "login" ? html`<a href="?mode=register" data-mode="register">${t("newHere")}</a> · <a href="?mode=reset" data-mode="reset">${t("forgotPassword")}</a>` : html`<a href="?mode=login" data-mode="login">${t("haveAccount")}</a>`}</p>
    </div></div>`);
    $$("[data-mode]", el).forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); mode = a.dataset.mode; draw(); }));
    const getToken = mode === "reset" ? async () => undefined : await turnstile($("#ts", el));
    const f = $("#auth", el);
    $("#send-code", el)?.addEventListener("click", async () => {
      try {
        const r = await api("/auth/reset/request", { method: "POST", body: { phone: f.phone.value, lang: lang() } });
        toast(r[lang()] ?? r.en);
        if (r.devCode) toast(`DEV code: ${r.devCode}`, "info", 8000);
      } catch (e) { showFieldErrors(f, e); toast(errMsg(e), "error"); }
    });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        if (mode === "reset") {
          const r = await api("/auth/reset/confirm", { method: "POST", body: { phone: f.phone.value, code: f.code.value, password: f.password.value } });
          toast(r[lang()] ?? r.en);
          mode = "login";
          return draw();
        }
        await api(`/auth/${mode === "register" ? "register" : "login"}`, { method: "POST", body: { name: f.name?.value, phone: f.phone.value, password: f.password.value, turnstileToken: await getToken() } });
        await me(true);
        await wishlist.sync();
        navigate(next);
      } catch (err) { showFieldErrors(f, err); toast(errMsg(err), "error"); }
    });
  };
  draw();
}

// ---------------------------------------------------------------- tabs
async function orders(body) {
  const { orders } = await api("/me/orders");
  if (!orders.length) { body.innerHTML = String(emptyState(t("noOrders"), "", html`<a class="btn primary" href="/shop">${t("shop")}</a>`)); return; }
  body.innerHTML = String(html`<div class="order-list">${orders.map((o) => html`<a class="card pad order-row" href="/order/${o.order_no}?token=${o.public_token}">
    <img src="${o.image}" alt="" width="56" height="56"><div><b>${o.order_no}</b><div class="muted small">${date(o.created_at)} · ${num(o.item_count)} ${lang() === "bn" ? "টি পণ্য" : "items"}${o.invoice_no ? ` · ${o.invoice_no}` : ""}</div></div>
    <div class="right"><b>${money(o.total)}</b><span class="pill ${o.status}">${t(`status_${o.status}`)}</span>${o.return_status ? html`<span class="pill">${t("returns")}: ${o.return_status}</span>` : ""}</div></a>`)}</div>`);
}

async function wishlistTab(body) {
  const ids = [...wishlist.ids()];
  if (!ids.length) { body.innerHTML = String(emptyState(t("wishlist"), lang() === "bn" ? "পছন্দের পণ্যে ♡ চাপুন।" : "Tap ♡ on anything you love.")); return; }
  const r = await api(`/products?ids=${ids.join(",")}&limit=48`);
  body.innerHTML = String(productGrid(r.items));
  bindCards(body);
}

async function addresses(body) {
  const { addresses } = await api("/me/addresses");
  body.innerHTML = String(html`<div class="grid cards">${addresses.map((a) => html`<div class="card pad"><b>${a.label}</b>${a.is_default ? html` <span class="pill active">${t("defaultTag")}</span>` : ""}<p>${a.recipient_name} · ${a.phone}<br>${a.area}, ${a.upazila}, ${a.district}</p>
    <button class="btn sm" type="button" data-edit="${a.id}">${t("edit")}</button> <button class="btn sm ghost" type="button" data-del="${a.id}">${t("delete")}</button></div>`)}
    <button class="card pad add-card" type="button" id="add-addr">${icon("plus")} ${t("addNew")}</button></div>`);
  const edit = (a = {}) => {
    const { panel, close } = overlay("modal", {
      title: a.id ? t("edit") : t("addNew"),
      body: html`<form class="stack" id="addr">
        <div class="form-grid"><label class="field"><span>${t("label")}</span><input class="input" name="label" value="${a.label ?? "Home"}"></label>
        <label class="field"><span>${t("recipient")}</span><input class="input" name="recipient_name" required value="${a.recipient_name ?? ""}"></label>
        <label class="field span2"><span>${t("mobile")}</span><input class="input" name="phone" required inputmode="tel" value="${a.phone ?? ""}"></label></div>
        <div class="form-grid three"><label class="field"><span>${t("division")}</span><select class="input" name="division_id" required></select></label>
        <label class="field"><span>${t("district")}</span><select class="input" name="district_id" required></select></label>
        <label class="field"><span>${t("upazila")}</span><select class="input" name="upazila_id" required></select></label></div>
        <label class="field"><span>${t("area")}</span><textarea class="input" name="area" required rows="2">${a.area ?? ""}</textarea></label>
        <label class="check"><input type="checkbox" name="is_default" ${a.is_default ? raw("checked") : ""}> ${t("makeDefault")}</label>
        <button class="btn primary block" type="submit">${t("save")}</button></form>`,
    });
    const f = $("#addr", panel);
    let geoSel = null;
    bindGeo(f, a, (g) => (geoSel = g));
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api(a.id ? `/me/addresses/${a.id}` : "/me/addresses", { method: a.id ? "PUT" : "POST", body: { ...(geoSel ?? {}), label: f.label.value, recipient_name: f.recipient_name.value, phone: f.phone.value, area: f.area.value, is_default: f.is_default.checked } });
        toast(t("saved"));
        close();
        addresses(body);
      } catch (err) { showFieldErrors(f, err); toast(errMsg(err), "error"); }
    });
  };
  $("#add-addr", body).addEventListener("click", () => edit());
  $$("[data-edit]", body).forEach((b) => b.addEventListener("click", () => edit(addresses.find((x) => x.id === +b.dataset.edit))));
  $$("[data-del]", body).forEach((b) => b.addEventListener("click", async () => {
    if (!confirm(lang() === "bn" ? "ঠিকানাটি মুছবেন?" : "Delete this address?")) return;
    try { await api(`/me/addresses/${b.dataset.del}`, { method: "DELETE" }); addresses(body); } catch (e) { toast(errMsg(e), "error"); }
  }));
}

async function regulars(body) {
  const { items } = await api("/me/regulars");
  if (!items.length) { body.innerHTML = String(emptyState(t("myRoutine"), t("noRoutine"), html`<a class="btn primary" href="/finder">${t("finder")}</a>`)); return; }
  body.innerHTML = String(html`<p class="muted">${t("myRoutineSub")}</p>
    <ol class="kit-steps">${items.map((p) => html`<li><span class="shelf-label">${L(p, "category") || t("shop")}</span>${productCard(p)}
      <div class="regular-meta small muted">${t("lastOrdered", { d: date(p.last_ordered) })}${p.times > 1 ? html` · ${t("timesOrdered", { n: num(p.times) })}` : ""}${p.in_stock && p.variant_id ? html` · <button class="link-btn" type="button" data-reorder="${p.slug}" data-variant="${p.variant_id}">${icon("bag")} ${t("reorder")}</button>` : ""}</div></li>`)}</ol>`);
  bindCards(body);
  $$("[data-reorder]", body).forEach((b) => b.addEventListener("click", async () => {
    const d = await api(`/products/${b.dataset.reorder}`).catch(() => null);
    const v = d?.variants.find((x) => x.id === Number(b.dataset.variant) && x.stock > 0) ?? d?.variants.find((x) => x.stock > 0);
    if (v) addToCart(d.product, v, 1);
  }));
}

async function returns(body, { query }) {
  const [{ returns: list }, { orders }] = await Promise.all([api("/me/returns"), api("/me/orders")]);
  const eligible = orders.filter((o) => o.status === "delivered" && o.delivered_at && Date.now() - Date.parse(o.delivered_at) < 7 * 86400_000 && !o.return_status);
  const pre = query.get("order");
  body.innerHTML = String(html`
    ${eligible.length ? html`<form class="card pad stack" id="ret"><h2>${t("requestReturn")}</h2>
      <label class="field"><span>${t("orderNumber")}</span><select class="input" name="orderNo">${eligible.map((o) => html`<option value="${o.order_no}" ${o.order_no === pre ? raw("selected") : ""}>${o.order_no} · ${money(o.total)}</option>`)}</select></label>
      <label class="field"><span>${t("returnReason")}</span><select class="input" name="reason">${["damaged", "wrong_item", "not_working", "not_as_described", "changed_mind", "other"].map((r) => html`<option value="${r}">${t(`reason_${r}`)}</option>`)}</select></label>
      <label class="field"><span>${t("details")}</span><textarea class="input" name="details" rows="2"></textarea></label>
      <button class="btn primary" type="submit">${t("send")}</button></form>` : html`<p class="muted note-card">${lang() === "bn" ? "ডেলিভারির ৭ দিনের মধ্যে রিটার্নের অনুরোধ করা যায় — বক্স ও সব এক্সেসরিজসহ। পরে কোনো ত্রুটি হলে ওয়ারেন্টি ট্যাবে ক্লেইম করুন।" : "Returns can be requested within 7 days of delivery, with the box and all accessories. For a fault that shows up later, use the Warranty tab."}</p>`}
    ${list.length ? html`<h2>${t("returns")}</h2>${list.map((r) => html`<div class="card pad"><b>${r.order_no}</b> · ${t(`reason_${r.reason}`)} <span class="pill">${r.status}</span>${r.refund_amount ? html` · ${money(r.refund_amount)}` : ""}${r.admin_note ? html`<p class="small muted">${r.admin_note}</p>` : ""}</div>`)}` : ""}`);
  $("#ret", body)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      const r = await api("/me/returns", { method: "POST", body: { orderNo: f.orderNo.value, reason: f.reason.value, details: f.details.value } });
      toast(r[lang()] ?? r.en);
      returns(body, { query });
    } catch (err) { toast(errMsg(err), "error"); }
  });
}

// ---------------------------------------------------------------- warranty claims
async function warranty(body, { query }) {
  const { items, claims } = await api("/me/warranty");
  const eligible = items.filter((i) => i.in_warranty && !i.open_claim);
  const pre = query.get("item");
  const itemLabel = (i) => `${L(i, "name")}${[i.size && i.size !== "Standard" ? i.size : "", i.color].filter(Boolean).length ? ` (${[i.size && i.size !== "Standard" ? i.size : "", i.color].filter(Boolean).join(", ")})` : ""} · ${i.order_no}`;
  const progress = (status) => {
    const steps = status === "rejected" ? ["submitted", "under_review", "rejected"] : CLAIM_STEPS;
    const at = steps.indexOf(status);
    return html`<ol class="claim-steps">${steps.map((s, i) => html`<li class="${i < at ? "done" : i === at ? "current" : ""} ${s}">${t(`claim_${s}`)}</li>`)}</ol>`;
  };
  body.innerHTML = String(html`
    ${eligible.length ? html`<form class="card pad stack" id="claim"><h2>${icon("wrench")} ${t("claimNew")}</h2>
      <p class="small muted">${t("claimWhatsCovered")}</p>
      <label class="field"><span>${t("claimPick")}</span><select class="input" name="item" id="claim-item">${eligible.map((i) => html`<option value="${i.order_no}|${i.order_item_id}" ${String(i.order_item_id) === pre ? raw("selected") : ""}>${itemLabel(i)}</option>`)}</select></label>
      <p class="small mono" id="claim-meta"></p>
      <label class="field"><span>${t("claimIssue")}</span><select class="input" name="issue">${ISSUES.map((k) => html`<option value="${k}">${t(`issue_${k}`)}</option>`)}</select></label>
      <label class="field"><span>${t("claimDetails")}</span><textarea class="input" name="details" rows="3" required minlength="10" maxlength="1500"></textarea></label>
      <label class="field"><span>${t("serialNo")}</span><input class="input mono" name="serial" maxlength="60" autocomplete="off"></label>
      <button class="btn primary" type="submit">${t("claimSubmit")}</button></form>`
      : html`<p class="muted note-card">${items.length ? t("claimWhatsCovered") : t("noWarrantyItems")}</p>`}

    ${items.length ? html`<h2>${t("warranty")}</h2><div class="warranty-items">${items.map((i) => html`<div class="card pad warranty-item">
      ${i.image ? html`<img src="${i.image}" alt="" width="56" height="56" loading="lazy">` : ""}
      <div><b>${L(i, "name")}</b><div class="small muted mono">${i.sku} · ${i.order_no}${i.serials ? ` · S/N ${i.serials}` : ""}</div>
        <div class="small ${i.in_warranty ? "green" : "muted"}">${icon("shield")} ${i.in_warranty ? t("warrantyUntil", { d: date(i.warranty_until) }) : t("warrantyEnded", { d: date(i.warranty_until) })}</div>
        ${i.open_claim ? html`<span class="pill">${t("claimOpen", { c: i.open_claim })}</span>` : ""}</div></div>`)}</div>` : ""}

    <h2>${t("myClaims")}</h2>
    ${claims.length ? html`<div class="claims">${claims.map((c) => html`<article class="card pad claim">
      <div class="row"><b class="mono">${c.claim_no}</b><span class="pill ${c.status}">${t(`claim_${c.status}`)}</span>${c.resolution && c.resolution !== "none" ? html`<span class="pill">${t(`resolution_${c.resolution}`)}</span>` : ""}<span class="muted small">${date(c.created_at)}</span></div>
      <p class="small"><b>${L(c, "name")}</b> · ${t(`issue_${c.issue}`)}${c.serial ? html` · <span class="mono">S/N ${c.serial}</span>` : ""}</p>
      ${progress(c.status)}
      ${c.customer_note ? html`<p class="small note-card"><b>${t("claimNote")}:</b> ${c.customer_note}</p>` : ""}</article>`)}</div>` : html`<p class="muted">${t("noClaims")}</p>`}`);
  const f = $("#claim", body);
  if (!f) return;
  const meta = () => {
    const [no, id] = f.item.value.split("|");
    const i = eligible.find((x) => x.order_no === no && String(x.order_item_id) === id);
    $("#claim-meta", body).textContent = i ? `${t("warrantyUntil", { d: date(i.warranty_until) })}${i.serials ? ` · ${t("serialOnFile", { s: i.serials })}` : ""}` : "";
    if (i?.serials && !i.serials.includes(",")) f.serial.value = i.serials;
  };
  f.item.addEventListener("change", meta);
  meta();
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const [orderNo, orderItemId] = f.item.value.split("|");
    try {
      const r = await api("/me/warranty", { method: "POST", body: { orderNo, orderItemId: Number(orderItemId), issue: f.issue.value, details: f.details.value, serial: f.serial.value || undefined } });
      toast(r[lang()] ?? t("claimSent"));
      warranty(body, { query });
    } catch (err) {
      showFieldErrors(f, err);
      toast(errMsg(err), "error");
    }
  });
}

async function referral(body) {
  const r = await api("/me/referral");
  if (!r.enabled) { body.innerHTML = String(html`<p class="muted">—</p>`); return; }
  const code = r.referral.code;
  const { store, brand } = await config();
  const shop = lang() === "bn" ? store.name_bn || brand.name.bn : store.name_en || brand.name.en;
  const msg = lang() === "bn" ? `${shop} থেকে প্রথম অর্ডারে ৳${r.referral.friend_discount} ছাড় পেতে আমার কোড ${code} ব্যবহার করুন: ${location.origin}` : `Use my code ${code} for ৳${r.referral.friend_discount} off your first order at ${shop}: ${location.origin}`;
  body.innerHTML = String(html`<div class="card pad referral">
    <h2>${t("referralHeadline", { friend: num(r.referral.friend_discount), reward: num(r.referral.reward) })}</h2>
    <p class="muted">${t("referralSub", { min: num(r.minOrder) })}</p>
    <div class="code-box"><span class="muted small">${t("yourCode")}</span><b>${code}</b><button class="btn sm" type="button" id="copy">${icon("copy")} ${t("copy")}</button></div>
    <p><a class="btn primary" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${icon("whatsapp")} ${t("share")}</a></p>
    <p class="small">${t("uses")}: <b>${num(r.referral.uses)}</b> · ${t("rewards")}: <b>${num(r.referral.rewards_earned)}</b></p>
    ${r.rewards.length ? html`<ul>${r.rewards.map((c) => html`<li><b>${c.code}</b> — ${money(c.value)} ${c.used_count ? "✓" : ""} <small class="muted">${c.expires_at ? date(c.expires_at) : ""}</small></li>`)}</ul>` : ""}
  </div>`);
  $("#copy", body).addEventListener("click", async () => { await navigator.clipboard?.writeText(code); toast(t("copied")); });
}


async function profile(body, { who }) {
  body.innerHTML = String(html`<form class="card pad stack narrow-form" id="prof">
    <label class="field"><span>${t("fullName")}</span><input class="input" name="name" required value="${who.name}"></label>
    <label class="field"><span>${t("mobile")}</span><input class="input" value="${who.phone}" disabled></label>
    <label class="field"><span>${t("email")}</span><input class="input" name="email" type="email" value="${who.email ?? ""}"></label>
    <details><summary>${t("newPassword")}</summary>
      <label class="field"><span>${t("password")}</span><input class="input" name="currentPassword" type="password" autocomplete="current-password"></label>
      <label class="field"><span>${t("newPassword")}</span><input class="input" name="newPassword" type="password" minlength="8" autocomplete="new-password"></label></details>
    <button class="btn primary" type="submit">${t("save")}</button></form>`);
  $("#prof", body).addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      await api("/me", { method: "PUT", body: { name: f.name.value, email: f.email.value, currentPassword: f.currentPassword.value || undefined, newPassword: f.newPassword.value || undefined } });
      await me(true);
      toast(t("saved"));
    } catch (err) { showFieldErrors(f, err); toast(errMsg(err), "error"); }
  });
}
