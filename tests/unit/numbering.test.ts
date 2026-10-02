import { describe, expect, it } from "vitest";
import { brandCode, catCode, colorCode, COMPATIBLE, formatInvoiceNo, formatSku, INVOICE_PATTERN, isCompatible, SKU_PATTERN, specLabel, warrantyUntil } from "../../worker/src/lib/sku";
import { bdDateStamp } from "../../worker/src/lib/http";

describe("SKU numbering", () => {
  it("follows GAD-<Category>-<Brand>-<Colour>-<Sequence>", () => {
    expect(formatSku("EB", "Sonix", "Black", 7)).toBe("GAD-EB-SON-BLK-0007");
    expect(formatSku("pb", "Voltra", "Midnight Blue", 12)).toBe("GAD-PB-VOL-MID-0012");
    expect(formatSku("CB", "Voltra", "", 12345)).toBe("GAD-CB-VOL-STD-12345");
    expect(formatSku("GM", null, null, 1)).toBe("GAD-GM-GEN-STD-0001");
  });
  it("turns brands and colours into three-letter codes", () => {
    expect(brandCode("JBL")).toBe("JBL");
    expect(brandCode("boAt")).toBe(brandCode("BOAT"));
    expect(brandCode("X")).toBe("GEN");
    expect(colorCode("Gray")).toBe("GRY");
    expect(colorCode("grey")).toBe("GRY");
    expect(colorCode("Space Black")).toBe("SPA");
    expect(colorCode("Black / Red")).toBe("BLK");
    expect(colorCode(undefined)).toBe("STD");
  });
  it("normalises category codes", () => {
    expect(catCode("eb")).toBe("EB");
    expect(catCode("p-b")).toBe("PB");
    expect(catCode("audio")).toBe("AUD");
    expect(catCode("123")).toBe("GEN");
  });
  it("matches the documented SKU pattern", () => {
    expect(SKU_PATTERN.test("GAD-EB-SON-BLK-0007")).toBe(true);
    expect(SKU_PATTERN.test("GAD-CAB-VOL-STD-12345")).toBe(true);
    expect(SKU_PATTERN.test("GAD-EB-SON-BLK-7")).toBe(false);
    expect(SKU_PATTERN.test("GAD-EB-SONIX-BLK-0007")).toBe(false);
    expect(SKU_PATTERN.test("eb-0001")).toBe(false);
  });
  it("knows the device codes and spec labels", () => {
    expect(COMPATIBLE.every(isCompatible)).toBe(true);
    expect(isCompatible("fridge")).toBe(false);
    expect(specLabel("battery", "bn")).toBe("ব্যাটারি");
    expect(specLabel("Custom thing")).toBe("Custom thing");
  });
});

describe("invoice numbering", () => {
  it("formats INV-GAD-YYYYMMDD-####", () => {
    expect(formatInvoiceNo("20261001", 7)).toBe("INV-GAD-20261001-0007");
    expect(INVOICE_PATTERN.test("INV-GAD-20261001-0007")).toBe(true);
    expect(INVOICE_PATTERN.test("INV-GAD-2026101-0007")).toBe(false);
  });
  it("uses the Bangladesh calendar day (UTC+6)", () => {
    expect(bdDateStamp(new Date("2026-09-26T17:59:00Z"))).toBe("20260926");
    expect(bdDateStamp(new Date("2026-09-26T18:01:00Z"))).toBe("20260927");
  });
});

describe("warranty end date", () => {
  it("adds whole months from the delivery day", () => {
    expect(warrantyUntil("2026-10-02", 12)).toBe("2027-10-02");
    expect(warrantyUntil("2026-10-02T10:00:00Z", 6)).toBe("2027-04-02");
  });
  it("clamps to the end of a shorter month", () => {
    expect(warrantyUntil("2026-01-31", 1)).toBe("2026-02-28");
    expect(warrantyUntil("2027-12-31", 2)).toBe("2028-02-29");
  });
  it("returns null when there is no warranty or no delivery date", () => {
    expect(warrantyUntil("2026-10-02", 0)).toBeNull();
    expect(warrantyUntil("", 12)).toBeNull();
  });
});
