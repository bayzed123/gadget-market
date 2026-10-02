// Product Q&A: shoppers ask on the product page; an answer publishes the question there. Hide keeps it off the page.
import { t, dt, lang } from "../i18n.js";
import { html, icon, api, $, can, toast, msg, errMsg, listTable, pill, slideOver, showErrors, confirmDialog } from "../core.js";

const L = (en, bn) => (lang() === "bn" ? bn : en);
const STATUS = { pending: { en: "Waiting for an answer", bn: "উত্তরের অপেক্ষায়", pill: "pending" }, published: { en: "Published", bn: "প্রকাশিত", pill: "delivered" }, hidden: { en: "Hidden", bn: "লুকানো", pill: "cancelled" } };

export default async function questions(view, { refreshBell }) {
  const state = { status: "pending", q: "", page: 1 };
  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("questions")}</h1></div>
    <p class="muted">${L("Answers appear on the product page right away. Keep them factual — the same honest-copy rules as product pages apply.", "উত্তর সাথে সাথে পণ্যের পাতায় দেখাবে। তথ্যভিত্তিক রাখুন — পণ্যের পাতার মতোই সৎ লেখার নিয়ম প্রযোজ্য।")}</p>
    <div class="toolbar"><input class="input" id="q" type="search" placeholder="${t("search")}"></div>
    <div class="chips" style="margin:12px 0 18px">${[["pending", STATUS.pending[lang()]], ["published", STATUS.published[lang()]], ["hidden", STATUS.hidden[lang()]], ["", t("all")]].map(([v, l]) => html`<button class="chip" data-tab="${v}" aria-pressed="${state.status === v}">${l}</button>`)}</div>
    <div class="card"><div id="list"></div></div>`);
  const canAnswer = can("questions.answer");
  let rows = [];
  const table = listTable($("#list", view), {
    columns: [
      { label: { en: "Question", bn: "প্রশ্ন" }, render: (r) => html`<b>${r.question}</b><br><span class="muted small">${r.name} · ${dt(r.created_at, true)}</span>${r.answer ? html`<p class="small" style="margin:6px 0 0">↳ ${r.answer}</p>` : ""}` },
      { label: { en: "Product", bn: "পণ্য" }, render: (r) => html`<a href="#/products/${r.product_id}">${lang() === "bn" ? r.product_bn : r.product_en}</a>` },
      { label: { en: "Status", bn: "অবস্থা" }, render: (r) => pill(STATUS[r.status].pill, STATUS[r.status][lang()]) },
    ],
    actions: (r) => (canAnswer ? html`<button class="btn sm primary" data-answer="${r.id}">${r.answer ? t("edit") : L("Answer", "উত্তর দিন")}</button> <button class="btn sm" data-del="${r.id}">${icon("trash")}</button>` : ""),
  });
  async function load() {
    table.loading();
    try { const res = await api(`/questions?${new URLSearchParams(Object.entries({ ...state, limit: "20" }).filter(([, v]) => v !== ""))}`); rows = res.items; table.render(res, { onPage: (p) => { state.page = p; load(); } }); }
    catch (e) { table.error(e, load); }
  }
  view.addEventListener("click", async (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { state.status = tab.dataset.tab; state.page = 1; view.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b === tab))); return load(); }
    const del = e.target.closest("[data-del]");
    if (del) {
      if (!(await confirmDialog(L("Delete this question?", "প্রশ্নটি মুছবেন?")))) return;
      try { toast(msg(await api(`/questions/${del.dataset.del}`, { method: "DELETE" }))); load(); } catch (err) { toast(errMsg(err), "err"); }
      return;
    }
    const a = e.target.closest("[data-answer]");
    if (!a) return;
    const r = rows.find((x) => x.id === Number(a.dataset.answer));
    const { panel, close } = slideOver({
      title: L("Answer the question", "প্রশ্নের উত্তর"),
      body: html`<form id="qf" class="stack" novalidate><p><b>${r.question}</b><br><span class="muted small">${r.name} · ${lang() === "bn" ? r.product_bn : r.product_en}</span></p>
        <label class="field"><span>${L("Answer", "উত্তর")} *</span><textarea class="input" name="answer" rows="4" maxlength="1500" required>${r.answer ?? ""}</textarea></label>
        <label class="field"><span>${L("Show on the product page", "পণ্যের পাতায় দেখান")}</span><select class="input" name="status"><option value="published">${STATUS.published[lang()]}</option><option value="hidden" ${r.status === "hidden" ? "selected" : ""}>${STATUS.hidden[lang()]}</option></select></label></form>`,
      footer: html`<button class="btn" data-close>${t("cancel")}</button><button class="btn primary" type="submit" form="qf">${t("save")}</button>`,
    });
    $("#qf", panel).addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      try { toast(msg(await api(`/questions/${r.id}`, { method: "PUT", body: { answer: fd.get("answer"), status: fd.get("status") } }))); close(); load(); refreshBell?.(); }
      catch (err) { showErrors(ev.target, err); toast(errMsg(err), "err"); }
    });
  });
  let h;
  $("#q", view).addEventListener("input", (e) => { clearTimeout(h); h = setTimeout(() => { state.q = e.target.value.trim(); state.page = 1; load(); }, 300); });
  await load();
}
