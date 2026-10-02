import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hashPassword, totpAt, verifyPassword, verifyTotp } from "../../worker/src/lib/crypto";
import { parseCsv, toCsv } from "../../worker/src/lib/csv";
import { PdfDoc, pdfSafe } from "../../worker/src/lib/pdf";
import { normalizeBdPhone } from "../../worker/src/lib/http";
import { certificationSchema, collectionSchema, productSchema } from "../../worker/src/lib/schemas";
import { claimMessage, DEFAULT_WARRANTY_NOTE, findMisleadingClaims } from "../../worker/src/lib/claims";
import { bdDatePlus, bdToday, daysUntil, splitFefo } from "../../worker/src/lib/batches";
import { buildUserData, capiPhone } from "../../worker/src/lib/marketing";

describe("two-factor codes (RFC 6238)", () => {
  const secret = base32Encode(new TextEncoder().encode("12345678901234567890"));
  it("round-trips base32", () => {
    expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(new TextDecoder().decode(base32Decode(secret))).toBe("12345678901234567890");
  });
  it("matches the RFC test vector and accepts ±1 step", async () => {
    expect(await totpAt(secret, 1)).toBe("287082");
    expect(await verifyTotp(secret, "287082", 59_000)).toBe(true);
    expect(await verifyTotp(secret, "287082", 89_000)).toBe(true);
    expect(await verifyTotp(secret, "000000", 59_000)).toBe(false);
  });
});

describe("passwords", () => {
  it("hashes with PBKDF2 and verifies", async () => {
    const h = await hashPassword("Correct-Horse-9");
    expect(h.startsWith("pbkdf2$100000$")).toBe(true);
    expect(await verifyPassword("Correct-Horse-9", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
});

describe("CSV", () => {
  it("round-trips quotes, commas, newlines and Bangla", () => {
    const csv = toCsv([{ a: 'He said "hi"', b: "x,y", c: "লাইন\nদুই" }]);
    expect(parseCsv(csv)).toEqual([{ a: 'He said "hi"', b: "x,y", c: "লাইন\nদুই" }]);
  });
  it("neutralises spreadsheet formulas", () => {
    expect(toCsv([{ a: "=HYPERLINK(1)" }])).toContain("'=HYPERLINK");
  });
});

describe("PDF invoice writer", () => {
  it("produces a valid-looking PDF with an xref table", () => {
    const d = new PdfDoc();
    d.text(40, 40, "Invoice ৳1,200 — test");
    const bytes = d.toBytes();
    const s = new TextDecoder().decode(bytes);
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s).toContain("xref");
    expect(s.trim().endsWith("%%EOF")).toBe(true);
    expect(s).toContain("(Invoice Tk 1,200 - test)");
    const startxref = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(startxref, startxref + 4)).toBe("xref");
  });
  it("keeps text ASCII-safe", () => {
    expect(pdfSafe("মা ৳500")).toBe(" Tk 500");
  });
});

describe("validation", () => {
  it("normalises Bangladeshi mobile numbers", () => {
    expect(normalizeBdPhone("+880 1711-223344")).toBe("01711223344");
    expect(normalizeBdPhone("01211223344")).toBeNull();
  });
  it("accepts a trust badge by type code; the document is optional (no proof = badge never shown)", () => {
    expect(certificationSchema.safeParse({ type: "official_warranty" }).success).toBe(true);
    expect(certificationSchema.safeParse({ type: "btrc", document_url: "/media/certificates/x.pdf" }).success).toBe(true);
    expect(certificationSchema.safeParse({ type: "Not A Code!" }).success).toBe(false);
    expect(certificationSchema.safeParse({ type: "qc_tested", valid_until: "not a date" }).success).toBe(false);
  });
  it("validates gadget fields: devices, spec sheet before publishing, warranty, deals, bundles and honest copy", () => {
    const base = { slug: "x", name_en: "Voltra 20W Charger", name_bn: "ভোল্ট্রা ২০W চার্জার", category_id: 3, price: 990, variants: [{ stock: 1, color: "White" }] };
    const specs = [{ key: "wattage", value: "20W USB-C PD" }, { key: "ports", value: "1 × USB-C" }];
    expect(productSchema.safeParse({ ...base, compatible: ["iphone", "android"], specs, status: "active", warranty_months: 6 }).success).toBe(true);
    expect(productSchema.safeParse({ ...base, compatible: ["toaster"] }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, warranty_months: 61 }).success).toBe(false);
    // A product can't go live without its spec sheet; a spec can't be listed twice
    expect(productSchema.safeParse({ ...base, status: "active" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, status: "draft" }).success).toBe(true);
    const dup = productSchema.safeParse({ ...base, specs: [...specs, { key: "Wattage", value: "18W" }] });
    expect(!dup.success && dup.error.issues[0]!.path.join(".")).toBe("specs.2.key");
    // Deal of the Day needs a real sale price
    expect(productSchema.safeParse({ ...base, deal_until: "2026-10-05" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, deal_until: "2026-10-05", sale_price: 790 }).success).toBe(true);
    // Bundles: at least two different products
    expect(productSchema.safeParse({ ...base, bundle_items: [{ product_id: 1, quantity: 1 }, { product_id: 2, quantity: 2 }] }).success).toBe(true);
    expect(productSchema.safeParse({ ...base, bundle_items: [{ product_id: 1 }] }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, bundle_items: [{ product_id: 1 }, { product_id: 1 }] }).success).toBe(false);
    // Honest copy is checked everywhere, including key features and spec values
    const claim = productSchema.safeParse({ ...base, highlights: [{ name: "Tough", benefit_en: "Unbreakable shell" }] });
    expect(claim.success).toBe(false);
    expect(!claim.success && claim.error.issues[0]!.path.join(".")).toBe("highlights.0.benefit_en");
    const spec = productSchema.safeParse({ ...base, specs: [{ key: "water", value: "100% waterproof" }] });
    expect(!spec.success && spec.error.issues[0]!.path.join(".")).toBe("specs.0.value");
  });
  it("needs at least two distinct products in a collection and a known device", () => {
    const base = { slug: "work-from-home", name_en: "Work from home", name_bn: "ওয়ার্ক ফ্রম হোম" };
    expect(collectionSchema.safeParse({ ...base, product_ids: [1] }).success).toBe(false);
    expect(collectionSchema.safeParse({ ...base, product_ids: [1, 1] }).success).toBe(false);
    const r = collectionSchema.safeParse({ ...base, product_ids: [3, 1, 3, 2], device: "laptop" });
    expect(r.success && r.data.product_ids).toEqual([3, 1, 2]);
    expect(collectionSchema.safeParse({ ...base, product_ids: [1, 2], device: "toaster" }).success).toBe(false);
  });
});

describe("honest-copy guard", () => {
  const phrases = (text: string) => findMisleadingClaims({ text }).map((m) => m.phrase.toLowerCase());
  it("flags fake urgency and promises a product can't keep, in English", () => {
    expect(phrases("Only 3 left in stock!")[0]).toMatch(/only 3 left/);
    expect(phrases("12 people viewing now")[0]).toMatch(/12 people viewing/);
    expect(phrases("Deal ends tonight")[0]).toMatch(/deal ends tonight/);
    expect(phrases("Lifetime warranty")[0]).toMatch(/lifetime warranty/);
    expect(phrases("Fully waterproof")[0]).toMatch(/fully waterproof/);
    expect(phrases("Never overheats")[0]).toMatch(/never overheats/);
    expect(phrases("100% original")[0]).toMatch(/100% original/);
    expect(phrases("Cheapest in Bangladesh")[0]).toMatch(/cheapest in bangladesh/);
  });
  it("flags the same in Bangla", () => {
    expect(phrases("মাত্র ২টি বাকি")).not.toEqual([]);
    expect(phrases("লাইফটাইম ওয়ারেন্টি")).not.toEqual([]);
    expect(phrases("১০০% ওয়াটারপ্রুফ")).not.toEqual([]);
    expect(phrases("২০ জন দেখছেন")).not.toEqual([]);
  });
  it("allows honest spec wording", () => {
    for (const ok of [
      "Water resistant (IPX5)",
      "Waterproof to IP68 (1.5 m, 30 min)",
      "12-month brand warranty",
      "Fast charging up to 65W",
      "Original Sonix product with the brand's warranty card",
      "পানি প্রতিরোধী (IPX4)",
      "১২ মাসের ওয়ারেন্টি",
    ]) {
      expect(findMisleadingClaims({ ok })).toEqual([]);
    }
  });
  it("names the field and gives a bilingual suggestion", () => {
    const [m] = findMisleadingClaims({ description_en: "Lifetime warranty." });
    expect(m!.field).toBe("description_en");
    expect(claimMessage(m!)).toMatch(/"Lifetime warranty" can't be used .* \/ .*লেখা যাবে না/);
  });
  it("ships plain warranty terms", () => {
    expect(DEFAULT_WARRANTY_NOTE.en).toMatch(/manufacturing defects/);
    expect(DEFAULT_WARRANTY_NOTE.bn.length).toBeGreaterThan(60);
  });
});

describe("stock lots: oldest / first-expiring first", () => {
  const lots = [
    { id: 1, batch_no: "A", expiry_date: "2026-11-30", qty_remaining: 3 },
    { id: 2, batch_no: "B", expiry_date: "2027-05-31", qty_remaining: 10 },
  ];
  it("takes from the earliest batch first and spills into the next", () => {
    expect(splitFefo(lots, 2)).toEqual([{ batch_id: 1, batch_no: "A", expiry: "2026-11-30", qty: 2 }]);
    expect(splitFefo(lots, 5).map((a) => [a.batch_no, a.qty])).toEqual([["A", 3], ["B", 2]]);
    expect(splitFefo(lots, 20).reduce((n, a) => n + a.qty, 0)).toBe(13); // the rest is unbatched stock
    expect(splitFefo([{ ...lots[0]!, qty_remaining: 0 }, lots[1]!], 1)[0]!.batch_no).toBe("B");
  });
  it("counts days in the Bangladesh calendar", () => {
    const at = new Date("2026-10-01T19:00:00Z"); // 1 am on 2 Oct in Dhaka
    expect(bdToday(at)).toBe("2026-10-02");
    expect(bdDatePlus(30, at)).toBe("2026-11-01");
    expect(daysUntil("2026-10-12", at)).toBe(10);
    expect(daysUntil("2026-10-01", at)).toBe(-1);
  });
});

describe("Conversions API hashing", () => {
  it("hashes phone numbers in E.164 form", async () => {
    expect(capiPhone("01711223344")).toBe("8801711223344");
    const u = await buildUserData({ phone: "01711223344", email: " A@B.com " });
    expect((u.ph as string[])[0]).toMatch(/^[a-f0-9]{64}$/);
    expect((u.em as string[])[0]).toBe("fb98d44ad7501a959f3f4f4a3f004fe2d9e581ea6207e218c4b02c08a4d75adf");
  });
});
