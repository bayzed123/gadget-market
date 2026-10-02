/**
 * Gadget Market — one Cloudflare Worker.
 * The storefront (/) and admin (/admin/) are static assets (dist/). This Worker handles /api/*, /media/*,
 * sitemap/robots/feeds, SEO-rendered product & category pages, the WhatsApp entry point and the cron jobs.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv, Env } from "./env";
import { ApiError } from "./lib/http";
import { csrf, language, perm, requireAdmin, securityHeaders } from "./middleware";
import publicRoutes from "./routes/public";
import checkoutRoutes from "./routes/checkout";
import customerRoutes from "./routes/customer";
import callbackRoutes from "./routes/callbacks";
import seoRoutes from "./routes/seo";
import adminAuth from "./routes/admin/auth";
import adminOrders from "./routes/admin/orders";
import adminProducts from "./routes/admin/products";
import adminInsights from "./routes/admin/insights";
import adminSystem from "./routes/admin/system";
import adminOps from "./routes/admin/ops";
import adminService from "./routes/admin/service";
import { crudRouter, RESOURCES } from "./routes/admin/crud";
import { runBackup, runFrequentJobs } from "./jobs";
import { audit } from "./lib/store";

const app = new Hono<AppEnv>();

app.use("*", securityHeaders);
app.use("/api/*", language, csrf);

app.get("/api/health", (c) => c.json({ ok: true, env: c.env.ENVIRONMENT, time: new Date().toISOString() }));

app.route("/api", publicRoutes);
app.route("/api", checkoutRoutes);
app.route("/api", customerRoutes);
app.route("/api", callbackRoutes);

// ---- Admin API (every route below requires a signed-in staff member; each checks its own permission) ----
app.route("/api/admin/auth", adminAuth);
const admin = new Hono<AppEnv>();
admin.use("*", requireAdmin);
admin.route("/orders", adminOrders);
admin.route("/products", adminProducts);
admin.route("/", adminInsights);
admin.route("/", adminSystem);
admin.route("/", adminOps);
admin.route("/", adminService);
for (const [key, res] of Object.entries(RESOURCES)) admin.route(`/${key}`, crudRouter(key, res));
admin.post("/jobs/run", perm("settings.manage"), async (c) => {
  const result = await runFrequentJobs(c.env);
  await audit(c, "run_jobs", "system", null, result);
  return c.json({ result, en: "Background jobs ran.", bn: "ব্যাকগ্রাউন্ড কাজগুলো চালানো হয়েছে।" });
});
admin.post("/backup", perm("settings.manage"), async (c) => {
  const key = await runBackup(c.env);
  await audit(c, "backup", "system", key);
  return c.json(key ? { key, en: "Backup saved to storage.", bn: "ব্যাকআপ সংরক্ষণ হয়েছে।" } : { key: null, en: "R2 storage isn't enabled, so backups rely on D1 Time Travel.", bn: "R2 চালু নেই, তাই D1 Time Travel ব্যাকআপ ব্যবহার হচ্ছে।" });
});
app.route("/api/admin", admin);

app.route("/", seoRoutes);

app.notFound((c) => (c.req.path.startsWith("/api/") ? c.json({ code: "not_found", en: "Not found.", bn: "পাওয়া যায়নি।" }, 404) : c.env.ASSETS.fetch(c.req.raw)));

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ code: err.code, en: err.en, bn: err.bn, fields: err.fields }, err.status as 400);
  if (err instanceof HTTPException) return err.getResponse();
  console.error("Unhandled error", c.req.method, c.req.path, err);
  return c.json({ code: "server_error", en: "Something went wrong on our side. Please try again.", bn: "আমাদের দিকে একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।" }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (event.cron === "0 21 * * *") ctx.waitUntil(runBackup(env).then((k) => console.log("backup", k)));
    else ctx.waitUntil(runFrequentJobs(env).then((r) => console.log("jobs", JSON.stringify(r))));
  },
} satisfies ExportedHandler<Env>;

export { app };
