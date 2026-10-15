// Insulin-Smart Meal Hub — v3.0
// All dynamic content is rendered with textContent / DOM nodes. Do not use
// innerHTML with data from recipes, storage, the network or the AI.

import {
    DEFAULT_SETTINGS, MAX_LOG_ENTRIES, MEAL_TYPES, PROTEINS,
    cautions, countLast7Days, filterMeals, logToCsv, mealMatchesProteins,
    normalizeLogEntry, normalizeMeal, normalizeSettings, pickDaily, pickDifferent,
    safetyIssues, streakDays,
} from './meal-rules.js';

const CONFIG = {
    MEALS_URL: 'meals.json',
    // The Google Sheet still contains the old recipes (fresh ackee, placeholder
    // nutrition). Leave this off until the sheet has been updated from
    // meals.json; remote rows are validated and safety-checked either way.
    USE_REMOTE_SHEET: false,
    GOOGLE_SHEET_ID: '1yBxlRrZEjBy0z5A7K0T5UihVo3PmWVfm',
    SHEET_NAME: '21 Recipes',
    STORAGE_KEY: 'insulinMealHubData_v2',
    LOG_DISPLAY_LIMIT: 50,
    AI_TIMEOUT_MS: 40000,
};

const state = {
    meals: [],
    todayMeals: { breakfast: null, lunch: null, dinner: null },
    mealLog: [],
    settings: { ...DEFAULT_SETTINGS },
    aiConsent: false,
    currentModalMeal: null,
    aiRequest: null,
    lastFocus: null,
};

// ── INIT ──
function init() {
    loadState();
    applySettingsToUI();
    initProteinChips();
    bindNav();
    bindTodayTab();
    bindFindTab();
    bindLogTab();
    bindSettingsTab();
    bindModals();
    renderHeader();
    renderLogHistory();
    updateStats();
    loadMeals();
    registerServiceWorker();
}

// ── STATE ──
function loadState() {
    let parsed = null;
    try {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (saved) parsed = JSON.parse(saved);
    } catch {
        parsed = null;
    }
    if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.mealLog)) {
            state.mealLog = parsed.mealLog.map(normalizeLogEntry).filter(Boolean).slice(0, MAX_LOG_ENTRIES);
        }
        state.settings = normalizeSettings(parsed.settings);
        state.aiConsent = parsed.aiConsent === true;
    }
}

// Returns false (and tells the user) if the browser refused to store the data.
function saveState() {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
            version: 3,
            mealLog: state.mealLog,
            settings: state.settings,
            aiConsent: state.aiConsent,
        }));
        return true;
    } catch {
        toast('Could not save on this device. Storage may be full or blocked.', 'error');
        return false;
    }
}

// ── MEAL DATA ──
async function loadMeals() {
    let meals = [];
    try {
        const res = await fetch(CONFIG.MEALS_URL, { cache: 'no-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        meals = acceptMeals(Array.isArray(data?.meals) ? data.meals : []);
    } catch {
        meals = [];
    }
    if (CONFIG.USE_REMOTE_SHEET) {
        const remote = await fetchSheetMeals();
        if (remote.length > 0) meals = remote;
    }
    state.meals = meals;
    if (meals.length === 0) {
        setText('filter-summary', 'Recipes could not be loaded. Check your connection and reload.');
    }
    selectMeals();
    renderTodayMeals();
}

// Normalises records and drops any that fail the food-safety checks.
function acceptMeals(rawMeals) {
    const seen = new Set();
    return rawMeals.map(normalizeMeal).filter(m => {
        if (!m || seen.has(m.id) || safetyIssues(m).length > 0) return false;
        seen.add(m.id);
        return true;
    });
}

async function fetchSheetMeals() {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(CONFIG.GOOGLE_SHEET_ID)}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(CONFIG.SHEET_NAME)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const text = await res.text();
        const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
        const cols = (json.table?.cols || []).map(c => c?.label || '');
        let rows = json.table?.rows || [];
        let headers = cols;
        // Older sheets expose headers as the first data row instead of column labels.
        if (!headers.includes('Meal Name') && rows.length) {
            headers = rows[0].c.map(c => (c?.v ?? '').toString());
            rows = rows.slice(1);
        }
        const records = rows.map(row => {
            const m = {};
            (row.c || []).forEach((cell, i) => { if (headers[i]) m[headers[i]] = cell?.v ?? ''; });
            delete m.nutrition; // spreadsheet nutrition is never treated as verified
            return m;
        });
        return acceptMeals(records);
    } catch {
        return [];
    }
}

// ── MEAL SELECTION ──
function poolFor(type) {
    return filterMeals(state.meals.filter(m => m.type === type), state.settings).allowed;
}

function selectMeals() {
    MEAL_TYPES.forEach(type => {
        state.todayMeals[type.toLowerCase()] = pickDaily(poolFor(type));
    });
}

function shuffleMeals() {
    MEAL_TYPES.forEach(type => {
        const key = type.toLowerCase();
        state.todayMeals[key] = pickDifferent(poolFor(type), state.todayMeals[key]);
    });
    renderTodayMeals();
    toast('Meals shuffled');
}

// ── RENDER TODAY ──
function renderHeader() {
    setText('current-date', new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }));
    const n = state.mealLog.length;
    setText('meal-count', `${n} meal${n !== 1 ? 's' : ''} logged`);
}

function servingsLabel(meal) {
    return meal.servings ? `Serves ${meal.servings}` : 'Servings not stated';
}

function renderTodayMeals() {
    ['breakfast', 'lunch', 'dinner'].forEach(type => {
        const meal = state.todayMeals[type];
        const viewBtn = document.getElementById('view-' + type);
        const logBtn = document.getElementById('log-' + type);
        if (viewBtn) viewBtn.disabled = !meal;
        if (logBtn) logBtn.disabled = !meal;
        if (!meal) {
            setText(type + '-name', state.meals.length ? 'No recipe matches your settings' : 'No recipes available');
            setText(type + '-time', '–');
            setText(type + '-meta', state.meals.length ? 'Try changing your settings or the Find tab.' : '');
            replaceChildren(type + '-tags', []);
            return;
        }
        setText(type + '-name', meal.name);
        setText(type + '-time', meal.prepTime || '–');
        setText(type + '-meta', [servingsLabel(meal), meal.difficulty].filter(Boolean).join(' · '));
        replaceChildren(type + '-tags', meal.tags.map(t => el('span', { className: 'meal-tag', text: t })));
    });
    renderFilterSummary();
    renderHeader();
}

function renderFilterSummary() {
    if (state.meals.length === 0) return;
    const { excluded } = filterMeals(state.meals, state.settings);
    const parts = [];
    if (state.settings.avoidGout) parts.push('gout triggers');
    if (state.settings.prioritizeHeart) parts.push('red and processed meat');
    const hidden = parts.length
        ? `Hiding recipes with ${parts.join(' and ')} (${excluded.length} of ${state.meals.length} hidden).`
        : `Showing all ${state.meals.length} recipes.`;
    setText('filter-summary', `${hidden} Your carb and calorie targets aren't applied to these recipes yet because their nutrition hasn't been checked.`);
}

// ── RECIPE MODAL ──
function openRecipeModal(meal) {
    if (!meal) return;
    state.currentModalMeal = meal;
    setText('modal-meal-name', meal.name);
    setText('modal-prep-time', meal.prepTime || '–');
    setText('modal-servings', servingsLabel(meal));
    setText('modal-difficulty', meal.difficulty || '–');
    document.getElementById('modal-ai-warning').hidden = meal.source !== 'ai';

    replaceChildren('modal-ingredients', meal.ingredients.map(t => el('li', { text: t })));
    replaceChildren('modal-instructions', meal.instructions.map(t => el('li', { text: t })));

    const safety = meal.safetyNotes || [];
    document.getElementById('modal-safety-section').hidden = safety.length === 0;
    replaceChildren('modal-safety', safety.map(t => el('li', { text: t })));

    setText('modal-nutrition', nutritionText(meal));

    const notes = cautions(meal, state.settings).filter(c => !c.startsWith('Carbs and calories'));
    document.getElementById('modal-cautions-section').hidden = notes.length === 0;
    replaceChildren('modal-cautions', notes.map(t => el('li', { text: t })));

    openModal('recipe-modal');
}

function nutritionText(meal) {
    const n = meal.nutrition;
    if (!n) return 'Not available yet. Nutrition for this recipe has not been checked, so it is not shown. Do not use this app to work out insulin doses.';
    const figures = `About ${Math.round(n.calories)} kcal · ${Math.round(n.protein)}g protein · ${Math.round(n.carbs)}g carbs · ${Math.round(n.fiber)}g fiber per serving.`;
    return n.verified
        ? `${figures} Source: ${n.source || 'reviewed'}.`
        : `${figures} AI estimate, not verified. Do not use it to work out insulin doses.`;
}

// ── LOG MEAL ──
function logMeal(meal, notes = '') {
    if (!meal) return false;
    const entry = normalizeLogEntry({
        id: Date.now(),
        mealId: meal.id || 'custom',
        name: meal.name,
        type: meal.type,
        notes,
        date: new Date().toISOString(),
    });
    if (!entry) return false;
    const previous = state.mealLog;
    state.mealLog = [entry, ...state.mealLog].slice(0, MAX_LOG_ENTRIES);
    if (!saveState()) {
        state.mealLog = previous;
        return false;
    }
    renderLogHistory();
    updateStats();
    renderHeader();
    toast('Logged: ' + entry.name);
    return true;
}

// ── STATS ──
function updateStats() {
    setText('total-meals', String(state.mealLog.length));
    setText('week-meals', String(countLast7Days(state.mealLog)));
    setText('streak-days', String(streakDays(state.mealLog)));
}

// ── LOG HISTORY ──
function renderLogHistory() {
    const list = document.getElementById('log-history');
    const more = document.getElementById('log-more');
    if (!list) return;
    if (state.mealLog.length === 0) {
        list.replaceChildren(el('li', { className: 'empty-log', text: 'No meals logged yet. Tap "I Ate This" on one of today\'s meals to start.' }));
        more.hidden = true;
        return;
    }
    const shown = state.mealLog.slice(0, CONFIG.LOG_DISPLAY_LIMIT);
    list.replaceChildren(...shown.map(entry => {
        const d = new Date(entry.date);
        const when = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
        const info = el('div', { className: 'log-entry-info' }, [
            el('div', { className: 'log-entry-name', text: entry.name }),
            el('div', { className: 'log-entry-meta', text: when }),
        ]);
        if (entry.notes) info.append(el('div', { className: 'log-entry-notes', text: entry.notes }));
        return el('li', { className: 'log-entry' }, [
            info,
            el('span', { className: `log-entry-type type-${entry.type.toLowerCase()}`, text: entry.type }),
        ]);
    }));
    const hiddenCount = state.mealLog.length - shown.length;
    more.hidden = hiddenCount <= 0;
    more.textContent = hiddenCount > 0 ? `Showing the latest ${shown.length}. Export the log to see all ${state.mealLog.length}.` : '';
}

// ── PROTEIN CHIPS ──
function initProteinChips() {
    const container = document.getElementById('protein-chips');
    if (!container) return;
    container.replaceChildren(...PROTEINS.map(p => {
        const btn = el('button', { className: 'protein-chip', attrs: { type: 'button', 'aria-pressed': 'false', 'data-id': p.id } }, [
            el('span', { className: 'protein-icon', text: p.icon, attrs: { 'aria-hidden': 'true' } }),
            document.createTextNode(p.label),
        ]);
        btn.addEventListener('click', () => {
            const pressed = btn.getAttribute('aria-pressed') !== 'true';
            btn.setAttribute('aria-pressed', String(pressed));
            btn.classList.toggle('selected', pressed);
        });
        return btn;
    }));
}

function getSelectedProteins() {
    return Array.from(document.querySelectorAll('.protein-chip[aria-pressed="true"]')).map(b => b.dataset.id);
}

function selectedFindType() {
    const v = document.getElementById('find-meal-type')?.value;
    return MEAL_TYPES.includes(v) ? v : 'any';
}

// ── FIND MEALS ──
function hint(text, className = 'protein-hint') {
    return el('p', { className, text });
}

function findMealsByProtein() {
    const selected = getSelectedProteins();
    const resultEl = document.getElementById('protein-result');
    if (!resultEl) return;
    if (selected.length === 0) {
        resultEl.replaceChildren(hint('Select at least one protein above.'));
        return;
    }
    const type = selectedFindType();
    const candidates = state.meals.filter(m => (type === 'any' || m.type === type) && mealMatchesProteins(m, selected));
    const { allowed, excluded } = filterMeals(candidates, state.settings);

    const nodes = [];
    if (allowed.length === 0) {
        nodes.push(hint(candidates.length
            ? 'Every matching recipe is hidden by your Avoid settings. Change them in Settings or try another protein.'
            : 'No recipes found. Try another protein or the AI generator.'));
    } else {
        nodes.push(el('p', { className: 'protein-found-note' }, [
            el('i', { className: 'fas fa-check-circle', attrs: { 'aria-hidden': 'true' } }),
            document.createTextNode(` ${allowed.length} recipe${allowed.length > 1 ? 's' : ''} found`),
        ]));
        nodes.push(el('div', { className: 'protein-match-grid' }, allowed.map(matchCard)));
    }
    if (excluded.length) {
        nodes.push(hint(`${excluded.length} more hidden by your Avoid settings.`, 'protein-hint small'));
    }
    resultEl.replaceChildren(...nodes);
}

function matchCard(meal) {
    const view = el('button', { className: 'btn-view-match', attrs: { type: 'button' } }, [
        el('i', { className: 'fas fa-utensils', attrs: { 'aria-hidden': 'true' } }),
        document.createTextNode(' View Recipe'),
    ]);
    view.addEventListener('click', () => openRecipeModal(meal));
    return el('div', { className: meal.source === 'ai' ? 'ai-meal-card' : 'protein-match-card' }, [
        ...(meal.source === 'ai' ? [el('div', { className: 'ai-badge', text: 'AI generated · unverified' })] : []),
        el('div', { className: `match-type-badge ${meal.type.toLowerCase()}`, text: meal.type }),
        el('h3', { text: meal.name }),
        el('div', { className: 'match-meta' }, [
            el('span', { text: meal.prepTime || '–' }),
            el('span', { text: meal.difficulty || '' }),
            el('span', { text: servingsLabel(meal) }),
        ]),
        ...(meal.source === 'ai' && meal.nutrition ? [el('p', { className: 'ai-nutrition', text: nutritionText(meal) })] : []),
        view,
    ]);
}

// ── AI GENERATE ──
async function generateWithAI() {
    const selected = getSelectedProteins();
    const btn = document.getElementById('generate-ai-btn');
    const aiEl = document.getElementById('ai-result');
    if (!aiEl || !btn) return;
    if (!state.aiConsent) {
        aiEl.replaceChildren(hint('Read the note about the AI generator and tick the box first.'));
        document.getElementById('ai-consent-check')?.focus();
        return;
    }
    if (selected.length === 0) {
        aiEl.replaceChildren(hint('Select a protein first so the AI knows what to work with.'));
        return;
    }
    if (state.aiRequest) state.aiRequest.abort();
    const controller = new AbortController();
    state.aiRequest = controller;
    const timer = setTimeout(() => controller.abort(), CONFIG.AI_TIMEOUT_MS);

    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    aiEl.replaceChildren(el('div', { className: 'ai-loading', text: 'Writing a recipe… this can take up to 30 seconds.' }));

    const s = state.settings;
    try {
        const res = await fetch('/api/generate-meal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                proteins: selected,
                mealType: selectedFindType(),
                preferences: {
                    carbTolerance: s.carbTolerance,
                    avoidGout: s.avoidGout,
                    prioritizeHeart: s.prioritizeHeart,
                    budget: s.budget,
                    calorieTarget: s.calorieTarget,
                    proteinTarget: s.proteinTarget,
                },
            }),
            signal: controller.signal,
        });
        let data = null;
        try { data = await res.json(); } catch { data = null; }
        if (state.aiRequest !== controller) return; // a newer request replaced this one
        if (!res.ok) {
            const nodes = [hint(typeof data?.error === 'string' ? data.error : 'The AI generator is not available right now.', 'protein-hint error')];
            if (Array.isArray(data?.reasons)) {
                nodes.push(el('ul', { className: 'ai-reasons' }, data.reasons.slice(0, 5).map(r => el('li', { text: String(r) }))));
            }
            aiEl.replaceChildren(...nodes);
            return;
        }
        const meal = normalizeMeal({ ...(data?.meal || {}), source: 'ai' });
        if (!meal || safetyIssues(meal).length > 0) {
            aiEl.replaceChildren(hint('The AI response could not be used. Please try again.', 'protein-hint error'));
            return;
        }
        aiEl.replaceChildren(matchCard(meal));
    } catch (err) {
        if (state.aiRequest !== controller) return;
        aiEl.replaceChildren(hint(err?.name === 'AbortError'
            ? 'The AI took too long to respond. Please try again.'
            : 'Could not reach the AI generator. Check your connection and try again.', 'protein-hint error'));
    } finally {
        clearTimeout(timer);
        if (state.aiRequest === controller) {
            state.aiRequest = null;
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
        }
    }
}

// ── SETTINGS ──
function applySettingsToUI() {
    const s = state.settings;
    setRadio('carbTolerance', s.carbTolerance);
    setRadio('budget', s.budget);
    const calEl = document.getElementById('calorie-target');
    const proEl = document.getElementById('protein-target');
    if (calEl) { calEl.value = String(s.calorieTarget); setText('calorie-display', s.calorieTarget + ' kcal'); }
    if (proEl) { proEl.value = String(s.proteinTarget); setText('protein-display', s.proteinTarget + 'g'); }
    const gout = document.getElementById('avoid-gout');
    const heart = document.getElementById('prioritize-heart');
    if (gout) gout.checked = s.avoidGout;
    if (heart) heart.checked = s.prioritizeHeart;
    const consent = document.getElementById('ai-consent-check');
    if (consent) consent.checked = state.aiConsent;
}

function readSettingsFromUI() {
    return normalizeSettings({
        carbTolerance: getRadio('carbTolerance'),
        budget: getRadio('budget'),
        calorieTarget: document.getElementById('calorie-target')?.value,
        proteinTarget: document.getElementById('protein-target')?.value,
        avoidGout: document.getElementById('avoid-gout')?.checked,
        prioritizeHeart: document.getElementById('prioritize-heart')?.checked,
    });
}

// ── BINDINGS ──
function bindNav() {
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
            document.querySelectorAll('.tab-pane').forEach(p => { p.classList.remove('active'); p.hidden = true; });
            btn.classList.add('active');
            btn.setAttribute('aria-current', 'page');
            const pane = document.getElementById('tab-' + btn.dataset.tab);
            if (pane) {
                pane.hidden = false;
                pane.classList.add('active');
                document.getElementById('main')?.scrollTo(0, 0);
            }
        });
    });
}

function bindTodayTab() {
    ['breakfast', 'lunch', 'dinner'].forEach(type => {
        on('view-' + type, 'click', () => openRecipeModal(state.todayMeals[type]));
        on('log-' + type, 'click', () => logMeal(state.todayMeals[type]));
    });
    on('refresh-meals', 'click', shuffleMeals);
}

function bindFindTab() {
    on('find-meal-btn', 'click', findMealsByProtein);
    on('generate-ai-btn', 'click', generateWithAI);
    on('ai-consent-check', 'change', e => {
        state.aiConsent = e.target.checked;
        saveState();
    });
}

function bindLogTab() {
    on('log-manual', 'click', () => openModal('custom-meal-modal', 'custom-meal-name'));
    on('export-data', 'click', exportLog);
    on('custom-meal-form', 'submit', e => { e.preventDefault(); saveCustomMeal(); });
    on('close-custom-modal', 'click', () => closeModal('custom-meal-modal'));
}

function bindSettingsTab() {
    on('settings-form', 'submit', e => {
        e.preventDefault();
        const previous = state.settings;
        state.settings = readSettingsFromUI();
        if (!saveState()) { state.settings = previous; return; }
        applySettingsToUI();
        selectMeals();
        renderTodayMeals();
        toast('Settings saved');
    });
    on('calorie-target', 'input', e => setText('calorie-display', e.target.value + ' kcal'));
    on('protein-target', 'input', e => setText('protein-display', e.target.value + 'g'));
    on('reset-data', 'click', () => {
        if (!confirm('Delete all logged meals and settings from this device? This cannot be undone.')) return;
        state.mealLog = [];
        state.settings = { ...DEFAULT_SETTINGS };
        state.aiConsent = false;
        try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch { /* nothing stored */ }
        applySettingsToUI();
        selectMeals();
        renderTodayMeals();
        renderLogHistory();
        updateStats();
        toast('All data deleted from this device');
    });
}

function bindModals() {
    on('close-modal', 'click', () => closeModal('recipe-modal'));
    on('log-modal-meal', 'click', () => {
        if (logMeal(state.currentModalMeal)) closeModal('recipe-modal');
    });
    document.querySelectorAll('dialog.modal').forEach(dialog => {
        // Click on the backdrop (outside the sheet) closes the dialog.
        dialog.addEventListener('click', e => { if (e.target === dialog) closeModal(dialog.id); });
        dialog.addEventListener('close', () => {
            const target = state.lastFocus;
            state.lastFocus = null;
            if (target && document.contains(target)) target.focus();
        });
    });
}

// ── CUSTOM MEAL ──
function saveCustomMeal() {
    const nameEl = document.getElementById('custom-meal-name');
    const notesEl = document.getElementById('custom-meal-notes');
    const name = nameEl.value.trim();
    if (!name) {
        nameEl.setAttribute('aria-invalid', 'true');
        nameEl.focus();
        toast('Please enter a meal name.', 'error');
        return;
    }
    nameEl.removeAttribute('aria-invalid');
    const type = getRadio('customMealType') || 'Snack';
    if (!logMeal({ id: 'custom-' + Date.now(), name, type }, notesEl.value.trim())) return;
    nameEl.value = '';
    notesEl.value = '';
    closeModal('custom-meal-modal');
}

// ── EXPORT ──
function exportLog() {
    if (state.mealLog.length === 0) { toast('No meals to export yet.'); return; }
    const blob = new Blob(['﻿' + logToCsv(state.mealLog)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meal-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Log exported');
}

// ── SERVICE WORKER ──
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(err => {
        console.warn('Offline support is unavailable:', err?.message || err);
    });
}

// ── UTILITIES ──
function el(tag, { className, text, attrs } = {}, children = []) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (children.length) node.append(...children);
    return node;
}
function setText(id, text) { const n = document.getElementById(id); if (n) n.textContent = text; }
function replaceChildren(id, nodes) { const n = document.getElementById(id); if (n) n.replaceChildren(...nodes); }
function on(id, evt, fn) { const n = document.getElementById(id); if (n) n.addEventListener(evt, fn); }

function setRadio(name, value) {
    document.querySelectorAll(`input[type="radio"][name="${name}"]`).forEach(r => { r.checked = r.value === value; });
}
function getRadio(name) {
    return document.querySelector(`input[type="radio"][name="${name}"]:checked`)?.value || null;
}

function openModal(id, focusId) {
    const dialog = document.getElementById(id);
    if (!dialog || dialog.open) return;
    state.lastFocus = document.activeElement;
    dialog.showModal();
    const target = focusId ? document.getElementById(focusId) : dialog.querySelector('.modal-close');
    target?.focus();
}
function closeModal(id) {
    const dialog = document.getElementById(id);
    if (dialog?.open) dialog.close();
}

let toastTimer;
function toast(msg, kind = 'info') {
    const box = document.getElementById('toast');
    const tx = document.getElementById('toast-text');
    if (!box || !tx) return;
    tx.textContent = msg;
    box.classList.toggle('error', kind === 'error');
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 3500);
}

// ── START ──
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
