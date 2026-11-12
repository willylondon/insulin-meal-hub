import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
    BUILT_IN_MEALS, DEFAULT_SETTINGS, isMealLoggedOnDate, localDateKey,
    mealsConflict, normalizeLogEntry, normalizeMeal, normalizeSettings,
    safetyIssues, selectDailyPlan, shuffleDailyPlan,
} from '../meal-rules.js';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/import\s*\{[\s\S]*?\}\s*from '\.\/meal-rules\.js';/, '');
function harness() {
    const heading = { attributes: {}, setAttribute(k, v) { this.attributes[k] = v; }, focus() { this.focused = true; } };
    const classes = () => ({ add() {}, remove() {} });
    const pane = { hidden: true, classList: classes(), querySelector: () => heading };
    const button = { dataset: { tab: 'settings' }, classList: classes(), setAttribute() {}, removeAttribute() {}, addEventListener(_, fn) { this.click = fn; } };
    const context = { localDateKey, DEFAULT_SETTINGS: {}, document: { readyState: 'loading', addEventListener() {},
        querySelectorAll(selector) { return selector === '.nav-btn' ? [button] : [pane]; },
        getElementById(id) { return id === 'tab-settings' ? pane : { scrollTo() {} }; },
    } };
    vm.runInNewContext(source + '\nglobalThis.subject = { bindNav, nutritionText };', context);
    return { ...context.subject, button, pane, heading };
}
test('section navigation moves focus to the newly visible heading', () => {
    const h = harness(); h.bindNav(); h.button.click();
    assert.equal(h.pane.hidden, false);
    assert.equal(h.heading.attributes.tabindex, '-1');
    assert.equal(h.heading.focused, true);
});
test('nutrition display never presents caller-supplied verification as fact', () => {
    const h = harness();
    const text = h.nutritionText({ source: 'curated', nutrition: { verified: true, source: 'claimed review', calories: 400, carbs: 20, protein: 30, fiber: 5 } });
    assert.match(text, /not verified/);
    assert.match(text, /Not used for recipe filtering/);
    assert.ok(!text.includes('claimed review'));
    assert.match(h.nutritionText({ nutrition: null }), /not been checked/);
});

test('cancelling AI aborts the pending request, clears stale output and unlocks generation', () => {
    const controller = new AbortController();
    const button = { disabled: true, removeAttribute(name) { this.removed = name; } };
    const output = { replaceChildren(...nodes) { this.nodes = nodes; } };
    const context = { DEFAULT_SETTINGS: {}, localDateKey,
        document: { readyState: 'loading', addEventListener() {}, getElementById(id) { return id === 'generate-ai-btn' ? button : output; } }, controller };
    vm.runInNewContext(source + '\nstate.aiRequest = controller; cancelAI(); globalThis.pending = state.aiRequest;', context);
    assert.equal(controller.signal.aborted, true);
    assert.equal(context.pending, null);
    assert.equal(button.disabled, false);
    assert.equal(button.removed, 'aria-busy');
    assert.equal(output.nodes.length, 0);
});

// Permissive DOM stand-in: every element accepts any call the app makes.
function fakeDom() {
    const elements = new Map();
    const make = () => ({
        hidden: false, disabled: false, textContent: '', children: [], attributes: {}, listeners: {}, dataset: {},
        classList: { add() {}, remove() {}, toggle() {} },
        setAttribute(k, v) { this.attributes[k] = v; }, removeAttribute(k) { delete this.attributes[k]; },
        getAttribute(k) { return this.attributes[k]; },
        addEventListener(type, fn) { this.listeners[type] = fn; },
        append(...nodes) { this.children.push(...nodes); },
        replaceChildren(...nodes) { this.children = nodes; },
        scrollIntoView() {}, focus() {},
    });
    return {
        readyState: 'loading', addEventListener() {},
        createElement: make, createTextNode: text => ({ textContent: text }),
        getElementById(id) { if (!elements.has(id)) elements.set(id, make()); return elements.get(id); },
        querySelectorAll: () => [], querySelector: () => null,
    };
}

function appContext(extra = {}) {
    const stored = new Map();
    const context = {
        localDateKey, DEFAULT_SETTINGS: {}, MAX_LOG_ENTRIES: 2000, MEAL_TYPES: ['Breakfast', 'Lunch', 'Dinner'],
        countLast7Days: log => log.length, streakDays: () => 0, exclusionReasons: () => [], cautions: () => [],
        filterMeals: meals => ({ allowed: meals, excluded: [] }), mealMatchesProteins: () => false,
        document: fakeDom(), setTimeout: () => 0, clearTimeout() {},
        localStorage: { getItem: k => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v), removeItem: k => stored.delete(k) },
        stored, ...extra,
    };
    return context;
}

test('deleting a log entry persists, and Undo restores it in date order', () => {
    const context = appContext();
    vm.runInNewContext(source + `
        const a = { name: 'Older', type: 'Lunch', date: '2026-01-01T12:00:00.000Z' };
        const b = { name: 'Newer', type: 'Dinner', date: '2026-01-02T12:00:00.000Z' };
        state.mealLog = [b, a];
        deleteLogEntry(b);
        globalThis.afterDelete = state.mealLog.map(e => e.name);
        globalThis.persisted = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)).mealLog.length;
        globalThis.undoLabel = toastAction.label;
        toastAction.run();
        globalThis.afterUndo = state.mealLog.map(e => e.name);
    `, context);
    assert.deepEqual([...context.afterDelete], ['Older']);
    assert.equal(context.persisted, 1);
    assert.equal(context.undoLabel, 'Undo');
    assert.deepEqual([...context.afterUndo], ['Newer', 'Older']);
});

test('a failed save leaves the log and saved recipes unchanged', () => {
    const context = appContext();
    context.localStorage.setItem = () => { throw new Error('quota'); };
    vm.runInNewContext(source + `
        const entry = { name: 'Kept', type: 'Lunch', date: '2026-01-01T12:00:00.000Z' };
        state.mealLog = [entry];
        deleteLogEntry(entry);
        toggleSaved({ id: 'BF001', name: 'Recipe', type: 'Breakfast', tags: [] });
        globalThis.logSize = state.mealLog.length;
        globalThis.savedSize = state.savedMeals.length;
    `, context);
    assert.equal(context.logSize, 1);
    assert.equal(context.savedSize, 0);
});

test('saving a recipe toggles, persists and is capped', () => {
    const context = appContext();
    vm.runInNewContext(source + `
        const meal = { id: 'AI-1', name: 'Recipe', type: 'Dinner', tags: [], source: 'ai' };
        state.currentModalMeal = meal;
        toggleSaved(meal);
        globalThis.savedOnce = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)).savedMeals.map(m => m.id);
        globalThis.pressed = document.getElementById('save-modal-meal').attributes['aria-pressed'];
        toggleSaved(meal);
        globalThis.savedTwice = state.savedMeals.length;
        state.savedMeals = Array.from({ length: CONFIG.MAX_SAVED_MEALS }, (_, i) => ({ id: 'M' + i }));
        toggleSaved(meal);
        globalThis.capped = state.savedMeals.length;
    `, context);
    assert.deepEqual([...context.savedOnce], ['AI-1']);
    assert.equal(context.pressed, 'true');
    assert.equal(context.savedTwice, 0);
    assert.equal(context.capped, 50);
});

test('Find with no protein selected browses every recipe of the chosen type', () => {
    const context = appContext();
    vm.runInNewContext(source + `
        state.meals = [
            { id: 'A', name: 'A', type: 'Breakfast', tags: [] },
            { id: 'B', name: 'B', type: 'Dinner', tags: [] },
        ];
        findMealsByProtein();
        const grid = document.getElementById('protein-result').children.find(n => n.className === 'protein-match-grid');
        globalThis.shown = grid ? grid.children.length : 0;
    `, context);
    assert.equal(context.shown, 2);
});

test('init synchronously populates today meals from BUILT_IN_MEALS without getting stuck on Loading even if fetch hangs or retry-meals is missing', () => {
    const dom = fakeDom();
    const origGet = dom.getElementById.bind(dom);
    // Simulate a stale cached HTML shell where #retry-meals does not exist yet
    dom.getElementById = id => (id === 'retry-meals' ? null : origGet(id));
    dom.getElementById('breakfast-name').textContent = 'Loading…';
    dom.getElementById('lunch-name').textContent = 'Loading…';
    dom.getElementById('dinner-name').textContent = 'Loading…';

    const context = appContext({
        BUILT_IN_MEALS,
        DEFAULT_SETTINGS,
        PROTEINS: [],
        normalizeMeal,
        normalizeSettings,
        normalizeLogEntry,
        safetyIssues,
        selectDailyPlan,
        shuffleDailyPlan,
        mealsConflict,
        isMealLoggedOnDate,
        document: dom,
        setInterval: () => 0,
        fetch: () => new Promise(() => {}), // never resolves
        AbortSignal: { timeout: () => undefined },
    });
    vm.runInNewContext(source + '\ninit();', context);
    assert.notEqual(dom.getElementById('breakfast-name').textContent, 'Loading…');
    assert.notEqual(dom.getElementById('lunch-name').textContent, 'Loading…');
    assert.notEqual(dom.getElementById('dinner-name').textContent, 'Loading…');
    assert.ok(dom.getElementById('breakfast-name').textContent.length > 3);
    assert.ok(dom.getElementById('lunch-name').textContent.length > 3);
    assert.ok(dom.getElementById('dinner-name').textContent.length > 3);
});
