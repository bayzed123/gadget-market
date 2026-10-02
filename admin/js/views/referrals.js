// Refer-a-friend: every customer's code, how often it was used, rewards earned and delivered revenue.
import { t, num, money, dt, lang } from "../i18n.js";
import { html, icon, api, $, can, toast, msg, errMsg, listTable, pill, exportCsv } from "../core.js";

export default async function referrals(view) {
  const L = (en, bn) => (lang() === "bn" ? bn : en);
  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("referrals")}</h1><button class="btn" id="csv">${icon("download")} ${t("exportCsv")}</button>${can("settings.read") ? html`<a class="btn" href="#/settings/referral">${icon("settings")} ${t("referralSettings")}</a>` : ""}</div>
    <p class="muted">${L("When a friend's first order with the code is delivered, the customer gets a reward coupon automatically.", "কোড দিয়ে বন্ধুর প্রথম অর্ডার ডেলিভারি হলে গ্রাহক স্বয়ংক্রিয়ভাবে রিওয়ার্ড কুপন পান।")}</p>
    <div class="card"><div id="list"></div></div>`);
  const table = listTable($("#list", view), {
    columns: [
      { label: { en: "Code", bn: "কোড" }, render: (r) => html`<b>${r.code}</b><br><span class="muted small">${dt(r.created_at)}</span>` },
      { label: { en: "Customer", bn: "গ্রাহক" }, render: (r) => html`${r.name}<br><a class="small" href="tel:${r.phone}">${r.phone}</a>` },
      { label: { en: "Used", bn: "ব্যবহার" }, render: (r) => num(r.uses) },
      { label: { en: "Rewards earned", bn: "অর্জিত রিওয়ার্ড" }, render: (r) => num(r.rewards_earned) },
      { label: { en: "Delivered sales", bn: "ডেলিভারড বিক্রি" }, render: (r) => money(r.delivered_revenue) },
      { label: { en: "Status", bn: "অবস্থা" }, render: (r) => pill(r.is_active ? "active" : "inactive", r.is_active ? t("active") : L("Off", "বন্ধ")) },
    ],
    actions: (r) => (can("customers.write") ? html`<button class="btn sm" data-toggle="${r.id}" data-on="${r.is_active ? 0 : 1}">${r.is_active ? L("Turn off", "বন্ধ করুন") : L("Turn on", "চালু করুন")}</button>` : ""),
  });
  async function load() {
    table.loading();
    try { const r = await api("/referrals"); table.render({ items: r.items, page: 1, pages: 1 }); } catch (e) { table.error(e, load); }
  }
  view.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-toggle]");
    if (!b) return;
    try { toast(msg(await api(`/referrals/${b.dataset.toggle}`, { method: "PUT", body: { is_active: b.dataset.on === "1" } }))); load(); } catch (err) { toast(errMsg(err), "err"); }
  });
  $("#csv", view).onclick = async () => { try { await exportCsv("/referrals", "referrals"); } catch (err) { toast(errMsg(err), "err"); } };
  await load();
}
