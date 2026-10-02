#!/usr/bin/env node
/**
 * Generates the brand logo (the brand initial on a microchip — a rounded square with pins — in an electric-cyan
 * gradient on graphite), the favicon, PWA icons and the social-share cover into public/img and admin/. Product photos
 * come from scripts/render-gadget.mjs (or real photos uploaded in the admin). PNG renders use the pre-installed Chromium
 * through Playwright when available.
 *
 * Usage: node scripts/make-art.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import brand from "../worker/src/brand.json" with { type: "json" };

const C = brand.colors;
const initial = brand.name.en.trim()[0]?.toUpperCase() ?? "G";
const gold = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#67E8F9"/><stop offset=".5" stop-color="${C.primary}"/><stop offset="1" stop-color="#3B82F6"/></linearGradient>`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Logo: the brand initial on a chip with pins on all four sides. */
export function logoSvg(size = 512) {
  const pins = [];
  for (const i of [0, 1, 2, 3]) {
    const o = 176 + i * 54;
    pins.push(`<rect x="${o - 9}" y="58" width="18" height="52" rx="4"/>`, `<rect x="${o - 9}" y="402" width="18" height="52" rx="4"/>`, `<rect x="58" y="${o - 9}" width="52" height="18" rx="4"/>`, `<rect x="402" y="${o - 9}" width="52" height="18" rx="4"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}"><defs>${gold}</defs>
<rect width="512" height="512" rx="96" fill="${C.theme}"/>
<g fill="url(#g)">${pins.join("")}</g>
<rect x="104" y="104" width="304" height="304" rx="40" fill="#121722" stroke="url(#g)" stroke-width="12"/>
<rect x="128" y="128" width="256" height="256" rx="26" fill="none" stroke="${C.primary}" stroke-width="2" opacity=".35"/>
<circle cx="150" cy="150" r="9" fill="${C.primary}" opacity=".8"/>
<text x="256" y="338" text-anchor="middle" font-family="'Space Grotesk','Inter',Arial,sans-serif" font-size="230" font-weight="700" fill="url(#g)">${esc(initial)}</text>
</svg>`;
}

/** Long names wrap onto two lines (at " & " or the middle space) so they never run into the photo. */
function nameLines() {
  const n = brand.name.en;
  if (n.length <= 16) return [n];
  const amp = n.indexOf(" & ");
  if (amp > 0) return [n.slice(0, amp), n.slice(amp + 1)];
  const mid = n.lastIndexOf(" ", Math.ceil(n.length / 2));
  return mid > 0 ? [n.slice(0, mid), n.slice(mid + 1)] : [n];
}

function ogCover() {
  let photo = "";
  try {
    photo = `data:image/webp;base64,${readFileSync("public/img/products/sonix-buds-pro-open.webp").toString("base64")}`;
  } catch { /* renders not generated yet */ }
  const grid = Array.from({ length: 40 }, (_, i) => `<path d="M${i * 32} 0V630M0 ${i * 32}H1200" stroke="${C.primary}" stroke-opacity=".05"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 630" width="1200" height="630"><defs>${gold}<radialGradient id="r" cx=".85" cy=".2" r=".9"><stop offset="0" stop-color="#16324A"/><stop offset="1" stop-color="${C.theme}"/></radialGradient></defs>
<rect width="1200" height="630" fill="url(#r)"/>${grid}
<rect x="18" y="18" width="1164" height="594" rx="10" fill="none" stroke="url(#g)" stroke-width="2" opacity=".55"/>
${photo ? `<clipPath id="c"><rect x="700" y="70" width="450" height="490" rx="10"/></clipPath><image href="${photo}" x="680" y="70" width="490" height="490" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice"/><rect x="700" y="70" width="450" height="490" rx="10" fill="none" stroke="url(#g)" stroke-width="2" opacity=".6"/>` : ""}
<g transform="translate(70 70) scale(.24)">${logoSvg().replace(/<\/?svg[^>]*>/g, "").replace(/<defs>[\s\S]*?<\/defs>/, "")}</g>
${nameLines().map((l, i, a) => `<text x="70" y="${(a.length > 1 ? 270 : 320) + i * 70}" font-family="'Space Grotesk',Arial,sans-serif" font-size="72" font-weight="700" fill="url(#g)">${esc(l)}</text>`).join("")}
<text x="72" y="400" font-family="'Space Grotesk',Arial,sans-serif" font-size="36" font-weight="500" fill="${C.ink}" opacity=".92">${esc(brand.tagline.en)}</text>
<text x="72" y="466" font-family="'JetBrains Mono',monospace" font-size="21" font-weight="600" fill="${C.primary}" letter-spacing="2">AUDIO · POWER · WEARABLES · GAMING</text>
<text x="72" y="512" font-family="'Inter',Arial,sans-serif" font-size="24" fill="${C.ink}" opacity=".75">Full spec sheets · real warranty · Cash on Delivery</text>
</svg>`;
}

writeFileSync("public/img/logo.svg", logoSvg());
writeFileSync("public/img/og-cover.svg", ogCover().replace(/<image [^>]*\/>/, "")); // the SVG copy stays small
writeFileSync("admin/icon.svg", logoSvg());
console.log("✔ logo, admin icon, og cover");

// PNG renders (PWA icons, social cover) with the pre-installed Chromium.
try {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  const shot = async (svg, w, h, out) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(
      `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;700&family=JetBrains+Mono:wght@600&display=block"></head><body style="margin:0;background:${C.theme}">${svg.replace(/<svg /, `<svg width="${w}" height="${h}" `)}</body></html>`,
      { waitUntil: "networkidle" },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: out });
  };
  await shot(logoSvg(), 192, 192, "public/img/icon-192.png");
  await shot(logoSvg(), 512, 512, "public/img/icon-512.png");
  await shot(ogCover(), 1200, 630, "public/img/og-cover.png");
  // favicon.ico with one embedded 48×48 PNG (supported by every current browser).
  await shot(logoSvg(), 48, 48, "public/favicon.png");
  const png = readFileSync("public/favicon.png");
  const ico = Buffer.alloc(22);
  ico.writeUInt16LE(1, 2); // type: icon
  ico.writeUInt16LE(1, 4); // one image
  ico.writeUInt8(48, 6); ico.writeUInt8(48, 7); // width, height
  ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); // planes, bits per pixel
  ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18); // size, offset
  writeFileSync("public/favicon.ico", Buffer.concat([ico, png]));
  (await import("node:fs")).unlinkSync("public/favicon.png");
  await browser.close();
  console.log("✔ PNG icons and og-cover.png rendered");
} catch (e) {
  console.warn("⚠ PNG render skipped:", String(e).split("\n")[0]);
}
