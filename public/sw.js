// Family Games service worker: shows "your turn" notifications sent through
// Firebase Cloud Messaging and opens the right game when one is tapped.
// Messages are data-only: { title, body, link }.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Network pass-through. Having a fetch handler keeps every browser's
// "install app" option available; nothing is cached.
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const d = payload.data || payload;
  const title = d.title || 'Family Games';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || undefined,
      data: { link: d.link || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  const target = new URL(link, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin) {
          return w.focus().then(() => w.navigate(target));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
