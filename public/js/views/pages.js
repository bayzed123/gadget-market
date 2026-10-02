// Content pages: About (how we sell, trust badges we hold), Contact (phone, WhatsApp, map), policies (warranty, returns,
// delivery, privacy) and a 404.
// ADJUSTABLE: policy wording is a plain-language starting point — have it reviewed before launch.
import { t, lang, tt, L } from "../i18n.js";
import { html, icon, config, api } from "../core.js";
import { emptyState, certBadges, warrantyNote } from "../ui.js";

const POLICIES = {
  warranty: {
    en: ["Each product page states its warranty in months; the same number is printed next to the item on your invoice.", "Warranty runs from the day your parcel is delivered, against the invoice — keep it, or download it again from your account.", "Covered: manufacturing faults — a unit that won't charge, turn on, pair or play sound, or a battery that fails early.", "Not covered: drops, cracks, bent pins, water beyond the stated IP rating, and units opened or repaired elsewhere.", "To claim: My account → Warranty, pick the item and describe the problem. If we logged the unit's serial number when we packed it, the claim is matched to it.", "Claims move from Submitted → Under review → Approved or Rejected → Resolved, and you get an SMS at each step. Approved claims are repaired, replaced or refunded, usually within 7–10 working days."],
    bn: ["প্রতিটি পণ্যের পাতায় ওয়ারেন্টি মাসে লেখা থাকে; একই সংখ্যা ইনভয়েসে পণ্যের পাশে ছাপা থাকে।", "পার্সেল ডেলিভারির দিন থেকে, ইনভয়েসের ভিত্তিতে ওয়ারেন্টি শুরু — ইনভয়েস রাখুন, অথবা অ্যাকাউন্ট থেকে আবার ডাউনলোড করুন।", "আওতায় আছে: ম্যানুফ্যাকচারিং ত্রুটি — চার্জ না নেওয়া, চালু না হওয়া, পেয়ার না হওয়া বা শব্দ না আসা, কিংবা ব্যাটারি আগেভাগে নষ্ট হওয়া।", "আওতায় নেই: পড়ে যাওয়া, ফাটা, পিন বাঁকা, উল্লেখিত IP রেটিংয়ের বেশি পানিতে ক্ষতি, এবং অন্য কোথাও খোলা বা মেরামত করা ইউনিট।", "ক্লেইম করতে: আমার অ্যাকাউন্ট → ওয়ারেন্টি, পণ্যটি বেছে নিয়ে সমস্যা লিখুন। প্যাক করার সময় সিরিয়াল নম্বর লেখা থাকলে ক্লেইম নিজেই তার সাথে মিলে যাবে।", "ক্লেইম ধাপে ধাপে এগোয়: জমা → যাচাই চলছে → অনুমোদিত বা বাতিল → সমাধান, প্রতিটি ধাপে SMS পাবেন। অনুমোদিত ক্লেইম সাধারণত ৭–১০ কর্মদিবসে মেরামত, বদল বা টাকা ফেরতে সমাধান হয়।"],
  },
  returns: {
    en: ["Changed your mind? Return an unused item in its original box with all accessories within 7 days of delivery.", "Arrived damaged, wrong or not working? Tell us within 48 hours with a photo or unboxing video; we replace it or refund in full.", "Items that develop a fault later are handled under warranty — see the Warranty policy.", "Screen protectors that have been applied and opened software / gift cards can't be returned unless faulty.", "Refunds go back by bKash/Nagad or bank within 5 working days after we receive the item."],
    bn: ["মত বদলেছেন? ব্যবহার না করা পণ্য আসল বক্স ও সব এক্সেসরিজসহ ডেলিভারির ৭ দিনের মধ্যে ফেরত দিন।", "ক্ষতিগ্রস্ত, ভুল বা কাজ করছে না? ৪৮ ঘণ্টার মধ্যে ছবি বা আনবক্সিং ভিডিওসহ জানান; বদলে দেবো বা পুরো টাকা ফেরত দেবো।", "পরে কোনো ত্রুটি দেখা দিলে তা ওয়ারেন্টির আওতায় দেখা হয় — ওয়ারেন্টি নীতি দেখুন।", "লাগানো স্ক্রিন প্রটেক্টর এবং খোলা সফটওয়্যার / গিফট কার্ড ত্রুটি ছাড়া ফেরত নেওয়া হয় না।", "পণ্য হাতে পাওয়ার ৫ কর্মদিবসের মধ্যে বিকাশ/নগদ বা ব্যাংকে টাকা ফেরত।"],
  },
  delivery: {
    en: ["Cash on Delivery all over Bangladesh. Pay the courier when your parcel arrives.", "Delivery fees are calculated automatically at checkout from your division, district and upazila.", "Inside Dhaka: usually the same or the next day. Dhaka suburbs: 1–2 days. Elsewhere: 2–4 days.", "We call or SMS to confirm new orders before they ship — this keeps fake orders away and prices low.", "Track any order from the Track order page with your order number and mobile number."],
    bn: ["সারা বাংলাদেশে ক্যাশ অন ডেলিভারি। পার্সেল হাতে পেয়ে কুরিয়ারকে টাকা দিন।", "চেকআউটে আপনার বিভাগ, জেলা ও উপজেলা অনুযায়ী ডেলিভারি চার্জ নিজে থেকে হিসাব হয়।", "ঢাকা শহরে: সাধারণত একই দিন বা পরের দিন। ঢাকার আশপাশে: ১–২ দিন। অন্যান্য এলাকা: ২–৪ দিন।", "পাঠানোর আগে নতুন অর্ডার কল বা SMS এ কনফার্ম করা হয় — এতে ভুয়া অর্ডার কমে, দামও কম থাকে।", "অর্ডার নম্বর ও মোবাইল নম্বর দিয়ে “অর্ডার ট্র্যাক” পেজ থেকে যেকোনো অর্ডার দেখুন।"],
  },
  privacy: {
    en: ["We collect only what we need to deliver your order and honour its warranty: name, mobile number, address, the serial numbers of the units we send and, optionally, email.", "If you start checkout but don't finish, we save what you typed so we can help you complete it; it's deleted automatically after 30 days.", "Your compare list and gadget-finder answers stay in your browser and the page address.", "We use analytics and advertising tags (Meta, Google, Microsoft Clarity) to improve the shop and measure ads. Phone and email are hashed before being shared with ad platforms.", "We never see or store card numbers — card payments happen on SSLCommerz's secure page.", "Ask us any time to see or delete your data: call or WhatsApp us."],
    bn: ["অর্ডার পৌঁছাতে ও ওয়ারেন্টি দিতে যা দরকার শুধু তাই নিই: নাম, মোবাইল নম্বর, ঠিকানা, পাঠানো ইউনিটের সিরিয়াল নম্বর এবং ঐচ্ছিক ইমেইল।", "চেকআউট শুরু করে শেষ না করলে, সাহায্য করতে আপনার লেখা তথ্য সংরক্ষণ করা হয়; ৩০ দিন পর নিজে থেকেই মুছে যায়।", "আপনার তুলনার তালিকা ও গ্যাজেট ফাইন্ডারের উত্তর আপনার ব্রাউজার ও পেজের ঠিকানাতেই থাকে।", "দোকান উন্নত করতে ও বিজ্ঞাপন মাপতে অ্যানালিটিক্স ও বিজ্ঞাপন ট্যাগ (মেটা, গুগল, মাইক্রোসফট ক্ল্যারিটি) ব্যবহার করি। ফোন ও ইমেইল হ্যাশ করে পাঠানো হয়।", "কার্ডের নম্বর আমরা কখনো দেখি বা রাখি না — কার্ড পেমেন্ট হয় SSLCommerz এর নিরাপদ পেজে।", "আপনার তথ্য দেখতে বা মুছতে যেকোনো সময় কল বা হোয়াটসঅ্যাপ করুন।"],
  },
};

export default async function pages(el, { params, notFound }) {
  const cfg = await config();
  const s = cfg.store;
  const addr = lang() === "bn" ? s.address_bn : s.address_en;
  if (notFound) {
    el.innerHTML = String(html`<div class="container section">${emptyState(t("notFound"), "", html`<a class="btn primary" href="/">${t("backHome")}</a>`)}</div>`);
    return;
  }
  if (params.policy) {
    const titles = { warranty: "warrantyPolicy", returns: "returnsPolicy", delivery: "deliveryPolicy", privacy: "privacyPolicy" };
    el.innerHTML = String(html`<div class="container section narrow prose"><h1>${t(titles[params.policy])}</h1><ul class="checks">${POLICIES[params.policy][lang()].map((x) => html`<li>${icon("check")} <span>${x}</span></li>`)}</ul>
      ${params.policy === "warranty" ? html`${warrantyNote(s)}<p><a class="btn primary" href="/account/warranty">${icon("wrench")} ${t("claimNew")}</a></p>` : ""}</div>`);
    return;
  }
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cfg.brand.location.lat},${cfg.brand.location.lng}`)}`;
  const contactCard = html`<div class="card pad contact-card">
    <h2>${t("visitUs")}</h2>
    <ul class="info-list">
      <li>${icon("pin")}<span>${addr}, ${lang() === "bn" ? "বাংলাদেশ" : "Bangladesh"} · <a href="${map}" target="_blank" rel="noopener">${lang() === "bn" ? "ম্যাপে দেখুন" : "Open in Maps"}</a></span></li>
      <li>${icon("phone")}<a href="tel:${s.phone}">${s.phone}</a></li>
      <li>${icon("whatsapp")}<a href="/wa?lang=${lang()}">${t("chatWhatsApp")}</a></li>
      <li>${icon("clock")}<span>${lang() === "bn" ? s.hours_bn : s.hours_en}</span></li>
    </ul></div>`;
  if (params.page === "contact") {
    el.innerHTML = String(html`<div class="container section narrow"><h1>${t("contact")}</h1>${contactCard}</div>`);
    return;
  }
  const held = await api("/certifications").then((r) => r.certifications).catch(() => []);
  const bn = lang() === "bn";
  el.innerHTML = String(html`<div class="container section narrow prose">
    <h1 class="sprig-title">${t("about")}</h1>
    <p class="lead">${tt(cfg.brand.tagline)}</p>
    <p>${bn
      ? `${s.name_bn} ${s.city_bn}-এর একটি গ্যাজেট ও টেক এক্সেসরিজের দোকান। প্রতিটি পণ্যের পূর্ণ স্পেক শিট, কোন ডিভাইসে চলে তার তালিকা আর মাসে লেখা ওয়ারেন্টি পেজেই দিই — কেনার আগে যা জানা দরকার, সব এক জায়গায়।`
      : `${s.name_en} is a gadget and tech-accessories shop in ${s.city_en}. Every product page carries the full spec sheet, the devices it works with and the warranty in months — everything you need to know before you buy, in one place.`}</p>

    <h2>${bn ? "আমরা যেভাবে বিক্রি করি" : "How we sell"}</h2>
    <div class="story-grid">
      <div class="paper-card card">${icon("compare")}<h3>${t("trustSpecs")}</h3><p class="small">${bn ? "বক্সে যা লেখা, পেজেও ঠিক তা-ই — ২–৩টি পণ্য পাশাপাশি তুলনাও করতে পারেন।" : "What's printed on the box is on the page — and you can compare 2–3 products side by side."}</p></div>
      <div class="paper-card card">${icon("shield")}<h3>${t("trustWarranty")}</h3><p class="small">${bn ? "ওয়ারেন্টি মাসে লেখা, ইনভয়েসে ছাপা, আর অ্যাকাউন্ট থেকেই ক্লেইম করা যায়।" : "Warranty in months, printed on the invoice, and claimed straight from your account."}</p></div>
      <div class="paper-card card">${icon("chip")}<h3>${bn ? "সিরিয়াল নম্বর রেকর্ড" : "Serial numbers on file"}</h3><p class="small">${bn ? "দামি পণ্যের প্রতিটি ইউনিটের সিরিয়াল প্যাক করার সময় লিখে রাখি — ক্লেইম দ্রুত মেলে।" : "We log each higher-value unit's serial when we pack it, so claims are matched quickly."}</p></div>
      <div class="paper-card card">${icon("clock")}<h3>${t("trustStock")}</h3><p class="small">${bn ? "স্টকের সংখ্যা আর ডিলের শেষ সময় সরাসরি আমাদের রেকর্ড থেকে — কখনো বানানো নয়।" : "Stock counts and deal end times come straight from our records — never made up."}</p></div>
    </div>

    ${held.length ? html`<h2>${t("certificationsTitle")}</h2><p class="muted">${t("certificationsSub")}</p>${certBadges(held, { note: false })}
      <ul class="checks small">${held.filter((c) => c.description_en || c.description_bn).map((c) => html`<li>${icon(c.icon || "check")} <span><b>${L(c, "name")}</b>${c.issuer ? ` (${c.issuer})` : ""} — ${L(c, "description")}</span></li>`)}</ul>` : ""}

    <h2>${bn ? "আমাদের প্রতিশ্রুতি" : "Our promises"}</h2>
    <ul class="checks">
      <li>${icon("check")} <span>${bn ? "পানি প্রতিরোধ সবসময় IP রেটিংয়ে লিখি — “১০০% ওয়াটারপ্রুফ” বা “লাইফটাইম ওয়ারেন্টি” কখনো নয়।" : "Water resistance is always given as an IP rating — never “100% waterproof” or “lifetime warranty”."}</span></li>
      <li>${icon("shield")} <span>${bn ? "অফিসিয়াল ওয়ারেন্টি বা বিটিআরসি ব্যাজ শুধু তখনই দেখাই যখন প্রমাণের কাগজ আমাদের কাছে আছে।" : "We show an official-warranty or BTRC badge only when we hold the paperwork."}</span></li>
      <li>${icon("box")} <span>${bn ? "কম্বোর “সাশ্রয়” আজকের আসল দাম থেকে হিসাব করা — আলাদা কিনলে যত পড়ত, তার সাথে তুলনা।" : "Combo savings are worked out from today's real prices — what the same products cost separately."}</span></li>
    </ul>
    ${warrantyNote(s)}
    ${contactCard}
  </div>`);
}
