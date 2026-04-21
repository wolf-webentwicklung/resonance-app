// Resona Service Worker — App Shell caching + Push Notifications
var CACHE_NAME = 'resona-v2';
var SHELL_URLS = [
  '/',
  '/index.html',
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(SHELL_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Never cache Supabase API calls or realtime
  if (url.hostname.includes('supabase')) return;

  // Network-first for navigation, cache-first for assets
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match('/index.html');
      })
    );
  } else if (url.pathname.match(/\.(js|css|woff2?|png|svg|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
          return response;
        });
      })
    );
  }
});

self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}
  var title = data.title || 'Resona';
  var body = data.body || 'something is here';
  var tag = data.tag || 'resona';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // App is open and visible — realtime subscription handles the update in-app
      var appVisible = clientList.some(function(c) { return c.visibilityState === 'visible'; });
      if (appVisible) return Promise.resolve();
      return self.registration.showNotification(title, {
        body: body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: tag,
        renotify: true,
        vibrate: [100, 50, 100],
        data: { url: self.location.origin },
      });
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || self.location.origin;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.startsWith(targetUrl)) {
          return list[i].focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
