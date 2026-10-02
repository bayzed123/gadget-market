#!/usr/bin/env node
/**
 * Prints SQL that creates a staff account (run it with `wrangler d1 execute DB --file=…`).
 *
 *   node scripts/create-admin.mjs "Name" login-id super_admin 'Long-Password-123'   # password sign-in (+2FA for SA/Manager)
 *   node scripts/create-admin.mjs "Name" login-id order_processor 01XXXXXXXXX        # phone + SMS-code sign-in
 */
import { pbkdf2Sync, randomBytes } from "node:crypto";

const [name, login, role = "super_admin", secret] = process.argv.slice(2);
const ROLES = ["super_admin", "manager", "order_processor", "viewer"];
if (!name || !login || !ROLES.includes(role) || !secret) {
  console.error('Usage: node scripts/create-admin.mjs "Name" login-id <role> <password | 01XXXXXXXXX>');
  process.exit(1);
}
const q = (s) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const isPhone = /^01[3-9]\d{8}$/.test(secret);
let hash = null;
if (!isPhone) {
  if (secret.length < 10) { console.error("Password must be at least 10 characters"); process.exit(1); }
  const salt = randomBytes(16);
  hash = `pbkdf2$100000$${salt.toString("base64")}$${pbkdf2Sync(secret, salt, 100000, 32, "sha256").toString("base64")}`;
} else if (!["order_processor", "viewer"].includes(role)) {
  console.error("Phone sign-in is only for order_processor and viewer — give Super Admins and Managers a password.");
  process.exit(1);
}
console.log(`INSERT INTO admins (name, email, phone, password_hash, role) VALUES (${q(name)}, ${q(login.toLowerCase())}, ${q(isPhone ? secret : null)}, ${q(hash)}, ${q(role)});`);
