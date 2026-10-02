// Abandoned checkouts: people who typed a phone number but didn't finish. One-tap call / WhatsApp, a recovery
// message with a link that restores their cart, and simple outcomes (contacted / recovered / not interested).
import { t, num, money, dt, lang } from "../i18n.js";
import { html, icon, api, $, $$, can, toast, msg, errMsg, listTable, pill, debounce, exportCsv, confirmDialog } from "../core.js";

export default async function abandoned(view, { refreshBell }) {
  const L = (en, bn) => (lang() === "bn" ? bn : en);
  const state = { status: "open", q: "", page: 1 };
  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("abandoned")}</h1><button class="btn" id="csv">${icon("download")} ${t("exportCsv")}</button></div>
    <p class="muted" id="help"></p>
    <div class="chips" id="tabs" style="margin-bottom:18px"></div>
    <div class="card"><div class="toolbar"><input class="input" id="aq" type="search" placeholder="${L("Name, phone, district…", "নাম, ফোন, জেলা…")}" aria-label="${t("searchPlaceholder")}"></div><div id="list"></div></div>`);

  const canAct = can("abandoned.update");
  const table = listTable($("#list", view), {
    emptyTitle: L("No abandoned checkouts here.", "এখানে কোনো অসম্পূর্ণ চেকআউট নেই।"),
    columns: [
      { label: { en: "Customer", bn: "গ্রাহক" }, render: (a) => html`<b>${a.name || "—"}</b><br>${a.phone ? html`<a href="tel:${a.phone}">${a.phone}</a>` : html`<span class="muted small">${L("no phone yet", "ফোন নেই")}</span>`}` },
      { label: { en: "Cart", bn: "কার্ট" }, render: (a) => html`<b>${money(a.cart_total)}</b><br><span class="muted small">${a.cart.map((l) => `${lang() === "bn" ? l.name_bn ?? l.name_en : l.name_en ?? l.sku} ×${l.quantity}`).join(", ")}</span>` },
      { label: { en: "Got as far as", bn: "কোন পর্যন্ত" }, render: (a) => html`${t(`step_${a.last_step}`)}<br><span class="muted small">${[a.upazila, a.district].filter(Boolean).join(", ")}</span>` },
      { label: { en: "Last activity", bn: "শেষ কার্যক্রম" }, render: (a) => html`${dt(a.updated_at, true)}${a.contact_attempts ? html`<br><span class="muted small">📞 ${num(a.contact_attempts)}${a.recovery_sent_at ? " · ✉︎" : ""}</span>` : ""}${a.utm_source ? html`<br><span class="muted small">${a.utm_source}${a.utm_campaign ? ` / ${a.utm_campaign}` : ""}</span>` : ""}` },
      { label: { en: "Status", bn: "অবস্থা" }, render: (a) => html`${pill(a.status === "open" ? "pending" : a.status === "recovered" ? "delivered" : "inactive", { open: L("Open", "খোলা"), recovered: t("markRecovered"), ignored: t("notInterested"), converted: L("Ordered", "অর্ডার হয়েছে") }[a.status])}${a.order_no ? html`<br><span class="muted small">${a.order_no}</span>` : ""}` },
    ],
    actions: (a) => html`<span class="one-tap">
      ${a.tel ? html`<a class="btn sm call" href="${a.tel}" aria-label="${t("call")}">${icon("phone")}</a>` : ""}
      ${a.whatsapp ? html`<a class="btn sm wa" href="${a.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon("whatsapp")}</a>` : ""}
      ${canAct && a.status === "open" ? html`
        ${a.phone ? html`<button class="btn sm" data-act="send_recovery" data-id="${a.id}">✉︎ ${t("sendRecovery")}</button>` : ""}
        <button class="btn sm" data-act="contacted" data-id="${a.id}">${t("markContacted")}</button>
        <button class="btn sm primary" data-act="recovered" data-id="${a.id}">✓ ${t("markRecovered")}</button>
        <button class="btn sm" data-act="ignored" data-id="${a.id}">${t("notInterested")}</button>` : ""}
      ${canAct && ["recovered", "ignored"].includes(a.status) && !a.order_no ? html`<button class="btn sm" data-act="reopen" data-id="${a.id}">${t("reopen")}</button>` : ""}</span>`,
  });

  const drawTabs = (counts) => {
    const tabs = [["open", L("To follow up", "যোগাযোগ করতে হবে"), counts?.open], ["in_progress", L("Still filling in", "এখনো পূরণ করছেন")], ["recovered", t("markRecovered"), counts?.recovered], ["ignored", t("notInterested"), counts?.ignored], ["all", t("all")]];
    $("#tabs", view).innerHTML = String(html`${tabs.map(([v, l, n]) => html`<button class="chip" data-tab="${v}" aria-pressed="${state.status === v}">${l}${n != null ? html` <span class="n">${num(n)}</span>` : ""}</button>`)}`);
  };
  async function load() {
    table.loading();
    try {
      const res = await api(`/abandoned?${new URLSearchParams(Object.entries({ ...state, limit: "20" }).filter(([, v]) => v !== ""))}`);
      $("#help", view).textContent = L(`A checkout counts as abandoned when a phone number was typed and nothing happened for ${res.windowMinutes} minutes. Details are deleted automatically after the retention period (Settings).`, `ফোন নম্বর দেওয়ার পর ${res.windowMinutes} মিনিট কিছু না হলে চেকআউটটি অসম্পূর্ণ ধরা হয়। নির্দিষ্ট সময় পর তথ্য অটো মুছে যায় (সেটিংস)।`);
      drawTabs(res.counts);
      table.render(res, { onPage: (p) => { state.page = p; load(); } });
    } catch (e) { table.error(e, load); }
  }
  view.addEventListener("click", async (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { state.status = tab.dataset.tab; state.page = 1; return load(); }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "ignored" && !(await confirmDialog(L("Mark as not interested? It leaves the follow-up list.", "আগ্রহী নন হিসেবে চিহ্নিত করবেন? এটি তালিকা থেকে সরে যাবে।"), { danger: false }))) return;
    b.disabled = true;
    try { toast(msg(await api(`/abandoned/${b.dataset.id}`, { method: "POST", body: { action: b.dataset.act } }))); load(); refreshBell?.(); }
    catch (err) { b.disabled = false; toast(errMsg(err), "err"); }
  });
  $("#aq", view).addEventListener("input", debounce((e) => { state.q = e.target.value.trim(); state.page = 1; load(); }));
  $("#csv", view).onclick = async () => { try { await exportCsv(`/abandoned?status=${state.status}${state.q ? `&q=${encodeURIComponent(state.q)}` : ""}`, "abandoned-checkouts"); } catch (err) { toast(errMsg(err), "err"); } };
  await load();
  void $$;
}
