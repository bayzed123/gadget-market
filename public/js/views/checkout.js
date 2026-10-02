// Cart & checkout: server-priced cart, coupon/referral codes, guest checkout with Division → District → Upazila,
// live delivery fee, phone OTP, abandoned-checkout autosave (on field blur), COD / MFS / card, Turnstile.
import { t, L, lang, money, num } from "../i18n.js";
import { $, $$, api, html, icon, raw, cart, config, errMsg, toast, bindGeo, bindAreaSearch, geoByNames, normalizePhone, showFieldErrors, debounce, turnstile, sessionId, resetSession, utm, adRef, cookie, me } from "../core.js";
import { track } from "../track.js";
import { emptyState, warrantyNote } from "../ui.js";

export default async function checkout(el, { variant, query, navigate }) {
  const resume = query.get("resume");
  let resumed = null;
  if (resume) {
    try {
      resumed = await api(`/checkout/resume/${encodeURIComponent(resume)}`);
      try { localStorage.setItem("gmk_sid", JSON.stringify(resume)); } catch { /* ignore */ }
      if (resumed.items.length && !cart.items().length) {
        // Rebuild the cart from the saved draft (names/prices are re-fetched by the quote below).
        const q = await api("/cart/quote", { method: "POST", body: { items: resumed.items } });
        cart.clear();
        for (const l of q.lines) cart.add({ variantId: l.variantId, productId: l.productId, sku: l.sku, name_en: l.name_en, name_bn: l.name_bn, size: l.size, color: l.color, image: l.image, unitPrice: l.unitPrice }, l.quantity);
      }
      if (resumed.coupon) cart.setCoupon(resumed.coupon);
    } catch { /* expired link — carry on with the current cart */ }
  }
  if (variant === "cart") return renderCart(el, navigate);
  if (!cart.items().length) {
    el.innerHTML = String(html`<div class="container section">${emptyState(t("cartEmpty"), "", html`<a class="btn primary" href="/shop">${t("continueShopping")}</a>`)}</div>`);
    return;
  }
  return renderCheckout(el, navigate, { resumed });
}

// ---------------------------------------------------------------- cart page
async function renderCart(el, navigate) {
  const draw = async () => {
    const items = cart.items();
    if (!items.length) {
      el.innerHTML = String(html`<div class="container section">${emptyState(t("cartEmpty"), "", html`<a class="btn primary" href="/shop">${t("continueShopping")}</a>`)}</div>`);
      return;
    }
    let q = null, err = "";
    try {
      q = await api("/cart/quote", { method: "POST", body: { items: items.map(({ variantId, quantity }) => ({ variantId, quantity })), couponCode: cart.coupon() || undefined } });
    } catch (e) {
      err = errMsg(e);
      if (e.data?.code === "coupon") { cart.setCoupon(""); }
    }
    el.innerHTML = String(html`<div class="container section">
      <h1>${t("yourCart")}</h1>
      ${err ? html`<p class="error-box">${err}</p>` : ""}
      <div class="checkout-grid">
        <div class="card pad">
          ${items.map((i) => html`<div class="cart-line">
            <img src="${i.image}" alt="" width="80" height="80" loading="lazy">
            <div><a href="/product/${i.slug}"><b>${lang() === "bn" ? i.name_bn : i.name_en}</b></a><div class="muted small">${[i.size !== "Standard" ? i.size : "", i.color].filter(Boolean).join(" · ")}</div>
              <div class="qty sm"><button type="button" data-dec="${i.variantId}" aria-label="-">${icon("minus")}</button><output>${num(i.quantity)}</output><button type="button" data-inc="${i.variantId}" aria-label="+">${icon("plus")}</button></div></div>
            <div class="right"><b>${money(i.unitPrice * i.quantity)}</b><button class="link-btn" type="button" data-rm="${i.variantId}">${t("remove")}</button></div>
          </div>`)}
        </div>
        <aside class="card pad summary">
          <form class="coupon-row" id="coupon"><input class="input" name="code" placeholder="${t("coupon")}" value="${cart.coupon()}" autocomplete="off"><button class="btn" type="submit">${t("applyCoupon")}</button></form>
          ${q ? totals(q) : ""}
          <a class="btn primary lg block" href="/checkout">${t("proceedCheckout")}</a>
          <a class="btn ghost block" href="/shop">${t("continueShopping")}</a>
        </aside>
      </div></div>`);
    $$("[data-inc]", el).forEach((b) => b.addEventListener("click", () => { const i = items.find((x) => x.variantId === +b.dataset.inc); cart.setQty(i.variantId, i.quantity + 1); draw(); }));
    $$("[data-dec]", el).forEach((b) => b.addEventListener("click", () => { const i = items.find((x) => x.variantId === +b.dataset.dec); if (i.quantity > 1) cart.setQty(i.variantId, i.quantity - 1); else cart.remove(i.variantId); draw(); }));
    $$("[data-rm]", el).forEach((b) => b.addEventListener("click", () => { cart.remove(+b.dataset.rm); draw(); }));
    $("#coupon", el).addEventListener("submit", (e) => { e.preventDefault(); cart.setCoupon(e.currentTarget.code.value.trim()); draw(); });
  };
  await draw();
}

/**
 * Delivery line. Free delivery (free-delivery items, a free-delivery coupon or the area's free-over amount)
 * never shows a charge; otherwise the charge is auto-calculated once the area is chosen.
 */
function deliveryRow(q) {
  if (q.freeDelivery === "products" || q.freeDelivery === "coupon") {
    return html`<div class="green"><span>${t("delivery")} <small>(${q.freeDelivery === "coupon" ? `${t("freeDeliveryCoupon")} ${q.couponCode ?? ""}`.trim() : t("freeDeliveryItems")})</small></span><b>${t("freeDelivery")}</b></div>`;
  }
  if (!q.zone) return html`<div class="muted"><span>${t("delivery")}</span><small>${t("deliveryAtCheckout")}</small></div>`;
  return html`<div${q.deliveryFee ? "" : raw(' class="green"')}><span>${t("delivery")} <small class="muted">${L(q.zone, "name")}</small></span><b>${q.deliveryFee ? money(q.deliveryFee) : t("freeDelivery")}</b></div>`;
}

function totals(q, tax) {
  return html`<div class="totals">
    <div><span>${t("subtotal")}</span><b>${money(q.subtotal)}</b></div>
    ${q.discount ? html`<div class="green"><span>${t("discount")}${q.couponCode || q.referralCode ? ` (${q.couponCode || q.referralCode})` : ""}</span><b>−${money(q.discount)}</b></div>` : ""}
    ${deliveryRow(q)}
    ${q.giftWrap ? html`<div><span>${t("giftWrap")}</span><b>${q.giftWrapFee ? money(q.giftWrapFee) : t("free")}</b></div>` : ""}
    ${q.vat ? html`<div class="muted small"><span>${q.vatInclusive ? t("vatIncluded", { rate: tax?.rate ?? "" }) : t("vat")}</span><span>${money(q.vat)}</span></div>` : ""}
    <div class="grand"><span>${t("total")}</span><b>${money(q.total)}</b></div></div>`;
}

// ---------------------------------------------------------------- checkout page
async function renderCheckout(el, navigate, { resumed }) {
  const cfg = await config();
  const who = await me();
  const pays = Object.entries(cfg.payments).filter(([, v]) => v.enabled);
  const prefill = { name: resumed?.customer?.name ?? who?.name ?? "", phone: resumed?.customer?.phone ?? who?.phone ?? "", email: resumed?.customer?.email ?? who?.email ?? "" };
  let otpToken = null, otpPhone = null, quote = null, addr = null;

  el.innerHTML = String(html`<div class="container section">
    <h1>${t("checkout")}</h1>
    <form class="checkout-grid" id="co" novalidate>
      <div class="stack">
        <section class="card pad">
          <h2 class="step"><span>1</span> ${t("contactDetails")}</h2>
          <div class="form-grid">
            <label class="field"><span>${t("fullName")} *</span><input class="input" name="name" autocomplete="name" required value="${prefill.name}"></label>
            <label class="field"><span>${t("mobile")} *</span><input class="input" name="phone" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" required value="${prefill.phone}"></label>
            <label class="field span2"><span>${t("email")}</span><input class="input" name="email" type="email" autocomplete="email" value="${prefill.email}"></label>
          </div>
          ${cfg.otp.available ? html`<div class="otp-box" id="otp-box">
            <p class="small muted">${icon("shield")} ${t("verifyWhy")}</p>
            <div class="row" id="otp-send-row"><button class="btn" type="button" id="otp-send">${t("sendCode")}</button><span id="otp-state" class="small"></span></div>
            <div class="row" id="otp-code-row" hidden><input class="input code-input" name="otp" inputmode="numeric" maxlength="6" placeholder="${t("enterCode")}" autocomplete="one-time-code"><button class="btn primary" type="button" id="otp-verify">${t("verify")}</button><button class="link-btn" type="button" id="otp-resend">${t("resend")}</button></div>
            ${!cfg.otp.required ? html`<p class="small muted">${t("skipOtp")}</p>` : ""}
          </div>` : html`<p class="small muted">${icon("phone")} ${t("weWillCall")}</p>`}
        </section>

        <section class="card pad">
          <h2 class="step"><span>2</span> ${t("deliveryAddress")}</h2>
          <label class="field area-search"><span>${t("quickArea")}</span><input class="input" id="area-q" autocomplete="off" placeholder="1205 / Dhanmondi / ধানমন্ডি" aria-controls="area-list"><div class="suggest" id="area-list" role="listbox" hidden></div></label>
          <div class="form-grid three">
            <label class="field"><span>${t("division")} *</span><select class="input" name="division_id" required></select></label>
            <label class="field"><span>${t("district")} *</span><select class="input" name="district_id" required disabled></select></label>
            <label class="field"><span>${t("upazila")} *</span><select class="input" name="upazila_id" required disabled></select></label>
          </div>
          <label class="field"><span>${t("area")} *</span><textarea class="input" name="area" rows="2" required placeholder="${t("areaHint")}">${resumed?.address?.area ?? ""}</textarea></label>
          <p class="small muted" id="zone-note"></p>
          <label class="field"><span>${t("orderNote")}</span><input class="input" name="note" maxlength="500"></label>
          ${cfg.giftWrap?.enabled ? html`<label class="check gift-wrap"><input type="checkbox" name="giftWrap"> ${icon("gift")} <span>${t("giftWrapAdd", { fee: money(cfg.giftWrap.fee) })}</span></label>` : ""}
          <label class="field" id="gift-msg" hidden><span>${t("giftMessage")}</span><input class="input" name="giftMessage" maxlength="300"></label>
        </section>

        <section class="card pad">
          <h2 class="step"><span>3</span> ${t("payment")}</h2>
          <div class="pay-options">
            ${pays.map(([k, v], i) => html`<label class="pay-option"><input type="radio" name="paymentMethod" value="${k}" ${i === 0 ? raw("checked") : ""}>
              <span class="pay-logo ${k.toLowerCase()}">${k === "COD" ? icon("cash") : k === "Card" ? "VISA" : k}</span>
              <span><b>${k === "COD" ? t("cod") : k === "Card" ? t("card") : k}</b><small class="muted">${k === "COD" ? t("codSub") : k === "Card" ? t("cardSub") : v.mode === "api" ? t("payOnPage", { method: k }) : v.number ? `${v.number} (${v.accountType})` : ""}</small></span></label>`)}
          </div>
          <div id="mfs-box" hidden class="note-card">
            <p id="mfs-text"></p>
            <label class="field"><span>${t("trxId")} *</span><input class="input" name="paymentRef" autocomplete="off" maxlength="60"></label>
          </div>
          <div id="turnstile"></div>
        </section>
      </div>

      <aside class="card pad summary sticky">
        <h2>${t("orderSummary")}</h2>
        <div id="lines"></div>
        <div class="coupon-row"><input class="input" name="couponCode" placeholder="${t("coupon")}" value="${cart.coupon()}" autocomplete="off"><button class="btn" type="button" id="apply-coupon">${t("applyCoupon")}</button></div>
        <div id="totals"></div>
        <p class="error-box" id="form-error" hidden></p>
        <button class="btn primary lg block" type="submit" id="place">${t("placeOrder")}</button>
        <p class="small muted center">${icon("shield")} ${t("secureCheckout")}</p>
        ${warrantyNote(cfg.store, { compact: true })}
      </aside>
    </form></div>`);

  const form = $("#co", el);
  const items = () => cart.items().map(({ variantId, quantity }) => ({ variantId, quantity }));

  // ---- quote (server-priced) ----
  const requote = async () => {
    try {
      quote = await api("/cart/quote", { method: "POST", body: { items: items(), address: addr ?? undefined, couponCode: form.couponCode.value.trim() || undefined, phone: normalizePhone(form.phone.value) ?? undefined, giftWrap: Boolean(form.giftWrap?.checked) } });
      $("#lines", el).innerHTML = String(html`${quote.lines.map((l) => html`<div class="line"><img src="${l.image}" alt="" width="56" height="56"><div><b>${L(l, "name")}</b><div class="meta">${[l.size !== "Standard" ? l.size : "", l.color].filter(Boolean).join(" · ")} × ${num(l.quantity)}</div></div><b>${money(l.lineTotal)}</b></div>`)}`);
      $("#totals", el).innerHTML = String(totals(quote, cfg.tax));
      if (quote.zone && $("#zone-note", el)) $("#zone-note", el).textContent = [L(quote.zone, "name"), L(quote.zone, "eta") ? t("deliveryIn", { eta: L(quote.zone, "eta") }) : ""].filter(Boolean).join(" · ");
      cart.setCoupon(quote.couponCode || quote.referralCode || "");
      $("#form-error", el).hidden = true;
    } catch (e) {
      if (e.data?.code === "coupon") { form.couponCode.value = ""; cart.setCoupon(""); toast(errMsg(e), "error"); return requote(); }
      $("#form-error", el).hidden = false;
      $("#form-error", el).textContent = errMsg(e);
    }
  };
  form.giftWrap?.addEventListener("change", () => {
    $("#gift-msg", el).hidden = !form.giftWrap.checked;
    requote();
  });
  $("#apply-coupon", el).addEventListener("click", async () => { await requote(); if (quote?.couponCode || quote?.referralCode) toast(t("couponApplied")); });

  // ---- address cascade + quick search ----
  {
    let initial = {};
    if (resumed?.address?.district) initial = (await geoByNames(resumed.address.division, resumed.address.district, resumed.address.upazila)) ?? {};
    const geoCtl = await bindGeo(form, initial, (a) => { addr = a; requote(); saveDraft("address"); });
    bindAreaSearch($("#area-q", el), $("#area-list", el), geoCtl);
  }

  // ---- abandoned-checkout autosave (debounced, on blur) ----
  let leadFired = false;
  const saveDraft = debounce(async (step = "contact") => {
    const phone = normalizePhone(form.phone.value);
    if (!form.name.value.trim() && !phone) return;
    try {
      const r = await api("/checkout/draft", {
        method: "POST",
        body: {
          sessionId: sessionId(), name: form.name.value.trim() || undefined, phone: phone ?? undefined, email: form.email.value.trim() || undefined,
          division: addr?.division, district: addr?.district, upazila: addr?.upazila, area: form.area?.value.trim() || undefined,
          items: items(), lastStep: step, utm: utm(), lang: lang(), fbp: cookie("_fbp"), fbc: cookie("_fbc"),
        },
      });
      if (r.leadEventId && !leadFired) { leadFired = true; track("Lead", { eventId: r.leadEventId, relay: false, value: quote?.subtotal }); }
    } catch { /* autosave is best-effort */ }
  }, 600);
  form.addEventListener("focusout", (e) => {
    if (!e.target.name) return;
    const step = ["division_id", "district_id", "upazila_id", "area"].includes(e.target.name) ? "address" : e.target.name === "paymentRef" ? "payment" : "contact";
    saveDraft(step);
  });

  // ---- phone verification ----
  if (cfg.otp.available) {
    const state = $("#otp-state", el);
    const send = async () => {
      const phone = normalizePhone(form.phone.value);
      if (!phone) return showFieldErrors(form, { data: { fields: [{ field: "phone", en: "Enter a valid mobile number", bn: "সঠিক মোবাইল নম্বর দিন" }] } });
      try {
        const r = await api("/otp/send", { method: "POST", body: { phone, lang: lang() } });
        toast(r[lang()] ?? r.en);
        if (r.devCode) toast(`DEV code: ${r.devCode}`, "info", 8000);
        $("#otp-code-row", el).hidden = false;
        form.otp.focus();
      } catch (e) { toast(errMsg(e), "error"); }
    };
    $("#otp-send", el).addEventListener("click", send);
    $("#otp-resend", el).addEventListener("click", send);
    $("#otp-verify", el).addEventListener("click", async () => {
      const phone = normalizePhone(form.phone.value);
      try {
        const r = await api("/otp/verify", { method: "POST", body: { phone, code: form.otp.value.trim() } });
        otpToken = r.otpToken;
        otpPhone = phone;
        $("#otp-code-row", el).hidden = true;
        $("#otp-send", el).hidden = true;
        state.innerHTML = String(html`<span class="ok">${icon("check")} ${t("verified")}</span>`);
      } catch (e) { showFieldErrors(form, e); toast(errMsg(e), "error"); }
    });
    form.phone.addEventListener("input", () => {
      if (otpPhone && normalizePhone(form.phone.value) !== otpPhone) { otpToken = otpPhone = null; $("#otp-send", el).hidden = false; state.textContent = ""; }
    });
  }

  // ---- payment method details ----
  const payBox = () => {
    const m = form.paymentMethod.value;
    const v = cfg.payments[m];
    const manual = ["bKash", "Nagad", "Rocket"].includes(m) && v?.mode !== "api";
    $("#mfs-box", el).hidden = !manual;
    if (manual) $("#mfs-text", el).textContent = t("mfsSend", { method: m, type: v.accountType, number: v.number, total: num(quote?.total ?? 0) });
  };
  $$('input[name="paymentMethod"]', form).forEach((r) => r.addEventListener("change", payBox));

  const getTurnstile = await turnstile($("#turnstile", el));
  await requote();
  payBox();
  track("InitiateCheckout", { value: quote?.total, items: (quote?.lines ?? []).map((l) => ({ sku: l.sku, name: l.name_en, price: l.unitPrice, quantity: l.quantity })) });

  // ---- place order ----
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#place", el);
    const phone = normalizePhone(form.phone.value);
    const method = form.paymentMethod.value;
    if (cfg.otp.required && method === "COD" && !otpToken) {
      $("#otp-box", el)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return toast(lang() === "bn" ? "অর্ডারের আগে মোবাইল নম্বর যাচাই করুন।" : "Please verify your mobile number first.", "error");
    }
    btn.disabled = true;
    btn.textContent = t("placing");
    try {
      const body = {
        customer: { name: form.name.value.trim(), phone: phone ?? form.phone.value, email: form.email.value.trim() },
        address: { ...(addr ?? {}), area: form.area.value.trim() },
        items: items(),
        couponCode: form.couponCode.value.trim() || undefined,
        paymentMethod: method,
        paymentRef: form.paymentRef.value.trim() || undefined,
        note: form.note.value.trim() || undefined,
        giftMessage: form.giftMessage?.value.trim() || undefined,
        giftWrap: Boolean(form.giftWrap?.checked),
        lang: lang(),
        turnstileToken: await getTurnstile(),
        otpToken: otpToken ?? undefined,
        sessionId: sessionId(),
        utm: utm(),
        adRef: adRef(),
        fbp: cookie("_fbp"),
        fbc: cookie("_fbc"),
      };
      const r = await api("/orders", { method: "POST", body });
      try { sessionStorage.setItem(`gmk_purchase_${r.orderNo}`, JSON.stringify({ eventId: r.purchaseEventId, value: r.total, items: r.items })); } catch { /* ignore */ }
      cart.clear();
      cart.setCoupon("");
      resetSession();
      if (r.redirectUrl) location.href = r.redirectUrl;
      else navigate(`/order/${r.orderNo}?token=${r.token}&new=1`);
    } catch (err) {
      showFieldErrors(form, err);
      $("#form-error", el).hidden = false;
      $("#form-error", el).textContent = errMsg(err);
      if (err.data?.code === "otp_required") $("#otp-box", el)?.scrollIntoView({ behavior: "smooth", block: "center" });
      btn.disabled = false;
      btn.textContent = t("placeOrder");
    }
  });
}
