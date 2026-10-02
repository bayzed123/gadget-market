/**
 * Customer notifications — SMS (Bangladeshi bulk-SMS gateways), WhatsApp Cloud API, email (Resend) and Web Push.
 * Every attempt is written to the `notifications` table so staff can see what was sent. When a provider isn't
 * configured the message is logged as "skipped" instead of failing the order.
 */
import type { Env } from "../env";
import { getSetting, publicUrl } from "./store";
import { BRAND } from "../brand";
import { pushConfigured, sendPushTickle } from "./push";

export interface NotifyOrder {
  id: number;
  order_no: string;
  public_token: string;
  invoice_no?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  area?: string;
  total: number;
  courier_partner: string | null;
  tracking_id: string | null;
  lang: string;
}

type Vars = Record<string, string | number | null | undefined>;

export function render(tpl: string, vars: Vars): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] == null ? "" : String(vars[k]))).replace(/\s+([.,!?।])/g, "$1").trim();
}

async function log(env: Env, channel: "sms" | "whatsapp" | "email" | "push", recipient: string, template: string, message: string, status: "sent" | "failed" | "skipped", error: string | null, orderId: number | null) {
  await env.DB.prepare("INSERT INTO notifications (channel, recipient, template, message, status, error, order_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(channel, recipient, template, message.slice(0, 1000), status, error, orderId)
    .run();
}

export const smsConfigured = (env: Env) => Boolean(env.SMS_API_KEY);
export const whatsappConfigured = (env: Env) => Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID);
export const emailConfigured = (env: Env) => Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

export async function sendSms(env: Env, phone: string, message: string, template: string, orderId: number | null = null): Promise<boolean> {
  if (!smsConfigured(env)) {
    await log(env, "sms", phone, template, message, "skipped", "SMS_API_KEY not configured", orderId);
    return false;
  }
  try {
    // BulkSMSBD-style gateway (api_key, senderid, number, message). Point SMS_API_URL at another provider if needed.
    const url = env.SMS_API_URL || "https://bulksmsbd.net/api/smsapi";
    const form = new URLSearchParams({ api_key: env.SMS_API_KEY!, type: "text", senderid: env.SMS_SENDER_ID || "", number: phone.replace(/^0/, "880"), message });
    const res = await fetch(url, { method: "POST", body: form, headers: { "content-type": "application/x-www-form-urlencoded" } });
    await log(env, "sms", phone, template, message, res.ok ? "sent" : "failed", res.ok ? null : `HTTP ${res.status}`, orderId);
    return res.ok;
  } catch (e) {
    await log(env, "sms", phone, template, message, "failed", String(e).slice(0, 300), orderId);
    return false;
  }
}

export async function sendWhatsApp(env: Env, phone: string, message: string, template: string, orderId: number | null = null): Promise<boolean> {
  if (!whatsappConfigured(env)) {
    await log(env, "whatsapp", phone, template, message, "skipped", "WhatsApp Cloud API not configured", orderId);
    return false;
  }
  try {
    // Business-initiated messages outside the 24h customer-service window need an approved template in Meta.
    const res = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace(/^0/, "880"), type: "text", text: { body: message } }),
    });
    await log(env, "whatsapp", phone, template, message, res.ok ? "sent" : "failed", res.ok ? null : `HTTP ${res.status}`, orderId);
    return res.ok;
  } catch (e) {
    await log(env, "whatsapp", phone, template, message, "failed", String(e).slice(0, 300), orderId);
    return false;
  }
}

export async function sendEmail(env: Env, to: string, subject: string, text: string, template: string, orderId: number | null = null): Promise<boolean> {
  if (!emailConfigured(env)) {
    await log(env, "email", to, template, text, "skipped", "Email provider not configured", orderId);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
    });
    await log(env, "email", to, template, text, res.ok ? "sent" : "failed", res.ok ? null : `HTTP ${res.status}`, orderId);
    return res.ok;
  } catch (e) {
    await log(env, "email", to, template, text, "failed", String(e).slice(0, 300), orderId);
    return false;
  }
}

/** Queues a push message for every subscription registered to this phone (order updates). */
export async function sendPushToPhone(env: Env, phone: string, msg: { title: string; body: string; url: string }, template: string, orderId: number | null = null): Promise<void> {
  if (!pushConfigured(env)) return;
  const { results } = await env.DB.prepare("SELECT id, endpoint FROM push_subscriptions WHERE phone = ?").bind(phone).all<{ id: number; endpoint: string }>();
  for (const s of results) {
    await env.DB.prepare("UPDATE push_subscriptions SET last_message = ? WHERE id = ?").bind(JSON.stringify(msg), s.id).run();
    try {
      const r = await sendPushTickle(env, s.endpoint);
      if (r === "gone") await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(s.id).run();
      await log(env, "push", phone, template, msg.body, r === "sent" ? "sent" : "failed", r === "sent" ? null : r, orderId);
    } catch (e) {
      await log(env, "push", phone, template, msg.body, "failed", String(e).slice(0, 300), orderId);
    }
  }
}

function storeName(lang: string) {
  return lang === "en" ? BRAND.name.en : BRAND.name.bn;
}

/** Renders a template from Settings → Notification templates in the customer's language. */
export async function renderTemplate(env: Env, key: string, lang: string, vars: Vars): Promise<string | null> {
  const templates = await getSetting(env, "templates");
  const tpl = (templates as Record<string, { en: string; bn: string }>)[key];
  if (!tpl) return null;
  const l = lang === "en" ? "en" : "bn";
  return render(tpl[l] || tpl.en, { store: storeName(l), ...vars });
}

/** Sends a stand-alone message (OTP, recovery, reminders) by SMS, plus WhatsApp when that channel is on. */
export async function sendTemplate(env: Env, phone: string, key: string, lang: string, vars: Vars, orderId: number | null = null, opts: { smsOnly?: boolean } = {}): Promise<boolean> {
  const message = await renderTemplate(env, key, lang, vars);
  if (!message) return false;
  const channels = await getSetting(env, "notifications");
  const jobs: Promise<boolean>[] = [];
  if (channels.sms || opts.smsOnly) jobs.push(sendSms(env, phone, message, key, orderId));
  if (channels.whatsapp && !opts.smsOnly) jobs.push(sendWhatsApp(env, phone, message, key, orderId));
  const results = await Promise.allSettled(jobs);
  return results.some((r) => r.status === "fulfilled" && r.value);
}

/** Sends the order message for a pipeline stage on every enabled channel. */
export async function notifyOrder(env: Env, order: NotifyOrder, key: string): Promise<void> {
  const lang = order.lang === "en" ? "en" : "bn";
  const base = publicUrl(env) || `https://${BRAND.domain}`;
  const link = `${base}/order/${order.order_no}?token=${order.public_token}`;
  const message = await renderTemplate(env, key, lang, {
    name: order.customer_name.split(" ")[0],
    order_no: order.order_no,
    invoice_no: order.invoice_no ?? order.order_no,
    total: order.total,
    courier: order.courier_partner ?? "",
    tracking: order.tracking_id ?? "",
    area: order.area ?? "",
    link,
  });
  if (!message) return;
  const channels = await getSetting(env, "notifications");
  const jobs: Promise<unknown>[] = [];
  if (channels.sms) jobs.push(sendSms(env, order.customer_phone, message, key, order.id));
  if (channels.whatsapp) jobs.push(sendWhatsApp(env, order.customer_phone, message, key, order.id));
  if (channels.push) jobs.push(sendPushToPhone(env, order.customer_phone, { title: storeName(lang), body: message, url: `/order/${order.order_no}?token=${order.public_token}` }, key, order.id));
  if (channels.email && order.customer_email) {
    const subject = lang === "bn" ? `${BRAND.name.bn} — অর্ডার ${order.order_no}` : `${BRAND.name.en} — Order ${order.order_no}`;
    jobs.push(sendEmail(env, order.customer_email, subject, `${message}\n\n${lang === "bn" ? "অর্ডার দেখুন" : "View your order"}: ${link}`, key, order.id));
  }
  await Promise.allSettled(jobs);
}
