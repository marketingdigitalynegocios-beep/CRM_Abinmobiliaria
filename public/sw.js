// Service worker mínimo (Fase 13, ver plan-implementacion.md §1-bis) — solo
// cachea assets estáticos (JS/CSS/fuentes/íconos) para que la app cargue más
// rápido e instalable como PWA. Nunca cachea `/api/*` ni las páginas del
// dashboard: los datos del CRM son dinámicos y mostrar una versión vieja en
// caché sería peor que no tener caché (mismo principio de honestidad que el
// resto del proyecto — ver bitacora-desarrollo.md, auditoría de "relleno").
const CACHE_NAME = "saas-inmobiliario-static-v1";

self.addEventListener("install", (event) => {
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

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/icon.svg"
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !isStaticAsset(url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
  );
});
