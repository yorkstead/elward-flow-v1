const CACHE = 'elward-flow-shell-v1'
const SHELL = ['/manifest.webmanifest']
self.addEventListener('install', (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))),
)
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      ),
  ),
)
self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !SHELL.includes(url.pathname)
  )
    return
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  )
})
