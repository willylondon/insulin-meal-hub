import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MEAL_TYPES, normalizeMeal, safetyIssues } from '../meal-rules.js';

const data = JSON.parse(readFileSync(new URL('../meals.json', import.meta.url)));

test('every recipe is complete and valid', () => {
    assert.ok(data.meals.length >= 30);
    for (const raw of data.meals) {
        const m = normalizeMeal(raw);
        assert.ok(m, `${raw.id} failed to normalise`);
        assert.ok(m.servings, `${raw.id} has no servings`);
        assert.ok(m.difficulty, `${raw.id} has no difficulty`);
    }
});

test('recipe IDs are unique', () => {
    const ids = data.meals.map(m => m.id);
    assert.equal(new Set(ids).size, ids.length);
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
        if (raw.nutrition === null) continue;
        assert.equal(raw.nutrition.verified, true, `${raw.id} has unverified nutrition`);
        assert.ok(raw.nutrition.source, `${raw.id} nutrition has no source`);
    }
    const verified = data.meals.filter(m => m.nutrition).map(m => JSON.stringify(m.nutrition));
    assert.equal(new Set(verified).size, verified.length, 'identical nutrition copied across recipes');
});

test('recipes make no absolute blood-sugar claims (A10)', () => {
    const text = JSON.stringify(data.meals).toLowerCase();
    for (const phrase of ['no blood sugar spike', 'prevent insulin spikes', 'without glucose spike', 'insulin-smart', 'stabilize blood sugar']) {
        assert.ok(!text.includes(phrase), phrase);
    }
});
