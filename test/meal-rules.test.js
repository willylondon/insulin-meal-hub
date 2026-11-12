import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    DEFAULT_SETTINGS, csvCell, exclusionReasons, filterMeals, isMealLoggedOnDate, logToCsv,
    mealMatchesProteins, mealsConflict, normalizeLogEntry, normalizeMeal, normalizeSettings,
    pickDaily, pickDifferent, safetyIssues, selectDailyPlan, shuffleDailyPlan, streakDays, countLast7Days,
} from '../meal-rules.js';

const allMeals = JSON.parse(readFileSync(new URL('../meals.json', import.meta.url))).meals.map(normalizeMeal);

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

test('self-reported verified nutrition never enables unsupported filtering', () => {
    const verified = meal({ nutrition: { calories: 500, protein: 30, carbs: 45, fiber: 8, verified: true, source: 'review' } });
    const unverified = meal({ nutrition: { calories: 500, protein: 30, carbs: 45, fiber: 8 } });
    const low = { ...DEFAULT_SETTINGS, carbTolerance: 'low' };
    assert.equal(verified.nutrition.verified, false);
    assert.equal(exclusionReasons(verified, low).length, 0);
    assert.equal(exclusionReasons(unverified, low).length, 0);
    assert.equal(exclusionReasons(verified, { ...DEFAULT_SETTINGS, carbTolerance: 'moderate' }).length, 0);
});

test('keyword rules match words, not unrelated substrings', () => {
    const beans = meal({ ingredients: ['1 cup kidney beans', 'rice'] });
    assert.equal(exclusionReasons(beans, DEFAULT_SETTINGS).length, 0);
    const organ = meal({ ingredients: ['2 lamb kidneys'] });
    assert.ok(exclusionReasons(organ, { ...DEFAULT_SETTINGS, prioritizeHeart: false }).length > 0);
    assert.equal(mealMatchesProteins(meal({ ingredients: ['2 eggs', 'pepper'] }), ['eggs']), true);
    assert.equal(mealMatchesProteins(meal({ ingredients: ['1 cup eggplant, cubed'] }), ['eggs']), false);
    assert.equal(mealMatchesProteins(meal({ ingredients: ['1 garlic clove, minced', '2 cups beef broth'] }), ['beef']), false);
    assert.equal(mealMatchesProteins(meal({ ingredients: ['1 tbsp cod liver oil'] }), ['fish']), false);
    assert.equal(mealMatchesProteins(meal({ ingredients: ['1 lb oxtail'] }), ['beef']), true);
    assert.equal(mealMatchesProteins(meal({ ingredients: ['1 salmon steak'] }), ['beef']), false);
    assert.equal(exclusionReasons(meal({ ingredients: ['1 salmon steak'] }), DEFAULT_SETTINGS).length, 0);
    assert.ok(exclusionReasons(meal({ ingredients: ['1 sirloin steak'] }), DEFAULT_SETTINGS).length > 0);
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

test('selectDailyPlan avoids same-day signature conflicts, multi-day repeats, and recently logged meals', () => {
    const recentByType = { breakfast: [], lunch: [], dinner: [] };
    for (let i = 0; i < 60; i++) {
        const date = new Date(2026, 0, 1 + i, 12);
        const plan = selectDailyPlan(allMeals, DEFAULT_SETTINGS, { date });
        assert.ok(plan.breakfast && plan.lunch && plan.dinner);
        // No duplicate meals or conflicting main proteins/signature ingredients on the same day
        assert.equal(mealsConflict(plan.breakfast, plan.lunch), false, `Day ${i} B/L conflict: ${plan.breakfast.name} vs ${plan.lunch.name}`);
        assert.equal(mealsConflict(plan.breakfast, plan.dinner), false, `Day ${i} B/D conflict: ${plan.breakfast.name} vs ${plan.dinner.name}`);
        assert.equal(mealsConflict(plan.lunch, plan.dinner), false, `Day ${i} L/D conflict: ${plan.lunch.name} vs ${plan.dinner.name}`);
        // No repeat within the multi-day sliding window (at least 4 consecutive days)
        for (const key of ['breakfast', 'lunch', 'dinner']) {
            assert.ok(!recentByType[key].slice(0, 4).includes(plan[key].id), `Day ${i} repeated ${key}: ${plan[key].id}`);
            recentByType[key] = [plan[key].id, ...recentByType[key]].slice(0, 4);
        }
    }

    // Logged meal yesterday is avoided today
    const today = new Date(2026, 5, 10, 9);
    const yesterday = new Date(2026, 5, 9, 13);
    const basePlan = selectDailyPlan(allMeals, DEFAULT_SETTINGS, { date: today });
    const log = [{ mealId: basePlan.lunch.id, name: basePlan.lunch.name, type: 'Lunch', date: yesterday.toISOString() }];
    const adjustedPlan = selectDailyPlan(allMeals, DEFAULT_SETTINGS, { date: today, log });
    assert.notEqual(adjustedPlan.lunch.id, basePlan.lunch.id);
});

test('shuffleDailyPlan cycles through the entire allowed pool without repeating meals', () => {
    const allowedBreakfastCount = filterMeals(allMeals.filter(m => m.type === 'Breakfast'), DEFAULT_SETTINGS).allowed.length;
    let currentPlan = selectDailyPlan(allMeals, DEFAULT_SETTINGS, { date: new Date(2026, 3, 1, 9) });
    let seenByType = {
        breakfast: [currentPlan.breakfast.id],
        lunch: [currentPlan.lunch.id],
        dinner: [currentPlan.dinner.id],
    };
    const seenBreakfastOrder = [currentPlan.breakfast.id];

    for (let step = 1; step < allowedBreakfastCount; step++) {
        const prev = currentPlan;
        const next = shuffleDailyPlan(allMeals, DEFAULT_SETTINGS, { currentPlan, seenByType, random: () => 0 });
        currentPlan = next.plan;
        seenByType = next.seenByType;
        assert.notEqual(currentPlan.breakfast.id, prev.breakfast.id);
        assert.notEqual(currentPlan.lunch.id, prev.lunch.id);
        assert.notEqual(currentPlan.dinner.id, prev.dinner.id);
        assert.ok(!seenBreakfastOrder.includes(currentPlan.breakfast.id), `Repeated breakfast ${currentPlan.breakfast.id} at step ${step}`);
        seenBreakfastOrder.push(currentPlan.breakfast.id);
        assert.equal(mealsConflict(currentPlan.breakfast, currentPlan.lunch), false);
        assert.equal(mealsConflict(currentPlan.lunch, currentPlan.dinner), false);
    }
    assert.equal(new Set(seenBreakfastOrder).size, allowedBreakfastCount);

    // Next shuffle wraps around the cycle cleanly without repeating the immediately preceding meal
    const prevBreakfastId = currentPlan.breakfast.id;
    const wrapped = shuffleDailyPlan(allMeals, DEFAULT_SETTINGS, { currentPlan, seenByType, random: () => 0 });
    assert.notEqual(wrapped.plan.breakfast.id, prevBreakfastId);
});

test('isMealLoggedOnDate detects same-day duplicate logging', () => {
    const targetMeal = allMeals[0];
    const d1 = new Date(2026, 9, 14, 8, 30);
    const d2 = new Date(2026, 9, 15, 8, 30);
    const log = [{ id: 1, mealId: targetMeal.id, name: targetMeal.name, type: targetMeal.type, date: d1.toISOString() }];
    assert.equal(isMealLoggedOnDate(log, targetMeal, d1), true);
    assert.equal(isMealLoggedOnDate(log, targetMeal, d2), false);
});
