// Admin toolkit: escaping templates, API client, permissions, toasts, slide-over, confirm dialog,
// schema-driven forms and list tables with loading / empty / error states.
import { t, tt, lang, num } from "./i18n.js";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s));
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => {
    out += Array.isArray(v) ? v.map((x) => (x instanceof Raw ? x.s : esc(x))).join("") : v instanceof Raw ? v.s : v === false || v == null ? "" : esc(v);
    out += strings[i + 1];
  });
  return new Raw(out);
}
export const icon = (n) => raw(`<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`);
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- API ----------
export class ApiErr extends Error {
  constructor(status, data) { super(data?.[lang()] || data?.en || `HTTP ${status}`); this.status = status; this.data = data; }
}
export async function api(path, { method = "GET", body, raw: rawBody, headers } = {}) {
  const res = await fetch(`/api/admin${path}`, {
    method,
    credentials: "same-origin",
    headers: { "x-requested-with": "fetch", ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : rawBody,
  });
  if (res.status === 401 && !path.startsWith("/auth/")) { location.hash = "#/login"; throw new ApiErr(401, {}); }
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("json") ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) throw new ApiErr(res.status, typeof data === "object" ? data : { en: String(data) });
  return data;
}
export const msg = (d) => (d && typeof d === "object" ? d[lang()] ?? d.en : "");
export const errMsg = (e) => (e instanceof ApiErr ? e.message : t("loadError"));

// ---------- Session & permissions ----------
export const session = { admin: null, perms: new Set(), brand: null };
export const can = (p) => session.perms.has(p);

// ---------- Toasts ----------
export function toast(text, kind = "ok") {
  if (!text) return;
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = text;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), kind === "err" ? 6000 : 3200);
}

// ---------- Overlays ----------
function trap(panel, close) {
  const prev = document.activeElement;
  const onKey = (e) => {
    if (e.key === "Escape") close();
    if (e.key !== "Tab") return;
    const f = $$("a[href],button:not([disabled]),input:not([type=hidden]),select,textarea", panel).filter((x) => x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  };
  document.addEventListener("keydown", onKey);
  return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
}

const openPanels = new Set();
/** Closes every open slide-over (called on navigation so panels never linger over another page). */
export function closeOverlays() { for (const close of [...openPanels]) close(); }

/** Right-hand slide-over panel for create/edit/detail views. */
export function slideOver({ title, body, footer, wide = false, autofocus = true }) {
  const scrim = document.createElement("div");
  scrim.className = "overlay-scrim";
  const panel = document.createElement("section");
  panel.className = "slide";
  if (wide) panel.style.width = "min(860px, 100%)";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", title);
  panel.innerHTML = String(html`<header><h2>${title}</h2><button class="icon-btn" type="button" data-close aria-label="${t("close")}">${icon("close")}</button></header><div class="body">${body ?? ""}</div>${footer ? html`<footer>${footer}</footer>` : ""}`);
  let release;
  const close = () => { openPanels.delete(close); release?.(); scrim.remove(); panel.remove(); if (!openPanels.size) document.body.style.overflow = ""; };
  openPanels.add(close);
  scrim.addEventListener("click", close);
  panel.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  $("#overlays").append(scrim, panel);
  document.body.style.overflow = "hidden";
  release = trap(panel, close);
  setTimeout(() => ((autofocus && panel.querySelector("input,select,textarea")) || panel.querySelector("[data-close]"))?.focus(), 30);
  return { panel, close, body: $(".body", panel) };
}

/** Plain-language confirmation. Resolves true/false. */
export function confirmDialog(text, { danger = true, okText } = {}) {
  return new Promise((resolve) => {
    const scrim = document.createElement("div");
    scrim.className = "overlay-scrim";
    const d = document.createElement("div");
    d.className = "dialog";
    d.setAttribute("role", "alertdialog");
    d.setAttribute("aria-modal", "true");
    d.innerHTML = String(html`<header><h2>${danger ? "⚠︎" : "?"}</h2></header><div class="body"><p style="font-size:1.05rem">${text}</p></div>
      <footer><button class="btn" type="button" data-no>${t("cancel")}</button><button class="btn ${danger ? "danger" : "primary"}" type="button" data-yes>${okText ?? t("yes")}</button></footer>`);
    let release;
    const done = (v) => { release?.(); scrim.remove(); d.remove(); resolve(v); };
    scrim.onclick = () => done(false);
    d.querySelector("[data-no]").onclick = () => done(false);
    d.querySelector("[data-yes]").onclick = () => done(true);
    $("#overlays").append(scrim, d);
    release = trap(d, () => done(false));
    d.querySelector("[data-no]").focus();
  });
}

// ---------- Schema-driven forms ----------
/**
 * field: { name, label:{en,bn}, type: text|textarea|number|money|select|checkbox|date|email|password|color|image|document|multiselect|picker|json,
 *          options:[[value,{en,bn}|string, image?, price?]], required, hint:{en,bn}, span:2, placeholder }
 * "picker" is an ordered, searchable multi-select with photos (value: array of ids in the order they were picked).
 */
export function fieldHtml(f, value) {
  const label = tt(f.label) + (f.required ? " *" : "");
  const hint = f.hint ? html`<span class="hint">${tt(f.hint)}</span>` : "";
  const common = raw(`name="${esc(f.name)}" id="f-${esc(f.name)}" ${f.required ? "required" : ""} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""}`);
  const wrap = (inner) => html`<label class="field" style="${f.span === 2 ? "grid-column:1/-1" : ""}"><span>${label}</span>${inner}${hint}</label>`;
  switch (f.type) {
    case "textarea": return wrap(html`<textarea class="input" ${common} rows="${f.rows ?? 4}">${value ?? ""}</textarea>`);
    case "select": return wrap(html`<select class="input" ${common}>${f.allowEmpty ? html`<option value="">—</option>` : ""}${(f.options ?? []).map(([v, l]) => html`<option value="${v}" ${String(value ?? f.default ?? "") === String(v) ? raw("selected") : ""}>${typeof l === "object" ? tt(l) : l}</option>`)}</select>`);
    case "checkbox": return html`<label class="check" style="${f.span === 2 ? "grid-column:1/-1" : ""}"><input type="checkbox" name="${f.name}" ${(value ?? f.default) ? raw("checked") : ""}> ${tt(f.label)}</label>`;
    case "picker": {
      const picked = (value ?? []).map(Number);
      return html`<div class="field" style="grid-column:1/-1"><span>${label}</span>
        <input type="hidden" name="${f.name}" value="${JSON.stringify(picked)}" data-picker="${f.name}">
        <div class="picked" data-picked="${f.name}"></div>
        <input class="input" type="search" data-picker-q="${f.name}" placeholder="${lang() === "bn" ? "নাম দিয়ে খুঁজুন…" : "Search by name…"}" style="min-height:42px;margin-bottom:8px">
        <div class="picker" data-picker-list="${f.name}">${(f.options ?? []).map(([v, l, img, price]) => html`<label data-label="${String(typeof l === "object" ? tt(l) : l).toLowerCase()}"><input type="checkbox" value="${v}" ${picked.includes(Number(v)) ? raw("checked") : ""}>${img ? html`<img src="${img}" alt="" loading="lazy">` : html`<span></span>`}<span>${typeof l === "object" ? tt(l) : l}</span><small class="muted">${price != null ? `৳${price}` : ""}</small></label>`)}</div>${hint}</div>`;
    }
    case "multiselect": return wrap(html`<select class="input" ${common} multiple size="${Math.min(8, (f.options ?? []).length || 3)}">${(f.options ?? []).map(([v, l]) => html`<option value="${v}" ${(value ?? []).map(String).includes(String(v)) ? raw("selected") : ""}>${typeof l === "object" ? tt(l) : l}</option>`)}</select>`);
    case "date": return wrap(html`<input class="input" type="datetime-local" ${common} value="${value ? new Date(value).toISOString().slice(0, 16) : ""}">`);
    case "money": case "number": return wrap(html`<input class="input" type="number" inputmode="numeric" step="1" min="${f.min ?? 0}" ${common} value="${value ?? f.default ?? ""}">`);
    case "image": return wrap(html`<div style="display:flex;gap:10px;align-items:center"><input class="input" ${common} value="${value ?? ""}"><label class="btn sm">${icon("upload")}<input type="file" accept="image/*" data-upload-for="${f.name}" hidden></label></div>`);
    // A certificate or test report (PDF or photo), uploaded as-is; fills a sibling "<name minus _url>_name" field if the form has one.
    case "document": return wrap(html`<div style="display:flex;gap:10px;align-items:center"><input class="input" ${common} value="${value ?? ""}">${value ? html`<a class="btn sm ghost" href="${value}" target="_blank" rel="noopener">${icon("external")}</a>` : ""}<label class="btn sm">${icon("upload")}<input type="file" accept="application/pdf,image/*" data-doc-for="${f.name}" hidden></label></div>`);
    default: return wrap(html`<input class="input" type="${f.type ?? "text"}" ${common} value="${value ?? ""}" ${f.maxlength ? raw(`maxlength="${f.maxlength}"`) : ""} autocomplete="off">`);
  }
}

/** Wires "picker" fields: keeps the hidden JSON value in pick order, numbered chips, and a live search. */
export function bindPickers(root) {
  $$("[data-picker]", root).forEach((hidden) => {
    const name = hidden.dataset.picker;
    const list = root.querySelector(`[data-picker-list="${CSS.escape(name)}"]`);
    const chips = root.querySelector(`[data-picked="${CSS.escape(name)}"]`);
    const labelOf = (id) => list.querySelector(`input[value="${id}"]`)?.closest("label")?.querySelector("span:not(:empty)")?.textContent ?? `#${id}`;
    const draw = () => {
      const ids = JSON.parse(hidden.value || "[]");
      chips.innerHTML = String(html`${ids.map((id, i) => html`<span>${i + 1}. ${labelOf(id)}</span>`)}`);
    };
    list.addEventListener("change", (e) => {
      if (e.target.type !== "checkbox") return;
      const id = Number(e.target.value);
      const ids = JSON.parse(hidden.value || "[]").filter((x) => x !== id);
      if (e.target.checked) ids.push(id);
      hidden.value = JSON.stringify(ids);
      draw();
    });
    root.querySelector(`[data-picker-q="${CSS.escape(name)}"]`)?.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      $$("label", list).forEach((l) => (l.hidden = Boolean(q) && !l.dataset.label.includes(q)));
    });
    draw();
  });
}

export function readForm(form, fields) {
  const out = {};
  for (const f of fields) {
    const el = form.elements[f.name];
    if (!el) continue;
    if (f.type === "checkbox") out[f.name] = el.checked ? 1 : 0;
    else if (f.type === "multiselect") out[f.name] = [...el.selectedOptions].map((o) => Number(o.value));
    else if (f.type === "picker") out[f.name] = JSON.parse(el.value || "[]");
    else if (f.type === "money" || f.type === "number") out[f.name] = el.value === "" ? null : Number(el.value);
    else if (f.type === "date") out[f.name] = el.value ? new Date(el.value).toISOString() : null;
    else if (f.type === "select" && f.numeric) out[f.name] = el.value === "" ? null : Number(el.value);
    else if (f.type === "password") { if (el.value) out[f.name] = el.value; }
    else out[f.name] = el.value.trim();
  }
  return out;
}

export function showErrors(form, e) {
  $$(".field-error", form).forEach((x) => x.remove());
  $$(".invalid", form).forEach((x) => x.classList.remove("invalid"));
  for (const f of e?.data?.fields ?? []) {
    const parts = f.field.split(".");
    const el = form.querySelector(`[name="${CSS.escape(f.field)}"]`) ?? form.querySelector(`[name="${CSS.escape(parts.at(-1))}"]`);
    if (!el) continue;
    el.classList.add("invalid");
    const s = document.createElement("span");
    s.className = "field-error";
    s.textContent = f[lang()] ?? f.en;
    el.closest(".field, .check")?.append(s);
  }
  form.querySelector(".invalid")?.focus();
}

/** Shrinks photos in the browser before upload (max 1600px, WebP) — much faster on mobile data. */
export async function uploadImage(file, folder = "products") {
  let blob = file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale));
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.82 });
  } catch { /* old browser: upload original */ }
  const fd = new FormData();
  fd.append("file", new File([blob], "photo.webp", { type: blob.type || file.type }));
  fd.append("folder", folder);
  return api("/uploads", { method: "POST", raw: fd });
}

export function bindUploads(root) {
  root.addEventListener("change", async (e) => {
    const doc = e.target.closest("[data-doc-for]");
    if (doc?.files?.[0]) {
      const target = root.querySelector(`[name="${CSS.escape(doc.dataset.docFor)}"]`);
      const nameField = root.querySelector(`[name="${CSS.escape(doc.dataset.docFor.replace(/_url$/, "_name"))}"]`);
      try { toast(t("uploading")); const r = await uploadDoc(doc.files[0]); target.value = r.url; if (nameField && !nameField.value) nameField.value = r.name ?? doc.files[0].name; toast(t("saved")); }
      catch (err) { toast(errMsg(err), "err"); }
      return;
    }
    const input = e.target.closest("[data-upload-for]");
    if (!input?.files?.[0]) return;
    const target = root.querySelector(`[name="${CSS.escape(input.dataset.uploadFor)}"]`);
    try { toast(t("uploading")); const r = await uploadImage(input.files[0], "banners"); target.value = r.url; toast(t("saved")); }
    catch (err) { toast(errMsg(err), "err"); }
  });
}

// ---------- Lists ----------
export const skeleton = (n = 6) => raw(Array.from({ length: n }, () => '<div class="skel"></div>').join(""));
export const emptyState = (title = t("noItems"), sub = t("noItemsSub")) => html`<div class="state"><div class="big">${icon("categories")}</div><b>${title}</b><p>${sub}</p></div>`;
export const errorState = (m) => html`<div class="state"><p class="error-box">${m}</p><button class="btn" type="button" data-retry>${t("retry")}</button></div>`;

/**
 * Renders a list table with toolbar, loading/empty/error states and pagination.
 * columns: [{ label:{en,bn}, render(row) → Raw|string, cls }]
 */
export function listTable(el, { columns, rowAttrs = () => "", actions, emptyTitle }) {
  return {
    loading() { el.innerHTML = String(skeleton()); },
    error(e, retry) { el.innerHTML = String(errorState(errMsg(e))); el.querySelector("[data-retry]")?.addEventListener("click", retry); },
    render(res, { onPage } = {}) {
      if (!res.items.length) { el.innerHTML = String(emptyState(emptyTitle)); return; }
      el.innerHTML = String(html`<table class="table"><thead><tr>${columns.map((c) => html`<th>${tt(c.label)}</th>`)}${actions ? html`<th class="actions">${t("actions")}</th>` : ""}</tr></thead>
        <tbody>${res.items.map((r) => html`<tr ${raw(rowAttrs(r))}>${columns.map((c) => html`<td data-label="${tt(c.label)}" class="${c.cls ?? ""}">${c.render(r)}</td>`)}${actions ? html`<td class="actions">${actions(r)}</td>` : ""}</tr>`)}</tbody></table>
        ${res.pages > 1 ? html`<div class="pager"><button class="btn sm" data-page="${res.page - 1}" ${res.page <= 1 ? raw("disabled") : ""}>${t("prev")}</button><span class="muted">${t("pageOf", { p: num(res.page), n: num(res.pages) })}</span><button class="btn sm" data-page="${res.page + 1}" ${res.page >= res.pages ? raw("disabled") : ""}>${t("next")}</button></div>` : ""}`);
      $$("[data-page]", el).forEach((b) => b.addEventListener("click", () => onPage?.(Number(b.dataset.page))));
    },
  };
}

export const pill = (status, label) => html`<span class="pill ${status}">${label ?? status}</span>`;
export const debounce = (fn, ms = 300) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };
export function downloadBlob(text, filename, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Certificate documents (PDF or photo) upload as-is — no resizing, so the original stays legible. */
export async function uploadDoc(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", "certificates");
  return api("/uploads", { method: "POST", raw: fd });
}

/** Downloads a CSV export from any list endpoint (same filters as on screen, plus format=csv). */
export async function exportCsv(path, filename) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`/api/admin${path}${sep}format=csv`, { credentials: "same-origin", headers: { "x-requested-with": "fetch" } });
  if (!res.ok) throw new ApiErr(res.status, await res.json().catch(() => ({})));
  downloadBlob(await res.text(), `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
}

/** 🟢 Trusted / 🟡 New / 🔴 Verify before shipping — with the one-line reason on hover/tap. */
export const riskBadge = (level, badge, reason) =>
  html`<span class="risk ${level}" title="${reason ? tt(reason) : ""}" tabindex="0">${badge?.emoji ?? ""} ${badge ? tt(badge) : level}</span>`;
