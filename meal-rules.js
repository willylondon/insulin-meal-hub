// Insulin-Smart Meal Hub — shared meal rules
// Pure functions used by the browser app (app.js), the AI endpoint
// (api/generate-meal.js) and the test suite. No DOM access here.

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];
export const LOG_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export const PROTEINS = [
    { id: 'chicken',  label: 'Chicken',   icon: '🍗', keywords: ['chicken'] },
    { id: 'fish',     label: 'Fish',      icon: '🐟', keywords: ['fish', 'snapper', 'tilapia', 'cod', 'saltfish', 'mahi', 'parrotfish'] },
    { id: 'eggs',     label: 'Eggs',      icon: '🥚', keywords: ['egg'] },
    { id: 'tuna',     label: 'Tuna',      icon: '🫙', keywords: ['tuna'] },
    { id: 'sardines', label: 'Sardines',  icon: '🐡', keywords: ['sardine'] },
    { id: 'salmon',   label: 'Salmon',    icon: '🍣', keywords: ['salmon'] },
    { id: 'shrimp',   label: 'Shrimp',    icon: '🦐', keywords: ['shrimp', 'prawn'] },
    { id: 'turkey',   label: 'Turkey',    icon: '🦃', keywords: ['turkey'] },
    { id: 'tofu',     label: 'Tofu',      icon: '🧆', keywords: ['tofu'] },
    { id: 'beef',     label: 'Beef',      icon: '🥩', keywords: ['beef', 'steak', 'mince'] },
    { id: 'ackee',    label: 'Ackee',     icon: '🍳', keywords: ['ackee'] },
    { id: 'chickpea', label: 'Chickpeas', icon: '🫘', keywords: ['chickpea'] },
];
export const PROTEIN_IDS = PROTEINS.map(p => p.id);

// One definition of each carb level, shared by the settings UI, the
// curated-meal filter and the AI prompt/validator. Grams of carbohydrate
// per serving.
export const CARB_LEVELS = {
    low:      { max: 30, label: 'Under 30g' },
    moderate: { max: 50, label: '30–50g' },
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
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

// Nutrition is only trusted when it is structured, numeric and marked as
// reviewed. Anything else is treated as unknown.
export function normalizeNutrition(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const n = {
        calories: finiteInRange(raw.calories, 0, 3000),
        protein: finiteInRange(raw.protein, 0, 300),
        carbs: finiteInRange(raw.carbs, 0, 400),
        fiber: finiteInRange(raw.fiber, 0, 100),
    };
    if (Object.values(n).some(v => v === null)) return null;
    return {
        ...n,
        verified: raw.verified === true,
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
    return [meal.name, ...meal.ingredients].join('\n').toLowerCase();
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
    const text = mealText(meal);
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
    'beef', 'steak', 'goat', 'pork', 'lamb', 'mutton', 'oxtail', 'veal',
    'sardine', 'anchov', 'herring', 'mackerel', 'tuna',
];

export const HEART_EXCLUSIONS = [
    'beef', 'steak', 'goat', 'pork', 'lamb', 'mutton', 'oxtail', 'veal',
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
    const n = meal.nutrition;
    if (n && n.verified && n.carbs > CARB_LEVELS[settings.carbTolerance].max) {
        reasons.push(`About ${n.carbs}g carbs per serving, above your ${CARB_LEVELS[settings.carbTolerance].max}g limit`);
    }
    return reasons;
}

export function cautions(meal, settings) {
    const out = [];
    if (settings.prioritizeHeart) {
        const found = matchedTerms(meal, HEART_CAUTIONS);
        if (found.length) out.push(`Contains saturated fat sources (${found.join(', ')})`);
    }
    if (!meal.nutrition || !meal.nutrition.verified) {
        out.push('Carbs and calories for this recipe have not been checked, so your carb and calorie targets could not be applied.');
    }
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
// Checks that recipes carry the safety information the audit found missing.
// Used on curated data (tests), remote sheet data and AI output.

const POULTRY = ['chicken', 'turkey'];
const POULTRY_TEMP = /165\s*°?\s*F|74\s*°?\s*C/i;
const PORK_TEMP = /145\s*°?\s*F|63\s*°?\s*C/i;

export function safetyIssues(meal) {
    const issues = [];
    const ingredientText = meal.ingredients.join('\n').toLowerCase();
    // Safety notes are excluded: they legitimately warn against fresh ackee.
    const allText = [meal.name, ...meal.ingredients, ...meal.instructions].join('\n').toLowerCase();
    const instructionText = meal.instructions.join('\n');

    for (const line of meal.ingredients) {
        const l = line.toLowerCase();
        if (l.includes('ackee') && (!l.includes('canned') || l.includes('fresh'))) {
            issues.push('Ackee must be commercially canned; fresh ackee preparation is not allowed.');
        }
    }
    if (/fresh\s+ackee|if fresh/i.test(allText) && allText.includes('ackee')) {
        issues.push('Recipe refers to preparing fresh ackee.');
    }
    const rawPoultry = meal.ingredients.some(l => POULTRY.some(p => hasWord(l, p)) && !/\bcooked\b/i.test(l));
    if (rawPoultry && !POULTRY_TEMP.test(instructionText)) {
        issues.push('Raw poultry must be cooked to 165°F (74°C); the instructions do not say so.');
    }
    if (/\bpork\b/.test(ingredientText) && !PORK_TEMP.test(instructionText)) {
        issues.push('Pork must be cooked to at least 145°F (63°C); the instructions do not say so.');
    }
    return [...new Set(issues)];
}

// ── Daily selection ──

export function localDayNumber(date = new Date()) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

export function pickDaily(pool, date = new Date()) {
    if (pool.length === 0) return null;
    return pool[localDayNumber(date) % pool.length];
}

export function pickDifferent(pool, current, random = Math.random) {
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];
    const others = pool.filter(m => m !== current);
    return others[Math.floor(random() * others.length)];
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
