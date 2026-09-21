/* Radio Creciendo — service worker
   Cachea la cáscara del sitio para que abra al instante y funcione sin señal.
   El stream de audio y el feed de noticias NUNCA se cachean: siempre van a la red. */

const VERSION = "creciendo-v6";
const CASCARA = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./img/logo.png",
  "./img/icon-192.png",
  "./img/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CASCARA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Audio en vivo y todo lo que salga de otro dominio: derecho a la red.
  if (url.origin !== location.origin) return;

  // Los MP3 de episodios no se cachean: ocuparían todo el espacio del celular.
  if (url.pathname.includes("/podcasts/")) return;

  // Los feeds siempre frescos, con la copia cacheada como paracaídas.
  if (url.pathname.endsWith("noticias.json") || url.pathname.endsWith("podcasts.json") || url.pathname.endsWith("sponsors.json") || url.pathname.endsWith("farmacias.json")) {
    e.respondWith(
      fetch(req)
        .then(r => {
          const copia = r.clone();
          caches.open(VERSION).then(c => c.put(req, copia));
          return r;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // El resto: cache primero, red de respaldo.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      const copia = r.clone();
      caches.open(VERSION).then(c => c.put(req, copia));
      return r;
    }).catch(() => caches.match("./index.html")))
  );
});
