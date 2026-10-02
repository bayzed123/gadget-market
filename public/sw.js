// PWA service worker: offline shell + cached catalogue images, and push notifications.
// Pushes arrive empty ("tickle"); the message text is fetched from /api/push/latest so nothing sensitive
// travels through the push service.
const VERSION = "pkh-{{BUILD_ID}}";
const SHELL = ["/", "/css/store.css", "/js/app.js", "/js/core.js", "/js/i18n.js", "/js/ui.js", "/js/track.js", "/img/logo.svg", "/data/bd-geo.json", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) return;
  // Pages: network first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/")));
    return;
  }
  // Static files & images: cache first, refresh in the background.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok && (url.pathname.startsWith("/img/") || url.pathname.startsWith("/media/") || url.pathname.startsWith("/js/") || url.pathname.startsWith("/css/"))) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
      return hit || net;
    }),
  );
});

self.addEventListener("push", (e) => {
  e.waitUntil(
    (async () => {
      const sub = await self.registration.pushManager.getSubscription();
      let msg = { title: "{{BRAND_NAME_EN}}", body: "", url: "/" };
      try {
        const r = await fetch(`/api/push/latest?endpoint=${encodeURIComponent(sub?.endpoint ?? "")}`);
        msg = await r.json();
      } catch { /* show the default */ }
      await self.registration.showNotification(msg.title, { body: msg.body, icon: "/img/icon-192.png", badge: "/img/icon-192.png", data: { url: msg.url } });
    })(),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data?.url || "/"));
});
