// Source-level guards for the browser files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('index.html');
const sw = read('sw.js');
const vercel = JSON.parse(read('vercel.json'));

test('app.js has no HTML-string sinks (A01)', () => {
    const code = app.replace(/^\s*\/\/.*$/gm, '');
    for (const sink of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function']) {
        assert.ok(!code.includes(sink), `app.js uses ${sink}`);
    }
});

test('index.html has no inline scripts or handlers, so CSP can forbid them', () => {
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'inline <script>');
    assert.ok(!/\son[a-z]+\s*=/i.test(html), 'inline event handler');
    assert.ok(!/\sstyle\s*=/i.test(html), 'inline style attribute');
});

test('CSP and security headers are configured', () => {
    const all = vercel.headers.find(h => h.source === '/(.*)').headers;
    const csp = all.find(h => h.key === 'Content-Security-Policy').value;
    assert.match(csp, /script-src 'self'(;|$)/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.ok(all.some(h => h.key === 'X-Content-Type-Options'));
});

test('zoom is allowed (A13)', () => {
    assert.ok(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(html));
});

test('dialogs and icon buttons have accessible names (A13)', () => {
    for (const m of html.matchAll(/<dialog[^>]*>/g)) assert.match(m[0], /aria-labelledby=/);
    for (const m of html.matchAll(/<button[^>]*class="modal-close"[^>]*>/g)) assert.match(m[0], /aria-label=/);
    assert.match(html, /role="status"/);
    const wrapped = [...html.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/g)].map(m => m[0]);
    for (const m of html.matchAll(/<input[^>]*type="(?:range|checkbox|text)"[^>]*id="([^"]+)"[^>]*>/g)) {
        const labelled = html.includes(`for="${m[1]}"`) || wrapped.some(l => l.includes(m[0]));
        assert.ok(labelled, `#${m[1]} has no label`);
    }
});

test('every switch is a real checkbox without the hidden attribute (A09)', () => {
    for (const m of html.matchAll(/<input[^>]*role="switch"[^>]*>/g)) {
        assert.ok(!/\shidden\b/.test(m[0]));
    }
});

test('service worker precaches every local file the app needs, with a versioned cache (A15, A16)', () => {
    assert.match(sw, /const VERSION = '\d+\.\d+\.\d+'/);
    assert.match(sw, /networkFirst/);
    for (const f of ['/app.js', '/meal-rules.js', '/meals.json', '/style.css', '/index.html']) {
        assert.ok(sw.includes(`'${f}'`), f);
    }
    assert.ok(sw.includes('Promise.allSettled(OPTIONAL'), 'optional assets must not block install');
    assert.ok(sw.includes('k.startsWith(PREFIX)'), 'only this app\'s caches may be deleted');
});

test('docs contain no personal health data (A07)', () => {
    const docs = read('DEPLOYMENT.md') + read('README.md');
    assert.ok(!/HbA1c|mmol\/L|Metformin|Febuxostat|Rosuvastatin/i.test(docs));
});
