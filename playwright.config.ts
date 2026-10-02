import { defineConfig, devices } from "@playwright/test";

// E2E: builds, prepares a fresh local D1 (migrations + seed + a test admin) and runs `wrangler dev`.
const PORT = 8788;
const persist = ".wrangler/e2e";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    // Smooth scrolling and hover sheens are switched off for reduced motion, which keeps clicks stable.
    reducedMotion: "reduce",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    // A mid-range Android phone is the primary target device.
    { name: "mobile", use: { ...devices["Pixel 5"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: [
      `rm -rf ${persist}`,
      "node scripts/build.mjs",
      `npx wrangler d1 migrations apply DB --local -c worker/wrangler.toml --persist-to ${persist}`,
      `npx wrangler d1 execute DB --local -c worker/wrangler.toml --persist-to ${persist} --file=dist-seed/seed.sql`,
      `node scripts/create-admin.mjs "E2E Processor" e2e order_processor 01899999999 > ${persist}-admin.sql`,
      `npx wrangler d1 execute DB --local -c worker/wrangler.toml --persist-to ${persist} --file=${persist}-admin.sql`,
      `npx wrangler dev -c worker/wrangler.toml --port ${PORT} --ip 127.0.0.1 --persist-to ${persist} --var ENVIRONMENT:development --var PUBLIC_URL:`,
    ].join(" && "),
    url: `http://127.0.0.1:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
