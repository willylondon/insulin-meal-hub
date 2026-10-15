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
