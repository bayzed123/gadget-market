// Marketing & analytics: Meta Pixel + Conversions API (same event_id on both, so Meta deduplicates),
// GA4 e-commerce events, the Google Ads conversion tag, Microsoft Clarity and Cloudflare Web Analytics.
// Nothing loads unless its ID is set in Admin → Settings → Tracking.
import { api, config, cookie } from "./core.js";

let integ = {};
let started = false;
const loadScript = (src, attrs = {}) => {
  const s = document.createElement("script");
  s.src = src;
  s.async = true;
  Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
  document.head.append(s);
};

export const newEventId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function initTracking() {
  if (started) return;
  started = true;
  try {
    integ = (await config()).integrations ?? {};
  } catch {
    return;
  }
  if (integ.metaPixelId) {
    // Standard Meta Pixel bootstrap (without an inline <script>, so the CSP stays strict).
    const f = window;
    if (!f.fbq) {
      const n = (f.fbq = function (...args) { n.callMethod ? n.callMethod(...args) : n.queue.push(args); });
      f._fbq = n; n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      loadScript("https://connect.facebook.net/en_US/fbevents.js");
    }
    window.fbq("init", integ.metaPixelId);
  }
  if (integ.ga4Id || integ.googleAdsId) {
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(integ.ga4Id || integ.googleAdsId)}`);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    if (integ.ga4Id) window.gtag("config", integ.ga4Id, { send_page_view: false });
    if (integ.googleAdsId) window.gtag("config", integ.googleAdsId);
  }
  if (integ.clarityId) {
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    loadScript(`https://www.clarity.ms/tag/${encodeURIComponent(integ.clarityId)}`);
  }
  if (integ.cfBeacon) loadScript("https://static.cloudflareinsights.com/beacon.min.js", { "data-cf-beacon": JSON.stringify({ token: integ.cfBeacon }) });
}

const GA4_NAMES = { ViewContent: "view_item", AddToCart: "add_to_cart", InitiateCheckout: "begin_checkout", Purchase: "purchase", Lead: "generate_lead" };

/**
 * Fires one event everywhere. `items` = [{ sku, name, price, quantity }]. For browser-only events the Worker
 * relays the same event (same id) to the Conversions API; Purchase and Lead are sent by the Worker itself.
 */
export function track(name, { value, items = [], eventId = newEventId(name.toLowerCase()), relay = true, transactionId } = {}) {
  const contentIds = items.map((i) => i.sku);
  const numItems = items.reduce((s, i) => s + (i.quantity ?? 1), 0);
  if (window.fbq) {
    const custom = value != null ? { value, currency: "BDT", content_ids: contentIds, content_type: "product", num_items: numItems } : {};
    window.fbq("track", name, custom, { eventID: eventId });
  }
  if (window.gtag && integ.ga4Id) {
    if (name === "PageView") window.gtag("event", "page_view", { page_location: location.href, page_title: document.title });
    else if (GA4_NAMES[name]) {
      window.gtag("event", GA4_NAMES[name], {
        currency: "BDT",
        value,
        transaction_id: transactionId,
        items: items.map((i) => ({ item_id: i.sku, item_name: i.name, price: i.price, quantity: i.quantity ?? 1 })),
      });
    }
  }
  if (name === "Purchase" && window.gtag && integ.googleAdsId && integ.googleAdsLabel) {
    window.gtag("event", "conversion", { send_to: `${integ.googleAdsId}/${integ.googleAdsLabel}`, value, currency: "BDT", transaction_id: transactionId });
  }
  if (relay && ["PageView", "ViewContent", "AddToCart", "InitiateCheckout"].includes(name) && integ.metaPixelId) {
    api("/events", { method: "POST", body: { name, eventId, url: location.href, value, contentIds, numItems, fbp: cookie("_fbp"), fbc: cookie("_fbc") } }).catch(() => {});
  }
  return eventId;
}

export const pageView = () => track("PageView");
