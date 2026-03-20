const CACHE_NAME = "fracture-the-flag-v3";
const PRECACHE_ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "data/flag-codes.json",
  "assets/icons/icon.svg",
  "assets/icons/icon-maskable.svg"
];

const isSameOrigin = (request) => new URL(request.url).origin === self.location.origin;

const isAppShellRequest = (request) => {
  if (!isSameOrigin(request)) {
    return false;
  }

  const url = new URL(request.url);
  const path = url.pathname;

  return (
    request.mode === "navigate" ||
    path.endsWith("/") ||
    path.endsWith("/index.html") ||
    path.endsWith("/app.js") ||
    path.endsWith("/styles.css") ||
    path.endsWith("/manifest.webmanifest") ||
    path.endsWith("/data/flag-codes.json")
  );
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !isSameOrigin(event.request)) {
    return;
  }

  if (isAppShellRequest(event.request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
          const networkResponse = await fetch(event.request, { cache: "no-store" });

          if (networkResponse.ok) {
            await cache.put(event.request, networkResponse.clone());
          }

          return networkResponse;
        } catch (error) {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }

          throw error;
        }
      })()
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(async (cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      const networkResponse = await fetch(event.request);

      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, networkResponse.clone());
      }

      return networkResponse;
    })
  );
});
