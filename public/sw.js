const CACHE_NAME = "bitewise-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.svg", "/icon-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.method !== "GET") {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: { code: "offline_write_disabled", message: "Reconnect to the internet before saving changes." } }), { status: 503, headers: { "Content-Type": "application/json" } })));
    return;
  }
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  })));
});
