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

// Notifications, for the app on a Home Screen: the 11:11 daily note, the
// daily reminder, a letter's day, a reflection that is ready, Circle alerts.
// The server sends what it says (a title, sometimes a line under it) and where
// a tap goes — nothing else (server/lib/webPush.js). The phone already shows
// the app's name and icon, so the title is the message, not "Lowkei" again.
// Every push shows something: iPhone stops delivering to a web app that
// receives pushes silently.

const OPENABLE = ['/', '/circle', '/check-in?mode=letter', '/check-in?mode=vent'];

self.addEventListener('push', event => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = {};
  }
  const options = {
    icon: '/app/icon-192.png',
    tag: message.tag,
    data: { url: OPENABLE.includes(message.url) ? message.url : '/' }
  };
  if (message.body) options.body = message.body;
  event.waitUntil(self.registration.showNotification(message.title || 'Something is waiting for you.', options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = OPENABLE.includes(event.notification.data?.url) ? event.notification.data.url : '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find(w => new URL(w.url).pathname.startsWith('/app'));
      if (open) {
        await open.focus();
        open.postMessage({ type: 'open', path });
        return;
      }
      await self.clients.openWindow(path === '/' ? '/app' : `/app${path}`);
    })()
  );
});
