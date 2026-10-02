// Free delivery (per product and by coupon) vs the auto-calculated delivery charge, and the admin banner types.
import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { address, call, superAdmin, variantId } from "./helpers";

let admin = "";
let glass = 0; // seeded with free delivery (a light screen-protector pack)
let buds = 0; // seeded with the zone-based charge (product id 1)

beforeAll(async () => {
  admin = await superAdmin();
  const v = await env.DB.prepare("SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.slug = 'shieldr-tempered-glass-2-pack' ORDER BY v.id").first<{ id: number }>();
  glass = v!.id;
  buds = await variantId("GAD-EB-SON-BLK-0001");
});

const quote = (json: Record<string, unknown>) => call("/api/cart/quote", { method: "POST", json });

describe("delivery charge", () => {
  it("is not charged for a cart of free-delivery products, even before an address is chosen", async () => {
    const { res, data } = await quote({ items: [{ variantId: glass, quantity: 1 }], address: address.chattogram });
    expect(res.status).toBe(200);
    expect(data.freeDelivery).toBe("products");
    expect(data.deliveryFee).toBe(0);
    expect(data.total).toBe(data.subtotal - data.discount);
    const noAddress = await quote({ items: [{ variantId: glass, quantity: 1 }] });
    expect(noAddress.data).toMatchObject({ freeDelivery: "products", deliveryFee: 0 });
  });

  it("is calculated from the customer's area when the cart has any zone-charged product", async () => {
    const outside = await quote({ items: [{ variantId: glass, quantity: 1 }, { variantId: buds, quantity: 1 }], address: address.chattogram });
    expect(outside.data.freeDelivery).toBeNull();
    expect(outside.data.deliveryFee).toBeGreaterThan(0);
    const dhaka = await quote({ items: [{ variantId: buds, quantity: 1 }], address: address.mirpur });
    expect(dhaka.data.deliveryFee).toBeGreaterThan(0);
    expect(dhaka.data.deliveryFee).not.toBe(outside.data.deliveryFee);
  });

  it("can be switched per product from the admin panel", async () => {
    const save = async (delivery_mode: string) => {
      const it = (await call("/api/admin/products/1", { cookie: admin })).data.item;
      const variants = it.variants.map((v: any) => ({ id: v.id, sku: v.sku, size: v.size, color: v.color, stock: v.stock, price_override: v.price_override }));
      return call("/api/admin/products/1", { method: "PUT", cookie: admin, json: { ...it, delivery_mode, variants, certifications: [] } });
    };
    expect((await call("/api/admin/products/1", { cookie: admin })).data.item.delivery_mode).toBe("zone");
    expect((await save("free")).res.status).toBe(200);
    const free = await quote({ items: [{ variantId: buds, quantity: 1 }], address: address.chattogram });
    expect(free.data).toMatchObject({ freeDelivery: "products", deliveryFee: 0 });
    const card = (await call("/api/products?q=sonix")).data.items.find((i: any) => i.id === 1);
    expect(card.delivery_mode).toBe("free");
    expect((await save("zone")).res.status).toBe(200);
    const charged = await quote({ items: [{ variantId: buds, quantity: 1 }], address: address.chattogram });
    expect(charged.data.deliveryFee).toBeGreaterThan(0);
  });
});

describe("coupons", () => {
  beforeAll(async () => {
    const fd = await call("/api/admin/coupons", { method: "POST", cookie: admin, json: { code: "SHIPFREE", type: "free_delivery", value: 0, min_order: 400 } });
    expect(fd.res.status).toBe(201);
    const flat = await call("/api/admin/coupons", { method: "POST", cookie: admin, json: { code: "FLAT50", type: "flat", value: 50 } });
    expect(flat.res.status).toBe(201);
  });

  it("a free-delivery coupon removes the delivery charge and nothing else", async () => {
    const { data } = await quote({ items: [{ variantId: buds, quantity: 1 }], address: address.chattogram, couponCode: "shipfree" });
    expect(data).toMatchObject({ couponCode: "SHIPFREE", discount: 0, deliveryFee: 0, freeDelivery: "coupon" });
    expect(data.total).toBe(data.subtotal);
  });

  it("an amount coupon still leaves the auto-calculated delivery charge", async () => {
    const { data } = await quote({ items: [{ variantId: buds, quantity: 1 }], address: address.chattogram, couponCode: "FLAT50" });
    expect(data.discount).toBe(50);
    expect(data.deliveryFee).toBeGreaterThan(0);
    expect(data.total).toBe(data.subtotal - 50 + data.deliveryFee);
  });

  it("stores free-delivery coupons with no value and still validates amount coupons", async () => {
    const list = await call("/api/admin/coupons?type=free_delivery", { cookie: admin });
    expect(list.data.items.map((c: { code: string }) => c.code)).toContain("SHIPFREE");
    expect(list.data.items.find((c: { code: string }) => c.code === "SHIPFREE")).toMatchObject({ value: 0, max_discount: null });
    const bad = await call("/api/admin/coupons", { method: "POST", cookie: admin, json: { code: "ZERO", type: "flat", value: 0 } });
    expect(bad.res.status).toBe(422);
  });
});

describe("banners", () => {
  it("offer and marketing banners appear on the home page; a popup is served with the store config", async () => {
    for (const placement of ["offer", "marketing", "popup"]) {
      const r = await call("/api/admin/banners", { method: "POST", cookie: admin, json: { placement, title_en: `Test ${placement}`, title_bn: `টেস্ট ${placement}`, link_url: "/shop", color: "sky", sort_order: 0 } });
      expect(r.res.status).toBe(201);
    }
    const home = await call("/api/home");
    const placements = home.data.banners.map((b: { placement: string }) => b.placement);
    expect(placements).toEqual(expect.arrayContaining(["hero", "offer", "marketing"]));
    expect(placements).not.toContain("popup");
    const cfg = await call("/api/config");
    expect(cfg.data.popup).toMatchObject({ title_en: "Test popup" });
  });

  it("rejects unknown placements", async () => {
    const r = await call("/api/admin/banners", { method: "POST", cookie: admin, json: { placement: "promo", title_en: "Old", title_bn: "পুরনো" } });
    expect(r.res.status).toBe(422);
  });
});
