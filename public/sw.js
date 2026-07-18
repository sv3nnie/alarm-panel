const CACHE = "alarm-v2"
const ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png"
]

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)))
  self.skipWaiting()
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (e) => {
  const req = e.request

  // Only handle same-origin GET requests. Let the browser deal with the rest
  // (auth API calls, the SSE stream, etc.) so nothing is served stale.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return
  }

  // Navigations: network-first so a fresh deploy shows up, cached shell offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/")))
    return
  }

  // Static assets: cache-first, then populate the cache in the background.
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(req, copy))
          return res
        })
    )
  )
})
