// Orders: status tabs (incl. "Needs a call"), filters, CSV export, bulk actions with a plain confirmation,
// and a detail panel with risk badge + reasons, courier history, confirmation/dispatch gates, one-tap
// call / WhatsApp templates, call logging, courier booking, invoice PDF, refunds and history.
import { t, num, money, dt, lang, tt } from "../i18n.js";
import { html, raw, icon, api, $, $$, can, toast, msg, errMsg, listTable, slideOver, pill, confirmDialog, debounce, showErrors, exportCsv, riskBadge, session } from "../core.js";

const STATUSES = ["pending", "confirmation_attempted", "confirmed", "packed", "shipped", "delivered", "cancelled", "refused", "returned"];
const FLOW = ["pending", "confirmed", "packed", "shipped", "delivered"];
const OFF_RAMPS = ["cancelled", "refused", "returned"];
const WA_LABELS = {
  confirm: { en: "Ask to confirm", bn: "কনফার্ম করতে বলুন" },
  confirmed: { en: "Order confirmed", bn: "অর্ডার কনফার্মড" },
  shipped: { en: "Shipped + tracking", bn: "পাঠানো + ট্র্যাকিং" },
  out_for_delivery: { en: "Out for delivery", bn: "ডেলিভারির পথে" },
};

/** "Pack from: lot INV-2407 ×2" — which stock lots this line was allocated from (oldest / first-expiring first). */
function batchLine(json) {
  let list = [];
  try { list = typeof json === "string" ? JSON.parse(json) : json ?? []; } catch { /* old orders have none */ }
  if (!list?.length) return "";
  return html`<br><span class="small muted">${lang() === "bn" ? "যে লট থেকে প্যাক করবেন" : "Pack from lot"}: ${list.map((a) => `${a.batch_no}${a.expiry && a.expiry < "2099" ? ` (${lang() === "bn" ? "মেয়াদ" : "exp"} ${dt(a.expiry)})` : ""} ×${num(a.qty)}`).join(", ")}</span>`;
}

export default async function orders(view, { id, query, refreshBell }) {
  const state = {
    status: query.get("status") ?? "", q: query.get("q") ?? "", payment_method: query.get("payment_method") ?? "", risk: query.get("risk") ?? "",
    flagged: "", from: "", to: "", page: 1, trash: "",
  };
  const selected = new Set();
  const L = (en, bn) => (lang() === "bn" ? bn : en);

  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("orders")}</h1>
      <button class="btn" id="csv">${icon("download")} ${t("exportCsv")}</button></div>
    <div class="chips" id="tabs" style="margin-bottom:18px"></div>
    <div class="card">
      <div class="toolbar">
        <label class="sr-only" for="oq">${t("searchPlaceholder")}</label><input class="input" id="oq" type="search" value="${state.q}" placeholder="${L("Invoice/order no, name, phone, TrxID, SKU…", "ইনভয়েস/অর্ডার নং, নাম, ফোন, TrxID, SKU…")}">
        <select class="input" id="opm" aria-label="${t("payment")}"><option value="">${t("payment")}: ${t("all")}</option>${["COD", "bKash", "Nagad", "Rocket", "Card"].map((m) => html`<option ${state.payment_method === m ? raw("selected") : ""}>${m}</option>`)}</select>
        <select class="input" id="orisk" aria-label="${t("risk")}"><option value="">${t("risk")}: ${t("all")}</option>
          <option value="low" ${state.risk === "low" ? raw("selected") : ""}>🟢 ${L("Trusted", "বিশ্বস্ত")}</option><option value="medium" ${state.risk === "medium" ? raw("selected") : ""}>🟡 ${L("New", "নতুন")}</option><option value="high" ${state.risk === "high" ? raw("selected") : ""}>🔴 ${L("Verify", "যাচাই")}</option></select>
        <input class="input" type="date" id="ofrom" aria-label="${L("From date", "শুরুর তারিখ")}" style="flex:0 1 160px">
        <input class="input" type="date" id="oto" aria-label="${L("To date", "শেষ তারিখ")}" style="flex:0 1 160px">
        <button class="chip" id="oflag" aria-pressed="false">⚠︎ ${t("flags")}</button>
        ${can("orders.delete") ? html`<button class="chip" id="otrash" aria-pressed="false">${icon("trash")} ${t("trash")}</button>` : ""}
      </div>
      <div id="list"></div>
      <div id="bulk" class="bulkbar" hidden><b id="bulk-n"></b>
        ${can("orders.update") ? html`<button class="btn sm" data-bulk="confirmed">${t("bulkConfirm")}</button><button class="btn sm" data-bulk="packed">${t("bulkPack")}</button><button class="btn sm" data-bulk="shipped">${t("bulkShip")}</button>` : ""}
        <button class="btn sm ghost" id="bulk-clear" style="color:#fff">${t("cancel")}</button></div>
    </div>`);

  const table = listTable($("#list", view), {
    columns: [
      { label: { en: "", bn: "" }, render: (o) => raw(`<input type="checkbox" data-sel="${o.id}" aria-label="select ${o.order_no}" ${selected.has(o.id) ? "checked" : ""} style="width:22px;height:22px">`) },
      { label: { en: "Order", bn: "অর্ডার" }, render: (o) => html`<b>${o.invoice_no ?? o.order_no}</b>${o.gift_wrap ? html` <span title="${L("Gift box", "গিফট বক্স")}">🎁</span>` : ""}<br><span class="muted small">${o.invoice_no ? `${o.order_no} · ` : ""}${dt(o.created_at, true)}</span>` },
      { label: { en: "Customer", bn: "গ্রাহক" }, render: (o) => html`${o.customer_name}<br><a href="tel:${o.customer_phone}" class="small">${o.customer_phone}</a>${o.otp_verified ? html` <span title="${t("verifiedNumber")}">✓</span>` : ""}` },
      { label: { en: "Risk", bn: "ঝুঁকি" }, render: (o) => html`${riskBadge(o.risk_level, o.risk_badge)}${o.flags.length ? html`<br><span class="flag">⚠︎ ${num(o.flags.length)}</span>` : ""}` },
      { label: { en: "Area", bn: "এলাকা" }, render: (o) => html`${o.upazila}, ${o.district}` },
      { label: { en: "Total", bn: "মোট" }, render: (o) => html`<b>${money(o.total)}</b><br><span class="muted small">${num(o.item_count)} ${t("items")} · ${o.payment_method} ${o.payment_status === "paid" ? "✓" : ""}</span>` },
      { label: { en: "Status", bn: "অবস্থা" }, render: (o) => html`${pill(o.status, t(`s_${o.status}`))}${o.attempts ? html`<br><span class="muted small">📞 ${num(o.attempts)}</span>` : ""}${o.tracking_id ? html`<br><span class="muted small">${o.courier_partner} · ${o.tracking_id}</span>` : ""}` },
    ],
    rowAttrs: (o) => `class="clickable" data-open="${o.id}"`,
    actions: (o) => (state.trash
      ? html`<button class="btn sm" data-restore="${o.id}">${icon("restore")} ${t("restore")}</button>`
      : html`<span class="one-tap"><a class="btn sm call" href="tel:${o.customer_phone}" aria-label="${t("call")}">${icon("phone")}</a><button class="btn sm" data-open="${o.id}">${t("edit")}</button></span>`),
  });

  const qs = (extra = {}) => new URLSearchParams(Object.entries({ ...state, ...extra }).filter(([, v]) => v !== "" && v != null));
  async function load() {
    table.loading();
    try {
      const res = await api(`/orders?${qs({ limit: "20" })}`);
      table.render(res, { onPage: (p) => { state.page = p; load(); } });
      const counts = res.statusCounts ?? {};
      const all = Object.values(counts).reduce((a, b) => a + b, 0);
      $("#tabs", view).innerHTML = String(html`
        <button class="chip" data-status="needs_call" aria-pressed="${state.status === "needs_call"}" style="font-weight:700">📞 ${L("Needs a call", "কল করতে হবে")}</button>
        <button class="chip" data-status="" aria-pressed="${!state.status}">${t("all")} <span class="n">${num(all)}</span></button>
        ${STATUSES.map((s) => html`<button class="chip" data-status="${s}" aria-pressed="${state.status === s}">${t(`s_${s}`)} <span class="n">${num(counts[s] ?? 0)}</span></button>`)}`);
    } catch (e) { table.error(e, load); }
  }
  const updateBulk = () => { $("#bulk", view).hidden = selected.size === 0; $("#bulk-n", view).textContent = t("bulkSelected", { n: num(selected.size) }); };

  view.addEventListener("click", async (e) => {
    const sel = e.target.closest("[data-sel]");
    if (sel) { e.stopPropagation(); sel.checked ? selected.add(Number(sel.dataset.sel)) : selected.delete(Number(sel.dataset.sel)); return updateBulk(); }
    const tab = e.target.closest("[data-status]");
    if (tab) { state.status = tab.dataset.status; state.page = 1; return load(); }
    const bulk = e.target.closest("[data-bulk]");
    if (bulk) return bulkMove(bulk.dataset.bulk);
    const rs = e.target.closest("[data-restore]");
    if (rs) { e.stopPropagation(); try { toast(msg(await api(`/orders/${rs.dataset.restore}/restore`, { method: "POST" }))); } catch (err) { toast(errMsg(err), "err"); } return load(); }
    if (e.target.closest("a")) return;
    const open = e.target.closest("[data-open]");
    if (open) location.hash = `#/orders/${open.dataset.open}`;
  });

  async function bulkMove(status) {
    const n = selected.size;
    // Plain-language confirmation: "You're about to mark 5 orders as Shipped — continue?"
    if (!(await confirmDialog(t("bulkConfirmMsg", { n: num(n), s: t(`s_${status}`) }), { danger: false, okText: t("yes") }))) return;
    let courier;
    if (status === "shipped") {
      courier = prompt(L("Courier for all selected (Steadfast, Pathao or RedX):", "সব নির্বাচিতের কুরিয়ার (Steadfast, Pathao বা RedX):"), "Steadfast");
      if (!courier) return;
      courier = ["Steadfast", "Pathao", "RedX"].find((c) => c.toLowerCase() === courier.trim().toLowerCase());
      if (!courier) return toast(L("Type Steadfast, Pathao or RedX.", "Steadfast, Pathao বা RedX লিখুন।"), "err");
    }
    try {
      const r = await api("/orders/bulk-status", { method: "POST", body: { ids: [...selected], status, courier } });
      toast(msg(r));
      for (const f of r.failed) toast(`${f.order_no ?? `#${f.id}`}: ${lang() === "bn" ? f.reason_bn : f.reason}`, "err");
      selected.clear(); updateBulk(); load(); refreshBell?.();
    } catch (err) { toast(errMsg(err), "err"); }
  }

  $("#bulk-clear", view).onclick = () => { selected.clear(); updateBulk(); $$("[data-sel]", view).forEach((c) => (c.checked = false)); };
  $("#csv", view).onclick = async () => { try { await exportCsv(`/orders?${qs()}`, "orders"); } catch (e) { toast(errMsg(e), "err"); } };
  $("#oq", view).addEventListener("input", debounce((e) => { state.q = e.target.value.trim(); state.page = 1; load(); }));
  $("#opm", view).onchange = (e) => { state.payment_method = e.target.value; state.page = 1; load(); };
  $("#orisk", view).onchange = (e) => { state.risk = e.target.value; state.page = 1; load(); };
  $("#ofrom", view).onchange = (e) => { state.from = e.target.value; load(); };
  $("#oto", view).onchange = (e) => { state.to = e.target.value; load(); };
  $("#oflag", view).onclick = (e) => { state.flagged = state.flagged ? "" : "1"; e.currentTarget.setAttribute("aria-pressed", String(Boolean(state.flagged))); load(); };
  $("#otrash", view)?.addEventListener("click", (e) => { state.trash = state.trash ? "" : "1"; e.currentTarget.setAttribute("aria-pressed", String(Boolean(state.trash))); load(); });

  await load();
  if (id && view.isConnected) openOrder(Number(id), () => { load(); refreshBell?.(); });
}

async function openOrder(id, onChange) {
  let d;
  try { d = await api(`/orders/${id}`); } catch (e) { return toast(errMsg(e), "err"); }
  const o = d.order;
  const L = (en, bn) => (lang() === "bn" ? bn : en);
  const off = OFF_RAMPS.includes(o.status);
  const reached = off ? d.history.filter((h) => FLOW.includes(h.status)).at(-1)?.status ?? "pending" : o.status === "confirmation_attempted" ? "pending" : o.status;
  const reachedIdx = FLOW.indexOf(reached);
  const canUpdate = can("orders.update") && !o.deleted_at;
  const h = d.customerHistory;
  const fc = o.fraud_check;
  const awaitingCall = ["pending", "confirmation_attempted", "confirmed", "packed"].includes(o.status);
  const nextBtn = (s) => {
    const gate = s === "confirmed" ? d.gates.confirm : s === "shipped" ? d.gates.dispatch : { ok: true };
    const danger = OFF_RAMPS.includes(s);
    return html`<button class="btn ${danger ? "" : "primary"}" data-next="${s}" ${gate.ok ? "" : raw(`disabled title="${String(tt(gate.reason)).replace(/"/g, "&quot;")}"`)}>${danger ? "" : "→ "}${t(`s_${s}`)}</button>`;
  };

  const { panel, close } = slideOver({
    wide: true,
    autofocus: false,
    title: `${t("orderDetail")} ${o.invoice_no ?? o.order_no}`,
    body: html`
      <div class="pipeline">${FLOW.map((s, i) => html`<span class="${i <= reachedIdx ? "done" : ""}">${t(`s_${s}`)}</span>`)}${off ? html`<span class="bad">${t(`s_${o.status}`)}</span>` : ""}</div>

      ${awaitingCall && !d.gates.confirm.ok ? html`<div class="gate no">⚠︎ ${t("confirmGateNo")}: ${tt(d.gates.confirm.reason)}</div>` : ""}
      ${["confirmed", "packed"].includes(o.status) && !d.gates.dispatch.ok ? html`<div class="gate no">📞 ${t("dispatchGateNo")}: ${tt(d.gates.dispatch.reason)}</div>` : ""}
      ${["confirmed", "packed"].includes(o.status) && d.gates.dispatch.ok ? html`<div class="gate ok">✓ ${L("Ready to ship", "পাঠানোর জন্য প্রস্তুত")} (${d.gates.dispatch.method})</div>` : ""}

      ${canUpdate && d.nextStatuses.length ? html`<div class="chips" style="margin:12px 0 18px">${d.nextStatuses.map(nextBtn)}</div>` : ""}

      <div class="card" style="margin-top:0"><div class="card-title"><h3 style="margin:0">${t("customer")} · ${o.customer_name}</h3>${riskBadge(o.risk_level, o.risk_badge, o.risk_reasons?.[0])}</div>
        <p class="small" style="margin:6px 0">${o.otp_verified ? html`✓ <b>${t("verifiedNumber")}</b>` : html`✗ ${t("notVerified")}`}
          ${o.risk_reasons?.length ? html` · ${t("riskReason")}: ${o.risk_reasons.map((r) => tt(r)).join(" ")}` : ""}</p>
        ${o.flags.length ? html`<p>${o.flags.map((f) => html`<span class="flag">⚠︎ ${tt(f)}</span>`)}</p>` : ""}
        <div class="grid2" style="gap:12px">
          <div><b class="small">${L("With us", "আমাদের সাথে")}</b><br>${L(`${h.totalOrders} orders · ${h.delivered} delivered · ${h.refusedOrReturned} refused/returned · ${h.cancelled} cancelled`, `${num(h.totalOrders)}টি অর্ডার · ${num(h.delivered)}টি ডেলিভারি · ${num(h.refusedOrReturned)}টি নেননি/ফেরত · ${num(h.cancelled)}টি বাতিল`)}${h.blocked ? html` · <b style="color:var(--bad)">${L("Blocked", "ব্লকড")}</b>` : ""}</div>
          <div><b class="small">${t("courierHistory")}</b><br>${fc ? L(`${fc.delivered}/${fc.total} parcels accepted across couriers`, `সব কুরিয়ারে ${num(fc.total)}টির মধ্যে ${num(fc.delivered)}টি নিয়েছেন`) : L("Not checked", "দেখা হয়নি")}
            ${canUpdate ? html` <button class="btn sm ghost" id="recheck">${t("recheck")}</button>` : ""}</div>
        </div>
        <dl class="kv" style="margin-top:12px"><dt>${t("phone")}</dt><dd><a href="tel:${o.customer_phone}">${o.customer_phone}</a></dd>${o.customer_email ? html`<dt>Email</dt><dd>${o.customer_email}</dd>` : ""}
          <dt>${t("deliverTo")}</dt><dd>${o.area}, ${o.upazila}, ${o.district}, ${o.division}</dd><dt>Zone</dt><dd>${o.zone_code}</dd>
          ${o.utm_source || o.utm_campaign ? html`<dt>${L("Came from", "যেখান থেকে এসেছেন")}</dt><dd>${[o.utm_source, o.utm_medium, o.utm_campaign].filter(Boolean).join(" / ")}${o.ad_ref ? ` · ${o.ad_ref}` : ""}</dd>` : ""}
          ${o.gift_wrap ? html`<dt>🎁</dt><dd><b>${L("Pack this order in a gift box — ribbon and a handwritten card", "এই অর্ডারটি গিফট বক্সে প্যাক করুন — রিবন ও হাতে লেখা কার্ড")}</b></dd>` : ""}
          ${o.gift_message ? html`<dt>✉️</dt><dd>${o.gift_message}</dd>` : ""}</dl>
        ${o.customer_note ? html`<p class="small" style="margin-top:10px"><b>${L("Customer note", "গ্রাহকের নোট")}:</b> ${o.customer_note}</p>` : ""}

        <h3 style="margin:16px 0 8px">${t("logCall")}</h3>
        <div class="one-tap">
          <a class="btn call" href="${d.contact.tel}">${icon("phone")} ${t("call")} ${o.customer_phone}</a>
          ${Object.entries(d.contact.whatsapp).map(([k, w]) => html`<a class="btn wa sm" target="_blank" rel="noopener" href="${w.url}" title="${w.text}">${icon("whatsapp")} ${tt(WA_LABELS[k] ?? { en: k, bn: k })}</a>`)}
        </div>
        ${canUpdate && awaitingCall && !d.attempts.some((a) => a.outcome === "confirmed") ? html`<div class="one-tap" style="margin-top:10px">
          <button class="btn" data-attempt="no_answer">📵 ${t("noAnswer")}</button>
          <button class="btn primary" data-attempt="confirmed">✓ ${t("confirmedCall")}</button>
          <button class="btn danger" data-attempt="declined">✗ ${t("declined")}</button></div>` : ""}
        ${d.attempts.length ? html`<ul class="history" style="margin-top:10px">${d.attempts.map((a) => html`<li><span>${{ no_answer: "📵", confirmed: "✓", declined: "✗" }[a.outcome]} <b>${{ no_answer: t("noAnswer"), confirmed: t("confirmedCall"), declined: t("declined") }[a.outcome]}</b> · ${a.method} · ${dt(a.attempted_at, true)} · <span class="muted">${a.staff_name}</span>${a.note ? html`<br><span class="small">${a.note}</span>` : ""}</span></li>`)}</ul>` : ""}
      </div>

      <div class="grid2">
        <div class="card"><h3>${t("payment")}</h3>
          <dl class="kv"><dt>${L("Method", "পদ্ধতি")}</dt><dd>${o.payment_method}</dd><dt>${t("status")}</dt><dd>${pill(o.payment_status)}</dd>${o.payment_ref ? html`<dt>Ref / TrxID</dt><dd>${o.payment_ref}</dd>` : ""}
          ${o.refund_amount ? html`<dt>Refund</dt><dd>${money(o.refund_amount)} — ${o.refund_note ?? ""}</dd>` : ""}</dl>
          <div class="chips" style="margin-top:12px">
            ${canUpdate && o.payment_status !== "paid" ? html`<button class="btn sm" id="mark-paid">✓ ${t("markPaid")}</button>` : ""}
            ${can("orders.refund") && ["paid", "partially_refunded"].includes(o.payment_status) ? html`<button class="btn sm" id="refund">${t("refund")}</button>` : ""}
          </div></div>
        <div class="card"><h3>${t("courier")}</h3>
          ${o.courier_partner ? html`<dl class="kv"><dt>${t("courier")}</dt><dd>${o.courier_partner}</dd><dt>${t("tracking")}</dt><dd>${o.tracking_url ? html`<a href="${o.tracking_url}" target="_blank" rel="noopener">${o.tracking_id}</a>` : o.tracking_id ?? "—"}</dd>
            ${o.courier_status ? html`<dt>${t("status")}</dt><dd>${o.courier_status_label ? tt(o.courier_status_label) : o.courier_status}</dd>` : ""}</dl>` : html`<p class="muted">${L("Not shipped yet.", "এখনো পাঠানো হয়নি।")}</p>`}
        </div>
      </div>

      <div class="card"><h3>${t("items")}</h3>
        ${d.items.map((i) => html`<div class="item-row">${i.image ? html`<img class="thumb" src="${i.image}" alt="">` : html`<span></span>`}<span><b>${lang() === "bn" ? i.name_bn : i.name_en}</b><br><span class="muted small"><span class="mono">${i.sku}</span> · ${i.size}${i.color ? ` · ${i.color}` : ""} · ${num(i.quantity)} × ${money(i.unit_price)}${i.warranty_months ? ` · 🛡 ${num(i.warranty_months)} ${L("mo warranty", "মাস ওয়ারেন্টি")}` : ""}</span>${batchLine(i.batches)}${i.serials ? html`<br><span class="serial-list">${i.serials.split(", ").map((sn) => html`<span>${sn}</span>`)}</span>` : i.serial_tracked ? html`<br><span class="small exp-soon">${icon("chip")} ${L("Serial numbers not assigned yet", "সিরিয়াল নম্বর এখনো দেওয়া হয়নি")}</span>` : ""}${canUpdate && (i.serial_tracked || i.serials) ? html` <button class="btn sm" type="button" data-serials="${i.id}">${icon("chip")} ${t("assignSerials")}</button>` : ""}</span><b class="mono">${money(i.line_total)}</b></div>`)}
        <dl class="kv" style="margin-top:10px;justify-content:end"><dt>${t("subtotal")}</dt><dd>${money(o.subtotal)}</dd>${o.discount ? html`<dt>${t("discount")} (${o.coupon_code ?? o.referral_code ?? ""})</dt><dd>−${money(o.discount)}</dd>` : ""}<dt>${t("deliveryFee")}</dt><dd>${o.delivery_fee ? money(o.delivery_fee) : L("Free", "ফ্রি")}</dd>${o.gift_wrap ? html`<dt>🎁 ${L("Gift box", "গিফট বক্স")}</dt><dd>${o.gift_wrap_fee ? money(o.gift_wrap_fee) : L("Free", "ফ্রি")}</dd>` : ""}${o.vat_amount ? html`<dt>VAT</dt><dd>${money(o.vat_amount)}</dd>` : ""}<dt><b>${t("total")}</b></dt><dd style="font-size:1.2rem">${money(o.total)}</dd></dl>
      </div>

      ${d.returns.length ? html`<div class="card"><h3>${t("returns")}</h3>${d.returns.map((r) => html`<p>${pill(r.status)} ${r.reason.replace(/_/g, " ")} · ${dt(r.created_at)}${r.details ? html`<br><span class="small">${r.details}</span>` : ""} <a class="btn sm" href="#/returns">${t("viewAll")}</a></p>`)}</div>` : ""}

      <div class="card"><h3>${t("adminNotes")}</h3><form id="notes"><textarea class="input" name="admin_notes" ${canUpdate ? "" : raw("disabled")}>${o.admin_notes ?? ""}</textarea>${canUpdate ? html`<button class="btn sm" style="margin-top:10px">${t("save")}</button>` : ""}</form></div>
      <div class="grid2">
        <div class="card"><h3>${t("history")}</h3><ul class="history">${d.history.map((x) => html`<li><span><b>${t(`s_${x.status}`)}</b> · ${dt(x.created_at, true)} · <span class="muted">${x.actor}</span>${x.note ? html`<br><span class="small">${x.note}</span>` : ""}</span></li>`)}</ul></div>
        <div class="card"><h3>${t("messages")}</h3>${d.notifications.length ? html`<ul class="history">${d.notifications.map((n) => html`<li><span>${n.channel.toUpperCase()} · ${n.template} · ${pill(n.status === "sent" ? "delivered" : n.status === "failed" ? "cancelled" : "draft", n.status)}<br><span class="muted small">${dt(n.created_at, true)}${n.error ? ` — ${n.error}` : ""}</span></span></li>`)}</ul>` : html`<p class="muted">—</p>`}</div>
      </div>`,
    footer: html`${o.invoice_no ? html`<a class="btn" href="/api/admin/orders/${o.id}/invoice.pdf" target="_blank" rel="noopener">${icon("download")} ${t("downloadInvoice")}</a>` : html`<span class="muted small">${L("Invoice number is created when the order is confirmed.", "অর্ডার কনফার্ম হলে ইনভয়েস নম্বর তৈরি হয়।")}</span>`}
      <button class="btn" id="print-lbl">${icon("print")} ${t("printLabel")}</button>
      ${canUpdate ? html`<button class="btn" id="resend">${t("sendAgain")}</button>` : ""}
      ${can("orders.delete") && ["cancelled", "refused", "returned", "delivered"].includes(o.status) && !o.deleted_at ? html`<button class="btn" id="del">${icon("trash")} ${t("delete")}</button>` : ""}`,
  });
  const onClose = () => { if (location.hash.startsWith("#/orders/")) history.replaceState(null, "", "#/orders"); };
  const reopen = () => { close(); onChange(); openOrder(id, onChange); };
  const done = (r) => { toast(msg(r) || t("saved")); close(); onClose(); onChange(); };
  panel.querySelector("[data-close]").addEventListener("click", onClose);

  $$("[data-next]", panel).forEach((b) => b.addEventListener("click", async () => {
    const next = b.dataset.next;
    if (next === "shipped") return shipDialog(o, done);
    const danger = OFF_RAMPS.includes(next);
    const text = next === "refused"
      ? L(`Mark ${o.order_no} as refused at delivery? Stock goes back and this counts against the customer's delivery record.`, `${o.order_no} "ডেলিভারিতে নেননি" করবেন? স্টক ফেরত যাবে এবং এটি গ্রাহকের রেকর্ডে যোগ হবে।`)
      : `${t("moveTo")}: "${t(`s_${next}`)}"?`;
    if (!(await confirmDialog(text, { danger }))) return;
    try { done(await api(`/orders/${o.id}/status`, { method: "POST", body: { status: next, notify: true } })); } catch (err) { toast(errMsg(err), "err"); }
  }));
  $$("[data-attempt]", panel).forEach((b) => b.addEventListener("click", async () => {
    const outcome = b.dataset.attempt;
    if (outcome === "declined" && !(await confirmDialog(L("The customer said no — cancel this order and put the stock back?", "গ্রাহক না বলেছেন — অর্ডারটি বাতিল করে স্টক ফেরত দেবেন?")))) return;
    const note = outcome === "no_answer" ? undefined : prompt(t("note"), "") || undefined;
    try { toast(msg(await api(`/orders/${o.id}/attempts`, { method: "POST", body: { outcome, method: "call", note } }))); reopen(); }
    catch (err) { toast(errMsg(err), "err"); }
  }));
  $("#recheck", panel)?.addEventListener("click", async () => {
    try { toast(msg(await api(`/orders/${o.id}/fraud-check`, { method: "POST" }))); reopen(); } catch (err) { toast(errMsg(err), "err"); }
  });
  $("#mark-paid", panel)?.addEventListener("click", async () => {
    const ref = prompt(t("paymentRef"), o.payment_ref ?? "");
    if (ref === null) return;
    try { toast(msg(await api(`/orders/${o.id}`, { method: "PUT", body: { payment_status: "paid", payment_ref: ref || null } }))); reopen(); } catch (err) { toast(errMsg(err), "err"); }
  });
  $("#refund", panel)?.addEventListener("click", () => refundDialog(o, done));
  $("#notes", panel).addEventListener("submit", async (e) => {
    e.preventDefault();
    try { toast(msg(await api(`/orders/${o.id}`, { method: "PUT", body: { admin_notes: new FormData(e.target).get("admin_notes") } }))); } catch (err) { toast(errMsg(err), "err"); }
  });
  $("#resend", panel)?.addEventListener("click", async () => { try { toast(msg(await api(`/orders/${o.id}/notify`, { method: "POST" }))); } catch (err) { toast(errMsg(err), "err"); } });
  $("#del", panel)?.addEventListener("click", async () => {
    if (!(await confirmDialog(t("confirmDelete", { name: o.order_no })))) return;
    try { done(await api(`/orders/${o.id}`, { method: "DELETE" })); } catch (err) { toast(errMsg(err), "err"); }
  });
  $("#print-lbl", panel).addEventListener("click", () => printLabel(d));
  panel.querySelectorAll("[data-serials]").forEach((b) => b.addEventListener("click", () => serialDialog(Number(b.dataset.serials), reopen)));
}

/** Pick the serial numbers packed for one order line (one per unit). Ticked boxes or typed serials are both accepted. */
async function serialDialog(itemId, after) {
  const L = (en, bn) => (lang() === "bn" ? bn : en);
  let r;
  try { r = await api(`/order-items/${itemId}/serials`); } catch (e) { return toast(errMsg(e), "err"); }
  const chosen = new Set(r.assigned.map((x) => x.serial));
  const options = [...r.assigned.map((x) => x.serial), ...r.available.map((x) => x.serial).filter((sn) => !chosen.has(sn))];
  const { panel, close } = slideOver({
    title: `${t("assignSerials")} · ${r.item.sku}`,
    body: html`<form id="snf" novalidate><p class="muted small">${L(`Pick ${r.item.quantity} serial number(s) — one per unit in the box. They print on the invoice and are checked when a warranty claim comes in.`, `${r.item.quantity}টি সিরিয়াল বেছে নিন — বক্সের প্রতিটি ইউনিটের জন্য একটি। এগুলো ইনভয়েসে ছাপা হবে এবং ওয়ারেন্টি ক্লেইমে মিলিয়ে দেখা হবে।`)}</p>
      ${options.length ? html`<div class="tag-chips" style="margin-bottom:12px">${options.map((sn) => html`<label class="check mono"><input type="checkbox" name="sn" value="${sn}" ${chosen.has(sn) ? raw("checked") : ""}> ${sn}</label>`)}</div>` : html`<p class="muted">${L("No serials on the shelf for this option. Log them under Inventory → Serial numbers, or type them below.", "এই অপশনের কোনো সিরিয়াল স্টকে নেই। ইনভেন্টরি → সিরিয়াল নম্বরে যোগ করুন, অথবা নিচে লিখুন।")}</p>`}
      <label class="field"><span>${L("Or type / scan serials", "অথবা সিরিয়াল লিখুন / স্ক্যান করুন")}</span><textarea class="input mono" name="typed" rows="3" placeholder="SN8F2K1001"></textarea></label></form>`,
    footer: html`<button class="btn" data-close>${t("cancel")}</button><button class="btn primary" type="submit" form="snf">${t("save")}</button>`,
  });
  const form = $("#snf", panel);
  form.addEventListener("change", () => {
    const boxes = $$('input[name="sn"]', form);
    const n = boxes.filter((x) => x.checked).length;
    boxes.forEach((x) => (x.disabled = !x.checked && n >= r.item.quantity));
  });
  form.dispatchEvent(new Event("change"));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const serials = [...new Set([...fd.getAll("sn"), ...String(fd.get("typed") ?? "").split(/[\s,;]+/)].map((x) => String(x).trim().toUpperCase()).filter(Boolean))];
    try { toast(msg(await api(`/order-items/${itemId}/serials`, { method: "PUT", body: { serials } }))); close(); after?.(); }
    catch (err) { showErrors(form, err); toast(errMsg(err), "err"); }
  });
}

function shipDialog(o, done) {
  const L = (en, bn) => (lang() === "bn" ? bn : en);
  const { panel, close } = slideOver({
    title: `${t("shipDialog")} — ${o.order_no}`,
    body: html`<form id="ship" novalidate>
      <label class="field"><span>${t("chooseCourier")} *</span><select class="input" name="courier"><option>Steadfast</option><option>Pathao</option><option>RedX</option></select></label>
      <label class="check"><input type="checkbox" name="createConsignment" checked> ${L("Book with the courier automatically (if connected)", "কুরিয়ারে অটোমেটিক বুক করুন (যুক্ত থাকলে)")}</label>
      <label class="field"><span>${t("orEnterTracking")}</span><input class="input" name="trackingId" autocomplete="off"></label>
      <label class="field"><span>${t("note")}</span><input class="input" name="note"></label>
      <label class="check"><input type="checkbox" name="notify" checked> ${t("notifyCustomer")}</label></form>`,
    footer: html`<button class="btn" data-close>${t("cancel")}</button><button class="btn primary" type="submit" form="ship">${icon("truck")} ${t("s_shipped")}</button>`,
  });
  const form = $("#ship", panel);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const trackingId = String(fd.get("trackingId") || "").trim();
    try {
      const r = await api(`/orders/${o.id}/status`, { method: "POST", body: { status: "shipped", courier: fd.get("courier"), trackingId: trackingId || undefined, createConsignment: Boolean(fd.get("createConsignment")) && !trackingId, note: fd.get("note") || undefined, notify: Boolean(fd.get("notify")) } });
      close();
      done(r);
    } catch (err) { showErrors(form, err); toast(errMsg(err), "err"); }
  });
}

function refundDialog(o, done) {
  const { panel, close } = slideOver({
    title: `${t("refund")} — ${o.order_no}`,
    body: html`<form id="rf" novalidate><label class="field"><span>${t("refundAmount")} *</span><input class="input" type="number" name="amount" min="1" max="${o.total - o.refund_amount}" value="${o.total - o.refund_amount}"></label>
      <label class="field"><span>${t("refundReason")} *</span><textarea class="input" name="note" required></textarea></label></form>`,
    footer: html`<button class="btn" data-close>${t("cancel")}</button><button class="btn danger" type="submit" form="rf">${t("refund")}</button>`,
  });
  $("#rf", panel).addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try { const r = await api(`/orders/${o.id}/refund`, { method: "POST", body: { amount: Number(fd.get("amount")), note: fd.get("note") } }); close(); done(r); }
    catch (err) { showErrors(e.target, err); toast(errMsg(err), "err"); }
  });
}

function printLabel(d) {
  const o = d.order;
  const cod = o.payment_status === "paid" ? 0 : o.total;
  const area = document.getElementById("print-area");
  area.innerHTML = String(html`<div class="ship-label"><div style="display:flex;justify-content:space-between"><b>${session.brand?.name.en ?? ""}</b><span>${o.courier_partner ?? ""} ${o.tracking_id ?? ""}</span></div>
    <hr><div class="big">${o.customer_name}</div><div class="big">${o.customer_phone}</div><div style="margin:6px 0">${o.area}<br>${o.upazila}, ${o.district}</div>
    <hr><div style="display:flex;justify-content:space-between"><span>${o.invoice_no ?? o.order_no}</span><span class="big">COD ৳${cod}</span></div>
    <div style="font-size:11px;margin-top:6px">${d.items.map((i) => `${i.sku} ×${i.quantity}`).join(" · ")}</div>
    <div style="font-size:11px;margin-top:6px">From: ${session.brand?.name.en ?? ""} · ${d.contact.storePhone ?? ""}</div></div>`);
  area.hidden = false;
  window.print();
  setTimeout(() => (area.innerHTML = ""), 500);
}
