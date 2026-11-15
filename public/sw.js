/* Easy Burger Ops — service worker minimal.
 * Aucun mode hors ligne complet (hors périmètre) : les pages viennent toujours du réseau.
 * En cas de coupure brève, une page d'attente s'affiche au lieu de l'erreur du navigateur ;
 * les saisies non transmises restent gardées sur le téléphone par l'application. */
const CACHE = "eb-ops-v1";
const HORS_LIGNE = "/hors-ligne.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([HORS_LIGNE, "/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  event.respondWith(fetch(req).catch(() => caches.match(HORS_LIGNE)));
});
