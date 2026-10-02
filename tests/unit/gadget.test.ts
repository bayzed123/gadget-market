import { describe, expect, it } from "vitest";
import { findMisleadingClaims, claimMessage } from "../../worker/src/lib/claims";
import { COMPATIBLE, SPEC_KEYS, isCompatible } from "../../worker/src/lib/codes";
import { pickSetup } from "../../worker/src/routes/public";
// @ts-expect-error — plain JS seed module
import { banners, categories, collections, posts, products } from "../../scripts/seed-data.mjs";

type SeedProduct = {
  slug: string; en: string; bn: string; descEn: string; descBn: string; useEn: string; useBn: string; price: number; sale?: number; dealDays?: number;
  compatible: string[]; warranty: number; specs: [string, string][]; highlights?: { name: string; en: string; bn: string }[]; boxEn?: string; boxBn?: string;
  bundle?: { slug: string; qty: number }[];
};
const list = products as SeedProduct[];

describe("starter catalogue copy is honest (the build fails otherwise)", () => {
  it("checks every product, bundle, guide, collection, category and banner", () => {
    const problems: string[] = [];
    const check = (id: string, f: Record<string, unknown>) => findMisleadingClaims(f).forEach((m) => problems.push(`${id}: ${claimMessage(m)}`));
    for (const p of list) {
      check(p.slug, {
        en: p.en, bn: p.bn, descEn: p.descEn, descBn: p.descBn, useEn: p.useEn, useBn: p.useBn, boxEn: p.boxEn, boxBn: p.boxBn,
        ...Object.fromEntries(p.specs.map(([k, v]) => [`spec.${k}`, v])),
        ...Object.fromEntries((p.highlights ?? []).flatMap((h, i) => [[`h${i}en`, h.en], [`h${i}bn`, h.bn]])),
      });
    }
    for (const p of posts) check(p.slug, { a: p.titleEn, b: p.titleBn, c: p.excerptEn, d: p.excerptBn, e: p.bodyEn, f: p.bodyBn });
    for (const c of collections) check(c.slug, { a: c.en, b: c.bn, c: c.descEn, d: c.descBn });
    for (const c of categories) check(c.slug, { a: c.descEn, b: c.descBn });
    for (const b of banners) check(b.titleEn, { a: b.titleEn, b: b.titleBn, c: b.subEn, d: b.subBn });
    expect(problems).toEqual([]);
  });

  it("gives every single product a spec sheet, known device codes and a warranty in range", () => {
    for (const p of list.filter((x) => !x.bundle)) {
      expect(p.specs.length, p.slug).toBeGreaterThanOrEqual(2);
      expect(new Set(p.specs.map(([k]) => k)).size, `${p.slug}: duplicate spec`).toBe(p.specs.length);
      expect(p.compatible.length, p.slug).toBeGreaterThan(0);
      expect(p.compatible.every(isCompatible), p.slug).toBe(true);
      expect(p.warranty >= 0 && p.warranty <= 60, p.slug).toBe(true);
    }
  });

  it("only runs a Deal of the Day on a product with a real sale price", () => {
    const deals = list.filter((p) => p.dealDays);
    expect(deals.length).toBeGreaterThanOrEqual(1);
    for (const p of deals) expect(p.sale && p.sale < p.price, p.slug).toBeTruthy();
  });

  it("builds bundles only from ordinary products, and every bundle saves money", () => {
    const bySlug = new Map(list.map((p) => [p.slug, p]));
    const bundles = list.filter((p) => p.bundle?.length);
    expect(bundles.length).toBeGreaterThanOrEqual(3);
    for (const b of bundles) {
      let separate = 0;
      for (const i of b.bundle!) {
        const part = bySlug.get(i.slug);
        expect(part, `${b.slug} → ${i.slug}`).toBeTruthy();
        expect(part!.bundle, `${b.slug} → ${i.slug} is itself a bundle`).toBeUndefined();
        separate += (part!.sale ?? part!.price) * i.qty;
      }
      expect(b.sale ?? b.price, b.slug).toBeLessThan(separate);
    }
  });

  it("keeps the vocabularies the storefront and admin rely on", () => {
    expect(COMPATIBLE).toContain("iphone");
    expect(COMPATIBLE).toContain("usb_c");
    expect(SPEC_KEYS.battery?.bn).toBeTruthy();
    expect(isCompatible("toaster")).toBe(false);
  });
});

describe("honest-copy guard", () => {
  const flagged = (s: string) => findMisleadingClaims({ x: s }).length > 0;
  it.each([
    "Only 2 left — order now!",
    "15 people are viewing this right now",
    "Offer ends today",
    "Lifetime warranty included",
    "100% waterproof earbuds",
    "Unbreakable glass",
    "Selling fast",
  ])("refuses %j", (s) => expect(flagged(s)).toBe(true));
  it.each([
    "Water resistant (IPX5) — fine in rain and sweat",
    "12-month brand warranty",
    "Fast charging up to 65W",
    "Waterproof to IP68 for 30 minutes at 1.5 m",
  ])("allows %j", (s) => expect(flagged(s)).toBe(false));
  it("names the phrase and a fix in both languages", () => {
    const [m] = findMisleadingClaims({ description_en: "Lifetime warranty!" });
    expect(m?.field).toBe("description_en");
    expect(claimMessage(m!)).toMatch(/months/);
  });
});

describe("gadget finder (pickSetup)", () => {
  const row = (id: number, top: number, price: number, compatible: string, o: Record<string, unknown> = {}) =>
    ({ id, top_id: top, cat_sort: top, cat_name_en: `Cat ${top}`, cat_name_bn: `Cat ${top}`, price, sale_price: null, compatible, is_featured: 0, rating_avg: 0, sold_count: 0, images: "[]", stock: 5, ...o }) as never;
  const rows = [
    row(1, 1, 450, ",iphone,usb_c,"), row(2, 1, 900, ",iphone,", { is_featured: 1 }),
    row(3, 2, 480, ",iphone,android,"), row(4, 3, 690, ",iphone,laptop,"),
    row(5, 4, 890, ",iphone,"), row(6, 5, 300, ",android,"),
  ];
  it("picks one product per shelf that works with the device, within the budget", () => {
    const { picks, total } = pickSetup(rows, "iphone", 2000);
    expect(new Set(picks.map((p: { top_id: number }) => p.top_id)).size).toBe(picks.length);
    expect(picks.every((p: { compatible: string }) => p.compatible.includes(",iphone,"))).toBe(true);
    expect(total).toBeLessThanOrEqual(2000);
    expect(picks.length).toBeGreaterThanOrEqual(3);
  });
  it("prefers cheaper options when the budget is tight so more shelves are covered", () => {
    const { picks, total } = pickSetup(rows, "iphone", 1000);
    expect(total).toBeLessThanOrEqual(1000);
    expect(picks.map((p: { id: number }) => p.id)).toContain(1);
    expect(picks.length).toBe(2);
  });
  it("never goes over budget, caps the setup at 4 items and ignores other devices", () => {
    expect(pickSetup(rows, "iphone", 100).picks).toEqual([]);
    expect(pickSetup(rows, "iphone", 50_000).picks.length).toBeLessThanOrEqual(4);
    expect(pickSetup(rows, "ps5", 5000).picks).toEqual([]);
  });
});
