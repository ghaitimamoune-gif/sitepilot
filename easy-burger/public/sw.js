/* =============================================================================
   Easy Burger — service worker
   -----------------------------------------------------------------------------
   Objectif (§3) : l'app s'ouvre en moins d'une seconde en 4G.

   Écrit à la main, sans `next-pwa`. Trois stratégies, choisies pour qu'un
   déploiement ne puisse JAMAIS laisser un client sur d'anciens prix :

     1. Documents HTML      → network-first. Le menu et les prix rendus côté
                              serveur sont donc toujours frais dès qu'il y a
                              du réseau ; le cache ne sert que hors ligne.
     2. /_next/static/*     → cache-first. Ces URL contiennent un hash de
                              contenu : un nouveau déploiement produit de
                              nouvelles URL, l'obsolescence est impossible.
     3. Images, logos, motif → stale-while-revalidate. Affichage instantané,
                              mise à jour en arrière-plan.

   Rien d'autre n'est mis en cache. En particulier : jamais /admin, jamais
   /staff, jamais /api, jamais une requête non-GET.
   ========================================================================== */

const VERSION = 'v1'
const DOCS = `eb-docs-${VERSION}`
const STATIC = `eb-static-${VERSION}`
const MEDIA = `eb-media-${VERSION}`
const CURRENT = [DOCS, STATIC, MEDIA]

/** Routes qui ne doivent jamais toucher le cache. */
const NEVER_CACHE = [/^\/admin(\/|$)/, /^\/staff(\/|$)/, /^\/api(\/|$)/]

/** Plafond du cache média, en nombre d'entrées. */
const MEDIA_MAX_ENTRIES = 80

self.addEventListener('install', (event) => {
  // Le nouveau worker prend la main tout de suite : pas de version fantôme
  // qui survit à un déploiement parce qu'un onglet est resté ouvert.
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((n) => n.startsWith('eb-') && !CURRENT.includes(n)).map((n) => caches.delete(n)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (NEVER_CACHE.some((re) => re.test(url.pathname))) return

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request))
    return
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC))
    return
  }

  if (
    request.destination === 'image' ||
    url.pathname.startsWith('/photos/') ||
    url.pathname.startsWith('/logo/') ||
    url.pathname.startsWith('/pattern/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(staleWhileRevalidate(request, MEDIA))
  }
})

async function networkFirst(request) {
  const cache = await caches.open(DOCS)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Hors ligne</title>' +
        '<body style="font-family:system-ui;padding:2rem"><h1>Pas de réseau</h1>' +
        '<p>Reconnecte-toi pour commander.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone())
        await trim(cache, MEDIA_MAX_ENTRIES)
      }
      return response
    })
    .catch(() => cached)

  return cached || network
}

/** FIFO grossier : suffisant pour empêcher le cache média de gonfler. */
async function trim(cache, max) {
  const keys = await cache.keys()
  if (keys.length <= max) return
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)))
}
