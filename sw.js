// sw.js ✅ S77-APP2 - cache con versionado + limpieza automática
// ✅ NO cachea manifest ni íconos (para que no queden pegados viejos)

// ✅ IMPORTANTE: base path para GitHub Pages (repo: s77-app2)
const BASE_PATH = "/s77-app2";

// ✅ Cache version ÚNICA para app2 (para que no choque con el sistema original)
// ⬇️ SUBÍ VERSIÓN para forzar update
const SW_VERSION = "s77-app2-v2026-02-12-02";

// ✅ Cacheamos solo assets que ayudan a cargar rápido (incluye splash)
const CORE_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/bg.jpg`,
  `${BASE_PATH}/bg-casino-square.png`,
  `${BASE_PATH}/bg-casino-green.png`,
  `${BASE_PATH}/btn-neon-cian.png`,
  `${BASE_PATH}/btn-neon-gold.png`,
  `${BASE_PATH}/bg-acierto-blue.png`,
  `${BASE_PATH}/splash.png`,

  // ✅ IMPORTANTE: tu HTML lo usa
  `${BASE_PATH}/success-cav.lottie`,

  `${BASE_PATH}/sw.js`
];

// ❌ Nunca cachear estos (con path correcto para Pages)
const NO_CACHE = new Set([
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icon-192.png`,
  `${BASE_PATH}/icon-512.png`
]);

function isNoCacheRequest(reqUrl){
  try{
    const u = new URL(reqUrl);
    return NO_CACHE.has(u.pathname);
  }catch(e){
    return false;
  }
}

// Instalación: precache mínimo
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SW_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activación: borrar caches viejos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SW_VERSION)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Estrategia:
// - HTML: network-first
// - Assets estáticos: cache-first
// - API onrender: network-only
// - manifest + icons: network-only (para que cambien de verdad)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ❌ No cachear manifest ni icons (siempre red)
  if (isNoCacheRequest(req.url)) {
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  // ❌ No cachear API
  if (url.hostname.includes("onrender.com") && url.pathname.startsWith("/api")) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML navegación
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          const cache = await caches.open(SW_VERSION);
          // ✅ Guardar HTML con path correcto de app2
          cache.put(`${BASE_PATH}/index.html`, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(`${BASE_PATH}/index.html`);
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Assets estáticos
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      const fresh = await fetch(req);
      if (url.origin === self.location.origin) {
        const cache = await caches.open(SW_VERSION);
        cache.put(req, fresh.clone());
      }
      return fresh;
    })()
  );
});

// Permite forzar actualización
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
