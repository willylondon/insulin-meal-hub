import { test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { createHandler, validateRequest, validateGeneratedMeal } from '../api/generate-meal.js';
import { createRateLimiter } from '../api/_lib/rate-limit.js';

const ENV = { AI_GENERATION_ENABLED: 'true', ANTHROPIC_API_KEY: 'test-key', NODE_ENV: 'development', AI_LOCAL_DEVELOPMENT: 'true', ALLOWED_ORIGINS: 'https://meals.example.com' };
const silent = { error() {}, warn() {}, log() {} };

const goodBody = () => ({
    proteins: ['chicken'],
    mealType: 'Dinner',
    preferences: { carbTolerance: 'moderate', avoidGout: true, prioritizeHeart: true, budget: 'medium', calorieTarget: 500, proteinTarget: 30 },
});

const goodRecipe = () => ({
    name: 'Jerk Chicken with Callaloo',
    type: 'Dinner',
    prepTime: '30 min',
    servings: 2,
    difficulty: 'Easy',
    ingredients: ['2 chicken breasts', '2 cups callaloo', '1 tbsp jerk seasoning', '1 tbsp olive oil'],
    instructions: ['Season the chicken', 'Grill until it reaches 165°F (74°C)', 'Steam the callaloo and serve'],
    tags: ['Jamaican', 'Chicken'],
    nutritionPerServing: { calories: 450, protein: 40, carbs: 15, fiber: 5 },
});

function fakeClient(responseOrError, calls = []) {
    return () => ({
        messages: {
            create: async params => {
                calls.push(params);
                if (responseOrError instanceof Error) throw responseOrError;
                return responseOrError;
            },
        },
    });
}

const modelReply = obj => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(obj) }] });

function makeReq({ body = goodBody(), method = 'POST', headers = {} } = {}) {
    return {
        method,
        body,
        headers: { host: 'meals.example.com', origin: 'https://meals.example.com', 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.5', ...headers },
    };
}

function makeRes() {
    return {
        statusCode: 0, body: null, headers: {},
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; },
    };
}

async function call(handlerOpts, reqOpts) {
    const handler = createHandler({ env: ENV, limiter: createRateLimiter({ env: {} }), log: silent, ...handlerOpts });
    const res = makeRes();
    await handler(makeReq(reqOpts), res);
    return res;
}

test('valid request returns a validated recipe and sends a bounded, structured request', async () => {
    const calls = [];
    const res = await call({ createClient: fakeClient(modelReply(goodRecipe()), calls) });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.meal.name, 'Jerk Chicken with Callaloo');
    assert.equal(res.body.meal.source, 'ai');
    assert.equal(res.body.meal.nutrition.verified, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].output_config.format.type, 'json_schema');
    assert.ok(calls[0].max_tokens <= 2000);
    assert.match(calls[0].messages[0].content, /30g per serving/); // protein target reaches the prompt (A03)
    assert.equal(res.headers['cache-control'], 'no-store');
});

test('generation is off unless explicitly enabled (A02)', async () => {
    const calls = [];
    const res = await call({ env: { ANTHROPIC_API_KEY: 'k' }, createClient: fakeClient(modelReply(goodRecipe()), calls) });
    assert.equal(res.statusCode, 503);
    assert.equal(calls.length, 0);
});

test('cross-site and header-less requests are rejected before any provider call (A02)', async () => {
    const calls = [];
    const client = fakeClient(modelReply(goodRecipe()), calls);
    assert.equal((await call({ createClient: client }, { headers: { origin: 'https://evil.example' } })).statusCode, 403);
    assert.equal((await call({ createClient: client }, { headers: { origin: undefined } })).statusCode, 403);
    assert.equal(calls.length, 0);
});

test('per-visitor rate limit returns 429 without calling the provider (A02)', async () => {
    const calls = [];
    const handler = createHandler({
        env: { ...ENV, AI_LIMIT_PER_IP_10MIN: '2' },
        limiter: createRateLimiter({ env: {} }),
        createClient: fakeClient(modelReply(goodRecipe()), calls),
        log: silent,
    });
    const statuses = [];
    for (let i = 0; i < 3; i++) {
        const res = makeRes();
        await handler(makeReq(), res);
        statuses.push(res.statusCode);
    }
    assert.deepEqual(statuses, [200, 200, 429]);
    assert.equal(calls.length, 2);
});

test('production refuses to run without a shared rate-limit store (A02)', async () => {
    const calls = [];
    const res = await call({ env: { ...ENV, VERCEL_ENV: 'production' }, createClient: fakeClient(modelReply(goodRecipe()), calls) });
    assert.equal(res.statusCode, 503);
    assert.equal(calls.length, 0);
});

test('shared store is used when configured and failures fail closed', async () => {
    const seen = [];
    const okFetch = async (url, init) => { seen.push([url, JSON.parse(init.body)]); return { ok: true, json: async () => [{ result: 1 }, { result: 1 }] }; };
    const limiter = createRateLimiter({ env: { UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 't' }, fetchImpl: okFetch });
    assert.equal(limiter.durable, true);
    assert.equal(await limiter.hit('k', 60), 1);
    assert.equal(seen[0][0], 'https://redis.example/pipeline');
    assert.deepEqual(seen[0][1][0], ['INCR', 'k']);

    const badLimiter = createRateLimiter({ env: { KV_REST_API_URL: 'https://kv.example', KV_REST_API_TOKEN: 't' }, fetchImpl: async () => ({ ok: false, status: 500 }) });
    const calls = [];
    const res = await call({ limiter: badLimiter, createClient: fakeClient(modelReply(goodRecipe()), calls) });
    assert.equal(res.statusCode, 503);
    assert.equal(calls.length, 0);
});

test('malformed input gets a 400 instead of a crash (A08)', async () => {
    const calls = [];
    const client = fakeClient(modelReply(goodRecipe()), calls);
    const bad = [
        { ...goodBody(), proteins: 'chicken' },
        { ...goodBody(), preferences: null },
        { ...goodBody(), preferences: { ...goodBody().preferences, calorieTarget: -500 } },
        { ...goodBody(), proteins: ['chicken', '<script>'] },
        { ...goodBody(), mealType: 'Brunch' },
        [],
        null,
    ];
    for (const body of bad) {
        const res = await call({ createClient: client }, { body });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
    }
    assert.equal((await call({ createClient: client }, { body: '{not json' })).statusCode, 400);
    assert.equal((await call({ createClient: client }, { body: { ...goodBody(), pad: 'x'.repeat(3000) } })).statusCode, 413);
    assert.equal((await call({ createClient: client }, { headers: { 'content-type': 'text/plain' } })).statusCode, 415);
    assert.equal(calls.length, 0);
});

test('non-POST is rejected', async () => {
    const res = await call({ createClient: fakeClient(modelReply(goodRecipe())) }, { method: 'GET' });
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'POST');
});

test('empty or restriction-breaking AI output is withheld (A06)', async () => {
    assert.equal((await call({ createClient: fakeClient(modelReply({})) })).statusCode, 422);

    const shrimp = { ...goodRecipe(), name: 'Shrimp Rundown', ingredients: ['200g shrimp', '1 cup coconut milk', 'scallion'], nutritionPerServing: { calories: 500, protein: 30, carbs: 200, fiber: 2 } };
    const res = await call({ createClient: fakeClient(modelReply(shrimp)) });
    assert.equal(res.statusCode, 422);
    assert.ok(res.body.reasons.some(r => /carbs/.test(r)));
    assert.ok(res.body.reasons.some(r => /gout/.test(r)));
});

test('AI output with fresh ackee or missing poultry temperature is withheld (A05)', () => {
    const request = validateRequest({ ...goodBody(), proteins: ['ackee', 'chicken'] }).value;
    const ackee = { ...goodRecipe(), ingredients: ['1 cup fresh ackee', '2 eggs', 'pepper'] };
    assert.ok(validateGeneratedMeal(ackee, request).problems.some(p => /ackee/i.test(p)));
    const chicken = { ...goodRecipe(), instructions: ['Grill for 6 minutes a side', 'Serve'] };
    assert.ok(validateGeneratedMeal(chicken, request).problems.some(p => /165/.test(p)));
});

test('provider errors are not leaked to the client (A08)', async () => {
    const leaky = new Anthropic.APIError(500, { error: { message: 'secret prompt details' } }, 'secret prompt details', new Headers());
    const res = await call({ createClient: fakeClient(leaky) });
    assert.equal(res.statusCode, 502);
    assert.ok(!JSON.stringify(res.body).includes('secret'));
    assert.ok(res.body.requestId);

    const truncated = { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"name": "Half' }] };
    const res2 = await call({ createClient: fakeClient(truncated) });
    assert.equal(res2.statusCode, 502);
    assert.ok(!('raw' in res2.body));
});

test('unknown and preview deployments never call the provider; production cannot bypass shared limits', async () => {
    for (const patch of [
        { NODE_ENV: 'production', AI_LOCAL_DEVELOPMENT: undefined },
        { VERCEL_ENV: 'preview' }, { VERCEL: '1' }, { VERCEL_URL: 'preview.example' },
        { VERCEL_ENV: 'production', AI_ALLOW_MEMORY_RATE_LIMIT: 'true' },
    ]) {
        const calls = [];
        const res = await call({ env: { ...ENV, ...patch }, createClient: fakeClient(modelReply(goodRecipe()), calls) });
        assert.equal(res.statusCode, 503);
        assert.equal(calls.length, 0);
    }
    const calls = [];
    const res = await call({ env: { ...ENV, VERCEL_ENV: 'production' }, limiter: { durable: true, async hit() { return 1; } }, createClient: fakeClient(modelReply(goodRecipe()), calls) });
    assert.equal(res.statusCode, 200);
    assert.equal(calls.length, 1);
});

test('origins require explicit exact configuration and cannot be supplied through request host headers', async () => {
    const calls = [];
    const createClient = fakeClient(modelReply(goodRecipe()), calls);
    for (const origin of [undefined, '*', 'https://meals.example.com/', 'https://meals.example.com/path', 'http://meals.example.com', 'https://meals.example.com,']) {
        assert.equal((await call({ env: { ...ENV, ALLOWED_ORIGINS: origin }, createClient })).statusCode, 503);
    }
    assert.equal((await call({ createClient }, { headers: { host: 'evil.example', 'x-forwarded-host': 'evil.example', origin: 'https://evil.example' } })).statusCode, 403);
    assert.equal((await call({ createClient }, { headers: { origin: undefined, referer: 'https://meals.example.com/' } })).statusCode, 403);
    assert.equal(calls.length, 0);
});

test('malformed budgets fail closed and zero budget permits no provider calls', async () => {
    for (const key of ['AI_LIMIT_PER_IP_10MIN', 'AI_LIMIT_PER_IP_DAY', 'AI_LIMIT_GLOBAL_DAY']) {
        for (const value of ['', '2junk', '-1', '1.5', ' 5', '1e3', '9007199254740992']) {
            const calls = [];
            assert.equal((await call({ env: { ...ENV, [key]: value }, createClient: fakeClient(modelReply(goodRecipe()), calls) })).statusCode, 503);
            assert.equal(calls.length, 0);
        }
        const calls = [];
        assert.equal((await call({ env: { ...ENV, [key]: '0' }, createClient: fakeClient(modelReply(goodRecipe()), calls) })).statusCode, 429);
        assert.equal(calls.length, 0);
    }
});

test('partial or ambiguous Redis configuration never falls back to memory', async () => {
    for (const env of [
        { UPSTASH_REDIS_REST_URL: 'https://redis.example' },
        { KV_REST_API_TOKEN: 't' },
        { UPSTASH_REDIS_REST_URL: 'https://redis.example', KV_REST_API_TOKEN: 't' },
        { UPSTASH_REDIS_REST_URL: 'http://redis.example', UPSTASH_REDIS_REST_TOKEN: 't' },
        { UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 't', KV_REST_API_URL: 'https://other.example', KV_REST_API_TOKEN: 't' },
    ]) {
        const limiter = createRateLimiter({ env, fetchImpl: () => assert.fail('Network must not be called') });
        assert.equal(limiter.configurationError, true);
        const calls = [];
        assert.equal((await call({ limiter, createClient: fakeClient(modelReply(goodRecipe()), calls) })).statusCode, 503);
        assert.equal(calls.length, 0);
    }
});

test('Redis count and expiry command responses must both be valid', async () => {
    for (const data of [null, [], [{ result: null }, { result: 1 }], [{ result: '1' }, { result: 1 }], [{ result: 0 }, { result: 1 }], [{ result: 1.5 }, { result: 1 }], [{ result: 1 }, { error: 'expiry failed' }], [{ result: 1 }], [{ error: 'increment failed' }, { result: 1 }]]) {
        const limiter = createRateLimiter({ env: { KV_REST_API_URL: 'https://kv.example', KV_REST_API_TOKEN: 't' }, fetchImpl: async () => ({ ok: true, json: async () => data }) });
        await assert.rejects(limiter.hit('test', 60));
    }
});

test('unexpected AI fields, verified claims, nonfinite or inconsistent nutrition are withheld', () => {
    const request = validateRequest(goodBody()).value;
    for (const raw of [
        { ...goodRecipe(), verified: true },
        { ...goodRecipe(), tags: ['Clinically proven'] },
        { ...goodRecipe(), name: 'Verified nutrition chicken' },
        { ...goodRecipe(), nutritionPerServing: { ...goodRecipe().nutritionPerServing, verified: true } },
        { ...goodRecipe(), nutritionPerServing: { ...goodRecipe().nutritionPerServing, calories: Infinity } },
        { ...goodRecipe(), nutritionPerServing: { ...goodRecipe().nutritionPerServing, fiber: 16 } },
        { ...goodRecipe(), nutritionPerServing: { ...goodRecipe().nutritionPerServing, protein: '40' } },
    ]) assert.ok(validateGeneratedMeal(raw, request).problems);
});
