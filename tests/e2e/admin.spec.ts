// End-to-end (admin UI): a staff member signs in with phone + SMS code, finds a new order under
// "Needs a call" and logs the confirmation call with one tap — the order is confirmed and the invoice number appears.
import { expect, test, type APIRequestContext } from "@playwright/test";

const H = { "x-requested-with": "fetch" };

async function placeVerifiedOrder(request: APIRequestContext): Promise<string> {
  const phone = `019${String(Date.now()).slice(-8)}`;
  const sent = await (await request.post("/api/otp/send", { data: { phone }, headers: H })).json();
  const verified = await (await request.post("/api/otp/verify", { data: { phone, code: sent.devCode }, headers: H })).json();
  const res = await request.post("/api/orders", {
    headers: H,
    data: {
      customer: { name: "Admin E2E Customer", phone, email: "" },
      address: { division_id: 6, district_id: 47, upazila_id: 9026, division: "Dhaka", district: "Dhaka", upazila: "Mirpur", area: "House 7, Road 9, Section 2" },
      items: [{ variantId: 3, quantity: 1 }],
      paymentMethod: "COD",
      lang: "en",
      sessionId: `sess-admin-e2e-${Date.now()}`,
      otpToken: verified.otpToken,
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).orderNo;
}

test("staff log a confirmation call and confirm the order from the admin panel", async ({ page, request }) => {
  const orderNo = await placeVerifiedOrder(request);

  await page.goto("/admin/");
  await page.evaluate(() => localStorage.setItem("gmk_admin_lang", "en"));
  await page.reload();
  await page.getByRole("button", { name: "Sign in with phone (staff)" }).click();
  await page.getByLabel("Phone").fill("01899999999");
  await page.getByRole("button", { name: "Send code" }).click();
  const devToast = page.locator(".toast", { hasText: "DEV code:" });
  await expect(devToast).toBeVisible();
  const code = (await devToast.textContent())!.match(/(\d{6})/)![1]!;
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Needs your attention today" })).toBeVisible();

  await page.goto(`/admin/#/orders?status=needs_call&q=${orderNo}`);
  await page.locator("#oq").fill(orderNo);
  await page.locator("tr[data-open]", { hasText: orderNo }).first().click();
  const panel = page.getByRole("dialog");
  await expect(panel).toContainText("Number verified by SMS");
  await expect(panel.locator(".risk")).toBeVisible();
  await expect(panel.getByRole("link", { name: /Call/ })).toHaveAttribute("href", /^tel:019/);

  page.once("dialog", (d) => d.accept("Address double-checked")); // optional note prompt
  await panel.getByRole("button", { name: /Customer confirmed/ }).click();
  await expect(page.locator(".toast", { hasText: "Logged: customer confirmed." })).toBeVisible();

  // Logging "Customer confirmed" confirms the order: the invoice number is issued and "Packed" is next.
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { level: 2 })).toContainText(/INV-GAD-\d{8}-\d{4}/);
  await expect(dialog.getByRole("link", { name: "Invoice PDF" })).toHaveAttribute("href", /\/invoice\.pdf$/);
  await expect(dialog.getByRole("button", { name: "→ Packed" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Customer confirmed/ })).toHaveCount(0);
});
