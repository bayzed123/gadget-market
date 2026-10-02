// Dashboard home: first-run checklist, Health Check strip, "Needs your attention today" with one-tap
// call / WhatsApp (plus warranty claims and unanswered product questions), KPIs (today's orders and sales, cash still to
// collect, low stock, open warranty claims, combos sold), monthly sales chart, recent orders and top sellers.
import { t, num, money, dt, lang, tt } from "../i18n.js";
import { html, icon, api, pill, errorState, skeleton, errMsg, riskBadge, toast, msg, can, session } from "../core.js";

let chartLib;
const loadChart = () =>
  (chartLib ??= new Promise((res, rej) => {
    if (window.Chart) return res(window.Chart);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js";
    s.onload = () => res(window.Chart);
    s.onerror = rej;
    document.head.append(s);
  }));

const CLAIM_LABEL = { submitted: { en: "New", bn: "নতুন" }, under_review: { en: "Checking", bn: "যাচাই চলছে" }, approved: { en: "Approved — to resolve", bn: "অনুমোদিত — সমাধান বাকি" } };
const RB = { low: { emoji: "🟢", en: "Trusted", bn: "বিশ্বস্ত" }, medium: { emoji: "🟡", en: "New", bn: "নতুন" }, high: { emoji: "🔴", en: "Verify", bn: "যাচাই" } };
const wa = (phone, text) => `https://wa.me/${String(phone).replace(/\D/g, "").replace(/^0/, "880")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export default async function dashboard(view) {
  view.innerHTML = String(html`<div class="page-head"><h1>${t("dashboard")}</h1></div><div class="kpis">${skeleton(6)}</div>`);
  let d, att, health, ob;
  try {
    [d, att, health, ob] = await Promise.all([api("/dashboard"), api("/attention"), api("/health"), api("/onboarding")]);
  } catch (e) {
    view.innerHTML = String(errorState(errMsg(e)));
    view.querySelector("[data-retry]").onclick = () => dashboard(view);
    return;
  }
  const k = d.kpis;
  const delta = (c, label) => html`<span class="delta ${c >= 0 ? "up" : "down"}">${c >= 0 ? "▲" : "▼"} ${num(Math.abs(c))}% ${label}</span>`;
  const hour = new Date().getHours();
  const hi = lang() === "bn" ? (hour < 12 ? "শুভ সকাল" : "শুভেচ্ছা") : hour < 12 ? "Good morning" : "Hello";
  const store = session.brand?.name[lang()] ?? session.brand?.name.en ?? "";

  const kpi = (href, c, ico, label, value, extra) => html`<a class="card kpi" href="${href}" style="--c:var(${c});text-decoration:none;color:inherit"><div class="ico">${icon(ico)}</div><div class="label">${label}</div><div class="value">${value}</div>${extra}</a>`;

  // ---- attention list ----
  const calls = att.confirmationCalls;
  const sections = [
    calls.length && html`<div class="att-group"><h3>${icon("phone")} ${t("callsToMake")} <span class="n">${num(calls.length)}</span></h3>
      ${calls.slice(0, 8).map((o) => html`<div class="att-row">
        <a href="#/orders/${o.id}" class="att-main"><b>${o.order_no}</b> · ${o.customer_name} · ${money(o.total)}<br><span class="muted small">${dt(o.created_at, true)} · ${num(o.attempts)} ${lang() === "bn" ? "বার কল" : "call(s)"} · ${o.otp_verified ? `✓ ${t("verifiedNumber")}` : t("notVerified")}</span></a>
        ${riskBadge(o.risk_level, RB[o.risk_level])}
        <span class="one-tap"><a class="btn sm call" href="tel:${o.customer_phone}" aria-label="${t("call")} ${o.customer_name}">${icon("phone")}<span class="hide-narrow">${t("call")}</span></a>
        <a class="btn sm wa" target="_blank" rel="noopener" href="${wa(o.customer_phone, lang() === "bn" ? `আসসালামু আলাইকুম ${o.customer_name}, ${store} থেকে বলছি। আপনার অর্ডার ${o.order_no} (৳${o.total}) কনফার্ম করতে চাই।` : `Hello ${o.customer_name}, this is ${store}. We'd like to confirm your order ${o.order_no} (Tk ${o.total}).`)}" aria-label="WhatsApp ${o.customer_name}">${icon("whatsapp")}</a></span>
      </div>`)}
      ${calls.length > 8 ? html`<a class="btn sm ghost" href="#/orders?status=needs_call">${t("viewAll")} (${num(calls.length)})</a>` : ""}</div>`,
    att.paymentsToVerify.length && html`<div class="att-group"><h3>${icon("money")} ${t("paymentsToVerify")} <span class="n">${num(att.paymentsToVerify.length)}</span></h3>
      ${att.paymentsToVerify.map((o) => html`<a class="att-row" href="#/orders/${o.id}"><span class="att-main"><b>${o.order_no}</b> · ${o.customer_name}<br><span class="muted small">${o.payment_method} · TrxID ${o.payment_ref} · ${money(o.total)}</span></span></a>`)}</div>`,
    att.abandoned.length && html`<div class="att-group"><h3>${icon("cart-off")} ${t("abandonedToFollow")} <span class="n">${num(att.abandoned.length)}</span></h3>
      ${att.abandoned.slice(0, 6).map((a) => html`<div class="att-row"><a class="att-main" href="#/abandoned"><b>${a.name || a.phone}</b> · ${money(a.cart_total)}<br><span class="muted small">${t("lastStep")}: ${t(`step_${a.last_step}`)} · ${dt(a.updated_at, true)}</span></a>
        <span class="one-tap"><a class="btn sm call" href="tel:${a.phone}">${icon("phone")}</a><a class="btn sm wa" target="_blank" rel="noopener" href="${wa(a.phone)}">${icon("whatsapp")}</a></span></div>`)}</div>`,
    att.warrantyClaims?.length && html`<div class="att-group"><h3>${icon("wrench")} ${t("claimsToReview")} <span class="n">${num(att.warrantyClaims.length)}</span></h3>
      ${att.warrantyClaims.slice(0, 6).map((w) => html`<a class="att-row" href="#/warranty/${w.id}"><span class="att-main"><b class="mono">${w.claim_no}</b> · ${w.customer_name ?? ""}<br><span class="muted small">${w.product ?? ""} · ${w.order_no ?? ""} · ${dt(w.created_at)}</span></span>${pill(w.status === "submitted" ? "pending" : w.status === "approved" ? "active" : "confirmed", tt(CLAIM_LABEL[w.status]))}</a>`)}
      ${att.warrantyClaims.length > 6 ? html`<a class="btn sm ghost" href="#/warranty">${t("viewAll")} (${num(att.warrantyClaims.length)})</a>` : ""}</div>`,
    att.questions?.length && html`<div class="att-group"><h3>${icon("question")} ${t("questionsToAnswer")} <span class="n">${num(att.questions.length)}</span></h3>
      ${att.questions.slice(0, 5).map((q) => html`<a class="att-row" href="#/questions"><span class="att-main"><b>${q.product}</b><br><span class="muted small">“${q.question.slice(0, 120)}” — ${q.name}</span></span></a>`)}</div>`,
    att.returnRequests.length && html`<div class="att-group"><h3>${icon("return")} ${t("returnRequests")} <span class="n">${num(att.returnRequests.length)}</span></h3>
      ${att.returnRequests.map((r) => html`<a class="att-row" href="#/returns"><span class="att-main"><b>${r.order_no}</b> · ${r.customer_name}<br><span class="muted small">${r.reason.replace(/_/g, " ")} · ${dt(r.created_at)}</span></span></a>`)}</div>`,
    att.backInStock.length && html`<div class="att-group"><h3>${icon("sparkle")} ${t("backInStock")} <span class="n">${num(att.backInStock.length)}</span></h3>
      ${att.backInStock.map((p) => html`<div class="att-row"><a class="att-main" href="#/products/${p.id}"><b>${lang() === "bn" ? p.name_bn : p.name_en}</b><br><span class="muted small">${num(p.n)} ${t("waiting")}</span></a>
        ${can("products.write") ? html`<button class="btn sm primary" data-notify="${p.id}">${t("notifyWaiting", { n: num(p.n) })}</button>` : ""}</div>`)}</div>`,
    att.expiringBatches?.length && html`<div class="att-group"><h3>${icon("hourglass")} ${t("expiringToSell")} <span class="n">${num(att.expiringBatches.length)}</span></h3>
      ${att.expiringBatches.slice(0, 6).map((b) => html`<a class="att-row" href="#/inventory?tab=batches&q=${encodeURIComponent(b.batch_no)}"><span class="att-main"><b>${lang() === "bn" ? b.name_bn : b.name_en}</b> · ${b.size}<br><span class="muted small">${t("batchNo")} ${b.batch_no} · ${t("expiry")} ${dt(b.expiry_date)}</span></span><span class="pill ${b.expiry_date < new Date().toISOString().slice(0, 10) ? "expired" : "soon"}">${num(b.qty_remaining)}</span></a>`)}</div>`,
    att.lowStock.length && html`<div class="att-group"><h3>${icon("alert")} ${t("lowStock")} <span class="n">${num(att.lowStock.length)}</span></h3>
      ${att.lowStock.slice(0, 6).map((v) => html`<a class="att-row" href="#/inventory?q=${encodeURIComponent(v.sku)}"><span class="att-main"><b>${lang() === "bn" ? v.name_bn : v.name_en}</b> · ${v.size}<br><span class="muted small">SKU ${v.sku}</span></span><span class="pill ${v.stock === 0 ? "cancelled" : "pending"}">${num(v.stock)}</span></a>`)}</div>`,
    att.pendingReviews.length && html`<div class="att-group"><h3>${icon("reviews")} ${t("pendingReviews")} <span class="n">${num(att.pendingReviews.length)}</span></h3>
      ${att.pendingReviews.slice(0, 4).map((r) => html`<a class="att-row" href="#/reviews?status=pending"><span class="att-main"><b>${r.name}</b> · ${"★".repeat(r.rating)}<br><span class="muted small">${r.product}</span></span></a>`)}</div>`,
  ].filter(Boolean);

  const steps = ob.steps;
  const showSetup = !ob.dismissed && !ob.complete;

  view.innerHTML = String(html`
    <div class="page-head"><h1>${hi} 👋</h1>${can("orders.read") ? html`<a class="btn primary" href="#/orders?status=needs_call">${icon("phone")} ${t("callsToMake")}: ${num(calls.length)}</a>` : ""}</div>
    ${showSetup ? html`<div class="card onboard" id="onboard"><div class="card-title"><div><h2 style="margin:0">${t("setupTitle")}</h2><p class="muted small" style="margin:4px 0 0">${t("setupSub")} · ${num(steps.filter((s) => s.done).length)}/${num(steps.length)}</p></div><button class="btn sm ghost" id="ob-hide">${t("dismiss")}</button></div>
      <ol>${steps.map((s) => html`<li class="${s.done ? "done" : ""}"><span class="tick">${s.done ? "✓" : ""}</span>${s.done ? html`<span>${tt(s)}</span>` : html`<a href="${s.link}">${tt(s)} →</a>`}</li>`)}</ol></div>` : ""}
    <div class="card health" aria-label="${t("healthCheck")}"><div class="card-title"><h2 style="margin:0">${t("healthCheck")}</h2>${can("settings.read") ? html`<a class="btn sm" href="#/settings/integrations">${t("settings")}</a>` : ""}</div>
      <ul>${health.lines.map((l) => html`<li><span class="led ${l.ok === true ? "ok" : l.ok ? "partial" : "off"}" aria-hidden="true"></span>${tt(l)}</li>`)}</ul></div>
    <div class="card attention"><div class="card-title"><h2 style="margin:0">${t("attention")}</h2></div>
      ${sections.length ? sections : html`<p class="muted" style="font-size:1.05rem">${t("allClear")}</p>`}</div>
    <div class="kpis">
      ${kpi("#/orders", "--k1", "orders", t("todayOrders"), num(k.todayOrders.value), delta(k.todayOrders.change, t("vsYesterday")))}
      ${kpi("#/reports", "--k2", "money", t("todayRevenue"), money(k.todayRevenue.value), delta(k.todayRevenue.change, t("vsYesterday")))}
      ${kpi("#/reports", "--k6", "reports", t("monthRevenue"), money(k.monthRevenue.value), delta(k.monthRevenue.change, t("vsLastMonth")))}
      ${kpi("#/orders?payment_method=COD", "--k3", "money", t("pendingCodKpi"), money(k.pendingCod.amount), html`<span class="delta muted">${num(k.pendingCod.value)} ${t("orders_")}</span>`)}
      ${kpi("#/inventory?stock=low", "--k5", "alert", t("lowStockItems"), num(k.lowStock.value), "")}
      ${kpi("#/abandoned", "--k4", "cart-off", t("abandonedKpi"), num(k.abandoned.value), "")}
      ${kpi("#/warranty", "--k1", "wrench", t("openClaimsKpi"), num(k.openClaims.value), k.openClaims.fresh ? html`<span class="delta muted">${num(k.openClaims.fresh)} ${lang() === "bn" ? "নতুন" : "new"}</span>` : "")}
      ${kpi("#/products?bundle=1", "--k2", "box", t("kitsKpi"), num(k.bundlesSold.value), html`<span class="delta muted">${money(k.bundlesSold.revenue)}</span>`)}
    </div>
    <div class="dash-grid">
      <div class="card"><div class="card-title"><h2>${t("salesChart")}</h2><a class="btn sm" href="#/reports">${t("reports")}</a></div><div class="chart-box"><canvas id="sales" aria-label="${t("salesChart")}" role="img"></canvas></div></div>
      <div class="card"><div class="card-title"><h2>${t("topProducts")}</h2></div>
        ${d.topProducts.length ? d.topProducts.map((p) => html`<a class="top-item" href="#/products/${p.product_id}" style="color:inherit;text-decoration:none">${p.image ? html`<img src="${p.image}" alt="" loading="lazy">` : html`<span></span>`}<span><b>${lang() === "bn" ? p.name_bn : p.name_en}</b><br><span class="muted small">${num(p.qty)} × · ${money(p.revenue)}</span></span><span class="pill active">${num(p.qty)}</span></a>`) : html`<p class="muted">${t("noItems")}</p>`}
      </div>
    </div>
    <div class="card" style="margin-top:20px"><div class="card-title"><h2>${t("recentOrders")}</h2><a class="btn sm" href="#/orders">${t("viewAll")}</a></div>
      ${d.recentOrders.length ? html`<table class="table"><thead><tr><th>#</th><th>${t("customer")}</th><th>${t("total")}</th><th>${t("risk")}</th><th>${t("status")}</th><th>${t("date")}</th></tr></thead>
      <tbody>${d.recentOrders.map((o) => html`<tr class="clickable" data-href="#/orders/${o.id}"><td data-label="#"><b>${o.order_no}</b></td><td data-label="${t("customer")}">${o.customer_name}<br><span class="muted small">${o.district}</span></td><td data-label="${t("total")}">${money(o.total)}<br><span class="muted small">${o.payment_method}</span></td><td data-label="${t("risk")}">${riskBadge(o.risk_level, RB[o.risk_level])}</td><td data-label="${t("status")}">${pill(o.status, t(`s_${o.status}`))}</td><td data-label="${t("date")}">${dt(o.created_at, true)}</td></tr>`)}</tbody></table>` : html`<p class="muted">${t("noItems")}</p>`}
    </div>`);
  view.querySelectorAll("tr[data-href]").forEach((tr) => tr.addEventListener("click", () => (location.hash = tr.dataset.href)));
  view.querySelector("#ob-hide")?.addEventListener("click", async () => {
    try { await api("/settings/onboarding", { method: "PUT", body: { dismissed: true } }); view.querySelector("#onboard")?.remove(); } catch (e) { toast(errMsg(e), "err"); }
  });
  view.querySelectorAll("[data-notify]").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try { toast(msg(await api(`/products/${b.dataset.notify}/notify-waiting`, { method: "POST" }))); b.closest(".att-row")?.remove(); }
    catch (e) { b.disabled = false; toast(errMsg(e), "err"); }
  }));

  try {
    const Chart = await loadChart();
    const cs = getComputedStyle(document.documentElement);
    const primary = cs.getPropertyValue("--a-primary").trim() || "#2F8CFF";
    const pink = cs.getPropertyValue("--a-accent").trim() || "#22D3EE";
    const canvas = document.getElementById("sales");
    if (!canvas) return; // navigated away while the library loaded
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 260);
    grad.addColorStop(0, pink + "55");
    grad.addColorStop(1, pink + "00");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: d.salesChart.map((m) => new Date(m.month + "-01").toLocaleDateString(lang() === "bn" ? "bn-BD" : "en-GB", { month: "short" })),
        datasets: [
          { label: t("revenue"), data: d.salesChart.map((m) => m.revenue), borderColor: primary, backgroundColor: grad, fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: pink, yAxisID: "y" },
          { label: t("orders_"), data: d.salesChart.map((m) => m.orders), borderColor: pink, borderDash: [6, 4], tension: 0.4, pointRadius: 0, yAxisID: "y1" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom", labels: { usePointStyle: true } }, tooltip: { callbacks: { label: (c) => (c.datasetIndex === 0 ? `${t("revenue")}: ${money(c.raw)}` : `${t("orders_")}: ${num(c.raw)}`) } } },
        scales: { y: { beginAtZero: true, grid: { color: cs.getPropertyValue("--a-line").trim() || "#262A35" }, ticks: { callback: (v) => money(v) } }, y1: { beginAtZero: true, position: "right", grid: { display: false } }, x: { grid: { display: false } } },
      },
    });
  } catch {
    // Chart library unavailable (offline / CDN blocked): show the numbers instead.
    document.getElementById("sales")?.closest(".chart-box")?.replaceWith(Object.assign(document.createElement("div"), { innerHTML: String(html`<table class="table">${d.salesChart.map((m) => html`<tr><td>${m.month}</td><td>${money(m.revenue)}</td><td>${num(m.orders)}</td></tr>`)}</table>`) }));
  }
}
