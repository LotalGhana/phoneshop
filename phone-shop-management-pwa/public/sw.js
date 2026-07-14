/* PhoneShop GH - Service Worker for offline-capable PWA */
const CACHE_NAME = "phoneshop-gh-v1";
const SHELL = [
  "/index.html",
  "/dashboard.html",
  "/register.html",
  "/forgot-password.html",
  "/reset-password.html",
  "/styles.css",
  "/app.js",
  "/dashboard.js",
  "/manifest.json",
  "/icons/icon-512.png",
  "/images/hero-login.jpg",
  "/images/dashboard-bg.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Always network-first for API calls
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: "offline" }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }
  // Cache-first for static shell
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          // Only cache same-origin successful GETs
          if (
            res &&
            res.status === 200 &&
            event.request.method === "GET" &&
            url.origin === self.location.origin
          ) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => {
          // Fallback to login page shell for navigation
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
    })
  );
});
