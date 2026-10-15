import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_SETTINGS, csvCell, exclusionReasons, filterMeals, logToCsv,
    mealMatchesProteins, normalizeLogEntry, normalizeMeal, normalizeSettings,
    pickDaily, pickDifferent, safetyIssues, streakDays, countLast7Days,
} from '../meal-rules.js';

const meal = (overrides = {}) => normalizeMeal({
    id: 'T1', name: 'Test Meal', type: 'Lunch',
    ingredients: ['1 cup callaloo', '1 tsp olive oil'],
    instructions: ['Cook it'],
    ...overrides,
});

test('settings: false switches survive a save/load round trip (A09)', () => {
    const saved = JSON.parse(JSON.stringify(normalizeSettings({ ...DEFAULT_SETTINGS, avoidGout: false, prioritizeHeart: false })));
    const loaded = normalizeSettings(saved);
    assert.equal(loaded.avoidGout, false);
    assert.equal(loaded.prioritizeHeart, false);
});

test('settings: invalid stored values fall back to defaults and are clamped', () => {
    const s = normalizeSettings({ carbTolerance: 'extreme', calorieTarget: -500, proteinTarget: '999', budget: 7, avoidGout: 'yes' });
    assert.equal(s.carbTolerance, 'moderate');
    assert.equal(s.calorieTarget, 300);
    assert.equal(s.proteinTarget, 60);
    assert.equal(s.budget, 'medium');
    assert.equal(s.avoidGout, true);
    assert.deepEqual(normalizeSettings(null), { ...DEFAULT_SETTINGS });
});

test('settings change which meals are suggested (A03)', () => {
    const shrimp = meal({ id: 'S', name: 'Shrimp Bowl', ingredients: ['200g shrimp', 'greens'] });
    const pork = meal({ id: 'P', name: 'Pork Roast', ingredients: ['1 lb pork loin'], instructions: ['Roast to 145°F (63°C)'] });
    const veg = meal({ id: 'V' });
    const strict = filterMeals([shrimp, pork, veg], { ...DEFAULT_SETTINGS, avoidGout: true, prioritizeHeart: true });
    assert.deepEqual(strict.allowed.map(m => m.id), ['V']);
    const relaxed = filterMeals([shrimp, pork, veg], { ...DEFAULT_SETTINGS, avoidGout: false, prioritizeHeart: false });
    assert.deepEqual(relaxed.allowed.map(m => m.id), ['S', 'P', 'V']);
});

test('carb limit applies only to verified nutrition', () => {
    const verified = meal({ nutrition: { calories: 500, protein: 30, carbs: 45, fiber: 8, verified: true, source: 'review' } });
    const unverified = meal({ nutrition: { calories: 500, protein: 30, carbs: 45, fiber: 8 } });
    const low = { ...DEFAULT_SETTINGS, carbTolerance: 'low' };
    assert.equal(exclusionReasons(verified, low).length, 1);
    assert.equal(exclusionReasons(unverified, low).length, 0);
    assert.equal(exclusionReasons(verified, { ...DEFAULT_SETTINGS, carbTolerance: 'moderate' }).length, 0);
});

test('keyword rules match words, not unrelated substrings', () => {
    const beans = meal({ ingredients: ['1 cup kidney beans', 'rice'] });
    assert.equal(exclusionReasons(beans, DEFAULT_SETTINGS).length, 0);
    const organ = meal({ ingredients: ['2 lamb kidneys'] });
    assert.ok(exclusionReasons(organ, { ...DEFAULT_SETTINGS, prioritizeHeart: false }).length > 0);
    assert.equal(mealMatchesProteins(meal({ ingredients: ['2 eggs', 'pepper'] }), ['eggs']), true);
    assert.equal(mealMatchesProteins(meal(), ['chicken']), false);
});

test('food safety: fresh ackee is rejected, canned ackee allowed (A05)', () => {
    assert.ok(safetyIssues(meal({ ingredients: ['1 cup ackee (fresh or canned)'] })).length > 0);
    assert.ok(safetyIssues(meal({ ingredients: ['1 cup ackee'] })).length > 0);
    assert.ok(safetyIssues(meal({ ingredients: ['1 cup canned ackee'], instructions: ['If fresh, boil until tender'] })).length > 0);
    assert.deepEqual(safetyIssues(meal({ ingredients: ['1 cup canned ackee, drained'], instructions: ['Warm through'] })), []);
});

test('food safety: raw poultry needs a 165°F/74°C instruction (A10)', () => {
    assert.ok(safetyIssues(meal({ ingredients: ['1 chicken breast'], instructions: ['Cook 6 min per side'] })).length > 0);
    assert.deepEqual(safetyIssues(meal({ ingredients: ['1 chicken breast'], instructions: ['Cook until it reaches 165°F (74°C)'] })), []);
    assert.deepEqual(safetyIssues(meal({ ingredients: ['½ cup cooked chicken'], instructions: ['Mix'] })), []);
});

test('normalizeMeal rejects incomplete records and strips control characters', () => {
    assert.equal(normalizeMeal({ id: 'X', name: 'No type', ingredients: ['a'], instructions: ['b'] }), null);
    assert.equal(normalizeMeal('not an object'), null);
    const m = normalizeMeal({ 'Meal ID': 'L1', 'Meal Name': 'Legacy\u0007 Meal', Type: 'dinner', Ingredients: '- a\n- b', Instructions: '1. c\n2. d', Servings: '0' });
    assert.equal(m.name, 'Legacy Meal');
    assert.equal(m.type, 'Dinner');
    assert.deepEqual(m.ingredients, ['a', 'b']);
    assert.deepEqual(m.instructions, ['c', 'd']);
    assert.equal(m.servings, null);
});

test('HTML in meal data stays as text data (A01)', () => {
    const payload = '<img src=x onerror="alert(1)">';
    const m = normalizeMeal({ id: 'X', name: payload, type: 'Lunch', ingredients: [payload], instructions: ['ok'] });
    // The value is preserved verbatim; app.js renders it with textContent only.
    assert.equal(m.name, payload);
    const entry = normalizeLogEntry({ name: payload, type: '<b>', date: new Date().toISOString() });
    assert.equal(entry.type, 'Snack');
});

test('custom meal notes are kept in the log entry (A12)', () => {
    const entry = normalizeLogEntry({ id: 1, mealId: 'custom-1', name: 'Soup', type: 'Lunch', notes: 'Felt shaky after', date: '2026-10-14T12:00:00Z' });
    assert.equal(entry.notes, 'Felt shaky after');
    assert.equal(normalizeLogEntry({ name: 'x', date: 'not a date' }), null);
});

test('CSV escapes quotes and neutralises formulas (A12)', () => {
    assert.equal(csvCell('a"b'), '"a""b"');
    assert.equal(csvCell('=1+1'), '"\'=1+1"');
    assert.equal(csvCell('@SUM(A1)'), '"\'@SUM(A1)"');
    assert.equal(csvCell('-2'), '"\'-2"');
    const csv = logToCsv([{ name: 'Jerk, "spicy"', type: 'Dinner', notes: 'line1\nline2', mealId: 'DN1', date: '2026-10-14T12:00:00Z' }]);
    const [header, row] = csv.split('\r\n');
    assert.match(header, /Notes/);
    assert.ok(row.includes('"Jerk, ""spicy"""'));
    assert.ok(csv.includes('"line1\nline2"'));
});

test('daily pick is stable within a local day and shuffle changes the meal', () => {
    const pool = ['a', 'b', 'c'];
    const morning = new Date(2026, 9, 14, 7);
    const night = new Date(2026, 9, 14, 23);
    assert.equal(pickDaily(pool, morning), pickDaily(pool, night));
    assert.notEqual(pickDifferent(pool, 'a', () => 0), 'a');
    assert.equal(pickDaily([], morning), null);
});

test('streak and 7-day counts use local calendar days', () => {
    const now = new Date(2026, 9, 14, 0, 30); // just after local midnight
    const at = (d, h) => new Date(2026, 9, d, h).toISOString();
    const log = [{ date: at(14, 0) }, { date: at(13, 23) }, { date: at(12, 9) }, { date: at(1, 9) }];
    assert.equal(streakDays(log, now), 3);
    assert.equal(countLast7Days(log, now), 3);
});
