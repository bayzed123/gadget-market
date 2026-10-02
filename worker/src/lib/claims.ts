/**
 * Honest-copy guard. Gadget listings in Bangladesh lose shoppers' trust in two familiar ways: fabricated urgency
 * ("only 2 left!", "15 people viewing" typed into a description, where it never changes) and promises a product can't
 * keep ("lifetime warranty" on a 6-month item, "100% waterproof" on an IPX4 earbud, "unbreakable"). The brief makes
 * honest urgency a hard requirement, so product, bundle, collection, banner and guide copy — in the admin, the API,
 * the CSV import, the AI description helper and the build (seed data) — is run through findMisleadingClaims(), and a
 * match is refused with the exact phrase and a plain-language fix, so a non-technical owner knows what to rewrite.
 *
 * Real stock counts and real deal end times are shown by the shop itself, from the database — never from copy.
 * Ordinary words stay allowed: "water resistant (IPX5)", "12-month warranty", "original", "fast charging".
 */

interface ClaimRule {
  re: RegExp;
  /** A plain-language suggestion shown next to the error. */
  suggest: { en: string; bn: string };
}

const RULES: ClaimRule[] = [
  // Fabricated urgency written into copy (the shop shows real stock and real deal timers on its own).
  {
    re: /\b(only|just)\s+\d+\s+(left|remaining|pieces? left|units? left|in stock)\b|\b\d+\s+(people|persons|shoppers|customers)\s+(are\s+)?(viewing|watching|looking)\b|\b(selling fast|almost sold out|last few pieces?|hurry,? (only|stock))\b/i,
    suggest: { en: "the shop shows the real stock count by itself — don't type one into the copy", bn: "দোকান আসল স্টক নিজেই দেখায় — লেখায় স্টকের সংখ্যা লিখবেন না" },
  },
  { re: /\b(offer|deal|sale|price)\s+ends?\s+(today|tonight|soon|in \d+)\b/i, suggest: { en: "set a real end time on the deal instead — the countdown then shows it", bn: "অফারে আসল শেষ সময় দিন — কাউন্টডাউন নিজেই দেখাবে" } },
  // Promises a product can't keep.
  { re: /\blife\s*-?\s*time\s+(warranty|guarantee)\b/i, suggest: { en: "state the real warranty in months — it is printed on the product page", bn: "আসল ওয়ারেন্টি মাসে লিখুন — পণ্যের পাতায় সেটিই দেখানো হয়" } },
  { re: /\b(100\s*%|fully|completely|totally)\s+water\s*-?\s*proof\b|\bwaterproof\b(?![^.]*\bIP[X\d])/i, suggest: { en: 'give the IP rating instead, e.g. "water resistant (IPX5)"', bn: 'IP রেটিং লিখুন, যেমন "পানি প্রতিরোধী (IPX5)"' } },
  { re: /\b(unbreakable|indestructible|never (breaks?|overheats?|fails?)|zero heat)\b/i, suggest: { en: "describe what it is built with instead (material, drop rating)", bn: "কী দিয়ে তৈরি তা লিখুন (উপাদান, ড্রপ রেটিং)" } },
  { re: /\b(guaranteed?|100\s*%)\s+(original|authentic|genuine|satisfaction|safe)\b/i, suggest: { en: "show proof instead — attach the certificate or official-warranty document", bn: "প্রমাণ দেখান — সার্টিফিকেট বা অফিসিয়াল ওয়ারেন্টির কাগজ যুক্ত করুন" } },
  { re: /\b(best|cheapest|fastest|lowest price)\s+(in|of)\s+(bangladesh|bd|the country|the world|dhaka)\b/i, suggest: { en: "compare against something specific, or drop the superlative", bn: "নির্দিষ্ট কিছুর সাথে তুলনা করুন, অথবা \"সবচেয়ে\" বাদ দিন" } },
  // Bangla: "মাত্র ২টি বাকি" (only 2 left), "লাইফটাইম ওয়ারেন্টি", "১০০% ওয়াটারপ্রুফ", "ভাঙবে না" (won't break),
  // "দেশের সবচেয়ে সস্তা" (cheapest in the country), "জন দেখছেন" (people viewing).
  {
    re: /(মাত্র\s*[০-৯\d]+\s*টি?\s*(বাকি|আছে)|জন\s*(দেখছেন|দেখছে)|লাইফটাইম ওয়ারেন্টি|আজীবন ওয়ারেন্টি|(১০০|100)\s*%\s*ওয়াটারপ্রুফ|কখনো ভাঙবে না|ভাঙবে না|দেশের সবচেয়ে (সস্তা|কম দাম))/,
    suggest: { en: "the same rules apply in Bangla: real stock, real warranty, real ratings", bn: "বাংলাতেও একই নিয়ম: আসল স্টক, আসল ওয়ারেন্টি, আসল রেটিং" },
  },
];

export interface ClaimMatch {
  field: string;
  phrase: string;
  suggest: { en: string; bn: string };
}

/** Returns every misleading phrase found in the given fields (empty array = copy is fine). */
export function findMisleadingClaims(fields: Record<string, unknown>): ClaimMatch[] {
  const out: ClaimMatch[] = [];
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value !== "string" || !value) continue;
    for (const rule of RULES) {
      const m = value.match(rule.re);
      if (m) out.push({ field, phrase: m[0], suggest: rule.suggest });
    }
  }
  return out;
}

/** Bilingual error message for one match. */
export function claimMessage(m: ClaimMatch): string {
  return `"${m.phrase}" can't be used — ${m.suggest.en} / "${m.phrase}" লেখা যাবে না — ${m.suggest.bn}`;
}

/** The standard warranty terms shown next to the warranty badge, at checkout and on the invoice
 *  (also editable in Admin → Settings → Store information). */
export const DEFAULT_WARRANTY_NOTE = {
  en: "Warranty covers manufacturing defects from the delivery date, against the invoice. Physical damage, water damage beyond the stated rating, and opened or repaired units are not covered. File a claim from your account or bring the unit with its box.",
  bn: "ডেলিভারির দিন থেকে ইনভয়েসের ভিত্তিতে ম্যানুফ্যাকচারিং ত্রুটির জন্য ওয়ারেন্টি প্রযোজ্য। ভেঙে যাওয়া, উল্লেখিত রেটিংয়ের বেশি পানিতে ক্ষতি, খোলা বা অন্যত্র মেরামত করা ইউনিট ওয়ারেন্টির বাইরে। অ্যাকাউন্ট থেকে ক্লেইম করুন অথবা বক্সসহ ইউনিটটি নিয়ে আসুন।",
};
