// Vercel Serverless Function — AI recipe generator
//
// Required environment:
//   ANTHROPIC_API_KEY           server-side key (never sent to the browser)
//   AI_GENERATION_ENABLED=true  generation is off unless this is set
// Rate limiting (see DEPLOYMENT.md):
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL / KV_REST_API_TOKEN)
//   AI_LIMIT_PER_IP_10MIN (default 5), AI_LIMIT_PER_IP_DAY (default 20), AI_LIMIT_GLOBAL_DAY (default 200)
//   AI_LOCAL_DEVELOPMENT=true permits memory limits only with NODE_ENV=development and no deployment marker
// Required: ALLOWED_ORIGINS (exact comma-separated origins); optional: ANTHROPIC_MODEL

import Anthropic from '@anthropic-ai/sdk';
import { createHash, randomUUID } from 'node:crypto';
import { createRateLimiter } from './_lib/rate-limit.js';
import {
    CARB_LEVELS, DIFFICULTIES, MEAL_TYPES, PROTEINS, PROTEIN_IDS, BUDGETS,
    CALORIE_RANGE, PROTEIN_RANGE, exclusionReasons, mealMatchesProteins,
    normalizeMeal, safetyIssues,
} from '../meal-rules.js';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_BODY_CHARS = 2000;
const MAX_CONCURRENT = 4;
const PROVIDER_TIMEOUT_MS = 25000;
const CALORIE_TOLERANCE = 200;

// ── Request validation ──

export function validateRequest(body) {
    const errors = [];
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { errors: ['Request body must be a JSON object.'] };
    }
    const { proteins, mealType = 'any', preferences } = body;

    if (!Array.isArray(proteins) || proteins.length < 1 || proteins.length > 5) {
        errors.push('proteins must be a list of 1 to 5 items.');
    } else if (!proteins.every(p => PROTEIN_IDS.includes(p))) {
        errors.push('proteins contains an unknown value.');
    }
    if (mealType !== 'any' && !MEAL_TYPES.includes(mealType)) errors.push('mealType is not recognised.');

    const p = preferences;
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
        errors.push('preferences must be an object.');
    } else {
        if (!Object.hasOwn(CARB_LEVELS, p.carbTolerance)) errors.push('preferences.carbTolerance is not recognised.');
        if (typeof p.avoidGout !== 'boolean') errors.push('preferences.avoidGout must be true or false.');
        if (typeof p.prioritizeHeart !== 'boolean') errors.push('preferences.prioritizeHeart must be true or false.');
        if (!BUDGETS.includes(p.budget)) errors.push('preferences.budget is not recognised.');
        if (!Number.isInteger(p.calorieTarget) || p.calorieTarget < CALORIE_RANGE.min || p.calorieTarget > CALORIE_RANGE.max) {
            errors.push(`preferences.calorieTarget must be a whole number from ${CALORIE_RANGE.min} to ${CALORIE_RANGE.max}.`);
        }
        if (!Number.isInteger(p.proteinTarget) || p.proteinTarget < PROTEIN_RANGE.min || p.proteinTarget > PROTEIN_RANGE.max) {
            errors.push(`preferences.proteinTarget must be a whole number from ${PROTEIN_RANGE.min} to ${PROTEIN_RANGE.max}.`);
        }
    }
    if (errors.length) return { errors };
    return {
        value: {
            proteins: [...new Set(proteins)],
            mealType,
            preferences: {
                carbTolerance: p.carbTolerance,
                avoidGout: p.avoidGout,
                prioritizeHeart: p.prioritizeHeart,
                budget: p.budget,
                calorieTarget: p.calorieTarget,
                proteinTarget: p.proteinTarget,
            },
        },
    };
}

// ── Prompt ──

const RECIPE_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'type', 'prepTime', 'servings', 'difficulty', 'ingredients', 'instructions', 'tags', 'nutritionPerServing'],
    properties: {
        name: { type: 'string' },
        type: { type: 'string', enum: MEAL_TYPES },
        prepTime: { type: 'string' },
        servings: { type: 'integer' },
        difficulty: { type: 'string', enum: DIFFICULTIES },
        ingredients: { type: 'array', items: { type: 'string' } },
        instructions: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
        nutritionPerServing: {
            type: 'object',
            additionalProperties: false,
            required: ['calories', 'protein', 'carbs', 'fiber'],
            properties: {
                calories: { type: 'number' },
                protein: { type: 'number' },
                carbs: { type: 'number' },
                fiber: { type: 'number' },
            },
        },
    },
};

const SYSTEM_PROMPT = `You write practical home recipes in a Jamaican style for an app used by people who are watching their carbohydrate intake.

Rules:
- Use only commercially canned ackee (drained). Never include fresh ackee or instructions for preparing it.
- Raw chicken or turkey must be cooked to 165°F (74°C); say so in the instructions. Pork must reach 145°F (63°C), ground meat 160°F (71°C), fish 145°F (63°C).
- Respect every dietary restriction you are given; if an ingredient might break one, leave it out.
- Give quantities for every ingredient so the nutrition estimate is per serving.
- nutritionPerServing is your best estimate in kcal and grams per serving. It will be shown as an unverified estimate.
- Do not make health or medical claims, and do not mention insulin doses.
- Ingredients and instructions are plain strings without numbering or bullet characters.`;

export function buildPrompt({ proteins, mealType, preferences }) {
    const labels = proteins.map(id => PROTEINS.find(p => p.id === id).label.toLowerCase());
    const carb = CARB_LEVELS[preferences.carbTolerance];
    const restrictions = [];
    if (preferences.avoidGout) restrictions.push('avoid common gout triggers: shellfish, organ meats, red meat, sardines, anchovies, herring, mackerel and tuna');
    if (preferences.prioritizeHeart) restrictions.push('heart-healthy: no red or processed meat, keep saturated fat (coconut, butter, cheese) low');
    return [
        `Create one recipe using at least one of these proteins: ${labels.join(', ')}.`,
        mealType === 'any' ? 'Choose the most suitable meal type (Breakfast, Lunch or Dinner).' : `It must be a ${mealType} recipe.`,
        `Carbohydrate: no more than ${carb.max}g per serving.`,
        `Calories: about ${preferences.calorieTarget} kcal per serving (within ${CALORIE_TOLERANCE} kcal).`,
        `Protein: aim for about ${preferences.proteinTarget}g per serving.`,
        `Budget: ${preferences.budget}.`,
        restrictions.length ? `Dietary restrictions: ${restrictions.join('; ')}.` : 'No extra dietary restrictions.',
    ].join('\n');
}

// ── Output validation ──

const isString = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const isNumber = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

// Returns { meal } or { problems }. Fails closed: anything unexpected is a problem.
export function validateGeneratedMeal(raw, request) {
    const problems = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { problems: ['The response was not a recipe.'] };

    if (Object.keys(raw).some(key => !Object.hasOwn(RECIPE_SCHEMA.properties, key))) problems.push('Unexpected recipe fields.');
    if (!isString(raw.name, 3, 100)) problems.push('Missing or invalid recipe name.');
    if (!MEAL_TYPES.includes(raw.type)) problems.push('Missing or invalid meal type.');
    else if (request.mealType !== 'any' && raw.type !== request.mealType) problems.push(`Recipe is a ${raw.type}, not a ${request.mealType}.`);
    if (!isString(raw.prepTime, 1, 30)) problems.push('Missing or invalid prep time.');
    if (!Number.isInteger(raw.servings) || raw.servings < 1 || raw.servings > 6) problems.push('Servings must be 1 to 6.');
    if (!DIFFICULTIES.includes(raw.difficulty)) problems.push('Missing or invalid difficulty.');
    if (!Array.isArray(raw.ingredients) || raw.ingredients.length < 3 || raw.ingredients.length > 25 || !raw.ingredients.every(i => isString(i, 2, 160))) {
        problems.push('Ingredients list is missing or malformed.');
    }
    if (!Array.isArray(raw.instructions) || raw.instructions.length < 2 || raw.instructions.length > 20 || !raw.instructions.every(i => isString(i, 3, 400))) {
        problems.push('Instructions are missing or malformed.');
    }
    if (!Array.isArray(raw.tags) || raw.tags.length > 6 || !raw.tags.every(t => isString(t, 1, 30))) problems.push('Tags are malformed.');

    const n = raw.nutritionPerServing;
    const nutritionOk = n && typeof n === 'object' && !Array.isArray(n)
        && Object.keys(n).every(key => ['calories', 'protein', 'carbs', 'fiber'].includes(key))
        && isNumber(n.calories, 50, 1500) && isNumber(n.protein, 0, 150)
        && isNumber(n.carbs, 0, 200) && isNumber(n.fiber, 0, 60) && n.fiber <= n.carbs;
    if (!nutritionOk) problems.push('Nutrition estimate is missing or out of range.');
    if (problems.length) return { problems };
    const recipeText = [raw.name, ...raw.ingredients, ...raw.instructions, ...raw.tags].join(' ');
    if (/\b(?:verified|certified|clinically\s+(?:proven|tested|approved)|medically\s+approved)\b/i.test(recipeText)) {
        return { problems: ['Recipe contains an unsupported verification or clinical claim.'] };
    }

    const { preferences } = request;
    const carbMax = CARB_LEVELS[preferences.carbTolerance].max;
    if (n.carbs > carbMax) problems.push(`Estimated ${n.carbs}g carbs per serving is above your ${carbMax}g limit.`);
    if (Math.abs(n.calories - preferences.calorieTarget) > CALORIE_TOLERANCE) {
        problems.push(`Estimated ${n.calories} kcal per serving is too far from your ${preferences.calorieTarget} kcal target.`);
    }

    const meal = normalizeMeal({
        id: 'AI-' + Date.now(),
        name: raw.name,
        type: raw.type,
        prepTime: raw.prepTime,
        servings: raw.servings,
        difficulty: raw.difficulty,
        ingredients: raw.ingredients,
        instructions: raw.instructions,
        tags: raw.tags,
        nutrition: { ...n, verified: false, source: 'AI estimate (unverified)' },
        source: 'ai',
    });
    if (!meal) return { problems: ['The recipe could not be read.'] };

    problems.push(...exclusionReasons(meal, preferences));
    problems.push(...safetyIssues(meal));
    if (!mealMatchesProteins(meal, request.proteins)) problems.push('Recipe does not use any of the selected proteins.');
    return problems.length ? { problems } : { meal };
}

// ── Handler ──

function clientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    const first = typeof fwd === 'string' ? fwd.split(',')[0].trim() : '';
    return first || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

export function isLocalDevelopment(env) {
    return env.AI_LOCAL_DEVELOPMENT === 'true' && env.NODE_ENV === 'development'
        && !env.VERCEL && !env.VERCEL_ENV && !env.VERCEL_URL;
}

function configuredOrigins(env) {
    const entries = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (!entries.length || entries.some(origin => {
        try {
            const url = new URL(origin);
            const local = isLocalDevelopment(env) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
            return url.origin !== origin || url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'));
        } catch { return true; }
    })) throw new Error('Invalid allowed origins configuration');
    return new Set(entries);
}

const hashKey = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
const intEnv = (value, fallback) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new Error('Invalid request budget configuration');
    }
    return Number(value);
};

export function createHandler({
    env = process.env,
    limiter = createRateLimiter({ env }),
    createClient = apiKey => new Anthropic({ apiKey, timeout: PROVIDER_TIMEOUT_MS, maxRetries: 0 }),
    log = console,
} = {}) {
    let inFlight = 0;

    return async function handler(req, res) {
        const requestId = randomUUID();
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Request-Id', requestId);
        const fail = (status, error, extra = {}) => res.status(status).json({ error, requestId, ...extra });

        if (req.method !== 'POST') {
            res.setHeader('Allow', 'POST');
            return fail(405, 'Method not allowed.');
        }
        if (env.AI_GENERATION_ENABLED !== 'true') {
            return fail(503, 'AI recipe generation is turned off.');
        }
        const apiKey = env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            log.error(`[${requestId}] ANTHROPIC_API_KEY is not set`);
            return fail(503, 'AI recipe generation is not available right now.');
        }
        let limits, origins;
        try {
            // Only production or explicitly local development may use paid generation.
            // Preview and unknown deployment environments fail closed.
            if (env.VERCEL_ENV !== 'production' && !isLocalDevelopment(env)) throw new Error('Unsupported environment');
            origins = configuredOrigins(env);
            limits = [intEnv(env.AI_LIMIT_PER_IP_10MIN, 5), intEnv(env.AI_LIMIT_PER_IP_DAY, 20), intEnv(env.AI_LIMIT_GLOBAL_DAY, 200)];
            if (limiter.configurationError || (!limiter.durable && !isLocalDevelopment(env))) throw new Error('Shared limiter required');
        } catch {
            log.error(`[${requestId}] Invalid generation configuration`);
            return fail(503, 'AI recipe generation is not available right now.');
        }
        if (typeof req.headers.origin !== 'string' || !origins.has(req.headers.origin)) {
            return fail(403, 'Requests must come from the Meal Hub app.');
        }
        if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
            return fail(415, 'Send the request as JSON.');
        }

        let body = req.body;
        if (typeof body === 'string') {
            if (body.length > MAX_BODY_CHARS) return fail(413, 'Request is too large.');
            try { body = JSON.parse(body); } catch { return fail(400, 'Request body is not valid JSON.'); }
        }
        let bodySize;
        try { bodySize = JSON.stringify(body ?? null).length; } catch { return fail(400, 'Request body is not valid JSON.'); }
        if (bodySize > MAX_BODY_CHARS) return fail(413, 'Request is too large.');

        const { value: request, errors } = validateRequest(body);
        if (errors) return fail(400, 'The request was not valid.', { details: errors });

        // Rate limits are checked (and counted) before any paid provider call.
        try {
            const ip = hashKey(clientIp(req));
            const day = new Date().toISOString().slice(0, 10);
            const checks = [
                [`ai:ip10:${ip}:${Math.floor(Date.now() / 600000)}`, 600, limits[0]],
                [`ai:ipday:${ip}:${day}`, 86400, limits[1]],
                [`ai:global:${day}`, 86400, limits[2]],
            ];
            for (const [key, window, limit] of checks) {
                const count = await limiter.hit(key, window);
                if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid limiter count');
                if (count > limit) {
                    res.setHeader('Retry-After', String(window));
                    return fail(429, key.startsWith('ai:global')
                        ? 'The daily AI recipe limit has been reached. Please try again tomorrow.'
                        : 'You have generated a lot of recipes recently. Please wait a while and try again.');
                }
            }
        } catch (err) {
            log.error(`[${requestId}] Rate limit check failed`);
            return fail(503, 'AI recipe generation is not available right now.');
        }

        if (inFlight >= MAX_CONCURRENT) {
            res.setHeader('Retry-After', '10');
            return fail(503, 'The AI generator is busy. Please try again in a moment.');
        }
        inFlight++;
        try {
            const client = createClient(apiKey);
            const response = await client.messages.create({
                model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
                // A single recipe is well under 1,000 tokens; the cap bounds cost per call.
                max_tokens: 2000,
                system: SYSTEM_PROMPT,
                messages: [{ role: 'user', content: buildPrompt(request) }],
                output_config: { format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
            });

            if (response.stop_reason !== 'end_turn') {
                log.warn(`[${requestId}] Generation stopped with ${response.stop_reason}`);
                return fail(502, 'The AI could not produce a recipe this time. Please try again.');
            }
            const text = response.content.find(b => b.type === 'text')?.text;
            let raw;
            try { raw = JSON.parse(text); } catch {
                log.warn(`[${requestId}] Model output was not valid JSON`);
                return fail(502, 'The AI could not produce a recipe this time. Please try again.');
            }

            const { meal, problems } = validateGeneratedMeal(raw, request);
            if (problems) {
                log.warn(`[${requestId}] Generated recipe withheld: ${problems.join(' | ')}`);
                return fail(422, 'The AI suggestion did not meet your settings or our safety checks, so it was not shown. Please try again.', { reasons: problems });
            }
            return res.status(200).json({ meal, requestId });
        } catch (err) {
            if (err instanceof Anthropic.APIConnectionTimeoutError) {
                log.error(`[${requestId}] Provider timed out`);
                return fail(504, 'The AI took too long to respond. Please try again.');
            }
            if (err instanceof Anthropic.RateLimitError) {
                log.error(`[${requestId}] Provider rate limited the request`);
                return fail(503, 'The AI generator is busy. Please try again in a moment.');
            }
            if (err instanceof Anthropic.APIError) {
                log.error(`[${requestId}] Provider error ${err.status ?? ''}: ${err.name}`);
                return fail(502, 'The AI service returned an error. Please try again later.');
            }
            log.error(`[${requestId}] Unexpected error: ${err?.name || 'Error'}`);
            return fail(500, 'Something went wrong. Please try again later.');
        } finally {
            inFlight--;
        }
    };
}

export default createHandler();
