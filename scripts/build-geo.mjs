#!/usr/bin/env node
/**
 * Builds the compact Division → District → Upazila dataset (public/data/bd-geo.json) and the postcode lookup
 * (public/data/bd-postcodes.json) used by the checkout address form and delivery-fee zones.
 *
 * Source: https://github.com/bayeziddev/Bangladesh-geocode (MIT). Uses a local clone when GEOCODE_DIR
 * (default ../Bangladesh-geocode) exists, otherwise downloads the JSON files from GitHub.
 * The generated files are committed, so this only needs to run when the source data changes.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DIR = process.env.GEOCODE_DIR || "../Bangladesh-geocode";
const RAW = "https://raw.githubusercontent.com/bayeziddev/Bangladesh-geocode/main";

async function load(path) {
  const local = join(DIR, path);
  const text = existsSync(local) ? readFileSync(local, "utf8") : await (await fetch(`${RAW}/${path}`)).text();
  return JSON.parse(text);
}
/** phpMyAdmin JSON export → the "data" array of the table object. */
const rowsOf = (json) => (Array.isArray(json) ? json.find((x) => x && x.type === "table")?.data ?? json : json);

const divisions = rowsOf(await load("divisions/divisions.json")).map((d) => [Number(d.id), d.name.trim(), d.bn_name.trim()]);
const districts = rowsOf(await load("districts/districts.json")).map((d) => [Number(d.id), Number(d.division_id), d.name.trim(), d.bn_name.trim()]);
const upazilas = rowsOf(await load("upazilas/upazilas.json")).map((u) => [Number(u.id), Number(u.district_id), u.name.trim(), u.bn_name.trim()]);

/**
 * Supplement: the source lists rural upazilas only, so city-corporation thanas are added for Dhaka (district 47,
 * ids 9001+) and Chattogram (district 8, ids 9101+). Without these a Mirpur or Panchlaish customer could not
 * choose their area. ADJUSTABLE — add more cities the same way.
 */
const CITY_THANAS = {
  47: [9001, [
    ["Adabor", "আদাবর"], ["Airport", "বিমানবন্দর"], ["Badda", "বাড্ডা"], ["Banani", "বনানী"], ["Bangshal", "বংশাল"], ["Bhashantek", "ভাসানটেক"],
    ["Cantonment", "ক্যান্টনমেন্ট"], ["Chawkbazar", "চকবাজার"], ["Dakshinkhan", "দক্ষিণখান"], ["Darus Salam", "দারুস সালাম"], ["Demra", "ডেমরা"],
    ["Dhanmondi", "ধানমন্ডি"], ["Gendaria", "গেন্ডারিয়া"], ["Gulshan", "গুলশান"], ["Hatirjheel", "হাতিরঝিল"], ["Hazaribagh", "হাজারীবাগ"],
    ["Jatrabari", "যাত্রাবাড়ী"], ["Kadamtali", "কদমতলী"], ["Kafrul", "কাফরুল"], ["Kalabagan", "কলাবাগান"], ["Kamrangirchar", "কামরাঙ্গীরচর"],
    ["Khilgaon", "খিলগাঁও"], ["Khilkhet", "খিলক্ষেত"], ["Kotwali (Dhaka)", "কোতোয়ালী (ঢাকা)"], ["Lalbagh", "লালবাগ"], ["Mirpur", "মিরপুর"],
    ["Mohammadpur", "মোহাম্মদপুর"], ["Motijheel", "মতিঝিল"], ["Mugda", "মুগদা"], ["New Market", "নিউ মার্কেট"], ["Pallabi", "পল্লবী"],
    ["Paltan", "পল্টন"], ["Ramna", "রমনা"], ["Rampura", "রামপুরা"], ["Rupnagar", "রূপনগর"], ["Sabujbagh", "সবুজবাগ"], ["Shah Ali", "শাহ আলী"],
    ["Shahbagh", "শাহবাগ"], ["Shahjahanpur", "শাহজাহানপুর"], ["Sher-e-Bangla Nagar", "শেরেবাংলা নগর"], ["Shyampur", "শ্যামপুর"],
    ["Sutrapur", "সূত্রাপুর"], ["Tejgaon", "তেজগাঁও"], ["Tejgaon Industrial Area", "তেজগাঁও শিল্পাঞ্চল"], ["Turag", "তুরাগ"],
    ["Uttara East", "উত্তরা পূর্ব"], ["Uttara West", "উত্তরা পশ্চিম"], ["Uttarkhan", "উত্তরখান"], ["Vatara", "ভাটারা"], ["Wari", "ওয়ারী"],
  ]],
  8: [9101, [
    ["Akbar Shah", "আকবর শাহ"], ["Bakalia", "বাকলিয়া"], ["Bandar", "বন্দর"], ["Bayazid Bostami", "বায়েজিদ বোস্তামী"], ["Chandgaon", "চান্দগাঁও"],
    ["Chawkbazar (Chattogram)", "চকবাজার (চট্টগ্রাম)"], ["Double Mooring", "ডবলমুরিং"], ["EPZ", "ইপিজেড"], ["Halishahar", "হালিশহর"], ["Khulshi", "খুলশী"],
    ["Kotwali (Chattogram)", "কোতোয়ালী (চট্টগ্রাম)"], ["Pahartali", "পাহাড়তলী"], ["Panchlaish", "পাঁচলাইশ"], ["Patenga", "পতেঙ্গা"], ["Sadarghat", "সদরঘাট"],
  ]],
};
for (const [district, [start, list]] of Object.entries(CITY_THANAS)) list.forEach(([en, bn], i) => upazilas.push([start + i, Number(district), en, bn]));

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");
const ALIASES = { chittagong: "chattogram", comilla: "cumilla", jessore: "jashore", bogra: "bogura", barisal: "barishal", chapainababganj: "chapainawabganj", jhalokathi: "jhalakathi", moulvibazar: "maulvibazar", netrakona: "netrokona" };
const canon = (s) => ALIASES[norm(s)] ?? norm(s);
const districtByName = new Map(districts.map((d) => [canon(d[2]), d]));

const postcodes = {};
const pc = await load("postcode-bd/postcode.json");
for (const [rawCode, v] of Object.entries(pc)) {
  const code = rawCode.trim();
  const en = v.en ?? v;
  const d = districtByName.get(canon(en.district));
  if (!d || !/^\d{4}$/.test(code)) continue;
  const thana = canon(en.thana);
  const u =
    upazilas.find((x) => x[1] === d[0] && canon(x[2]) === thana) ??
    upazilas.find((x) => x[1] === d[0] && thana.length >= 4 && (canon(x[2]).startsWith(thana) || thana.startsWith(canon(x[2]))));
  postcodes[code] = [d[0], u ? u[0] : 0, String(en.suboffice ?? "").replace(/--?TSO|TSO/g, "").trim()];
}

mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/bd-geo.json", JSON.stringify({ source: "github.com/bayeziddev/Bangladesh-geocode (MIT) + city thanas supplement", divisions, districts, upazilas }));
writeFileSync("public/data/bd-postcodes.json", JSON.stringify(postcodes));
console.log(`✔ ${divisions.length} divisions, ${districts.length} districts, ${upazilas.length} upazilas, ${Object.keys(postcodes).length} postcodes`);
