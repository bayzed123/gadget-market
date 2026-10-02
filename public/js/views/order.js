// Order confirmation & tracking: status timeline, courier tracking, invoice PDF, Purchase event (same id as the
// server's Conversions API event), review form for delivered items, return request, push opt-in.
import { t, L, lang, money, num, date } from "../i18n.js";
import { $, api, html, icon, raw, errMsg, toast, config, me } from "../core.js";
import { track } from "../track.js";
import { STATUS_STEPS } from "../ui.js";

export default async function order(el, { params, query, navigate }) {
  const orderNo = params.orderNo;
  if (!orderNo) return trackForm(el, navigate);
  const token = query.get("token");
  const phone = query.get("phone");
  el.innerHTML = String(html`<div class="container section narrow"><div class="skel line"></div><div class="skel sq"></div></div>`);
  let d;
  try {
    d = await api(`/orders/track?order=${encodeURIComponent(orderNo)}${token ? `&token=${encodeURIComponent(token)}` : ""}${phone ? `&phone=${encodeURIComponent(phone)}` : ""}`);
  } catch (e) {
    return trackForm(el, navigate, e.status === 404 ? (lang() === "bn" ? "অর্ডারটি পাওয়া যায়নি। নম্বর দুটি আবার দেখুন।" : "We couldn't find that order. Please check both numbers.") : errMsg(e));
  }
  const o = d.order;
  const fresh = query.get("new") === "1";
  const payment = query.get("payment");

  // Fire the browser Purchase event once, with the id the Worker already used for the Conversions API.
  const key = `gmk_purchase_${o.order_no}`;
  try {
    const p = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (p) {
      track("Purchase", { eventId: p.eventId, value: p.value, transactionId: o.order_no, relay: false, items: p.items.map((i) => ({ sku: i.sku, name: i.name, price: i.price, quantity: i.quantity })) });
      sessionStorage.removeItem(key);
    }
  } catch { /* ignore */ }

  const finalBad = ["cancelled", "refused", "returned"].includes(o.status);
  const stepIndex = STATUS_STEPS.indexOf(o.status === "confirmation_attempted" ? "pending" : o.status);
  const cfg = await config();
  const invoiceUrl = o.invoice_no ? `/api/orders/${o.order_no}/invoice.pdf?${token ? `token=${encodeURIComponent(token)}` : `phone=${encodeURIComponent(phone ?? "")}`}` : null;

  el.innerHTML = String(html`<div class="container section narrow">
    ${fresh ? html`<div class="success-hero"><div class="blob-icon big">${icon("check")}</div><h1>${o.status === "confirmed" ? t("confirmedAuto") : t("thankYou")}</h1>
      <p>${o.status === "confirmed" ? "" : o.otp_verified ? (lang() === "bn" ? "আমরা শীঘ্রই অর্ডারটি কনফার্ম করবো।" : "We'll confirm your order shortly.") : t("weWillCall")}</p></div>` : html`<h1>${t("orderStatus")}</h1>`}
    ${payment === "paid" ? html`<p class="note-card ok">${icon("check")} ${lang() === "bn" ? "পেমেন্ট সফল হয়েছে।" : "Payment received."}</p>` : payment ? html`<p class="error-box">${lang() === "bn" ? "পেমেন্ট সম্পন্ন হয়নি। ক্যাশ অন ডেলিভারিতে দিতে পারবেন বা আমাদের কল করুন।" : "Payment wasn't completed. You can pay cash on delivery or call us."}</p>` : ""}

    <div class="card pad order-head">
      <div><span class="muted small">${t("orderNumber")}</span><b class="order-no">${o.order_no}</b></div>
      ${o.invoice_no ? html`<div><span class="muted small">${t("invoice")}</span><b>${o.invoice_no}</b></div>` : ""}
      <div><span class="muted small">${t("total")}</span><b>${money(o.total)}</b></div>
      <div><span class="muted small">${t("payment")}</span><b>${o.payment_method === "COD" ? t("cod") : o.payment_method}</b> <span class="pill ${o.payment_status}">${t(`pay_${o.payment_status}`)}</span></div>
      ${invoiceUrl ? html`<a class="btn sm" href="${invoiceUrl}" target="_blank" rel="noopener">${icon("check")} ${t("downloadInvoice")}</a><span class="small muted">${icon("shield")} ${t("invoiceIsWarranty")}</span>` : ""}
    </div>

    ${d.mfs && o.payment_status === "pending" && o.payment_ref ? html`<p class="note-card small">${lang() === "bn" ? `আপনার TrxID (${o.payment_ref}) যাচাই করে পেমেন্ট কনফার্ম করা হবে।` : `We'll verify your TrxID (${o.payment_ref}) and confirm the payment.`}</p>` : ""}

    <section class="card pad">
      ${finalBad ? html`<p class="pill big ${o.status}">${t(`status_${o.status}`)}</p>` : html`<ol class="timeline">
        ${STATUS_STEPS.map((s, i) => html`<li class="${i < stepIndex ? "done" : i === stepIndex ? "current" : ""}"><span class="dot">${i <= stepIndex ? icon("check") : num(i + 1)}</span><b>${t(`status_${s}`)}</b>${d.history.find((h) => h.status === s) ? html`<small class="muted">${date(d.history.find((h) => h.status === s).created_at)}</small>` : ""}</li>`)}
      </ol>`}
      ${o.courier_status ? html`<p class="note-card">${icon("truck")} ${lang() === "bn" ? o.courier_status.bn : o.courier_status.en}</p>` : ""}
      ${o.tracking_id ? html`<p>${t("courier")}: <b>${o.courier_partner}</b> · ${t("trackingId")}: <b>${o.tracking_id}</b> ${o.tracking_url ? html`<a class="btn sm" href="${o.tracking_url}" target="_blank" rel="noopener">${t("trackWithCourier")}</a>` : ""}</p>` : ""}
    </section>

    <section class="card pad">
      <h2>${t("orderSummary")}</h2>
      ${d.items.map((i) => html`<div class="line"><img src="${i.image}" alt="" width="56" height="56"><div><b>${L(i, "name")}</b><div class="meta">${i.sku} · ${[i.size !== "Standard" ? i.size : "", i.color].filter(Boolean).join(" · ")} × ${num(i.quantity)}</div></div><b>${money(i.line_total)}</b></div>`)}
      <div class="totals">
        <div><span>${t("subtotal")}</span><b>${money(o.subtotal)}</b></div>
        ${o.discount ? html`<div class="green"><span>${t("discount")} ${o.coupon_code ? `(${o.coupon_code})` : ""}</span><b>−${money(o.discount)}</b></div>` : ""}
        <div><span>${t("delivery")}</span><b>${o.delivery_fee ? money(o.delivery_fee) : t("free")}</b></div>
        ${o.gift_wrap ? html`<div><span>${t("giftWrap")}</span><b>${o.gift_wrap_fee ? money(o.gift_wrap_fee) : t("free")}</b></div>` : ""}
        ${o.vat_amount ? html`<div class="muted small"><span>${cfg.tax.inclusive ? t("vatIncluded", { rate: cfg.tax.rate }) : t("vat")}</span><span>${money(o.vat_amount)}</span></div>` : ""}
        <div class="grand"><span>${t("total")}</span><b>${money(o.total)}</b></div>
      </div>
      <p class="small muted">${icon("pin")} ${o.address}</p>
      ${o.gift_message ? html`<p class="small">${icon("gift")} “${o.gift_message}”</p>` : ""}
    </section>

    ${o.status === "delivered" && token ? html`<section class="card pad" id="review">
      <h2>${t("writeReview")}</h2>
      <form id="review-form" class="stack">
        <label class="field"><span>${lang() === "bn" ? "কোন পণ্য" : "Which item"}</span><select class="input" name="productId">${d.items.map((i) => html`<option value="${i.product_id}">${L(i, "name")}</option>`)}</select></label>
        <fieldset class="rate"><legend>${t("rateProduct")}</legend>${[5, 4, 3, 2, 1].map((n) => html`<input type="radio" id="r${n}" name="rating" value="${n}" ${n === 5 ? raw("checked") : ""}><label for="r${n}" aria-label="${n}">${icon("star")}</label>`)}</fieldset>
        <label class="field"><span>${t("yourName")}</span><input class="input" name="name" required value="${o.customer_name}"></label>
        <label class="field"><span>${t("yourReview")}</span><textarea class="input" name="body" rows="3" required minlength="5"></textarea></label>
        <button class="btn primary" type="submit">${t("send")}</button>
      </form></section>` : ""}

    ${o.can_return && !d.returns.length ? html`<section class="card pad"><h2>${t("requestReturn")}</h2>
      <p class="small muted">${lang() === "bn" ? "রিটার্নের অনুরোধ করতে সাইন ইন করুন (একই মোবাইল নম্বর দিয়ে)।" : "Sign in (with the same mobile number) to request a return."}</p>
      <a class="btn" href="/account/returns?order=${o.order_no}">${icon("return")} ${t("requestReturn")}</a></section>` : ""}
    ${o.status === "delivered" ? html`<section class="card pad"><h2>${icon("wrench")} ${t("warranty")}</h2><p class="small muted">${t("claimWhatsCovered")}</p><a class="btn" href="/account/warranty">${t("claimNew")}</a></section>` : ""}
    ${d.returns.length ? html`<section class="card pad"><h2>${t("returns")}</h2>${d.returns.map((r) => html`<p>${t(`reason_${r.reason}`)} — <span class="pill">${r.status}</span>${r.refund_amount ? html` · ${money(r.refund_amount)}` : ""}</p>`)}</section>` : ""}

    ${fresh && cfg.push.publicKey && "PushManager" in window ? html`<p class="center"><button class="btn ghost" type="button" id="push">${icon("bell")} ${t("enableUpdates")}</button></p>` : ""}
    <p class="center"><a class="btn" href="/shop">${t("continueShopping")}</a> <a class="btn ghost" href="/wa?lang=${lang()}">${icon("whatsapp")} ${t("chatWhatsApp")}</a></p>
  </div>`);

  $("#review-form", el)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      const r = await api("/reviews", { method: "POST", body: { productId: Number(f.productId.value), rating: Number(f.rating.value), name: f.name.value, body: f.body.value, orderNo: o.order_no, token } });
      toast(r[lang()] ?? t("reviewThanks"));
      f.closest("section").innerHTML = String(html`<p class="note-card ok">${icon("check")} ${t("reviewThanks")}</p>`);
    } catch (err) { toast(errMsg(err), "error"); }
  });
  if (location.hash === "#review") $("#review", el)?.scrollIntoView();

  $("#push", el)?.addEventListener("click", async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const key = cfg.push.publicKey.replace(/-/g, "+").replace(/_/g, "/");
      const raw64 = atob(key + "===".slice((key.length + 3) % 4));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw64, (ch) => ch.charCodeAt(0)) });
      const who = await me();
      await api("/push/subscribe", { method: "POST", body: { ...sub.toJSON(), phone: who?.phone } });
      toast("✓");
      $("#push", el).remove();
    } catch (err) { toast(errMsg(err), "error"); }
  });
}

function trackForm(el, navigate, error = "") {
  el.innerHTML = String(html`<div class="container section narrow">
    <h1>${t("trackOrder")}</h1><p class="muted">${t("trackSub")}</p>
    ${error ? html`<p class="error-box">${error}</p>` : ""}
    <form class="card pad stack" id="track">
      <label class="field"><span>${t("orderNumber")}</span><input class="input" name="order" required placeholder="ZSB-260926-XXXX" autocapitalize="characters"></label>
      <label class="field"><span>${t("mobile")}</span><input class="input" name="phone" required inputmode="tel" placeholder="01XXXXXXXXX"></label>
      <button class="btn primary" type="submit">${t("find")}</button>
    </form></div>`);
  $("#track", el).addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    navigate(`/order/${encodeURIComponent(f.order.value.trim().toUpperCase())}?phone=${encodeURIComponent(f.phone.value.trim())}`);
  });
}
