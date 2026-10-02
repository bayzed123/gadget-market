// Storefront catalogue: "works with" (device), bundle and deal filters, spec-sheet search, product detail (spec sheet,
// key features, in the box, warranty, honest Deal of the Day end, badges only with proof), bundles with their real
// saving, the spec comparison, the gadget finder, collections / "goes well with", buying guides, delivery fees from
// Dhaka, gift box in quotes, SEO pages and feeds.
import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import productListFixture from "../fixtures/product-list.response.json";
import { address, call, variantId } from "./helpers";

const idOf = async (slug: string) => (await env.DB.prepare("SELECT id FROM products WHERE slug = ?").bind(slug).first<{ id: number }>())!.id;

describe("catalogue", () => {
  it("lists active products with the fixture's shape", async () => {
    const { res, data } = await call("/api/products?limit=2&sort=newest");
    expect(res.status).toBe(200);
    expect(Object.keys(data).sort()).toEqual(Object.keys(productListFixture).sort());
    expect(Object.keys(data.items[0]).sort()).toEqual(Object.keys(productListFixture.items[0]!).sort());
    expect(data.total).toBe(32);
  });

  it("filters by the device it works with, and by bundle / single product", async () => {
    for (const device of ["iphone", "android", "laptop", "ps5"]) {
      const { data } = await call(`/api/products?device=${device}&limit=48`);
      expect(data.total, device).toBeGreaterThan(0);
      expect(data.items.every((p: any) => p.compatible.includes(device))).toBe(true);
    }
    const ps5 = await call("/api/products?device=ps5&bundle=0&limit=48");
    expect(ps5.data.items.map((p: any) => p.slug).sort()).toEqual(["keyra-portable-ssd-1tb", "nexplay-gaming-headset"]);
    const bundles = await call("/api/products?bundle=1&limit=48");
    expect(bundles.data.total).toBe(3);
    expect(bundles.data.items.every((p: any) => p.is_bundle === true)).toBe(true);
    expect((await call("/api/products?bundle=0&limit=48")).data.total).toBe(29);
    const facets = await call("/api/facets");
    expect(facets.data.devices.map((d: any) => d.code)).toEqual(expect.arrayContaining(["iphone", "android", "usb_c", "laptop", "ps5"]));
    expect(facets.data.devices.find((d: any) => d.code === "iphone")).toMatchObject({ en: "iPhone", bn: "আইফোন" });
  });

  it("lists live deals only, and searches the spec sheet", async () => {
    const deals = await call("/api/products?deal=1&limit=48");
    expect(deals.data.items.map((p: any) => p.slug).sort()).toEqual(["arcwave-watch-s2", "nexplay-pro-controller", "sonix-buds-pro", "voltra-gan-65w"]);
    expect(deals.data.items.every((p: any) => p.sale_price && p.sale_price < p.price && p.deal_until)).toBe(true);
    const watts = await call("/api/products?q=65W&limit=48");
    expect(watts.data.items.map((p: any) => p.slug)).toEqual(expect.arrayContaining(["voltra-gan-65w", "voltra-powerbank-20000-65w"]));
    const power = await call("/api/products?category=power&limit=48");
    expect(power.data.total).toBe(9); // parent category includes power banks, chargers and cables
    const cheap = await call("/api/products?max=600&limit=48");
    expect(cheap.data.total).toBeGreaterThan(0);
    expect(cheap.data.items.every((p: any) => (p.sale_price ?? p.price) <= 600)).toBe(true);
  });

  it("shows the spec sheet, key features, what's in the box, warranty, SKUs per colour and no badges until proof exists", async () => {
    const { data } = await call("/api/products/sonix-buds-pro");
    expect(data.product).toMatchObject({ compatible: ["iphone", "android", "laptop", "mac", "windows"], warranty_months: 12, is_bundle: false });
    expect(data.product.specs.slice(0, 3)).toEqual([{ key: "model", value: "SX-BP2" }, { key: "driver", value: "10 mm dynamic" }, { key: "anc", value: "Hybrid ANC, up to 35 dB" }]);
    expect(data.product.highlights.map((h: any) => h.name)).toEqual(["Hybrid ANC", "28 h with case", "4-mic calls"]);
    expect(data.product.in_box_en).toMatch(/^2 earbuds, charging case/);
    expect(data.product.deal_until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.certifications).toEqual([]);
    expect(data.bundle).toBeNull();
    expect(data.variants.map((v: any) => [v.sku, v.color])).toEqual([["GAD-EB-SON-BLK-0001", "Black"], ["GAD-EB-SON-WHT-0002", "White"]]);
    expect((await call("/api/products/voltra-20w-usb-c-charger")).data.inBundles.map((b: any) => b.slug)).toEqual(["iphone-charging-combo"]);
  });

  it("hides the deal end date once the deal is over (no fake countdown)", async () => {
    const id = await idOf("voltra-gan-65w");
    await env.DB.prepare("UPDATE products SET deal_until = '2020-01-01' WHERE id = ?").bind(id).run();
    expect((await call("/api/products/voltra-gan-65w")).data.product.deal_until).toBeNull();
    expect((await call("/api/products?deal=1&limit=48")).data.items.map((p: any) => p.slug)).not.toContain("voltra-gan-65w");
  });

  it("shows a badge only once proof is on file, and drops it when it expires", async () => {
    const pid = await idOf("sonix-buds-lite");
    await env.DB.prepare("INSERT INTO certifications (product_id, type, is_active) VALUES (?, 'btrc', 1)").bind(pid).run();
    expect((await call("/api/products/sonix-buds-lite")).data.certifications).toEqual([]); // no proof yet
    await env.DB.prepare("UPDATE certifications SET document_url = '/media/certificates/btrc.pdf' WHERE product_id = ?").bind(pid).run();
    const held = await call("/api/products/sonix-buds-lite");
    expect(held.data.certifications).toMatchObject([{ type: "btrc", name_en: "BTRC type approved", icon: "check" }]);
    await env.DB.prepare("UPDATE certifications SET valid_until = '2020-01-01' WHERE product_id = ?").bind(pid).run();
    expect((await call("/api/products/sonix-buds-lite")).data.certifications).toEqual([]);
    // A business-wide document covers every product that lists the type, and shows on the home strip.
    expect((await call("/api/certifications")).data.certifications).toEqual([]);
    await env.DB.prepare("UPDATE certification_types SET document_url = '/media/certificates/sonix-letter.pdf' WHERE code = 'authorised'").run();
    await env.DB.prepare("INSERT INTO certifications (product_id, type, is_active) VALUES (?, 'authorised', 1)").bind(pid).run();
    expect((await call("/api/products/sonix-buds-lite")).data.certifications.map((c: any) => c.type)).toEqual(["authorised"]);
    expect((await call("/api/certifications")).data.certifications.map((c: any) => c.code)).toEqual(["authorised"]);
  });

  it("lists what's inside a bundle with the real separate price and saving", async () => {
    const { data } = await call("/api/products/iphone-charging-combo");
    expect(data.product.is_bundle).toBe(true);
    expect(data.bundle.items.map((i: any) => [i.product.slug, i.quantity])).toEqual([
      ["voltra-20w-usb-c-charger", 1],
      ["voltra-usb-c-lightning-cable", 1],
      ["shieldr-tempered-glass-2-pack", 1],
    ]);
    expect(data.bundle.separate_price).toBe(990 + 690 + 490);
    expect(data.bundle.saving).toBe(990 + 690 + 490 - 1890);
    expect(data.variants[0].sku).toMatch(/^GAD-MA-GAD-STD-\d{4}$/);
  });

  it("compares 2–3 products spec by spec, flagging the rows that differ", async () => {
    const ids = await Promise.all(["sonix-buds-pro", "sonix-buds-lite"].map(idOf));
    const { data } = await call(`/api/compare?ids=${ids.join(",")}`);
    expect(data.items.map((p: any) => p.slug).sort()).toEqual(["sonix-buds-lite", "sonix-buds-pro"]);
    const row = (k: string) => data.rows.find((r: any) => r.key === k);
    expect(row("charging_time")).toMatchObject({ en: "Charging time", bn: "চার্জ হতে সময়", differs: false });
    expect(row("model").differs).toBe(true);
    expect(row("anc").values.filter((v: unknown) => v == null).length).toBe(1); // Lite has no ANC line
    expect((await call(`/api/compare?ids=${ids[0]}`)).res.status).toBe(400);
  });

  it("builds a setup in the finder: one in-stock product per shelf that works with the device, within budget", async () => {
    const { data } = await call("/api/finder?device=iphone&budget=3000");
    expect(data.items.length).toBeGreaterThanOrEqual(3);
    expect(new Set(data.items.map((i: any) => i.category_en)).size).toBe(data.items.length);
    expect(data.items.every((i: any) => i.product.compatible.includes("iphone") && !i.product.is_bundle && i.product.in_stock)).toBe(true);
    expect(data.total).toBeLessThanOrEqual(3000);
    expect(data.bundles.map((b: any) => b.slug)).toEqual(["iphone-charging-combo"]);
    expect(data.reason.en).toMatch(/working with iPhone/);
    const tight = await call("/api/finder?device=android&budget=1500");
    expect(tight.data.total).toBeLessThanOrEqual(1500);
    expect((await call("/api/finder?device=toaster")).res.status).toBe(422);
  });

  it("builds “goes well with” from the collections a product belongs to", async () => {
    const { data } = await call("/api/products/sonix-buds-pro");
    const set = data.goesWellWith.find((l: any) => l.slug === "iphone-essentials");
    expect(set.items.map((p: any) => p.slug)).toEqual(["voltra-20w-usb-c-charger", "shieldr-clear-magnetic-case", "voltra-magsnap-5000", "shieldr-tempered-glass-2-pack"]);
  });

  it("serves the home page, collections and the buying guides", async () => {
    const home = await call("/api/home");
    expect(home.data.collections.map((c: any) => c.slug)).toEqual(["iphone-essentials", "android-essentials", "laptop-desk-setup"]);
    expect(home.data.spotlight.ingredient).toBe("GaN");
    expect(home.data.spotlight.items.map((p: any) => p.slug)).toContain("voltra-gan-65w");
    expect(home.data.deals.length).toBeGreaterThanOrEqual(3);
    expect(home.data.deals.every((p: any) => p.deal_until && p.sale_price)).toBe(true);
    expect(home.data.bundles.length).toBe(3);
    expect(home.data.newArrivals.every((p: any) => !p.is_bundle)).toBe(true);
    expect(home.data.journal.length).toBe(3);
    const list = await call("/api/collections");
    expect(list.data.collections.length).toBe(5);
    expect(list.data.collections.find((c: any) => c.slug === "iphone-essentials")).toMatchObject({ piece_count: 5, device: "iphone" });
    const one = await call("/api/collections/laptop-desk-setup");
    expect(one.data.items.length).toBe(5);
    expect((await call("/api/collections/nope")).res.status).toBe(404);
    const guides = await call("/api/journal");
    expect(guides.data.total).toBe(3);
    const post = await call("/api/journal/ip-ratings-explained");
    expect(post.data.post.body_en).toMatch(/IPX4/);
    expect((await call("/api/journal/nope")).res.status).toBe(404);
  });

  it("puts the warranty terms and the device / spec vocabularies in the shop config", async () => {
    const { data } = await call("/api/config");
    expect(data.store.warranty_note_en).toMatch(/^Warranty covers manufacturing defects/);
    expect(data.store.warranty_note_bn).toBeTruthy();
    expect(data.devices.map((d: any) => d.code)).toEqual(["iphone", "android", "usb_c", "lightning", "laptop", "mac", "windows", "ps5", "xbox", "switch", "smart_tv"]);
    expect(data.specKeys.battery).toMatchObject({ en: "Battery", bn: "ব্যাটারি" });
  });

  it("calculates tiered delivery fees from the Dhaka shop", async () => {
    const q = (a: { division_id: number; district_id: number; upazila_id: number }, subtotal = 500) =>
      call(`/api/delivery-fee?division_id=${a.division_id}&district_id=${a.district_id}&upazila_id=${a.upazila_id}&subtotal=${subtotal}`);
    expect((await q(address.mirpur)).data).toMatchObject({ zone: { code: "dhaka_city" }, fee: 70 });
    expect((await q(address.mirpur, 3000)).data.fee).toBe(0);
    expect((await q(address.savar)).data).toMatchObject({ zone: { code: "dhaka_district" }, fee: 100 });
    expect((await q(address.tangail)).data).toMatchObject({ zone: { code: "dhaka_division" }, fee: 120 });
    expect((await q(address.chattogram)).data).toMatchObject({ zone: { code: "outside" }, fee: 130 });
  });

  it("quotes a cart on the server, with the gift-box add-on when asked", async () => {
    const charger = await variantId("GAD-CH-VOL-WHT-0001");
    const plain = await call("/api/cart/quote", { method: "POST", json: { items: [{ variantId: charger, quantity: 2 }], address: address.mirpur } });
    expect(plain.data).toMatchObject({ subtotal: 1980, deliveryFee: 70, giftWrap: false, giftWrapFee: 0, total: 2050 });
    expect(plain.data.lines[0].sku).toBe("GAD-CH-VOL-WHT-0001");
    const boxed = await call("/api/cart/quote", { method: "POST", json: { items: [{ variantId: charger, quantity: 2 }], address: address.mirpur, giftWrap: true } });
    expect(boxed.data).toMatchObject({ giftWrap: true, giftWrapFee: 60, total: 2110 });
  });

  it("serves SEO pages, sitemap, robots and the shopping feed", async () => {
    const page = await call("/product/voltra-20w-usb-c-charger");
    expect(page.res.headers.get("content-type")).toContain("text/html");
    expect(page.data).toContain('"@type":"Product"');
    expect(page.data).toContain('"priceCurrency":"BDT"');
    const missing = await call("/product/no-such-gadget");
    expect(missing.res.status).toBe(404);
    expect(missing.res.headers.get("content-type")).toContain("text/html");
    const article = await call("/guides/ip-ratings-explained");
    expect(article.data).toContain('"@type":"Article"');
    const sm = await call("/sitemap.xml");
    expect(sm.data).toContain("/product/voltra-20w-usb-c-charger");
    expect(sm.data).toContain("/collections/iphone-essentials");
    expect(sm.data).toContain("/guides/ip-ratings-explained");
    expect(sm.data).toContain("/finder");
    expect(sm.data).toContain("/deals");
    const robots = await call("/robots.txt");
    expect(robots.data).toContain("Sitemap:");
    const feed = await call("/feeds/google.xml");
    expect(feed.data).toContain("<g:id>GAD-CH-VOL-WHT-0001</g:id>");
    expect(feed.data).toContain("<g:price>990.00 BDT</g:price>");
    expect(feed.data).toContain("<g:google_product_category>222</g:google_product_category>");
  });

  it("carries a click-to-WhatsApp ad reference", async () => {
    const res = await call("/wa?ref=AD42&product=voltra-gan-65w", { raw: true, redirect: "manual" });
    expect(res.res.status).toBe(302);
    expect(decodeURIComponent(res.res.headers.get("location")!)).toContain("[ref:AD42]");
  });
});
