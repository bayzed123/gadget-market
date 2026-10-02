// Returns & refunds: customer self-service requests move requested → approved → item received (order becomes
// Returned; units go back on sale only after they are checked) → refund sent. Rejections keep a note for the customer.
import { t, num, money, dt, lang } from "../i18n.js";
import { html, icon, api, $, can, toast, msg, errMsg, listTable, pill, exportCsv, slideOver, showErrors } from "../core.js";

const REASONS = {
  damaged: { en: "Arrived damaged", bn: "ক্ষতিগ্রস্ত অবস্থায় এসেছে" }, wrong_item: { en: "Wrong item", bn: "ভুল পণ্য" }, not_working: { en: "Doesn't work", bn: "কাজ করছে না" },
  not_as_described: { en: "Not as described", bn: "বর্ণনার সাথে মেলে না" }, changed_mind: { en: "Changed mind", bn: "মত বদলেছেন" }, other: { en: "Other", bn: "অন্যান্য" },
};

export default async function returns(view, { refreshBell }) {
  const L = (en, bn) => (lang() === "bn" ? bn : en);
  const state = { status: "", page: 1 };
  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("returns")}</h1><button class="btn" id="csv">${icon("download")} ${t("exportCsv")}</button></div>
    <div class="chips" id="tabs" style="margin-bottom:18px">${[["", t("all")], ["requested", L("New", "নতুন")], ["approved", t("approve")], ["received", t("received")], ["refunded", t("refunded")], ["rejected", t("reject")]].map(([v, l]) => html`<button class="chip" data-tab="${v}" aria-pressed="${state.status === v}">${l}</button>`)}</div>
    <div class="card"><div id="list"></div></div>`);
  const canAct = can("returns.update");
  const table = listTable($("#list", view), {
    columns: [
      { label: { en: "Order", bn: "অর্ডার" }, render: (r) => html`<a href="#/orders/${r.order_id}"><b>${r.order_no}</b></a><br><span class="muted small">${dt(r.created_at, true)}</span>` },
      { label: { en: "Customer", bn: "গ্রাহক" }, render: (r) => html`${r.customer_name}<br><a class="small" href="tel:${r.customer_phone}">${r.customer_phone}</a>` },
      { label: { en: "Reason", bn: "কারণ" }, render: (r) => html`<b>${(REASONS[r.reason] ?? REASONS.other)[lang()]}</b>${r.details ? html`<br><span class="small">${r.details}</span>` : ""}` },
      { label: { en: "Order total", bn: "অর্ডারের মোট" }, render: (r) => html`${money(r.total)}<br><span class="muted small">${r.payment_method}</span>` },
      { label: { en: "Status", bn: "অবস্থা" }, render: (r) => html`${pill(r.status === "requested" ? "pending" : r.status === "refunded" ? "delivered" : r.status === "rejected" ? "cancelled" : "confirmed", r.status)}${r.refund_amount ? html`<br><span class="muted small">${money(r.refund_amount)} ${r.refund_method ?? ""}</span>` : ""}${r.admin_note ? html`<br><span class="muted small">${r.admin_note}</span>` : ""}` },
    ],
    actions: (r) => (!canAct ? "" : {
      requested: html`<button class="btn sm primary" data-id="${r.id}" data-to="approved">${t("approve")}</button> <button class="btn sm" data-id="${r.id}" data-to="rejected">${t("reject")}</button>`,
      approved: html`<button class="btn sm primary" data-id="${r.id}" data-to="received">${t("received")}</button> <button class="btn sm" data-id="${r.id}" data-to="rejected">${t("reject")}</button>`,
      received: html`<button class="btn sm primary" data-id="${r.id}" data-to="refunded" data-total="${r.total}">${t("refunded")}</button>`,
    }[r.status] ?? ""),
  });
  let rows = [];
  async function load() {
    table.loading();
    try { const res = await api(`/returns?${new URLSearchParams(Object.entries({ ...state, limit: "20" }).filter(([, v]) => v !== ""))}`); rows = res.items; table.render(res, { onPage: (p) => { state.page = p; load(); } }); }
    catch (e) { table.error(e, load); }
  }
  const help = {
    approved: L("The customer is told to send the item back.", "গ্রাহককে পণ্য ফেরত পাঠাতে বলা হবে।"),
    rejected: L("Write why, so the customer understands.", "কারণ লিখুন, যাতে গ্রাহক বুঝতে পারেন।"),
    received: L("The order becomes Returned. Check the unit (box, accessories, serial) before adding it back to stock in Inventory; a faulty unit is written off or sent for repair.", "অর্ডারটি 'ফেরত' হবে। ইনভেন্টরিতে স্টকে ফেরত দেওয়ার আগে ইউনিটটি (বক্স, এক্সেসরিজ, সিরিয়াল) যাচাই করুন; ত্রুটিপূর্ণ হলে বাদ দিন বা মেরামতে পাঠান।"),
    refunded: L("Record the money you sent back (bKash/Nagad/cash).", "যে টাকা ফেরত দিয়েছেন তা লিখুন (বিকাশ/নগদ/ক্যাশ)।"),
  };
  view.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { state.status = tab.dataset.tab; state.page = 1; view.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b === tab))); return load(); }
    const b = e.target.closest("[data-to]");
    if (!b) return;
    const r = rows.find((x) => x.id === Number(b.dataset.id));
    const to = b.dataset.to;
    const { panel, close } = slideOver({
      title: `${r.order_no} → ${b.textContent.trim()}`,
      body: html`<form id="rf" novalidate><p>${help[to]}</p>
        ${to === "refunded" ? html`<label class="field"><span>${t("refundAmount")} *</span><input class="input" type="number" name="refund_amount" min="1" value="${r.total}" required></label>
          <label class="field"><span>${L("Sent via", "যেভাবে পাঠানো হয়েছে")}</span><select class="input" name="refund_method"><option>bKash</option><option>Nagad</option><option>Rocket</option><option>Cash</option><option>Bank</option></select></label>` : ""}
        <label class="field"><span>${to === "rejected" ? `${t("reason")} *` : t("note")}</span><textarea class="input" name="admin_note" ${to === "rejected" ? "required" : ""}></textarea></label></form>`,
      footer: html`<button class="btn" data-close>${t("cancel")}</button><button class="btn primary" type="submit" form="rf">${t("save")}</button>`,
    });
    $("#rf", panel).addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      try {
        toast(msg(await api(`/returns/${r.id}`, { method: "PUT", body: { status: to, admin_note: fd.get("admin_note") || null, refund_amount: fd.get("refund_amount") ? Number(fd.get("refund_amount")) : undefined, refund_method: fd.get("refund_method") || null } })));
        close(); load(); refreshBell?.();
      } catch (err) { showErrors(ev.target, err); toast(errMsg(err), "err"); }
    });
  });
  $("#csv", view).onclick = async () => { try { await exportCsv(`/returns${state.status ? `?status=${state.status}` : ""}`, "returns"); } catch (err) { toast(errMsg(err), "err"); } };
  await load();
  void num;
}
