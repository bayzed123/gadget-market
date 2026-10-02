/**
 * The shop's fixed vocabularies and the pure half of the SKU format, with no imports — so the build script
 * (scripts/build.mjs) and the unit tests can use exactly the same rules as the Worker. lib/sku.ts re-exports all of it.
 */
/** Devices a product works with — the "Works with" filter, the product tags and the gadget finder. */
export const COMPATIBLE = ["iphone", "android", "usb_c", "lightning", "laptop", "mac", "windows", "ps5", "xbox", "switch", "smart_tv"] as const;
export type Compatible = (typeof COMPATIBLE)[number];
export const COMPATIBLE_LABELS: Record<Compatible, { en: string; bn: string }> = {
  iphone: { en: "iPhone", bn: "আইফোন" },
  android: { en: "Android phones", bn: "অ্যান্ড্রয়েড ফোন" },
  usb_c: { en: "USB-C devices", bn: "USB-C ডিভাইস" },
  lightning: { en: "Lightning (older iPhone)", bn: "লাইটনিং (পুরোনো আইফোন)" },
  laptop: { en: "Laptops", bn: "ল্যাপটপ" },
  mac: { en: "Mac", bn: "ম্যাক" },
  windows: { en: "Windows PC", bn: "উইন্ডোজ পিসি" },
  ps5: { en: "PlayStation 5", bn: "প্লেস্টেশন ৫" },
  xbox: { en: "Xbox", bn: "এক্সবক্স" },
  switch: { en: "Nintendo Switch", bn: "নিনটেন্ডো সুইচ" },
  smart_tv: { en: "Smart TV", bn: "স্মার্ট টিভি" },
};
export const isCompatible = (v: unknown): v is Compatible => typeof v === "string" && (COMPATIBLE as readonly string[]).includes(v);

/**
 * Spec-sheet keys with bilingual labels. A product's spec sheet is a list of {key, value}; a key from this list shows
 * its label in the shopper's language and lines up across products in the comparison table, any other key is shown
 * as typed. Values stay as written ("20000 mAh", "Bluetooth 5.3") — numbers and units read the same in both languages.
 */
export const SPEC_KEYS: Record<string, { en: string; bn: string }> = {
  model: { en: "Model", bn: "মডেল" },
  battery: { en: "Battery", bn: "ব্যাটারি" },
  capacity: { en: "Capacity", bn: "ক্যাপাসিটি" },
  playtime: { en: "Playtime", bn: "চলবে" },
  charging_time: { en: "Charging time", bn: "চার্জ হতে সময়" },
  wattage: { en: "Output / wattage", bn: "আউটপুট / ওয়াট" },
  input: { en: "Input", bn: "ইনপুট" },
  ports: { en: "Ports", bn: "পোর্ট" },
  connectivity: { en: "Connectivity", bn: "কানেক্টিভিটি" },
  bluetooth: { en: "Bluetooth", bn: "ব্লুটুথ" },
  range: { en: "Range", bn: "রেঞ্জ" },
  driver: { en: "Driver", bn: "ড্রাইভার" },
  anc: { en: "Noise cancelling", bn: "নয়েজ ক্যান্সেলিং" },
  microphone: { en: "Microphone", bn: "মাইক্রোফোন" },
  display: { en: "Display", bn: "ডিসপ্লে" },
  sensors: { en: "Sensors", bn: "সেন্সর" },
  water: { en: "Water resistance", bn: "পানি প্রতিরোধ" },
  length: { en: "Length", bn: "দৈর্ঘ্য" },
  material: { en: "Material", bn: "উপাদান" },
  dimensions: { en: "Dimensions", bn: "মাপ" },
  weight: { en: "Weight", bn: "ওজন" },
  compatibility: { en: "Compatibility", bn: "সাপোর্ট করে" },
  in_box: { en: "In the box", bn: "বক্সে যা আছে" },
};
export const specLabel = (key: string, lang: "en" | "bn" = "en") => SPEC_KEYS[key]?.[lang] ?? key;

/** "Anker" → ANK, "JBL" → JBL, "Sony" → SON, nothing → GEN. Letters only, so "boAt" and "BOAT" agree. */
export function brandCode(brand: string | null | undefined): string {
  const letters = (brand ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  return letters.length >= 2 ? letters.slice(0, 3) : "GEN";
}

const COLOR_CODES: Record<string, string> = {
  black: "BLK", white: "WHT", blue: "BLU", red: "RED", green: "GRN", grey: "GRY", gray: "GRY", silver: "SLV",
  gold: "GLD", pink: "PNK", purple: "PRP", navy: "NVY", orange: "ORG", yellow: "YLW", beige: "BEI", brown: "BRN",
  clear: "CLR", transparent: "CLR", midnight: "MID", graphite: "GPH", teal: "TEA", mint: "MNT", cream: "CRM",
};
/** "Black" → BLK, "Midnight Blue" → MID, "" → STD (one-colour products). Unknown colours: first three letters. */
export function colorCode(color: string | null | undefined): string {
  const c = (color ?? "").trim().toLowerCase();
  if (!c) return "STD";
  const first = c.split(/[\s/-]+/)[0]!;
  return COLOR_CODES[c] ?? COLOR_CODES[first] ?? (first.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "STD");
}

/** Category codes are 2–3 capital letters (EB earbuds, PB power banks); anything empty becomes "GEN". */
export const catCode = (code: string) => code.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "GEN";

export function formatSku(categoryCode: string, brand: string | null | undefined, color: string | null | undefined, seq: number, prefix: string): string {
  return `${prefix}-${catCode(categoryCode)}-${brandCode(brand)}-${colorCode(color)}-${String(seq).padStart(4, "0")}`;
}

export const SKU_PATTERN = /^[A-Z]{2,5}-[A-Z]{2,3}-[A-Z]{2,3}-[A-Z]{3}-\d{4,}$/;
