// Insulin-Smart Meal Hub - Main JavaScript
// Bulletproof Version v1.1.5 - Final Fix April 12, 2026
function initApp() {
    console.log("App Initializing...");

    // Configuration
    const CONFIG = {
        GOOGLE_SHEET_ID: '1yBxlRrZEjBy0z5A7K0T5UihVo3PmWVfm',
        SHEET_NAME: '21 Recipes',
        FALLBACK_DATA_URL: 'fallback-data.json',
        STORAGE_KEY: 'insulinMealHubData',
    };

    // Hardcoded Fallback Data (9 Meals)
    const EMBEDDED_MEALS = [
        { "Meal ID": "BF001", "Meal Name": "Jamaican Ackee & Scrambled Eggs", "Type": "Breakfast", "Prep Time": "15 min", "Ingredients": "1 cup ackee, 2 eggs, bell pepper, onion, olive oil", "Instructions": "1. Sauté veggies. 2. Add ackee. 3. Scramble eggs. 4. Mix.", "Insulin Benefits": "High protein and healthy fats for stable glucose.", "Nutrition Notes": "420 cal | 28g protein | 12g carbs", "Tags": "Jamaican, Protein" },
        { "Meal ID": "BF002", "Meal Name": "Callaloo & Sweet Potato Hash", "Type": "Breakfast", "Prep Time": "20 min", "Ingredients": "2 cups callaloo, 1 small sweet potato, thyme, garlic", "Instructions": "1. Steam potato. 2. Sauté callaloo with spices. 3. Combine.", "Insulin Benefits": "Fiber-rich greens paired with slow-release carbs.", "Nutrition Notes": "310 cal | 8g protein | 35g carbs", "Tags": "Fiber, Jamaican" },
        { "Meal ID": "BF003", "Meal Name": "Coconut Chia Pudding with Mango", "Type": "Breakfast", "Prep Time": "10 min", "Ingredients": "1/4 cup chia, 1 cup coconut milk, 1/2 mango", "Instructions": "1. Mix chia and milk. 2. Chill overnight. 3. Top with mango.", "Insulin Benefits": "Omega-3 fats and fiber prevent sugar spikes.", "Nutrition Notes": "380 cal | 12g protein | 25g carbs", "Tags": "Vegan, Brain Health" },
        { "Meal ID": "LH001", "Meal Name": "Steamed Fish with Okra & Pumpkin", "Type": "Lunch", "Prep Time": "25 min", "Ingredients": "1 whole snapper, 6 okras, 1 cup pumpkin, scallion", "Instructions": "1. Season fish. 2. Steam with pumpkin and okra 15 min.", "Insulin Benefits": "Low-fat protein with mucilage from okra for digestion.", "Nutrition Notes": "350 cal | 45g protein | 15g carbs", "Tags": "Heart Healthy, Low Carb" },
        { "Meal ID": "LH002", "Meal Name": "Jerk Chicken Breast over Spinach Salad", "Type": "Lunch", "Prep Time": "20 min", "Ingredients": "1 chicken breast, jerk spices, 3 cups spinach, avocado", "Instructions": "1. Grill chicken. 2. Slice over spinach. 3. Add avocado.", "Insulin Benefits": "Lean protein and healthy fats for metabolic support.", "Nutrition Notes": "450 cal | 42g protein | 10g carbs", "Tags": "High Protein, Keto" },
        { "Meal ID": "LH003", "Meal Name": "Curried Chickpea & Spinach", "Type": "Lunch", "Prep Time": "15 min", "Ingredients": "1 can chickpeas, 2 cups spinach, curry powder, onion", "Instructions": "1. Sauté onion. 2. Add chickpeas and curry. 3. Wilt spinach.", "Insulin Benefits": "Plant-based protein and high fiber for satiety.", "Nutrition Notes": "320 cal | 15g protein | 40g carbs", "Tags": "Vegan, Fiber" },
        { "Meal ID": "DN001", "Meal Name": "Grilled Red Snapper with Veggies", "Type": "Dinner", "Prep Time": "30 min", "Ingredients": "Snapper fillet, broccoli, carrots, lemon, olive oil", "Instructions": "1. Grill fish 5 min per side. 2. Steam vegetables.", "Insulin Benefits": "Excellent protein-to-carb ratio for evening stability.", "Nutrition Notes": "380 cal | 40g protein | 12g carbs", "Tags": "Omega-3, Light" },
        { "Meal ID": "DN002", "Meal Name": "Jamaican Brown Stew Tofu", "Type": "Dinner", "Prep Time": "25 min", "Ingredients": "1 block firm tofu, browning, onion, garlic, pimento", "Instructions": "1. Brown tofu cubes. 2. Simmer with onion and garlic gravy.", "Insulin Benefits": "Plant protein alternative with rich Jamaican spices.", "Nutrition Notes": "290 cal | 22g protein | 18g carbs", "Tags": "Vegetarian, Jamaican" },
        { "Meal ID": "DN003", "Meal Name": "Herb-Crusted Roasted Turkey Breast", "Type": "Dinner", "Prep Time": "45 min", "Ingredients": "Turkey breast, rosemary, thyme, garlic, olive oil", "Instructions": "1. Rub with herbs. 2. Roast at 375F until cooked through.", "Insulin Benefits": "Very lean protein, perfect for muscle repair and HR.", "Nutrition Notes": "320 cal | 48g protein | 5g carbs", "Tags": "Lean Protein, Low Cal" }
    ];

    // DOM Elements - Initialized early
    const elements = {
        currentDate: document.getElementById('current-date'),
        mealCount: document.getElementById('meal-count'),
        totalMeals: document.getElementById('total-meals'),
        avgRating: document.getElementById('avg-rating'),
        
        breakfastName: document.getElementById('breakfast-name'),
        breakfastTime: document.getElementById('breakfast-time'),
        breakfastTags: document.getElementById('breakfast-tags'),
        breakfastBenefit: document.getElementById('breakfast-benefit'),
        viewBreakfastBtn: document.getElementById('view-breakfast'),
        logBreakfastBtn: document.getElementById('log-breakfast'),
        
        lunchName: document.getElementById('lunch-name'),
        lunchTime: document.getElementById('lunch-time'),
        lunchTags: document.getElementById('lunch-tags'),
        lunchBenefit: document.getElementById('lunch-benefit'),
        viewLunchBtn: document.getElementById('view-lunch'),
        logLunchBtn: document.getElementById('log-lunch'),
        
        dinnerName: document.getElementById('dinner-name'),
        dinnerTime: document.getElementById('dinner-time'),
        dinnerTags: document.getElementById('dinner-tags'),
        dinnerBenefit: document.getElementById('dinner-benefit'),
        viewDinnerBtn: document.getElementById('view-dinner'),
        logDinnerBtn: document.getElementById('log-dinner'),
        
        recipeModal: document.getElementById('recipe-modal'),
        closeModalBtn: document.getElementById('close-modal'),
        modalMealName: document.getElementById('modal-meal-name'),
        modalPrepTime: document.getElementById('modal-prep-time'),
        modalIngredients: document.getElementById('modal-ingredients'),
        modalInstructions: document.getElementById('modal-instructions'),
        modalBenefits: document.getElementById('modal-benefits'),
        modalNutrition: document.getElementById('modal-nutrition'),
        logModalMealBtn: document.getElementById('log-modal-meal'),
        
        refreshBtn: document.getElementById('refresh-meals'),
        applySettingsBtn: document.getElementById('apply-settings'),
        budgetSelect: document.getElementById('budget'),
        calorieTargetInput: document.getElementById('calorie-target'),
        toggleSettingsBtn: document.getElementById('toggle-settings'),
        
        notification: document.getElementById('notification'),
        notificationText: document.getElementById('notification-text')
    };

    // Protein source definitions
    const PROTEINS = [
        { id: 'chicken',  label: 'Chicken',   icon: '🍗', keywords: ['chicken'] },
        { id: 'fish',     label: 'Fish',       icon: '🐟', keywords: ['fish', 'snapper', 'tilapia', 'cod', 'mackerel'] },
        { id: 'eggs',     label: 'Eggs',       icon: '🥚', keywords: ['egg', 'eggs'] },
        { id: 'tuna',     label: 'Tuna',       icon: '🫙', keywords: ['tuna'] },
        { id: 'sardines', label: 'Sardines',   icon: '🐡', keywords: ['sardine', 'sardines'] },
        { id: 'salmon',   label: 'Salmon',     icon: '🍣', keywords: ['salmon'] },
        { id: 'shrimp',   label: 'Shrimp',     icon: '🦐', keywords: ['shrimp', 'prawn'] },
        { id: 'turkey',   label: 'Turkey',     icon: '🦃', keywords: ['turkey'] },
        { id: 'tofu',     label: 'Tofu',       icon: '🧆', keywords: ['tofu'] },
        { id: 'beef',     label: 'Beef',       icon: '🥩', keywords: ['beef', 'steak', 'ground beef', 'mince'] },
        { id: 'pork',     label: 'Pork',       icon: '🥓', keywords: ['pork', 'bacon'] },
        { id: 'ackee',    label: 'Ackee',      icon: '🍳', keywords: ['ackee'] },
    ];

    // State object
    const state = {
        meals: [...EMBEDDED_MEALS], // Start with embedded data
        todayMeals: { breakfast: null, lunch: null, dinner: null },
        mealLog: [],
        settings: { budget: 'medium', calorieTarget: 500, proteinTarget: 35 },
        currentModalMeal: null
    };
    window.appState = state; // For debugging

    // Core Functions
    function updateUI() {
        if (elements.currentDate) elements.currentDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        
        ['breakfast', 'lunch', 'dinner'].forEach(type => {
            const meal = state.todayMeals[type];
            if (!meal || !elements[`${type}Name`]) return;
            
            elements[`${type}Name`].textContent = meal['Meal Name'];
            elements[`${type}Time`].textContent = meal['Prep Time'] || '20 min';
            elements[`${type}Benefit`].textContent = meal['Insulin Benefits'];
            
            const tagsCont = elements[`${type}Tags`];
            if (tagsCont) {
                tagsCont.innerHTML = '';
                (meal.Tags || '').split(',').forEach(t => {
                    const span = document.createElement('span');
                    span.className = 'tag';
                    span.textContent = t.trim();
                    tagsCont.appendChild(span);
                });
            }
        });

        if (elements.totalMeals) elements.totalMeals.textContent = state.mealLog.length;
        if (elements.mealCount) elements.mealCount.textContent = `${state.mealLog.length} meals logged`;
    }

    function selectMeals() {
        const day = new Date().getDate();
        ['Breakfast', 'Lunch', 'Dinner'].forEach(type => {
            const filtered = state.meals.filter(m => m.Type === type);
            if (filtered.length > 0) {
                const idx = day % filtered.length;
                state.todayMeals[type.toLowerCase()] = filtered[idx];
            }
        });
    }

    function showRecipe(type, meal) {
        if (!meal) meal = state.todayMeals[type];
        if (!meal) return;
        state.currentModalMeal = meal;
        
        elements.modalMealName.textContent = meal['Meal Name'];
        elements.modalPrepTime.textContent = meal['Prep Time'];
        const servingsEl = document.getElementById('modal-servings');
        const difficultyEl = document.getElementById('modal-difficulty');
        if (servingsEl) servingsEl.textContent = meal['Servings'] || '1';
        if (difficultyEl) difficultyEl.textContent = meal['Difficulty'] || 'Easy';
        const ingredientText = meal.Ingredients || '';
        const ingredientLines = ingredientText.includes('\n')
            ? ingredientText.split('\n').filter(l => l.trim())
            : ingredientText.split(',').map(i => i.trim()).filter(Boolean);
        elements.modalIngredients.innerHTML = ingredientLines.map(i => `<p>• ${i.replace(/^[-•]\s*/, '')}</p>`).join('');
        elements.modalInstructions.innerHTML = (meal.Instructions || 'Follow recipe steps.').split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('');
        elements.modalBenefits.textContent = meal['Insulin Benefits'];
        elements.modalNutrition.textContent = meal['Nutrition Notes'];
        
        elements.recipeModal.style.display = 'block';
    }

    function logMeal(mealOrType) {
        const meal = typeof mealOrType === 'string' ? state.todayMeals[mealOrType] : mealOrType;
        if (!meal) return;
        
        state.mealLog.push({ id: Date.now(), mealId: meal['Meal ID'], name: meal['Meal Name'], date: new Date().toISOString() });
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.mealLog));
        showNotification(`Logged: ${meal['Meal Name']}`);
        updateUI();
    }

    function showNotification(msg) {
        if (!elements.notification) return;
        elements.notificationText.textContent = msg;
        elements.notification.classList.add('show');
        setTimeout(() => elements.notification.classList.remove('show'), 3000);
    }

    async function init() {
        // 1. Initial Selection with Embedded Data
        selectMeals();
        updateUI();
        
        // 2. Setup Events
        setupEvents();
        initProteinFinder();

        // 3. Load Persistent Data
        const savedLog = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (savedLog) {
            state.mealLog = JSON.parse(savedLog);
            updateUI();
        }

        // 4. Try Network Fetch (Progressive Enhancement)
        try {
            const url = `https://docs.google.com/spreadsheets/d/${CONFIG.GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(CONFIG.SHEET_NAME)}`;
            const res = await fetch(url);
            const text = await res.text();
            const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
            const json = JSON.parse(jsonStr);
            const rows = json.table.rows;
            const headers = rows[0].c.map(c => c?.v || '');
            
            const newMeals = rows.slice(1).map(row => {
                const meal = {};
                row.c.forEach((cell, i) => { if (headers[i]) meal[headers[i]] = cell?.v || ''; });
                return meal;
            });

            if (newMeals.length > 5) {
                state.meals = newMeals;
                selectMeals();
                updateUI();
                console.log("Loaded fresh data from Sheets");
            }
        } catch (e) {
            console.warn("Sheets fetch skipped/failed, using local fallback");
            try {
                const res = await fetch(CONFIG.FALLBACK_DATA_URL);
                const data = await res.json();
                if (data.meals) {
                    state.meals = data.meals;
                    selectMeals();
                    updateUI();
                }
            } catch (e2) {
                console.error("All fetches failed, remaining on embedded data");
            }
        }
    }

    function initProteinFinder() {
        const container = document.getElementById('protein-chips');
        if (!container) return;
        container.innerHTML = '';
        PROTEINS.forEach(p => {
            const chip = document.createElement('button');
            chip.className = 'protein-chip';
            chip.dataset.id = p.id;
            chip.innerHTML = `<span class="protein-icon">${p.icon}</span>${p.label}`;
            chip.onclick = () => chip.classList.toggle('selected');
            container.appendChild(chip);
        });
    }

    function findMealsByProtein() {
        const selected = Array.from(document.querySelectorAll('.protein-chip.selected'))
            .map(el => el.dataset.id);

        const resultEl = document.getElementById('protein-result');
        if (!resultEl) return;

        if (selected.length === 0) {
            resultEl.innerHTML = '<p class="protein-hint">Select at least one protein above.</p>';
            resultEl.style.display = 'block';
            return;
        }

        const keywords = selected.flatMap(id => PROTEINS.find(p => p.id === id)?.keywords || []);

        const matches = state.meals.filter(meal => {
            const text = (meal.Ingredients + ' ' + meal['Meal Name']).toLowerCase();
            return keywords.some(kw => text.includes(kw));
        });

        if (matches.length === 0) {
            resultEl.innerHTML = `<p class="protein-hint">No meals found for those proteins yet. Try a different combination.</p>`;
            resultEl.style.display = 'block';
            return;
        }

        // Group by meal type, show up to one per type
        const byType = { Breakfast: null, Lunch: null, Dinner: null };
        matches.forEach(m => { if (!byType[m.Type]) byType[m.Type] = m; });

        const cards = Object.entries(byType)
            .filter(([, meal]) => meal)
            .map(([type, meal]) => `
                <div class="protein-match-card">
                    <div class="match-type-badge ${type.toLowerCase()}">${type}</div>
                    <h4>${meal['Meal Name']}</h4>
                    <div class="match-meta">
                        <span><i class="fas fa-clock"></i> ${meal['Prep Time'] || '20 min'}</span>
                        <span><i class="fas fa-signal"></i> ${meal['Difficulty'] || 'Easy'}</span>
                    </div>
                    <p class="match-benefit">${meal['Insulin Benefits']}</p>
                    <button class="btn-view match-recipe-btn" data-meal-id="${meal['Meal ID']}">
                        <i class="fas fa-utensils"></i> View Recipe
                    </button>
                </div>
            `).join('');

        resultEl.innerHTML = `
            <p class="protein-found-note"><i class="fas fa-check-circle"></i> Found ${matches.length} meal${matches.length > 1 ? 's' : ''} matching your proteins</p>
            <div class="protein-match-grid">${cards}</div>
        `;
        resultEl.style.display = 'block';

        // Wire View Recipe buttons
        resultEl.querySelectorAll('.match-recipe-btn').forEach(btn => {
            btn.onclick = () => {
                const meal = state.meals.find(m => m['Meal ID'] === btn.dataset.mealId);
                if (meal) showRecipe(null, meal);
            };
        });
    }

    async function generateMealWithAI() {
        const selected = Array.from(document.querySelectorAll('.protein-chip.selected'))
            .map(el => el.dataset.id);

        const resultEl = document.getElementById('protein-result');
        const btn = document.getElementById('generate-ai-btn');
        if (!resultEl || !btn) return;

        if (selected.length === 0) {
            resultEl.innerHTML = '<p class="protein-hint">Select at least one protein so the AI knows what you have.</p>';
            resultEl.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

        let aiContainer = document.getElementById('ai-result-container');
        if (!aiContainer) {
            aiContainer = document.createElement('div');
            aiContainer.id = 'ai-result-container';
            resultEl.appendChild(aiContainer);
        }
        resultEl.style.display = 'block';
        aiContainer.innerHTML = '<div class="ai-loading"><i class="fas fa-spinner fa-spin"></i> Claude is building your meal...</div>';

        const preferences = {
            carbTolerance: document.getElementById('carb-tolerance')?.value || 'moderate',
            avoidGout: document.getElementById('avoid-gout')?.checked ?? true,
            prioritizeHeart: document.getElementById('prioritize-heart')?.checked ?? true,
            budget: document.getElementById('budget')?.value || 'medium',
            calorieTarget: parseInt(document.getElementById('calorie-target')?.value) || 500,
        };

        try {
            const res = await fetch('/api/generate-meal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proteins: selected, preferences })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'API error');
            }

            const meal = await res.json();
            const mealType = (meal.Type || 'Lunch').toLowerCase();

            aiContainer.innerHTML = `
                <div class="ai-meal-card">
                    <div class="ai-badge"><i class="fas fa-magic"></i> AI Generated for You</div>
                    <div class="match-type-badge ${mealType}">${meal.Type || 'Meal'}</div>
                    <h4>${meal['Meal Name']}</h4>
                    <div class="match-meta">
                        <span><i class="fas fa-clock"></i> ${meal['Prep Time'] || '25 min'}</span>
                        <span><i class="fas fa-signal"></i> ${meal['Difficulty'] || 'Easy'}</span>
                    </div>
                    <p class="match-benefit">${meal['Insulin Benefits']}</p>
                    <p style="font-size:13px; color:#6d28d9; margin-top:4px;">${meal['Nutrition Notes']}</p>
                    <button class="btn-view ai-view-btn" style="margin-top:12px; border-color:#d8b4fe; color:#7B2FBE; background:#f8f0ff;">
                        <i class="fas fa-utensils"></i> View Full Recipe
                    </button>
                </div>
            `;

            state.meals.push(meal);
            aiContainer.querySelector('.ai-view-btn').onclick = () => showRecipe(null, meal);

        } catch (err) {
            aiContainer.innerHTML = `<p class="protein-hint" style="color:#e53e3e;"><i class="fas fa-exclamation-circle"></i> ${err.message}</p>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-magic"></i> Generate with AI';
        }
    }

    function setupEvents() {
        if (elements.viewBreakfastBtn) elements.viewBreakfastBtn.onclick = () => showRecipe('breakfast');
        if (elements.viewLunchBtn) elements.viewLunchBtn.onclick = () => showRecipe('lunch');
        if (elements.viewDinnerBtn) elements.viewDinnerBtn.onclick = () => showRecipe('dinner');
        
        if (elements.logBreakfastBtn) elements.logBreakfastBtn.onclick = () => logMeal('breakfast');
        if (elements.logLunchBtn) elements.logLunchBtn.onclick = () => logMeal('lunch');
        if (elements.logDinnerBtn) elements.logDinnerBtn.onclick = () => logMeal('dinner');
        
        if (elements.closeModalBtn) elements.closeModalBtn.onclick = () => elements.recipeModal.style.display = 'none';
        
        if (elements.logModalMealBtn) elements.logModalMealBtn.onclick = () => {
            logMeal(state.currentModalMeal);
            elements.recipeModal.style.display = 'none';
        };
        
        if (elements.refreshBtn) elements.refreshBtn.onclick = () => {
            const offset = Math.floor(Math.random() * 10);
            ['Breakfast', 'Lunch', 'Dinner'].forEach(type => {
                const filtered = state.meals.filter(m => m.Type === type);
                if (filtered.length > 0) {
                    const idx = (new Date().getSeconds() + offset) % filtered.length;
                    state.todayMeals[type.toLowerCase()] = filtered[idx];
                }
            });
            updateUI();
            showNotification('New suggestions randomized!');
        };

        if (elements.toggleSettingsBtn) elements.toggleSettingsBtn.onclick = () => {
            const grid = document.getElementById('settings-grid');
            const btn = elements.toggleSettingsBtn;
            if (grid) {
                const hidden = grid.style.display === 'none';
                grid.style.display = hidden ? 'grid' : 'none';
                btn.innerHTML = hidden ? '<i class="fas fa-chevron-up"></i> Hide' : '<i class="fas fa-chevron-down"></i> Show';
            }
        };

        if (elements.applySettingsBtn) elements.applySettingsBtn.onclick = () => {
            const budget = elements.budgetSelect?.value || 'medium';
            const calorie = parseInt(elements.calorieTargetInput?.value) || 500;
            state.settings.budget = budget;
            state.settings.calorieTarget = calorie;
            selectMeals();
            updateUI();
            showNotification('Settings applied! Meals updated.');
        };

        const findBtn = document.getElementById('find-meal-btn');
        if (findBtn) findBtn.onclick = findMealsByProtein;

        const aiBtn = document.getElementById('generate-ai-btn');
        if (aiBtn) aiBtn.onclick = generateMealWithAI;
    }

    init();
}
            });
            updateUI();
            showNotification('New suggestions randomized!');
        };

        if (elements.toggleSettingsBtn) elements.toggleSettingsBtn.onclick = () => {
            const grid = document.getElementById('settings-grid');
            if (grid) grid.style.display = grid.style.display === 'none' ? 'grid' : 'none';
        };
    }

    init();
}

// Robust Loader
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}