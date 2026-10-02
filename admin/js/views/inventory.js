// Inventory: every option (SKU) with its stock and logged serial numbers, quick +/− adjustments, bulk stock update,
// CSV export, the adjustment log and back-in-stock requests. The Lots tab receives stock by lot / supplier invoice
// (cost price, optional expiry for dated items such as batteries — oldest lot ships first) and writes off damaged units;
// the Serials tab logs serial numbers (optional — for high-value items), which are picked when an order is packed,
// printed on the invoice and checked when a warranty claim comes in.
import { t, num, dt, lang } from "../i18n.js";
import { html, raw, icon, api, $, $$, can, toast, msg, errMsg, listTable, pill, debounce, exportCsv, slideOver, showErrors } from "../core.js";

export default async function inventory(view, { query }) {
  if (query.get("tab") === "batches") return batches(view, query);
  if (query.get("tab") === "serials") return serials(view, query);
  const state = { q: query.get("q") ?? "", stock: query.get("stock") ?? "", page: 1 };
  const pending = new Map(); // variantId → new stock (bulk edit)
  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("inventory")}</h1><a class="btn" href="#/inventory?tab=batches">${icon("box")} ${t("batches")}</a><a class="btn" href="#/inventory?tab=serials">${icon("chip")} ${t("serials")}</a><button class="btn" id="csv">${icon("download")} ${t("exportCsv")}</button><button class="btn" id="csv-log">${icon("download")} ${t("stockLog")}</button>${can("inventory.adjust") ? html`<button class="btn primary" id="bulk-save" hidden>${t("save")} (<span id="bulk-n">0</span>)</button>` : ""}</div>
    <div class="card"><div class="toolbar">
      <input class="input" id="iq" type="search" value="${state.q}" placeholder="${t("searchPlaceholder")}" aria-label="${t("searchPlaceholder")}">
      <div class="chips">${[["", t("all")], ["low", t("lowOnly")], ["out", t("outOnly")], ["unserialised", t("unserialised")], ["expiring", t("expiringSoon")]].map(([v, l]) => html`<button class="chip" data-stock="${v}" aria-pressed="${state.stock === v}">${l}</button>`)}</div>
      <select class="input" id="reason" aria-label="${t("reason")}" style="flex:0 1 220px"><option value="restock">${t("restock")}</option><option value="adjustment">${t("adjustment")}</option><option value="return">${t("returnR")}</option><option value="expired">${t("expired")}</option></select>
    </div><div id="list"></div></div>
    <div class="card"><h2>${t("stockLog")}</h2><div id="log"></div></div>
    <div class="card"><h2>🔔 ${t("backInStock")}</h2><div id="waiting"></div></div>`);

  const table = listTable($("#list", view), {
    columns: [
      { label: { en: "Product", bn: "পণ্য" }, render: (v) => html`<b>${lang() === "bn" ? v.name_bn : v.name_en}</b><br><span class="muted small mono">${v.sku}</span>${v.status !== "active" ? html` ${pill(v.status)}` : ""}` },
      { label: { en: "Option", bn: "অপশন" }, render: (v) => html`${v.size}${v.color ? ` · ${v.color}` : ""}` },
      { label: { en: "Serials / lots", bn: "সিরিয়াল / লট" }, render: (v) => html`${v.serials_in_stock ? html`<span class="mono small">${icon("chip")} ${num(v.serials_in_stock)}/${num(v.stock)}</span>` : html`<span class="muted small">—</span>`}${v.next_expiry ? html`<br>${expiryCell(v.next_expiry, v.batched, v.stock)}` : ""}` },
      { label: { en: "Stock", bn: "স্টক" }, render: (v) => (v.stock === 0 ? pill("cancelled", "0") : v.stock <= v.low_stock_threshold ? pill("pending", num(v.stock)) : pill("active", num(v.stock))) + (v.waiting ? ` 🔔${num(v.waiting)}` : "") },
      { label: { en: "New stock", bn: "নতুন স্টক" }, render: (v) => (can("inventory.adjust") ? raw(`<input class="input" type="number" min="0" inputmode="numeric" data-set="${v.id}" value="${pending.get(v.id) ?? ""}" placeholder="${v.stock}" style="max-width:110px;min-height:40px">`) : "—") },
    ],
    actions: (v) => (can("inventory.adjust") ? html`<button class="btn sm" data-add="${v.id}" data-n="-1" aria-label="-1">−1</button> <button class="btn sm" data-add="${v.id}" data-n="1" aria-label="+1">+1</button> <button class="btn sm" data-add="${v.id}" data-n="5">+5</button>` : ""),
  });
  const load = async () => {
    table.loading();
    const qs = new URLSearchParams(Object.entries({ ...state, limit: "30" }).filter(([, v]) => v !== ""));
    try { table.render(await api(`/inventory?${qs}`), { onPage: (p) => { state.page = p; load(); } }); } catch (e) { table.error(e, load); }
  };
  const loadLog = async () => {
    try {
      const r = await api("/inventory/log?limit=15");
      if (!r.items.length) { $("#log", view).innerHTML = String(html`<p class="muted">${t("noItems")}</p>`); return; }
      $("#log", view).innerHTML = String(html`<table class="table"><thead><tr><th>${t("date")}</th><th>${t("products")}</th><th>±</th><th>${lang() === "bn" ? "পরে" : "After"}</th><th>${t("reason")}</th><th>${lang() === "bn" ? "কে" : "By"}</th></tr></thead><tbody>${r.items.map((l) => html`<tr><td data-label="${t("date")}">${dt(l.created_at, true)}</td><td data-label="${t("products")}">${l.name_en ?? "—"} <span class="muted small">${l.sku ?? ""} ${l.size ?? ""}</span></td><td data-label="±"><b style="color:${l.change < 0 ? "var(--bad)" : "var(--ok)"}">${l.change > 0 ? "+" : ""}${num(l.change)}</b></td><td data-label="${lang() === "bn" ? "পরে" : "After"}">${num(l.stock_after)}</td><td data-label="${t("reason")}">${l.reason}${l.note ? html` · <span class="muted small">${l.note}</span>` : ""}</td><td data-label="${lang() === "bn" ? "কে" : "By"}">${l.actor}</td></tr>`)}</tbody></table>`);
    } catch { $("#log", view).innerHTML = ""; }
  };
  const loadWaiting = async () => {
    try {
      const r = await api("/stock-notify");
      const open = r.items.filter((x) => !x.notified_at);
      $("#waiting", view).innerHTML = open.length ? String(html`<table class="table"><thead><tr><th>${t("date")}</th><th>${t("products")}</th><th>${t("phone")}</th><th>${lang() === "bn" ? "এখন স্টক" : "Stock now"}</th></tr></thead><tbody>${open.slice(0, 50).map((x) => html`<tr><td data-label="${t("date")}">${dt(x.created_at)}</td><td data-label="${t("products")}"><a href="#/products/${x.product_id}">${lang() === "bn" ? x.name_bn : x.name_en}</a> <span class="muted small">${x.sku ?? ""} ${x.size ?? ""}</span></td><td data-label="${t("phone")}">${x.phone ?? x.email ?? ""}</td><td data-label="${lang() === "bn" ? "এখন স্টক" : "Stock now"}">${x.stock > 0 ? pill("active", num(x.stock)) : pill("cancelled", "0")}</td></tr>`)}</tbody></table>`) : String(html`<p class="muted">${t("noItems")}</p>`);
    } catch { $("#waiting", view).innerHTML = ""; }
  };
  const adjust = async (items) => {
    try { toast(msg(await api("/inventory/adjust", { method: "POST", body: { items } }))); pending.clear(); syncBulk(); load(); loadLog(); }
    catch (err) { toast(errMsg(err), "err"); }
  };
  const syncBulk = () => { const b = $("#bulk-save", view); if (b) { b.hidden = pending.size === 0; $("#bulk-n", view).textContent = num(pending.size); } };

  view.addEventListener("click", (e) => {
    const s = e.target.closest("[data-stock]");
    if (s) { state.stock = s.dataset.stock; state.page = 1; $$("[data-stock]", view).forEach((b) => b.setAttribute("aria-pressed", String(b === s))); return load(); }
    const a = e.target.closest("[data-add]");
    if (a) { const n = Number(a.dataset.n); return adjust([{ variantId: Number(a.dataset.add), mode: n < 0 ? "remove" : "add", quantity: Math.abs(n), reason: $("#reason", view).value }]); }
    if (e.target.closest("#bulk-save")) adjust([...pending].map(([variantId, q]) => ({ variantId, mode: "set", quantity: q, reason: $("#reason", view).value })));
  });
  view.addEventListener("input", (e) => {
    const inp = e.target.closest("[data-set]");
    if (!inp) return;
    inp.value === "" ? pending.delete(Number(inp.dataset.set)) : pending.set(Number(inp.dataset.set), Math.max(0, Number(inp.value)));
    syncBulk();
  });
  $("#iq", view).addEventListener("input", debounce((e) => { state.q = e.target.value.trim(); state.page = 1; load(); }));
  $("#csv", view).onclick = async () => { try { await exportCsv(`/inventory?${new URLSearchParams(Object.entries(state).filter(([k, v]) => v !== "" && k !== "page"))}`, "inventory"); } catch (err) { toast(errMsg(err), "err"); } };
  $("#csv-log", view).onclick = async () => { try { await exportCsv("/inventory/log", "stock-log"); } catch (err) { toast(errMsg(err), "err"); } };
  await Promise.all([load(), loadLog(), loadWaiting()]);
}

const today = () => new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
const daysTo = (d) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86400_000);
function expiryCell(d, batched, stock) {
  if (!d) return "";
  const n = daysTo(d);
  const cls = n < 0 ? "exp-gone" : n <= 60 ? "exp-soon" : "";
  return html`<span class="${cls}">${dt(d)}</span><br><span class="muted small">${n < 0 ? t("expired") : `${num(n)} ${t("daysLeft")}`}${batched !== stock ? ` · ${num(batched)} ${lang() === "bn" ? "লটে" : "in lots"}` : ""}</span>`;
}

/** Stock lots: receive stock by lot (optionally with its serial numbers), see dated lots, write off damaged units. */
async function batches(view, query) {
  const L = (en, bn) => (lang() === "bn" ? bn : en);
  const state = { status: query.get("status") ?? "", q: query.get("q") ?? "", page: 1 };
  const canAdjust = can("inventory.adjust");
  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("batches")}</h1><a class="btn" href="#/inventory">${icon("inventory")} ${t("inventory")}</a><button class="btn" id="csv">${icon("download")} ${t("exportCsv")}</button>${canAdjust ? html`<button class="btn primary" id="receive">${icon("plus")} ${t("receiveBatch")}</button>` : ""}</div>
    <p class="muted">${t("fefoNote")}</p>
    <div class="card"><div class="toolbar">
      <input class="input" id="bq" type="search" value="${state.q}" placeholder="${L("Lot no., SKU or product…", "লট নং, SKU বা পণ্য…")}" aria-label="${t("searchPlaceholder")}">
      <div class="chips">${[["", L("In stock", "স্টকে আছে")], ["expiring", t("expiringSoon")], ["expired", t("expired")], ["history", L("All incl. used up", "শেষ হওয়াসহ সব")]].map(([v, l]) => html`<button class="chip" data-st="${v}" aria-pressed="${state.status === v}">${l}</button>`)}</div>
    </div><div id="list"></div></div>`);
  let rows = [];
  const table = listTable($("#list", view), {
    columns: [
      { label: { en: "Product", bn: "পণ্য" }, render: (b) => html`<a href="#/products/${b.product_id}"><b>${lang() === "bn" ? b.name_bn : b.name_en}</b></a><br><span class="muted small mono">${b.sku}</span> <span class="muted small">· ${b.size}</span>` },
      { label: { en: "Lot", bn: "লট" }, render: (b) => html`<b class="mono">${b.batch_no}</b>${b.supplier ? html`<br><span class="muted small">${b.supplier}</span>` : ""}` },
      { label: { en: "Expiry", bn: "মেয়াদ" }, render: (b) => html`${b.expiry_state === "none" ? html`<span class="muted small">${L("No expiry", "মেয়াদ নেই")}</span>` : html`${dt(b.expiry_date)} ${pill(b.expiry_state, b.expiry_state === "expired" ? t("expired") : b.expiry_state === "soon" ? `${num(b.days_left)} ${t("daysLeft")}` : "OK")}`}${b.manufactured_on ? html`<br><span class="muted small">${t("mfgDate")}: ${dt(b.manufactured_on)}</span>` : ""}` },
      { label: { en: "Left / received", bn: "বাকি / গ্রহণ" }, render: (b) => html`<b>${num(b.qty_remaining)}</b> / ${num(b.qty_received)}${b.cost_price != null ? html`<br><span class="muted small">${t("costPrice")}: ${num(b.cost_price)}</span>` : ""}` },
      { label: { en: "Received", bn: "গ্রহণের তারিখ" }, render: (b) => html`${dt(b.received_at)}${b.received_by ? html`<br><span class="muted small">${b.received_by}</span>` : ""}` },
    ],
    actions: (b) => (canAdjust && b.qty_remaining > 0 ? html`<button class="btn sm" data-wo="${b.id}">${t("writeOff")}</button>` : ""),
  });
  const qs = (x = {}) => new URLSearchParams(Object.entries({ ...state, ...x }).filter(([, v]) => v !== ""));
  async function load() {
    table.loading();
    try { const r = await api(`/inventory/batches?${qs({ limit: "40" })}`); rows = r.items; table.render(r, { onPage: (p) => { state.page = p; load(); } }); }
    catch (e) { table.error(e, load); }
  }

  async function receive() {
    let variants = [];
    try { variants = (await api("/inventory?limit=200")).items; } catch (e) { return toast(errMsg(e), "err"); }
    const { panel, close } = slideOver({
      title: t("receiveBatch"),
      body: html`<form id="rbf" novalidate>
        <label class="field"><span>${L("Product option (SKU)", "পণ্যের অপশন (SKU)")} *</span><select class="input" name="variantId" required><option value="">—</option>${variants.map((v) => html`<option value="${v.id}">${lang() === "bn" ? v.name_bn : v.name_en} · ${v.size} (${v.sku})</option>`)}</select></label>
        <div class="grid2"><label class="field"><span>${t("batchNo")} *</span><input class="input" name="batch_no" maxlength="40" required autocapitalize="characters"></label>
        <label class="field"><span>${t("qtyReceived")} *</span><input class="input" name="quantity" type="number" min="1" inputmode="numeric" required></label>
        <label class="field"><span>${t("mfgDate")}</span><input class="input" name="manufactured_on" type="date"></label>
        <label class="field"><span>${t("expiry")}</span><input class="input" name="expiry_date" type="date" min="${today()}"></label>
        <label class="field"><span>${t("supplier")}</span><input class="input" name="supplier" maxlength="120"></label>
        <label class="field"><span>${t("costPrice")}</span><input class="input" name="cost_price" type="number" min="0" inputmode="numeric"></label></div>
        <label class="field"><span>${t("note")}</span><input class="input" name="note" maxlength="300"></label>
        <label class="field"><span>${t("logSerials")} <small class="muted">(${L("optional", "ঐচ্ছিক")})</small></span><textarea class="input mono" name="serials" rows="4" placeholder="SN8F2K1001&#10;SN8F2K1002"></textarea><span class="hint">${t("serialsHelp")}</span></label>
        <p class="muted small">${L("Use the supplier's invoice or lot number. Leave the expiry empty unless the item is dated (e.g. batteries). The quantity is added to stock.", "সাপ্লায়ারের ইনভয়েস বা লট নম্বর দিন। মেয়াদ খালি রাখুন, যদি না পণ্যে তারিখ থাকে (যেমন ব্যাটারি)। পরিমাণটি স্টকে যোগ হবে।")}</p></form>`,
      footer: html`<button class="btn" data-close>${t("cancel")}</button><button class="btn primary" type="submit" form="rbf">${t("save")}</button>`,
    });
    $("#rbf", panel).addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const { serials: sn, ...body } = Object.fromEntries(new FormData(ev.target));
      try {
        toast(msg(await api("/inventory/batches", { method: "POST", body })));
        close(); load();
        if (String(sn ?? "").trim()) {
          try { toast(msg(await api("/inventory/serials", { method: "POST", body: { variantId: body.variantId, serials: sn } }))); }
          catch (err) { toast(`${t("serials")}: ${errMsg(err)}`, "err"); }
        }
      } catch (err) { showErrors(ev.target, err); toast(errMsg(err), "err"); }
    });
  }

  function writeOff(b) {
    const { panel, close } = slideOver({
      title: `${t("writeOff")} · ${b.batch_no}`,
      body: html`<form id="wof" novalidate><p class="muted">${lang() === "bn" ? b.name_bn : b.name_en} · ${b.size} · ${t("qtyLeft")} ${num(b.qty_remaining)}</p>
        <label class="field"><span>${L("Quantity", "পরিমাণ")} *</span><input class="input" name="quantity" type="number" min="1" max="${b.qty_remaining}" value="${b.expiry_state === "expired" ? b.qty_remaining : 1}" required></label>
        <label class="field"><span>${t("writeOffWhy")} *</span><input class="input" name="note" maxlength="300" value="${b.expiry_state === "expired" ? L("Expired", "মেয়াদোত্তীর্ণ") : ""}" required></label>
        <p class="muted small">${L("These units are removed from stock and from this batch.", "এই ইউনিটগুলো স্টক ও এই ব্যাচ থেকে বাদ যাবে।")}</p></form>`,
      footer: html`<button class="btn" data-close>${t("cancel")}</button><button class="btn danger" type="submit" form="wof">${t("writeOff")}</button>`,
    });
    $("#wof", panel).addEventListener("submit", async (ev) => {
      ev.preventDefault();
      try { toast(msg(await api(`/inventory/batches/${b.id}/write-off`, { method: "POST", body: Object.fromEntries(new FormData(ev.target)) }))); close(); load(); }
      catch (err) { showErrors(ev.target, err); toast(errMsg(err), "err"); }
    });
  }

  view.addEventListener("click", (e) => {
    const st = e.target.closest("[data-st]");
    if (st) { state.status = st.dataset.st; state.page = 1; $$("[data-st]", view).forEach((x) => x.setAttribute("aria-pressed", String(x === st))); return load(); }
    const wo = e.target.closest("[data-wo]");
    if (wo) writeOff(rows.find((x) => x.id === Number(wo.dataset.wo)));
  });
  $("#receive", view)?.addEventListener("click", receive);
  $("#bq", view).addEventListener("input", debounce((e) => { state.q = e.target.value.trim(); state.page = 1; load(); }));
  $("#csv", view).onclick = async () => { try { await exportCsv(`/inventory/batches?${qs({ page: "" })}`, "batches"); } catch (err) { toast(errMsg(err), "err"); } };
  await load();
}

/** Serial numbers: log the serials of units on the shelf, search by serial / order, mark a unit faulty. */
async function serials(view, query) {
  const L = (en, bn) => (lang() === "bn" ? bn : en);
  const state = { status: query.get("status") ?? "", q: query.get("q") ?? "", page: 1 };
  const canAdjust = can("inventory.adjust");
  const ST = { in_stock: [L("On the shelf", "স্টকে"), "active"], sold: [L("Sold", "বিক্রি"), "shipped"], returned: [L("Returned", "ফেরত"), "pending"], faulty: [L("Faulty", "ত্রুটিপূর্ণ"), "cancelled"] };
  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("serials")}</h1><a class="btn" href="#/inventory">${icon("inventory")} ${t("inventory")}</a><button class="btn" id="csv">${icon("download")} ${t("exportCsv")}</button>${canAdjust ? html`<button class="btn primary" id="log">${icon("plus")} ${t("logSerials")}</button>` : ""}</div>
    <p class="muted">${t("serialsHelp")}</p>
    <div class="card"><div class="toolbar">
      <input class="input mono" id="sq" type="search" value="${state.q}" placeholder="${L("Serial, SKU, product or order no.…", "সিরিয়াল, SKU, পণ্য বা অর্ডার নং…")}" aria-label="${t("searchPlaceholder")}">
      <div class="chips">${[["", t("all")], ...Object.entries(ST).map(([k, [l]]) => [k, l])].map(([v, l]) => html`<button class="chip" data-st="${v}" aria-pressed="${state.status === v}">${l}</button>`)}</div>
    </div><div id="list"></div></div>`);
  let rows = [];
  const table = listTable($("#list", view), {
    columns: [
      { label: { en: "Serial", bn: "সিরিয়াল" }, render: (x) => html`<b class="mono">${x.serial}</b>${x.note ? html`<br><span class="muted small">${x.note}</span>` : ""}` },
      { label: { en: "Product", bn: "পণ্য" }, render: (x) => html`${lang() === "bn" ? x.name_bn : x.name_en}<br><span class="muted small mono">${x.sku}</span>` },
      { label: { en: "Status", bn: "অবস্থা" }, render: (x) => pill(ST[x.status]?.[1] ?? "inactive", ST[x.status]?.[0] ?? x.status) },
      { label: { en: "Order", bn: "অর্ডার" }, render: (x) => (x.order_no ? html`<b class="mono">${x.order_no}</b><br><span class="muted small">${x.customer_name ?? ""}</span>` : "—") },
      { label: { en: "Logged", bn: "যোগের তারিখ" }, render: (x) => dt(x.received_at ?? x.created_at) },
    ],
    actions: (x) => (canAdjust && x.status === "in_stock" ? html`<button class="btn sm" data-faulty="${x.id}">${L("Mark faulty", "ত্রুটিপূর্ণ")}</button>` : canAdjust && x.status === "faulty" ? html`<button class="btn sm" data-ok="${x.id}">${L("Back on shelf", "আবার স্টকে")}</button>` : ""),
  });
  const qs = (x = {}) => new URLSearchParams(Object.entries({ ...state, ...x }).filter(([, v]) => v !== ""));
  async function load() {
    table.loading();
    try { const r = await api(`/inventory/serials?${qs({ limit: "50" })}`); rows = r.items; table.render(r, { onPage: (p) => { state.page = p; load(); } }); }
    catch (e) { table.error(e, load); }
  }
  async function logForm() {
    let variants = [];
    try { variants = (await api("/inventory?limit=200")).items; } catch (e) { return toast(errMsg(e), "err"); }
    const { panel, close } = slideOver({
      title: t("logSerials"),
      body: html`<form id="slf" novalidate>
        <label class="field"><span>${L("Product option (SKU)", "পণ্যের অপশন (SKU)")} *</span><select class="input" name="variantId" required><option value="">—</option>${variants.filter((v) => v.stock > v.serials_in_stock).map((v) => html`<option value="${v.id}">${lang() === "bn" ? v.name_bn : v.name_en} · ${v.size}${v.color ? ` · ${v.color}` : ""} (${v.sku}) — ${num(v.stock - v.serials_in_stock)} ${L("without serial", "সিরিয়াল ছাড়া")}</option>`)}</select></label>
        <label class="field"><span>${t("serials")} *</span><textarea class="input mono" name="serials" rows="8" required placeholder="SN8F2K1001&#10;SN8F2K1002"></textarea><span class="hint">${t("serialsHelp")}</span></label>
        <label class="field"><span>${t("note")}</span><input class="input" name="note" maxlength="200"></label></form>`,
      footer: html`<button class="btn" data-close>${t("cancel")}</button><button class="btn primary" type="submit" form="slf">${t("save")}</button>`,
    });
    $("#slf", panel).addEventListener("submit", async (ev) => {
      ev.preventDefault();
      try { toast(msg(await api("/inventory/serials", { method: "POST", body: Object.fromEntries(new FormData(ev.target)) }))); close(); load(); }
      catch (err) { showErrors(ev.target, err); toast(errMsg(err), "err"); }
    });
  }
  view.addEventListener("click", async (e) => {
    const st = e.target.closest("[data-st]");
    if (st) { state.status = st.dataset.st; state.page = 1; $$("[data-st]", view).forEach((x) => x.setAttribute("aria-pressed", String(x === st))); return load(); }
    const b = e.target.closest("[data-faulty],[data-ok]");
    if (!b) return;
    const row = rows.find((x) => x.id === Number(b.dataset.faulty ?? b.dataset.ok));
    if (!row) return;
    try { toast(msg(await api(`/inventory/serials/${row.id}`, { method: "PUT", body: { status: b.dataset.faulty ? "faulty" : "in_stock" } }))); load(); }
    catch (err) { toast(errMsg(err), "err"); }
  });
  $("#log", view)?.addEventListener("click", logForm);
  $("#sq", view).addEventListener("input", debounce((e) => { state.q = e.target.value.trim(); state.page = 1; load(); }));
  $("#csv", view).onclick = async () => { try { await exportCsv(`/inventory/serials?${qs({ page: "" })}`, "serials"); } catch (err) { toast(errMsg(err), "err"); } };
  await load();
}
