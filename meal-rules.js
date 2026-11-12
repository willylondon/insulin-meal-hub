// Insulin-Smart Meal Hub — shared meal rules
// Pure functions used by the browser app (app.js), the AI endpoint
// (api/generate-meal.js) and the test suite. No DOM access here.

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];
export const LOG_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const MEAT_STEAK_TERM = '(?<!salmon\\s|tuna\\s|fish\\s|snapper\\s|mahi\\s|cod\\s|cauliflower\\s|tofu\\s|tempeh\\s|cabbage\\s|mushroom\\s|portobello\\s)steak';

export const PROTEINS = [
    { id: 'chicken',  label: 'Chicken',   icon: '🍗', keywords: ['chicken'] },
    { id: 'fish',     label: 'Fish',      icon: '🐟', keywords: ['fish', 'snapper', 'tilapia', 'cod(?:fish)?\\b', 'saltfish', 'mahi', 'parrotfish'] },
    { id: 'eggs',     label: 'Eggs',      icon: '🥚', keywords: ['egg(?!plant)'] },
    { id: 'tuna',     label: 'Tuna',      icon: '🫙', keywords: ['tuna'] },
    { id: 'sardines', label: 'Sardines',  icon: '🐡', keywords: ['sardine'] },
    { id: 'salmon',   label: 'Salmon',    icon: '🍣', keywords: ['salmon'] },
    { id: 'shrimp',   label: 'Shrimp',    icon: '🦐', keywords: ['shrimp', 'prawn'] },
    { id: 'turkey',   label: 'Turkey',    icon: '🦃', keywords: ['turkey'] },
    { id: 'tofu',     label: 'Tofu',      icon: '🧆', keywords: ['tofu'] },
    { id: 'beef',     label: 'Beef',      icon: '🥩', keywords: ['beef', MEAT_STEAK_TERM, 'minced\\s+beef', 'beef\\s+mince', 'ground\\s+beef', 'oxtail'] },
    { id: 'ackee',    label: 'Ackee',     icon: '🍳', keywords: ['ackee'] },
    { id: 'chickpea', label: 'Chickpeas', icon: '🫘', keywords: ['chickpea'] },
];
export const PROTEIN_IDS = PROTEINS.map(p => p.id);

// One definition of each carb level, shared by the settings UI, the
// AI prompt/validator. Numeric recipe filtering is disabled. Grams of carbohydrate
// per serving.
export const CARB_LEVELS = {
    low:      { max: 30, label: 'Up to 30g' },
    moderate: { max: 50, label: 'Up to 50g' },
    high:     { max: 60, label: 'Up to 60g' },
};

export const BUDGETS = ['low', 'medium', 'high'];
export const CALORIE_RANGE = { min: 300, max: 800, step: 50 };
export const PROTEIN_RANGE = { min: 20, max: 60, step: 5 };

export const DEFAULT_SETTINGS = Object.freeze({
    budget: 'medium',
    carbTolerance: 'moderate',
    calorieTarget: 500,
    proteinTarget: 30,
    avoidGout: true,
    prioritizeHeart: true,
});

// ── Settings ──

function clampStep(value, { min, max, step }, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const clamped = Math.min(max, Math.max(min, n));
    return Math.round((clamped - min) / step) * step + min;
}

// Turns anything (stored JSON, form values) into a complete, valid settings
// object. Unknown keys are dropped.
export function normalizeSettings(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    return {
        budget: BUDGETS.includes(s.budget) ? s.budget : DEFAULT_SETTINGS.budget,
        carbTolerance: Object.hasOwn(CARB_LEVELS, s.carbTolerance) ? s.carbTolerance : DEFAULT_SETTINGS.carbTolerance,
        calorieTarget: clampStep(s.calorieTarget, CALORIE_RANGE, DEFAULT_SETTINGS.calorieTarget),
        proteinTarget: clampStep(s.proteinTarget, PROTEIN_RANGE, DEFAULT_SETTINGS.proteinTarget),
        avoidGout: typeof s.avoidGout === 'boolean' ? s.avoidGout : DEFAULT_SETTINGS.avoidGout,
        prioritizeHeart: typeof s.prioritizeHeart === 'boolean' ? s.prioritizeHeart : DEFAULT_SETTINGS.prioritizeHeart,
    };
}

// ── Meals ──

function cleanString(value, maxLength) {
    if (typeof value === 'number') value = String(value);
    if (typeof value !== 'string') return '';
    // Strip control characters (keep newlines/tabs for splitting).
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

function toList(value, maxItems, maxLength) {
    let items;
    if (Array.isArray(value)) items = value;
    else if (typeof value === 'string') items = value.includes('\n') ? value.split('\n') : value.split(',');
    else return [];
    return items
        .map(v => cleanString(v, maxLength).replace(/^(?:[-•*]|\d+[.)])\s*/, ''))
        .filter(Boolean)
        .slice(0, maxItems);
}

function finiteInRange(value, min, max) {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

// Numeric nutrition is an estimate only. A self-reported verified flag or
// source string cannot establish provenance. Reviewed target filtering is
// deliberately disabled until an audited food-composition pipeline exists.
export function normalizeNutrition(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const n = {
        calories: finiteInRange(raw.calories, 0, 3000),
        protein: finiteInRange(raw.protein, 0, 300),
        carbs: finiteInRange(raw.carbs, 0, 400),
        fiber: finiteInRange(raw.fiber, 0, 100),
    };
    if (Object.values(n).some(v => v === null) || n.fiber > n.carbs) return null;
    return {
        ...n,
        verified: false,
        source: cleanString(raw.source, 200),
    };
}

// Accepts the structured dataset shape (meals.json) and the legacy
// spreadsheet column names. Returns null when the record is unusable.
export function normalizeMeal(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const pick = (...keys) => { for (const k of keys) if (raw[k] !== undefined && raw[k] !== null) return raw[k]; return undefined; };

    const id = cleanString(pick('id', 'Meal ID'), 40);
    const name = cleanString(pick('name', 'Meal Name'), 100);
    const typeRaw = cleanString(pick('type', 'Type'), 20);
    const type = MEAL_TYPES.find(t => t.toLowerCase() === typeRaw.toLowerCase());
    const ingredients = toList(pick('ingredients', 'Ingredients'), 30, 160);
    const instructions = toList(pick('instructions', 'Instructions'), 25, 400);
    if (!id || !name || !type || ingredients.length === 0 || instructions.length === 0) return null;

    const servings = Number.parseInt(pick('servings', 'Servings'), 10);
    const difficultyRaw = cleanString(pick('difficulty', 'Difficulty'), 20);
    return {
        id,
        name,
        type,
        prepTime: cleanString(pick('prepTime', 'Prep Time'), 30),
        servings: Number.isInteger(servings) && servings > 0 && servings <= 12 ? servings : null,
        difficulty: DIFFICULTIES.find(d => d.toLowerCase() === difficultyRaw.toLowerCase()) || null,
        ingredients,
        instructions,
        tags: toList(pick('tags', 'Tags'), 8, 30),
        safetyNotes: toList(pick('safetyNotes', 'Safety Notes'), 5, 400),
        nutrition: normalizeNutrition(pick('nutrition')),
        source: cleanString(pick('source'), 40) || 'curated',
    };
}

function mealText(meal) {
    return [meal.name, ...(meal.ingredients || [])].join('\n').toLowerCase();
}

function mealProteinText(meal) {
    const cleanedIngredients = (meal.ingredients || []).map(line =>
        line.replace(/\b(?:(?:chicken|turkey|beef|fish|pork|vegetable)\s+(?:broth|stock|sauce)|cod\s+liver\s+oil)\b/gi, 'seasoning')
    );
    return [meal.name, ...cleanedIngredients].join('\n').toLowerCase();
}

// Terms are regex fragments matched at a word start; returns the matched text.
function findWord(text, term) {
    const m = new RegExp(`\\b${term}\\w*`, 'i').exec(text);
    return m ? m[0].toLowerCase() : null;
}

function hasWord(text, term) {
    return findWord(text, term) !== null;
}

export function mealMatchesProteins(meal, proteinIds) {
    const text = mealProteinText(meal);
    return proteinIds.some(id => {
        const protein = PROTEINS.find(p => p.id === id);
        return protein ? protein.keywords.some(kw => hasWord(text, kw)) : false;
    });
}

// ── Dietary rules ──
// Ingredient keyword rules. These are conservative screens, not a clinical
// assessment: they exclude meals containing a listed ingredient.

export const GOUT_TRIGGERS = [
    'shrimp', 'prawn', 'lobster', 'crab', 'mussel', 'oyster', 'scallop', 'conch',
    'liver', 'kidney(?!\\s*bean)', 'tripe', 'sweetbread',
    'beef', MEAT_STEAK_TERM, 'goat', 'pork', 'lamb', 'mutton', 'oxtail', 'veal',
    'sardine', 'anchov', 'herring', 'mackerel', 'tuna',
];

export const HEART_EXCLUSIONS = [
    'beef', MEAT_STEAK_TERM, 'goat', 'pork', 'lamb', 'mutton', 'oxtail', 'veal',
    'bacon', 'ham', 'sausage', 'salami', 'corned', 'lard', 'deep-fr', 'deep fr',
];

// Shown as cautions rather than exclusions when heart priority is on.
export const HEART_CAUTIONS = ['coconut milk', 'coconut oil', 'shredded coconut', 'butter', 'cheese', 'cream'];

function matchedTerms(meal, terms) {
    const text = mealText(meal);
    return [...new Set(terms.map(t => findWord(text, t)).filter(Boolean))];
}

// Reasons a meal must not be suggested under the given settings.
export function exclusionReasons(meal, settings) {
    const reasons = [];
    const gout = settings.avoidGout ? matchedTerms(meal, GOUT_TRIGGERS) : [];
    if (gout.length) reasons.push(`Contains a common gout trigger (${gout.join(', ')})`);
    const heart = settings.prioritizeHeart ? matchedTerms(meal, HEART_EXCLUSIONS) : [];
    if (heart.length) reasons.push(`Contains red or processed meat (${heart.join(', ')})`);
    // No numeric recipe filtering: no supported reviewed nutrition source.
    return reasons;
}

export function cautions(meal, settings) {
    const out = [];
    if (settings.prioritizeHeart) {
        const found = matchedTerms(meal, HEART_CAUTIONS);
        if (found.length) out.push(`Contains saturated fat sources (${found.join(', ')})`);
    }
    out.push('Nutrition target filtering is unavailable. Carbohydrate, calorie and protein requests are used only for unverified AI estimates.');
    return out;
}

export function filterMeals(meals, settings) {
    const allowed = [];
    const excluded = [];
    for (const meal of meals) {
        const reasons = exclusionReasons(meal, settings);
        if (reasons.length) excluded.push({ meal, reasons });
        else allowed.push(meal);
    }
    return { allowed, excluded };
}

// ── Food safety ──
// Conservative text screens, NOT verification that a recipe or food is safe.
// Unsupported/ambiguous preparation must be reviewed rather than inferred.
// References: FDA Hypoglycin A and Ackee Fruit; FoodSafety.gov safe minimum
// internal temperatures (checked 2026-10-15). Safety notes cannot substitute
// for an actionable cooking endpoint in the recipe instructions.

const POULTRY_WORDS = /\b(?:chicken|turkey|duck|goose|poultry)\b/i;
const FISH_WORDS = /\b(?:fish|saltfish|snapper|parrotfish|tilapia|cod|mahi(?:[ -]mahi)?|salmon|tuna|sardines?|trout|haddock|mackerel)\b/i;
const MEAT_WORDS = /\b(?:pork|beef|veal|goat|lamb|mutton|oxtail)\b/i;
const GROUND_WORDS = /\b(?:ground|minced?|burger|sausage|meatballs?)\b/i;
const BAD_PREPARATION = /\b(?:raw|uncooked|undercooked|partially[ -]cooked|part[ -]cooked|half[ -]cooked|par[ -]?cooked|not\s+(?:fully\s+)?cooked)\b/i;

function preparedIngredient(line) {
    // "uncooked", "not cooked" and "cook before serving" are not cooked.
    return !BAD_PREPARATION.test(line) && /\b(?:fully[ -])?cooked\s+(?:chicken|turkey|duck|goose|poultry|fish|saltfish|snapper|salmon|tuna|pork|beef|lamb)\b/i.test(line);
}

function cannedIngredient(line) {
    return !/\b(?:uncanned|not\s+canned|home[ -]canned|raw)\b/i.test(line)
        && /\b(?:canned|can\s+(?:of\s+)?)(?:\s+\w+){0,2}\s*(?:ackee|fish|saltfish|snapper|salmon|tuna|sardines?)\b|\b(?:ackee|fish|salmon|tuna|sardines?)\s*\(?(?:commercially\s+)?canned\b/i.test(line);
}

function hasCookingEndpoint(instructions, fahrenheit, celsius, subject) {
    return instructions.some(step => {
        // A preheated oven, an isolated number, a negated instruction, or an
        // endpoint below the minimum must not count as a food temperature.
        return step.split(/[.;\n]/).some(clause => {
            if (subject && !subject.test(clause) && (POULTRY_WORDS.test(clause) || FISH_WORDS.test(clause) || MEAT_WORDS.test(clause))) return false;
            if (/\b(?:do\s+not|don't|never|no\s+need|need\s+not|below|under|less\s+than|instead\s+of)\b/i.test(clause)) return false;
            if (!/\b(?:reach(?:es)?|reads?|registers?|internal|centre|center|thickest|thermometer|cook\w*\s+(?:until|to)|heat\w*\s+to)\b/i.test(clause)) return false;
            if (/\b(?:oven|preheat|oil|water|pan)\b/i.test(clause) && !/\b(?:internal|thermometer|thickest|centre|center)\b/i.test(clause)) return false;
            const temperatures = [...clause.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)\s*°?\s*([FC])\b/gi)];
            return temperatures.length > 0 && temperatures.every(([, number, unit]) => {
                const n = Number(number);
                // A cooking-appliance temperature is not a food endpoint.
                return unit.toUpperCase() === 'F' ? n >= fahrenheit && n <= 212 : n >= celsius && n <= 100;
            });
        });
    });
}

function hasRest(instructions) {
    return instructions.some(step => /\brest\b/i.test(step)
        && !/\b(?:not|don't|no\s+need|skip|without|less\s+than|under)\b/i.test(step)
        && !/\b[0-2]\s*(?:[-–]|to)\s*\d+\s*min/i.test(step)
        && /\b(?:[3-9]|[1-9]\d+)\s*(?:min(?:ute)?s?)\b/i.test(step));
}

export function safetyIssues(meal) {
    const issues = [];
    const ingredients = meal.ingredients || [];
    const instructions = meal.instructions || [];
    const instructionText = instructions.join('\n');
    for (const line of ingredients) {
        if (/\backee\b/i.test(line) && (!cannedIngredient(line)
            || /\b(?:fresh|raw|unripe)\s+(?:or\s+canned\s+)?ackee\b|\backee\s*\(?(?:fresh|raw|unripe)\b|\bif\s+fresh\b/i.test(line))) {
            issues.push('Ackee must be commercially canned; fresh ackee preparation is not allowed.');
        }
    }
    if (/\b(?:fresh|raw|unripe)\s+ackee\b|\bif\s+fresh\b/i.test(instructionText)
        && /\backee\b/i.test([meal.name, ...ingredients].join(' '))) {
        issues.push('Recipe refers to preparing fresh ackee.');
    }
    // Do not classify fish sauce or chicken stock as raw animal flesh.
    const animalIngredients = ingredients.map(line => line.replace(/\b(?:chicken|turkey|beef|fish|pork)\s+(?:broth|stock|sauce)\b/gi, 'seasoning'));
    const poultry = animalIngredients.filter(line => POULTRY_WORDS.test(line));
    const reheatedPoultry = poultry.length && /\b(?:reheat|bake|roast|fry|cook|heat)\w*\b/i.test(instructionText);
    if ((poultry.some(line => !preparedIngredient(line)) || reheatedPoultry)
        && !hasCookingEndpoint(instructions, 165, 74, POULTRY_WORDS)) {
        issues.push('Raw or reheated poultry must reach 165°F (74°C) in the food; add a clear cooking endpoint.');
    }
    const meat = animalIngredients.filter(line => (MEAT_WORDS.test(line) || (/\bsteak\b/i.test(line) && !FISH_WORDS.test(line))) && !preparedIngredient(line));
    // Unspecified sausage/mince is treated as ground meat, never as a whole cut.
    const ground = meat.some(line => GROUND_WORDS.test(line)) || animalIngredients.some(line => /\b(?:ground\s+meat|minced\s+meat|meatballs?|sausage|burgers?)\b/i.test(line) && !POULTRY_WORDS.test(line) && !/\b(?:plant|vegan|vegetarian|tofu)\b/i.test(line));
    if (ground && !hasCookingEndpoint(instructions, 160, 71, MEAT_WORDS)) {
        issues.push('Ground meat must reach 160°F (71°C); ground poultry needs 165°F (74°C).');
    }
    if (meat.some(line => !GROUND_WORDS.test(line)) && (!hasCookingEndpoint(instructions, 145, 63, MEAT_WORDS) || !hasRest(instructions))) {
        issues.push('Whole meat cuts must reach 145°F (63°C) and rest at least 3 minutes before serving.');
    }
    const rawFish = animalIngredients.some(line => FISH_WORDS.test(line) && !cannedIngredient(line) && !preparedIngredient(line));
    if (rawFish && !hasCookingEndpoint(instructions, 145, 63, FISH_WORDS)) {
        issues.push('Fish must reach 145°F (63°C) in the food; soaking or warming alone is not a cooking endpoint.');
    }
    return [...new Set(issues)];
}

// ── Daily selection & no-repeat meal rotation ──

const SIGNATURE_TERMS = [
    { key: 'ackee',    re: /\backee\b/i },
    { key: 'saltfish', re: /\bsaltfish\b/i },
    { key: 'callaloo', re: /\bcallaloo\b/i },
    { key: 'chicken',  re: /\bchicken\b/i },
    { key: 'turkey',   re: /\bturkey\b/i },
    { key: 'fish',     re: /\b(?:fish|snapper|salmon|tuna|sardines?|parrotfish|mahi|tilapia|cod)\b/i },
    { key: 'tofu',     re: /\btofu\b/i },
    { key: 'eggs',     re: /\begg(?!plant)s?\b/i },
    { key: 'pumpkin',  re: /\bpumpkin\b/i },
    { key: 'beef',     re: /\b(?:beef|oxtail)\b/i },
    { key: 'pork',     re: /\bpork\b/i },
    { key: 'goat',     re: /\bgoat\b/i },
];

export function mealSignatures(meal) {
    if (!meal || typeof meal !== 'object') return [];
    const text = [meal.name || '', ...(meal.tags || []), ...(meal.ingredients || []).slice(0, 3)].join(' ');
    return SIGNATURE_TERMS.filter(t => t.re.test(text)).map(t => t.key);
}

export function mealsConflict(a, b) {
    if (!a || !b) return false;
    if (a === b || (a.id && b.id && a.id === b.id) || (a.name && b.name && a.name === b.name)) return true;
    const sigA = new Set(mealSignatures(a));
    return mealSignatures(b).some(s => sigA.has(s));
}

function signatureOverlapCount(meal, chosenMeals) {
    if (!meal) return 0;
    const sigs = new Set(mealSignatures(meal));
    let count = 0;
    for (const other of chosenMeals) {
        if (!other) continue;
        if (other === meal || (other.id && meal.id && other.id === meal.id) || (other.name && meal.name && other.name === meal.name)) {
            count += 100;
        }
        for (const s of mealSignatures(other)) {
            if (sigs.has(s)) count++;
        }
    }
    return count;
}

export function localDayNumber(date = new Date()) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

export function pickDaily(pool, date = new Date()) {
    if (pool.length === 0) return null;
    return pool[localDayNumber(date) % pool.length];
}

function itemKey(item) {
    return item && typeof item === 'object' ? (item.id ?? item.name ?? item) : item;
}

export function pickDifferent(pool, current, random = Math.random, exclude = []) {
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];
    const currentKey = itemKey(current);
    const excludedKeys = new Set([currentKey, ...Array.from(exclude || [], itemKey)]);
    let candidates = pool.filter(m => !excludedKeys.has(itemKey(m)));
    if (candidates.length === 0) {
        candidates = pool.filter(m => itemKey(m) !== currentKey);
    }
    if (candidates.length === 0) return pool[0];
    return candidates[Math.floor(random() * candidates.length)];
}

function recentLoggedIdsByType(log, date = new Date(), days = 7) {
    const byType = { breakfast: [], lunch: [], dinner: [] };
    if (!Array.isArray(log) || log.length === 0) return byType;
    const cutoff = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (days - 1));
    for (const entry of log) {
        if (!entry || !entry.mealId || entry.mealId.startsWith('custom')) continue;
        const d = new Date(entry.date);
        if (Number.isNaN(d.getTime()) || d < cutoff) continue;
        const key = String(entry.type || '').toLowerCase();
        if (byType[key] && !byType[key].includes(entry.mealId)) {
            byType[key].push(entry.mealId);
        }
    }
    return byType;
}

function pickDayFromPools(dayNum, pools, recentByType) {
    const plan = { breakfast: null, lunch: null, dinner: null };
    const chosen = [];
    for (const type of MEAL_TYPES) {
        const key = type.toLowerCase();
        const pool = pools[key] || [];
        if (pool.length === 0) continue;
        const recent = recentByType[key] || [];
        let best = null;
        let bestScore = Infinity;
        for (let offset = 0; offset < pool.length; offset++) {
            const candidate = pool[((dayNum + offset) % pool.length + pool.length) % pool.length];
            const recentIdx = recent.indexOf(candidate.id);
            const recentPenalty = recentIdx !== -1 ? (200 - recentIdx * 20) : 0;
            const overlapPenalty = signatureOverlapCount(candidate, chosen) * 25;
            const score = recentPenalty + overlapPenalty + offset * 0.01;
            if (score < bestScore) {
                bestScore = score;
                best = candidate;
            }
            if (score < 1) break;
        }
        plan[key] = best;
        chosen.push(best);
    }
    return plan;
}

const SCHEDULE_CYCLE_DAYS = 60;

// Selects a coordinated Breakfast, Lunch and Dinner plan for the given date
// with no duplicate meals or signature protein/ingredient repeats on the same
// day and no repeats within a multi-day sliding window or recent meal log.
export function selectDailyPlan(meals, settings = DEFAULT_SETTINGS, { date = new Date(), log = [] } = {}) {
    const pools = {};
    const windows = {};
    for (const type of MEAL_TYPES) {
        const key = type.toLowerCase();
        pools[key] = filterMeals(meals.filter(m => m.type === type), settings).allowed;
        windows[key] = Math.min(4, Math.max(1, Math.floor(pools[key].length / 2)));
    }

    const recentByType = { breakfast: [], lunch: [], dinner: [] };
    const schedule = new Array(SCHEDULE_CYCLE_DAYS);

    for (let step = -10; step < SCHEDULE_CYCLE_DAYS; step++) {
        const idx = ((step % SCHEDULE_CYCLE_DAYS) + SCHEDULE_CYCLE_DAYS) % SCHEDULE_CYCLE_DAYS;
        const lookahead = {};
        for (const key of ['breakfast', 'lunch', 'dinner']) {
            const wrapIds = [];
            if (step >= SCHEDULE_CYCLE_DAYS - windows[key]) {
                const needed = windows[key] - (SCHEDULE_CYCLE_DAYS - 1 - step);
                for (let w = 0; w < needed; w++) {
                    if (schedule[w]?.[key]) wrapIds.push(schedule[w][key].id);
                }
            }
            lookahead[key] = [...recentByType[key], ...wrapIds];
        }
        const stepPlan = pickDayFromPools(idx, pools, lookahead);
        if (step >= 0) schedule[step] = stepPlan;
        for (const key of ['breakfast', 'lunch', 'dinner']) {
            if (stepPlan[key]) {
                recentByType[key] = [stepPlan[key].id, ...recentByType[key]].slice(0, windows[key]);
            }
        }
    }

    const targetDay = localDayNumber(date);
    const slot = ((targetDay % SCHEDULE_CYCLE_DAYS) + SCHEDULE_CYCLE_DAYS) % SCHEDULE_CYCLE_DAYS;
    const basePlan = schedule[slot];
    const loggedRecent = recentLoggedIdsByType(log, date, 7);

    // If no recently logged meals collide with today's scheduled plan, return it directly.
    const hasLogCollision = ['breakfast', 'lunch', 'dinner'].some(key =>
        basePlan[key] && (loggedRecent[key] || []).includes(basePlan[key].id)
    );
    if (!hasLogCollision) return basePlan;

    const mergedRecent = {};
    for (const key of ['breakfast', 'lunch', 'dinner']) {
        const prevSlotIds = [];
        for (let b = 1; b <= windows[key]; b++) {
            const prevIdx = (slot - b + SCHEDULE_CYCLE_DAYS) % SCHEDULE_CYCLE_DAYS;
            if (schedule[prevIdx]?.[key]) prevSlotIds.push(schedule[prevIdx][key].id);
        }
        const cap = Math.max(0, pools[key].length - 1);
        mergedRecent[key] = [...new Set([...(loggedRecent[key] || []), ...prevSlotIds])].slice(0, cap);
    }
    return pickDayFromPools(slot, pools, mergedRecent);
}

// Shuffles Breakfast, Lunch and Dinner without repeating previously shown meals
// in the current cycle, avoiding recently logged meals, and keeping the three
// meals distinct in signature ingredients/proteins on the same day.
export function shuffleDailyPlan(meals, settings = DEFAULT_SETTINGS, {
    currentPlan = {},
    seenByType = {},
    log = [],
    date = new Date(),
    random = Math.random,
} = {}) {
    const nextPlan = { breakfast: null, lunch: null, dinner: null };
    const nextSeen = { breakfast: [], lunch: [], dinner: [] };
    const loggedRecent = recentLoggedIdsByType(log, date, 7);
    const chosen = [];

    for (const type of MEAL_TYPES) {
        const key = type.toLowerCase();
        const pool = filterMeals(meals.filter(m => m.type === type), settings).allowed;
        if (pool.length === 0) continue;
        if (pool.length === 1) {
            nextPlan[key] = pool[0];
            nextSeen[key] = [pool[0].id];
            chosen.push(pool[0]);
            continue;
        }

        const current = currentPlan[key] || null;
        const currentId = current?.id || null;
        const allowedIds = new Set(pool.map(m => m.id));
        let seen = Array.isArray(seenByType[key]) ? seenByType[key].filter(id => allowedIds.has(id)) : [];
        if (currentId && allowedIds.has(currentId) && !seen.includes(currentId)) {
            seen = [...seen, currentId];
        }

        // If every meal in the pool has already been seen in this cycle, reset
        // the cycle while keeping the currently displayed meal excluded so the
        // shuffle transition itself never repeats the current meal.
        let unseenPool = pool.filter(m => !seen.includes(m.id) && m.id !== currentId);
        if (unseenPool.length === 0) {
            seen = currentId && allowedIds.has(currentId) ? [currentId] : [];
            unseenPool = pool.filter(m => m.id !== currentId);
        }

        const recentSet = new Set(loggedRecent[key] || []);
        const unlogged = unseenPool.filter(m => !recentSet.has(m.id));
        const baseCandidates = unlogged.length > 0 ? unlogged : unseenPool;

        const nonConflicting = baseCandidates.filter(m => signatureOverlapCount(m, chosen) === 0);
        let finalCandidates = nonConflicting;
        if (finalCandidates.length === 0) {
            const minOverlap = Math.min(...baseCandidates.map(m => signatureOverlapCount(m, chosen)));
            finalCandidates = baseCandidates.filter(m => signatureOverlapCount(m, chosen) === minOverlap);
        }

        const picked = finalCandidates[Math.floor(random() * finalCandidates.length)];
        nextPlan[key] = picked;
        nextSeen[key] = [...new Set([...seen, picked.id])];
        chosen.push(picked);
    }

    return { plan: nextPlan, seenByType: nextSeen };
}

// ── Meal log ──

export const MAX_LOG_ENTRIES = 2000;

export function normalizeLogEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const date = new Date(raw.date);
    const name = cleanString(raw.name, 100);
    if (!name || Number.isNaN(date.getTime())) return null;
    return {
        id: Number.isFinite(raw.id) ? raw.id : date.getTime(),
        mealId: cleanString(raw.mealId, 40) || 'custom',
        name,
        type: LOG_TYPES.includes(raw.type) ? raw.type : 'Snack',
        notes: cleanString(raw.notes, 1000),
        date: date.toISOString(),
    };
}

export function localDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function isMealLoggedOnDate(log, meal, date = new Date()) {
    if (!meal || !Array.isArray(log) || log.length === 0) return false;
    const targetDay = localDateKey(date);
    const mealId = cleanString(meal.id, 40);
    const isCustom = !mealId || mealId.startsWith('custom');
    return log.some(entry => {
        if (!entry) return false;
        const entryDate = new Date(entry.date);
        if (Number.isNaN(entryDate.getTime()) || localDateKey(entryDate) !== targetDay) return false;
        if (!isCustom && entry.mealId === mealId) return true;
        return entry.name === meal.name && entry.type === meal.type;
    });
}

// Consecutive local calendar days, ending today, with at least one entry.
export function streakDays(log, now = new Date()) {
    const days = new Set(log.map(e => localDateKey(new Date(e.date))));
    let streak = 0;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    while (days.has(localDateKey(d))) {
        streak++;
        d.setDate(d.getDate() - 1);
    }
    return streak;
}

export function countLast7Days(log, now = new Date()) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return log.filter(e => new Date(e.date) >= start).length;
}

// ── CSV export ──

// Quotes every cell, doubles embedded quotes, and neutralises values that
// spreadsheet software would treat as formulas.
export function csvCell(value) {
    let s = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
}

export function logToCsv(log) {
    const header = ['Timestamp (UTC)', 'Local date', 'Local time', 'Meal', 'Type', 'Notes', 'Meal ID'];
    const rows = log.map(e => {
        const d = new Date(e.date);
        return [
            d.toISOString(),
            localDateKey(d),
            `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
            e.name,
            e.type,
            e.notes || '',
            e.mealId,
        ];
    });
    return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// ── Built-in dataset fallback ──
// Keeps the app usable immediately on startup and when meals.json cannot be fetched.
export const BUILT_IN_MEALS = Object.freeze([
    {
        "id": "BF001",
        "name": "Jamaican Ackee & Scrambled Eggs",
        "type": "Breakfast",
        "prepTime": "15-20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 cup canned ackee, drained",
            "2 eggs",
            "1/4 bell pepper, diced",
            "1 scallion, chopped",
            "1 tsp olive oil",
            "Pinch of black pepper"
        ],
        "instructions": [
            "Heat olive oil in pan",
            "Sauté bell pepper and scallion 2 min",
            "Gently fold in the drained canned ackee and heat through for 2–3 min",
            "Push to the side and scramble the eggs until firm",
            "Mix together, season with pepper"
        ],
        "tags": [
            "Jamaican",
            "Eggs",
            "Vegetarian"
        ],
        "safetyNotes": [
            "Use commercially canned ackee only. Unripe or incorrectly prepared ackee contains a toxin (hypoglycin) that cooking does not destroy, so don't prepare fresh ackee unless you have been trained to do so safely."
        ],
        "nutrition": null
    },
    {
        "id": "BF002",
        "name": "Callaloo, Black Bean & Sweet Potato Hash",
        "type": "Breakfast",
        "prepTime": "15-20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "2 cups callaloo, chopped",
            "1/2 cup cooked black beans, rinsed and drained",
            "1/2 small sweet potato, diced",
            "1/4 onion, diced",
            "1 garlic clove, minced",
            "1 tbsp pumpkin seeds",
            "1 tsp olive oil",
            "1/4 tsp thyme"
        ],
        "instructions": [
            "Steam diced sweet potato 8–10 min until fork-tender",
            "Heat olive oil in a skillet and sauté onion and garlic for 2 min",
            "Add callaloo and black beans, cooking 4–5 min until greens are tender",
            "Fold in sweet potato, season with thyme, and top with pumpkin seeds"
        ],
        "tags": [
            "Jamaican",
            "Vegan",
            "High-fiber"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "BF003",
        "name": "Spiced Almond Chia & Berry Pudding",
        "type": "Breakfast",
        "prepTime": "10 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1/4 cup chia seeds",
            "3/4 cup unsweetened almond milk",
            "1/4 cup plain Greek yogurt",
            "1/3 cup fresh mixed berries",
            "1 tbsp chopped walnuts",
            "1 tsp vanilla extract",
            "Pinch of nutmeg and cinnamon"
        ],
        "instructions": [
            "Whisk chia seeds with unsweetened almond milk, vanilla, nutmeg and cinnamon",
            "Refrigerate at least 2 hours or overnight until thick",
            "Stir in plain Greek yogurt before serving",
            "Top with fresh berries and chopped walnuts"
        ],
        "tags": [
            "Vegetarian",
            "Make-ahead",
            "High-fiber"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "BF004",
        "name": "Jerk Spiced Tofu Scramble",
        "type": "Breakfast",
        "prepTime": "15-20 min",
        "servings": 2,
        "difficulty": "Easy",
        "ingredients": [
            "1 block firm tofu, crumbled",
            "1 tsp jerk seasoning",
            "1/4 bell pepper, diced",
            "2 mushrooms, sliced",
            "1 tsp olive oil",
            "1 tbsp nutritional yeast"
        ],
        "instructions": [
            "Press tofu to remove excess water",
            "Heat oil, sauté vegetables",
            "Add tofu and jerk seasoning",
            "Cook 8-10 min until golden",
            "Stir in nutritional yeast"
        ],
        "tags": [
            "Vegan",
            "Tofu"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "BF005",
        "name": "Green Banana, Flax & Walnut Porridge",
        "type": "Breakfast",
        "prepTime": "15-20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 small green banana, grated",
            "1 cup unsweetened soy or almond milk",
            "2 tbsp hemp seeds",
            "1 tbsp ground flaxseed",
            "1 tbsp chopped walnuts",
            "1/2 tsp cinnamon",
            "1 tsp vanilla extract",
            "Pinch of salt"
        ],
        "instructions": [
            "Finely grate the green banana",
            "Bring milk to a gentle simmer in a small pot",
            "Whisk in grated green banana and cook 8–10 min, stirring constantly",
            "Stir in cinnamon, vanilla, ground flaxseed and hemp seeds until thickened",
            "Top with chopped walnuts and serve warm"
        ],
        "tags": [
            "Jamaican",
            "Vegan"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "BF006",
        "name": "Protein Pumpkin & Almond Pancakes",
        "type": "Breakfast",
        "prepTime": "15-20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1/2 cup pumpkin puree",
            "2 eggs",
            "1/4 cup almond flour",
            "1 tbsp ground flaxseed",
            "1 tsp baking powder",
            "1/2 tsp cinnamon",
            "1 tsp olive oil"
        ],
        "instructions": [
            "Whisk pumpkin puree, eggs, almond flour, flaxseed, baking powder and cinnamon in a bowl",
            "Heat olive oil in a non-stick pan over medium heat",
            "Pour batter and cook about 3 min per side until golden and set in the centre",
            "Serve warm"
        ],
        "tags": [
            "Vegetarian",
            "Eggs"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "BF007",
        "name": "Jamaican Ackee, Green Banana & Black Bean Bowl",
        "type": "Breakfast",
        "prepTime": "15-20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1/2 cup canned ackee, drained",
            "1/2 cup cooked black beans, rinsed",
            "1 small green banana, boiled and sliced",
            "1 cup steamed spinach or cabbage",
            "1/4 avocado, sliced",
            "1 tsp olive oil",
            "Pinch of black pepper"
        ],
        "instructions": [
            "Boil green banana until tender and steam the greens for 3 min",
            "Gently heat the drained canned ackee and black beans in a pan for 2–3 min",
            "Arrange on a plate with sliced avocado and greens",
            "Drizzle with olive oil and season with black pepper"
        ],
        "tags": [
            "Jamaican",
            "Vegan"
        ],
        "safetyNotes": [
            "Use commercially canned ackee only. Unripe or incorrectly prepared ackee contains a toxin (hypoglycin) that cooking does not destroy, so don't prepare fresh ackee unless you have been trained to do so safely."
        ],
        "nutrition": null
    },
    {
        "id": "BF008",
        "name": "Avocado & Saltfish on Whole-Grain Toast",
        "type": "Breakfast",
        "prepTime": "15-20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 slice whole grain bread",
            "1/4 avocado, mashed",
            "1/4 cup saltfish, soaked overnight (or boiled 15–20 min), rinsed and flaked",
            "1 tsp lime juice",
            "1 tomato slice",
            "Black pepper"
        ],
        "instructions": [
            "After desalting according to the product instructions, cook the saltfish until a food thermometer reads 145°F (63°C) in the thickest part; then flake it.",
            "Toast bread",
            "Mix avocado with lime juice",
            "Spread on toast",
            "Top with the flaked saltfish and tomato",
            "Season with pepper"
        ],
        "tags": [
            "Jamaican",
            "Fish"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "BF009",
        "name": "Greek Yogurt, Papaya & Walnut Parfait",
        "type": "Breakfast",
        "prepTime": "5 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "3/4 cup plain Greek yogurt",
            "1/4 cup papaya cubes",
            "1/4 cup fresh berries",
            "2 tbsp chopped walnuts or almonds",
            "1 tbsp chia seeds",
            "1/4 tsp cinnamon"
        ],
        "instructions": [
            "Layer plain Greek yogurt, papaya cubes and berries in a bowl or glass",
            "Top with chopped nuts and chia seeds",
            "Dust lightly with cinnamon and serve"
        ],
        "tags": [
            "Vegetarian",
            "No-cook"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "BF010",
        "name": "Jamaican Spiced Oat & Flax Porridge",
        "type": "Breakfast",
        "prepTime": "15 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1/3 cup rolled oats",
            "1 cup unsweetened soy or almond milk",
            "1 tbsp ground flaxseed",
            "1 tbsp chia seeds",
            "1 tbsp chopped almonds",
            "1 cinnamon stick",
            "1/4 tsp nutmeg",
            "1 tsp vanilla extract"
        ],
        "instructions": [
            "Combine rolled oats, milk and cinnamon stick in a small pot",
            "Bring to a gentle boil, then simmer 8–10 min, stirring occasionally",
            "Remove cinnamon stick and stir in flaxseed, chia seeds, nutmeg and vanilla",
            "Top with chopped almonds and serve warm"
        ],
        "tags": [
            "Jamaican",
            "Vegan",
            "High-fiber"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "LH001",
        "name": "Ackee & Saltfish Salad",
        "type": "Lunch",
        "prepTime": "15-20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 cup canned ackee, drained",
            "½ cup saltfish (soaked overnight, flaked)",
            "2 cups mixed greens",
            "¼ avocado, sliced",
            "½ cucumber, diced",
            "1 tbsp olive oil",
            "1 tbsp lemon juice",
            "1 garlic clove, minced",
            "Black pepper to taste",
            "1 scallion, chopped"
        ],
        "instructions": [
            "Drain the canned ackee gently so it keeps its shape.",
            "Desalt the saltfish according to the product instructions, then cook until a food thermometer in the thickest part reads 145°F (63°C). Rinse as directed and flake; soaking alone does not cook fish.",
            "In a bowl, combine greens, cucumber, avocado.",
            "Heat olive oil in pan, sauté garlic 30 sec, add ackee and saltfish, warm through (2-3 min).",
            "Place ackee-saltfish mix over greens.",
            "Whisk lemon juice, olive oil, pepper for dressing, drizzle.",
            "Garnish with scallion."
        ],
        "tags": [
            "Jamaican",
            "Fish"
        ],
        "safetyNotes": [
            "Use commercially canned ackee only. Unripe or incorrectly prepared ackee contains a toxin (hypoglycin) that cooking does not destroy, so don't prepare fresh ackee unless you have been trained to do so safely."
        ],
        "nutrition": null
    },
    {
        "id": "LH002",
        "name": "Chicken & Callaloo Egg Muffins",
        "type": "Lunch",
        "prepTime": "25 min",
        "servings": 2,
        "difficulty": "Easy",
        "ingredients": [
            "2 eggs",
            "½ cup cooked chicken, shredded (cooked to 165°F / 74°C)",
            "1 cup callaloo (or spinach), chopped",
            "¼ bell pepper, diced",
            "1 scallion, chopped",
            "2 tbsp unsweetened almond milk",
            "¼ tsp turmeric",
            "Pinch of black pepper",
            "Olive oil spray"
        ],
        "instructions": [
            "Preheat oven to 350°F (175°C).",
            "Whisk eggs with unsweetened almond milk, turmeric, pepper.",
            "Stir in chicken, callaloo, bell pepper, scallion.",
            "Spray muffin tin with olive oil.",
            "Pour mixture into 6 muffin cups.",
            "Bake 18–20 min until set and a thermometer in the centre reads 165°F (74°C).",
            "Cool 5 min before removing."
        ],
        "tags": [
            "Chicken",
            "Eggs",
            "Make-ahead"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "LH003",
        "name": "Sardine & Vegetable Skillet",
        "type": "Lunch",
        "prepTime": "15-20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 can sardines in olive oil",
            "1 cup mixed vegetables (zucchini, bell pepper, onion)",
            "1 tsp Jamaican seasoning",
            "1 garlic clove, minced",
            "1 tbsp olive oil",
            "1 tsp lime juice",
            "½ tsp thyme",
            "Black pepper"
        ],
        "instructions": [
            "Heat olive oil in large skillet.",
            "Sauté garlic and vegetables 5-7 min until tender.",
            "Add sardines with their oil, break into chunks.",
            "Season with Jamaican seasoning, thyme, pepper.",
            "Cook 3-4 min until heated through.",
            "Drizzle with lime juice before serving."
        ],
        "tags": [
            "Fish",
            "Quick"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "LH004",
        "name": "Jerk Chicken & Cabbage Stir-fry",
        "type": "Lunch",
        "prepTime": "15-20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 chicken breast, sliced",
            "2 cups cabbage, shredded",
            "1 carrot, julienned",
            "1 tbsp jerk seasoning",
            "1 tbsp olive oil",
            "1 garlic clove, minced",
            "1 tsp ginger, grated",
            "2 tbsp water"
        ],
        "instructions": [
            "Season chicken with jerk seasoning.",
            "Heat oil in wok or large pan.",
            "Stir-fry chicken 5–6 min until no longer pink and it reaches 165°F (74°C).",
            "Remove chicken, add more oil if needed.",
            "Stir-fry cabbage and carrot 3-4 min.",
            "Return chicken to pan, add water, cook 2 min.",
            "Serve hot."
        ],
        "tags": [
            "Jamaican",
            "Chicken"
        ],
        "safetyNotes": [
            "Check poultry with a food thermometer: it is safe at 165°F (74°C) in the thickest part."
        ],
        "nutrition": null
    },
    {
        "id": "LH005",
        "name": "Ackee & Tofu Scramble",
        "type": "Lunch",
        "prepTime": "15-20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 cup canned ackee, drained",
            "½ block firm tofu",
            "¼ onion, diced",
            "1 tomato, diced",
            "1 tsp turmeric",
            "1 tbsp olive oil",
            "1 tsp thyme",
            "Black pepper"
        ],
        "instructions": [
            "Press tofu to remove excess water, crumble.",
            "Heat oil, sauté onion until translucent.",
            "Add tomato, cook 2 min.",
            "Add ackee and tofu, gently stir.",
            "Season with turmeric, thyme, pepper.",
            "Cook 5-7 min until heated through."
        ],
        "tags": [
            "Jamaican",
            "Vegan"
        ],
        "safetyNotes": [
            "Use commercially canned ackee only. Unripe or incorrectly prepared ackee contains a toxin (hypoglycin) that cooking does not destroy, so don't prepare fresh ackee unless you have been trained to do so safely."
        ],
        "nutrition": null
    },
    {
        "id": "LH006",
        "name": "Callaloo & Egg White Frittata",
        "type": "Lunch",
        "prepTime": "20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "4 egg whites",
            "1 cup callaloo, chopped",
            "¼ bell pepper, diced",
            "1 tbsp nutritional yeast",
            "1 tsp olive oil",
            "Pinch of black pepper",
            "1 garlic clove, minced"
        ],
        "instructions": [
            "Preheat oven to 375°F (190°C).",
            "Sauté callaloo, bell pepper, garlic in oil 3 min.",
            "Whisk egg whites with nutritional yeast, pepper.",
            "Pour over vegetables in oven-safe dish.",
            "Bake 12–15 min until set and the centre reads 160°F (71°C).",
            "Let cool 5 min before slicing."
        ],
        "tags": [
            "Vegetarian",
            "Eggs"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "LH007",
        "name": "Protein Power Bowl: Beans & Greens",
        "type": "Lunch",
        "prepTime": "10 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "½ cup black beans, cooked",
            "2 cups mixed greens",
            "¼ avocado, diced",
            "¼ cup corn kernels",
            "1 tbsp pumpkin seeds",
            "1 tbsp olive oil",
            "1 tbsp lime juice",
            "½ tsp cumin"
        ],
        "instructions": [
            "Arrange greens in bowl.",
            "Top with beans, corn, avocado.",
            "Sprinkle pumpkin seeds.",
            "Whisk olive oil, lime juice, cumin for dressing.",
            "Drizzle over bowl."
        ],
        "tags": [
            "Vegan",
            "No-cook"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "LH008",
        "name": "Green Protein & Berry Smoothie Bowl",
        "type": "Lunch",
        "prepTime": "10 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 cup spinach",
            "¼ avocado, diced",
            "½ cup plain Greek yogurt",
            "½ cup unsweetened almond milk",
            "1 scoop protein powder",
            "1 tbsp chia seeds",
            "1 tbsp pumpkin seeds",
            "½ cup mixed berries"
        ],
        "instructions": [
            "Blend spinach, avocado, Greek yogurt, almond milk and protein powder until thick and smooth.",
            "Pour into a bowl.",
            "Top with mixed berries, chia seeds and pumpkin seeds.",
            "Enjoy immediately."
        ],
        "tags": [
            "Vegetarian",
            "No-cook"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "LH009",
        "name": "Jamaican Chicken Salad Wrap",
        "type": "Lunch",
        "prepTime": "15 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 whole grain tortilla",
            "½ cup cooked chicken, shredded (cooked to 165°F / 74°C and chilled)",
            "1 cup mixed greens",
            "¼ avocado, sliced",
            "2 tbsp Greek yogurt",
            "1 tsp jerk seasoning",
            "1 tsp lime juice"
        ],
        "instructions": [
            "Mix chicken with jerk seasoning and lime juice.",
            "Warm tortilla if desired.",
            "Spread Greek yogurt on tortilla.",
            "Layer greens, chicken, avocado.",
            "Roll tightly and slice."
        ],
        "tags": [
            "Jamaican",
            "Chicken"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "LH010",
        "name": "Pumpkin & Red Lentil Soup",
        "type": "Lunch",
        "prepTime": "30 min",
        "servings": 2,
        "difficulty": "Easy",
        "ingredients": [
            "2 cups pumpkin, cubed",
            "½ cup red lentils",
            "1 carrot, diced",
            "1 celery stalk, diced",
            "1 onion, diced",
            "2 cups vegetable broth",
            "1 tsp thyme",
            "1 tsp turmeric"
        ],
        "instructions": [
            "Sauté onion, carrot, celery in pot 5 min.",
            "Add pumpkin, lentils, broth, and spices.",
            "Bring to boil, then simmer 20-25 min.",
            "Blend partially for creamier texture.",
            "Season to taste."
        ],
        "tags": [
            "Vegan",
            "Make-ahead"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "LH011",
        "name": "Steamed Fish with Okra & Pumpkin",
        "type": "Lunch",
        "prepTime": "25 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 snapper fillet (about 6 oz / 170 g)",
            "6 okras, sliced",
            "1 cup pumpkin, cubed",
            "2 scallions",
            "Thyme, scotch bonnet",
            "Salt, black pepper"
        ],
        "instructions": [
            "Season fish with salt and thyme",
            "Place in pot with okra and pumpkin",
            "Add scallion and scotch bonnet",
            "Steam over medium heat 15–20 min until a food thermometer in the thickest part of the fish reads 145°F (63°C)"
        ],
        "tags": [
            "Jamaican",
            "Fish"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "LH012",
        "name": "Jerk Chicken over Spinach Salad",
        "type": "Lunch",
        "prepTime": "20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 chicken breast",
            "2 tbsp jerk seasoning",
            "3 cups spinach",
            "1/2 avocado",
            "Cherry tomatoes",
            "Lime juice and olive oil"
        ],
        "instructions": [
            "Coat chicken with jerk seasoning",
            "Grill or pan-fry about 6 min per side until it reaches 165°F (74°C) in the thickest part",
            "Slice and place over spinach",
            "Add avocado and tomatoes",
            "Dress with lime juice and olive oil"
        ],
        "tags": [
            "Jamaican",
            "Chicken"
        ],
        "safetyNotes": [
            "Check poultry with a food thermometer: it is safe at 165°F (74°C) in the thickest part."
        ],
        "nutrition": null
    },
    {
        "id": "LH013",
        "name": "Curried Chickpea & Callaloo",
        "type": "Lunch",
        "prepTime": "15 min",
        "servings": 2,
        "difficulty": "Easy",
        "ingredients": [
            "1 can chickpeas, drained and rinsed",
            "2 cups callaloo",
            "1 tbsp curry powder",
            "1/4 onion",
            "1 garlic clove",
            "1 tsp olive oil"
        ],
        "instructions": [
            "Sauté onion and garlic in olive oil",
            "Add curry powder, toast 1 min",
            "Add chickpeas, coat well",
            "Add callaloo, cook 5 min",
            "Season and serve"
        ],
        "tags": [
            "Jamaican",
            "Vegan"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "DN001",
        "name": "Jamaican Salmon with Pumpkin & Greens",
        "type": "Dinner",
        "prepTime": "25 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 salmon fillet (150-200g)",
            "½ cup pumpkin, cubed",
            "1 cup bok choy or callaloo",
            "½ cup green beans",
            "1 tsp olive oil",
            "1 tsp Jamaican jerk seasoning (low-sodium)",
            "1 garlic clove, minced",
            "½ tsp thyme",
            "½ lemon wedge",
            "Pinch of black pepper"
        ],
        "instructions": [
            "Preheat oven to 400°F (200°C).",
            "Rub salmon with jerk seasoning, thyme, black pepper.",
            "Place salmon on a baking sheet and bake 12–15 min until it flakes easily and reaches 145°F (63°C).",
            "Steam pumpkin cubes 10-12 min until tender.",
            "Heat olive oil in pan, sauté garlic 30 sec, add bok choy and green beans, cook 4-5 min until vibrant.",
            "Plate salmon with pumpkin and greens.",
            "Squeeze lemon over everything."
        ],
        "tags": [
            "Jamaican",
            "Fish"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "DN002",
        "name": "Tuna & Avocado Stuffed Sweet Potato",
        "type": "Dinner",
        "prepTime": "50 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 medium sweet potato",
            "1 can tuna in water, drained",
            "¼ avocado, mashed",
            "1 tbsp Greek yogurt",
            "1 tsp lime juice",
            "½ tsp paprika",
            "1 scallion, chopped",
            "Black pepper"
        ],
        "instructions": [
            "Bake sweet potato at 400°F (200°C) for 45–50 min until tender.",
            "Let cool slightly, then slice open.",
            "Mix tuna with avocado, Greek yogurt, lime juice, paprika.",
            "Stuff sweet potato with tuna mixture.",
            "Garnish with scallion and pepper."
        ],
        "tags": [
            "Fish"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "DN003",
        "name": "Jamaican Curry Chicken with Steamed Cabbage",
        "type": "Dinner",
        "prepTime": "25 min",
        "servings": 2,
        "difficulty": "Easy",
        "ingredients": [
            "2 skinless chicken breasts, cubed",
            "2 cups cabbage, shredded",
            "1/2 bell pepper, sliced",
            "1 tbsp Jamaican curry powder",
            "1 onion, diced",
            "2 garlic cloves, minced",
            "1 tsp fresh ginger, grated",
            "1 tsp thyme",
            "1 tbsp olive oil",
            "1/2 cup water"
        ],
        "instructions": [
            "Season cubed chicken with curry powder, thyme, garlic and ginger.",
            "Heat olive oil in a skillet and brown the chicken with onion for 4–5 min.",
            "Add water, cover and simmer 10–12 min until a food thermometer in the thickest piece of chicken reads 165°F (74°C).",
            "Stir in shredded cabbage and sliced bell pepper and steam 4–5 min until tender-crisp.",
            "Serve hot."
        ],
        "tags": [
            "Jamaican",
            "Chicken"
        ],
        "safetyNotes": [
            "Check poultry with a food thermometer: it is safe at 165°F (74°C) in the thickest part."
        ],
        "nutrition": null
    },
    {
        "id": "DN004",
        "name": "Curry Goat with Cauliflower Rice",
        "type": "Dinner",
        "prepTime": "2 hr",
        "servings": 3,
        "difficulty": "Easy",
        "ingredients": [
            "1 lb goat meat, trimmed",
            "2 tbsp curry powder",
            "1 onion, sliced",
            "2 garlic cloves, minced",
            "1 tsp ginger, grated",
            "1 cup cauliflower rice",
            "1 cup water",
            "1 tbsp olive oil",
            "1 tsp thyme"
        ],
        "instructions": [
            "Marinate goat meat with curry powder 30 min.",
            "Heat oil, brown meat on all sides.",
            "Add onion, garlic, ginger, sauté 5 min.",
            "Add water and simmer 1.5–2 hours until the meat is very tender and a food thermometer in the thickest part reads at least 160°F (71°C).",
            "Let the meat rest for at least 3 minutes before serving.",
            "Serve over cauliflower rice."
        ],
        "tags": [
            "Jamaican",
            "Goat"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "DN005",
        "name": "Steamed Fish with Cho-Cho & Carrots",
        "type": "Dinner",
        "prepTime": "25 min",
        "servings": 2,
        "difficulty": "Easy",
        "ingredients": [
            "2 fish fillets (snapper or mahi mahi)",
            "1 cho-cho, sliced",
            "1 carrot, sliced",
            "1 bell pepper, sliced",
            "1 tsp olive oil",
            "1 tsp Jamaican seasoning",
            "1 garlic clove, minced",
            "½ cup water",
            "1 tsp thyme"
        ],
        "instructions": [
            "Season fish with Jamaican seasoning.",
            "Arrange vegetables in steamer basket.",
            "Place fish on top.",
            "Steam 15–20 min until a food thermometer in the thickest part of the fish reads 145°F (63°C).",
            "Drizzle with olive oil before serving."
        ],
        "tags": [
            "Jamaican",
            "Fish"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "DN006",
        "name": "Oven-Roasted Chicken with Root Vegetables",
        "type": "Dinner",
        "prepTime": "45 min",
        "servings": 2,
        "difficulty": "Easy",
        "ingredients": [
            "2 chicken thighs, skinless",
            "1 sweet potato, cubed",
            "1 carrot, sliced",
            "1 onion, quartered",
            "2 tbsp olive oil",
            "1 tbsp jerk seasoning",
            "1 tsp rosemary",
            "Black pepper"
        ],
        "instructions": [
            "Preheat oven to 400°F (200°C).",
            "Toss vegetables with oil and seasoning.",
            "Arrange chicken and vegetables on baking sheet.",
            "Roast 35–40 min until the chicken reaches 165°F (74°C) in the thickest part.",
            "Serve hot."
        ],
        "tags": [
            "Jamaican",
            "Chicken"
        ],
        "safetyNotes": [
            "Check poultry with a food thermometer: it is safe at 165°F (74°C) in the thickest part."
        ],
        "nutrition": null
    },
    {
        "id": "DN007",
        "name": "Stuffed Bell Peppers with Ground Turkey",
        "type": "Dinner",
        "prepTime": "40 min",
        "servings": 2,
        "difficulty": "Easy",
        "ingredients": [
            "2 bell peppers, halved",
            "½ lb ground turkey",
            "½ cup cauliflower rice",
            "¼ onion, diced",
            "1 garlic clove, minced",
            "1 tsp Jamaican seasoning",
            "½ cup tomato sauce",
            "1 tbsp olive oil"
        ],
        "instructions": [
            "Preheat oven to 375°F (190°C).",
            "Sauté turkey, onion and garlic until no pink remains and the turkey reaches 165°F (74°C).",
            "Mix with cauliflower rice and tomato sauce.",
            "Stuff bell pepper halves.",
            "Bake 25-30 min until peppers are tender."
        ],
        "tags": [
            "Turkey"
        ],
        "safetyNotes": [
            "Check poultry with a food thermometer: it is safe at 165°F (74°C) in the thickest part."
        ],
        "nutrition": null
    },
    {
        "id": "DN008",
        "name": "Jerk Pork with Roasted Vegetables",
        "type": "Dinner",
        "prepTime": "40 min",
        "servings": 3,
        "difficulty": "Easy",
        "ingredients": [
            "1 lb (450 g) pork loin, trimmed",
            "2 tbsp jerk marinade",
            "2 cups mixed vegetables (carrots, zucchini, onion)",
            "1 tbsp olive oil",
            "1 tsp thyme",
            "1 garlic clove, minced"
        ],
        "instructions": [
            "Marinate pork in jerk marinade 1 hour.",
            "Preheat oven to 400°F (200°C).",
            "Roast pork 25–30 min until it reaches 145°F (63°C) in the centre.",
            "Toss vegetables with oil and thyme, roast alongside.",
            "Rest pork at least 3 min before slicing."
        ],
        "tags": [
            "Jamaican",
            "Pork"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "DN009",
        "name": "Callaloo & Saltfish Patties",
        "type": "Dinner",
        "prepTime": "25 min",
        "servings": 2,
        "difficulty": "Easy",
        "ingredients": [
            "2 cups callaloo, chopped",
            "½ cup saltfish, soaked overnight (or boiled 15–20 min), rinsed and flaked",
            "1 egg",
            "2 tbsp almond flour",
            "1 tbsp olive oil",
            "1 tsp thyme",
            "Black pepper",
            "1 scallion, chopped"
        ],
        "instructions": [
            "Steam callaloo until wilted, squeeze out excess water.",
            "Mix with saltfish, egg, almond flour, thyme, scallion.",
            "Form into patties.",
            "Heat oil and cook patties 3–4 min per side until golden and firm in the centre (160°F / 71°C).",
            "Drain on paper towels."
        ],
        "tags": [
            "Jamaican",
            "Fish"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "DN010",
        "name": "Jamaican Oxtail Stew (Lean)",
        "type": "Dinner",
        "prepTime": "3 hr",
        "servings": 3,
        "difficulty": "Easy",
        "ingredients": [
            "1 lb oxtail, trimmed of fat",
            "1 onion, chopped",
            "2 carrots, chopped",
            "2 garlic cloves, minced",
            "2 cups beef broth (low-sodium)",
            "1 tbsp browning sauce",
            "1 tsp thyme",
            "2 pimento berries",
            "1 scotch bonnet pepper (whole)"
        ],
        "instructions": [
            "Brown oxtail in pot.",
            "Add onion, carrots, garlic, sauté 5 min.",
            "Add broth, browning sauce, thyme, pimento, scotch bonnet.",
            "Simmer 2.5–3 hours until the meat is very tender and a food thermometer in the thickest part reads at least 160°F (71°C).",
            "Let the meat rest for at least 3 minutes before serving.",
            "Remove scotch bonnet before serving."
        ],
        "tags": [
            "Jamaican",
            "Beef"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "DN011",
        "name": "Grilled Snapper with Steamed Veg",
        "type": "Dinner",
        "prepTime": "30 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 snapper fillet",
            "Broccoli florets",
            "Sliced carrots",
            "Lemon juice",
            "Olive oil, garlic",
            "Fresh thyme"
        ],
        "instructions": [
            "Marinate fillet in lemon, garlic and thyme",
            "Grill about 5 min per side until opaque and it reaches 145°F (63°C)",
            "Steam broccoli and carrots 8 min",
            "Plate with a drizzle of olive oil"
        ],
        "tags": [
            "Fish"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "DN012",
        "name": "Jamaican Brown Stew Tofu",
        "type": "Dinner",
        "prepTime": "25 min",
        "servings": 2,
        "difficulty": "Medium",
        "ingredients": [
            "1 block firm tofu, cubed",
            "1 cup broccoli florets",
            "1/2 bell pepper, sliced",
            "1 carrot, sliced",
            "1 tbsp browning",
            "1 onion, sliced",
            "2 garlic cloves",
            "Pimento berries, thyme",
            "1 tbsp low-sodium soy sauce"
        ],
        "instructions": [
            "Press and cube tofu, pat dry",
            "Brown in oil until golden",
            "Add onion, garlic, bell pepper, carrot and pimento",
            "Stir in browning and low-sodium soy sauce",
            "Add broccoli and simmer in 1/4 cup water 8–10 min until vegetables are tender-crisp"
        ],
        "tags": [
            "Jamaican",
            "Vegan",
            "Tofu"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "DN013",
        "name": "Herb-Crusted Turkey Breast",
        "type": "Dinner",
        "prepTime": "45 min",
        "servings": 3,
        "difficulty": "Medium",
        "ingredients": [
            "1 boneless turkey breast (about 1 lb / 450 g)",
            "2 cups green beans, trimmed",
            "Fresh rosemary and thyme",
            "3 garlic cloves, minced",
            "1 tbsp olive oil",
            "1 lemon wedge",
            "Salt and black pepper"
        ],
        "instructions": [
            "Preheat oven to 375°F (190°C)",
            "Mix herbs, garlic and oil into a paste",
            "Rub all over the turkey breast",
            "Roast until the thickest part reaches 165°F (74°C), about 30–40 min for a 1 lb breast (longer for larger cuts), steaming the green beans for the last 6–8 min",
            "Rest 5 min before slicing and serve with steamed green beans and lemon"
        ],
        "tags": [
            "Turkey"
        ],
        "safetyNotes": [
            "Check poultry with a food thermometer: it is safe at 165°F (74°C) in the thickest part."
        ],
        "nutrition": null
    }
]);
