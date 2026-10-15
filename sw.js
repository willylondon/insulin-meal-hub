// Insulin-Smart Meal Hub — Service Worker
//
// Same-origin files are served network-first, so code and recipe fixes reach
// installed apps on the next online visit; the cache is only an offline
// fallback. Bump VERSION on every release to refresh the precache.

const VERSION = '3.0.0';
const PREFIX = 'meal-hub-';
const CACHE = `${PREFIX}${VERSION}`;

// Essential same-origin files. Installation fails only if one of these fails.
const CORE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/meal-rules.js',
    '/meals.json',
    '/manifest.json',
    '/favicon.svg',
    '/icon-192.svg',
    '/icon-512.svg',
];

// Nice-to-have third-party styles (icons, fonts). Cached when available;
// the app still works without them.
const OPTIONAL = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@600;700;800&display=swap',
];

self.addEventListener('install', e => {
    e.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll(CORE.map(url => new Request(url, { cache: 'reload' })));
        await Promise.allSettled(OPTIONAL.map(url => cache.add(new Request(url, { mode: 'cors', credentials: 'omit' }))));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', e => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        // Only remove this app's old caches, never other caches on the origin.
        await Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (err) {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') {
            const shell = await cache.match('/index.html');
            if (shell) return shell;
        }
        throw err;
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
    return response;
}

self.addEventListener('fetch', e => {
    const { request } = e;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    // Never intercept the API or remote recipe sources.
    if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;
    if (url.hostname === 'docs.google.com') return;

    if (url.origin === self.location.origin) {
        e.respondWith(networkFirst(request));
        return;
    }
    // Versioned third-party assets (fonts, icon CSS) rarely change.
    if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        e.respondWith(cacheFirst(request));
    }
});
