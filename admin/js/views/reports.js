// Reports: sales by day / month / category / product / payment / zone / ad campaign, best sellers (by SKU),
// delivery outcomes (cancelled ≠ refused ≠ returned), best customers, the checkout funnel and warranty claims by
// product (claim rate against units sold) — all as CSV too.
import { t, num, money, lang } from "../i18n.js";
import { html, icon, api, $, $$, toast, errMsg, skeleton, errorState, emptyState, exportCsv } from "../core.js";

const MONEY_COLS = ["merchandise", "discounts", "delivery", "revenue", "collected", "spent", "delivered_revenue", "recovered_value"];

export default async function reports(view) {
  const L = (en, bn) => (lang() === "bn" ? bn : en);
  const today = new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
  const state = { report: "sales", group: "day", from: monthAgo, to: today };
  const REPORTS = [
    ["sales", t("salesReport")], ["best-sellers", L("Best sellers (SKU)", "সেরা বিক্রিত (SKU)")], ["outcomes", L("Delivery outcomes", "ডেলিভারির ফলাফল")],
    ["customers", t("bestCustomers")], ["abandoned", L("Checkout funnel", "চেকআউট ফানেল")], ["warranty", t("warrantyReport")],
  ];
  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("reports")}</h1><button class="btn" id="csv">${icon("download")} ${t("exportCsv")}</button></div>
    <div class="chips" style="margin-bottom:18px">${REPORTS.map(([k, l]) => html`<button class="chip" data-report="${k}" aria-pressed="${k === "sales"}">${l}</button>`)}</div>
    <div class="card"><div class="toolbar">
      <label class="field" style="margin:0;flex:0 1 180px"><span class="small">${t("from")}</span><input class="input" type="date" id="from" value="${state.from}"></label>
      <label class="field" style="margin:0;flex:0 1 180px"><span class="small">${t("to")}</span><input class="input" type="date" id="to" value="${state.to}"></label>
      <label class="field" style="margin:0;flex:0 1 220px" id="group-wrap"><span class="small">${t("groupBy")}</span><select class="input" id="group">${[["day", t("byDay")], ["month", t("byMonth")], ["category", t("byCategory")], ["product", t("byProduct")], ["payment", t("byPayment")], ["zone", t("byZone")], ["campaign", L("Ad campaign (UTM)", "বিজ্ঞাপন ক্যাম্পেইন (UTM)")]].map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select></label>
    </div>
    <p class="muted small" id="note"></p>
    <div class="kpis" id="totals" style="margin-top:8px"></div><div id="out"></div></div>`);

  const url = (format) => {
    const qs = new URLSearchParams({ from: state.from, to: state.to, ...(state.report === "sales" ? { group: state.group } : {}), ...(format ? { format } : {}) });
    return `/reports/${state.report}?${qs}`;
  };
  const cell = (k, v) => (MONEY_COLS.includes(k) ? money(v ?? 0) : k === "success_rate" || k === "claim_rate" ? (v == null ? "—" : `${num(v)}%`) : typeof v === "number" ? num(v) : v ?? "—");
  const notes = {
    outcomes: L("Cancelled = stopped before shipping. Refused = the customer didn't accept the parcel. Returned = sent back after delivery. They are kept separate on purpose.", "বাতিল = পাঠানোর আগে বন্ধ। নেননি = গ্রাহক পার্সেল নেননি। ফেরত = ডেলিভারির পরে ফেরত। এগুলো আলাদা রাখা হয়েছে।"),
    abandoned: L("Started = opened checkout. With phone = typed a phone number. Completed = ordered within the window. Recovered = ordered after follow-up.", "শুরু = চেকআউট খুলেছেন। ফোনসহ = ফোন নম্বর দিয়েছেন। সম্পন্ন = সময়ের মধ্যে অর্ডার। উদ্ধার = যোগাযোগের পর অর্ডার।"),
    warranty: L("Claims opened in the period per product, how they were resolved, and the claim rate against units sold in the same period. A high rate is a reason to talk to the supplier.", "সময়ের মধ্যে প্রতিটি পণ্যে কতটি ক্লেইম, কীভাবে সমাধান হয়েছে, আর একই সময়ে বিক্রির তুলনায় ক্লেইমের হার। হার বেশি হলে সাপ্লায়ারের সাথে কথা বলুন।"),
    sales: L("Sales count every order except cancelled, refused and returned ones.", "বাতিল, না-নেওয়া ও ফেরত অর্ডার বাদে সব অর্ডার বিক্রিতে ধরা হয়।"),
  };
  const barKey = (row) => Number(row.revenue ?? row.spent ?? row.claims ?? row.units ?? row.orders ?? row.started ?? 0);
  const load = async () => {
    $("#out", view).innerHTML = String(skeleton(5));
    $("#group-wrap", view).hidden = state.report !== "sales";
    $("#note", view).textContent = notes[state.report] ?? "";
    try {
      const r = await api(url());
      $("#totals", view).innerHTML = r.totals
        ? String(html`<div class="card kpi" style="--c:var(--k1)"><div class="label">${t("orders_")}</div><div class="value">${num(r.totals.orders)}</div></div><div class="card kpi" style="--c:var(--k2)"><div class="label">${t("revenue")}</div><div class="value">${money(r.totals.revenue)}</div></div><div class="card kpi" style="--c:var(--k4)"><div class="label">${t("avgOrder")}</div><div class="value">${money(Math.round(r.totals.aov))}</div></div>`)
        : "";
      if (!r.rows.length) { $("#out", view).innerHTML = String(emptyState()); return; }
      const cols = Object.keys(r.rows[0]);
      const max = Math.max(...r.rows.map(barKey));
      $("#out", view).innerHTML = String(html`<table class="table"><thead><tr>${cols.map((c) => html`<th>${c.replace(/_/g, " ")}</th>`)}<th></th></tr></thead><tbody>${r.rows.map((row) => html`<tr>${cols.map((c) => html`<td data-label="${c.replace(/_/g, " ")}">${cell(c, row[c])}</td>`)}<td data-label="" style="min-width:120px"><div class="bar"><i style="width:${max ? (barKey(row) / max) * 100 : 0}%"></i></div></td></tr>`)}</tbody></table>`);
    } catch (e) { $("#out", view).innerHTML = String(errorState(errMsg(e))); $("[data-retry]", view).onclick = load; }
  };
  view.addEventListener("click", (e) => {
    const r = e.target.closest("[data-report]");
    if (r) { state.report = r.dataset.report; $$("[data-report]", view).forEach((b) => b.setAttribute("aria-pressed", String(b === r))); load(); }
  });
  $("#from", view).onchange = (e) => { state.from = e.target.value; load(); };
  $("#to", view).onchange = (e) => { state.to = e.target.value; load(); };
  $("#group", view).onchange = (e) => { state.group = e.target.value; load(); };
  $("#csv", view).onclick = async () => { try { await exportCsv(url(), `${state.report}${state.report === "sales" ? `-by-${state.group}` : ""}-${state.from}-${state.to}`); } catch (err) { toast(errMsg(err), "err"); } };
  await load();
}
