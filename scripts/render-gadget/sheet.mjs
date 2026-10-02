// Dev helper: contact sheet of rendered previews. node scripts/render-gadget/sheet.mjs <dir> <out.png> [cols]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
const [dir, out, cols = 4] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith(".webp")).sort();
const html = `<body style="margin:0;display:grid;grid-template-columns:repeat(${cols},300px);gap:4px;background:#333;font:12px sans-serif;color:#fff">${files
  .map((f) => `<div><img src="data:image/webp;base64,${readFileSync(join(dir, f)).toString("base64")}" width=300 height=300><div>${f}</div></div>`)
  .join("")}</body>`;
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const p = await b.newPage({ viewport: { width: cols * 304, height: 400 } });
await p.setContent(html);
await p.screenshot({ path: out, fullPage: true });
await b.close();
