// System settings, one section at a time (#/settings/<section>): shop info (with the warranty terms — edited here in
// one place — the dated-lot warning and the home-page tech explainer), payments, customer messages,
// WhatsApp quick replies, fake-order protection, abandoned checkouts, automatic messages, VAT, refer-a-friend,
// ads & tracking, and what's connected (secrets are never shown — only whether each one is set).
import { t, lang, tt } from "../i18n.js";
import { html, raw, icon, api, $, $$, can, toast, msg, errMsg, skeleton, errorState, pill, uploadImage, confirmDialog } from "../core.js";

const L = (en, bn) => (lang() === "bn" ? bn : en);

export default async function settings(view, { id }) {
  view.innerHTML = String(html`<div class="page-head"><h1>${t("settings")}</h1></div>${skeleton(6)}`);
  let data;
  try { data = await api("/settings"); } catch (e) { view.innerHTML = String(errorState(errMsg(e))); $("[data-retry]", view).onclick = () => settings(view, { id }); return; }
  const s = data.settings;
  const C = data.connected;
  const ro = !can("settings.manage");
  const dis = ro ? raw("disabled") : "";
  const SECTIONS = [
    ["store", t("storeInfo")], ["payments", t("paymentsSettings")], ["notifications", t("notifSettings")], ["wa_templates", t("waTemplates")],
    ["fraud", t("fraudSettings")], ["abandoned", t("abandonedSettings")], ["automation", t("automationSettings")], ["tax", t("taxSettings")],
    ["referral", t("referralSettings")], ["integrations", t("trackingSettings")], ["system", L("Connected services & backups", "সংযুক্ত সার্ভিস ও ব্যাকআপ")],
  ];
  const section = SECTIONS.some(([k]) => k === id) ? id : "store";

  // field helpers — every input carries data-key (and data-type for numbers / checkboxes); "a.b" keys are nested
  const val = (key) => key.split(".").reduce((o, k) => o?.[k], s[section]) ?? "";
  const inp = (key, label, attrs = "", hint) => html`<label class="field"><span>${label}</span><input class="input" data-key="${key}" value="${val(key)}" ${raw(attrs)} ${dis}>${hint ? html`<span class="hint">${hint}</span>` : ""}</label>`;
  const numInp = (key, label, min, max, hint) => html`<label class="field"><span>${label}</span><input class="input" type="number" inputmode="numeric" data-key="${key}" data-type="number" min="${min}" max="${max}" value="${val(key)}" ${dis}>${hint ? html`<span class="hint">${hint}</span>` : ""}</label>`;
  const area = (key, label, rows = 2) => html`<label class="field" style="grid-column:1/-1"><span>${label}</span><textarea class="input" rows="${rows}" data-key="${key}" ${dis}>${val(key)}</textarea></label>`;
  const chk = (key, label, hint) => html`<label class="check" style="grid-column:1/-1"><input type="checkbox" data-key="${key}" data-type="bool" ${s[section]?.[key] ? raw("checked") : ""} ${dis}> <span>${label}${hint ? html`<br><span class="muted small">${hint}</span>` : ""}</span></label>`;
  const stat = (ok) => (ok ? pill("active", t("connected")) : pill("inactive", t("notConnected")));
  const templates = (sec) => html`<p class="muted small">${t("templatesHelp")} {link} {code} {product} {coupon}</p><div class="grid2">${Object.keys(s[sec] ?? {}).map((k) => html`<label class="field"><span>${k} — English</span><textarea class="input" rows="3" data-tpl="${k}" data-lang="en" ${dis}>${s[sec][k].en}</textarea></label><label class="field"><span>${k} — বাংলা</span><textarea class="input" rows="3" data-tpl="${k}" data-lang="bn" ${dis}>${s[sec][k].bn}</textarea></label>`)}</div>`;

  const pm = s.payments;
  const mfs = (k, label) => html`<div class="card" style="padding:16px"><label class="check"><input type="checkbox" data-pay="${k}" data-f="enabled" ${pm[k]?.enabled ? raw("checked") : ""} ${dis}> <b>${label}</b></label>
    ${k !== "rocket" ? html`<label class="field"><span>${L("Mode", "পদ্ধতি")}</span><select class="input" data-pay="${k}" data-f="mode" ${dis}><option value="manual" ${pm[k]?.mode !== "api" ? raw("selected") : ""}>${t("manual")}</option><option value="api" ${pm[k]?.mode === "api" ? raw("selected") : ""}>${t("api")}</option></select></label>` : ""}
    <div class="grid2"><label class="field"><span>${t("number")}</span><input class="input" data-pay="${k}" data-f="manualNumber" value="${pm[k]?.manualNumber ?? ""}" inputmode="tel" ${dis}></label>
    <label class="field"><span>${t("accountType")}</span><select class="input" data-pay="${k}" data-f="accountType" ${dis}>${["Personal", "Agent", "Merchant"].map((x) => html`<option ${pm[k]?.accountType === x ? raw("selected") : ""}>${x}</option>`)}</select></label></div>
    ${k === "bkash" || k === "nagad" ? html`<p class="small muted">API: ${stat(k === "bkash" ? C.bkashApi : C.nagadApi)}</p>` : ""}</div>`;

  const bodies = {
    store: () => html`<div class="grid2">
      ${inp("name_en", "Shop name (English)")}${inp("name_bn", "দোকানের নাম (বাংলা)")}
      ${inp("phone", t("phone"), 'inputmode="tel"')}${inp("whatsapp", "WhatsApp (8801XXXXXXXXX)", 'inputmode="tel"')}
      ${inp("email", "Email", 'type="email"')}${inp("hours_en", "Opening hours (English)")}${inp("hours_bn", "খোলার সময় (বাংলা)")}
      ${inp("address_en", "Address (English)")}${inp("address_bn", "ঠিকানা (বাংলা)")}${inp("city_en", "City (English)")}${inp("city_bn", "শহর (বাংলা)")}
      ${area("announcement_en", L("Announcement bar (English)", "ঘোষণা বার (ইংরেজি)"))}${area("announcement_bn", L("Announcement bar (Bangla)", "ঘোষণা বার (বাংলা)"))}
      ${inp("facebook_url", "Facebook page URL", 'type="url"')}${inp("instagram_url", "Instagram URL", 'type="url"')}${inp("tiktok_url", "TikTok URL", 'type="url"')}
      ${inp("logo_url", L("Logo link", "লোগোর লিংক"))}
      ${chk("gift_wrap_enabled", L("Offer a gift box at checkout (black gift box with a card)", "চেকআউটে গিফট বক্স অফার করুন (কার্ডসহ কালো গিফট বক্স)"), L("The fee is added to the order total and printed on the invoice.", "চার্জটি অর্ডারের মোটে যোগ হয় এবং ইনভয়েসে লেখা থাকে।"))}
      ${numInp("gift_wrap_fee", L("Gift-box fee (৳, 0 = free)", "গিফট বক্স চার্জ (৳, ০ = ফ্রি)"), 0, 5000)}</div>
      <h3 style="margin-top:14px">${L("Warranty terms", "ওয়ারেন্টির শর্ত")}</h3>
      <p class="muted small">${L("Shown next to every warranty badge, on the warranty policy page, at checkout and on invoices. Say plainly what is covered (manufacturing faults), what isn't (physical or liquid damage, misuse), and that the box, invoice and serial number are needed for a claim.", "প্রতিটি ওয়ারেন্টি ব্যাজের পাশে, ওয়ারেন্টি নীতির পেজে, চেকআউটে ও ইনভয়েসে দেখায়। সহজভাবে লিখুন কী কভার করে (উৎপাদনজনিত ত্রুটি), কী করে না (ভাঙা, পানি ঢোকা, ভুল ব্যবহার), আর ক্লেইমে বক্স, ইনভয়েস ও সিরিয়াল নম্বর লাগবে।")}</p>
      <div class="grid2">${area("warranty_note_en", "Warranty terms (English)", 3)}${area("warranty_note_bn", "ওয়ারেন্টির শর্ত (বাংলা)", 3)}</div>
      <h3 style="margin-top:14px">${t("expirySettings")}</h3><div class="grid2">
      ${numInp("expiry_alert_days", L("Warn me this many days before a dated lot expires", "তারিখযুক্ত লটের মেয়াদ শেষের কত দিন আগে সতর্ক করবে"), 7, 365, L("Only lots received with an expiry date (e.g. batteries) are checked. They show on the dashboard so you can sell them first.", "শুধু মেয়াদসহ গ্রহণ করা লট (যেমন ব্যাটারি) দেখা হয়। এগুলো ড্যাশবোর্ডে দেখাবে, যাতে আগে বিক্রি করতে পারেন।"))}</div>
      <h3 style="margin-top:14px">${t("spotlightSettings")}</h3><p class="muted small">${t("noClaims")}</p><div class="grid2">
      ${inp("spotlight.ingredient", L("Keyword (products with it in their name, specs or tags are shown) — e.g. GaN, ANC, USB-C", "কীওয়ার্ড (নাম, স্পেক বা ট্যাগে থাকলে সেই পণ্য দেখাবে) — যেমন GaN, ANC, USB-C"), 'maxlength="60"')}<span></span>
      ${inp("spotlight.title_en", "Title (English)", 'maxlength="120"')}${inp("spotlight.title_bn", "শিরোনাম (বাংলা)", 'maxlength="120"')}
      ${area("spotlight.text_en", "Text (English)", 3)}${area("spotlight.text_bn", "লেখা (বাংলা)", 3)}</div>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">${s.store.logo_url ? html`<img id="logo-preview" src="${s.store.logo_url}" alt="" style="width:72px;height:72px;border-radius:50%;object-fit:cover">` : ""}
        ${!ro ? html`<label class="btn">${icon("upload")} ${L("Upload logo", "লোগো আপলোড")}<input type="file" accept="image/*" id="logo-file" hidden></label>` : ""}</div>`,
    payments: () => html`<p class="muted small">${L("Cash on Delivery is the default. Manual mobile banking: the customer sends money to your number and types the TrxID — check it on your phone before confirming.", "ক্যাশ অন ডেলিভারি ডিফল্ট। ম্যানুয়াল মোবাইল ব্যাংকিং: গ্রাহক আপনার নম্বরে টাকা পাঠিয়ে TrxID দেবেন — কনফার্মের আগে ফোনে মিলিয়ে নিন।")}</p>
      <label class="check"><input type="checkbox" data-pay="cod" data-f="enabled" ${pm.cod?.enabled ? raw("checked") : ""} ${dis}> <b>${L("Cash on Delivery", "ক্যাশ অন ডেলিভারি")}</b></label>
      <div class="grid2">${mfs("bkash", "bKash")}${mfs("nagad", "Nagad")}${mfs("rocket", "Rocket")}
        <div class="card" style="padding:16px"><label class="check"><input type="checkbox" data-pay="card" data-f="enabled" ${pm.card?.enabled ? raw("checked") : ""} ${dis}> <b>${L("Cards (SSLCommerz)", "কার্ড (SSLCommerz)")}</b></label><p class="small muted">${stat(C.sslcommerz)}</p></div></div>`,
    notifications: () => html`<div class="chips">${["sms", "whatsapp", "email", "push"].map((k) => html`<label class="check" style="margin-right:16px"><input type="checkbox" data-key="${k}" data-type="bool" ${s.notifications[k] ? raw("checked") : ""} ${dis}> ${k.toUpperCase()}</label>`)}</div>
      <div class="grid2">${inp("ownerPhone", L("Owner phone (new-order & security alerts)", "মালিকের ফোন (নতুন অর্ডার ও নিরাপত্তা সতর্কতা)"), 'inputmode="tel"')}</div>
      <h3 style="margin-top:12px">${t("smsTemplates")}</h3>${templates("templates")}`,
    wa_templates: () => html`<p class="muted">${L("These fill the WhatsApp buttons on each order — you check and press Send in WhatsApp.", "প্রতিটি অর্ডারের হোয়াটসঅ্যাপ বাটনে এগুলো বসে যায় — আপনি দেখে হোয়াটসঅ্যাপে পাঠান চাপবেন।")}</p>${templates("wa_templates")}`,
    fraud: () => html`<div class="grid2">
      ${chk("requireOtp", L("Ask for an SMS code at checkout", "চেকআউটে SMS কোড চাইবে"), L("Needs an SMS gateway. Unverified numbers are never confirmed automatically.", "SMS গেটওয়ে লাগবে। যাচাই না হওয়া নম্বর কখনো অটো কনফার্ম হয় না।"))}
      ${chk("autoConfirmTrusted", L("Trusted fast lane: confirm 🟢 Trusted customers automatically", "বিশ্বস্ত দ্রুত পথ: 🟢 বিশ্বস্ত গ্রাহকের অর্ডার অটো কনফার্ম"), L("Only when the number was verified by SMS.", "শুধু SMS এ নম্বর যাচাই হলে।"))}
      ${numInp("trustedMinDelivered", L("Delivered orders needed to be Trusted", "বিশ্বস্ত হতে কতটি ডেলিভারি লাগবে"), 1, 50)}
      ${numInp("velocityWindowMin", L("Repeat-order window (minutes)", "বারবার অর্ডার দেখার সময় (মিনিট)"), 5, 1440)}
      ${numInp("velocityMaxPerPhone", L("Max orders per phone in the window", "সময়ের মধ্যে এক ফোনে সর্বোচ্চ অর্ডার"), 1, 50)}
      ${numInp("velocityMaxPerAddress", L("Max orders per address", "এক ঠিকানায় সর্বোচ্চ অর্ডার"), 1, 50)}
      ${numInp("velocityMaxPerIp", L("Max orders per internet connection", "এক ইন্টারনেট সংযোগে সর্বোচ্চ অর্ডার"), 1, 100)}
      ${chk("courierCheck", L("Look up courier delivery history when an order is opened", "অর্ডার খুললে কুরিয়ারের ডেলিভারি রেকর্ড দেখবে"), html`${L("Courier-check service", "কুরিয়ার-চেক সার্ভিস")}: ${stat(C.fraudCheck)}`)}</div>`,
    abandoned: () => html`<div class="grid2">
      ${numInp("minutes", L("Count as abandoned after (minutes)", "কত মিনিট পর অসম্পূর্ণ ধরা হবে"), 5, 1440)}
      ${numInp("retentionDays", L("Delete details after (days)", "কত দিন পর তথ্য মুছে যাবে"), 1, 365, L("Privacy: phone numbers from unfinished checkouts are not kept forever.", "গোপনীয়তা: অসম্পূর্ণ চেকআউটের ফোন নম্বর চিরকাল রাখা হয় না।"))}
      ${chk("autoRecovery", L("Send the recovery message automatically", "রিকভারি মেসেজ অটো পাঠাবে"), L("Off by default — many owners prefer to call first.", "ডিফল্ট বন্ধ — অনেকে আগে কল করতে পছন্দ করেন।"))}
      ${numInp("recoveryDelayMin", L("Send it after (minutes)", "কত মিনিট পর পাঠাবে"), 10, 2880)}
      ${numInp("recoveryDiscount", L("Recovery discount (৳, 0 = none)", "রিকভারি ছাড় (৳, ০ = নেই)"), 0, 5000)}
      ${numInp("recoveryValidHours", L("Discount valid for (hours)", "ছাড়ের মেয়াদ (ঘণ্টা)"), 1, 720)}</div>`,
    automation: () => html`<div class="grid2">
      ${chk("reviewRequests", L("Ask for a review after delivery", "ডেলিভারির পর রিভিউ চাইবে"))}
      ${numInp("reviewRequestDays", L("Days after delivery", "ডেলিভারির কত দিন পর"), 1, 30)}
      </div>`,
    tax: () => html`<div class="grid2">
      ${chk("enabled", L("Show VAT on invoices", "ইনভয়েসে ভ্যাট দেখাবে"), L("Optional. Check the correct rate with your accountant.", "ঐচ্ছিক। সঠিক হার আপনার হিসাবরক্ষকের কাছে জেনে নিন।"))}
      ${numInp("rate", L("VAT rate (%)", "ভ্যাট হার (%)"), 0, 30)}
      ${chk("inclusive", L("Prices already include VAT", "দামের মধ্যে ভ্যাট ধরা আছে"))}
      ${inp("bin", L("BIN (VAT registration no.)", "বিআইএন (ভ্যাট নিবন্ধন নং)"))}</div>`,
    referral: () => html`<div class="grid2">
      ${chk("enabled", L("Refer-a-friend is on", "বন্ধুকে রেফার চালু"))}
      ${numInp("friendDiscount", L("Friend's discount on first order (৳)", "বন্ধুর প্রথম অর্ডারে ছাড় (৳)"), 0, 5000)}
      ${numInp("reward", L("Reward for the referrer (৳ coupon)", "রেফারকারীর রিওয়ার্ড (৳ কুপন)"), 0, 5000)}
      ${numInp("minOrder", L("Minimum order (৳)", "সর্বনিম্ন অর্ডার (৳)"), 0, 100000)}</div>`,
    integrations: () => html`<p class="muted small">${L("Only IDs go here. The Facebook Conversions API token is a secret your developer adds (META_CAPI_TOKEN).", "এখানে শুধু আইডি। ফেসবুক Conversions API টোকেন একটি secret — ডেভেলপার যোগ করবেন (META_CAPI_TOKEN)।")}</p><div class="grid2">
      ${inp("metaPixelId", "Meta (Facebook) Pixel ID", 'inputmode="numeric"', html`Conversions API: ${stat(C.metaCapi)}`)}
      ${inp("ga4Id", "Google Analytics 4 ID", 'placeholder="G-XXXXXXX"')}
      ${inp("googleAdsId", "Google Ads ID", 'placeholder="AW-XXXXXXXXX"')}${inp("googleAdsLabel", L("Google Ads purchase label", "Google Ads পারচেজ লেবেল"))}
      ${inp("clarityId", "Microsoft Clarity ID")}${inp("cfBeacon", "Cloudflare Web Analytics token")}
      ${chk("whatsappConnected", L("Show the WhatsApp chat button", "হোয়াটসঅ্যাপ চ্যাট বাটন দেখাবে"), html`${L("Automatic WhatsApp messages", "স্বয়ংক্রিয় হোয়াটসঅ্যাপ মেসেজ")}: ${stat(C.whatsapp)}`)}</div>`,
    system: () => html`<p class="muted small">${t("secretsNote")}</p>
      <table class="table"><tbody>${[["bKash API", C.bkashApi], ["Nagad API", C.nagadApi], ["SSLCommerz (cards)", C.sslcommerz], ["Steadfast courier", C.steadfast], ["Pathao courier", C.pathao], [L("Courier fraud check", "কুরিয়ার ফ্রড চেক"), C.fraudCheck], ["SMS gateway", C.sms], ["WhatsApp Cloud API", C.whatsapp], ["Email (Resend)", C.email], [L("App notifications (Web Push)", "অ্যাপ নোটিফিকেশন"), C.push], ["Meta Conversions API", C.metaCapi], ["Turnstile bot protection", C.turnstile], ["R2 storage", C.r2], ["Workers AI", C.ai]].map(([n, ok]) => html`<tr><td data-label="">${n}</td><td data-label="">${stat(ok)}</td></tr>`)}</tbody></table>
      ${!ro ? html`<div class="chips" style="margin-top:14px"><button class="btn" id="run-jobs">${icon("restore")} ${t("runJobs")}</button><button class="btn" id="backup">${icon("download")} ${t("backupNow")}</button></div>` : ""}`,
  };

  view.innerHTML = String(html`
    <div class="page-head"><h1>${t("settings")}</h1>${!ro && section !== "system" ? html`<button class="btn primary" id="save">${t("save")}</button>` : ""}</div>
    <div class="tabs">${SECTIONS.map(([k, l]) => html`<a class="chip" href="#/settings/${k}" aria-pressed="${k === section}">${l}</a>`)}</div>
    <div class="card" id="sec"><h2>${SECTIONS.find(([k]) => k === section)[1]}</h2>${bodies[section]()}</div>`);

  $("#logo-file", view)?.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { toast(t("uploading")); const r = await uploadImage(f, "branding"); view.querySelector('[data-key="logo_url"]').value = r.url; toast(L("Uploaded — press Save to publish.", "আপলোড হয়েছে — সংরক্ষণ চাপুন।")); }
    catch (err) { toast(errMsg(err), "err"); }
  });
  $("#run-jobs", view)?.addEventListener("click", async () => { try { toast(msg(await api("/jobs/run", { method: "POST" }))); } catch (err) { toast(errMsg(err), "err"); } });
  $("#backup", view)?.addEventListener("click", async () => {
    if (!(await confirmDialog(L("Make a backup copy of the database now?", "এখনই ডেটাবেসের ব্যাকআপ কপি নেবেন?"), { danger: false }))) return;
    try { toast(msg(await api("/backup", { method: "POST" }))); } catch (err) { toast(errMsg(err), "err"); }
  });
  $("#save", view)?.addEventListener("click", async () => {
    let key = section;
    let value;
    if (section === "payments") {
      value = structuredClone(s.payments);
      $$("[data-pay]", view).forEach((el) => { value[el.dataset.pay] ??= {}; value[el.dataset.pay][el.dataset.f] = el.type === "checkbox" ? el.checked : el.value.trim(); });
    } else {
      value = structuredClone(s[section]);
      $$("#sec [data-key]", view).forEach((el) => {
        const v = el.dataset.type === "bool" ? el.checked : el.dataset.type === "number" ? Number(el.value) : el.value.trim();
        const path = el.dataset.key.split(".");
        const last = path.pop();
        path.reduce((o, k) => (o[k] ??= {}), value)[last] = v;
      });
      if (section === "notifications" || section === "wa_templates") {
        const tplKey = section === "notifications" ? "templates" : "wa_templates";
        const tpl = structuredClone(s[tplKey]);
        $$("[data-tpl]", view).forEach((el) => { tpl[el.dataset.tpl][el.dataset.lang] = el.value; });
        if (section === "notifications") {
          try { await api("/settings/templates", { method: "PUT", body: tpl }); s.templates = tpl; } catch (err) { return toast(errMsg(err), "err"); }
        } else value = tpl;
        key = section === "notifications" ? "notifications" : "wa_templates";
      }
    }
    try { toast(msg(await api(`/settings/${key}`, { method: "PUT", body: value }))); s[key] = value; }
    catch (err) {
      for (const f of err.data?.fields ?? []) view.querySelector(`[data-key="${CSS.escape(f.field)}"]`)?.classList.add("invalid");
      toast(errMsg(err), "err");
    }
  });
  void tt;
}
