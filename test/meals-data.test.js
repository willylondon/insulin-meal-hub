import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILT_IN_MEALS, DEFAULT_SETTINGS, MEAL_TYPES, PROTEIN_IDS, cautions, filterMeals, mealMatchesProteins, normalizeMeal, safetyIssues } from '../meal-rules.js';

const data = JSON.parse(readFileSync(new URL('../meals.json', import.meta.url)));

test('BUILT_IN_MEALS stays in sync with meals.json', () => {
    assert.deepEqual(BUILT_IN_MEALS, data.meals);
});

test('every recipe is complete and valid', () => {
    assert.ok(data.meals.length >= 30);
    for (const raw of data.meals) {
        const m = normalizeMeal(raw);
        assert.ok(m, `${raw.id} failed to normalise`);
        assert.ok(m.servings, `${raw.id} has no servings`);
        assert.ok(m.difficulty, `${raw.id} has no difficulty`);
    }
});

test('recipe IDs and names are unique', () => {
    const ids = data.meals.map(m => m.id);
    const names = data.meals.map(m => m.name.toLowerCase());
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(names).size, names.length);
});

test('default-allowed recipes are heart-healthy with no saturated-fat cautions and include a protein source', () => {
    const normalized = data.meals.map(normalizeMeal);
    const { allowed } = filterMeals(normalized, DEFAULT_SETTINGS);
    assert.ok(allowed.length >= 30);
    const plantProteinRe = /\b(?:beans?|lentils?|chia|hemp|flaxseed|yogurt|protein\s+powder|nuts?|walnuts?|almonds?|pumpkin\s+seeds?)\b/i;
    for (const meal of allowed) {
        const notes = cautions(meal, DEFAULT_SETTINGS);
        assert.ok(!notes.some(n => /saturated fat/i.test(n)), `${meal.id} (${meal.name}) has saturated fat caution: ${notes.join('; ')}`);
        const hasProtein = mealMatchesProteins(meal, PROTEIN_IDS) || meal.ingredients.some(i => plantProteinRe.test(i));
        assert.ok(hasProtein, `${meal.id} (${meal.name}) lacks a clear protein source`);
    }
});

test('beef protein filter only matches actual beef/oxtail recipes, never minced garlic', () => {
    const normalized = data.meals.map(normalizeMeal);
    const beefMatches = normalized.filter(m => mealMatchesProteins(m, ['beef'])).map(m => m.id);
    assert.deepEqual(beefMatches, ['DN010']);
});

test('every meal type has several recipes', () => {
    for (const type of MEAL_TYPES) {
        assert.ok(data.meals.filter(m => m.type === type).length >= 5, type);
    }
});

test('recipes pass the food-safety checks (A05, A10)', () => {
    for (const raw of data.meals) {
        assert.deepEqual(safetyIssues(normalizeMeal(raw)), [], raw.id);
    }
});

test('recipes with ackee carry the ackee safety note', () => {
    for (const raw of data.meals.filter(m => m.ingredients.some(i => /ackee/i.test(i)))) {
        assert.ok(raw.safetyNotes.some(n => /canned ackee/i.test(n)), raw.id);
    }
});

test('no unverified or placeholder nutrition is presented as fact (A04)', () => {
    for (const raw of data.meals) {
        assert.equal(raw.nutrition, null, `${raw.id}: reviewed nutrition pipeline is not implemented`);
    }
});

test('recipes make no absolute blood-sugar claims (A10)', () => {
    const text = JSON.stringify(data.meals).toLowerCase();
    for (const phrase of ['no blood sugar spike', 'prevent insulin spikes', 'without glucose spike', 'insulin-smart', 'stabilize blood sugar']) {
        assert.ok(!text.includes(phrase), phrase);
    }
});
