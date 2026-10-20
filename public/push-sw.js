/* Loaded into the generated service worker (vite.config.ts → workbox.importScripts).
   Shows Web Push reminders sent by /api/push-reminders and opens the right page on tap. */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: event.data ? event.data.text() : '' }; }
  const title = data.title || 'TKU Campus OS';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    tag: data.tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-48.png',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin)) {
        await w.focus();
        if ('navigate' in w) await w.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
