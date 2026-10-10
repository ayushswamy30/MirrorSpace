// Lowkei web app — lets the app open without a connection once it has been
// opened once. Pages always try the network first, so an update shows up on
// the next launch; the bundle's files are content-hashed, so a cached copy of
// one can never be stale.

const CACHE = 'lowkei-app-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith('/app')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(c => c.put('/app', copy));
          return response;
        })
        .catch(() => caches.match('/app'))
    );
    return;
  }

  if (url.pathname.startsWith('/app/_expo/') || url.pathname.startsWith('/app/assets/')) {
    event.respondWith(
      caches.match(request).then(
        hit =>
          hit ||
          fetch(request).then(response => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then(c => c.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
