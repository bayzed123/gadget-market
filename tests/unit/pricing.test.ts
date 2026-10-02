import { describe, expect, it } from "vitest";
import { deliveryFee, evaluateCoupon, resolveZone, salePriceFor, vatFor, type CouponRule, type Zone } from "../../worker/src/lib/pricing";

const zone = (z: Partial<Zone> & { code: string }): Zone => ({ name_en: z.code, name_bn: z.code, fee: 100, free_shipping_min: null, division_ids: [], district_ids: [], upazila_ids: [], is_default: 0, ...z });
const zones = [
  zone({ code: "dhaka_city", fee: 70, free_shipping_min: 2000, upazila_ids: [9026] }),
  zone({ code: "dhaka_suburbs", fee: 100, district_ids: [47, 41] }),
  zone({ code: "dhaka_division", fee: 120, division_ids: [6] }),
  zone({ code: "outside", fee: 130, is_default: 1 }),
];

describe("delivery zones (Division → District → Upazila)", () => {
  it("prefers upazila, then district, then division, then default", () => {
    expect(resolveZone(zones, 6, 47, 9026)?.code).toBe("dhaka_city");
    expect(resolveZone(zones, 6, 47, 365)?.code).toBe("dhaka_suburbs");
    expect(resolveZone(zones, 6, 44, 342)?.code).toBe("dhaka_division");
    expect(resolveZone(zones, 1, 8, 65)?.code).toBe("outside");
  });
  it("applies the free-delivery threshold", () => {
    expect(deliveryFee(zones[0]!, 1999)).toBe(70);
    expect(deliveryFee(zones[0]!, 2000)).toBe(0);
  });
  it("ignores inactive zones", () => {
    expect(resolveZone([{ ...zones[0]!, is_active: 0 }, zones[3]!], 6, 47, 9026)?.code).toBe("outside");
  });
});

describe("discounts", () => {
  it("turns product discounts into a sale price", () => {
    expect(salePriceFor(1000, "percent", 10, null)).toBe(900);
    expect(salePriceFor(1000, "flat", 150, null)).toBe(850);
    expect(salePriceFor(1000, "none", 0, 1200)).toBeNull();
  });
  const base: CouponRule = { code: "X", type: "percent", value: 10, min_order: 500, max_discount: 150, starts_at: null, expires_at: null, usage_limit: null, used_count: 0, is_active: 1, category_ids: [] };
  it("caps percentage coupons and checks the minimum", () => {
    expect(evaluateCoupon(base, [{ category_id: 1, line_total: 2000 }])).toEqual({ ok: true, discount: 150, eligibleSubtotal: 2000 });
    expect(evaluateCoupon(base, [{ category_id: 1, line_total: 400 }])).toEqual({ ok: false, reason: "min_order" });
  });
  it("free-delivery coupons take nothing off the items but still check the minimum", () => {
    const fd: CouponRule = { ...base, type: "free_delivery", value: 0, max_discount: null };
    expect(evaluateCoupon(fd, [{ category_id: 1, line_total: 900 }])).toEqual({ ok: true, discount: 0, eligibleSubtotal: 900, freeDelivery: true });
    expect(evaluateCoupon(fd, [{ category_id: 1, line_total: 400 }])).toEqual({ ok: false, reason: "min_order" });
  });
  it("respects expiry, usage limits and reserved phones", () => {
    expect(evaluateCoupon({ ...base, expires_at: "2020-01-01T00:00:00Z" }, [{ category_id: 1, line_total: 900 }]).ok).toBe(false);
    expect(evaluateCoupon({ ...base, usage_limit: 1, used_count: 1 }, [{ category_id: 1, line_total: 900 }])).toEqual({ ok: false, reason: "used_up" });
    expect(evaluateCoupon({ ...base, customer_phone: "01711111111" }, [{ category_id: 1, line_total: 900 }], "01722222222")).toEqual({ ok: false, reason: "not_yours" });
  });
});

describe("VAT (off by default)", () => {
  it("shows the VAT portion when prices include VAT", () => {
    expect(vatFor(1050, { enabled: true, rate: 5, inclusive: true })).toEqual({ vat: 50, addToTotal: 0 });
  });
  it("adds VAT on top when prices exclude VAT", () => {
    expect(vatFor(1000, { enabled: true, rate: 5, inclusive: false })).toEqual({ vat: 50, addToTotal: 50 });
  });
  it("does nothing when disabled", () => {
    expect(vatFor(1000, { enabled: false, rate: 5, inclusive: true })).toEqual({ vat: 0, addToTotal: 0 });
  });
});
