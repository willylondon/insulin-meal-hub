// Fixed-window rate limiter for the AI endpoint.
//
// Uses Upstash Redis (or Vercel KV, which exposes the same REST API) when
// configured, so limits hold across every serverless instance. Without a
// store it falls back to an in-memory counter, which only limits a single
// warm instance; the handler refuses to use that in production unless
// explicitly allowed.

export function createRateLimiter({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
    const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
    const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
    if (url && token) return redisLimiter(url.replace(/\/$/, ''), token, fetchImpl);
    return memoryLimiter();
}

function redisLimiter(url, token, fetchImpl) {
    return {
        durable: true,
        // Increments the counter and returns the new count.
        async hit(key, windowSeconds) {
            const res = await fetchImpl(`${url}/pipeline`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify([
                    ['INCR', key],
                    ['EXPIRE', key, String(windowSeconds), 'NX'],
                ]),
                signal: AbortSignal.timeout(3000),
            });
            if (!res.ok) throw new Error(`Rate limit store responded ${res.status}`);
            const data = await res.json();
            const count = Number(data?.[0]?.result);
            if (!Number.isFinite(count)) throw new Error('Rate limit store returned an unexpected response');
            return count;
        },
    };
}

function memoryLimiter() {
    const counters = new Map();
    return {
        durable: false,
        async hit(key, windowSeconds, now = Date.now()) {
            const entry = counters.get(key);
            if (!entry || entry.resetAt <= now) {
                counters.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
                if (counters.size > 10000) {
                    for (const [k, v] of counters) if (v.resetAt <= now) counters.delete(k);
                }
                return 1;
            }
            entry.count++;
            return entry.count;
        },
    };
}
