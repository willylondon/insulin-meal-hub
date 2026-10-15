import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const origin = 'https://meals.example.test';
const key = value => typeof value === 'string' ? new URL(value, origin).href : value.url;

function worker({ fetch = async () => new Response('fresh'), put, addAll } = {}) {
    const handlers = {}, entries = new Map(), timers = new Map();
    const calls = [], writes = [], deleted = [];
    let nextTimer = 0, skipped = false, claimed = false;
    const cache = {
        async addAll(requests) {
            calls.push(...requests);
            if (addAll) await addAll(requests);
        },
        async match(request, options = {}) {
            const url = key(request);
            for (const [stored, response] of entries) {
                if (stored === url || (options.ignoreSearch && stored.split('?')[0] === url.split('?')[0])) return response.clone();
            }
        },
        async put(request, response) {
            writes.push(key(request));
            if (put) await put();
            entries.set(key(request), response);
        },
    };
    class LocalRequest extends Request {
        constructor(input, options) { super(typeof input === 'string' ? new URL(input, origin) : input, options); }
    }
    vm.runInNewContext(source, {
        Request: LocalRequest, Response, URL, AbortController,
        fetch: (request, options) => { calls.push({ request, options }); return fetch(request, options); },
        setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        self: { location: { origin }, addEventListener(name, fn) { handlers[name] = fn; },
            async skipWaiting() { skipped = true; }, clients: { async claim() { claimed = true; } } },
        caches: { async open() { return cache; }, async keys() { return ['other-app', 'meal-hub-3.0.0', 'meal-hub-3.0.1']; },
            async delete(name) { deleted.push(name); } },
    });
    return {
        entries, calls, writes, deleted, timers,
        get skipped() { return skipped; }, get claimed() { return claimed; },
        dispatch(name, request) {
            const lifetime = []; let response;
            handlers[name]({ request, waitUntil(p) { lifetime.push(p); }, respondWith(p) { response = p; } });
            return { get response() { return response; }, lifetime };
        },
    };
}
const req = (path, extra = {}) => ({ url: new URL(path, origin).href, method: 'GET', mode: 'cors', ...extra });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('install fetches only essential same-origin files and bypasses stale HTTP cache', async () => {
    const w = worker({ fetch: () => { throw new Error('CDN must never be requested'); } });
    await Promise.all(w.dispatch('install').lifetime);
    assert.equal(w.skipped, true);
    assert.ok(w.calls.length > 0);
    for (const request of w.calls) {
        assert.equal(new URL(request.url).origin, origin);
        assert.equal(request.cache, 'reload');
    }
    assert.ok(w.calls.some(r => r.url.endsWith('/meals.json')));
});

test('failed essential precache prevents takeover', async () => {
    const w = worker({ addAll: async () => { throw new Error('missing core file'); } });
    await assert.rejects(Promise.all(w.dispatch('install').lifetime), /missing core/);
    assert.equal(w.skipped, false);
});

test('activation removes only previous caches owned by this app', async () => {
    const w = worker();
    await Promise.all(w.dispatch('activate').lifetime);
    assert.deepEqual(w.deleted, ['meal-hub-3.0.0']);
    assert.equal(w.claimed, true);
});

test('online update bypasses HTTP cache and tracks pending cache write without delaying response', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const w = worker({ put: () => pending });
    w.entries.set(key('/app.js'), new Response('old'));
    const event = w.dispatch('fetch', req('/app.js'));
    assert.equal(await (await event.response).text(), 'fresh');
    assert.equal(w.calls[0].options.cache, 'no-store');
    assert.equal(event.lifetime.length, 1);
    assert.deepEqual(w.writes, [key('/app.js')]);
    release(); await Promise.all(event.lifetime);
    assert.equal(await w.entries.get(key('/app.js')).text(), 'fresh');
    assert.equal(w.timers.size, 0);
});

test('slow network aborts at four seconds and returns cached asset despite query version', async () => {
    let signal;
    const w = worker({ fetch: (_, options) => { signal = options.signal; return new Promise(() => {}); } });
    w.entries.set(key('/app.js'), new Response('offline copy'));
    const event = w.dispatch('fetch', req('/app.js?v=3.0.1'));
    await flush();
    assert.equal(w.timers.size, 1);
    const timer = [...w.timers.values()][0];
    assert.equal(timer.delay, 4000); timer.fn();
    assert.equal(await (await event.response).text(), 'offline copy');
    assert.equal(signal.aborted, true);
    assert.equal(w.timers.size, 0);
});

test('offline navigation uses shell; uncached asset has explicit 503 response', async () => {
    const w = worker({ fetch: async () => { throw new Error('offline'); } });
    w.entries.set(key('/index.html'), new Response('shell'));
    assert.equal(await (await w.dispatch('fetch', req('/missing-page', { mode: 'navigate' })).response).text(), 'shell');
    assert.equal((await w.dispatch('fetch', req('/missing.css')).response).status, 503);
});

test('server errors use cached successful response; 404 is not masked or cached', async () => {
    let status = 503;
    const w = worker({ fetch: async () => new Response('error', { status }) });
    w.entries.set(key('/meals.json'), new Response('saved recipes'));
    assert.equal(await (await w.dispatch('fetch', req('/meals.json')).response).text(), 'saved recipes');
    status = 404;
    assert.equal((await w.dispatch('fetch', req('/meals.json')).response).status, 404);
    assert.equal(w.writes.length, 0);
});

test('quota failure does not reject response or event lifetime', async () => {
    const w = worker({ put: async () => { throw new Error('quota'); } });
    const event = w.dispatch('fetch', req('/style.css'));
    assert.equal((await event.response).status, 200);
    await Promise.all(event.lifetime);
});

test('optional CDN runtime writes are tracked and subsequent request uses cache', async () => {
    const w = worker();
    const request = req('https://cdnjs.cloudflare.com/example.css');
    const event = w.dispatch('fetch', request);
    assert.equal(await (await event.response).text(), 'fresh');
    assert.equal(event.lifetime.length, 1);
    await Promise.all(event.lifetime);
    assert.equal(await (await w.dispatch('fetch', request).response).text(), 'fresh');
    assert.equal(w.calls.length, 1);
});

test('API, remote sheets, non-GET and unrelated third-party traffic are not intercepted', () => {
    const w = worker();
    for (const request of [req('/api/generate-meal'), req('/index.html', { method: 'POST' }),
        req('https://docs.google.com/sheet'), req('https://unrelated.example/asset')]) {
        assert.equal(w.dispatch('fetch', request).response, undefined);
    }
    assert.equal(w.calls.length, 0);
});
