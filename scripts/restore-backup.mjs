#!/usr/bin/env node
/**
 * Turns a nightly JSON backup (R2 `backups/YYYY-MM-DD.json`) into SQL that restores those tables into D1.
 *
 *   npx wrangler r2 object get gadget-market-media/backups/2026-09-30.json --remote --file=backup.json -c worker/wrangler.toml
 *   node scripts/restore-backup.mjs backup.json > restore.sql
 *   npx wrangler d1 execute DB --remote -c worker/wrangler.toml --file=restore.sql
 *
 * The SQL empties each backed-up table and re-inserts its rows (tables are processed parent-first, deletes run
 * child-first), so run it on a database that already has the schema (migrations applied). Tables not in the
 * backup (sessions live in KV; notifications, marketing_events and push_subscriptions are logs) are left alone.
 * Prefer D1 Time Travel for "undo the last few hours" — see docs/SECURITY.md.
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/restore-backup.mjs <backup.json> > restore.sql");
  process.exit(1);
}
const backup = JSON.parse(readFileSync(file, "utf8"));
const tables = backup?.tables;
if (!tables || typeof tables !== "object") {
  console.error("✖ Not a shop backup file (missing \"tables\").");
  process.exit(1);
}

const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`Unexpected identifier: ${s}`);
  return s;
};
const lit = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replace(/'/g, "''")}'`;
};

const names = Object.keys(tables).map(ident);
const out = [`-- Restore of ${names.length} tables from a backup made ${backup.createdAt ?? "(unknown time)"}`, "PRAGMA defer_foreign_keys = ON;"];
for (const t of [...names].reverse()) out.push(`DELETE FROM ${t};`);
let rows = 0;
for (const t of names) {
  for (const row of tables[t]) {
    const cols = Object.keys(row).map(ident);
    out.push(`INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map((c) => lit(row[c])).join(", ")});`);
    rows++;
  }
}
out.push("");
process.stdout.write(out.join("\n"));
console.error(`✔ ${rows} rows in ${names.length} tables → SQL written to stdout`);
