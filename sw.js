const CACHE_NAME = "estoque-cache-v1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/db.js",
  "./js/auth.js",
  "./js/utils.js",
  "./js/screens/dashboard.js",
  "./js/screens/products.js",
  "./js/screens/movements.js",
  "./js/screens/reports.js",
  "./js/screens/backup.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js",
  "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.wasm",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(new Request(url, { mode: "cors" })).catch(() => {
            // Falha ao cachear um asset individual não deve quebrar a instalação.
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("", { status: 504 });
        });
    })
  );
});
