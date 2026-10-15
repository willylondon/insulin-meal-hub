// Fixed-window rate limiter for the AI endpoint.
//
// Uses Upstash Redis (or Vercel KV, which exposes the same REST API) when
// configured, so limits hold across every serverless instance. Without a
// store it falls back to memory for explicitly enabled local development only.
// The handler requires a durable store in production.

export function createRateLimiter({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
    const pairs = [
        [env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN],
        [env.KV_REST_API_URL, env.KV_REST_API_TOKEN],
    ];
    const invalid = () => ({ durable: false, configurationError: true, async hit() { throw new Error('Invalid rate limit store configuration'); } });
    if (pairs.some(([url, token]) => (url !== undefined || token !== undefined) && (!url || !token))) return invalid();
    const configured = pairs.filter(([url]) => url !== undefined);
    if (configured.length > 1) return invalid();
    if (!configured.length) return memoryLimiter();
    const [url, token] = configured[0];
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return invalid();
        if (typeof token !== 'string' || !token.trim()) return invalid();
    } catch { return invalid(); }
    return redisLimiter(url.replace(/\/$/, ''), token, fetchImpl);
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
            const count = data?.[0]?.result;
            if (!Array.isArray(data) || data.length !== 2 || data.some(item => !item || item.error)
                || !Number.isSafeInteger(count) || count < 1 || ![0, 1].includes(data[1]?.result)) throw new Error('Rate limit store returned an unexpected response');
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
