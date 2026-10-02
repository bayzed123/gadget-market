/**
 * Starter content for a fresh database. Everything here is ADJUSTABLE and meant to be edited in the admin:
 *  - categories follow the brief (Audio, Wearables, Power, Mobile Accessories, Gaming, Smart Home, Computer
 *    Accessories), some with sub-categories, each with the 2-letter code used in GAD-[Cat]-[Brand]-[Color]-[Seq];
 *  - delivery zones are set up from the shop in Multiplan Center, Dhaka — the fees are placeholders;
 *  - sample products use FICTIONAL brands (Sonix, Arcwave, Voltra, Shieldr, Nexplay, Lumio, Keyra) so no real
 *    model's specs are invented; the photos are studio renders (scripts/render-gadget.mjs). Replace them with your
 *    real stock, real brands and the spec sheets printed on the boxes;
 *  - bundles / combo deals are their own stocked products listing the products inside them (bundle_items);
 *  - stock arrives in lots (supplier invoice numbers, no expiry — gadgets don't expire), and a few higher-value
 *    options come with serial numbers logged for each unit on the shelf;
 *  - a few products run a Deal of the Day with a REAL end date (days from the build date); the nightly job ends the
 *    sale price when the date passes;
 *  - trust badges (official warranty, BTRC, authorised distributor) are listed with NO documents, so no badge shows
 *    in the shop until the owner attaches real proof;
 *  - tech guides are short, honest starter articles.
 *
 * Honesty rules applied to the seed: no stock counts or "people viewing" in copy, no "lifetime warranty", water
 * resistance always given as an IP rating, no superlatives about Bangladesh (scripts/build.mjs refuses to build
 * otherwise, and a unit test checks every product and article); no reviews; sold counts start at 0.
 */

/** code: the SKU category code (2–3 capital letters). parent: slug of the parent category. */
export const categories = [
  { slug: "audio", code: "AU", en: "Audio", bn: "অডিও", color: "sky", image: "/img/products/sonix-buds-pro.webp", descEn: "Earbuds, headphones and Bluetooth speakers — with the real playtime and driver size on every spec sheet.", descBn: "ইয়ারবাড, হেডফোন ও ব্লুটুথ স্পিকার — প্রতিটি স্পেক শিটে আসল প্লেটাইম ও ড্রাইভারের মাপ।" },
  { slug: "earbuds", parent: "audio", code: "EB", en: "Earbuds", bn: "ইয়ারবাড", color: "sky", descEn: "True wireless earbuds for calls, commutes and the gym.", descBn: "কল, যাতায়াত আর জিমের জন্য ট্রু ওয়্যারলেস ইয়ারবাড।" },
  { slug: "headphones", parent: "audio", code: "HP", en: "Headphones", bn: "হেডফোন", color: "sky", descEn: "Over-ear wireless headphones with noise cancelling.", descBn: "নয়েজ ক্যান্সেলিংসহ ওভার-ইয়ার ওয়্যারলেস হেডফোন।" },
  { slug: "speakers", parent: "audio", code: "SK", en: "Speakers", bn: "স্পিকার", color: "sky", descEn: "Portable Bluetooth speakers, from pocket-size to party.", descBn: "পকেট সাইজ থেকে পার্টি স্পিকার — পোর্টেবল ব্লুটুথ স্পিকার।" },
  { slug: "wearables", code: "WR", en: "Wearables", bn: "ওয়্যারেবল", color: "lavender", image: "/img/products/arcwave-watch-s2.webp", descEn: "Smartwatches, fitness bands and straps that work with your phone.", descBn: "আপনার ফোনের সাথে চলে এমন স্মার্টওয়াচ, ফিটনেস ব্যান্ড ও স্ট্র্যাপ।" },
  { slug: "power", code: "PW", en: "Power", bn: "পাওয়ার", color: "yellow", image: "/img/products/voltra-gan-65w.webp", descEn: "Power banks, chargers and cables — with the real wattage, so you know what your device will take.", descBn: "পাওয়ার ব্যাংক, চার্জার ও ক্যাবল — আসল ওয়াটসহ, যাতে জানেন আপনার ডিভাইস কত নেবে।" },
  { slug: "power-banks", parent: "power", code: "PB", en: "Power Banks", bn: "পাওয়ার ব্যাংক", color: "yellow", descEn: "Pocket, magnetic and laptop power banks.", descBn: "পকেট, ম্যাগনেটিক ও ল্যাপটপ পাওয়ার ব্যাংক।" },
  { slug: "chargers", parent: "power", code: "CH", en: "Chargers", bn: "চার্জার", color: "yellow", descEn: "USB-C PD and GaN wall chargers, wireless pads.", descBn: "USB-C PD ও GaN ওয়াল চার্জার, ওয়্যারলেস প্যাড।" },
  { slug: "cables", parent: "power", code: "CB", en: "Cables", bn: "ক্যাবল", color: "yellow", descEn: "Braided USB-C and Lightning cables rated for fast charging.", descBn: "ফাস্ট চার্জিং রেটেড ব্রেইডেড USB-C ও লাইটনিং ক্যাবল।" },
  { slug: "mobile-accessories", code: "MA", en: "Mobile Accessories", bn: "মোবাইল এক্সেসরিজ", color: "mint", image: "/img/products/shieldr-clear-case.webp", descEn: "Cases, screen protectors and car holders, listed by the exact phone model they fit.", descBn: "কেস, স্ক্রিন প্রটেক্টর ও কার হোল্ডার — কোন ফোন মডেলে ফিট করে তা লেখা।" },
  { slug: "cases", parent: "mobile-accessories", code: "CS", en: "Cases", bn: "কেস", color: "mint", descEn: "Clear, magnetic and rugged phone cases.", descBn: "ক্লিয়ার, ম্যাগনেটিক ও রাগড ফোন কেস।" },
  { slug: "screen-protectors", parent: "mobile-accessories", code: "SG", en: "Screen Protectors", bn: "স্ক্রিন প্রটেক্টর", color: "mint", descEn: "9H tempered glass with an install frame.", descBn: "ইনস্টল ফ্রেমসহ ৯H টেম্পার্ড গ্লাস।" },
  { slug: "gaming", code: "GM", en: "Gaming", bn: "গেমিং", color: "pink", image: "/img/products/nexplay-pro-controller.webp", descEn: "Controllers, gaming mice and headsets for PC, console and phone.", descBn: "পিসি, কনসোল ও ফোনের জন্য কন্ট্রোলার, গেমিং মাউস ও হেডসেট।" },
  { slug: "smart-home", code: "SH", en: "Smart Home", bn: "স্মার্ট হোম", color: "peach", image: "/img/products/lumio-indoor-camera.webp", descEn: "Wi-Fi plugs, bulbs and cameras that run from one phone app.", descBn: "এক ফোন অ্যাপে চলে এমন ওয়াই-ফাই প্লাগ, বাল্ব ও ক্যামেরা।" },
  { slug: "computer-accessories", code: "CA", en: "Computer Accessories", bn: "কম্পিউটার এক্সেসরিজ", color: "lavender", image: "/img/products/keyra-usb-c-hub.webp", descEn: "Keyboards, mice, USB-C hubs and portable SSDs for your desk.", descBn: "ডেস্কের জন্য কিবোর্ড, মাউস, USB-C হাব ও পোর্টেবল SSD।" },
];

// Dhaka city thanas added by scripts/build-geo.mjs (ids 9001–9050), Dhaka district 47, Dhaka division 6.
const dhakaCity = Array.from({ length: 50 }, (_, i) => 9001 + i);

/** From the Dhaka shop (New Elephant Road). */
export const zones = [
  { code: "dhaka_city", en: "Dhaka City", bn: "ঢাকা সিটি", fee: 70, free: 3000, upazilas: dhakaCity, etaEn: "Same or next day", etaBn: "একই দিন বা পরের দিন", sort: 1 },
  { code: "dhaka_district", en: "Rest of Dhaka district (Savar, Keraniganj …)", bn: "ঢাকা জেলার অন্যান্য এলাকা (সাভার, কেরানীগঞ্জ …)", fee: 100, free: 5000, districts: [47], etaEn: "1–2 days", etaBn: "১–২ দিন", sort: 2 },
  { code: "dhaka_division", en: "Rest of Dhaka Division", bn: "ঢাকা বিভাগের অন্যান্য জেলা", fee: 120, divisions: [6], etaEn: "2–3 days", etaBn: "২–৩ দিন", sort: 3 },
  { code: "outside", en: "Rest of Bangladesh", bn: "সারা বাংলাদেশ", fee: 130, isDefault: true, etaEn: "2–4 days", etaBn: "২–৪ দিন", sort: 4 },
];

const img = (...names) => names.map((n) => `/img/products/${n}.webp`);
/** A stock lot arriving with the starter stock: supplier-invoice number and quantity (gadgets don't expire). */
const lot = (batch, qty) => ({ batch, qty });
const BOX_BN = "বক্সে যা আছে";
const BATTERY_CAUTION = {
  en: "Don't leave it charging in direct sun or on a bed or pillow. Use a charger with the rated output. Don't open or puncture the battery.",
  bn: "সরাসরি রোদে বা বিছানা-বালিশের ওপর চার্জে রাখবেন না। নির্ধারিত আউটপুটের চার্জার ব্যবহার করুন। ব্যাটারি খুলবেন না বা ফুটো করবেন না।",
};
const ALL_PHONES = ["iphone", "android"];
const COMPUTERS = ["laptop", "mac", "windows"];

/**
 * Product fields: cat (category slug), brand, compatible (devices it works with — lib/sku.ts COMPATIBLE), warranty
 * (months), specs ([key, value] in display order; known keys from SPEC_KEYS get bilingual labels), highlights (up to 4
 * key features), boxEn/boxBn (what's in the box), use (setup steps, one per line), dealDays (Deal of the Day ends this
 * many days after the build — needs a sale price), variants (size = capacity / length / model it fits; colour is part
 * of the SKU) with their starter lots and `serials` (number of units with a serial logged), bundle (products inside).
 */
export const products = [
  // ------------------------------------------------------------------ audio · earbuds
  {
    slug: "sonix-buds-pro", cat: "earbuds", brand: "Sonix", en: "Sonix Buds Pro ANC Earbuds", bn: "সোনিক্স বাডস প্রো ANC ইয়ারবাড", price: 3490, sale: 2990, dealDays: 2, featured: 1,
    compatible: [...ALL_PHONES, ...COMPUTERS], warranty: 12, images: img("sonix-buds-pro", "sonix-buds-pro-open"), origin: "Imported (China)",
    descEn: "Hybrid active noise cancelling earbuds with 10 mm drivers and a 4-mic setup for clear calls. Transparency mode lets traffic and announcements through when you need them. The case tops the buds up four times and charges over USB-C.",
    descBn: "১০ মিমি ড্রাইভার আর পরিষ্কার কলের জন্য ৪টি মাইকসহ হাইব্রিড অ্যাক্টিভ নয়েজ ক্যান্সেলিং ইয়ারবাড। ট্রান্সপারেন্সি মোডে দরকার হলে রাস্তার শব্দ ও ঘোষণা শুনতে পাবেন। কেস দিয়ে বাডস চারবার চার্জ হয়, কেস চার্জ হয় USB-C তে।",
    specs: [["model", "SX-BP2"], ["driver", "10 mm dynamic"], ["anc", "Hybrid ANC, up to 35 dB"], ["playtime", "7 h (ANC off), 5.5 h (ANC on); 28 h with case"], ["charging_time", "1.5 h (case)"], ["bluetooth", "5.3, AAC / SBC"], ["microphone", "4 mics with ENC"], ["water", "IPX4 (sweat and splashes)"], ["ports", "USB-C"], ["weight", "4.8 g per bud, 46 g case"]],
    highlights: [{ name: "Hybrid ANC", en: "Cuts bus and fan noise, up to 35 dB", bn: "বাস ও ফ্যানের শব্দ কমায়, ৩৫ dB পর্যন্ত" }, { name: "28 h with case", en: "A week of commutes on one case charge", bn: "এক চার্জে এক সপ্তাহের যাতায়াত" }, { name: "4-mic calls", en: "Your voice, less of the street", bn: "রাস্তার শব্দ কম, আপনার কণ্ঠ বেশি" }],
    boxEn: "2 earbuds, charging case, USB-C cable (30 cm), ear tips (S / M / L), quick-start guide, warranty card", boxBn: "২টি ইয়ারবাড, চার্জিং কেস, USB-C ক্যাবল (৩০ সেমি), ইয়ার টিপ (S / M / L), কুইক-স্টার্ট গাইড, ওয়ারেন্টি কার্ড",
    useEn: "Open the case near your phone — a pairing pop-up appears on most phones.\nOr hold the case button for 3 seconds and pick \"SX-BP2\" in Bluetooth settings.\nPress and hold either bud to switch ANC / transparency.\nCharge the case with any USB-C charger (5 V / 1 A or more).",
    useBn: "ফোনের কাছে কেস খুলুন — বেশিরভাগ ফোনে পেয়ারিং পপ-আপ আসবে।\nঅথবা কেসের বাটন ৩ সেকেন্ড চেপে ধরে ব্লুটুথ সেটিংসে \"SX-BP2\" বেছে নিন।\nANC / ট্রান্সপারেন্সি বদলাতে যেকোনো বাড চেপে ধরুন।\nযেকোনো USB-C চার্জারে (৫ V / ১ A বা বেশি) কেস চার্জ দিন।",
    caution: BATTERY_CAUTION,
    variants: [{ color: "Black", stock: 24, lots: [lot("PO-2608-011", 24)] }, { color: "White", stock: 16, lots: [lot("PO-2608-011", 16)] }],
  },
  {
    slug: "sonix-buds-lite", cat: "earbuds", brand: "Sonix", en: "Sonix Buds Lite Earbuds", bn: "সোনিক্স বাডস লাইট ইয়ারবাড", price: 1390, sale: 1190,
    compatible: [...ALL_PHONES, ...COMPUTERS], warranty: 6, images: img("sonix-buds-lite"), origin: "Imported (China)",
    descEn: "Light, everyday earbuds with a low-latency game mode and a pocket-size case. A good first pair, or a spare for the gym bag.",
    descBn: "হালকা, প্রতিদিনের ইয়ারবাড — লো-ল্যাটেন্সি গেম মোড আর পকেট সাইজ কেসসহ। প্রথম জোড়া হিসেবে বা জিম ব্যাগের জন্য বাড়তি জোড়া হিসেবে ভালো।",
    specs: [["model", "SX-BL1"], ["driver", "13 mm dynamic"], ["playtime", "5 h; 24 h with case"], ["charging_time", "1.5 h (case)"], ["bluetooth", "5.3, SBC"], ["microphone", "1 mic per bud"], ["water", "IPX4 (sweat and splashes)"], ["ports", "USB-C"], ["weight", "4 g per bud, 35 g case"]],
    highlights: [{ name: "Game mode", en: "Lower delay for mobile games and video", bn: "মোবাইল গেম ও ভিডিওতে কম দেরি" }, { name: "24 h with case", en: "Charge the case about once a week", bn: "সপ্তাহে প্রায় একবার কেস চার্জ দিন" }],
    boxEn: "2 earbuds, charging case, USB-C cable, ear tips (S / M / L), warranty card", boxBn: "২টি ইয়ারবাড, চার্জিং কেস, USB-C ক্যাবল, ইয়ার টিপ (S / M / L), ওয়ারেন্টি কার্ড",
    useEn: "Take both buds out of the case; they pair with each other automatically.\nPick \"SX-BL1\" in your phone's Bluetooth settings.\nTap the left bud three times for game mode.",
    useBn: "কেস থেকে দুটি বাড বের করুন; নিজেরাই একে অপরের সাথে যুক্ত হবে।\nফোনের ব্লুটুথ সেটিংসে \"SX-BL1\" বেছে নিন।\nগেম মোডের জন্য বাম বাডে তিনবার ট্যাপ করুন।",
    caution: BATTERY_CAUTION,
    variants: [{ color: "Black", stock: 30, lots: [lot("PO-2607-024", 30)] }, { color: "White", stock: 18, lots: [lot("PO-2607-024", 18)] }, { color: "Blue", stock: 0 }],
  },
  // ------------------------------------------------------------------ audio · headphones
  {
    slug: "sonix-wave-500", cat: "headphones", brand: "Sonix", en: "Sonix Wave 500 Wireless ANC Headphones", bn: "সোনিক্স ওয়েভ ৫০০ ওয়্যারলেস ANC হেডফোন", price: 4990, featured: 1,
    compatible: [...ALL_PHONES, ...COMPUTERS, "smart_tv"], warranty: 12, images: img("sonix-wave-500"), origin: "Imported (China)",
    descEn: "Over-ear headphones with 40 mm drivers, active noise cancelling and soft protein-leather cushions for long days. Pair two devices at once — laptop for meetings, phone for calls — or plug in the 3.5 mm cable when the battery runs out.",
    descBn: "৪০ মিমি ড্রাইভার, অ্যাক্টিভ নয়েজ ক্যান্সেলিং আর দীর্ঘ সময় পরার জন্য নরম প্রোটিন-লেদার কুশনসহ ওভার-ইয়ার হেডফোন। একসাথে দুটি ডিভাইস যুক্ত রাখুন — মিটিংয়ের জন্য ল্যাপটপ, কলের জন্য ফোন — ব্যাটারি শেষ হলে ৩.৫ মিমি ক্যাবল লাগিয়ে শুনুন।",
    specs: [["model", "SX-W500"], ["driver", "40 mm dynamic"], ["anc", "Active noise cancelling, up to 30 dB"], ["playtime", "60 h (ANC off), 40 h (ANC on)"], ["charging_time", "2 h; 10 min gives 4 h"], ["bluetooth", "5.3, multipoint (2 devices)"], ["microphone", "2 mics with ENC"], ["ports", "USB-C, 3.5 mm AUX"], ["weight", "255 g"]],
    highlights: [{ name: "60 h battery", en: "Charge about once a fortnight", bn: "প্রায় দুই সপ্তাহে একবার চার্জ" }, { name: "Multipoint", en: "Laptop and phone connected together", bn: "ল্যাপটপ ও ফোন একসাথে যুক্ত" }, { name: "3.5 mm AUX", en: "Still plays with a cable when the battery is flat", bn: "ব্যাটারি শেষ হলেও ক্যাবলে চলে" }],
    boxEn: "Headphones, carry pouch, USB-C cable, 3.5 mm audio cable (1.2 m), warranty card", boxBn: "হেডফোন, ক্যারি পাউচ, USB-C ক্যাবল, ৩.৫ মিমি অডিও ক্যাবল (১.২ মি), ওয়ারেন্টি কার্ড",
    useEn: "Hold the power button for 5 seconds until the light flashes blue and red.\nPick \"SX-W500\" in Bluetooth settings.\nTo add a second device, repeat on that device — both stay connected.",
    useBn: "লাইট নীল-লাল জ্বলা পর্যন্ত পাওয়ার বাটন ৫ সেকেন্ড চেপে ধরুন।\nব্লুটুথ সেটিংসে \"SX-W500\" বেছে নিন।\nদ্বিতীয় ডিভাইস যোগ করতে সেটিতে একই কাজ করুন — দুটোই যুক্ত থাকবে।",
    caution: BATTERY_CAUTION,
    variants: [{ color: "Black", stock: 9, lots: [lot("PO-2608-030", 9)], serials: 9 }, { color: "Silver", stock: 2, lots: [lot("PO-2608-030", 2)], serials: 2 }],
  },
  // ------------------------------------------------------------------ audio · speakers
  {
    slug: "sonix-boom-mini", cat: "speakers", brand: "Sonix", en: "Sonix Boom Mini Bluetooth Speaker", bn: "সোনিক্স বুম মিনি ব্লুটুথ স্পিকার", price: 1990,
    compatible: [...ALL_PHONES, ...COMPUTERS], warranty: 6, images: img("sonix-boom-mini"), origin: "Imported (China)",
    descEn: "A palm-size 5W speaker with a fabric grille and a strap loop for your bag. IPX7 water resistant, so rain on a rooftop or a splash by the pool is fine. Pair two for stereo.",
    descBn: "হাতের তালুর মাপের ৫W স্পিকার — কাপড়ের গ্রিল আর ব্যাগে ঝোলানোর স্ট্র্যাপ লুপসহ। IPX7 পানি প্রতিরোধী, তাই ছাদে বৃষ্টি বা পুলের পাশে পানির ছিটে সমস্যা নয়। দুটি জোড়া দিলে স্টেরিও।",
    specs: [["model", "SX-BM5"], ["wattage", "5 W"], ["playtime", "12 h at 50% volume"], ["charging_time", "2.5 h"], ["bluetooth", "5.3, stereo pairing"], ["water", "IPX7 (1 m for 30 minutes)"], ["ports", "USB-C"], ["dimensions", "95 × 95 × 42 mm"], ["weight", "210 g"]],
    highlights: [{ name: "IPX7", en: "Rinse it under the tap", bn: "কলের পানিতে ধুয়ে ফেলা যায়" }, { name: "Stereo pair", en: "Two speakers, left and right", bn: "দুটি স্পিকারে বাম-ডান" }],
    boxEn: "Speaker, strap, USB-C cable, user guide, warranty card", boxBn: "স্পিকার, স্ট্র্যাপ, USB-C ক্যাবল, ইউজার গাইড, ওয়ারেন্টি কার্ড",
    useEn: "Hold the power button until you hear the tone.\nPick \"SX-BM5\" in Bluetooth settings.\nFor stereo, turn on both speakers and double-press the play button on one of them.\nDry the USB-C port before charging after it has been wet.",
    useBn: "টোন শোনা পর্যন্ত পাওয়ার বাটন চেপে ধরুন।\nব্লুটুথ সেটিংসে \"SX-BM5\" বেছে নিন।\nস্টেরিওর জন্য দুটি স্পিকার চালু করে একটির প্লে বাটন দুবার চাপুন।\nভিজে গেলে চার্জের আগে USB-C পোর্ট শুকিয়ে নিন।",
    caution: BATTERY_CAUTION,
    variants: [{ color: "Black", stock: 14, lots: [lot("PO-2607-031", 14)] }, { color: "Blue", stock: 10, lots: [lot("PO-2607-031", 10)] }, { color: "Red", stock: 6, lots: [lot("PO-2607-031", 6)] }],
  },
  {
    slug: "sonix-party-40", cat: "speakers", brand: "Sonix", en: "Sonix Party 40W Speaker with Light Ring", bn: "সোনিক্স পার্টি ৪০W স্পিকার (লাইট রিংসহ)", price: 6490,
    compatible: [...ALL_PHONES, ...COMPUTERS, "smart_tv"], warranty: 12, images: img("sonix-party-40"), origin: "Imported (China)",
    descEn: "A 40W speaker for the living room or the roof: two woofers, two tweeters, a light ring that follows the beat and a power-bank port to top up your phone. Water resistant to IPX5.",
    descBn: "বসার ঘর বা ছাদের জন্য ৪০W স্পিকার: দুটি উফার, দুটি টুইটার, গানের তালে জ্বলা লাইট রিং আর ফোন চার্জ দেওয়ার পাওয়ার-ব্যাংক পোর্ট। IPX5 পর্যন্ত পানি প্রতিরোধী।",
    specs: [["model", "SX-P40"], ["wattage", "40 W (2 × 15 W woofer, 2 × 5 W tweeter)"], ["playtime", "15 h with lights off"], ["battery", "7200 mAh"], ["charging_time", "4 h"], ["bluetooth", "5.3"], ["water", "IPX5 (splashes from any angle)"], ["ports", "USB-C in, USB-A out (5 V / 2 A), 3.5 mm AUX"], ["weight", "1.6 kg"]],
    highlights: [{ name: "40 W", en: "Fills a room or a rooftop", bn: "একটি ঘর বা ছাদ ভরিয়ে তোলে" }, { name: "Power-bank port", en: "Top up your phone from the speaker", bn: "স্পিকার থেকে ফোন চার্জ" }],
    boxEn: "Speaker, USB-C cable, 3.5 mm audio cable, shoulder strap, warranty card", boxBn: "স্পিকার, USB-C ক্যাবল, ৩.৫ মিমি অডিও ক্যাবল, কাঁধের স্ট্র্যাপ, ওয়ারেন্টি কার্ড",
    useEn: "Press power, then the Bluetooth button.\nPick \"SX-P40\" on your phone.\nPress the light button to cycle through light modes or switch them off.",
    useBn: "পাওয়ার, তারপর ব্লুটুথ বাটন চাপুন।\nফোনে \"SX-P40\" বেছে নিন।\nলাইট মোড বদলাতে বা বন্ধ করতে লাইট বাটন চাপুন।",
    caution: BATTERY_CAUTION,
    variants: [{ color: "Black", stock: 5, lots: [lot("PO-2608-030", 5)], serials: 5 }],
  },
  // ------------------------------------------------------------------ wearables
  {
    slug: "arcwave-watch-s2", cat: "wearables", brand: "Arcwave", en: "Arcwave Watch S2 AMOLED Smartwatch", bn: "আর্কওয়েভ ওয়াচ S2 অ্যামোলেড স্মার্টওয়াচ", price: 4490, sale: 3990, dealDays: 4, featured: 1,
    compatible: ALL_PHONES, warranty: 12, images: img("arcwave-watch-s2", "arcwave-watch-s2-duo"), origin: "Imported (China)",
    descEn: "A 1.43\" AMOLED smartwatch with an always-on option, Bluetooth calling from the wrist, heart-rate and SpO2 readings and 100+ sport modes. The aluminium case and quick-swap 22 mm strap make it easy to dress up or down.",
    descBn: "১.৪৩\" অ্যামোলেড স্মার্টওয়াচ — অলওয়েজ-অন অপশন, কব্জি থেকে ব্লুটুথ কল, হার্ট-রেট ও SpO2 রিডিং আর ১০০+ স্পোর্ট মোড। অ্যালুমিনিয়াম কেস আর সহজে বদলানো যায় এমন ২২ মিমি স্ট্র্যাপ।",
    specs: [["model", "AW-S2"], ["display", "1.43\" AMOLED, 466 × 466"], ["battery", "300 mAh"], ["playtime", "Up to 10 days typical, 3 days always-on"], ["charging_time", "2 h (magnetic charger)"], ["bluetooth", "5.2, Bluetooth calling"], ["sensors", "Heart rate, SpO2, accelerometer"], ["water", "IP68 (rain, hand-washing; not for swimming)"], ["material", "Aluminium case, silicone strap (22 mm)"], ["compatibility", "Android 8.0+ / iOS 13+ via the Arcwave app"]],
    highlights: [{ name: "AMOLED", en: "Bright enough to read in Dhaka sun", bn: "ঢাকার রোদেও পড়া যায়" }, { name: "Calls from the wrist", en: "Answer while your phone is in the bag", bn: "ফোন ব্যাগে রেখেই কল ধরুন" }, { name: "10-day battery", en: "Typical use, always-on off", bn: "সাধারণ ব্যবহারে, অলওয়েজ-অন বন্ধ রেখে" }],
    boxEn: "Watch, magnetic charging cable, user guide, warranty card", boxBn: "ঘড়ি, ম্যাগনেটিক চার্জিং ক্যাবল, ইউজার গাইড, ওয়ারেন্টি কার্ড",
    useEn: "Charge the watch fully before first use.\nInstall the Arcwave app from Google Play or the App Store and sign in.\nTap \"Add device\" and scan the QR code shown on the watch.\nAllow notifications and calls in the app to get them on your wrist.",
    useBn: "প্রথম ব্যবহারের আগে ঘড়ি পুরো চার্জ দিন।\nগুগল প্লে বা অ্যাপ স্টোর থেকে আর্কওয়েভ অ্যাপ ইনস্টল করে সাইন ইন করুন।\n\"Add device\" চেপে ঘড়িতে দেখানো QR কোড স্ক্যান করুন।\nকব্জিতে নোটিফিকেশন ও কল পেতে অ্যাপে অনুমতি দিন।",
    caution: { en: "Health readings are for general fitness tracking, not medical diagnosis. Not for swimming or hot showers.", bn: "স্বাস্থ্য রিডিং সাধারণ ফিটনেস ট্র্যাকিংয়ের জন্য, চিকিৎসা নির্ণয়ের জন্য নয়। সাঁতার বা গরম পানিতে গোসলের সময় পরবেন না।" },
    variants: [{ color: "Black", stock: 12, lots: [lot("PO-2608-018", 12)], serials: 12 }, { color: "Silver", stock: 7, lots: [lot("PO-2608-018", 7)], serials: 7 }],
  },
  {
    slug: "arcwave-band-5", cat: "wearables", brand: "Arcwave", en: "Arcwave Band 5 Fitness Band", bn: "আর্কওয়েভ ব্যান্ড ৫ ফিটনেস ব্যান্ড", price: 1990,
    compatible: ALL_PHONES, warranty: 6, images: img("arcwave-band-5"), origin: "Imported (China)",
    descEn: "A slim fitness band that counts steps, tracks sleep and shows your messages on a 1.1\" colour screen. Two weeks on a charge.",
    descBn: "পাতলা ফিটনেস ব্যান্ড — ধাপ গোনে, ঘুম ট্র্যাক করে আর ১.১\" রঙিন স্ক্রিনে মেসেজ দেখায়। এক চার্জে দুই সপ্তাহ।",
    specs: [["model", "AW-B5"], ["display", "1.1\" colour AMOLED"], ["battery", "180 mAh"], ["playtime", "Up to 14 days typical"], ["charging_time", "1.5 h"], ["bluetooth", "5.2"], ["sensors", "Heart rate, SpO2, accelerometer"], ["water", "5 ATM (swimming in a pool)"], ["weight", "24 g with strap"]],
    highlights: [{ name: "14-day battery", en: "Charge twice a month", bn: "মাসে দুবার চার্জ" }, { name: "5 ATM", en: "Wear it in the pool", bn: "পুলে পরে সাঁতার কাটা যায়" }],
    boxEn: "Band with strap, charging cable, user guide, warranty card", boxBn: "স্ট্র্যাপসহ ব্যান্ড, চার্জিং ক্যাবল, ইউজার গাইড, ওয়ারেন্টি কার্ড",
    useEn: "Install the Arcwave app and tap \"Add device\".\nKeep the band next to the phone while it pairs.\nPick which apps can send notifications.",
    useBn: "আর্কওয়েভ অ্যাপ ইনস্টল করে \"Add device\" চাপুন।\nপেয়ারিংয়ের সময় ব্যান্ডটি ফোনের পাশে রাখুন।\nকোন অ্যাপ নোটিফিকেশন পাঠাবে বেছে নিন।",
    caution: { en: "Health readings are for general fitness tracking, not medical diagnosis.", bn: "স্বাস্থ্য রিডিং সাধারণ ফিটনেস ট্র্যাকিংয়ের জন্য, চিকিৎসা নির্ণয়ের জন্য নয়।" },
    variants: [{ color: "Black", stock: 20, lots: [lot("PO-2607-040", 20)] }, { color: "Teal", stock: 11, lots: [lot("PO-2607-040", 11)] }],
  },
  {
    slug: "arcwave-sport-strap-22mm", cat: "wearables", brand: "Arcwave", en: "Silicone Sport Strap 22 mm", bn: "সিলিকন স্পোর্ট স্ট্র্যাপ ২২ মিমি", price: 390,
    compatible: ["iphone", "android"], warranty: 0, images: img("arcwave-sport-strap"), origin: "Imported (China)",
    descEn: "A soft, quick-release 22 mm silicone strap with a stainless-steel buckle. Fits the Arcwave Watch S2 and any watch with 22 mm lugs.",
    descBn: "নরম, কুইক-রিলিজ ২২ মিমি সিলিকন স্ট্র্যাপ — স্টেইনলেস-স্টিল বাকলসহ। আর্কওয়েভ ওয়াচ S2 সহ ২২ মিমি লাগের যেকোনো ঘড়িতে লাগে।",
    specs: [["length", "Fits wrists 140–210 mm"], ["material", "Silicone, stainless-steel buckle"], ["compatibility", "Watches with 22 mm lugs (Arcwave Watch S2)"]],
    highlights: [{ name: "Quick release", en: "Swap straps without tools", bn: "টুল ছাড়াই স্ট্র্যাপ বদলান" }],
    boxEn: "1 strap with quick-release pins", boxBn: "কুইক-রিলিজ পিনসহ ১টি স্ট্র্যাপ",
    useEn: "Slide the pin lever inward and lift the old strap off.\nFit one end of the new pin into the lug hole, pull the lever and let it click into the other side.",
    useBn: "পিনের লিভার ভেতরের দিকে টেনে পুরনো স্ট্র্যাপ খুলুন।\nনতুন পিনের এক মাথা লাগের ছিদ্রে বসিয়ে লিভার টেনে অন্য পাশে ক্লিক করে বসান।",
    variants: [{ color: "Black", stock: 25, lots: [lot("PO-2607-041", 25)] }, { color: "Navy", stock: 14, lots: [lot("PO-2607-041", 14)] }, { color: "Orange", stock: 9, lots: [lot("PO-2607-041", 9)] }],
  },
  // ------------------------------------------------------------------ power · power banks
  {
    slug: "voltra-powerbank-10000", cat: "power-banks", brand: "Voltra", en: "Voltra 10000 mAh 22.5W Power Bank", bn: "ভোল্ট্রা ১০০০০ mAh ২২.৫W পাওয়ার ব্যাংক", price: 1890, featured: 1,
    compatible: [...ALL_PHONES, "usb_c", "lightning"], warranty: 12, images: img("voltra-powerbank-10000"), origin: "Imported (China)",
    descEn: "A slim 10,000 mAh power bank with 22.5W fast charging: about two full charges for most phones. USB-C works both ways, so one cable charges the bank and your phone.",
    descBn: "পাতলা ১০,০০০ mAh পাওয়ার ব্যাংক, ২২.৫W ফাস্ট চার্জিং: বেশিরভাগ ফোন প্রায় দুবার পুরো চার্জ হয়। USB-C দুই দিকেই কাজ করে, তাই এক ক্যাবলেই ব্যাংক ও ফোন চার্জ।",
    specs: [["model", "VT-P10"], ["capacity", "10000 mAh / 37 Wh"], ["wattage", "22.5 W max (USB-A), 20 W PD (USB-C)"], ["input", "USB-C 18 W"], ["ports", "1 × USB-C (in/out), 1 × USB-A (out)"], ["charging_time", "3.5 h with an 18 W charger"], ["dimensions", "140 × 68 × 15 mm"], ["weight", "215 g"]],
    highlights: [{ name: "22.5 W", en: "Fast-charges most Android phones and iPhones", bn: "বেশিরভাগ অ্যান্ড্রয়েড ও আইফোন দ্রুত চার্জ" }, { name: "Flight-safe 37 Wh", en: "Under the 100 Wh cabin limit", bn: "কেবিনের ১০০ Wh সীমার নিচে" }],
    boxEn: "Power bank, USB-C to USB-C cable (30 cm), user guide, warranty card", boxBn: "পাওয়ার ব্যাংক, USB-C টু USB-C ক্যাবল (৩০ সেমি), ইউজার গাইড, ওয়ারেন্টি কার্ড",
    useEn: "Charge it fully before first use (four lights).\nPlug your phone into either port — charging starts by itself.\nPress the button once to see the charge left.",
    useBn: "প্রথম ব্যবহারের আগে পুরো চার্জ দিন (চারটি লাইট)।\nযেকোনো পোর্টে ফোন লাগান — নিজেই চার্জ শুরু হবে।\nকত চার্জ বাকি দেখতে বাটন একবার চাপুন।",
    caution: BATTERY_CAUTION,
    variants: [{ color: "Black", stock: 26, lots: [lot("PO-2606-002", 6), lot("PO-2608-007", 20)] }, { color: "White", stock: 15, lots: [lot("PO-2608-007", 15)] }],
  },
  {
    slug: "voltra-powerbank-20000-65w", cat: "power-banks", brand: "Voltra", en: "Voltra 20000 mAh 65W Laptop Power Bank", bn: "ভোল্ট্রা ২০০০০ mAh ৬৫W ল্যাপটপ পাওয়ার ব্যাংক", price: 4290,
    compatible: [...COMPUTERS, "usb_c", ...ALL_PHONES, "switch"], warranty: 12, images: img("voltra-powerbank-20000"), origin: "Imported (China)",
    descEn: "Enough power to keep a USB-C laptop going through a load-shedding evening: 65W USB-C PD, three ports at once and a small screen that shows the exact percentage left.",
    descBn: "লোডশেডিংয়ের সন্ধ্যায় USB-C ল্যাপটপ চালু রাখার মতো শক্তি: ৬৫W USB-C PD, একসাথে তিনটি পোর্ট আর ছোট স্ক্রিনে ঠিক কত শতাংশ বাকি তা দেখায়।",
    specs: [["model", "VT-P20L"], ["capacity", "20000 mAh / 74 Wh"], ["wattage", "65 W max (USB-C PD), 22.5 W (USB-A)"], ["input", "USB-C 65 W"], ["ports", "2 × USB-C, 1 × USB-A"], ["charging_time", "2 h with a 65 W charger"], ["display", "Digital percentage"], ["dimensions", "158 × 74 × 27 mm"], ["weight", "430 g"]],
    highlights: [{ name: "65 W PD", en: "Charges USB-C laptops, not just phones", bn: "শুধু ফোন নয়, USB-C ল্যাপটপও চার্জ" }, { name: "74 Wh", en: "Allowed in cabin baggage (under 100 Wh)", bn: "কেবিন ব্যাগেজে নেওয়া যায় (১০০ Wh এর নিচে)" }],
    boxEn: "Power bank, USB-C to USB-C 100 W cable (60 cm), travel pouch, warranty card", boxBn: "পাওয়ার ব্যাংক, USB-C টু USB-C ১০০ W ক্যাবল (৬০ সেমি), ট্রাভেল পাউচ, ওয়ারেন্টি কার্ড",
    useEn: "Use the USB-C port marked 65 W for a laptop.\nCheck your laptop charges over USB-C (look for the PD or lightning-bolt mark next to its port).\nCharge the bank with a 65 W USB-C charger for the 2-hour refill.",
    useBn: "ল্যাপটপের জন্য ৬৫ W লেখা USB-C পোর্ট ব্যবহার করুন।\nআপনার ল্যাপটপ USB-C তে চার্জ হয় কি না দেখুন (পোর্টের পাশে PD বা বিদ্যুৎ চিহ্ন)।\n২ ঘণ্টায় রিফিলের জন্য ৬৫ W USB-C চার্জার দিয়ে ব্যাংক চার্জ দিন।",
    caution: BATTERY_CAUTION,
    variants: [{ color: "Grey", stock: 8, lots: [lot("PO-2608-007", 8)], serials: 8 }],
  },
  {
    slug: "voltra-magsnap-5000", cat: "power-banks", brand: "Voltra", en: "Voltra MagSnap 5000 mAh Magnetic Power Bank", bn: "ভোল্ট্রা ম্যাগস্ন্যাপ ৫০০০ mAh ম্যাগনেটিক পাওয়ার ব্যাংক", price: 2490,
    compatible: ["iphone"], warranty: 12, images: img("voltra-magsnap-5000"), origin: "Imported (China)",
    descEn: "Snaps magnetically onto the back of an iPhone 12 or newer (or any phone in a magnetic case) and charges wirelessly — no cable in your pocket. A fold-out stand holds the phone for video.",
    descBn: "আইফোন ১২ বা নতুন মডেলের পেছনে (বা ম্যাগনেটিক কেসে থাকা যেকোনো ফোনে) চুম্বকে আটকে যায় আর ওয়্যারলেসে চার্জ দেয় — পকেটে ক্যাবল লাগে না। ভিডিও দেখার জন্য ভাঁজ করা স্ট্যান্ড।",
    specs: [["model", "VT-M5"], ["capacity", "5000 mAh / 19.25 Wh"], ["wattage", "7.5 W wireless, 20 W USB-C"], ["input", "USB-C 20 W"], ["ports", "USB-C (in/out)"], ["compatibility", "iPhone 12 and newer; other phones with a magnetic case"], ["weight", "125 g"]],
    highlights: [{ name: "Snaps on", en: "Magnetic, no cable needed", bn: "চুম্বকে আটকে, ক্যাবল লাগে না" }, { name: "Built-in stand", en: "Watch videos hands-free", bn: "হাতে না ধরে ভিডিও দেখুন" }],
    boxEn: "Power bank, USB-C cable, warranty card", boxBn: "পাওয়ার ব্যাংক, USB-C ক্যাবল, ওয়ারেন্টি কার্ড",
    useEn: "Line the bank up with the camera bump and let the magnets snap it on.\nCharging starts automatically; press the button to check the lights.\nRemove thick or metal cases first.",
    useBn: "ক্যামেরা বাম্পের সাথে মিলিয়ে বসান, চুম্বক নিজেই আটকে নেবে।\nচার্জ নিজেই শুরু হবে; লাইট দেখতে বাটন চাপুন।\nআগে মোটা বা ধাতব কেস খুলে নিন।",
    caution: BATTERY_CAUTION,
    variants: [{ color: "White", stock: 10, lots: [lot("PO-2608-019", 10)] }, { color: "Midnight", stock: 6, lots: [lot("PO-2608-019", 6)] }],
  },
  // ------------------------------------------------------------------ power · chargers
  {
    slug: "voltra-20w-usb-c-charger", cat: "chargers", brand: "Voltra", en: "Voltra 20W USB-C PD Charger", bn: "ভোল্ট্রা ২০W USB-C PD চার্জার", price: 990,
    compatible: ["iphone", "android", "usb_c", "lightning"], warranty: 12, images: img("voltra-20w-charger"), origin: "Imported (China)",
    descEn: "The 20W USB-C Power Delivery charger iPhones and most Android phones fast-charge with: about 50% in 30 minutes on recent iPhones. Two-pin plug for Bangladesh sockets.",
    descBn: "যে ২০W USB-C পাওয়ার ডেলিভারি চার্জারে আইফোন ও বেশিরভাগ অ্যান্ড্রয়েড ফোন ফাস্ট চার্জ হয়: সাম্প্রতিক আইফোনে ৩০ মিনিটে প্রায় ৫০%। বাংলাদেশের সকেটের জন্য দুই-পিন প্লাগ।",
    specs: [["model", "VT-C20"], ["wattage", "20 W USB-C PD 3.0"], ["input", "100–240 V AC, 50/60 Hz"], ["ports", "1 × USB-C"], ["material", "Fire-retardant PC shell"], ["dimensions", "40 × 40 × 30 mm"]],
    highlights: [{ name: "20 W PD", en: "iPhone fast-charge rate", bn: "আইফোনের ফাস্ট-চার্জ রেট" }, { name: "100–240 V", en: "Handles voltage swings", bn: "ভোল্টেজ ওঠানামা সামলায়" }],
    boxEn: "Charger, warranty card (cable not included)", boxBn: "চার্জার, ওয়ারেন্টি কার্ড (ক্যাবল সাথে নেই)",
    useEn: "Use a USB-C to USB-C cable (Android, iPad, iPhone 15+) or USB-C to Lightning (iPhone 14 and earlier).",
    useBn: "USB-C টু USB-C (অ্যান্ড্রয়েড, আইপ্যাড, আইফোন ১৫+) অথবা USB-C টু লাইটনিং (আইফোন ১৪ ও আগের) ক্যাবল ব্যবহার করুন।",
    variants: [{ color: "White", stock: 40, lots: [lot("PO-2607-052", 40)] }],
  },
  {
    slug: "voltra-gan-65w", cat: "chargers", brand: "Voltra", en: "Voltra 65W GaN 3-Port Charger", bn: "ভোল্ট্রা ৬৫W GaN ৩-পোর্ট চার্জার", price: 3290, sale: 2890, dealDays: 1, featured: 1,
    compatible: [...COMPUTERS, "usb_c", ...ALL_PHONES, "switch"], warranty: 18, images: img("voltra-gan-65w", "voltra-gan-65w-duo"), origin: "Imported (China)",
    descEn: "One GaN charger for your laptop, phone and earbuds: 65W from a single USB-C port, shared smartly when you plug in more. About the size of a phone charger, so it lives in your bag, not on the desk.",
    descBn: "ল্যাপটপ, ফোন ও ইয়ারবাডের জন্য একটি GaN চার্জার: একটি USB-C পোর্ট থেকে ৬৫W, আরও ডিভাইস লাগালে বুদ্ধি করে ভাগ করে দেয়। ফোনের চার্জারের মতোই ছোট, তাই ডেস্কে নয়, ব্যাগে থাকে।",
    specs: [["model", "VT-G65"], ["wattage", "65 W max; C1 + C2: 45 W + 20 W; C1 + A: 45 W + 18 W"], ["input", "100–240 V AC, 50/60 Hz"], ["ports", "2 × USB-C, 1 × USB-A"], ["material", "GaN (gallium nitride), fire-retardant PC shell"], ["dimensions", "52 × 52 × 32 mm"], ["weight", "120 g"]],
    highlights: [{ name: "GaN", en: "Runs cooler in a smaller brick", bn: "ছোট আকারে কম গরম হয়" }, { name: "3 devices", en: "Laptop, phone and earbuds at once", bn: "ল্যাপটপ, ফোন ও ইয়ারবাড একসাথে" }],
    boxEn: "Charger, warranty card (cable not included — use a 100 W USB-C cable for laptops)", boxBn: "চার্জার, ওয়ারেন্টি কার্ড (ক্যাবল সাথে নেই — ল্যাপটপের জন্য ১০০ W USB-C ক্যাবল ব্যবহার করুন)",
    useEn: "Plug the laptop into C1 (top port) for the full 65 W.\nUse C2 or USB-A for the phone and earbuds.\nUse a cable rated 60 W or more for laptops.",
    useBn: "পুরো ৬৫ W এর জন্য ল্যাপটপ C1 (ওপরের পোর্ট) এ লাগান।\nফোন ও ইয়ারবাডের জন্য C2 বা USB-A ব্যবহার করুন।\nল্যাপটপের জন্য ৬০ W বা বেশি রেটেড ক্যাবল ব্যবহার করুন।",
    variants: [{ color: "Black", stock: 13, lots: [lot("PO-2608-022", 13)], serials: 13 }, { color: "White", stock: 9, lots: [lot("PO-2608-022", 9)], serials: 9 }],
  },
  {
    slug: "voltra-wireless-pad-15w", cat: "chargers", brand: "Voltra", en: "Voltra 15W Wireless Charging Pad", bn: "ভোল্ট্রা ১৫W ওয়্যারলেস চার্জিং প্যাড", price: 1490,
    compatible: ALL_PHONES, warranty: 12, images: img("voltra-wireless-pad"), origin: "Imported (China)",
    descEn: "Put the phone down, it charges. Qi wireless pad with a soft-touch top and a quiet, dimmable status light for bedside tables.",
    descBn: "ফোন রাখলেই চার্জ। নরম টপ আর বিছানার পাশে রাখার মতো মৃদু, কমানো যায় এমন লাইটসহ Qi ওয়্যারলেস প্যাড।",
    specs: [["model", "VT-W15"], ["wattage", "15 W (Android), 7.5 W (iPhone)"], ["input", "USB-C, needs an 18 W or higher adapter"], ["compatibility", "Qi phones: iPhone 8 and newer, Galaxy S / Note, Pixel"], ["dimensions", "Ø 90 × 9 mm"]],
    highlights: [{ name: "Qi", en: "Works through cases up to 5 mm", bn: "৫ মিমি পর্যন্ত কেসের ওপর দিয়েও চার্জ" }],
    boxEn: "Charging pad, USB-C cable (1 m), warranty card (adapter not included)", boxBn: "চার্জিং প্যাড, USB-C ক্যাবল (১ মি), ওয়ারেন্টি কার্ড (অ্যাডাপ্টার সাথে নেই)",
    useEn: "Connect the pad to an 18 W or higher USB-C adapter.\nPlace the phone face up in the centre — the light turns blue.",
    useBn: "প্যাডটি ১৮ W বা বেশি USB-C অ্যাডাপ্টারে লাগান।\nফোন উপুড় না করে মাঝখানে রাখুন — লাইট নীল হবে।",
    variants: [{ color: "Black", stock: 12, lots: [lot("PO-2607-052", 12)] }],
  },
  // ------------------------------------------------------------------ power · cables
  {
    slug: "voltra-usb-c-cable-100w", cat: "cables", brand: "Voltra", en: "Voltra USB-C to USB-C 100W Braided Cable", bn: "ভোল্ট্রা USB-C টু USB-C ১০০W ব্রেইডেড ক্যাবল", price: 590,
    compatible: ["usb_c", "android", "iphone", ...COMPUTERS, "switch"], warranty: 6, images: img("voltra-usb-c-cable"), origin: "Imported (China)",
    descEn: "A braided 100W USB-C cable with an e-marker chip, so laptops get their full charging power. The nylon braid and strain-relief collars are tested to 20,000 bends by the maker.",
    descBn: "ই-মার্কার চিপসহ ব্রেইডেড ১০০W USB-C ক্যাবল, তাই ল্যাপটপ পুরো চার্জিং শক্তি পায়। নাইলন ব্রেইড ও স্ট্রেইন-রিলিফ কলার উৎপাদকের পরীক্ষায় ২০,০০০ বার বাঁকানো পর্যন্ত টেকে।",
    specs: [["wattage", "100 W (20 V / 5 A), e-marker"], ["connectivity", "USB 2.0 data, 480 Mbps"], ["length", "1 m or 2 m"], ["material", "Nylon braid, aluminium connectors"]],
    highlights: [{ name: "100 W", en: "Full speed for laptops and power banks", bn: "ল্যাপটপ ও পাওয়ার ব্যাংকে পুরো গতি" }],
    boxEn: "1 cable with a cable tie", boxBn: "ক্যাবল টাইসহ ১টি ক্যাবল",
    variants: [{ size: "1 m", color: "Black", stock: 45, lots: [lot("PO-2607-060", 45)] }, { size: "2 m", color: "Black", stock: 20, price: 690, lots: [lot("PO-2607-060", 20)] }],
  },
  {
    slug: "voltra-usb-c-lightning-cable", cat: "cables", brand: "Voltra", en: "Voltra USB-C to Lightning Fast-Charge Cable", bn: "ভোল্ট্রা USB-C টু লাইটনিং ফাস্ট-চার্জ ক্যাবল", price: 690,
    compatible: ["iphone", "lightning"], warranty: 6, images: img("voltra-lightning-cable"), origin: "Imported (China)",
    descEn: "Fast-charges iPhone 8 to iPhone 14 with a 20W USB-C charger. Braided, with a slim connector that fits through most cases.",
    descBn: "২০W USB-C চার্জার দিয়ে আইফোন ৮ থেকে আইফোন ১৪ ফাস্ট চার্জ করে। ব্রেইডেড, আর বেশিরভাগ কেসের ভেতর দিয়ে ঢোকে এমন সরু কানেক্টর।",
    specs: [["wattage", "Up to 27 W (PD)"], ["connectivity", "USB 2.0 data, 480 Mbps"], ["length", "1 m"], ["compatibility", "iPhone 8 – iPhone 14, iPad with Lightning"], ["material", "Nylon braid"]],
    highlights: [{ name: "Fast charge", en: "With any 20 W USB-C PD charger", bn: "যেকোনো ২০ W USB-C PD চার্জারে" }],
    boxEn: "1 cable", boxBn: "১টি ক্যাবল",
    variants: [{ size: "1 m", color: "White", stock: 30, lots: [lot("PO-2607-060", 30)] }],
  },
  // ------------------------------------------------------------------ mobile accessories
  {
    slug: "shieldr-clear-magnetic-case", cat: "cases", brand: "Shieldr", en: "Shieldr Clear Magnetic Case for iPhone 15", bn: "শিল্ডার ক্লিয়ার ম্যাগনেটিক কেস (আইফোন ১৫)", price: 890, featured: 1,
    compatible: ["iphone"], warranty: 3, images: img("shieldr-clear-case"), origin: "Imported (China)",
    descEn: "A crystal-clear case with a built-in magnet ring, so magnetic chargers, wallets and the MagSnap power bank snap on. Raised edges around the camera and screen; the anti-yellowing coating is rated by the maker for 12 months.",
    descBn: "বিল্ট-ইন ম্যাগনেট রিংসহ ক্রিস্টাল-ক্লিয়ার কেস, তাই ম্যাগনেটিক চার্জার, ওয়ালেট আর ম্যাগস্ন্যাপ পাওয়ার ব্যাংক আটকে যায়। ক্যামেরা ও স্ক্রিনের চারপাশে উঁচু কিনারা; হলদে না হওয়ার কোটিং উৎপাদকের হিসেবে ১২ মাস।",
    specs: [["material", "Polycarbonate back, TPU bumper"], ["compatibility", "iPhone 15 / 15 Pro / 15 Pro Max — pick your model"], ["dimensions", "1.2 mm raised camera lip"], ["weight", "32 g"]],
    highlights: [{ name: "Magnet ring", en: "Works with magnetic chargers and mounts", bn: "ম্যাগনেটিক চার্জার ও মাউন্টে কাজ করে" }, { name: "Raised lip", en: "Camera and screen sit off the table", bn: "ক্যামেরা ও স্ক্রিন টেবিল ছোঁয় না" }],
    boxEn: "1 case", boxBn: "১টি কেস",
    variants: [{ size: "iPhone 15", color: "Clear", stock: 18, lots: [lot("PO-2608-040", 18)] }, { size: "iPhone 15 Pro", color: "Clear", stock: 22, lots: [lot("PO-2608-040", 22)] }, { size: "iPhone 15 Pro Max", color: "Clear", stock: 2, lots: [lot("PO-2608-040", 2)] }],
  },
  {
    slug: "shieldr-rugged-case-galaxy-s24", cat: "cases", brand: "Shieldr", en: "Shieldr Rugged Armor Case for Galaxy S24", bn: "শিল্ডার রাগড আর্মার কেস (গ্যালাক্সি S24)", price: 790,
    compatible: ["android"], warranty: 3, images: img("shieldr-rugged-case"), origin: "Imported (China)",
    descEn: "A matte, grippy rugged case with air-cushion corners and a carbon-texture inner shell. Tested by the maker to 1.8 m drops onto concrete.",
    descBn: "এয়ার-কুশন কোণা আর কার্বন-টেক্সচার ভেতরের খোলসহ ম্যাট, শক্ত করে ধরা যায় এমন রাগড কেস। উৎপাদকের পরীক্ষায় কংক্রিটে ১.৮ মিটার থেকে পড়া সহ্য করে।",
    specs: [["material", "TPU with air-cushion corners"], ["compatibility", "Galaxy S24 / S24+ / S24 Ultra — pick your model"], ["dimensions", "1.5 mm raised camera lip"], ["weight", "38 g"]],
    highlights: [{ name: "1.8 m drop-tested", en: "Maker's test onto concrete", bn: "কংক্রিটে উৎপাদকের পরীক্ষা" }],
    boxEn: "1 case", boxBn: "১টি কেস",
    variants: [{ size: "Galaxy S24", color: "Black", stock: 12, lots: [lot("PO-2608-041", 12)] }, { size: "Galaxy S24+", color: "Black", stock: 8, lots: [lot("PO-2608-041", 8)] }, { size: "Galaxy S24 Ultra", color: "Black", stock: 14, lots: [lot("PO-2608-041", 14)] }],
  },
  {
    slug: "shieldr-tempered-glass-2-pack", cat: "screen-protectors", brand: "Shieldr", en: "Shieldr 9H Tempered Glass (2-Pack) with Install Frame", bn: "শিল্ডার ৯H টেম্পার্ড গ্লাস (২ পিস) — ইনস্টল ফ্রেমসহ", price: 490, delivery: "free",
    compatible: ALL_PHONES, warranty: 0, images: img("shieldr-tempered-glass"), origin: "Imported (China)",
    descEn: "Two 9H tempered-glass protectors with an alignment frame that lines the glass up for you — bubble-free in under a minute. Case-friendly edges.",
    descBn: "অ্যালাইনমেন্ট ফ্রেমসহ দুটি ৯H টেম্পার্ড-গ্লাস প্রটেক্টর — ফ্রেমই গ্লাস মিলিয়ে দেয়, এক মিনিটে বুদবুদ ছাড়া। কেসের সাথে মানানসই কিনারা।",
    specs: [["material", "9H tempered glass, 0.33 mm, oleophobic coating"], ["compatibility", "Pick your model: iPhone 15 / 15 Pro / Galaxy S24"]],
    highlights: [{ name: "Install frame", en: "Lines up the glass for you", bn: "গ্লাস নিজেই মিলিয়ে দেয়" }, { name: "2 in a box", en: "A spare for later", bn: "পরে লাগানোর জন্য বাড়তি একটি" }],
    boxEn: "2 glass protectors, install frame, wet wipe, dry wipe, dust stickers", boxBn: "২টি গ্লাস প্রটেক্টর, ইনস্টল ফ্রেম, ভেজা ও শুকনো ওয়াইপ, ডাস্ট স্টিকার",
    useEn: "Clean the screen with the wet wipe, then the dry wipe; lift any dust with a sticker.\nClip the frame onto the phone.\nPeel the glass, drop it into the frame and press from the centre outwards.",
    useBn: "আগে ভেজা, তারপর শুকনো ওয়াইপ দিয়ে স্ক্রিন পরিষ্কার করুন; ধুলা স্টিকার দিয়ে তুলুন।\nফ্রেমটি ফোনে আটকান।\nগ্লাসের কাগজ তুলে ফ্রেমে বসিয়ে মাঝখান থেকে বাইরের দিকে চাপ দিন।",
    variants: [{ size: "iPhone 15", color: "Clear", stock: 30, lots: [lot("PO-2608-042", 30)] }, { size: "iPhone 15 Pro", color: "Clear", stock: 25, lots: [lot("PO-2608-042", 25)] }, { size: "Galaxy S24", color: "Clear", stock: 20, lots: [lot("PO-2608-042", 20)] }],
  },
  {
    slug: "shieldr-car-vent-holder", cat: "mobile-accessories", brand: "Shieldr", en: "Shieldr Air-Vent Car Phone Holder", bn: "শিল্ডার এয়ার-ভেন্ট কার ফোন হোল্ডার", price: 690,
    compatible: ALL_PHONES, warranty: 6, images: img("shieldr-car-holder"), origin: "Imported (China)",
    descEn: "A one-hand car holder that clamps to the air vent and grips phones from 4.7\" to 6.9\". The hook clip locks behind the vent slat, so it stays put on Dhaka roads.",
    descBn: "এক হাতে ব্যবহারযোগ্য কার হোল্ডার — এয়ার ভেন্টে আটকে ৪.৭\" থেকে ৬.৯\" ফোন ধরে রাখে। হুক ক্লিপ ভেন্টের পাতের পেছনে লক হয়, তাই ঢাকার রাস্তাতেও নড়ে না।",
    specs: [["compatibility", "Phones 4.7\"–6.9\", 60–90 mm wide"], ["material", "ABS, silicone grip pads"], ["weight", "78 g"]],
    highlights: [{ name: "Hook clip", en: "Locks behind the slat", bn: "পাতের পেছনে লক হয়" }],
    boxEn: "Holder with vent clip", boxBn: "ভেন্ট ক্লিপসহ হোল্ডার",
    variants: [{ color: "Black", stock: 16, lots: [lot("PO-2608-043", 16)] }],
  },
  // ------------------------------------------------------------------ gaming
  {
    slug: "nexplay-pro-controller", cat: "gaming", brand: "Nexplay", en: "Nexplay Pro Wireless Controller", bn: "নেক্সপ্লে প্রো ওয়্যারলেস কন্ট্রোলার", price: 3490, sale: 2990, dealDays: 3, featured: 1,
    compatible: ["windows", "laptop", "android", "iphone", "switch"], warranty: 6, images: img("nexplay-pro-controller"), origin: "Imported (China)",
    descEn: "A wireless controller with Hall-effect sticks (no stick drift from worn sensors), two back buttons and adjustable vibration. Works with PC, Nintendo Switch, Android and iPhone.",
    descBn: "হল-ইফেক্ট স্টিকসহ ওয়্যারলেস কন্ট্রোলার (সেন্সর ক্ষয়ে স্টিক ড্রিফট হয় না), দুটি ব্যাক বাটন আর কমানো-বাড়ানো যায় এমন ভাইব্রেশন। পিসি, নিনটেন্ডো সুইচ, অ্যান্ড্রয়েড ও আইফোনে চলে।",
    specs: [["model", "NX-PC2"], ["connectivity", "Bluetooth 5.0, 2.4 GHz dongle, USB-C wired"], ["battery", "1000 mAh"], ["playtime", "Up to 20 h"], ["charging_time", "2.5 h"], ["sensors", "Hall-effect sticks and triggers, 6-axis gyro"], ["compatibility", "Windows 10/11, Switch, Android 9+, iOS 16+"], ["weight", "230 g"]],
    highlights: [{ name: "Hall-effect sticks", en: "Magnetic sensors that don't wear down like ordinary sticks", bn: "সাধারণ স্টিকের মতো ক্ষয় হয় না এমন চুম্বকীয় সেন্সর" }, { name: "2 back buttons", en: "Map jump or reload to your fingers", bn: "জাম্প বা রিলোড আঙুলে সেট করুন" }],
    boxEn: "Controller, 2.4 GHz USB dongle, USB-C cable (1.5 m), user guide, warranty card", boxBn: "কন্ট্রোলার, ২.৪ GHz USB ডঙ্গল, USB-C ক্যাবল (১.৫ মি), ইউজার গাইড, ওয়ারেন্টি কার্ড",
    useEn: "PC: plug in the dongle and press Home.\nSwitch: Home + Y for 3 seconds, then System Settings → Controllers → Change Grip/Order.\nPhone: Home + B for 3 seconds, then pick it in Bluetooth settings.",
    useBn: "পিসি: ডঙ্গল লাগিয়ে Home চাপুন।\nসুইচ: Home + Y ৩ সেকেন্ড, তারপর System Settings → Controllers → Change Grip/Order।\nফোন: Home + B ৩ সেকেন্ড, তারপর ব্লুটুথ সেটিংসে বেছে নিন।",
    caution: BATTERY_CAUTION,
    variants: [{ color: "Black", stock: 11, lots: [lot("PO-2608-050", 11)], serials: 11 }, { color: "White", stock: 7, lots: [lot("PO-2608-050", 7)], serials: 7 }],
  },
  {
    slug: "nexplay-rgb-gaming-mouse", cat: "gaming", brand: "Nexplay", en: "Nexplay RGB Gaming Mouse 12K DPI", bn: "নেক্সপ্লে RGB গেমিং মাউস ১২K DPI", price: 1690,
    compatible: COMPUTERS, warranty: 12, images: img("nexplay-gaming-mouse"), origin: "Imported (China)",
    descEn: "A 62 g lightweight wired gaming mouse with a 12,000 DPI optical sensor, a soft paracord cable and seven programmable buttons. RGB lighting can be switched off.",
    descBn: "৬২ গ্রাম ওজনের হালকা তারযুক্ত গেমিং মাউস — ১২,০০০ DPI অপটিক্যাল সেন্সর, নরম প্যারাকর্ড ক্যাবল আর সাতটি প্রোগ্রামযোগ্য বাটন। RGB লাইট বন্ধ রাখা যায়।",
    specs: [["model", "NX-M12"], ["sensors", "Optical, 200–12,000 DPI, 1000 Hz polling"], ["connectivity", "USB-A wired, 1.8 m paracord cable"], ["compatibility", "Windows, macOS (software on Windows)"], ["weight", "62 g"]],
    highlights: [{ name: "62 g", en: "Light for fast flicks", bn: "দ্রুত নাড়াচাড়ার জন্য হালকা" }, { name: "Paracord cable", en: "Soft cable that doesn't drag", bn: "নরম ক্যাবল, টেনে ধরে না" }],
    boxEn: "Mouse, spare mouse feet, user guide, warranty card", boxBn: "মাউস, বাড়তি মাউস ফিট, ইউজার গাইড, ওয়ারেন্টি কার্ড",
    variants: [{ color: "Black", stock: 17, lots: [lot("PO-2608-051", 17)] }],
  },
  {
    slug: "nexplay-gaming-headset", cat: "gaming", brand: "Nexplay", en: "Nexplay H7 Gaming Headset", bn: "নেক্সপ্লে H7 গেমিং হেডসেট", price: 2790,
    compatible: ["windows", "laptop", "ps5", "xbox", "switch", "android"], warranty: 12, images: img("nexplay-gaming-headset"), origin: "Imported (China)",
    descEn: "A wired gaming headset with 50 mm drivers, a flip-to-mute boom mic and memory-foam cushions. The 3.5 mm plug works with PS5 and Xbox controllers, Switch and phones; the USB adapter adds 7.1 virtual surround on PC.",
    descBn: "৫০ মিমি ড্রাইভার, উল্টে দিলে মিউট হয় এমন বুম মাইক আর মেমোরি-ফোম কুশনসহ তারযুক্ত গেমিং হেডসেট। ৩.৫ মিমি প্লাগ PS5 ও এক্সবক্স কন্ট্রোলার, সুইচ ও ফোনে চলে; পিসিতে USB অ্যাডাপ্টারে ৭.১ ভার্চুয়াল সারাউন্ড।",
    specs: [["model", "NX-H7"], ["driver", "50 mm dynamic"], ["microphone", "Flip-to-mute boom mic"], ["connectivity", "3.5 mm (4-pole), USB 7.1 adapter"], ["length", "1.2 m cable + 1 m extension"], ["weight", "290 g"]],
    highlights: [{ name: "Works everywhere", en: "PS5, Xbox, Switch, PC and phone", bn: "PS5, এক্সবক্স, সুইচ, পিসি ও ফোনে" }, { name: "Flip-to-mute", en: "Raise the mic to mute", bn: "মাইক তুললেই মিউট" }],
    boxEn: "Headset, USB 7.1 adapter, 3.5 mm splitter, warranty card", boxBn: "হেডসেট, USB ৭.১ অ্যাডাপ্টার, ৩.৫ মিমি স্প্লিটার, ওয়ারেন্টি কার্ড",
    variants: [{ color: "Black", stock: 10, lots: [lot("PO-2608-051", 10)] }],
  },
  // ------------------------------------------------------------------ smart home
  {
    slug: "lumio-smart-plug-16a", cat: "smart-home", brand: "Lumio", en: "Lumio Wi-Fi Smart Plug 16A with Energy Meter", bn: "লুমিও ওয়াই-ফাই স্মার্ট প্লাগ ১৬A (এনার্জি মিটারসহ)", price: 1190,
    compatible: ALL_PHONES, warranty: 12, images: img("lumio-smart-plug"), origin: "Imported (China)",
    descEn: "Turn the AC, water heater or geyser on and off from your phone, set schedules and see how many units it uses. 16A rated, with a universal socket for Bangladesh plugs.",
    descBn: "ফোন থেকে এসি, ওয়াটার হিটার বা গিজার চালু-বন্ধ করুন, সময়সূচি দিন আর কত ইউনিট খরচ হলো দেখুন। ১৬A রেটেড, বাংলাদেশের প্লাগের জন্য ইউনিভার্সাল সকেট।",
    specs: [["model", "LM-P16"], ["wattage", "Up to 3500 W (16 A)"], ["input", "220–240 V AC"], ["connectivity", "Wi-Fi 2.4 GHz"], ["compatibility", "Lumio app (Android / iOS), Google Home, Alexa"], ["sensors", "Energy meter (kWh)"]],
    highlights: [{ name: "Energy meter", en: "See units used per day", bn: "প্রতিদিন কত ইউনিট খরচ দেখুন" }, { name: "16 A", en: "Rated for ACs and geysers", bn: "এসি ও গিজারের জন্য রেটেড" }],
    boxEn: "Smart plug, user guide, warranty card", boxBn: "স্মার্ট প্লাগ, ইউজার গাইড, ওয়ারেন্টি কার্ড",
    useEn: "Install the Lumio app and connect your phone to your 2.4 GHz Wi-Fi.\nPlug in the smart plug and hold its button for 5 seconds until it blinks fast.\nTap \"+\" in the app and follow the steps.",
    useBn: "লুমিও অ্যাপ ইনস্টল করে ফোন ২.৪ GHz ওয়াই-ফাইতে যুক্ত করুন।\nস্মার্ট প্লাগ লাগিয়ে দ্রুত জ্বলা পর্যন্ত বাটন ৫ সেকেন্ড চেপে ধরুন।\nঅ্যাপে \"+\" চেপে ধাপগুলো অনুসরণ করুন।",
    caution: { en: "Don't exceed 16 A. Not for outdoor use.", bn: "১৬ A এর বেশি লোড দেবেন না। বাইরে ব্যবহারের জন্য নয়।" },
    variants: [{ color: "White", stock: 22, lots: [lot("PO-2608-060", 22)] }],
  },
  {
    slug: "lumio-smart-bulb-12w", cat: "smart-home", brand: "Lumio", en: "Lumio 12W RGB Smart LED Bulb", bn: "লুমিও ১২W RGB স্মার্ট LED বাল্ব", price: 790,
    compatible: ALL_PHONES, warranty: 12, images: img("lumio-smart-bulb"), origin: "Imported (China)",
    descEn: "A B22 smart bulb with 16 million colours and warm-to-cool white. Dim it, schedule it or switch it off from bed.",
    descBn: "১ কোটি ৬০ লাখ রঙ আর উষ্ণ থেকে ঠান্ডা সাদা আলোর B22 স্মার্ট বাল্ব। বিছানা থেকেই কমান, সময় ঠিক করুন বা বন্ধ করুন।",
    specs: [["model", "LM-B12"], ["wattage", "12 W (≈ 1050 lm)"], ["input", "220–240 V AC, B22 base"], ["connectivity", "Wi-Fi 2.4 GHz + Bluetooth"], ["compatibility", "Lumio app, Google Home, Alexa"]],
    highlights: [{ name: "B22 base", en: "Fits the common bayonet holder", bn: "সাধারণ বেয়নেট হোল্ডারে লাগে" }],
    boxEn: "1 bulb", boxBn: "১টি বাল্ব",
    variants: [{ color: "White", stock: 35, lots: [lot("PO-2608-060", 35)] }],
  },
  {
    slug: "lumio-2k-indoor-camera", cat: "smart-home", brand: "Lumio", en: "Lumio 2K Wi-Fi Pan & Tilt Indoor Camera", bn: "লুমিও ২K ওয়াই-ফাই প্যান ও টিল্ট ইনডোর ক্যামেরা", price: 3290, featured: 1,
    compatible: ALL_PHONES, warranty: 12, images: img("lumio-indoor-camera"), origin: "Imported (China)",
    descEn: "Keep an eye on the shop, the baby or the front door from anywhere: 2K video, 360° pan, night vision and two-way talk. Recordings go to a microSD card in the camera — no monthly subscription needed.",
    descBn: "যেকোনো জায়গা থেকে দোকান, শিশু বা সদর দরজার দিকে খেয়াল রাখুন: ২K ভিডিও, ৩৬০° প্যান, নাইট ভিশন আর দুই দিকে কথা। রেকর্ডিং ক্যামেরার মাইক্রোএসডি কার্ডে থাকে — মাসিক সাবস্ক্রিপশন লাগে না।",
    specs: [["model", "LM-C2K"], ["display", "2K (2304 × 1296) video"], ["sensors", "Motion and sound detection, IR night vision to 10 m"], ["connectivity", "Wi-Fi 2.4 GHz"], ["input", "5 V / 1 A USB-C"], ["compatibility", "Lumio app (Android / iOS)"], ["in_box", "microSD up to 256 GB (card not included)"]],
    highlights: [{ name: "No subscription", en: "Records to a microSD card", bn: "মাইক্রোএসডি কার্ডে রেকর্ড" }, { name: "360° pan", en: "Turn it from the app", bn: "অ্যাপ থেকে ঘোরান" }],
    boxEn: "Camera, USB-C cable, 5 V adapter, ceiling mount and screws, warranty card", boxBn: "ক্যামেরা, USB-C ক্যাবল, ৫ V অ্যাডাপ্টার, সিলিং মাউন্ট ও স্ক্রু, ওয়ারেন্টি কার্ড",
    useEn: "Insert a microSD card (optional) and power the camera.\nIn the Lumio app tap \"+\", then scan the QR code shown on your phone with the camera.\nRecordings stay on the card; set who can view them in the app.",
    useBn: "মাইক্রোএসডি কার্ড দিন (ঐচ্ছিক) আর ক্যামেরা চালু করুন।\nলুমিও অ্যাপে \"+\" চেপে ফোনে দেখানো QR কোড ক্যামেরা দিয়ে স্ক্যান করুন।\nরেকর্ডিং কার্ডেই থাকে; কে দেখতে পারবে অ্যাপে ঠিক করুন।",
    caution: { en: "Tell people when a room is recorded, and follow the law on recording in shared or public spaces.", bn: "কোনো ঘরে রেকর্ড হলে মানুষকে জানান, আর যৌথ বা পাবলিক জায়গায় রেকর্ডিংয়ের আইন মেনে চলুন।" },
    variants: [{ color: "White", stock: 9, lots: [lot("PO-2608-061", 9)], serials: 9 }],
  },
  // ------------------------------------------------------------------ computer accessories
  {
    slug: "keyra-k3-keyboard-mouse-combo", cat: "computer-accessories", brand: "Keyra", en: "Keyra K3 Wireless Keyboard & Mouse Combo", bn: "কেইরা K3 ওয়্যারলেস কিবোর্ড ও মাউস কম্বো", price: 2490,
    compatible: COMPUTERS, warranty: 12, images: img("keyra-k3-combo"), origin: "Imported (China)",
    descEn: "A quiet, full-size wireless keyboard with Bangla-printed keycaps, and a matching silent-click mouse — one tiny USB receiver for both.",
    descBn: "বাংলা লেখা কি-ক্যাপসহ নিঃশব্দ, পূর্ণ আকারের ওয়্যারলেস কিবোর্ড আর মানানসই সাইলেন্ট-ক্লিক মাউস — দুটোর জন্য একটি ছোট USB রিসিভার।",
    specs: [["model", "KR-K3"], ["connectivity", "2.4 GHz USB-A receiver, range 10 m"], ["battery", "Keyboard 2 × AAA, mouse 1 × AA (included)"], ["playtime", "Up to 12 months (keyboard)"], ["sensors", "Mouse 800 / 1200 / 1600 DPI"], ["compatibility", "Windows, macOS, ChromeOS"]],
    highlights: [{ name: "Bangla keycaps", en: "Bijoy layout printed beside English", bn: "ইংরেজির পাশে বিজয় লেআউট লেখা" }, { name: "Silent clicks", en: "Office and late-night friendly", bn: "অফিস ও রাতে কাজের উপযোগী" }],
    boxEn: "Keyboard, mouse, USB receiver (stored in the mouse), batteries, warranty card", boxBn: "কিবোর্ড, মাউস, USB রিসিভার (মাউসের ভেতরে রাখা), ব্যাটারি, ওয়ারেন্টি কার্ড",
    variants: [{ color: "Black", stock: 14, lots: [lot("PO-2608-070", 14)] }, { color: "White", stock: 8, lots: [lot("PO-2608-070", 8)] }],
  },
  {
    slug: "keyra-7-in-1-usb-c-hub", cat: "computer-accessories", brand: "Keyra", en: "Keyra 7-in-1 USB-C Hub with 4K HDMI", bn: "কেইরা ৭-ইন-১ USB-C হাব (৪K HDMI)", price: 2990,
    compatible: ["laptop", "mac", "windows", "usb_c"], warranty: 12, images: img("keyra-usb-c-hub"), origin: "Imported (China)",
    descEn: "Turns one USB-C port into HDMI 4K, three USB-A 3.0 ports, SD and microSD slots and 100W pass-through charging. Aluminium body that stays cool on the desk.",
    descBn: "একটি USB-C পোর্টকে HDMI ৪K, তিনটি USB-A ৩.০ পোর্ট, SD ও মাইক্রোএসডি স্লট আর ১০০W পাস-থ্রু চার্জিংয়ে বদলে দেয়। অ্যালুমিনিয়াম বডি, ডেস্কে ঠান্ডা থাকে।",
    specs: [["model", "KR-H7"], ["ports", "HDMI (4K 30 Hz), 3 × USB-A 3.0, SD, microSD, USB-C PD in"], ["wattage", "100 W pass-through (85 W to the laptop)"], ["connectivity", "USB-C 3.1, 5 Gbps"], ["compatibility", "MacBook, Windows and ChromeOS laptops with a full-function USB-C port"], ["material", "Aluminium"], ["weight", "68 g"]],
    highlights: [{ name: "4K HDMI", en: "Plug in a monitor or TV", bn: "মনিটর বা টিভি লাগান" }, { name: "100 W PD in", en: "Charge the laptop through the hub", bn: "হাবের মাধ্যমেই ল্যাপটপ চার্জ" }],
    boxEn: "Hub, user guide, warranty card", boxBn: "হাব, ইউজার গাইড, ওয়ারেন্টি কার্ড",
    useEn: "Check your laptop's USB-C port supports video (DisplayPort Alt Mode) — look for the DP or Thunderbolt mark.\nPlug the laptop's own charger into the hub's PD port to charge through it.",
    useBn: "আপনার ল্যাপটপের USB-C পোর্টে ভিডিও (ডিসপ্লেপোর্ট অল্ট মোড) সাপোর্ট আছে কি না দেখুন — DP বা থান্ডারবোল্ট চিহ্ন।\nহাবের মাধ্যমে চার্জ দিতে ল্যাপটপের নিজের চার্জার হাবের PD পোর্টে লাগান।",
    variants: [{ color: "Grey", stock: 12, lots: [lot("PO-2608-070", 12)] }],
  },
  {
    slug: "keyra-portable-ssd-1tb", cat: "computer-accessories", brand: "Keyra", en: "Keyra 1TB Portable SSD (USB-C, 1050 MB/s)", bn: "কেইরা ১TB পোর্টেবল SSD (USB-C, ১০৫০ MB/s)", price: 8990,
    compatible: [...COMPUTERS, "usb_c", "android", "iphone", "ps5", "xbox"], warranty: 36, images: img("keyra-portable-ssd"), origin: "Imported (Taiwan)",
    descEn: "Pocket-size 1TB SSD with read speeds up to 1050 MB/s — a 4K film copies in under 30 seconds. Works with laptops, iPhone 15 (USB-C) for ProRes video, Android phones, PS5 and Xbox.",
    descBn: "পকেট সাইজ ১TB SSD — রিড স্পিড ১০৫০ MB/s পর্যন্ত, একটি ৪K সিনেমা ৩০ সেকেন্ডের কমে কপি হয়। ল্যাপটপ, আইফোন ১৫ (USB-C) তে ProRes ভিডিও, অ্যান্ড্রয়েড ফোন, PS5 ও এক্সবক্সে চলে।",
    specs: [["model", "KR-SSD1T"], ["capacity", "1 TB (formatted ≈ 931 GB)"], ["connectivity", "USB-C 3.2 Gen 2, 10 Gbps"], ["wattage", "Read up to 1050 MB/s, write up to 1000 MB/s"], ["ports", "USB-C (USB-C to C and C to A cables included)"], ["material", "Aluminium with rubber bumper"], ["water", "IP55 (dust and splashes)"], ["dimensions", "85 × 55 × 10 mm"], ["weight", "52 g"]],
    highlights: [{ name: "1050 MB/s", en: "About 9× a USB 3.0 hard drive", bn: "USB ৩.০ হার্ডড্রাইভের প্রায় ৯ গুণ" }, { name: "3-year warranty", en: "Against the invoice", bn: "ইনভয়েসের ভিত্তিতে" }],
    boxEn: "SSD, USB-C to USB-C cable, USB-C to USB-A cable, warranty card", boxBn: "SSD, USB-C টু USB-C ক্যাবল, USB-C টু USB-A ক্যাবল, ওয়ারেন্টি কার্ড",
    useEn: "Plug it in — it is ready to use on Windows and macOS (exFAT).\nBack up anything important before reformatting it for a console.",
    useBn: "লাগালেই উইন্ডোজ ও ম্যাকে ব্যবহারযোগ্য (exFAT)।\nকনসোলের জন্য ফরম্যাট করার আগে জরুরি সব ব্যাকআপ নিন।",
    caution: { en: "Data recovery is not covered by the warranty — keep a second copy of important files.", bn: "ডেটা পুনরুদ্ধার ওয়ারেন্টির আওতায় নেই — জরুরি ফাইলের দ্বিতীয় কপি রাখুন।" },
    variants: [{ color: "Black", stock: 6, lots: [lot("PO-2608-071", 6)], serials: 6 }],
  },
  // ------------------------------------------------------------------ bundles / combo deals
  {
    slug: "iphone-charging-combo", cat: "mobile-accessories", brand: "Gadget Market", en: "iPhone Charging Combo: 20W Charger + Lightning Cable + Glass", bn: "আইফোন চার্জিং কম্বো: ২০W চার্জার + লাইটনিং ক্যাবল + গ্লাস", price: 1890, featured: 1,
    compatible: ["iphone", "lightning"], warranty: 12, images: img("iphone-charging-combo"), origin: "Packed in Dhaka",
    descEn: "Everything a new (or new-to-you) iPhone 14 or earlier needs on day one: the 20W USB-C fast charger, a braided USB-C to Lightning cable and a 2-pack of tempered glass with the install frame.",
    descBn: "নতুন (বা হাতে আসা) আইফোন ১৪ বা আগের মডেলের প্রথম দিনের সব কিছু: ২০W USB-C ফাস্ট চার্জার, ব্রেইডেড USB-C টু লাইটনিং ক্যাবল আর ইনস্টল ফ্রেমসহ ২ পিস টেম্পার্ড গ্লাস।",
    specs: [["in_box", "Voltra 20W USB-C PD Charger, Voltra USB-C to Lightning Cable (1 m), Shieldr 9H Tempered Glass 2-pack"], ["wattage", "20 W USB-C PD"], ["compatibility", "iPhone 8 – iPhone 14 (glass: tell us your model in the order note)"]],
    highlights: [],
    boxEn: "3 products, each in its own retail box with its own warranty card", boxBn: "৩টি পণ্য, প্রতিটি নিজস্ব রিটেইল বক্সে ও নিজস্ব ওয়ারেন্টি কার্ডসহ",
    useEn: "Follow the guide in each product's box.", useBn: "প্রতিটি পণ্যের বক্সের গাইড অনুসরণ করুন।",
    bundle: [{ slug: "voltra-20w-usb-c-charger", qty: 1 }, { slug: "voltra-usb-c-lightning-cable", qty: 1 }, { slug: "shieldr-tempered-glass-2-pack", qty: 1 }],
    variants: [{ size: "Combo (3 items)", color: "", stock: 12, lots: [lot("CMB-2609-01", 12)] }],
  },
  {
    slug: "laptop-power-combo", cat: "power", brand: "Gadget Market", en: "Laptop Power Combo: 65W GaN + 100W Cable + 7-in-1 Hub", bn: "ল্যাপটপ পাওয়ার কম্বো: ৬৫W GaN + ১০০W ক্যাবল + ৭-ইন-১ হাব", price: 6290,
    compatible: ["laptop", "mac", "windows", "usb_c"], warranty: 12, images: img("laptop-power-combo"), origin: "Packed in Dhaka",
    descEn: "A complete USB-C desk kit: the 65W GaN charger, a 1 m 100W braided cable and the 7-in-1 hub with 4K HDMI — charge the laptop through the hub and plug in a monitor with one cable.",
    descBn: "সম্পূর্ণ USB-C ডেস্ক কিট: ৬৫W GaN চার্জার, ১ মিটার ১০০W ব্রেইডেড ক্যাবল আর ৪K HDMI সহ ৭-ইন-১ হাব — হাবের মাধ্যমে ল্যাপটপ চার্জ দিন আর এক ক্যাবলেই মনিটর লাগান।",
    specs: [["in_box", "Voltra 65W GaN 3-Port Charger, Voltra USB-C 100W Braided Cable (1 m), Keyra 7-in-1 USB-C Hub"], ["wattage", "65 W (charger), 100 W (cable)"], ["compatibility", "Laptops that charge over USB-C"]],
    highlights: [],
    boxEn: "3 products, each in its own retail box with its own warranty card", boxBn: "৩টি পণ্য, প্রতিটি নিজস্ব রিটেইল বক্সে ও নিজস্ব ওয়ারেন্টি কার্ডসহ",
    useEn: "Follow the guide in each product's box.", useBn: "প্রতিটি পণ্যের বক্সের গাইড অনুসরণ করুন।",
    bundle: [{ slug: "voltra-gan-65w", qty: 1 }, { slug: "voltra-usb-c-cable-100w", qty: 1 }, { slug: "keyra-7-in-1-usb-c-hub", qty: 1 }],
    variants: [{ size: "Combo (3 items)", color: "", stock: 6, lots: [lot("CMB-2609-02", 6)] }],
  },
  {
    slug: "gaming-starter-combo", cat: "gaming", brand: "Gadget Market", en: "Gaming Starter Combo: Controller + Headset + Mouse", bn: "গেমিং স্টার্টার কম্বো: কন্ট্রোলার + হেডসেট + মাউস", price: 7290,
    compatible: ["windows", "laptop", "switch", "android"], warranty: 6, images: img("gaming-starter-combo"), origin: "Packed in Dhaka",
    descEn: "Set up a PC gaming corner in one order: the Nexplay Pro wireless controller, the H7 headset with boom mic and the 62 g RGB gaming mouse.",
    descBn: "এক অর্ডারেই পিসি গেমিং কর্নার: নেক্সপ্লে প্রো ওয়্যারলেস কন্ট্রোলার, বুম মাইকসহ H7 হেডসেট আর ৬২ গ্রামের RGB গেমিং মাউস।",
    specs: [["in_box", "Nexplay Pro Wireless Controller (Black), Nexplay H7 Gaming Headset, Nexplay RGB Gaming Mouse"], ["compatibility", "Windows PC; controller also Switch and Android"]],
    highlights: [],
    boxEn: "3 products, each in its own retail box with its own warranty card", boxBn: "৩টি পণ্য, প্রতিটি নিজস্ব রিটেইল বক্সে ও নিজস্ব ওয়ারেন্টি কার্ডসহ",
    useEn: "Follow the guide in each product's box.", useBn: "প্রতিটি পণ্যের বক্সের গাইড অনুসরণ করুন।",
    bundle: [{ slug: "nexplay-pro-controller", qty: 1 }, { slug: "nexplay-gaming-headset", qty: 1 }, { slug: "nexplay-rgb-gaming-mouse", qty: 1 }],
    variants: [{ size: "Combo (3 items)", color: "", stock: 4, lots: [lot("CMB-2609-03", 4)] }],
  },
];

/**
 * Trust badges the shop may show. Deliberately WITHOUT documents: a badge only appears once the owner attaches real
 * proof (business-wide here, or per product in the product form).
 */
export const certificationTypes = [
  { code: "official_warranty", en: "Official brand warranty", bn: "অফিসিয়াল ব্র্যান্ড ওয়ারেন্টি", icon: "shield", descEn: "Covered by the brand's own service centre in Bangladesh, not only by the shop.", descBn: "শুধু দোকান নয়, বাংলাদেশে ব্র্যান্ডের নিজস্ব সার্ভিস সেন্টারের আওতায়।" },
  { code: "btrc", en: "BTRC type approved", bn: "বিটিআরসি অনুমোদিত", icon: "check", issuer: "BTRC", descEn: "The wireless device has Bangladesh Telecommunication Regulatory Commission type approval.", descBn: "ওয়্যারলেস ডিভাইসটি বাংলাদেশ টেলিযোগাযোগ নিয়ন্ত্রণ কমিশনের টাইপ অনুমোদনপ্রাপ্ত।" },
  { code: "authorised", en: "Authorised distributor", bn: "অনুমোদিত পরিবেশক", icon: "star", descEn: "Bought from the brand's authorised distributor, with the distribution letter on file.", descBn: "ব্র্যান্ডের অনুমোদিত পরিবেশকের কাছ থেকে কেনা, পরিবেশন চিঠি সংরক্ষিত।" },
  { code: "qc_tested", en: "Tested before dispatch", bn: "পাঠানোর আগে পরীক্ষিত", icon: "flask", descEn: "Each unit is powered on, paired and checked in the shop before it is packed — with the test sheet on file.", descBn: "প্যাক করার আগে প্রতিটি ইউনিট দোকানে চালু, পেয়ার ও যাচাই করা হয় — টেস্ট শিট সংরক্ষিত।" },
];

/** device: the "works with" code this collection is for (or null). */
export const collections = [
  {
    slug: "iphone-essentials", en: "iPhone Essentials", bn: "আইফোন এসেনশিয়ালস", device: "iphone", featured: 1, image: "/img/products/voltra-magsnap-5000.webp",
    descEn: "The 20W charger, a magnetic case, a MagSnap power bank and glass — the four things every iPhone owner ends up buying.",
    descBn: "২০W চার্জার, ম্যাগনেটিক কেস, ম্যাগস্ন্যাপ পাওয়ার ব্যাংক আর গ্লাস — প্রতিটি আইফোন ব্যবহারকারী শেষমেশ যে চারটি কেনেন।",
    products: ["voltra-20w-usb-c-charger", "shieldr-clear-magnetic-case", "voltra-magsnap-5000", "shieldr-tempered-glass-2-pack", "sonix-buds-pro"],
  },
  {
    slug: "android-essentials", en: "Android Essentials", bn: "অ্যান্ড্রয়েড এসেনশিয়ালস", device: "android", featured: 1, image: "/img/products/voltra-powerbank-10000.webp",
    descEn: "Fast charging, a rugged case, glass and earbuds for Galaxy, Pixel, Xiaomi and realme phones.",
    descBn: "গ্যালাক্সি, পিক্সেল, শাওমি ও রিয়েলমি ফোনের জন্য ফাস্ট চার্জিং, রাগড কেস, গ্লাস ও ইয়ারবাড।",
    products: ["voltra-powerbank-10000", "shieldr-rugged-case-galaxy-s24", "shieldr-tempered-glass-2-pack", "sonix-buds-lite", "voltra-wireless-pad-15w"],
  },
  {
    slug: "laptop-desk-setup", en: "Laptop Desk Setup", bn: "ল্যাপটপ ডেস্ক সেটআপ", device: "laptop", featured: 1, image: "/img/products/keyra-usb-c-hub.webp",
    descEn: "One USB-C cable from the laptop to everything: hub, monitor, keyboard, mouse and a charger that fits in your bag.",
    descBn: "ল্যাপটপ থেকে এক USB-C ক্যাবলে সব কিছু: হাব, মনিটর, কিবোর্ড, মাউস আর ব্যাগে রাখার মতো চার্জার।",
    products: ["keyra-7-in-1-usb-c-hub", "keyra-k3-keyboard-mouse-combo", "voltra-gan-65w", "voltra-usb-c-cable-100w", "keyra-portable-ssd-1tb"],
  },
  {
    slug: "load-shedding-kit", en: "Ready for Load-Shedding", bn: "লোডশেডিংয়ের প্রস্তুতি", device: null, featured: 0, image: "/img/products/voltra-powerbank-20000.webp",
    descEn: "Keep the phone, the router and the laptop going when the power goes out.",
    descBn: "বিদ্যুৎ চলে গেলে ফোন, রাউটার আর ল্যাপটপ চালু রাখুন।",
    products: ["voltra-powerbank-20000-65w", "voltra-powerbank-10000", "sonix-boom-mini"],
  },
  {
    slug: "smart-home-starter", en: "Smart Home Starter", bn: "স্মার্ট হোম স্টার্টার", device: null, featured: 0, image: "/img/products/lumio-indoor-camera.webp",
    descEn: "A plug for the geyser, a bulb for the bedroom and a camera for the front door — all in one app.",
    descBn: "গিজারের জন্য প্লাগ, শোবার ঘরের জন্য বাল্ব আর সদর দরজার জন্য ক্যামেরা — সব এক অ্যাপে।",
    products: ["lumio-smart-plug-16a", "lumio-smart-bulb-12w", "lumio-2k-indoor-camera"],
  },
];

/** Starter tech guides (plain text; a blank line starts a new paragraph). */
export const posts = [
  {
    slug: "how-many-watts-does-your-phone-need", author: "Gadget Market team", daysAgo: 18, cover: "/img/products/voltra-gan-65w.webp",
    titleEn: "How many watts does your phone actually need?", titleBn: "আপনার ফোনের আসলে কত ওয়াট দরকার?",
    excerptEn: "20W, 33W, 65W — what the numbers mean, and why a bigger charger is safe but not always faster.", excerptBn: "২০W, ৩৩W, ৬৫W — সংখ্যাগুলোর মানে কী, আর বড় চার্জার কেন নিরাপদ কিন্তু সবসময় দ্রুত নয়।",
    bodyEn: "A phone only takes as much power as it was designed for. An iPhone 15 charges at about 20W; many Samsung phones at 25W; some Android phones at 33W or more using their own charging standard.\n\nUsing a bigger USB-C PD charger is safe: the phone and charger agree on the power before charging starts, so a 65W charger simply gives your phone the 20W it asks for — and still has power left for your earbuds or laptop.\n\nThe cable matters too. Phones are fine with ordinary USB-C cables, but laptops above 60W need a cable with an e-marker chip rated for 100W, or they fall back to a slower speed.\n\nEvery charger and cable on our shop lists its wattage on the spec sheet. If you are not sure what your phone supports, message us your model and we will tell you.",
    bodyBn: "ফোন যতটুকু শক্তি নেওয়ার জন্য তৈরি, ঠিক ততটুকুই নেয়। আইফোন ১৫ প্রায় ২০W এ চার্জ হয়; অনেক স্যামসাং ফোন ২৫W এ; কিছু অ্যান্ড্রয়েড ফোন নিজস্ব চার্জিং স্ট্যান্ডার্ডে ৩৩W বা তার বেশিতে।\n\nবড় USB-C PD চার্জার ব্যবহার নিরাপদ: চার্জ শুরুর আগে ফোন ও চার্জার শক্তির পরিমাণে একমত হয়, তাই ৬৫W চার্জার আপনার ফোনকে শুধু তার চাওয়া ২০W দেয় — আর ইয়ারবাড বা ল্যাপটপের জন্য বাকি শক্তি থেকে যায়।\n\nক্যাবলও গুরুত্বপূর্ণ। ফোনের জন্য সাধারণ USB-C ক্যাবল যথেষ্ট, কিন্তু ৬০W এর বেশি ল্যাপটপের জন্য ১০০W রেটেড ই-মার্কার চিপসহ ক্যাবল লাগে, নইলে গতি কমে যায়।\n\nআমাদের দোকানের প্রতিটি চার্জার ও ক্যাবলের স্পেক শিটে ওয়াট লেখা আছে। আপনার ফোন কত সাপোর্ট করে নিশ্চিত না হলে মডেলটি মেসেজ করুন, আমরা জানিয়ে দেবো।",
    products: ["voltra-20w-usb-c-charger", "voltra-gan-65w", "voltra-usb-c-cable-100w"],
  },
  {
    slug: "ip-ratings-explained", author: "Gadget Market team", daysAgo: 9, cover: "/img/products/sonix-boom-mini.webp",
    titleEn: "IPX4, IPX7, IP68: what water resistance ratings really mean", titleBn: "IPX4, IPX7, IP68: পানি প্রতিরোধের রেটিংয়ের আসল মানে",
    excerptEn: "Why we always give the exact IP rating — and which rating survives rain, sweat or a dunk in the pool.", excerptBn: "আমরা কেন কখনো \"ওয়াটারপ্রুফ\" লিখি না — আর কোন রেটিং বৃষ্টি, ঘাম বা পুলে পড়া সামলায়।",
    bodyEn: "An IP rating has two digits: the first is dust, the second is water. An X means that part was not tested.\n\nIPX4 means splashes from any direction — sweat at the gym, a light drizzle. IPX5 adds a jet of water. IPX7 means the device survived 1 metre of still fresh water for 30 minutes in the test. IP68 adds full dust protection and deeper water, as set by the maker.\n\nNone of these ratings cover hot water, soap, sea water or pressure from jumping into a pool, and seals wear with age. That is why we list the exact rating instead of a blanket promise, and why water damage beyond the stated rating is not covered by warranty.\n\nIf a product got wet, dry the charging port completely before you plug it in.",
    bodyBn: "IP রেটিংয়ে দুটি সংখ্যা থাকে: প্রথমটি ধুলা, দ্বিতীয়টি পানি। X মানে সেই অংশ পরীক্ষা করা হয়নি।\n\nIPX4 মানে যেকোনো দিক থেকে ছিটা — জিমের ঘাম, হালকা গুঁড়ি বৃষ্টি। IPX5 এ পানির ধারাও সামলায়। IPX7 মানে পরীক্ষায় ডিভাইসটি ১ মিটার স্থির মিঠা পানিতে ৩০ মিনিট টিকেছে। IP68 এ পুরো ধুলা সুরক্ষা আর উৎপাদকের ঠিক করা আরও গভীর পানি।\n\nএর কোনোটিই গরম পানি, সাবান, সমুদ্রের পানি বা পুলে লাফ দেওয়ার চাপ কভার করে না, আর সময়ের সাথে সিল দুর্বল হয়। তাই আমরা \"ওয়াটারপ্রুফ\" শব্দের বদলে সঠিক রেটিং লিখি, আর উল্লেখিত রেটিংয়ের বেশি পানিতে ক্ষতি ওয়ারেন্টির আওতায় নেই।\n\nকোনো পণ্য ভিজে গেলে চার্জ দেওয়ার আগে চার্জিং পোর্ট পুরো শুকিয়ে নিন।",
    products: ["sonix-boom-mini", "sonix-buds-pro", "arcwave-band-5"],
  },
  {
    slug: "how-warranty-claims-work", author: "Gadget Market team", daysAgo: 3, cover: "/img/products/arcwave-watch-s2.webp",
    titleEn: "How our warranty works — and how to make a claim", titleBn: "আমাদের ওয়ারেন্টি কীভাবে কাজ করে — আর কীভাবে ক্লেইম করবেন",
    excerptEn: "Your invoice is your warranty card. Here is what is covered, and the four steps of a claim.", excerptBn: "আপনার ইনভয়েসই আপনার ওয়ারেন্টি কার্ড। কী কভার করে, আর ক্লেইমের চারটি ধাপ।",
    bodyEn: "Every product page shows its warranty in months, and the same number is printed next to the item on your invoice. The warranty runs from the day the parcel was delivered, so keep the invoice — you can always download it again from your account.\n\nWarranty covers manufacturing faults: a power bank that stops charging, an earbud that goes silent, a watch that won't turn on. It does not cover drops, cracked screens, water beyond the stated IP rating, or a unit that has been opened or repaired elsewhere.\n\nTo claim, open My account → Warranty, pick the item and tell us what happens in a sentence or two. If we logged the unit's serial number when we packed it, the claim is matched to it automatically.\n\nYour claim then moves through four steps — Submitted, Under review, Approved or Rejected, and Resolved — and you get an SMS at each one. Most claims are resolved with a repair or a replacement within 7 to 10 working days.",
    bodyBn: "প্রতিটি পণ্যের পাতায় ওয়ারেন্টি মাসে দেখানো থাকে, আর একই সংখ্যা আপনার ইনভয়েসে পণ্যের পাশে ছাপা থাকে। পার্সেল ডেলিভারির দিন থেকে ওয়ারেন্টি শুরু, তাই ইনভয়েস রাখুন — অ্যাকাউন্ট থেকে যেকোনো সময় আবার ডাউনলোড করা যায়।\n\nওয়ারেন্টি ম্যানুফ্যাকচারিং ত্রুটি কভার করে: চার্জ না নেওয়া পাওয়ার ব্যাংক, শব্দ বন্ধ হয়ে যাওয়া ইয়ারবাড, চালু না হওয়া ঘড়ি। পড়ে যাওয়া, ফাটা স্ক্রিন, উল্লেখিত IP রেটিংয়ের বেশি পানি, বা অন্য কোথাও খোলা বা মেরামত করা ইউনিট কভার করে না।\n\nক্লেইম করতে আমার অ্যাকাউন্ট → ওয়ারেন্টি খুলে পণ্যটি বেছে নিন আর এক-দুই লাইনে সমস্যা লিখুন। প্যাক করার সময় ইউনিটের সিরিয়াল নম্বর লেখা থাকলে ক্লেইম নিজেই তার সাথে মিলে যাবে।\n\nএরপর ক্লেইম চারটি ধাপে এগোয় — জমা হয়েছে, যাচাই চলছে, অনুমোদিত বা বাতিল, এবং সমাধান হয়েছে — প্রতিটি ধাপে SMS পাবেন। বেশিরভাগ ক্লেইম ৭ থেকে ১০ কর্মদিবসে মেরামত বা বদলে সমাধান হয়।",
    products: ["arcwave-watch-s2", "keyra-portable-ssd-1tb"],
  },
];

export const banners = [
  {
    placement: "hero", titleEn: "Smart gear. Honest specs.", titleBn: "স্মার্ট গ্যাজেট, সৎ স্পেক",
    subEn: "Earbuds, power banks, chargers, smartwatches and more — full spec sheets, real warranty on your invoice and Cash on Delivery across Bangladesh.", subBn: "ইয়ারবাড, পাওয়ার ব্যাংক, চার্জার, স্মার্টওয়াচ আর আরও অনেক কিছু — পূর্ণ স্পেক শিট, ইনভয়েসে আসল ওয়ারেন্টি আর সারা দেশে ক্যাশ অন ডেলিভারি।",
    ctaEn: "Shop gadgets", ctaBn: "গ্যাজেট দেখুন", link: "/shop", color: "sky", sort: 1, image: "/img/products/sonix-buds-pro-open.webp",
  },
  {
    placement: "hero", titleEn: "Find gear that works with your phone", titleBn: "আপনার ফোনের সাথে মানানসই গ্যাজেট খুঁজুন",
    subEn: "Tell us your device and budget — we'll pick one essential from each shelf, all in stock.", subBn: "আপনার ডিভাইস আর বাজেট বলুন — প্রতিটি তাক থেকে স্টকে থাকা একটি করে দরকারি জিনিস বেছে দেবো।",
    ctaEn: "Open the gadget finder", ctaBn: "গ্যাজেট ফাইন্ডার খুলুন", link: "/finder", color: "lavender", sort: 2, image: "/img/products/voltra-gan-65w-duo.webp",
  },
  {
    placement: "offer", titleEn: "Combo deals — save on the set", titleBn: "কম্বো ডিল — সেটে সাশ্রয়", subEn: "iPhone charging, laptop power and gaming starter combos — the saving is worked out from today's prices.", subBn: "আইফোন চার্জিং, ল্যাপটপ পাওয়ার ও গেমিং স্টার্টার কম্বো — সাশ্রয় হিসাব হয় আজকের দামে।",
    ctaEn: "See the combos", ctaBn: "কম্বো দেখুন", link: "/bundles", color: "mint", sort: 1, image: "/img/products/laptop-power-combo.webp",
  },
  {
    placement: "marketing", titleEn: "65W GaN, pocket-size", titleBn: "পকেট সাইজে ৬৫W GaN", subEn: "One charger for laptop, phone and earbuds.", subBn: "ল্যাপটপ, ফোন ও ইয়ারবাডের জন্য একটি চার্জার।",
    ctaEn: "See it", ctaBn: "দেখুন", link: "/product/voltra-gan-65w", color: "yellow", sort: 1, image: "/img/products/voltra-gan-65w.webp",
  },
  {
    placement: "marketing", titleEn: "Wear it, track it", titleBn: "পরুন, ট্র্যাক করুন", subEn: "AMOLED smartwatches and fitness bands.", subBn: "অ্যামোলেড স্মার্টওয়াচ ও ফিটনেস ব্যান্ড।",
    ctaEn: "Shop wearables", ctaBn: "ওয়্যারেবল দেখুন", link: "/shop/wearables", color: "lavender", sort: 2, image: "/img/products/arcwave-watch-s2-duo.webp",
  },
  {
    placement: "popup", titleEn: "Welcome! ৳100 off your first order", titleBn: "স্বাগতম! প্রথম অর্ডারে ৳১০০ ছাড়", subEn: "Use code GADGET100 on orders over ৳1,500.", subBn: "৳১,৫০০+ অর্ডারে GADGET100 কোড ব্যবহার করুন।",
    ctaEn: "Start shopping", ctaBn: "কেনাকাটা শুরু করুন", link: "/shop", color: "sky", sort: 1, image: "/img/products/sonix-buds-pro.webp", active: 0,
  },
];

export const coupons = [
  { code: "GADGET100", description: "৳100 off a first order over ৳1,500 (sample — edit or delete)", type: "flat", value: 100, min: 1500, perCustomer: 1 },
  { code: "COMBO5", description: "5% off orders over ৳5,000 (sample — edit or delete)", type: "percent", value: 5, min: 5000, perCustomer: 1 },
];

export const landingPages = [
  {
    slug: "buds-pro-offer", titleEn: "Sonix Buds Pro ANC Earbuds", titleBn: "সোনিক্স বাডস প্রো ANC ইয়ারবাড",
    subEn: "Hybrid noise cancelling, 28 h with the case, 4-mic calls — 12-month warranty on your invoice. Cash on Delivery across Bangladesh.", subBn: "হাইব্রিড নয়েজ ক্যান্সেলিং, কেসসহ ২৮ ঘণ্টা, ৪ মাইকে কল — ইনভয়েসে ১২ মাসের ওয়ারেন্টি। সারা দেশে ক্যাশ অন ডেলিভারি।",
    offerEn: "Free delivery in Dhaka City", offerBn: "ঢাকা সিটিতে ফ্রি ডেলিভারি", product: "sonix-buds-pro", color: "sky",
  },
];
