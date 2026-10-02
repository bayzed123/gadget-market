// Warranty claims: Submitted → Under review → Approved / Rejected → Resolved (repair, replace or refund), with a note
// for the customer (sent by SMS) and an internal staff note. The panel shows the order line, the warranty end date,
// the serial numbers we sent and the customer's earlier claims.
import { t, num, money, dt, lang } from "../i18n.js";
import { html, icon, api, $, can, toast, msg, errMsg, listTable, pill, exportCsv, slideOver, showErrors, raw } from "../core.js";

const L = (en, bn) => (lang() === "bn" ? bn : en);
export const ISSUES = {
  not_charging: { en: "Not charging", bn: "চার্জ হচ্ছে না" }, no_sound: { en: "No sound / one side", bn: "শব্দ নেই / এক দিকে" }, not_turning_on: { en: "Won't turn on", bn: "চালু হচ্ছে না" },
  connection: { en: "Won't connect / pair", bn: "কানেক্ট হচ্ছে না" }, battery: { en: "Battery drains fast", bn: "ব্যাটারি দ্রুত শেষ" }, physical: { en: "Button / body", bn: "বাটন / বডি" }, other: { en: "Other", bn: "অন্যান্য" },
};
export const STATUS = {
  submitted: { en: "Submitted", bn: "জমা হয়েছে", pill: "pending" }, under_review: { en: "Under review", bn: "যাচাই চলছে", pill: "confirmation_attempted" },
  approved: { en: "Approved", bn: "অনুমোদিত", pill: "confirmed" }, rejected: { en: "Rejected", bn: "বাতিল", pill: "cancelled" }, resolved: { en: "Resolved", bn: "সমাধান হয়েছে", pill: "delivered" },
};
const RESOLUTION = { repair: { en: "Repair", bn: "মেরামত" }, replace: { en: "Replace", bn: "বদলে দেওয়া" }, refund: { en: "Refund", bn: "টাকা ফেরত" } };
const NEXT_HELP = {
  under_review: { en: "You've started checking it — the customer gets an SMS that it's under review.", bn: "যাচাই শুরু করেছেন — গ্রাহক SMS পাবেন যে যাচাই চলছে।" },
  approved: { en: "It's a covered fault. Tell the customer what happens next (bring it in / courier pickup).", bn: "ওয়ারেন্টির আওতায় পড়েছে। পরের ধাপ গ্রাহককে জানান (নিয়ে আসুন / কুরিয়ার পিকআপ)।" },
  rejected: { en: "Not covered. Write why in plain words — the customer reads this note.", bn: "আওতায় পড়ে না। সহজ ভাষায় কারণ লিখুন — গ্রাহক এই নোট পড়বেন।" },
  resolved: { en: "Choose how it was resolved. A replaced or refunded unit's serial is marked faulty.", bn: "কীভাবে সমাধান হলো বেছে নিন। বদলানো বা টাকা ফেরত দেওয়া ইউনিটের সিরিয়াল ত্রুটিপূর্ণ হিসেবে চিহ্নিত হবে।" },
};

export default async function warranty(view, { refreshBell, id }) {
  const state = { status: "open", q: "", page: 1 };
  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("warranty")}</h1><button class="btn" id="csv">${icon("download")} ${t("exportCsv")}</button></div>
    <div class="toolbar"><input class="input" id="q" type="search" placeholder="${L("Claim no., serial, SKU, phone, order…", "ক্লেইম নং, সিরিয়াল, SKU, ফোন, অর্ডার…")}"></div>
    <div class="chips" id="tabs" style="margin:12px 0 18px">${[["open", L("Open", "চলমান")], ["submitted", STATUS.submitted[lang()]], ["under_review", STATUS.under_review[lang()]], ["approved", STATUS.approved[lang()]], ["resolved", STATUS.resolved[lang()]], ["rejected", STATUS.rejected[lang()]], ["", t("all")]].map(([v, l]) => html`<button class="chip" data-tab="${v}" aria-pressed="${state.status === v}">${l}<span class="count" data-count="${v}"></span></button>`)}</div>
    <div class="card"><div id="list"></div></div>`);
  const table = listTable($("#list", view), {
    columns: [
      { label: { en: "Claim", bn: "ক্লেইম" }, render: (r) => html`<b class="mono">${r.claim_no}</b><br><span class="muted small">${dt(r.created_at, true)}</span>` },
      { label: { en: "Product", bn: "পণ্য" }, render: (r) => html`${lang() === "bn" ? r.product_bn : r.product_en}<br><span class="muted small mono">${r.sku}${r.serial ? ` · S/N ${r.serial}` : ""}</span>` },
      { label: { en: "Issue", bn: "সমস্যা" }, render: (r) => html`${(ISSUES[r.issue] ?? ISSUES.other)[lang()]}` },
      { label: { en: "Customer", bn: "গ্রাহক" }, render: (r) => html`${r.customer_name}<br><a class="small" href="#/orders?q=${r.order_no}">${r.order_no}</a> · <a class="small" href="tel:${r.phone}">${r.phone}</a>` },
      { label: { en: "Warranty until", bn: "ওয়ারেন্টি পর্যন্ত" }, render: (r) => html`<span class="mono">${r.warranty_until ?? "—"}</span>` },
      { label: { en: "Status", bn: "অবস্থা" }, render: (r) => html`${pill(STATUS[r.status].pill, STATUS[r.status][lang()])}${r.resolution && r.resolution !== "none" ? html`<br><span class="muted small">${RESOLUTION[r.resolution]?.[lang()] ?? ""}</span>` : ""}` },
    ],
    actions: (r) => html`<button class="btn sm" data-open="${r.id}">${L("Open", "খুলুন")}</button>`,
  });
  async function load() {
    table.loading();
    try {
      const res = await api(`/warranty-claims?${new URLSearchParams(Object.entries({ ...state, limit: "20" }).filter(([, v]) => v !== ""))}`);
      table.render(res, { onPage: (p) => { state.page = p; load(); } });
      const c = res.counts ?? {};
      const open = (c.submitted ?? 0) + (c.under_review ?? 0) + (c.approved ?? 0);
      view.querySelectorAll("[data-count]").forEach((el) => {
        const k = el.dataset.count;
        const n = k === "open" ? open : k ? c[k] ?? 0 : Object.values(c).reduce((a, b) => a + b, 0);
        el.textContent = n ? ` ${num(n)}` : "";
      });
    } catch (e) { table.error(e, load); }
  }

  async function openClaim(cid) {
    let d;
    try { d = await api(`/warranty-claims/${cid}`); } catch (e) { return toast(errMsg(e), "err"); }
    const c = d.claim;
    const canAct = can("warranty.update");
    const { panel, close } = slideOver({
      wide: true,
      title: `${c.claim_no} · ${STATUS[c.status][lang()]}`,
      body: html`<div class="claim-panel">
        <div class="row" style="gap:14px;align-items:flex-start">
          ${c.image ? html`<img src="${c.image}" alt="" width="84" height="84" style="border-radius:6px">` : ""}
          <div><b>${lang() === "bn" ? c.name_bn : c.name_en}</b>${c.size && c.size !== "Standard" ? ` · ${c.size}` : ""}${c.color ? ` · ${c.color}` : ""}
            <div class="muted small mono">${c.sku} · ${money(c.unit_price)} · ${L("warranty", "ওয়ারেন্টি")} ${num(c.warranty_months)} ${L("months", "মাস")}</div>
            <div class="small">${L("Order", "অর্ডার")} <a href="#/orders/${c.order_id}">${c.order_no}</a>${c.invoice_no ? html` · <span class="mono">${c.invoice_no}</span>` : ""} · ${L("delivered", "ডেলিভারি")} ${dt(c.delivered_at)} · <b>${L("warranty until", "ওয়ারেন্টি পর্যন্ত")} <span class="mono">${c.warranty_until ?? "—"}</span></b></div></div></div>
        <dl class="kv">
          <dt>${L("Customer", "গ্রাহক")}</dt><dd>${c.customer_name} · <a href="tel:${c.phone}">${c.phone}</a> · ${[c.area, c.upazila, c.district].filter(Boolean).join(", ")}</dd>
          <dt>${L("Issue", "সমস্যা")}</dt><dd><b>${(ISSUES[c.issue] ?? ISSUES.other)[lang()]}</b> — ${c.details}</dd>
          <dt>${L("Serial (claimed)", "সিরিয়াল (ক্লেইমে)")}</dt><dd class="mono">${c.serial ?? "—"}</dd>
          <dt>${L("Serials we sent", "যে সিরিয়াল পাঠানো হয়েছিল")}</dt><dd class="mono">${d.serials.length ? d.serials.map((s) => `${s.serial} (${s.status})`).join(", ") : L("Not logged for this order line", "এই লাইনের সিরিয়াল লেখা হয়নি")}</dd>
          ${c.photo_url ? html`<dt>${L("Photo", "ছবি")}</dt><dd><a href="${c.photo_url}" target="_blank" rel="noopener">${L("Open", "খুলুন")}</a></dd>` : ""}
          ${c.customer_note ? html`<dt>${L("Note to customer", "গ্রাহকের নোট")}</dt><dd>${c.customer_note}</dd>` : ""}
          ${c.staff_note ? html`<dt>${L("Staff note", "স্টাফ নোট")}</dt><dd>${c.staff_note}</dd>` : ""}
        </dl>
        ${d.earlier.length ? html`<div class="note-card small">${icon("alert")} ${L("Earlier claims from this phone", "এই ফোন থেকে আগের ক্লেইম")}: ${d.earlier.map((e) => `${e.claim_no} (${STATUS[e.status][lang()]})`).join(", ")}</div>` : ""}
        ${d.history.length ? html`<h3>${L("History", "ইতিহাস")}</h3><ol class="timeline small">${d.history.map((h) => html`<li><b>${h.action}</b> · ${h.actor} · ${dt(h.created_at, true)}</li>`)}</ol>` : ""}
        ${canAct && c.next.length ? html`<form id="cf" class="stack" novalidate><h3>${L("Next step", "পরের ধাপ")}</h3>
          <div class="chips">${c.next.map((s, i) => html`<label class="chip"><input type="radio" name="status" value="${s}" ${i === 0 ? raw("checked") : ""}> ${STATUS[s][lang()]}</label>`)}</div>
          <p class="small muted" id="next-help"></p>
          <label class="field" id="res-field" hidden><span>${L("Resolution", "সমাধান")} *</span><select class="input" name="resolution">${Object.entries(RESOLUTION).map(([k, v]) => html`<option value="${k}" ${c.resolution === k ? raw("selected") : ""}>${v[lang()]}</option>`)}</select></label>
          <label class="field"><span>${L("Note to the customer (sent by SMS)", "গ্রাহকের জন্য নোট (SMS এ যাবে)")}</span><textarea class="input" name="customer_note" rows="2" maxlength="1000"></textarea></label>
          <label class="field"><span>${L("Staff note (internal)", "স্টাফ নোট (ভেতরের)")}</span><textarea class="input" name="staff_note" rows="2" maxlength="1000"></textarea></label>
          <label class="check"><input type="checkbox" name="notify" checked> ${L("Send the customer an SMS", "গ্রাহককে SMS পাঠান")}</label>
        </form>` : html`<p class="muted small">${c.next.length ? "" : L("This claim is closed.", "এই ক্লেইম বন্ধ।")}</p>`}
      </div>`,
      footer: canAct && c.next.length ? html`<button class="btn" data-close>${t("cancel")}</button><button class="btn primary" type="submit" form="cf">${t("save")}</button>` : html`<button class="btn" data-close>${t("close")}</button>`,
    });
    const f = $("#cf", panel);
    if (!f) return;
    const sync = () => {
      const to = f.status.value;
      $("#next-help", panel).textContent = NEXT_HELP[to]?.[lang()] ?? "";
      $("#res-field", panel).hidden = to !== "resolved";
    };
    f.addEventListener("change", sync);
    sync();
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(f);
      const to = fd.get("status");
      try {
        toast(msg(await api(`/warranty-claims/${c.id}`, { method: "PUT", body: { status: to, resolution: to === "resolved" ? fd.get("resolution") : undefined, customer_note: fd.get("customer_note") || null, staff_note: fd.get("staff_note") || null, notify: fd.get("notify") === "on" } })));
        close(); load(); refreshBell?.();
      } catch (err) { showErrors(f, err); toast(errMsg(err), "err"); }
    });
  }

  view.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { state.status = tab.dataset.tab; state.page = 1; view.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b === tab))); return load(); }
    const o = e.target.closest("[data-open]");
    if (o) openClaim(Number(o.dataset.open));
  });
  let h;
  $("#q", view).addEventListener("input", (e) => { clearTimeout(h); h = setTimeout(() => { state.q = e.target.value.trim(); state.page = 1; load(); }, 300); });
  $("#csv", view).onclick = async () => { try { await exportCsv(`/warranty-claims${state.status ? `?status=${state.status}` : ""}`, "warranty-claims"); } catch (err) { toast(errMsg(err), "err"); } };
  await load();
  if (id) openClaim(Number(id));
}
