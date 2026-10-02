// Admin: sign-in & 2FA, roles, gadget product CRUD (GAD-<Cat>-<Brand>-<Colour>-<Seq> SKUs, spec sheet before
// publishing, devices, warranty, Deal of the Day, honest copy), trust badges with proof, combo bundles, CSV, collections,
// buying guides, product Q&A, serial numbers, the warranty-terms setting, categories, settings, jobs.
import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import adminLogin from "../fixtures/admin-login.request.json";
import adminLoginResponse from "../fixtures/admin-login.response.json";
import { call, cookieOf, setSetting, superAdmin } from "./helpers";
import { SKU_PATTERN } from "../../worker/src/lib/sku";

let admin = "";
let processor = "";

const product = (over: Record<string, unknown> = {}) => ({
  slug: `test-charger-${Math.random().toString(36).slice(2, 7)}`,
  name_en: "Test 30W USB-C Charger",
  name_bn: "টেস্ট ৩০W USB-C চার্জার",
  category_id: 8, // Chargers (CH)
  brand: "Voltra",
  price: 1290,
  compatible: ["iphone", "android", "usb_c"],
  specs: [{ key: "wattage", value: "30W USB-C PD" }, { key: "ports", value: "1 × USB-C" }],
  highlights: [{ name: "GaN", benefit_en: "A small brick that runs cooler", benefit_bn: "ছোট, কম গরম হয়" }],
  in_box_en: "Charger, warranty card",
  warranty_months: 12,
  status: "active",
  variants: [
    { color: "White", stock: 5 },
    { color: "Black", stock: 0 },
  ],
  ...over,
});
const idOf = async (slug: string) => (await env.DB.prepare("SELECT id FROM products WHERE slug = ?").bind(slug).first<{ id: number }>())!.id;

describe("sign-in and two-factor", () => {
  it("requires Super Admins to finish 2FA setup before anything else works", async () => {
    await call("/api/admin/auth/bootstrap", { method: "POST", json: { token: "test-bootstrap-token-0123456789", name: "Owner", ...adminLogin } });
    const login = await call("/api/admin/auth/login", { method: "POST", json: adminLogin });
    expect(Object.keys(login.data).sort()).toEqual(Object.keys(adminLoginResponse).sort());
    expect(login.data.needs2fa).toBe(true);
    const blocked = await call("/api/admin/orders", { cookie: cookieOf(login.res) });
    expect(blocked.res.status).toBe(403);
    expect(blocked.data.code).toBe("needs_2fa");
  });

  it("asks for the authenticator code once 2FA is on", async () => {
    admin = await superAdmin();
    const noCode = await call("/api/admin/auth/login", { method: "POST", json: adminLogin });
    expect(noCode.res.status).toBe(401);
    expect(noCode.data.code).toBe("totp_required");
    const bad = await call("/api/admin/auth/login", { method: "POST", json: { ...adminLogin, totp: "000000" } });
    expect(bad.data.code).toBe("totp_invalid");
    const me = await call("/api/admin/auth/me", { cookie: admin });
    expect(me.data.admin.totp_enabled).toBe(true);
  });

  it("lets an Order Processor sign in with phone + SMS code", async () => {
    const staff = await call("/api/admin/staff", { method: "POST", cookie: admin, json: { name: "Rina", email: "rina", phone: "01800000001", role: "order_processor", is_active: 1 } });
    expect(staff.res.status).toBe(201);
    const req = await call("/api/admin/auth/otp/request", { method: "POST", json: { phone: "01800000001" } });
    expect(req.data.devCode).toMatch(/^\d{6}$/);
    const ok = await call("/api/admin/auth/otp/verify", { method: "POST", json: { phone: "01800000001", code: req.data.devCode } });
    expect(ok.res.status).toBe(200);
    processor = cookieOf(ok.res);
    // Managers can't use SMS sign-in.
    await call("/api/admin/staff", { method: "POST", cookie: admin, json: { name: "Mona", email: "mona", phone: "01800000002", role: "manager", is_active: 1, password: "Manager-Pass-123" } });
    const mgr = await call("/api/admin/auth/otp/request", { method: "POST", json: { phone: "01800000002" } });
    expect(mgr.data.devCode).toBeUndefined();
  });

  it("enforces roles on the API, not just in the UI", async () => {
    expect((await call("/api/admin/orders", { cookie: processor })).res.status).toBe(200);
    expect((await call("/api/admin/products", { method: "POST", cookie: processor, json: product() })).res.status).toBe(403);
    expect((await call("/api/admin/settings/store", { method: "PUT", cookie: processor, json: {} })).res.status).toBe(403);
    expect((await call("/api/admin/staff", { cookie: processor })).res.status).toBe(403);
  });
});

describe("products, SKUs and certifications", () => {
  it("generates unique SKUs in the GAD-<CAT>-<BRAND>-<COLOUR>-<####> format", async () => {
    const r = await call("/api/admin/products", { method: "POST", cookie: admin, json: product() });
    expect(r.res.status).toBe(201);
    expect(r.data.skus).toHaveLength(2);
    for (const sku of r.data.skus) expect(sku).toMatch(SKU_PATTERN);
    expect(r.data.skus[0]).toMatch(/^GAD-CH-VOL-WHT-\d{4}$/);
    expect(r.data.skus[1]).toMatch(/^GAD-CH-VOL-BLK-\d{4}$/);
    // The category counter continues after the seeded chargers.
    expect(Number(r.data.skus[0].slice(-4))).toBeGreaterThan(3);
    const cable = await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ category_id: 9, brand: "", variants: [{ size: "2 m", color: "Midnight Blue", stock: 1 }] }) });
    expect(cable.data.skus[0]).toMatch(/^GAD-CB-GEN-MID-\d{4}$/);
    const again = await call("/api/admin/products", { method: "POST", cookie: admin, json: product() });
    expect(new Set([...r.data.skus, ...again.data.skus]).size).toBe(4);
    const preview = await call("/api/admin/products/sku-preview?category_id=8&brand=Sonix&color=Black", { cookie: admin });
    expect(preview.data.sku).toMatch(/^GAD-CH-SON-BLK-\d{4}$/);
  });

  it("keeps SKUs unique at the database level", async () => {
    const r = await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ variants: [{ sku: "GAD-EB-SON-BLK-0001", stock: 1 }] }) });
    expect(r.res.status).toBe(409);
    expect(r.data.fields[0].field).toBe("sku");
    await expect(env.DB.prepare("INSERT INTO product_variants (product_id, sku) VALUES (1, 'GAD-EB-SON-BLK-0001')").run()).rejects.toThrow(/UNIQUE/);
  });

  it("refuses misleading copy, unknown devices, a deal without a sale price and publishing without a spec sheet", async () => {
    const claim = await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ description_en: "Lifetime warranty — only 2 left!" }) });
    expect(claim.res.status).toBe(422);
    expect(claim.data.fields.map((f: any) => f.field)).toContain("description_en");
    expect(claim.data.fields.find((f: any) => f.field === "description_en").en).toMatch(/Lifetime warranty|only 2 left/i);
    const spec = await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ specs: [{ key: "water", value: "100% waterproof" }] }) });
    expect(spec.res.status).toBe(422);
    expect(spec.data.fields.map((f: any) => f.field)).toContain("specs.0.value");
    const bnClaim = await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ description_bn: "মাত্র ২টি বাকি" }) });
    expect(bnClaim.res.status).toBe(422);
    const noSpecs = await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ specs: [] }) });
    expect(noSpecs.res.status).toBe(422);
    expect(noSpecs.data.fields.map((f: any) => f.field)).toContain("specs");
    const draft = await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ specs: [], status: "draft" }) });
    expect(draft.res.status).toBe(201);
    expect((await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ compatible: ["toaster"] }) })).res.status).toBe(422);
    expect((await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ deal_until: "2030-01-01" }) })).res.status).toBe(422);
    const deal = await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ deal_until: "2030-01-01", sale_price: 990 }) });
    expect(deal.res.status).toBe(201);
    const listed = await call("/api/admin/products?deal=1&device=usb_c&limit=200", { cookie: admin });
    expect(listed.data.items.some((p: any) => p.id === deal.data.id && p.compatible.includes("usb_c"))).toBe(true);
    expect((await call("/api/admin/products?no_specs=1&limit=200", { cookie: admin })).data.items.some((p: any) => p.id === draft.data.id)).toBe(true);
  });

  it("only accepts certification types that exist", async () => {
    const r = await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ certifications: [{ type: "made_up_badge" }] }) });
    expect(r.res.status).toBe(422);
    expect(r.data.fields[0].field).toBe("certifications.0.type");
    // …and the database refuses it too.
    await expect(env.DB.prepare("INSERT INTO certifications (product_id, type) VALUES (1, 'made_up_badge')").run()).rejects.toThrow(/FOREIGN KEY/);
  });

  it("manages trust-badge types and shows a badge only with proof, until it expires", async () => {
    const t = await call("/api/admin/certifications", { method: "POST", cookie: admin, json: { code: "drop_tested", name_en: "Drop tested", name_bn: "ড্রপ পরীক্ষিত", icon: "star", issuer: "Test lab" } });
    expect(t.res.status).toBe(201);
    expect((await call("/api/admin/certifications", { method: "POST", cookie: processor, json: { code: "x_y", name_en: "X", name_bn: "X" } })).res.status).toBe(403);
    const up = new FormData();
    up.append("folder", "certificates");
    up.append("file", new File([new Uint8Array([37, 80, 68, 70])], "btrc-approval.pdf", { type: "application/pdf" }));
    const upload = await call("/api/admin/uploads", { method: "POST", cookie: admin, body: up });
    expect(upload.res.status).toBe(201);
    expect(upload.data.url).toMatch(/^\/media\/certificates\//);
    const p = product({
      certifications: [
        { type: "btrc", issuer: "BTRC", document_url: upload.data.url, document_name: "btrc-approval.pdf" },
        { type: "drop_tested" }, // saved, but no proof yet → not shown
        { type: "official_warranty", document_url: upload.data.url, valid_until: "2020-01-01" }, // expired → not shown
      ],
    });
    const r = await call("/api/admin/products", { method: "POST", cookie: admin, json: p });
    expect(r.res.status).toBe(201);
    const pub = await call(`/api/products/${p.slug}`);
    expect(pub.data.certifications.map((c: any) => [c.type, c.icon])).toEqual([["btrc", "check"]]);
    // A business-wide certificate on the type covers every product that lists it.
    const list = await call("/api/admin/certifications", { cookie: admin });
    const fair = list.data.items.find((x: any) => x.code === "drop_tested");
    expect(fair).toMatchObject({ held: 0, product_count: 1 });
    await call(`/api/admin/certifications/${fair.id}`, { method: "PUT", cookie: admin, json: { ...fair, document_url: upload.data.url, document_name: "drop-test.pdf" } });
    expect((await call(`/api/products/${p.slug}`)).data.certifications.map((c: any) => c.type).sort()).toEqual(["btrc", "drop_tested"]);
    expect((await call("/api/certifications")).data.certifications.map((c: any) => c.code)).toContain("drop_tested");
    const doc = await call(upload.data.url, { raw: true });
    expect(doc.res.status).toBe(200);
    await doc.res.arrayBuffer();
  });

  it("builds combo bundles from ordinary products only", async () => {
    const [charger, cable, glass, combo] = await Promise.all(["voltra-20w-usb-c-charger", "voltra-usb-c-cable-100w", "shieldr-tempered-glass-2-pack", "iphone-charging-combo"].map(idOf));
    const bundle = product({ category_id: 10, brand: "Gadget Market", name_en: "Test Charge Bundle", name_bn: "টেস্ট চার্জ বান্ডেল", price: 1990, bundle_items: [{ product_id: charger, quantity: 1 }, { product_id: cable, quantity: 2 }], variants: [{ stock: 3 }] });
    const r = await call("/api/admin/products", { method: "POST", cookie: admin, json: bundle });
    expect(r.res.status).toBe(201);
    expect(r.data.skus[0]).toMatch(/^GAD-MA-GAD-STD-\d{4}$/);
    const detail = await call(`/api/admin/products/${r.data.id}`, { cookie: admin });
    expect(detail.data.item.bundle_items.map((b: any) => [b.product.name_en, b.quantity])).toEqual([["Voltra 20W USB-C PD Charger", 1], ["Voltra USB-C to USB-C 100W Braided Cable", 2]]);
    const pub = await call(`/api/products/${bundle.slug}`);
    expect(pub.data.bundle.separate_price).toBe(990 + 2 * 590);
    expect(pub.data.bundle.saving).toBe(990 + 2 * 590 - 1990);
    expect((await call("/api/products/voltra-20w-usb-c-charger")).data.inBundles.map((k: any) => k.slug)).toContain(bundle.slug);
    // No bundles inside bundles, a bundle can't contain itself, and a product inside a bundle can't become one.
    const nested = await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ bundle_items: [{ product_id: charger }, { product_id: combo }] }) });
    expect(nested.res.status).toBe(422);
    expect(nested.data.fields[0].field).toBe("bundle_items.1.product_id");
    const self = await call(`/api/admin/products/${r.data.id}`, { method: "PUT", cookie: admin, json: { ...bundle, bundle_items: [{ product_id: charger }, { product_id: r.data.id }] } });
    expect(self.res.status).toBe(422);
    const chargerItem = (await call(`/api/admin/products/${charger}`, { cookie: admin })).data.item;
    const chargerAsBundle = await call(`/api/admin/products/${charger}`, { method: "PUT", cookie: admin, json: { ...chargerItem, bundle_items: [{ product_id: cable }, { product_id: glass }], certifications: [] } });
    expect(chargerAsBundle.res.status).toBe(422);
    const ghost = await call("/api/admin/products", { method: "POST", cookie: admin, json: product({ bundle_items: [{ product_id: charger }, { product_id: 99999 }] }) });
    expect(ghost.res.status).toBe(422);
    expect((await call("/api/admin/products?bundle=1&limit=200", { cookie: admin })).data.items.some((p: any) => p.id === r.data.id && p.is_bundle)).toBe(true);
  });

  it("keeps SKUs when a product is edited and blocks removing sold options", async () => {
    const created = await call("/api/admin/products", { method: "POST", cookie: admin, json: product() });
    const detail = await call(`/api/admin/products/${created.data.id}`, { cookie: admin });
    const variants = detail.data.item.variants.map((v: any) => ({ id: v.id, sku: "", size: v.size, color: v.color, stock: v.stock + 1 }));
    const saved = await call(`/api/admin/products/${created.data.id}`, { method: "PUT", cookie: admin, json: { ...product({ slug: detail.data.item.slug }), variants } });
    expect(saved.res.status).toBe(200);
    expect(saved.data.skus).toEqual(created.data.skus);
    const buds = await call("/api/admin/products/1", { cookie: admin });
    await env.DB.prepare(
      "INSERT INTO orders (order_no, public_token, customer_name, customer_phone, division_id, district_id, upazila_id, division, district, upazila, area, zone_code, subtotal, total, payment_method) VALUES ('T-1','t','A','01700000000',6,47,9026,'D','D','M','x','dhaka_city',1,1,'COD')",
    ).run();
    await env.DB.prepare("INSERT INTO order_items (order_id, product_id, variant_id, sku, name_en, name_bn, quantity, unit_price, line_total) VALUES ((SELECT id FROM orders WHERE order_no='T-1'), 1, ?, 'x', 'x', 'x', 1, 1, 1)")
      .bind(buds.data.item.variants[0].id)
      .run();
    const it = buds.data.item;
    const removeSold = await call("/api/admin/products/1", {
      method: "PUT",
      cookie: admin,
      json: { ...it, variants: it.variants.slice(1).map((v: any) => ({ id: v.id, sku: v.sku, size: v.size, color: v.color, stock: v.stock })), certifications: [] },
    });
    expect(removeSold.res.status).toBe(409);
  });

  it("exports and re-imports products as CSV", async () => {
    const csv = await call("/api/admin/products?format=csv", { cookie: admin });
    expect(csv.res.headers.get("content-type")).toContain("text/csv");
    const header = csv.data.replace(/^﻿/, "").split("\r\n")[0];
    expect(header).toContain("variant_sku");
    const body = `slug,name_en,name_bn,category_code,brand,price,compatible,warranty_months,status,specs,variant_sku,size,color,stock\r\nimported-usb-c-cable,Voltra USB-C Cable 2 m,ভোল্ট্রা USB-C ক্যাবল ২ মি,CB,Voltra,490,USB-C | Android,6,active,"length: 2 m | wattage: 60W",,Standard,Black,12\r\nbad-row,No Category,x,ZZZ,,100,,0,active,model: X,,Standard,,1\r\n`;
    const imp = await call("/api/admin/products/import", { method: "POST", cookie: admin, body, headers: { "content-type": "text/csv" } });
    expect(imp.data.results).toEqual([{ slug: "imported-usb-c-cable", ok: true }, { slug: "bad-row", ok: false, error: expect.stringContaining("Unknown category") }]);
    const p = await call("/api/products/imported-usb-c-cable");
    expect(p.data.variants[0].sku).toMatch(/^GAD-CB-VOL-BLK-\d{4}$/);
    expect(p.data.product).toMatchObject({ compatible: ["usb_c", "android"], warranty_months: 6, specs: [{ key: "length", value: "2 m" }, { key: "wattage", value: "60W" }] });
    const claim = `slug,name_en,name_bn,category_code,price,status,specs,description_en,variant_sku,size,stock\r\nclaim-cable,Claim Cable,x,CB,100,draft,length: 1 m,Lifetime warranty,,Standard,1\r\n`;
    const bad = await call("/api/admin/products/import", { method: "POST", cookie: admin, body: claim, headers: { "content-type": "text/csv" } });
    expect(bad.data.results[0]).toMatchObject({ slug: "claim-cable", ok: false, error: expect.stringMatching(/lifetime/i) });
  });

  it("notifies everyone waiting once an item is back in stock", async () => {
    const created = await call("/api/admin/products", { method: "POST", cookie: admin, json: product() });
    const detail = await call(`/api/admin/products/${created.data.id}`, { cookie: admin });
    const outOfStock = detail.data.item.variants.find((v: any) => v.stock === 0);
    const req = await call("/api/stock-notify", { method: "POST", json: { productId: created.data.id, variantId: outOfStock.id, phone: "01711000001" } });
    expect(req.res.status).toBe(201);
    await call("/api/admin/inventory/adjust", { method: "POST", cookie: admin, json: { items: [{ variantId: outOfStock.id, mode: "add", quantity: 3, reason: "restock" }] } });
    const n = await call(`/api/admin/products/${created.data.id}/notify-waiting`, { method: "POST", cookie: admin });
    expect(n.data.sent).toBe(1);
    const log = await call(`/api/admin/inventory/log?variant_id=${outOfStock.id}`, { cookie: admin });
    expect(log.data.items[0]).toMatchObject({ change: 3, stock_after: 3, reason: "restock" });
  });
});

describe("collections, buying guides, product Q&A and serial numbers", () => {
  it("creates a collection in pick order, validates its products and powers “goes well with”", async () => {
    const pieces = await Promise.all(["keyra-k3-keyboard-mouse-combo", "keyra-7-in-1-usb-c-hub", "voltra-gan-65w"].map(idOf));
    const name = { slug: "home-office", name_en: "Home Office", name_bn: "হোম অফিস" };
    expect((await call("/api/admin/collections", { method: "POST", cookie: admin, json: { ...name, product_ids: [pieces[0]] } })).res.status).toBe(422);
    expect((await call("/api/admin/collections", { method: "POST", cookie: admin, json: { ...name, product_ids: [pieces[0], 99999] } })).res.status).toBe(422);
    expect((await call("/api/admin/collections", { method: "POST", cookie: admin, json: { ...name, product_ids: pieces, description_en: "The best in Bangladesh — never overheats." } })).res.status).toBe(422);
    expect((await call("/api/admin/collections", { method: "POST", cookie: processor, json: {} })).res.status).toBe(403);

    const r = await call("/api/admin/collections", { method: "POST", cookie: admin, json: { ...name, device: "laptop", product_ids: pieces, is_featured: 0 } });
    expect(r.res.status).toBe(201);
    const detail = await call(`/api/admin/collections/${r.data.id}`, { cookie: admin });
    expect(detail.data.item.product_ids).toEqual(pieces);
    const list = await call("/api/admin/collections?device=laptop", { cookie: admin });
    expect(list.data.items.find((c: any) => c.slug === "home-office")).toMatchObject({ piece_count: 3, device: "laptop" });

    const pub = await call("/api/collections/home-office");
    expect(pub.data.items.map((p: any) => p.id)).toEqual(pieces);
    const pdp = await call("/api/products/voltra-gan-65w");
    const look = pdp.data.goesWellWith.find((l: any) => l.slug === "home-office");
    expect(look.items.map((p: any) => p.id)).toEqual(pieces.slice(0, 2));

    const hide = await call(`/api/admin/collections/${r.data.id}`, { method: "PUT", cookie: admin, json: { ...detail.data.item, products: undefined, is_active: 0 } });
    expect(hide.res.status).toBe(200);
    expect((await call("/api/collections/home-office")).res.status).toBe(404);
  });

  it("publishes buying guides, checked for honest copy", async () => {
    const post = { slug: "usb-c-cables-explained", title_en: "USB-C cables explained", title_bn: "USB-C ক্যাবল সহজ ভাষায়", body_en: "Not every USB-C cable carries 100W.\n\nCheck the wattage on the spec sheet.", product_ids: [await idOf("voltra-usb-c-cable-100w")] };
    const claim = await call("/api/admin/posts", { method: "POST", cookie: admin, json: { ...post, body_en: "Our cables are unbreakable and come with a lifetime warranty." } });
    expect(claim.res.status).toBe(422);
    const draft = await call("/api/admin/posts", { method: "POST", cookie: admin, json: post });
    expect(draft.res.status).toBe(201);
    expect((await call("/api/journal/usb-c-cables-explained")).res.status).toBe(404);
    const item = (await call(`/api/admin/posts/${draft.data.id}`, { cookie: admin })).data.item;
    const pub = await call(`/api/admin/posts/${draft.data.id}`, { method: "PUT", cookie: admin, json: { ...item, status: "published" } });
    expect(pub.res.status).toBe(200);
    const live = await call("/api/journal/usb-c-cables-explained");
    expect(live.data.post.published_at).toBeTruthy();
    expect(live.data.products.map((p: any) => p.slug)).toEqual(["voltra-usb-c-cable-100w"]);
    expect((await call("/api/journal")).data.items[0].slug).toBe("usb-c-cables-explained");
    expect((await call("/guides/usb-c-cables-explained")).data).toContain('"@type":"Article"');
  });

  it("publishes a product question only once staff answer it", async () => {
    const pid = await idOf("sonix-boom-mini");
    const ask = await call("/api/questions", { method: "POST", json: { productId: pid, name: "Tanvir", question: "Can I pair two of these for stereo?" } });
    expect(ask.res.status).toBe(201);
    expect((await call("/api/products/sonix-boom-mini")).data.questions).toEqual([]);
    const pending = await call("/api/admin/questions?status=pending", { cookie: admin });
    const q = pending.data.items.find((x: any) => x.question.startsWith("Can I pair two"));
    expect(q).toBeTruthy();
    // Order processors answer questions too (they're on the phone with customers all day).
    const ans = await call(`/api/admin/questions/${q.id}`, { method: "PUT", cookie: processor, json: { answer: "Yes — hold both play buttons for 3 seconds to pair them as a stereo set." } });
    expect(ans.res.status).toBe(200);
    const live = await call("/api/products/sonix-boom-mini");
    expect(live.data.questions).toMatchObject([{ question: "Can I pair two of these for stereo?", answer: expect.stringMatching(/^Yes — hold both/) }]);
  });

  it("logs serial numbers for units on the shelf, once each", async () => {
    const vid = (await env.DB.prepare("SELECT id FROM product_variants WHERE sku = 'GAD-EB-SON-WHT-0002'").first<{ id: number }>())!.id;
    const log = await call("/api/admin/inventory/serials", { method: "POST", cookie: admin, json: { variantId: vid, serials: "bpw-test-0001\nBPW-TEST-0002, BPW-TEST-0002" } });
    expect(log.res.status).toBe(201);
    expect(log.data.count).toBe(2);
    const dupe = await call("/api/admin/inventory/serials", { method: "POST", cookie: admin, json: { variantId: vid, serials: "BPW-TEST-0001" } });
    expect(dupe.res.status).toBe(409);
    const tooMany = await call("/api/admin/inventory/serials", { method: "POST", cookie: admin, json: { variantId: vid, serials: Array.from({ length: 40 }, (_, i) => `BPW-X-${1000 + i}`).join("\n") } });
    expect(tooMany.res.status).toBe(400); // more serials than units on the shelf
    const list = await call("/api/admin/inventory/serials?q=BPW-TEST", { cookie: admin });
    expect(list.data.items.map((x: any) => x.serial).sort()).toEqual(["BPW-TEST-0001", "BPW-TEST-0002"]);
    const faulty = await call(`/api/admin/inventory/serials/${list.data.items[0].id}`, { method: "PUT", cookie: admin, json: { status: "faulty", note: "Dead on arrival" } });
    expect(faulty.res.status).toBe(200);
    const inv = await call("/api/admin/inventory?q=GAD-EB-SON-WHT-0002", { cookie: admin });
    expect(inv.data.items[0].serials_in_stock).toBe(1);
  });
});

describe("categories, settings and housekeeping", () => {
  it("creates nested categories and saves drag-to-reorder", async () => {
    const c = await call("/api/admin/categories", { method: "POST", cookie: admin, json: { slug: "car-chargers", code: "CC", parent_id: 6, name_en: "Car Chargers", name_bn: "কার চার্জার" } });
    expect(c.res.status).toBe(201);
    const r = await call("/api/admin/categories/reorder", { method: "PUT", cookie: admin, json: { items: [{ id: c.data.id, parent_id: 6, sort_order: 0 }] } });
    expect(r.res.status).toBe(200);
    const del = await call("/api/admin/categories/1", { method: "DELETE", cookie: admin });
    expect(del.res.status).toBe(409); // still has products
  });

  it("switches a category Active ⇄ Inactive in one tap, with its sub-categories", async () => {
    const slugs = async () => ((await call("/api/categories")).data.categories as { slug: string }[]).map((c) => c.slug);
    expect(await slugs()).toEqual(expect.arrayContaining(["power", "car-chargers"]));
    expect((await call("/api/products?category=power")).data.total).toBeGreaterThan(0);

    expect((await call("/api/admin/categories/6/status", { method: "PUT", cookie: processor, json: { is_active: false } })).res.status).toBe(403);
    const off = await call("/api/admin/categories/6/status", { method: "PUT", cookie: admin, json: { is_active: false } });
    expect(off.res.status).toBe(200);
    expect(off.data.ids.length).toBeGreaterThanOrEqual(2); // parent + its sub-category
    expect(off.data.en).toMatch(/inactive/);
    const after = await slugs();
    expect(after).not.toContain("power");
    expect(after).not.toContain("car-chargers");
    expect((await call("/api/products?category=power")).data.total).toBe(0);
    // Products themselves stay on sale.
    expect((await call("/api/products/voltra-powerbank-10000")).res.status).toBe(200);
    const listed = await call("/api/admin/categories?is_active=0", { cookie: admin });
    expect(listed.data.items.map((c: { slug: string }) => c.slug)).toEqual(expect.arrayContaining(["power", "car-chargers"]));

    const on = await call("/api/admin/categories/6/status", { method: "PUT", cookie: admin, json: { is_active: true } });
    expect(on.res.status).toBe(200);
    expect(await slugs()).toEqual(expect.arrayContaining(["power", "car-chargers"]));
    const audit = await env.DB.prepare("SELECT action FROM audit_log WHERE entity = 'category' AND entity_id = '6' ORDER BY id").all<{ action: string }>();
    expect(audit.results.map((r) => r.action)).toEqual(expect.arrayContaining(["deactivate", "activate"]));
  });

  it("creates a new category as Inactive from the form (blank optional fields) and turns it on", async () => {
    // Exactly what the admin form sends when the optional fields, including "Tile colour", are left blank.
    const form = { name_en: "Drones", name_bn: "ড্রোন", slug: "drones", code: "DR", parent_id: null, description_en: "", description_bn: "", image_url: "", color: "", sort_order: 0, is_active: 0 };
    const created = await call("/api/admin/categories", { method: "POST", cookie: admin, json: form });
    expect(created.res.status).toBe(201);
    const row = await env.DB.prepare("SELECT color, is_active FROM categories WHERE id = ?").bind(created.data.id).first<{ color: string | null; is_active: number }>();
    expect(row).toEqual({ color: null, is_active: 0 });
    const slugs = async () => ((await call("/api/categories")).data.categories as { slug: string }[]).map((c) => c.slug);
    expect(await slugs()).not.toContain("drones");
    await call(`/api/admin/categories/${created.data.id}/status`, { method: "PUT", cookie: admin, json: { is_active: true } });
    expect(await slugs()).toContain("drones");
  });

  it("edits the warranty terms in one place and refuses to shorten them away", async () => {
    const store = (await call("/api/admin/settings", { cookie: admin })).data.settings.store;
    expect(store.warranty_note_en).toMatch(/^Warranty covers manufacturing defects/);
    const short = await call("/api/admin/settings/store", { method: "PUT", cookie: admin, json: { ...store, warranty_note_en: "1 year." } });
    expect(short.res.status).toBe(422);
    const custom = `${store.warranty_note_en} Keep the box for the warranty period.`;
    await setSetting(admin, "store", { ...store, warranty_note_en: custom });
    expect((await call("/api/config")).data.store.warranty_note_en).toBe(custom);
    await setSetting(admin, "store", store);
  });

  it("refuses API secrets in database-backed settings and validates rule settings", async () => {
    const bad = await call("/api/admin/settings/integrations", { method: "PUT", cookie: admin, json: { metaPixelId: "1", apiToken: "x" } });
    expect(bad.res.status).toBe(400);
    const invalid = await call("/api/admin/settings/fraud", { method: "PUT", cookie: admin, json: { velocityMaxPerPhone: 0 } });
    expect(invalid.res.status).toBe(422);
    await setSetting(admin, "tax", { enabled: true, rate: 5, inclusive: true, bin: "000123456-0101" });
    const s = await call("/api/admin/settings", { cookie: admin });
    expect(s.data.settings.tax).toMatchObject({ enabled: true, rate: 5 });
    expect(JSON.stringify(s.data)).not.toMatch(/SECRET|PASSWD/);
  });

  it("runs background jobs: recovery messages and retention purge", async () => {
    await setSetting(admin, "abandoned", { autoRecovery: true, recoveryDelayMin: 10, recoveryDiscount: 50 });
    await env.DB.prepare("INSERT INTO abandoned_checkouts (session_id, name, phone, cart, cart_total, updated_at) VALUES ('sess-job-000000000001', 'Liza', '01711000002', '[]', 500, ?)")
      .bind(new Date(Date.now() - 2 * 3600_000).toISOString())
      .run();
    await env.DB.prepare("INSERT INTO abandoned_checkouts (session_id, phone, updated_at) VALUES ('sess-old-0000000000001', '01711000003', '2020-01-01T00:00:00.000Z')").run();
    const r = await call("/api/admin/jobs/run", { method: "POST", cookie: admin });
    expect(r.data.result.purged).toBe(1);
    const row = await env.DB.prepare("SELECT recovery_sent_at FROM abandoned_checkouts WHERE session_id = 'sess-job-000000000001'").first<{ recovery_sent_at: string | null }>();
    expect(row!.recovery_sent_at).not.toBeNull();
    const coupon = await env.DB.prepare("SELECT kind, value, customer_phone FROM coupons WHERE kind = 'recovery'").first();
    expect(coupon).toMatchObject({ kind: "recovery", value: 50, customer_phone: "01711000002" });
  });

  it("records every admin action in the audit log", async () => {
    const log = await call("/api/admin/audit?entity=product", { cookie: admin });
    expect(log.data.items.some((x: any) => x.action === "create")).toBe(true);
    const csv = await call("/api/admin/audit?format=csv", { cookie: admin });
    expect(csv.res.headers.get("content-type")).toContain("text/csv");
  });

  it("guides first-time setup with a checklist", async () => {
    const o = await call("/api/admin/onboarding", { cookie: admin });
    expect(o.data.steps.map((s: any) => s.key)).toEqual(["store", "product", "zone", "batch", "payment", "whatsapp"]);
    // Starter stock doesn't count: the step is done once the owner receives a lot themselves.
    expect(o.data.steps.find((s: any) => s.key === "batch").done).toBe(false);
    const vid = (await env.DB.prepare("SELECT id FROM product_variants WHERE sku = 'GAD-EB-SON-BLK-0001'").first<{ id: number }>())!.id;
    // Gadgets don't expire: the expiry is optional.
    expect((await call("/api/admin/inventory/batches", { method: "POST", cookie: admin, json: { variantId: vid, batch_no: "PO-2610-001", quantity: 6, cost_price: 1850, expiry_date: "" } })).res.status).toBe(201);
    const after = await call("/api/admin/onboarding", { cookie: admin });
    expect(after.data.steps.find((s: any) => s.key === "batch").done).toBe(true);
    expect(o.data.steps.find((s: any) => s.key === "product").done).toBe(true);
  });
});
