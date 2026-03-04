// sw.js - Der minimale Service Worker für die PWA-Installation
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Installiert');
});

self.addEventListener('fetch', (e) => {
    // Dieser leere Fetch-Listener ist der Trick!
    // Er reicht aus, damit Chrome die App als "echte App" akzeptiert.
    e.respondWith(fetch(e.request).catch(() => new Response('Offline.')));
});