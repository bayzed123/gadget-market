// End-to-end: a shopper uses the gadget finder (device → budget), opens a suggested product (spec sheet, "works with",
// warranty badge with the warranty terms next to it), adds it to the cart and checks out from Dhaka City with Cash on
// Delivery and a gift box, verifying their phone by SMS code (development mode shows the code). Then staff confirm the
// order. Also: abandoned-checkout capture, a combo's contents and real saving, the spec comparison and a buying guide.
import { expect, test } from "@playwright/test";

const TERMS = "Warranty covers manufacturing defects";

test("gadget finder → product with spec sheet and warranty → guest COD checkout with phone verification, then staff confirm", async ({ page, request }) => {
  const phone = `017${String(Date.now()).slice(-8)}`;
  await page.goto("/?lang=en");
  await page.locator('a[href="/finder?device=iphone"]').first().click();
  await expect(page).toHaveURL(/finder\?device=iphone/);
  // The device came with the link, so the finder starts at the budget question.
  await expect(page.getByRole("heading", { name: "Your budget" })).toBeVisible();
  await page.getByText("≤ ৳3,000", { exact: true }).click();
  await page.getByRole("button", { name: "Show my setup" }).click();
  await expect(page.getByRole("heading", { name: "Your setup" })).toBeVisible();
  await expect(page.locator(".kit-steps > li")).toHaveCount(4);
  await page.getByRole("link", { name: "Sonix Buds Lite Earbuds" }).first().click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sonix Buds Lite Earbuds");
  await expect(page.locator(".compat")).toContainText("iPhone");
  await expect(page.locator(".warranty-row")).toContainText("6-month warranty");
  await expect(page.locator(".spec-section")).toContainText("Bluetooth");
  await expect(page.locator(".spec-section")).toContainText("5.3, SBC");
  await expect(page.locator(".disclaimer").first()).toContainText(TERMS);
  await expect(page.locator(".cert-badge")).toHaveCount(0); // no documents on file in the seed data
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/checkout");

  await page.getByLabel("Full name *").fill("E2E Shopper");
  await page.getByLabel("Mobile number *").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  const devToast = page.locator(".toast", { hasText: "DEV code:" });
  await expect(devToast).toBeVisible();
  const code = (await devToast.textContent())!.match(/(\d{6})/)![1]!;
  await page.getByPlaceholder("6-digit code").fill(code);
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByText("Verified ✓")).toBeVisible();

  await page.getByLabel("Division *").selectOption({ label: "Dhaka" });
  await page.getByLabel("District *").selectOption({ label: "Dhaka" });
  await page.getByLabel("Upazila / Thana *").selectOption({ label: "Mirpur" });
  await page.getByLabel("House, road, area *").fill("House 12, Road 3, Section 10");
  await expect(page.locator("#totals")).toContainText("Dhaka City");
  await expect(page.locator("#totals")).toContainText("৳70");
  await page.getByRole("checkbox", { name: /Gift-box it/ }).check();
  await expect(page.locator("#totals")).toContainText("Gift box");
  await expect(page.locator("#totals")).toContainText("৳1,320"); // 1,190 + 70 delivery + 60 gift box

  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("heading", { name: /We've got your order/ })).toBeVisible();
  const orderNo = (await page.locator(".order-no").textContent())!.trim();
  expect(orderNo).toMatch(/^GMK-\d{6}-[A-Z0-9]{4}$/);

  // Staff (order processor) signs in with phone + SMS code and confirms the verified order.
  const otp = await request.post("/api/admin/auth/otp/request", { data: { phone: "01899999999" }, headers: { "x-requested-with": "fetch" } });
  const devCode = (await otp.json()).devCode;
  const login = await request.post("/api/admin/auth/otp/verify", { data: { phone: "01899999999", code: devCode }, headers: { "x-requested-with": "fetch" } });
  expect(login.ok()).toBe(true);
  const list = await (await request.get(`/api/admin/orders?q=${orderNo}`)).json();
  expect(list.items[0].otp_verified).toBe(1);
  const confirm = await request.post(`/api/admin/orders/${list.items[0].id}/status`, { data: { status: "confirmed" }, headers: { "x-requested-with": "fetch" } });
  const body = await confirm.json();
  expect(body.order.invoice_no).toMatch(/^INV-GAD-\d{8}-\d{4}$/);

  // The customer's order page now offers the invoice PDF.
  await page.reload();
  await expect(page.getByRole("link", { name: /Download invoice/ })).toBeVisible();
});

test("an abandoned checkout is captured when the shopper leaves", async ({ page, request }) => {
  const phone = `018${String(Date.now()).slice(-8)}`;
  await page.goto("/product/voltra-20w-usb-c-charger?lang=en");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/checkout");
  await page.getByLabel("Full name *").fill("Left Early");
  await page.getByLabel("Mobile number *").fill(phone);
  await page.getByLabel("Full name *").focus(); // blur the phone field → autosave
  await expect.poll(async () => {
    const r = await request.get(`/api/checkout/resume/${await page.evaluate(() => JSON.parse(localStorage.getItem("gmk_sid") ?? '""'))}`);
    return r.ok() ? (await r.json()).customer.phone : null;
  }).toBe(phone);
});

test("a combo lists what's inside with the real saving; the comparison and a buying guide render", async ({ page, request }) => {
  await page.goto("/product/iphone-charging-combo?lang=en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("iPhone Charging Combo: 20W Charger + Lightning Cable + Glass");
  const box = page.locator(".kit-box");
  await expect(box).toContainText("Voltra 20W USB-C PD Charger");
  await expect(box).toContainText("Shieldr 9H Tempered Glass");
  await expect(box).toContainText("You save ৳280 with the combo"); // 990 + 690 + 490 − 1,890

  const items = (await (await request.get("/api/products?q=sonix%20buds&limit=10")).json()).items;
  const ids = items.map((p: { id: number }) => p.id).slice(0, 2).join(",");
  await page.goto(`/compare?ids=${ids}&lang=en`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Spec comparison");
  await expect(page.locator(".compare-table")).toContainText("Charging time");
  await page.getByLabel("Only show differences").check();
  await expect(page.locator(".compare-table")).not.toContainText("Charging time");

  await page.goto("/guides?lang=en");
  await page.getByRole("link", { name: /water resistance ratings/ }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("IPX4, IPX7, IP68");
  await expect(page.locator(".article")).toContainText("IPX4");
});
