// Categories: nested tree (with the 2–4 letter SKU code) with drag-to-reorder (drop on the top edge = before,
// middle = make sub-category), All / Active / Inactive tabs and a one-tap Active ⇄ Inactive switch on every row.
import { t, tt, num, lang } from "../i18n.js";
import { COLORS } from "../resources.js";
import { html, icon, api, $, $$, can, toast, msg, errMsg, slideOver, fieldHtml, readForm, showErrors, confirmDialog, skeleton, errorState, bindUploads, emptyState, exportCsv } from "../core.js";

const fields = (parents) => [
  { name: "name_en", label: { en: "Name (English)", bn: "নাম (ইংরেজি)" }, required: true },
  { name: "name_bn", label: { en: "Name (Bangla)", bn: "নাম (বাংলা)" }, required: true },
  { name: "slug", label: { en: "Web address (slug)", bn: "ওয়েব ঠিকানা (slug)" }, required: true, hint: { en: "e.g. power-banks", bn: "যেমন power-banks" } },
  { name: "code", label: { en: "SKU code (2–4 letters)", bn: "SKU কোড (২–৪ অক্ষর)" }, required: true, maxlength: 4, hint: { en: "Used in SKUs: GAD-EB-SON-BLK-0007. Can't be reused.", bn: "SKU-তে ব্যবহৃত হয়: GAD-EB-SON-BLK-0007।" } },
  { name: "parent_id", label: { en: "Parent category", bn: "মূল ক্যাটাগরি" }, type: "select", numeric: true, allowEmpty: true, options: parents },
  { name: "description_en", label: { en: "Description (English)", bn: "বিবরণ (ইংরেজি)" }, type: "textarea", rows: 2 },
  { name: "description_bn", label: { en: "Description (Bangla)", bn: "বিবরণ (বাংলা)" }, type: "textarea", rows: 2 },
  { name: "image_url", label: { en: "Tile image (optional — otherwise a product photo is used)", bn: "টাইলের ছবি (ঐচ্ছিক)" }, type: "image", span: 2 },
  { name: "color", label: { en: "Tile colour", bn: "টাইলের রং" }, type: "select", allowEmpty: true, options: COLORS },
  { name: "sort_order", label: { en: "Order", bn: "ক্রম" }, type: "number", default: 0 },
  { name: "is_active", label: { en: "Active — show this category in the shop", bn: "চালু — ক্যাটাগরিটি দোকানে দেখাবে" }, type: "checkbox", default: 1, span: 2 },
];

export default async function categories(view) {
  const L = (en, bn) => (lang() === "bn" ? bn : en);
  const canWrite = can("categories.write");
  let filter = "all"; // all | active | inactive
  view.innerHTML = String(html`<div class="page-head"><h1>${t("categories")}</h1><button class="btn" id="csv">${icon("download")} ${t("exportCsv")}</button>${canWrite ? html`<button class="btn primary" id="add">${icon("plus")} ${L("New category", "নতুন ক্যাটাগরি")}</button>` : ""}</div>
    <div class="chips" id="cat-tabs" style="margin-bottom:18px"></div>
    <div class="card"><p class="muted small" id="cat-hint"></p><div id="tree">${skeleton(5)}</div>${canWrite ? html`<div style="margin-top:16px;text-align:right"><button class="btn primary" id="save-order" hidden>${t("saveOrder")}</button></div>` : ""}</div>`);
  let items = [];
  const load = async () => {
    try { items = (await api("/categories?limit=200&sort=sort_order")).items; draw(); }
    catch (e) { $("#tree", view).innerHTML = String(errorState(errMsg(e))); $("[data-retry]", view).onclick = load; }
  };
  const name = (c) => (lang() === "bn" ? c.name_bn : c.name_en);
  const isOn = (c) => Boolean(c.is_active);
  const descendants = (id) => {
    const out = [];
    const walk = (pid) => items.filter((c) => c.parent_id === pid).forEach((c) => { out.push(c); walk(c.id); });
    walk(id);
    return out;
  };
  const pathOf = (c) => {
    const parts = [];
    let p = items.find((x) => x.id === c.parent_id);
    while (p) { parts.unshift(name(p)); p = items.find((x) => x.id === p.parent_id); }
    return parts.join(" › ");
  };
  const statusCtl = (c) => canWrite
    ? html`<button type="button" class="switch" role="switch" aria-checked="${isOn(c) ? "true" : "false"}" data-toggle="${c.id}" title="${isOn(c) ? L("Tap to turn off (hide from the shop)", "বন্ধ করতে চাপুন (দোকানে লুকাবে)") : L("Tap to turn on (show in the shop)", "চালু করতে চাপুন (দোকানে দেখাবে)")}"><span class="knob" aria-hidden="true"></span>${isOn(c) ? t("active") : L("Inactive", "বন্ধ")}</button>`
    : html`<span class="pill ${isOn(c) ? "active" : "inactive"}">${isOn(c) ? t("active") : L("Inactive", "বন্ধ")}</span>`;
  const rowHtml = (c, { flat = false } = {}) => html`<div class="row">${flat || !canWrite ? "" : html`<button type="button" class="handle" aria-label="Drag">${icon("grip")}</button>`}<b style="flex:1;min-width:140px">${name(c)} <span class="muted small">${c.code}</span>${flat && c.parent_id ? html`<span class="muted small cat-path">${pathOf(c)} ›</span>` : ""}</b>
        <span class="muted small">${num(c.product_count)} ${L(c.product_count === 1 ? "product" : "products", "পণ্য")}</span>${statusCtl(c)}
        ${canWrite ? html`<button class="btn sm" data-add-sub="${c.id}" aria-label="${t("addSub")}" title="${t("addSub")}">${icon("plus")}</button><button class="btn sm" data-edit="${c.id}" aria-label="${t("edit")}">${icon("edit")}</button>` : ""}
        ${can("categories.delete") ? html`<button class="btn sm" data-del="${c.id}" aria-label="${t("delete")}">${icon("trash")}</button>` : ""}</div>`;
  const draw = () => {
    const nOn = items.filter(isOn).length;
    $("#cat-tabs", view).innerHTML = String(html`${[["all", t("all"), items.length], ["active", t("active"), nOn], ["inactive", L("Inactive", "বন্ধ"), items.length - nOn]].map(([k, l, n]) => html`<button class="chip" data-tab="${k}" aria-pressed="${filter === k}">${l} <span class="n">${num(n)}</span></button>`)}`);
    $("#cat-hint", view).textContent = filter === "all"
      ? `${t("dragHint")} ${L("Inactive categories are hidden from the shop menu and category page; their products stay on sale (set a product to Draft to hide it).", "বন্ধ ক্যাটাগরি দোকানের মেনু ও ক্যাটাগরি পেজে দেখাবে না; এর পণ্যগুলো বিক্রি চলবে (পণ্য লুকাতে সেটি ড্রাফট করুন)।")}`
      : filter === "active" ? L("Categories customers can see in the shop.", "যে ক্যাটাগরিগুলো গ্রাহক দোকানে দেখতে পান।") : L("Hidden from the shop. Tap the switch to turn one back on.", "দোকানে লুকানো। আবার চালু করতে সুইচে চাপুন।");
    if (!items.length) { $("#tree", view).innerHTML = String(emptyState(L("No categories yet.", "এখনো কোনো ক্যাটাগরি নেই।"), L("Tap “New category” to add your first one.", "প্রথমটি যোগ করতে “নতুন ক্যাটাগরি” চাপুন।"))); return; }
    if (filter !== "all") {
      const list = items.filter((c) => (filter === "active" ? isOn(c) : !isOn(c))).sort((a, b) => (pathOf(a) + name(a)).localeCompare(pathOf(b) + name(b)));
      $("#tree", view).innerHTML = list.length
        ? String(html`<ul class="tree">${list.map((c) => html`<li class="tree-item ${isOn(c) ? "" : "is-off"}" data-id="${c.id}">${rowHtml(c, { flat: true })}</li>`)}</ul>`)
        : String(emptyState(filter === "active" ? L("No active categories.", "কোনো চালু ক্যাটাগরি নেই।") : L("No inactive categories.", "কোনো বন্ধ ক্যাটাগরি নেই।"), L("Everything here is up to date.", "সব ঠিক আছে।")));
      return;
    }
    const kids = (pid) => items.filter((c) => (c.parent_id ?? null) === pid).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    const branch = (pid) => html`<ul class="tree">${kids(pid).map((c) => html`<li class="tree-item ${isOn(c) ? "" : "is-off"}" data-id="${c.id}" draggable="${canWrite}">
      ${rowHtml(c)}
      ${kids(c.id).length ? branch(c.id) : ""}</li>`)}</ul>`;
    $("#tree", view).innerHTML = String(branch(null));
    bindDrag();
  };

  /** One tap: Active ⇄ Inactive. Sub-categories follow their parent (asked first when there are any). */
  const toggle = async (btn) => {
    const c = items.find((x) => x.id === Number(btn.dataset.toggle));
    const turnOn = !isOn(c);
    const subs = descendants(c.id).filter((d) => isOn(d) !== turnOn);
    if (subs.length) {
      const text = turnOn
        ? L(`Turn on "${name(c)}" and its ${subs.length} sub-categor${subs.length === 1 ? "y" : "ies"}? They will show in the shop again.`, `"${name(c)}" ও এর ${num(subs.length)}টি সাব-ক্যাটাগরি চালু করবেন? আবার দোকানে দেখাবে।`)
        : L(`Turn off "${name(c)}" and its ${subs.length} sub-categor${subs.length === 1 ? "y" : "ies"}? They will be hidden from the shop menu. Products stay on sale.`, `"${name(c)}" ও এর ${num(subs.length)}টি সাব-ক্যাটাগরি বন্ধ করবেন? দোকানের মেনু থেকে লুকাবে। পণ্য বিক্রি চলবে।`);
      if (!(await confirmDialog(text, { danger: !turnOn, okText: turnOn ? L("Turn on", "চালু করুন") : L("Turn off", "বন্ধ করুন") }))) return;
    }
    btn.disabled = true;
    try {
      const r = await api(`/categories/${c.id}/status`, { method: "PUT", body: { is_active: turnOn, include_sub: true } });
      for (const id of r.ids) { const x = items.find((i) => i.id === id); if (x) x.is_active = turnOn ? 1 : 0; }
      toast(msg(r));
      draw();
    } catch (err) { btn.disabled = false; toast(errMsg(err), "err"); }
  };

  let dragId = null;
  const bindDrag = () => {
    $$(".tree-item", view).forEach((li) => {
      li.addEventListener("dragstart", (e) => { e.stopPropagation(); dragId = Number(li.dataset.id); li.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
      li.addEventListener("dragend", () => { li.classList.remove("dragging"); $$(".drop-before,.drop-inside", view).forEach((x) => x.classList.remove("drop-before", "drop-inside")); });
      const row = li.querySelector(".row");
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        const r = row.getBoundingClientRect();
        const inside = e.clientY - r.top > r.height * 0.4;
        li.classList.toggle("drop-inside", inside);
        li.classList.toggle("drop-before", !inside);
      });
      row.addEventListener("dragleave", () => li.classList.remove("drop-before", "drop-inside"));
      row.addEventListener("drop", (e) => {
        e.preventDefault(); e.stopPropagation();
        const targetId = Number(li.dataset.id);
        const inside = li.classList.contains("drop-inside");
        li.classList.remove("drop-before", "drop-inside");
        if (!dragId || dragId === targetId) return;
        // Prevent dropping a category into its own descendant.
        let p = items.find((c) => c.id === targetId);
        while (p) { if (p.id === dragId) return toast(lang() === "bn" ? "নিজের ভেতরে রাখা যাবে না।" : "Can't move a category inside itself.", "err"); p = items.find((c) => c.id === p.parent_id); }
        const moving = items.find((c) => c.id === dragId);
        const target = items.find((c) => c.id === targetId);
        if (inside) { moving.parent_id = target.id; moving.sort_order = 9999; }
        else { moving.parent_id = target.parent_id ?? null; moving.sort_order = target.sort_order - 0.5; }
        // Normalise sort orders within each sibling group.
        const groups = new Map();
        for (const c of items) { const k = c.parent_id ?? 0; groups.set(k, [...(groups.get(k) ?? []), c]); }
        for (const g of groups.values()) g.sort((a, b) => a.sort_order - b.sort_order).forEach((c, i) => (c.sort_order = i));
        draw();
        $("#save-order", view).hidden = false;
      });
    });
  };

  const openForm = async (id, parentId = null) => {
    const item = id ? items.find((c) => c.id === id) : { parent_id: parentId };
    const parents = items.filter((c) => c.id !== id).map((c) => [c.id, name(c)]);
    const F = fields(parents);
    const { panel, close, body } = slideOver({
      title: id ? `${t("edit")}: ${name(item)}` : L("New category", "নতুন ক্যাটাগরি"),
      body: html`<form id="cf" class="grid2" novalidate>${F.map((f) => fieldHtml(f, item[f.name] ?? (id ? undefined : f.default)))}</form>`,
      footer: html`<button class="btn" data-close>${t("cancel")}</button><button class="btn primary" type="submit" form="cf">${t("save")}</button>`,
    });
    bindUploads(body);
    const form = $("#cf", panel);
    if (!id) form.name_en.addEventListener("input", () => {
      form.slug.value = form.name_en.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!form.code.dataset.touched) form.code.value = form.name_en.value.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
    });
    form.code.addEventListener("input", () => { form.code.dataset.touched = "1"; form.code.value = form.code.value.toUpperCase(); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { toast(msg(await api(id ? `/categories/${id}` : "/categories", { method: id ? "PUT" : "POST", body: readForm(form, F) }))); close(); load(); }
      catch (err) { showErrors(form, err); toast(errMsg(err), "err"); }
    });
  };

  view.addEventListener("click", async (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { filter = tab.dataset.tab; return draw(); }
    const sw = e.target.closest("[data-toggle]");
    if (sw) return toggle(sw);
    const b = e.target.closest("[data-edit],[data-del],[data-add-sub],#add,#save-order,#csv");
    if (!b) return;
    try {
      if (b.id === "csv") return await exportCsv("/categories", "categories");
      if (b.id === "add") return openForm(null);
      if (b.dataset.addSub) return openForm(null, Number(b.dataset.addSub));
      if (b.dataset.edit) return openForm(Number(b.dataset.edit));
      if (b.dataset.del) {
        const c = items.find((x) => x.id === Number(b.dataset.del));
        if (!(await confirmDialog(t("confirmDelete", { name: name(c) })))) return;
        toast(msg(await api(`/categories/${c.id}`, { method: "DELETE" }))); return load();
      }
      if (b.id === "save-order") {
        toast(msg(await api("/categories/reorder", { method: "PUT", body: { items: items.map((c) => ({ id: c.id, parent_id: c.parent_id ?? null, sort_order: c.sort_order })) } })));
        b.hidden = true; load();
      }
    } catch (err) { toast(errMsg(err), "err"); }
  });
  await load();
  void tt;
}
