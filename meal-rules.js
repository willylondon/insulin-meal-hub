// Insulin-Smart Meal Hub — shared meal rules
// Pure functions used by the browser app (app.js), the AI endpoint
// (api/generate-meal.js) and the test suite. No DOM access here.

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];
export const LOG_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const MEAT_STEAK_TERM = '(?<!salmon\\s|tuna\\s|fish\\s|snapper\\s|mahi\\s|cod\\s|grouper\\s|kingfish\\s|halibut\\s|cauliflower\\s|tofu\\s|tempeh\\s|cabbage\\s|mushroom\\s|portobello\\s|eggplant\\s|plant\\s|vegan\\s|vegetarian\\s)steak';

export const PROTEINS = [
    { id: 'chicken',  label: 'Chicken',   icon: '🍗', keywords: ['chicken', 'hen', 'fowl'] },
    { id: 'fish',     label: 'Fish',      icon: '🐟', keywords: ['fish', 'snapper', 'tilapia', 'cod(?:fish)?\\b', 'saltfish', 'mahi', 'parrotfish', 'grouper', 'kingfish', 'halibut', 'haddock', 'trout', 'flounder', 'sea\\s+bass', 'catfish', 'whiting', 'pollock', 'wahoo'] },
    { id: 'eggs',     label: 'Eggs',      icon: '🥚', keywords: ['egg(?!plant)'] },
    { id: 'tuna',     label: 'Tuna',      icon: '🫙', keywords: ['tuna', 'albacore', 'skipjack', 'yellowfin'] },
    { id: 'sardines', label: 'Sardines',  icon: '🐡', keywords: ['sardine', 'pilchard'] },
    { id: 'salmon',   label: 'Salmon',    icon: '🍣', keywords: ['salmon', 'sockeye', 'coho'] },
    { id: 'shrimp',   label: 'Shrimp',    icon: '🦐', keywords: ['shrimp', 'prawn'] },
    { id: 'turkey',   label: 'Turkey',    icon: '🦃', keywords: ['turkey'] },
    { id: 'tofu',     label: 'Tofu',      icon: '🧆', keywords: ['tofu', 'bean\\s+curd', 'soy\\s+curd', 'tempeh'] },
    { id: 'beef',     label: 'Beef',      icon: '🥩', keywords: ['beef(?!steak\\s+tomato)', MEAT_STEAK_TERM, 'minced\\s+beef', 'beef\\s+mince', 'ground\\s+beef', 'oxtail', 'sirloin', 'brisket', 'chuck', 'flank', 'ribeye', 'tenderloin'] },
    { id: 'ackee',    label: 'Ackee',     icon: '🍳', keywords: ['ackee'] },
    { id: 'chickpea', label: 'Chickpeas', icon: '🫘', keywords: ['chickpea', 'garbanzo', 'chana'] },
];
export const PROTEIN_IDS = PROTEINS.map(p => p.id);

export const CUISINES = [
    { id: 'any',            label: 'Worldwide (Any)',      keywords: [] },
    { id: 'Mediterranean',  label: 'Mediterranean',        keywords: ['mediterranean', 'greek', 'italian', 'tuscan', 'spanish'] },
    { id: 'Asian',          label: 'Asian',                keywords: ['asian', 'japanese', 'thai', 'chinese', 'korean', 'vietnamese'] },
    { id: 'Mexican',        label: 'Mexican & Latin',      keywords: ['mexican', 'latin', 'fajita', 'rancheros', 'tinga'] },
    { id: 'Indian',         label: 'Indian & South Asian', keywords: ['indian', 'tandoori', 'masala', 'cheela', 'dal', 'chana', 'palak'] },
    { id: 'Middle Eastern', label: 'Middle Eastern',       keywords: ['middle eastern', 'lebanese', 'levantine', 'shawarma', 'kofta', 'za\'atar', 'tahini', 'shakshuka'] },
    { id: 'African',        label: 'African',              keywords: ['african', 'moroccan', 'west african', 'north african', 'tagine', 'harissa', 'groundnut'] },
    { id: 'Caribbean',      label: 'Caribbean & Jamaican', keywords: ['jamaican', 'caribbean', 'jerk', 'ackee', 'callaloo', 'saltfish', 'cho-cho'] },
    { id: 'European',       label: 'European & American',  keywords: ['european', 'american', 'nordic', 'tuscan', 'french', 'british'] },
];
export const CUISINE_IDS = CUISINES.map(c => c.id);

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
        line.replace(/\b(?:(?:chicken|turkey|beef|fish|pork|vegetable)\s+(?:broth|stock|sauce)|cod\s+liver\s+oil|oyster\s+(?:mushrooms?|sauce)|beefsteak\s+tomato\w*)\b/gi, 'seasoning')
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

export function mealMatchesCuisine(meal, cuisine) {
    if (!cuisine || cuisine === 'any') return true;
    const entry = CUISINES.find(c => c.id.toLowerCase() === String(cuisine).toLowerCase());
    const text = [meal.name || '', ...(meal.tags || []), ...(meal.ingredients || [])].join(' ').toLowerCase();
    if (!entry) return text.includes(String(cuisine).toLowerCase());
    if (entry.keywords.length === 0) return true;
    return entry.keywords.some(kw => text.includes(kw));
}

// ── Dietary rules ──
// Ingredient keyword rules. These are conservative screens, not a clinical
// assessment: they exclude meals containing a listed ingredient.

export const GOUT_TRIGGERS = [
    'shrimp', 'prawn', 'lobster', 'crab(?!apple)', 'mussel', 'oyster(?!\\s*(?:mushroom|sauce))', 'scallop', 'conch',
    'liver', 'kidney(?!\\s*(?:or\\s+\\w+\\s+)?beans?)', 'tripe', 'sweetbread',
    'beef(?!steak\\s+tomato)', MEAT_STEAK_TERM, 'goat', 'pork', 'lamb', 'mutton', 'oxtail', 'veal',
    'sardine', 'anchov', 'herring', 'mackerel', 'tuna',
];

export const HEART_EXCLUSIONS = [
    'beef(?!steak\\s+tomato)', MEAT_STEAK_TERM, 'goat', 'pork', 'lamb', 'mutton', 'oxtail', 'veal',
    'bacon', 'ham(?!burger)', 'sausage', 'salami', 'corned', 'lard', 'deep-fr', 'deep fr',
];

// Shown as cautions rather than exclusions when heart priority is on.
export const HEART_CAUTIONS = ['coconut milk', 'coconut oil', 'shredded coconut', '(?<!peanut\\s|almond\\s|cashew\\s|seed\\s|cocoa\\s|shea\\s)butter(?!nut|\\s*bean)', 'cheese', 'cream(?!\\s+of\\s+tartar|y\\b)'];

const PROTEIN_EXCLUSION_EXEMPTIONS = {
    shrimp:   new Set(['shrimp', 'prawn']),
    tuna:     new Set(['tuna']),
    sardines: new Set(['sardine']),
    beef:     new Set(['beef(?!steak\\s+tomato)', MEAT_STEAK_TERM, 'oxtail', 'veal']),
};

function matchedTerms(meal, terms) {
    const text = mealProteinText(meal);
    return [...new Set(terms.map(t => findWord(text, t)).filter(Boolean))];
}

// Reasons a meal must not be suggested under the given settings.
// When `allowedProteinIds` is supplied (e.g. for an explicit AI protein request),
// the protein(s) the user specifically requested are not rejected as exclusions.
export function exclusionReasons(meal, settings, allowedProteinIds = []) {
    const exempt = new Set(
        Array.isArray(allowedProteinIds)
            ? allowedProteinIds.flatMap(id => [...(PROTEIN_EXCLUSION_EXEMPTIONS[id] || [])])
            : []
    );
    const goutTerms = exempt.size ? GOUT_TRIGGERS.filter(t => !exempt.has(t)) : GOUT_TRIGGERS;
    const heartTerms = exempt.size ? HEART_EXCLUSIONS.filter(t => !exempt.has(t)) : HEART_EXCLUSIONS;
    const reasons = [];
    const gout = settings.avoidGout ? matchedTerms(meal, goutTerms) : [];
    if (gout.length) reasons.push(`Contains a common gout trigger (${gout.join(', ')})`);
    const heart = settings.prioritizeHeart ? matchedTerms(meal, heartTerms) : [];
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
const FISH_WORDS = /\b(?:fish|saltfish|snapper|parrotfish|tilapia|cod|mahi(?:[ -]mahi)?|salmon|tuna|sardines?|trout|haddock|mackerel|grouper|kingfish|halibut|flounder)\b/i;
const MEAT_WORDS = /\b(?:pork|beef|veal|goat|lamb|mutton|oxtail)\b/i;
const GROUND_WORDS = /\b(?:ground|minced?|burger|sausage|meatballs?)\b/i;
const SPICE_GROUND_MINCED = /\b(?:ground|minced)\s+(?:black\s+pepper|white\s+pepper|cayenne|pepper|allspice|pimento|cumin|coriander|cinnamon|nutmeg|ginger|turmeric|cloves?|cardamom|paprika|mustard|flax\w*|chia|garlic|onions?|scallions?|shallots?|herbs?|parsley|cilantro|thyme|scotch\s+bonnet|chili|chilli)\b/gi;
const BAD_PREPARATION = /\b(?:raw|uncooked|undercooked|partially[ -]cooked|part[ -]cooked|half[ -]cooked|par[ -]?cooked|not\s+(?:fully\s+)?cooked)\b/i;

function preparedIngredient(line) {
    // "uncooked", "not cooked" and "cook before serving" are not cooked.
    return !BAD_PREPARATION.test(line) && /\b(?:fully[ -])?cooked\s+(?:chicken|turkey|duck|goose|poultry|fish|saltfish|snapper|salmon|tuna|pork|beef|lamb)\b/i.test(line);
}

function cannedIngredient(line) {
    if (/\b(?:uncanned|not\s+canned|home[ -]canned|raw)\b/i.test(line)) return false;
    return /\b(?:canned|tinned|(?:can|tin)s?(?:\s+of)?),?\s+(?:\([^)]*\)\s*)*(?:(?:drained|rinsed|flaked|chunk|light|solid|white|wild(?:[ -]caught)?|pink|red|atlantic|alaskan|jamaican|commercially|in\s+water|in\s+oil|in\s+brine|low[ -]sodium|no[ -]salt|\w+)\s*,?\s*){0,4}(?:ackee|fish|saltfish|snapper|salmon|tuna|sardines?|mackerel)\b|\b(?:ackee|fish|saltfish|snapper|salmon|tuna|sardines?|mackerel)\s*(?:,\s*|\s*\()?(?:commercially\s+)?(?:canned|tinned)\b/i.test(line)
        && !/\backee\s+(?:and|or|with)\s+(?:canned|tinned)\b/i.test(line);
}

function hasCookingEndpoint(instructions, fahrenheit, celsius, subject) {
    return instructions.some(step => {
        // A preheated oven, an isolated number, a negated instruction, or an
        // endpoint below the minimum must not count as a food temperature.
        return step.split(/[.;\n]/).some(clause => {
            if (subject && !subject.test(clause) && (POULTRY_WORDS.test(clause) || FISH_WORDS.test(clause) || MEAT_WORDS.test(clause))) return false;
            if (/\b(?:do\s+not|don't|never|no\s+need|need\s+not|below|under|less\s+than|instead\s+of)\b/i.test(clause)) return false;
            if (!/\b(?:reach(?:es)?|reads?|registers?|internal|temp(?:erature)?|centre|center|thickest|thermometer|(?:cook|bake|roast|grill|simmer|sear|fry|saut[eé]|broil|poach|steam|brais|stew)\w*\s+(?:until|to)|heat\w*\s+to)\b/i.test(clause)) return false;
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
        && /\b(?:[3-9]|[1-9]\d+|three|four|five|six|seven|eight|nine|ten)\s*(?:min(?:ute)?s?)\b/i.test(step));
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
    // Do not classify fish sauce, chicken stock, or ground/minced spices as raw animal flesh.
    const animalIngredients = ingredients.map(line =>
        line
            .replace(/\b(?:chicken|turkey|beef|fish|pork|vegetable)\s+(?:broth|stock|sauce)\b/gi, 'seasoning')
            .replace(SPICE_GROUND_MINCED, 'seasoning')
    );
    const poultry = animalIngredients.filter(line => POULTRY_WORDS.test(line));
    const reheatedPoultry = poultry.length && /\b(?:reheat|bake|roast|fry|cook|heat)\w*\b/i.test(instructionText);
    if ((poultry.some(line => !preparedIngredient(line)) || reheatedPoultry)
        && !hasCookingEndpoint(instructions, 165, 74, POULTRY_WORDS)) {
        issues.push('Raw or reheated poultry must reach 165°F (74°C) in the food; add a clear cooking endpoint.');
    }
    const meat = animalIngredients.filter(line =>
        (MEAT_WORDS.test(line) || (/\bsteak\b/i.test(line) && !FISH_WORDS.test(line) && !/\b(?:cauliflower|tofu|tempeh|cabbage|mushroom|portobello|eggplant|plant|vegan|vegetarian|beefsteak\s+tomato)\b/i.test(line)))
        && !preparedIngredient(line)
    );
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
            const unseenNonConflicting = unseenPool.filter(m => signatureOverlapCount(m, chosen) === 0);
            if (unseenNonConflicting.length > 0) {
                finalCandidates = unseenNonConflicting;
            } else {
                const poolNonConflicting = pool.filter(m => m.id !== currentId && signatureOverlapCount(m, chosen) === 0);
                if (poolNonConflicting.length > 0) {
                    finalCandidates = poolNonConflicting;
                } else {
                    const minOverlap = Math.min(...baseCandidates.map(m => signatureOverlapCount(m, chosen)));
                    finalCandidates = baseCandidates.filter(m => signatureOverlapCount(m, chosen) === minOverlap);
                }
            }
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
    },
    {
        "id": "BF011",
        "name": "Mediterranean Shakshuka with Chickpeas",
        "type": "Breakfast",
        "prepTime": "20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "2 large eggs",
            "1/2 cup cooked chickpeas, rinsed and drained",
            "1 cup crushed tomatoes (no sugar added)",
            "1 cup baby spinach",
            "1/4 red bell pepper, diced",
            "1 garlic clove, minced",
            "1/2 tsp ground cumin and paprika",
            "1 tsp extra-virgin olive oil"
        ],
        "instructions": [
            "Warm the olive oil in a skillet over medium heat and sauté the bell pepper and garlic for 3 minutes.",
            "Stir in the cumin, paprika, crushed tomatoes and chickpeas; simmer for 5 minutes until thickened.",
            "Wilted in the baby spinach, make two wells in the sauce and crack in the eggs.",
            "Cover and cook for 5-6 minutes until the egg whites and yolks are firm, then serve."
        ],
        "tags": [
            "Mediterranean",
            "Eggs",
            "Vegetarian",
            "High-fiber"
        ],
        "safetyNotes": [
            "Cook eggs until whites and yolks are firm (or reach 160°F / 71°C for egg dishes)."
        ],
        "nutrition": null
    },
    {
        "id": "BF012",
        "name": "Mexican Huevos Rancheros Black Bean Bowl",
        "type": "Breakfast",
        "prepTime": "15 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "2 large eggs",
            "1/2 cup cooked black beans, rinsed and drained",
            "1 cup chopped romaine or baby spinach",
            "1/2 cup fresh pico de gallo (tomato, onion, cilantro, lime)",
            "1/4 avocado, sliced",
            "1/2 tsp ground cumin",
            "1 tsp avocado oil"
        ],
        "instructions": [
            "Warm the black beans with cumin in a small pan over medium-low heat for 3-4 minutes.",
            "Heat the avocado oil in a skillet and scramble or fry the eggs until the whites and yolks are firm.",
            "Layer the greens and warm black beans in a bowl, top with the eggs, pico de gallo and sliced avocado."
        ],
        "tags": [
            "Mexican",
            "Eggs",
            "Vegetarian",
            "High-fiber"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "BF013",
        "name": "Japanese Tamagoyaki & Miso Tofu Greens",
        "type": "Breakfast",
        "prepTime": "15 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "2 large eggs, beaten",
            "100g firm tofu, cubed",
            "2 cups baby spinach and bok choy",
            "1 tsp white miso paste dissolved in 2 tbsp warm water",
            "1 scallion, finely sliced",
            "1 tsp toasted sesame oil",
            "1 tsp sesame seeds"
        ],
        "instructions": [
            "Brush a pan with half the sesame oil over medium heat, pour in the beaten eggs in thin layers and roll into a firm omelet.",
            "In the same pan, warm the remaining sesame oil and sear the tofu cubes for 3 minutes.",
            "Toss in the spinach, bok choy and dissolved miso water; cook for 2 minutes until wilted.",
            "Slice the egg roll and serve alongside the miso tofu greens topped with scallion and sesame seeds."
        ],
        "tags": [
            "Asian",
            "Eggs",
            "Tofu",
            "Low-carb"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "BF014",
        "name": "Middle Eastern Za'atar Eggs & Tahini Greens",
        "type": "Breakfast",
        "prepTime": "15 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "2 large eggs",
            "2 cups chopped kale or baby spinach",
            "1/2 cucumber, diced",
            "1/2 cup cherry tomatoes, halved",
            "1 tbsp tahini mixed with 1 tbsp lemon juice and 1 tbsp water",
            "1 tsp za'atar seasoning",
            "1 tsp extra-virgin olive oil"
        ],
        "instructions": [
            "Heat the olive oil in a skillet over medium heat and sauté the kale for 3-4 minutes until tender.",
            "Crack the eggs into the skillet, sprinkle with za'atar, cover and cook for 4-5 minutes until firm.",
            "Arrange the cucumber and cherry tomatoes in a bowl with the cooked kale and eggs, then drizzle with the lemon-tahini dressing."
        ],
        "tags": [
            "Middle Eastern",
            "Eggs",
            "Vegetarian",
            "Low-carb"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "BF015",
        "name": "Indian Savory Chickpea & Spinach Cheela",
        "type": "Breakfast",
        "prepTime": "20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1/2 cup chickpea flour (besan)",
            "2 tbsp hemp hearts",
            "1 cup finely chopped baby spinach",
            "1/4 red onion, finely diced",
            "1 tsp grated fresh ginger",
            "1/2 tsp ground turmeric and cumin",
            "2 tbsp chopped fresh cilantro",
            "1 tsp avocado oil"
        ],
        "instructions": [
            "Whisk the chickpea flour, hemp hearts, turmeric, cumin and 1/2 cup water into a smooth batter.",
            "Fold the chopped spinach, red onion, ginger and cilantro into the batter.",
            "Heat the avocado oil in a non-stick skillet over medium heat, pour in the batter to form two thin crepes and cook for 3-4 minutes per side until golden and cooked through."
        ],
        "tags": [
            "Indian",
            "Vegan",
            "High-fiber"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "BF016",
        "name": "Nordic Seared Salmon & Avocado Breakfast Plate",
        "type": "Breakfast",
        "prepTime": "15 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 salmon fillet (about 140g)",
            "2 cups baby arugula and spinach",
            "1/4 avocado, sliced",
            "1/2 cucumber, sliced into ribbons",
            "1 tsp capers, drained",
            "1 tbsp fresh lemon juice",
            "1 tsp extra-virgin olive oil"
        ],
        "instructions": [
            "Season the salmon fillet with black pepper and lemon juice.",
            "Sear the salmon in a hot skillet with olive oil for 3-4 minutes per side until a food thermometer in the thickest part of the salmon reads 145°F (63°C).",
            "Plate the salmon over the arugula, cucumber ribbons, sliced avocado and capers."
        ],
        "tags": [
            "European",
            "Fish",
            "Low-carb",
            "High-protein"
        ],
        "safetyNotes": [
            "Cook fish to an internal temperature of 145°F (63°C)."
        ],
        "nutrition": null
    },
    {
        "id": "BF017",
        "name": "Herb Turkey & Mushroom Breakfast Skillet",
        "type": "Breakfast",
        "prepTime": "20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "140g lean ground turkey",
            "1 cup cremini mushrooms, sliced",
            "2 cups baby spinach",
            "1/4 bell pepper, diced",
            "1 garlic clove, minced",
            "1/2 tsp dried thyme and rosemary",
            "1 tsp extra-virgin olive oil"
        ],
        "instructions": [
            "Heat the olive oil in a skillet over medium-high heat and brown the ground turkey with thyme and rosemary for 6-7 minutes.",
            "Check with a food thermometer that the ground turkey reaches 165°F (74°C).",
            "Add the mushrooms, bell pepper and garlic; sauté for 4 minutes until tender.",
            "Fold in the baby spinach until wilted and serve warm."
        ],
        "tags": [
            "American",
            "Turkey",
            "Low-carb",
            "High-protein"
        ],
        "safetyNotes": [
            "Cook ground turkey to an internal temperature of 165°F (74°C)."
        ],
        "nutrition": null
    },
    {
        "id": "BF018",
        "name": "North African Harissa Chickpea & Egg Skillet",
        "type": "Breakfast",
        "prepTime": "20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "2 large eggs",
            "1/2 cup cooked chickpeas, rinsed and drained",
            "1 small zucchini, diced",
            "1/2 cup diced tomatoes",
            "1 cup chopped kale",
            "1 tsp mild harissa paste",
            "1 tsp extra-virgin olive oil"
        ],
        "instructions": [
            "Heat the olive oil in a skillet over medium heat and sauté the zucchini and kale for 4 minutes.",
            "Stir in the chickpeas, diced tomatoes and harissa paste; simmer for 3 minutes.",
            "Crack the two eggs on top, cover and cook for 5 minutes until the whites and yolks are firm."
        ],
        "tags": [
            "African",
            "Eggs",
            "Vegetarian",
            "High-fiber"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "LH014",
        "name": "Greek Lemon-Oregano Chicken & Quinoa Bowl",
        "type": "Lunch",
        "prepTime": "25 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "150g skinless chicken breast",
            "1/3 cup cooked quinoa",
            "2 cups chopped romaine and arugula",
            "1/2 cucumber, diced",
            "1/2 cup cherry tomatoes, halved",
            "6 kalamata olives, pitted and halved",
            "1 tsp dried oregano and 1 tbsp lemon juice",
            "1 tbsp extra-virgin olive oil"
        ],
        "instructions": [
            "Rub the chicken breast with oregano, half the lemon juice, half the olive oil and black pepper.",
            "Grill or pan-sear over medium heat for 6-7 minutes per side until a food thermometer in the thickest part of the chicken reads 165°F (74°C).",
            "Arrange the greens, cooked quinoa, cucumber, tomatoes and olives in a bowl, top with sliced chicken and drizzle with remaining lemon juice and olive oil."
        ],
        "tags": [
            "Mediterranean",
            "Chicken",
            "High-protein"
        ],
        "safetyNotes": [
            "Cook poultry to an internal temperature of 165°F (74°C)."
        ],
        "nutrition": null
    },
    {
        "id": "LH015",
        "name": "Japanese Seared Salmon & Edamame Bowl",
        "type": "Lunch",
        "prepTime": "20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "150g salmon fillet, cubed",
            "1/2 cup shelled edamame, steamed",
            "2 cups shredded purple and green cabbage",
            "1/2 cucumber, sliced",
            "1/4 avocado, diced",
            "1 tbsp low-sodium soy sauce and 1 tsp rice vinegar",
            "1 tsp toasted sesame oil and 1 tsp sesame seeds"
        ],
        "instructions": [
            "Sear the salmon cubes in a skillet over medium-high heat for 5-6 minutes until a food thermometer in the thickest piece reads 145°F (63°C).",
            "Arrange the shredded cabbage, steamed edamame, cucumber and avocado in a bowl.",
            "Top with the warm seared salmon, drizzle with soy sauce, rice vinegar and sesame oil, and sprinkle with sesame seeds."
        ],
        "tags": [
            "Asian",
            "Fish",
            "High-protein",
            "Low-carb"
        ],
        "safetyNotes": [
            "Cook salmon to an internal temperature of 145°F (63°C)."
        ],
        "nutrition": null
    },
    {
        "id": "LH016",
        "name": "Mexican Chicken Tinga Lettuce Wraps",
        "type": "Lunch",
        "prepTime": "25 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "150g skinless chicken breast",
            "1/3 cup cooked black beans, rinsed",
            "4 large romaine lettuce leaves",
            "1/2 cup crushed tomatoes with 1/2 tsp smoked paprika and cumin",
            "1/4 onion and 1 garlic clove, sliced",
            "1/4 avocado, sliced",
            "2 tbsp fresh cilantro and 1 lime wedge",
            "1 tsp avocado oil"
        ],
        "instructions": [
            "Sauté the onion and garlic in avocado oil over medium heat for 2 minutes, then add the chicken breast, crushed tomatoes, paprika and cumin.",
            "Cover and simmer for 14-16 minutes until a food thermometer in the thickest part of the chicken reads 165°F (74°C).",
            "Shred the chicken into the smoky tomato sauce, spoon into crisp romaine leaves with black beans, and top with avocado, cilantro and lime."
        ],
        "tags": [
            "Mexican",
            "Chicken",
            "Low-carb",
            "High-protein"
        ],
        "safetyNotes": [
            "Cook chicken to an internal temperature of 165°F (74°C)."
        ],
        "nutrition": null
    },
    {
        "id": "LH017",
        "name": "Indian Tandoori Chicken & Kachumber Salad",
        "type": "Lunch",
        "prepTime": "25 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "150g skinless chicken breast",
            "2 tbsp plain unsweetened Greek yogurt",
            "1 tsp garam masala, cumin and turmeric",
            "1 tsp grated fresh ginger and 1 garlic clove, minced",
            "2 cups baby spinach",
            "1/2 cucumber and 1 roma tomato, diced",
            "1/4 red onion, thinly sliced",
            "1 tbsp lemon juice and fresh mint"
        ],
        "instructions": [
            "Coat the chicken breast in the Greek yogurt, ginger, garlic, garam masala, cumin and turmeric.",
            "Roast or pan-sear over medium heat for 6-8 minutes per side until a food thermometer in the thickest part of the chicken reads 165°F (74°C).",
            "Toss the spinach, cucumber, tomato, red onion and mint with lemon juice, and top with the sliced tandoori chicken."
        ],
        "tags": [
            "Indian",
            "Chicken",
            "Low-carb",
            "High-protein"
        ],
        "safetyNotes": [
            "Cook chicken to an internal temperature of 165°F (74°C)."
        ],
        "nutrition": null
    },
    {
        "id": "LH018",
        "name": "Lebanese Chicken Shawarma & Tahini Salad Bowl",
        "type": "Lunch",
        "prepTime": "25 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "150g skinless chicken breast, sliced into strips",
            "1/3 cup cooked chickpeas, rinsed",
            "2 cups chopped romaine lettuce and parsley",
            "1/2 cucumber and 2 radishes, sliced",
            "1/2 cup cherry tomatoes, halved",
            "1 tsp ground cumin, coriander, paprika and cinnamon",
            "1 tbsp tahini whisked with 1 tbsp lemon juice",
            "1 tsp extra-virgin olive oil"
        ],
        "instructions": [
            "Toss the chicken strips with the cumin, coriander, paprika, cinnamon and olive oil.",
            "Sear in a hot skillet over medium-high heat for 7-8 minutes until a food thermometer in the thickest strip of chicken reads 165°F (74°C).",
            "Assemble the romaine, parsley, chickpeas, cucumber, radishes and tomatoes in a bowl, top with the warm chicken and drizzle with lemon-tahini dressing."
        ],
        "tags": [
            "Middle Eastern",
            "Chicken",
            "High-protein"
        ],
        "safetyNotes": [
            "Cook chicken to an internal temperature of 165°F (74°C)."
        ],
        "nutrition": null
    },
    {
        "id": "LH019",
        "name": "Thai Basil Tofu & Green Bean Stir-Fry",
        "type": "Lunch",
        "prepTime": "20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "150g extra-firm tofu, pressed and cubed",
            "1.5 cups fresh green beans, trimmed",
            "1/2 red bell pepper, sliced",
            "1 cup riced cauliflower",
            "2 garlic cloves, minced",
            "1 tbsp low-sodium soy sauce and 1 tsp lime juice",
            "1/2 cup fresh Thai basil leaves",
            "1 tsp avocado oil"
        ],
        "instructions": [
            "Heat the avocado oil in a wok or skillet over medium-high heat and sear the tofu cubes for 5-6 minutes until golden.",
            "Add the green beans, bell pepper and garlic; stir-fry for 4 minutes until tender-crisp.",
            "Stir in the riced cauliflower, soy sauce and lime juice for 2 minutes, then fold in the fresh Thai basil and serve."
        ],
        "tags": [
            "Asian",
            "Vegan",
            "Tofu",
            "Low-carb"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "LH020",
        "name": "Mediterranean Canned Tuna & White Bean Salad",
        "type": "Lunch",
        "prepTime": "10 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 can tuna in water (about 140g), drained",
            "1/2 cup cooked cannellini beans, rinsed and drained",
            "2 cups baby arugula and spinach",
            "1/2 cup cherry tomatoes, halved",
            "1/4 red onion, thinly sliced",
            "1 tsp capers and 1 tbsp chopped parsley",
            "1 tbsp lemon juice and 1 tsp extra-virgin olive oil"
        ],
        "instructions": [
            "Place the arugula, spinach, cherry tomatoes, red onion and cannellini beans in a large bowl.",
            "Flake the drained canned tuna over the salad and add the capers and parsley.",
            "Drizzle with the lemon juice and extra-virgin olive oil, toss gently and serve."
        ],
        "tags": [
            "Mediterranean",
            "Fish",
            "No-cook",
            "High-protein"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "LH021",
        "name": "West African Chickpea & Spinach Groundnut Stew",
        "type": "Lunch",
        "prepTime": "25 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "3/4 cup cooked chickpeas, rinsed and drained",
            "2 cups baby spinach, chopped",
            "1/2 cup crushed tomatoes",
            "1 tbsp natural unsweetened peanut butter",
            "1/4 onion, diced",
            "1 garlic clove and 1 tsp fresh ginger, grated",
            "1/2 cup low-sodium vegetable broth",
            "1 tsp avocado oil"
        ],
        "instructions": [
            "Warm the avocado oil in a pot over medium heat and sauté the onion, garlic and ginger for 3 minutes.",
            "Whisk in the crushed tomatoes, vegetable broth and natural peanut butter until smooth.",
            "Add the chickpeas and simmer for 8-10 minutes until rich and fragrant.",
            "Fold in the chopped spinach for 2 minutes until wilted and serve warm."
        ],
        "tags": [
            "African",
            "Vegan",
            "High-fiber"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "DN014",
        "name": "Mediterranean Baked Cod with Tomatoes & Olives",
        "type": "Dinner",
        "prepTime": "25 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 cod fillet (about 170g)",
            "1 medium zucchini, sliced into half-moons",
            "1/2 cup cherry tomatoes, halved",
            "6 kalamata olives, pitted",
            "1 tsp capers, drained",
            "1 garlic clove, sliced",
            "1 tsp dried oregano and 1 tbsp lemon juice",
            "1 tsp extra-virgin olive oil"
        ],
        "instructions": [
            "Preheat the oven to 400°F (200°C).",
            "Arrange the zucchini, cherry tomatoes, olives, capers and garlic in a baking dish, and place the cod fillet on top.",
            "Drizzle with olive oil and lemon juice, and season with oregano and black pepper.",
            "Bake for 14-16 minutes until a food thermometer in the thickest part of the cod reads 145°F (63°C)."
        ],
        "tags": [
            "Mediterranean",
            "Fish",
            "Low-carb",
            "High-protein"
        ],
        "safetyNotes": [
            "Cook fish to an internal temperature of 145°F (63°C)."
        ],
        "nutrition": null
    },
    {
        "id": "DN015",
        "name": "Korean Ginger-Soy Salmon with Bok Choy",
        "type": "Dinner",
        "prepTime": "20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 salmon fillet (about 160g)",
            "2 heads baby bok choy, halved",
            "1 cup shiitake or cremini mushrooms, sliced",
            "1 tbsp low-sodium soy sauce",
            "1 tsp grated fresh ginger and 1 garlic clove, minced",
            "1 tsp toasted sesame oil",
            "1 scallion, sliced, and 1 tsp sesame seeds"
        ],
        "instructions": [
            "Whisk together the soy sauce, ginger, garlic and sesame oil.",
            "Sear the salmon fillet in a non-stick skillet over medium heat for 4 minutes per side, brushing with half the ginger-soy glaze.",
            "Check with a food thermometer that the thickest part of the salmon reads 145°F (63°C).",
            "In the same skillet, sauté the mushrooms and bok choy with the remaining glaze for 4 minutes until tender-crisp, then plate with the salmon."
        ],
        "tags": [
            "Asian",
            "Fish",
            "Low-carb",
            "High-protein"
        ],
        "safetyNotes": [
            "Cook salmon to an internal temperature of 145°F (63°C)."
        ],
        "nutrition": null
    },
    {
        "id": "DN016",
        "name": "Mexican Lime-Cilantro Fish Fajita Bowl",
        "type": "Dinner",
        "prepTime": "20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "1 tilapia or snapper fillet (about 160g)",
            "1 cup riced cauliflower",
            "1/3 cup cooked black beans, rinsed",
            "1/2 green and 1/2 red bell pepper, sliced",
            "1/4 onion, sliced",
            "1/4 avocado, sliced",
            "1 tsp ground cumin and chili powder",
            "1 tbsp lime juice, fresh cilantro and 1 tsp avocado oil"
        ],
        "instructions": [
            "Rub the fish fillet with cumin, chili powder and half the lime juice.",
            "Sauté the bell peppers and onion in avocado oil over medium-high heat for 4 minutes, then push to the side and add the fish fillet.",
            "Cook the fish for 3-4 minutes per side until a food thermometer in the thickest part of the fish reads 145°F (63°C).",
            "Warm the riced cauliflower and black beans, top with the fish and peppers, and garnish with avocado, cilantro and lime."
        ],
        "tags": [
            "Mexican",
            "Fish",
            "Low-carb",
            "High-protein"
        ],
        "safetyNotes": [
            "Cook fish to an internal temperature of 145°F (63°C)."
        ],
        "nutrition": null
    },
    {
        "id": "DN017",
        "name": "Indian Chana Palak (Spinach & Chickpea Masala)",
        "type": "Dinner",
        "prepTime": "25 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "3/4 cup cooked chickpeas, rinsed and drained",
            "3 cups fresh baby spinach",
            "1/2 cup crushed tomatoes",
            "2 tbsp pumpkin seeds or hemp hearts",
            "1/4 onion, finely diced",
            "1 garlic clove and 1 tsp fresh ginger, minced",
            "1 tsp garam masala, ground cumin and turmeric",
            "1 tsp avocado oil"
        ],
        "instructions": [
            "Heat the avocado oil in a pan over medium heat and sauté the onion, garlic and ginger for 3 minutes.",
            "Add the garam masala, cumin, turmeric and crushed tomatoes; simmer for 4 minutes.",
            "Stir in the chickpeas and baby spinach, cooking for 6-8 minutes until the spinach is tender and coated in the spiced tomato gravy.",
            "Top with pumpkin seeds or hemp hearts and serve warm."
        ],
        "tags": [
            "Indian",
            "Vegan",
            "High-fiber"
        ],
        "safetyNotes": [],
        "nutrition": null
    },
    {
        "id": "DN018",
        "name": "Middle Eastern Turkey Kofta & Roasted Eggplant",
        "type": "Dinner",
        "prepTime": "30 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "160g lean ground turkey",
            "1.5 cups cubed eggplant",
            "1 cup chopped cucumber and tomato salad",
            "2 tbsp finely chopped fresh parsley and mint",
            "1 garlic clove, minced",
            "1 tsp ground cumin, coriander and cinnamon",
            "1 tbsp tahini mixed with 1 tbsp lemon juice",
            "1 tsp extra-virgin olive oil"
        ],
        "instructions": [
            "Preheat the oven to 400°F (200°C). Toss the cubed eggplant with olive oil and roast on a baking sheet for 20 minutes until golden.",
            "Mix the ground turkey with the garlic, parsley, cumin, coriander and cinnamon, and shape into 3 oval koftas.",
            "Bake or pan-sear the turkey koftas for 12-14 minutes until a food thermometer in the centre of the turkey reads 165°F (74°C).",
            "Serve the turkey koftas with the roasted eggplant, cucumber-tomato salad and lemon-tahini drizzle."
        ],
        "tags": [
            "Middle Eastern",
            "Turkey",
            "Low-carb",
            "High-protein"
        ],
        "safetyNotes": [
            "Cook ground turkey to an internal temperature of 165°F (74°C)."
        ],
        "nutrition": null
    },
    {
        "id": "DN019",
        "name": "Moroccan Lemon & Olive Chicken Tagine",
        "type": "Dinner",
        "prepTime": "30 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "160g skinless chicken breast, cubed",
            "1 medium zucchini, cubed",
            "1/2 carrot, sliced",
            "6 green olives, pitted and halved",
            "1/4 onion and 1 garlic clove, chopped",
            "1 tsp ground ginger, cumin, turmeric and cinnamon",
            "1/2 cup low-sodium vegetable broth and 1 tbsp lemon juice",
            "1 tsp extra-virgin olive oil and fresh cilantro"
        ],
        "instructions": [
            "Warm the olive oil in a deep skillet over medium heat and brown the chicken cubes with onion, garlic, ginger, cumin, turmeric and cinnamon for 4 minutes.",
            "Add the vegetable broth, carrot, zucchini, olives and lemon juice; cover and simmer for 14-16 minutes.",
            "Check with a food thermometer that the thickest piece of chicken reads 165°F (74°C).",
            "Garnish with fresh cilantro and serve warm."
        ],
        "tags": [
            "African",
            "Chicken",
            "Low-carb",
            "High-protein"
        ],
        "safetyNotes": [
            "Cook chicken to an internal temperature of 165°F (74°C)."
        ],
        "nutrition": null
    },
    {
        "id": "DN020",
        "name": "Chinese Garlic Chicken & Broccoli Stir-Fry",
        "type": "Dinner",
        "prepTime": "20 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "160g skinless chicken breast, thinly sliced",
            "2 cups broccoli florets",
            "1/2 cup snap peas",
            "1/2 cup sliced mushrooms",
            "2 garlic cloves and 1 tsp fresh ginger, minced",
            "1 tbsp low-sodium soy sauce and 1/4 cup water",
            "1 tsp toasted sesame oil and 1 tsp sesame seeds"
        ],
        "instructions": [
            "Stir-fry the sliced chicken in a hot wok or skillet over medium-high heat for 5-6 minutes.",
            "Add the broccoli, snap peas, mushrooms, garlic, ginger and water; cover and steam-fry for 4 minutes.",
            "Stir in the soy sauce and sesame oil and cook until a food thermometer in the thickest piece of chicken reads 165°F (74°C), then top with sesame seeds."
        ],
        "tags": [
            "Asian",
            "Chicken",
            "Quick",
            "Low-carb"
        ],
        "safetyNotes": [
            "Cook chicken to an internal temperature of 165°F (74°C)."
        ],
        "nutrition": null
    },
    {
        "id": "DN021",
        "name": "Tuscan Herbed Chicken with White Beans & Kale",
        "type": "Dinner",
        "prepTime": "25 min",
        "servings": 1,
        "difficulty": "Easy",
        "ingredients": [
            "160g skinless chicken breast",
            "1/2 cup cooked cannellini beans, rinsed and drained",
            "2 cups chopped Tuscan kale",
            "1/2 cup diced tomatoes",
            "2 garlic cloves, minced",
            "1 tsp dried rosemary, thyme and oregano",
            "1/2 cup low-sodium vegetable broth",
            "1 tsp extra-virgin olive oil"
        ],
        "instructions": [
            "Season the chicken breast with rosemary, thyme, oregano and black pepper, and sear in olive oil over medium heat for 6 minutes per side.",
            "Add the garlic, diced tomatoes, vegetable broth, cannellini beans and kale around the chicken; cover and simmer for 6-8 minutes.",
            "Check with a food thermometer that the thickest part of the chicken reads 165°F (74°C) before serving."
        ],
        "tags": [
            "European",
            "Chicken",
            "High-fiber",
            "High-protein"
        ],
        "safetyNotes": [
            "Cook chicken to an internal temperature of 165°F (74°C)."
        ],
        "nutrition": null
    }
]);
