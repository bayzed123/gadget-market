// Gadget finder: device → budget → one in-stock essential from each shelf (power, audio, accessories …) that works with
// that device, within budget, plus ready-made combos for it. Rule-based on the server (/api/finder).
import { t, tt, num, money, L } from "../i18n.js";
import { $, $$, api, html, icon, raw, errMsg } from "../core.js";
import { productCard, productGrid, bindCards, skeletonGrid, emptyState, addToCart, DEVICE_LABELS, DEVICE_ICONS } from "../ui.js";

const BUDGETS = [1500, 3000, 6000, 10000];
const DEVICES = ["iphone", "android", "laptop", "mac", "windows", "switch", "ps5", "smart_tv"];

export default async function finder(el, { query }) {
  const state = {
    device: DEVICES.includes(query.get("device")) ? query.get("device") : "",
    budget: BUDGETS.includes(Number(query.get("budget"))) ? Number(query.get("budget")) : 3000,
  };
  let step = state.device ? 2 : 1;
  document.title = `${t("finder")} | ${document.title.split("|").pop().trim()}`;

  const draw = () => {
    el.innerHTML = String(html`<div class="container section">
      <div class="quiz">
        <div class="quiz-head">
          <span class="eyebrow">${icon("chip")} ${t("finder")}</span>
          <h1>${t("finderTitle")}</h1>
          <p class="muted">${t("finderSub")}</p>
          <ol class="quiz-progress" aria-label="progress">${[1, 2].map((n) => html`<li class="${n < step ? "done" : n === step ? "current" : ""}">${num(n)}</li>`)}</ol>
        </div>
        <form id="quiz-form" class="quiz-card">
          ${step === 1
            ? html`<fieldset><legend><h2>${t("finderStep1")}</h2></legend>
              <div class="quiz-options concerns">${DEVICES.map((k) => html`<label class="quiz-option"><input type="radio" name="device" value="${k}" ${state.device === k ? raw("checked") : ""} required>${icon(DEVICE_ICONS[k] ?? "phone")}<span>${tt(DEVICE_LABELS[k])}</span></label>`)}</div></fieldset>`
            : html`<fieldset><legend><h2>${t("finderStep2")}</h2></legend>
              <div class="quiz-options budgets">${BUDGETS.map((b) => html`<label class="quiz-option"><input type="radio" name="budget" value="${b}" ${state.budget === b ? raw("checked") : ""}><span class="mono">≤ ${money(b)}</span></label>`)}</div></fieldset>`}
          <div class="quiz-actions">
            ${step > 1 ? html`<button class="btn ghost" type="button" id="back">${t("back")}</button>` : html`<span></span>`}
            <button class="btn primary lg" type="submit">${step < 2 ? html`${t("next")} ${icon("chevron")}` : t("showSetup")}</button>
          </div>
        </form>
        <div id="quiz-result"></div>
      </div></div>`);
    const f = $("#quiz-form", el);
    $("#back", el)?.addEventListener("click", () => { step--; draw(); });
    // Picking a device moves on straight away.
    if (step === 1) $$('input[type="radio"]', f).forEach((i) => i.addEventListener("change", () => f.requestSubmit()));
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      if (step === 1) {
        state.device = f.device.value;
        step = 2;
        return draw();
      }
      state.budget = Number(f.budget.value) || state.budget;
      result();
    });
  };

  const result = async () => {
    const out = $("#quiz-result", el);
    out.innerHTML = String(skeletonGrid(4));
    const p = new URLSearchParams({ device: state.device, budget: String(state.budget) });
    history.replaceState({}, "", `/finder?${p}`);
    try {
      const r = await api(`/finder?${p}`);
      if (!r.items.length && !r.bundles.length) {
        out.innerHTML = String(emptyState(t("finderNone"), "", html`<a class="btn" href="/shop?device=${state.device}">${t("shop")}</a>`));
        return;
      }
      out.innerHTML = String(html`<section class="quiz-result">
        ${r.items.length ? html`<div class="section-head"><h2>${t("finderResult")}</h2><button class="link-btn" type="button" id="retake">${t("retake")}</button></div>
        <p class="note-card small">${icon("info")} ${tt(r.reason)}</p>
        <ol class="kit-steps">${r.items.map((s) => html`<li><span class="shelf-label">${L(s, "category")}</span>${productCard(s.product)}</li>`)}</ol>
        <div class="quiz-total"><span>${t("finderTotal")}: <b class="mono">${money(r.total)}</b></span><button class="btn primary lg" type="button" id="add-kit">${icon("bag")} ${t("addAll")}</button></div>` : ""}
        ${r.bundles.length ? html`<div class="section-head"><h2>${t("readyBundles")}</h2><a href="/bundles">${t("allBundles")} ${icon("chevron")}</a></div>${productGrid(r.bundles)}` : ""}
      </section>`);
      bindCards(out);
      $("#retake", out)?.addEventListener("click", () => { step = 1; draw(); });
      $("#add-kit", out)?.addEventListener("click", async (e) => {
        e.currentTarget.disabled = true;
        for (const s of r.items) {
          const d = await api(`/products/${s.product.slug}`).catch(() => null);
          const v = d?.variants.find((x) => x.stock > 0);
          if (v) addToCart(d.product, v, 1);
        }
        e.currentTarget.disabled = false;
      });
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      out.innerHTML = String(html`<p class="error-box">${errMsg(err)}</p>`);
    }
  };

  draw();
  if (state.device && query.get("budget")) result();
}
