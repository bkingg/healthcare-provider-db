/* Nomad service worker: phone alerts only (no offline caching).
 * The alert text is generic — the details are in the app. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Nomad";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      icon: "/brand/icon-192.png",
      badge: "/brand/nomad-mark-white.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (w.url === url && "focus" in w) return w.focus();
      }
      for (const w of windows) {
        if ("navigate" in w && "focus" in w) {
          await w.focus();
          return w.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
