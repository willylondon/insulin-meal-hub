// Insulin-Smart Meal Hub — v2.0
// Clean rewrite: dark premium UI, tab navigation, all interactions wired

(function () {
    const CONFIG = {
        GOOGLE_SHEET_ID: '1yBxlRrZEjBy0z5A7K0T5UihVo3PmWVfm',
        SHEET_NAME: '21 Recipes',
        FALLBACK_DATA_URL: 'fallback-data.json',
        STORAGE_KEY: 'insulinMealHubData_v2',
    };

    const EMBEDDED_MEALS = [
        { "Meal ID": "BF001", "Meal Name": "Jamaican Ackee & Scrambled Eggs", "Type": "Breakfast", "Prep Time": "15 min", "Servings": "1", "Difficulty": "Easy", "Ingredients": "- 1 cup ackee (fresh or canned)\n- 2 eggs\n- 1/4 bell pepper, diced\n- 1 scallion, chopped\n- 1 tsp olive oil\n- Black pepper to taste", "Instructions": "1. Heat oil in pan over medium heat\n2. Sauté pepper and scallion for 2 min\n3. Add ackee and warm through\n4. Push to side, scramble eggs\n5. Combine and season", "Insulin Benefits": "High protein and healthy fats help stabilize blood sugar and prevent morning spikes.", "Nutrition Notes": "~420 cal | 28g protein | 12g carbs | 4g fiber", "Tags": "Jamaican, High-protein, Low-carb" },
        { "Meal ID": "BF002", "Meal Name": "Callaloo & Sweet Potato Hash", "Type": "Breakfast", "Prep Time": "20 min", "Servings": "1", "Difficulty": "Easy", "Ingredients": "- 2 cups callaloo, chopped\n- 1 small sweet potato, diced\n- 1/4 onion, diced\n- 1 garlic clove\n- 1 tsp coconut oil\n- Thyme", "Instructions": "1. Steam sweet potato 10 min\n2. Heat oil, sauté onion and garlic\n3. Add callaloo, cook 5 min\n4. Add potato, mix and season", "Insulin Benefits": "Fiber-rich greens with slow-release carbs keep glucose steady for hours.", "Nutrition Notes": "~310 cal | 8g protein | 35g carbs | 8g fiber", "Tags": "Jamaican, Fiber, Vegan" },
        { "Meal ID": "BF003", "Meal Name": "Coconut Chia Pudding", "Type": "Breakfast", "Prep Time": "10 min", "Servings": "1", "Difficulty": "Easy", "Ingredients": "- 1/4 cup chia seeds\n- 1 cup coconut milk\n- 1/2 mango, diced\n- 1 tsp honey (optional)", "Instructions": "1. Mix chia and coconut milk\n2. Refrigerate overnight or 1 hour\n3. Top with mango before serving", "Insulin Benefits": "Omega-3 fats and soluble fiber slow glucose absorption and reduce spikes.", "Nutrition Notes": "~380 cal | 12g protein | 25g carbs | 10g fiber", "Tags": "Vegan, Omega-3, Prep-ahead" },
        { "Meal ID": "LH001", "Meal Name": "Steamed Fish with Okra & Pumpkin", "Type": "Lunch", "Prep Time": "25 min", "Servings": "1", "Difficulty": "Easy", "Ingredients": "- 1 whole snapper (or fillet)\n- 6 okras, sliced\n- 1 cup pumpkin, cubed\n- 2 scallions\n- Thyme, scotch bonnet\n- Salt, black pepper", "Instructions": "1. Season fish with salt and thyme\n2. Place in pot with okra and pumpkin\n3. Add scallion and scotch bonnet\n4. Steam over medium heat 15-20 min", "Insulin Benefits": "Lean fish protein with mucilaginous okra slows digestion and stabilizes glucose.", "Nutrition Notes": "~350 cal | 45g protein | 15g carbs | 5g fiber", "Tags": "Jamaican, Heart-healthy, Low-carb" },
        { "Meal ID": "LH002", "Meal Name": "Jerk Chicken over Spinach Salad", "Type": "Lunch", "Prep Time": "20 min", "Servings": "1", "Difficulty": "Easy", "Ingredients": "- 1 chicken breast\n- 2 tbsp jerk seasoning\n- 3 cups spinach\n- 1/2 avocado\n- Cherry tomatoes\n- Lime dressing", "Instructions": "1. Coat chicken with jerk seasoning\n2. Grill or pan-fry 6 min per side\n3. Slice and place over spinach\n4. Add avocado and tomatoes\n5. Dress with lime juice and olive oil", "Insulin Benefits": "Lean protein and healthy fats from avocado support steady metabolic function.", "Nutrition Notes": "~450 cal | 42g protein | 10g carbs | 7g fiber", "Tags": "High-protein, Keto, Jamaican" },
        { "Meal ID": "LH003", "Meal Name": "Curried Chickpea & Callaloo", "Type": "Lunch", "Prep Time": "15 min", "Servings": "1", "Difficulty": "Easy", "Ingredients": "- 1 can chickpeas, drained\n- 2 cups callaloo\n- 1 tbsp curry powder\n- 1/4 onion\n- 1 garlic clove\n- Coconut oil", "Instructions": "1. Sauté onion and garlic in oil\n2. Add curry powder, toast 1 min\n3. Add chickpeas, coat well\n4. Add callaloo, cook 5 min\n5. Season and serve", "Insulin Benefits": "Plant-based protein and high fiber content support steady glucose and long satiety.", "Nutrition Notes": "~320 cal | 15g protein | 40g carbs | 12g fiber", "Tags": "Vegan, High-fiber, Jamaican" },
        { "Meal ID": "DN001", "Meal Name": "Grilled Snapper with Steamed Veg", "Type": "Dinner", "Prep Time": "30 min", "Servings": "1", "Difficulty": "Easy", "Ingredients": "- 1 snapper fillet\n- Broccoli florets\n- Sliced carrots\n- Lemon juice\n- Olive oil, garlic\n- Fresh thyme", "Instructions": "1. Marinate fillet in lemon, garlic, thyme\n2. Grill 5 min per side\n3. Steam broccoli and carrots 8 min\n4. Plate with a drizzle of olive oil", "Insulin Benefits": "Excellent protein-to-carb ratio supports overnight fasting glucose stability.", "Nutrition Notes": "~380 cal | 40g protein | 12g carbs | 6g fiber", "Tags": "Omega-3, Low-carb, Heart-healthy" },
        { "Meal ID": "DN002", "Meal Name": "Jamaican Brown Stew Tofu", "Type": "Dinner", "Prep Time": "25 min", "Servings": "1", "Difficulty": "Medium", "Ingredients": "- 1 block firm tofu, cubed\n- 1 tbsp browning\n- 1 onion, sliced\n- 2 garlic cloves\n- Pimento berries, thyme\n- 1 tbsp soy sauce", "Instructions": "1. Press and cube tofu, pat dry\n2. Brown in oil until golden\n3. Add onion, garlic, pimento\n4. Stir in browning and soy sauce\n5. Simmer in 1/4 cup water 10 min", "Insulin Benefits": "Plant protein with complex Jamaican spices — no blood sugar spike, high satiety.", "Nutrition Notes": "~290 cal | 22g protein | 18g carbs | 4g fiber", "Tags": "Vegetarian, Jamaican, Plant-protein" },
        { "Meal ID": "DN003", "Meal Name": "Herb-Crusted Turkey Breast", "Type": "Dinner", "Prep Time": "40 min", "Servings": "1", "Difficulty": "Medium", "Ingredients": "- 1 turkey breast\n- Fresh rosemary and thyme\n- 3 garlic cloves, minced\n- 1 tbsp olive oil\n- Salt and black pepper", "Instructions": "1. Preheat oven to 375°F\n2. Mix herbs, garlic, oil into paste\n3. Rub all over turkey breast\n4. Roast 30-35 min until cooked through\n5. Rest 5 min before slicing", "Insulin Benefits": "Very lean protein ideal for evening — supports overnight muscle repair without glucose spike.", "Nutrition Notes": "~320 cal | 48g protein | 5g carbs | 1g fiber", "Tags": "Lean-protein, Low-carb, High-protein" }
    ];

    const PROTEINS = [
        { id: 'chicken',  label: 'Chicken',  icon: '🍗', keywords: ['chicken'] },
        { id: 'fish',     label: 'Fish',      icon: '🐟', keywords: ['fish', 'snapper', 'tilapia', 'cod', 'mackerel'] },
        { id: 'eggs',     label: 'Eggs',      icon: '🥚', keywords: ['egg', 'eggs'] },
        { id: 'tuna',     label: 'Tuna',      icon: '🫙', keywords: ['tuna'] },
        { id: 'sardines', label: 'Sardines',  icon: '🐡', keywords: ['sardine', 'sardines'] },
        { id: 'salmon',   label: 'Salmon',    icon: '🍣', keywords: ['salmon'] },
        { id: 'shrimp',   label: 'Shrimp',    icon: '🦐', keywords: ['shrimp', 'prawn'] },
        { id: 'turkey',   label: 'Turkey',    icon: '🦃', keywords: ['turkey'] },
        { id: 'tofu',     label: 'Tofu',      icon: '🧆', keywords: ['tofu'] },
        { id: 'beef',     label: 'Beef',      icon: '🥩', keywords: ['beef', 'steak', 'mince'] },
        { id: 'ackee',    label: 'Ackee',     icon: '🍳', keywords: ['ackee'] },
        { id: 'chickpea', label: 'Chickpeas', icon: '🫘', keywords: ['chickpea', 'chickpeas'] },
    ];

    const state = {
        meals: [...EMBEDDED_MEALS],
        todayMeals: { breakfast: null, lunch: null, dinner: null },
        mealLog: [],
        settings: { budget: 'medium', carbTolerance: 'moderate', calorieTarget: 500, proteinTarget: 30, weightGoal: 'moderate', avoidGout: true, prioritizeHeart: true },
        currentModalMeal: null,
        customMealType: 'Breakfast',
    };

    // ── INIT ──
    function init() {
        loadState();
        selectMeals();
        renderTodayMeals();
        renderLogHistory();
        updateStats();
        initProteinChips();
        bindNav();
        bindTodayTab();
        bindFindTab();
        bindLogTab();
        bindSettingsTab();
        bindModals();
        bindRangeInputs();
        bindToggles();
        fetchMeals();
    }

    // ── STATE ──
    function loadState() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.mealLog) state.mealLog = parsed.mealLog;
                if (parsed.settings) state.settings = { ...state.settings, ...parsed.settings };
            }
        } catch (e) { /* ignore */ }
        applySettingsToUI();
    }

    function saveState() {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ mealLog: state.mealLog, settings: state.settings }));
    }

    // ── MEAL SELECTION ──
    function selectMeals() {
        const seed = new Date().getDate();
        ['Breakfast', 'Lunch', 'Dinner'].forEach(type => {
            const pool = state.meals.filter(m => m.Type === type);
            if (pool.length > 0) state.todayMeals[type.toLowerCase()] = pool[seed % pool.length];
        });
    }

    function shuffleMeals() {
        const offset = Math.floor(Math.random() * 97);
        ['Breakfast', 'Lunch', 'Dinner'].forEach(type => {
            const pool = state.meals.filter(m => m.Type === type);
            if (pool.length > 0) state.todayMeals[type.toLowerCase()] = pool[(Date.now() + offset) % pool.length];
        });
        renderTodayMeals();
        toast('Meals shuffled!');
    }

    // ── RENDER TODAY ──
    function renderTodayMeals() {
        ['breakfast', 'lunch', 'dinner'].forEach(type => {
            const meal = state.todayMeals[type];
            if (!meal) return;
            setText(type + '-name', meal['Meal Name']);
            setText(type + '-time', meal['Prep Time'] || '20 min');
            setText(type + '-benefit', meal['Insulin Benefits']);
            const tagsEl = document.getElementById(type + '-tags');
            if (tagsEl) {
                tagsEl.innerHTML = (meal.Tags || '').split(',').map(t =>
                    `<span class="meal-tag">${t.trim()}</span>`).join('');
            }
        });
        setText('current-date', new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }));
        setText('meal-count', state.mealLog.length + ' meal' + (state.mealLog.length !== 1 ? 's' : '') + ' logged');
    }

    // ── RECIPE MODAL ──
    function openRecipeModal(meal) {
        if (!meal) return;
        state.currentModalMeal = meal;
        setText('modal-meal-name', meal['Meal Name']);
        setText('modal-prep-time', meal['Prep Time'] || '–');
        setText('modal-servings', meal['Servings'] || '1');
        setText('modal-difficulty', meal['Difficulty'] || 'Easy');

        const ingText = meal.Ingredients || '';
        const ingLines = ingText.includes('\n')
            ? ingText.split('\n').filter(l => l.trim())
            : ingText.split(',').map(s => s.trim()).filter(Boolean);
        document.getElementById('modal-ingredients').innerHTML =
            ingLines.map(l => `<p class="ing-line">• ${l.replace(/^[-•]\s*/, '')}</p>`).join('');

        document.getElementById('modal-instructions').innerHTML =
            (meal.Instructions || '').split('\n').filter(l => l.trim())
                .map(l => `<p class="ing-line">${l}</p>`).join('');

        setText('modal-benefits', meal['Insulin Benefits'] || '');
        setText('modal-nutrition', meal['Nutrition Notes'] || '');

        openModal('recipe-modal');
    }

    // ── LOG MEAL ──
    function logMeal(meal) {
        if (!meal) return;
        state.mealLog.unshift({
            id: Date.now(),
            mealId: meal['Meal ID'] || 'custom',
            name: meal['Meal Name'],
            type: meal.Type || 'Meal',
            date: new Date().toISOString(),
        });
        saveState();
        renderLogHistory();
        updateStats();
        setText('meal-count', state.mealLog.length + ' meal' + (state.mealLog.length !== 1 ? 's' : '') + ' logged');
        toast('Logged: ' + meal['Meal Name']);
    }

    // ── STATS ──
    function updateStats() {
        setText('total-meals', state.mealLog.length);

        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        const weekCount = state.mealLog.filter(e => new Date(e.date) >= weekStart).length;
        setText('week-meals', weekCount);

        // Streak: consecutive days with at least one meal logged
        const days = new Set(state.mealLog.map(e => e.date.split('T')[0]));
        let streak = 0;
        const d = new Date();
        while (days.has(d.toISOString().split('T')[0])) {
            streak++;
            d.setDate(d.getDate() - 1);
        }
        setText('streak-days', streak);
    }

    // ── LOG HISTORY ──
    function renderLogHistory() {
        const el = document.getElementById('log-history');
        if (!el) return;
        if (state.mealLog.length === 0) {
            el.innerHTML = '<p class="empty-log">No meals logged yet. Start by hitting "I Ate This" on Today\'s meals.</p>';
            return;
        }
        el.innerHTML = state.mealLog.slice(0, 20).map(entry => {
            const d = new Date(entry.date);
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            return `<div class="log-entry">
                <div class="log-entry-info">
                    <div class="log-entry-name">${entry.name}</div>
                    <div class="log-entry-meta">${dateStr} · ${timeStr}</div>
                </div>
                <span class="log-entry-type ${entry.type}">${entry.type}</span>
            </div>`;
        }).join('');
    }

    // ── PROTEIN CHIPS ──
    function initProteinChips() {
        const el = document.getElementById('protein-chips');
        if (!el) return;
        el.innerHTML = PROTEINS.map(p =>
            `<button class="protein-chip" data-id="${p.id}">
                <span class="protein-icon">${p.icon}</span>${p.label}
            </button>`
        ).join('');
        el.querySelectorAll('.protein-chip').forEach(btn => {
            btn.addEventListener('click', () => btn.classList.toggle('selected'));
        });
    }

    function getSelectedProteins() {
        return Array.from(document.querySelectorAll('.protein-chip.selected')).map(b => b.dataset.id);
    }

    // ── FIND MEALS ──
    function findMealsByProtein() {
        const selected = getSelectedProteins();
        const resultEl = document.getElementById('protein-result');
        if (!resultEl) return;
        if (selected.length === 0) {
            resultEl.innerHTML = '<p class="protein-hint">Select at least one protein above.</p>';
            return;
        }
        const keywords = selected.flatMap(id => PROTEINS.find(p => p.id === id)?.keywords || []);
        const matches = state.meals.filter(m => {
            const text = ((m.Ingredients || '') + ' ' + m['Meal Name']).toLowerCase();
            return keywords.some(kw => text.includes(kw));
        });
        if (matches.length === 0) {
            resultEl.innerHTML = '<p class="protein-hint">No meals found. Try the AI generator instead!</p>';
            return;
        }
        const byType = {};
        matches.forEach(m => { if (!byType[m.Type]) byType[m.Type] = m; });
        resultEl.innerHTML = `
            <p class="protein-found-note"><i class="fas fa-check-circle"></i> ${matches.length} match${matches.length > 1 ? 'es' : ''} found</p>
            <div class="protein-match-grid">
                ${Object.entries(byType).map(([type, meal]) => `
                    <div class="protein-match-card">
                        <div class="match-type-badge ${type.toLowerCase()}">${type}</div>
                        <h4>${meal['Meal Name']}</h4>
                        <div class="match-meta">
                            <span><i class="fas fa-clock"></i>${meal['Prep Time'] || '20 min'}</span>
                            <span><i class="fas fa-signal"></i>${meal['Difficulty'] || 'Easy'}</span>
                        </div>
                        <p class="match-benefit">${meal['Insulin Benefits']}</p>
                        <button class="btn-view-match" data-meal-id="${meal['Meal ID']}">
                            <i class="fas fa-utensils"></i> View Recipe
                        </button>
                    </div>`).join('')}
            </div>`;
        resultEl.querySelectorAll('.btn-view-match').forEach(btn => {
            btn.addEventListener('click', () => {
                const meal = state.meals.find(m => m['Meal ID'] === btn.dataset.mealId);
                if (meal) openRecipeModal(meal);
            });
        });
    }

    // ── AI GENERATE ──
    async function generateWithAI() {
        const selected = getSelectedProteins();
        const btn = document.getElementById('generate-ai-btn');
        const resultEl = document.getElementById('protein-result');
        if (!resultEl || !btn) return;
        if (selected.length === 0) {
            resultEl.innerHTML = '<p class="protein-hint">Select a protein first so the AI knows what to work with.</p>';
            return;
        }
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating…';

        let aiEl = document.getElementById('ai-result-container');
        if (!aiEl) {
            aiEl = document.createElement('div');
            aiEl.id = 'ai-result-container';
            resultEl.appendChild(aiEl);
        }
        aiEl.innerHTML = '<div class="ai-loading"><i class="fas fa-spinner fa-spin"></i> Claude is cooking something up…</div>';

        const preferences = {
            carbTolerance: state.settings.carbTolerance,
            avoidGout: state.settings.avoidGout,
            prioritizeHeart: state.settings.prioritizeHeart,
            budget: state.settings.budget,
            calorieTarget: state.settings.calorieTarget,
        };

        try {
            const res = await fetch('/api/generate-meal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proteins: selected, preferences }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'API error'); }
            const meal = await res.json();
            const mealType = (meal.Type || 'Lunch').toLowerCase();
            state.meals.push(meal);

            aiEl.innerHTML = `
                <div class="ai-meal-card">
                    <div class="ai-badge"><i class="fas fa-magic"></i> AI Generated</div>
                    <div class="match-type-badge ${mealType}">${meal.Type || 'Meal'}</div>
                    <h4>${meal['Meal Name']}</h4>
                    <div class="match-meta">
                        <span><i class="fas fa-clock"></i>${meal['Prep Time'] || '25 min'}</span>
                        <span><i class="fas fa-signal"></i>${meal['Difficulty'] || 'Easy'}</span>
                    </div>
                    <p class="match-benefit">${meal['Insulin Benefits']}</p>
                    <p class="ai-nutrition">${meal['Nutrition Notes']}</p>
                    <button class="btn-view-match ai-view-btn">
                        <i class="fas fa-utensils"></i> View Full Recipe
                    </button>
                </div>`;
            aiEl.querySelector('.ai-view-btn').addEventListener('click', () => openRecipeModal(meal));
        } catch (err) {
            aiEl.innerHTML = `<p class="protein-hint" style="color:#f87171"><i class="fas fa-exclamation-circle"></i> ${err.message}</p>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-magic"></i> Generate with AI';
        }
    }

    // ── SETTINGS ──
    function applySettingsToUI() {
        setSegment('seg-budget', state.settings.budget);
        setSegment('seg-carbs', state.settings.carbTolerance);
        const calEl = document.getElementById('calorie-target');
        const proEl = document.getElementById('protein-target');
        if (calEl) { calEl.value = state.settings.calorieTarget; setText('calorie-display', state.settings.calorieTarget + ' kcal'); }
        if (proEl) { proEl.value = state.settings.proteinTarget; setText('protein-display', state.settings.proteinTarget + 'g'); }
        const wgEl = document.getElementById('weight-loss-goal');
        if (wgEl) wgEl.value = state.settings.weightGoal;
        setToggle('toggle-gout', state.settings.avoidGout);
        setToggle('toggle-heart', state.settings.prioritizeHeart);
    }

    function readSettingsFromUI() {
        state.settings.budget = getSegmentValue('seg-budget') || 'medium';
        state.settings.carbTolerance = getSegmentValue('seg-carbs') || 'moderate';
        state.settings.calorieTarget = parseInt(document.getElementById('calorie-target')?.value) || 500;
        state.settings.proteinTarget = parseInt(document.getElementById('protein-target')?.value) || 30;
        state.settings.weightGoal = document.getElementById('weight-loss-goal')?.value || 'moderate';
        state.settings.avoidGout = document.getElementById('avoid-gout')?.checked ?? true;
        state.settings.prioritizeHeart = document.getElementById('prioritize-heart')?.checked ?? true;
    }

    // ── BINDINGS ──
    function bindNav() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const pane = document.getElementById('tab-' + btn.dataset.tab);
                if (pane) pane.classList.add('active');
            });
        });
    }

    function bindTodayTab() {
        on('view-breakfast', 'click', () => openRecipeModal(state.todayMeals.breakfast));
        on('view-lunch',     'click', () => openRecipeModal(state.todayMeals.lunch));
        on('view-dinner',    'click', () => openRecipeModal(state.todayMeals.dinner));
        on('log-breakfast',  'click', () => logMeal(state.todayMeals.breakfast));
        on('log-lunch',      'click', () => logMeal(state.todayMeals.lunch));
        on('log-dinner',     'click', () => logMeal(state.todayMeals.dinner));
        on('refresh-meals',  'click', shuffleMeals);
    }

    function bindFindTab() {
        on('find-meal-btn',    'click', findMealsByProtein);
        on('generate-ai-btn', 'click', generateWithAI);
    }

    function bindLogTab() {
        on('log-manual', 'click', () => openModal('custom-meal-modal'));
        on('export-data', 'click', exportLog);
        document.querySelectorAll('#seg-meal-type .seg-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#seg-meal-type .seg-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.customMealType = btn.dataset.val;
            });
        });
        on('save-custom-meal', 'click', saveCustomMeal);
        on('close-custom-modal', 'click', () => closeModal('custom-meal-modal'));
    }

    function bindSettingsTab() {
        document.querySelectorAll('#seg-budget .seg-btn, #seg-carbs .seg-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.closest('.seg-control');
                group.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        on('apply-settings', 'click', () => {
            readSettingsFromUI();
            saveState();
            selectMeals();
            renderTodayMeals();
            toast('Settings saved!');
        });
        on('reset-data', 'click', () => {
            if (confirm('Reset all logged meals and settings? This cannot be undone.')) {
                state.mealLog = [];
                state.settings = { budget: 'medium', carbTolerance: 'moderate', calorieTarget: 500, proteinTarget: 30, weightGoal: 'moderate', avoidGout: true, prioritizeHeart: true };
                saveState();
                applySettingsToUI();
                renderLogHistory();
                updateStats();
                toast('All data reset.');
            }
        });
    }

    function bindModals() {
        on('close-modal', 'click', () => closeModal('recipe-modal'));
        on('log-modal-meal', 'click', () => { logMeal(state.currentModalMeal); closeModal('recipe-modal'); });
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
        });
    }

    function bindRangeInputs() {
        const calEl = document.getElementById('calorie-target');
        if (calEl) calEl.addEventListener('input', () => setText('calorie-display', calEl.value + ' kcal'));
        const proEl = document.getElementById('protein-target');
        if (proEl) proEl.addEventListener('input', () => setText('protein-display', proEl.value + 'g'));
    }

    function bindToggles() {
        bindToggle('toggle-gout',  'avoid-gout');
        bindToggle('toggle-heart', 'prioritize-heart');
    }

    function bindToggle(trackId, checkboxId) {
        const track = document.getElementById(trackId)?.querySelector('.toggle-track');
        const cb    = document.getElementById(checkboxId);
        if (!track || !cb) return;
        track.addEventListener('click', () => {
            cb.checked = !cb.checked;
            track.classList.toggle('active', cb.checked);
        });
    }

    // ── CUSTOM MEAL ──
    function saveCustomMeal() {
        const name = document.getElementById('custom-meal-name')?.value.trim();
        if (!name) { toast('Please enter a meal name.'); return; }
        const notes = document.getElementById('custom-meal-notes')?.value.trim();
        logMeal({ 'Meal Name': name, Type: state.customMealType, 'Meal ID': 'custom-' + Date.now(), 'Insulin Benefits': notes || '' });
        document.getElementById('custom-meal-name').value = '';
        document.getElementById('custom-meal-notes').value = '';
        closeModal('custom-meal-modal');
    }

    // ── EXPORT ──
    function exportLog() {
        if (state.mealLog.length === 0) { toast('No meals to export yet.'); return; }
        const csv = ['Name,Type,Date'].concat(
            state.mealLog.map(e => `"${e.name}","${e.type}","${new Date(e.date).toLocaleDateString()}"`)
        ).join('\n');
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = 'meal-log.csv';
        a.click();
        toast('Log exported!');
    }

    // ── FETCH FROM SHEETS ──
    async function fetchMeals() {
        try {
            const url = `https://docs.google.com/spreadsheets/d/${CONFIG.GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(CONFIG.SHEET_NAME)}`;
            const res  = await fetch(url);
            const text = await res.text();
            const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
            const rows    = json.table.rows;
            const headers = rows[0].c.map(c => c?.v || '');
            const meals   = rows.slice(1).map(row => {
                const m = {};
                row.c.forEach((cell, i) => { if (headers[i]) m[headers[i]] = cell?.v || ''; });
                return m;
            }).filter(m => m['Meal Name']);
            if (meals.length > 5) {
                state.meals = meals;
                selectMeals();
                renderTodayMeals();
            }
        } catch (e) {
            try {
                const res  = await fetch(CONFIG.FALLBACK_DATA_URL);
                const data = await res.json();
                if (data.meals?.length > 5) {
                    state.meals = data.meals;
                    selectMeals();
                    renderTodayMeals();
                }
            } catch (e2) { /* stay on embedded */ }
        }
    }

    // ── UTILITIES ──
    function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
    function on(id, evt, fn)   { const el = document.getElementById(id); if (el) el.addEventListener(evt, fn); }

    function openModal(id)  { const el = document.getElementById(id); if (el) el.classList.add('open'); }
    function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }

    function setSegment(groupId, value) {
        document.querySelectorAll(`#${groupId} .seg-btn`).forEach(btn => {
            btn.classList.toggle('active', btn.dataset.val === value);
        });
    }
    function getSegmentValue(groupId) {
        return document.querySelector(`#${groupId} .seg-btn.active`)?.dataset.val || null;
    }
    function setToggle(trackId, active) {
        const track = document.getElementById(trackId)?.querySelector('.toggle-track');
        if (track) track.classList.toggle('active', active);
    }

    let toastTimer;
    function toast(msg) {
        const el = document.getElementById('toast');
        const tx = document.getElementById('toast-text');
        if (!el || !tx) return;
        tx.textContent = msg;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
    }

    // ── START ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
