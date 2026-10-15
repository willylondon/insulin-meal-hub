// Insulin-Smart Meal Hub — Service Worker
//
// Same-origin files are served network-first, so code and recipe fixes reach
// installed apps on the next online visit; the cache is only an offline
// fallback. Bump VERSION on every release to refresh the precache.

const VERSION = '3.0.1';
const NETWORK_TIMEOUT_MS = 4000;
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

// Optional third-party styles/fonts are cached on use, never during install.
// A blocked or stalled CDN must not hold an otherwise complete upgrade open.

self.addEventListener('install', e => {
    e.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll(CORE.map(url => new Request(url, { cache: 'reload' })));
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

// Explicitly race the deadline as well as aborting: callers get a bounded
// fallback even if the network implementation is slow to reject after abort.
async function fetchWithDeadline(request, bypassHttpCache = false) {
    const controller = new AbortController();
    let timer;
    try {
        return await Promise.race([
            fetch(request, { signal: controller.signal, ...(bypassHttpCache ? { cache: 'no-store' } : {}) }),
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    controller.abort();
                    reject(new Error('Network deadline exceeded'));
                }, NETWORK_TIMEOUT_MS);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

function remember(event, cache, request, response) {
    // Keep the worker alive until the write settles. Storage quota failures
    // must not prevent a usable network response from reaching the page.
    event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
}

async function networkFirst(request, event) {
    const cache = await caches.open(CACHE);
    let response;
    try {
        response = await fetchWithDeadline(request, true);
        if (response.ok) remember(event, cache, request, response);
        if (response.status < 500) return response;
    } catch (_) { /* offline or slow: use the most recent successful copy */ }
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
        const shell = await cache.match('/index.html');
        if (shell) return shell;
    }
    return response || new Response('Offline: this resource is not cached.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
}

async function cacheFirst(request, event) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetchWithDeadline(request);
    if (response.ok || response.type === 'opaque') remember(event, cache, request, response);
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
        e.respondWith(networkFirst(request, e));
        return;
    }
    // Versioned third-party assets (fonts, icon CSS) rarely change.
    if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        e.respondWith(cacheFirst(request, e));
    }
});
