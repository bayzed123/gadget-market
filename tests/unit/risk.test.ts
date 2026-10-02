import { describe, expect, it } from "vitest";
import { computeRisk, confirmGate, dispatchGate, normalizeCourierResponse } from "../../worker/src/lib/risk";
import { canTransition, restoresStock } from "../../worker/src/lib/orders";

const h = (delivered: number, refusedOrReturned = 0, totalOrders = delivered + refusedOrReturned) => ({ totalOrders, delivered, refusedOrReturned, cancelled: 0 });

describe("risk scoring (plain-language badges)", () => {
  it("marks first-time customers as New (medium)", () => {
    expect(computeRisk(h(0, 0, 0)).level).toBe("medium");
  });
  it("trusts 3+ delivered orders with no refusals", () => {
    expect(computeRisk(h(3)).level).toBe("low");
    expect(computeRisk(h(2)).level).toBe("medium");
  });
  it("flags repeated refusals/returns and poor courier history", () => {
    expect(computeRisk(h(5, 2)).level).toBe("high");
    expect(computeRisk(h(1, 1)).level).toBe("high");
    expect(computeRisk(h(0, 0, 0), { total: 10, delivered: 4, returned: 6, source: "x" }).level).toBe("high");
    expect(computeRisk({ ...h(10), blocked: true }).level).toBe("high");
  });
  it("gives a one-line reason in both languages", () => {
    const r = computeRisk(h(4));
    expect(r.reason.en).toMatch(/4 orders delivered/);
    expect(r.reason.bn).toMatch(/ডেলিভারি/);
  });
});

describe("confirmation & dispatch gates", () => {
  const cod = { payment_status: "pending", otp_verified: 0, risk_level: "medium" as const };
  it("blocks confirming an unverified COD order without a logged call", () => {
    expect(confirmGate(cod, []).ok).toBe(false);
    expect(confirmGate(cod, [{ outcome: "no_answer" }]).ok).toBe(false);
  });
  it("allows confirmation after OTP, a confirmed call, or prepayment", () => {
    expect(confirmGate({ ...cod, otp_verified: 1 }, [])).toEqual({ ok: true, method: "otp" });
    expect(confirmGate(cod, [{ outcome: "confirmed" }])).toEqual({ ok: true, method: "call" });
    expect(confirmGate({ ...cod, payment_status: "paid" }, [])).toEqual({ ok: true, method: "prepaid" });
  });
  it("requires a call before dispatch unless the customer is Trusted and verified", () => {
    expect(dispatchGate({ ...cod, otp_verified: 1 }, []).ok).toBe(false);
    expect(dispatchGate({ ...cod, otp_verified: 1, risk_level: "low" }, [])).toEqual({ ok: true, method: "trusted" });
    expect(dispatchGate(cod, [{ outcome: "confirmed" }]).ok).toBe(true);
  });
});

describe("order outcomes", () => {
  it("keeps Cancelled, Refused and Returned as distinct off-ramps", () => {
    expect(canTransition("confirmed", "cancelled")).toBe(true);
    expect(canTransition("shipped", "cancelled")).toBe(false);
    expect(canTransition("shipped", "refused")).toBe(true);
    expect(canTransition("shipped", "returned")).toBe(false);
    expect(canTransition("delivered", "returned")).toBe(true);
    expect(canTransition("delivered", "refused")).toBe(false);
    // Unopened parcels (cancelled / refused) go back on sale; a returned (opened) unit is inspected first — staff put it back or write it off.
    for (const s of ["cancelled", "refused"] as const) expect(restoresStock(s)).toBe(true);
    expect(restoresStock("returned")).toBe(false);
  });
  it("cannot skip confirmation", () => {
    expect(canTransition("pending", "packed")).toBe(false);
    expect(canTransition("pending", "shipped")).toBe(false);
  });
});

describe("courier fraud-check responses", () => {
  it("normalises common aggregator shapes", () => {
    expect(normalizeCourierResponse({ courierData: { summary: { total_parcel: 12, success_parcel: 10, cancelled_parcel: 2 } } })).toMatchObject({ total: 12, delivered: 10, returned: 2 });
    expect(normalizeCourierResponse({ data: { total: 4, delivered: 1 } })).toMatchObject({ total: 4, delivered: 1, returned: 3 });
    expect(normalizeCourierResponse({ nothing: true })).toBeNull();
  });
});
