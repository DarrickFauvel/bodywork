const CACHE = "bodywork-v1"
const STATIC = [
  "/public/styles.css",
  "/public/components.js",
  "/public/manifest.json",
  "/public/icon.svg",
  "/public/offline.html",
]

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Cache-first for static assets
  if (url.pathname.startsWith("/public/")) {
    e.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((res) => {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(request, clone))
        return res
      }))
    )
    return
  }

  // Network-first for everything else (HTML pages)
  e.respondWith(
    fetch(request).catch(() =>
      caches.match("/public/offline.html").then((r) => r ?? new Response("Offline", { status: 503 }))
    )
  )
})
