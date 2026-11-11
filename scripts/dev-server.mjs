// Local development server: static files, the response headers from
// vercel.json (so CSP problems show up before deploying) and the AI endpoint.
//
//   npm start                 static app + API (API answers 503 unless configured)
//   MOCK_AI=true npm start    API returns a canned recipe; no key, no provider call
//
// Not deployed (scripts/ is in .vercelignore). Do not expose it to a network.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const ORIGIN = `http://localhost:${PORT}`;
const MOCK = process.env.MOCK_AI === 'true';

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};
// Only the files that make up the deployed app are served.
const PUBLIC = /^\/(?:index\.html|app\.js|meal-rules\.js|style\.css|sw\.js|meals\.json|manifest\.json|[\w-]+\.(?:svg|png|ico))$/;

const vercel = JSON.parse(await readFile(join(ROOT, 'vercel.json'), 'utf8'));
const securityHeaders = (vercel.headers.find(h => h.source === '/(.*)')?.headers || [])
    // upgrade-insecure-requests would break plain-http localhost in some browsers.
    .map(h => [h.key, h.value.replace(/;\s*upgrade-insecure-requests/, '')]);

const MOCK_RECIPE = {
    name: 'Mock Jerk Chicken with Callaloo',
    type: 'Dinner',
    prepTime: '30 min',
    servings: 2,
    difficulty: 'Easy',
    ingredients: ['2 skinless chicken breasts (about 300g)', '1 tbsp jerk seasoning', '2 cups callaloo, chopped', '1 tsp olive oil'],
    instructions: [
        'Rub the chicken with jerk seasoning.',
        'Cook the chicken until a thermometer in the thickest part reads 165°F (74°C).',
        'Steam the callaloo with the olive oil for 5 minutes and serve alongside.',
    ],
    tags: ['Jamaican', 'Mock'],
    nutritionPerServing: { calories: 420, protein: 40, carbs: 12, fiber: 5 },
};

async function loadApi() {
    const env = MOCK
        ? { ...process.env, AI_GENERATION_ENABLED: 'true', ANTHROPIC_API_KEY: 'mock', NODE_ENV: 'development', AI_LOCAL_DEVELOPMENT: 'true', ALLOWED_ORIGINS: ORIGIN }
        : process.env;
    const { createHandler } = await import('../api/generate-meal.js');
    if (!MOCK) return createHandler({ env });
    const createClient = () => ({
        messages: {
            async create() {
                await new Promise(r => setTimeout(r, 800));
                return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(MOCK_RECIPE) }] };
            },
        },
    });
    return createHandler({ env, createClient });
}
const api = await loadApi();

async function handleApi(req, res) {
    let raw = '';
    for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 10000) { res.writeHead(413).end(); return; }
    }
    req.body = raw;
    res.status = code => { res.statusCode = code; return res; };
    res.json = data => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); };
    await api(req, res);
}

createServer(async (req, res) => {
    try {
        const { pathname } = new URL(req.url, ORIGIN);
        for (const [k, v] of securityHeaders) res.setHeader(k, v);
        if (pathname === '/api/generate-meal') return await handleApi(req, res);
        if (pathname.startsWith('/api/')) { res.writeHead(404).end('Not found'); return; }

        // Same rewrite as vercel.json: unknown paths get the app shell.
        const file = PUBLIC.test(pathname) ? pathname : '/index.html';
        const full = normalize(join(ROOT, file));
        if (!full.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) { res.writeHead(403).end(); return; }
        const body = await readFile(full);
        res.writeHead(200, { 'Content-Type': TYPES[extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(body);
    } catch (err) {
        if (!res.headersSent) res.writeHead(err?.code === 'ENOENT' ? 404 : 500);
        res.end();
    }
}).listen(PORT, '127.0.0.1', () => {
    console.log(`Meal Hub running at ${ORIGIN}${MOCK ? ' (mock AI)' : ''}`);
});
