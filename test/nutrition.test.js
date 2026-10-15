import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNutrition, filterMeals, DEFAULT_SETTINGS, cautions } from '../meal-rules.js';
const values = { calories: 500, protein: 30, carbs: 40, fiber: 8 };
test('nutrition rejects missing, coerced and contradictory quantities', () => {
    for (const value of [null, '', false, '25', NaN, Infinity, -1]) {
        assert.equal(normalizeNutrition({ ...values, carbs: value }), null);
    }
    assert.equal(normalizeNutrition({ ...values, fiber: 41 }), null);
    assert.equal(normalizeNutrition({ ...values, calories: undefined }), null);
    assert.equal(normalizeNutrition([]), null);
});
test('a label and URL cannot grant nutrition verification', () => {
    const nutrition = normalizeNutrition({ ...values, verified: true, source: 'https://example.com/claimed-review' });
    assert.equal(nutrition.verified, false);
    assert.deepEqual({ ...nutrition, verified: undefined, source: undefined }, { ...values, verified: undefined, source: undefined });
});
test('numeric filtering stays unavailable even for a forged in-memory verified flag', () => {
    const recipe = { name: 'Vegetable bowl', ingredients: ['callaloo'], nutrition: { ...values, verified: true } };
    const settings = { ...DEFAULT_SETTINGS, carbTolerance: 'low', calorieTarget: 300, proteinTarget: 60 };
    assert.equal(filterMeals([recipe], settings).allowed.length, 1);
    assert.ok(cautions(recipe, settings).some(message => message.includes('filtering is unavailable')));
});
