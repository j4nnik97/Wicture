// sw.js - Service Worker für Wicture PWA
const CACHE_NAME = 'wicture-shell-v7';
const SHELL_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Nur GET-Anfragen der eigenen Origin abfangen;
    // Supabase-API, Realtime & externe CDNs direkt durchlassen
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Navigation / HTML: Network-First mit Cache-Fallback
    if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
        );
        return;
    }

    // Statische Assets (Icons, Manifest): Cache-First mit Hintergrund-Update
    event.respondWith(
        caches.match(request).then((cached) => {
            const networkFetch = fetch(request).then((response) => {
                if (response && response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            }).catch(() => cached);

            return cached || networkFetch;
        })
    );
});

// Web Push Listener (VAPID + Supabase Edge Function)
self.addEventListener('push', (event) => {
    let data = {
        title: 'Wicture',
        body: 'Es gibt etwas Neues in deiner Woche 📸',
        url: './',
        tag: 'wicture-general'
    };
    try {
        if (event.data) data = Object.assign(data, event.data.json());
    } catch (e) {
        if (event.data) data.body = event.data.text();
    }
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: './icon.png',
            badge: './icon.png',
            tag: data.tag || 'wicture-general',
            renotify: true,
            data: { url: data.url || './' }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const rawUrl = (event.notification.data && event.notification.data.url) || './';
    const targetUrl = new URL(rawUrl, self.location.origin).href;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    if ('navigate' in client) {
                        return client.navigate(targetUrl).then(() => client.focus()).catch(() => client.focus());
                    }
                    return client.focus();
                }
            }
            return clients.openWindow(targetUrl);
        })
    );
});