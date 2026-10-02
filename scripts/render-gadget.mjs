#!/usr/bin/env node
/**
 * Renders the product photos (physically based 3D studio renders: anodised aluminium, glossy and soft-touch plastic,
 * silicone, tempered glass, woven speaker fabric, braided cables, lit screens and LEDs on a dark graphite sweep with cool
 * rim light) into public/img/products/*.webp. The images are committed; re-run only when a scene or camera changes.
 * Replace them with photos of your real stock whenever you can (Admin → Products).
 *
 *   node scripts/render-gadget.mjs                            # all
 *   node scripts/render-gadget.mjs sonix-buds-pro             # one (file name or scene name)
 *   OUT_DIR=/tmp/x SIZE=600 node scripts/render-gadget.mjs    # previews somewhere else, smaller
 *
 * Needs Playwright's Chromium (PW_CHROMIUM_PATH to use a preinstalled one) and the three.js dev dependency.
 * Logo fonts (Jost — SIL Open Font License) are in scripts/render-gadget/fonts.
 */
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { SHOTS } from "./render-gadget/shots.mjs";

const ROOT = process.cwd();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = path.startsWith("/node_modules/") ? join(ROOT, path) : join(ROOT, "scripts/render-gadget", path === "/" ? "index.html" : path);
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const only = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
page.setDefaultTimeout(600000);
for (const shot of SHOTS.filter((s) => !only.length || only.includes(s.file) || only.includes(s.scene))) {
  const t = Date.now();
  const view = { ...shot.view, ...(process.env.SIZE ? { size: Number(process.env.SIZE) } : {}) };
  const url = await page.evaluate(({ scene, view }) => window.renderScene(scene, view), { ...shot, view });
  const dir = process.env.OUT_DIR || join(ROOT, "public/img/products");
  const out = join(dir, `${shot.file}.webp`);
  await writeFile(out, Buffer.from(url.split(",")[1], "base64"));
  console.log(`✔ ${out.replace(ROOT + "/", "")} (${Math.round((Date.now() - t) / 100) / 10}s)`);
}
await browser.close();
server.close();
