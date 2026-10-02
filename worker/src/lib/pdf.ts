/**
 * A tiny, dependency-free PDF writer for invoices (A4, Helvetica / Helvetica-Bold, WinAnsi text).
 * Built-in PDF fonts cannot draw Bangla script, so the PDF invoice is printed in English; the on-screen
 * order page and the printable HTML invoice in the admin are bilingual.
 */
import { BRAND } from "../brand";
const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

export type Rgb = [number, number, number];
export interface TextOpts {
  size?: number;
  bold?: boolean;
  color?: Rgb;
  align?: "left" | "right" | "center";
}

/** Keeps printable ASCII; common typographic characters are mapped, the Taka sign becomes "Tk". */
export function pdfSafe(s: string): string {
  return s
    .replace(/৳/g, "Tk ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/×/g, "x")
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "");
}

export function textWidth(s: string, size: number, bold = false): number {
  const table = bold ? W_BOLD : W_REG;
  let w = 0;
  for (const ch of pdfSafe(s)) w += table[ch.charCodeAt(0) - 32] ?? 556;
  return (w * size) / 1000;
}

const esc = (s: string) => pdfSafe(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const n = (v: number) => (Math.round(v * 100) / 100).toString();
const rgb = (c: Rgb) => c.map((x) => n(x / 255)).join(" ");

export class PdfDoc {
  readonly width = 595.28;
  readonly height = 841.89;
  private pages: string[][] = [[]];

  private get ops(): string[] {
    return this.pages[this.pages.length - 1]!;
  }

  addPage(): void {
    this.pages.push([]);
  }

  /** y is measured from the top of the page (like HTML). */
  text(x: number, y: number, s: string, o: TextOpts = {}): void {
    const size = o.size ?? 10;
    const w = textWidth(s, size, o.bold);
    const px = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
    this.ops.push(`BT ${rgb(o.color ?? [40, 36, 58])} rg /${o.bold ? "F2" : "F1"} ${n(size)} Tf ${n(px)} ${n(this.height - y)} Td (${esc(s)}) Tj ET`);
  }

  /** Word-wraps text into lines that fit maxWidth; returns the y after the last line. */
  paragraph(x: number, y: number, s: string, maxWidth: number, o: TextOpts & { lineHeight?: number } = {}): number {
    const size = o.size ?? 10;
    const lh = o.lineHeight ?? size * 1.35;
    let line = "";
    for (const word of pdfSafe(s).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, size, o.bold) > maxWidth && line) {
        this.text(x, y, line, o);
        y += lh;
        line = word;
      } else line = next;
    }
    if (line) {
      this.text(x, y, line, o);
      y += lh;
    }
    return y;
  }

  rect(x: number, y: number, w: number, h: number, fill: Rgb): void {
    this.ops.push(`${rgb(fill)} rg ${n(x)} ${n(this.height - y - h)} ${n(w)} ${n(h)} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Rgb = [220, 214, 232], width = 0.8): void {
    this.ops.push(`${rgb(color)} RG ${n(width)} w ${n(x1)} ${n(this.height - y1)} m ${n(x2)} ${n(this.height - y2)} l S`);
  }

  toBytes(title = "Invoice"): Uint8Array {
    const objs: string[] = [];
    const pageCount = this.pages.length;
    // 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, then page/content pairs.
    const kids = this.pages.map((_, i) => `${6 + i * 2} 0 R`).join(" ");
    objs.push("<< /Type /Catalog /Pages 2 0 R >>");
    objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
    objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    objs.push(`<< /Title (${esc(title)}) /Producer (${esc(BRAND.name.en)}) >>`);
    this.pages.forEach((ops, i) => {
      const content = ops.join("\n");
      objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(this.width)} ${n(this.height)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${7 + i * 2} 0 R >>`);
      objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });
    let out = "%PDF-1.4\n";
    const offsets: number[] = [];
    objs.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new TextEncoder().encode(out); // pure ASCII, so byte offsets equal string offsets
  }
}
