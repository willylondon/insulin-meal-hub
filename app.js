// Insulin-Smart Meal Hub - Main JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const CONFIG = {
        GOOGLE_SHEET_ID: '1yBxlRrZEjBy0z5A7K0T5UihVo3PmWVfm',
        SHEET_NAME: '21 Recipes',
        FALLBACK_DATA_URL: 'fallback-data.json',
        MEAL_TYPES: ['Breakfast', 'Lunch', 'Dinner'],
        STORAGE_KEY: 'insulinMealHubData',
        NOTIFICATION_DURATION: 3000
    };

    // State
    let state = {
        meals: [],
        todayMeals: { breakfast: null, lunch: null, dinner: null },
        mealLog: [],
        stats: {
            totalMeals: 0,
            avgRating: 0,
            avgPrepTime: 0,
            topMeal: null
        }
    };

    // DOM Elements
    const elements = {
        // Date & Stats
        currentDate: document.getElementById('current-date'),
        mealCount: document.getElementById('meal-count'),
        totalMeals: document.getElementById('total-meals'),
        avgRating: document.getElementById('avg-rating'),
        avgPrep: document.getElementById('avg-prep'),
        topMeal: document.getElementById('top-meal'),
        
        // Breakfast Card
        breakfastName: document.getElementById('breakfast-name'),
        breakfastTime: document.getElementById('breakfast-time'),
        breakfastTags: document.getElementById('breakfast-tags'),
        breakfastBenefit: document.getElementById('breakfast-benefit'),
        viewBreakfastBtn: document.getElementById('view-breakfast'),
        logBreakfastBtn: document.getElementById('log-breakfast'),
        
        // Lunch Card
        lunchName: document.getElementById('lunch-name'),
        lunchTime: document.getElementById('lunch-time'),
        lunchTags: document.getElementById('lunch-tags'),
        lunchBenefit: document.getElementById('lunch-benefit'),
        viewLunchBtn: document.getElementById('view-lunch'),
        logLunchBtn: document.getElementById('log-lunch'),
        
        // Dinner Card
        dinnerName: document.getElementById('dinner-name'),
        dinnerTime: document.getElementById('dinner-time'),
        dinnerTags: document.getElementById('dinner-tags'),
        dinnerBenefit: document.getElementById('dinner-benefit'),
        viewDinnerBtn: document.getElementById('view-dinner'),
        logDinnerBtn: document.getElementById('log-dinner'),
        
        // Modal
        recipeModal: document.getElementById('recipe-modal'),
        closeModalBtn: document.getElementById('close-modal'),
        modalMealName: document.getElementById('modal-meal-name'),
        modalPrepTime: document.getElementById('modal-prep-time'),
        modalServings: document.getElementById('modal-servings'),
        modalDifficulty: document.getElementById('modal-difficulty'),
        modalIngredients: document.getElementById('modal-ingredients'),
        modalInstructions: document.getElementById('modal-instructions'),
        modalBenefits: document.getElementById('modal-benefits'),
        modalNutrition: document.getElementById('modal-nutrition'),
        logModalMealBtn: document.getElementById('log-modal-meal'),
        
        // Buttons
        refreshBtn: document.getElementById('refresh-meals'),
        viewAllBtn: document.getElementById('view-all'),
        logManualBtn: document.getElementById('log-manual'),
        exportBtn: document.getElementById('export-data'),
        
        // Notification
        notification: document.getElementById('notification'),
        notificationIcon: document.getElementById('notification-icon'),
        notificationText: document.getElementById('notification-text')
    };

    // Current meal being viewed in modal
    let currentModalMeal = null;

    // Initialize
    init();

    // ======================
    // INITIALIZATION
    // ======================
    async function init() {
        // Set current date
        updateDateDisplay();
        
        // Load data from localStorage
        loadLocalData();
        
        // Try to load meals from Google Sheets
        try {
            await loadMealsFromGoogleSheets();
        } catch (error) {
            console.warn('Could not load from Google Sheets, using fallback:', error);
            await loadFallbackData();
        }
        
        // Select today's meals
        selectTodaysMeals();
        
        // Update UI
        updateUI();
        
        // Set up event listeners
        setupEventListeners();
        
        // Show welcome notification
        showNotification('Insulin-Smart Meal Hub loaded!', 'success');
    }

    // ======================
    // DATA LOADING
    // ======================
    async function loadMealsFromGoogleSheets() {
        const url = `https://docs.google.com/spreadsheets/d/${CONFIG.GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(CONFIG.SHEET_NAME)}`;
        
        const response = await fetch(url);
        const text = await response.text();
        
        // Parse the Google Sheets JSONP response
        const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
        
        // Convert to array of meal objects
        const rows = json.table.rows;
        const headers = rows[0].c.map(cell => cell?.v || '');
        
        state.meals = rows.slice(1).map(row => {
            const meal = {};
            row.c.forEach((cell, index) => {
                const header = headers[index];
                meal[header] = cell?.v || '';
            });
            return meal;
        });
        
        console.log(`Loaded ${state.meals.length} meals from Google Sheets`);
        saveLocalData();
    }

    async function loadFallbackData() {
        try {
            const response = await fetch(CONFIG.FALLBACK_DATA_URL);
            const data = await response.json();
            state.meals = data.meals;
            console.log(`Loaded ${state.meals.length} meals from fallback data`);
            saveLocalData();
        } catch (error) {
            console.error('Could not load fallback data:', error);
            // Use embedded fallback data
            useEmbeddedFallbackData();
        }
    }

    function useEmbeddedFallbackData() {
        state.meals = [
            {
                "Meal ID": "LH001",
                "Meal Name": "Ackee & Saltfish Salad",
                "Type": "Lunch",
                "Prep Time": "15 min",
                "Servings": "1",
                "Ingredients": "- 1 cup ackee (fresh or canned, drained)\n- ½ cup saltfish (soaked overnight, flaked)\n- 2 cups mixed greens (callaloo, spinach, lettuce)\n- ¼ avocado, sliced\n- ½ cucumber, diced\n- 1 tbsp olive oil\n- 1 tbsp lemon juice\n- 1 garlic clove, minced\n- Black pepper to taste\n- 1 scallion, chopped",
                "Instructions": "1. If using canned ackee, drain gently. If fresh, boil for 10-15 min until tender.\n2. Rinse saltfish thoroughly after soaking to reduce sodium.\n3. In a bowl, combine greens, cucumber, avocado.\n4. Heat olive oil in pan, sauté garlic 30 sec, add ackee and saltfish, warm through (2-3 min).\n5. Place ackee-saltfish mix over greens.\n6. Whisk lemon juice, olive oil, pepper for dressing, drizzle.\n7. Garnish with scallion.",
                "Insulin Benefits": "High fiber from greens slows glucose absorption. Healthy fats (avocado, olive oil) improve insulin sensitivity. Lean protein (saltfish) promotes satiety without spiking blood sugar. Low glycemic load overall.",
                "Nutrition Notes": "~450 cal | 35g protein | 25g fat | 15g carbs | 10g fiber",
                "Tags": "Jamaican, Quick, High-protein, Low-carb, Dairy-free",
                "Difficulty": "Easy",
                "Equipment Needed": "Pan, mixing bowl",
                "Date Added": new Date().toISOString().split('T')[0]
            },
            {
                "Meal ID": "DN001",
                "Meal Name": "Jamaican Salmon with Pumpkin & Greens",
                "Type": "Dinner",
                "Prep Time": "25 min",
                "Servings": "1",
                "Ingredients": "- 1 salmon fillet (150-200g)\n- ½ cup pumpkin, cubed\n- 1 cup bok choy or callaloo\n- ½ cup green beans\n- 1 tsp olive oil\n- 1 tsp Jamaican jerk seasoning (low-sodium)\n- 1 garlic clove, minced\n- ½ tsp thyme\n- ½ lemon wedge\n- Pinch of black pepper",
                "Instructions": "1. Preheat oven to 400°F (200°C).\n2. Rub salmon with jerk seasoning, thyme, black pepper.\n3. Place salmon on baking sheet, bake 12-15 min until flaky.\n4. Steam pumpkin cubes 10-12 min until tender.\n5. Heat olive oil in pan, sauté garlic 30 sec, add bok choy and green beans, cook 4-5 min until vibrant.\n6. Plate salmon with pumpkin and greens.\n7. Squeeze lemon over everything.",
                "Insulin Benefits": "Omega-3 fatty acids in salmon reduce inflammation and improve insulin signaling. Pumpkin provides vitamin A and fiber with low glycemic index. Leafy greens add magnesium, which enhances insulin action.",
                "Nutrition Notes": "~520 cal | 40g protein | 30g fat | 18g carbs | 8g fiber",
                "Tags": "Jamaican, Omega-3, Batch-friendly, Oven, Gluten-free",
                "Difficulty": "Medium",
                "Equipment Needed": "Oven, baking sheet, steamer",
                "Date Added": new Date().toISOString().split('T')[0]
            },
            {
                "Meal ID": "LH002",
                "Meal Name": "Chicken & Callaloo Egg Muffins",
                "Type": "Lunch",
                "Prep Time": "20 min + baking",
                "Servings": "3 (makes 6 muffins)",
                "Ingredients": "- 2 eggs\n- ½ cup cooked chicken, shredded\n- 1 cup callaloo (or spinach), chopped\n- ¼ bell pepper, diced\n- 1 scallion, chopped\n- 2 tbsp coconut milk\n- ¼ tsp turmeric\n- Pinch of black pepper\n- Olive oil spray",
                "Instructions": "1. Preheat oven to 350°F (175°C).\n2. Whisk eggs with coconut milk, turmeric, pepper.\n3. Stir in chicken, callaloo, bell pepper, scallion.\n4. Spray muffin tin with olive oil.\n5. Pour mixture into 6 muffin cups.\n6. Bake 15-18 min until set.\n7. Cool 5 min before removing.",
                "Insulin Benefits": "High-protein eggs and chicken promote muscle maintenance and steady glucose. Callaloo is rich in iron and fiber. Coconut milk provides medium-chain triglycerides that may improve insulin sensitivity.",
                "Nutrition Notes": "Per 2 muffins: ~320 cal | 28g protein | 20g fat | 6g carbs | 3g fiber",
                "Tags": "Meal-prep, Portable, High-protein, Gluten-free, Dairy-free",
                "Difficulty": "Easy",
                "Equipment Needed": "Muffin tin, oven",
                "Date Added": new Date().toISOString().split('T')[0]
            },
            {
                "Meal ID": "DN002",
                "Meal Name": "Tuna & Avocado Stuffed Sweet Potato",
                "Type": "Dinner",
                "Prep Time": "30 min",
                "Servings": "1",
                "Ingredients": "- 1 medium sweet potato\n- 1 can tuna in water, drained\n- ¼ avocado, mashed\n- 1 tbsp Greek yogurt (or coconut yogurt)\n- ½ celery stalk, diced\n- 1 tsp lime juice\n- 1 tsp fresh parsley\n- Pinch of paprika\n- Salt-free seasoning to taste",
                "Instructions": "1. Pierce sweet potato with fork, microwave 5-7 min until tender (or bake 45 min at 400°F).\n2. Let cool slightly, cut open lengthwise.\n3. In bowl, mix tuna, avocado, yogurt, celery, lime juice, parsley, seasoning.\n4. Scoop tuna mixture into sweet potato.\n5. Sprinkle with paprika.\n6. Serve with side salad if desired.",
                "Insulin Benefits": "Sweet potato provides complex carbs with fiber for slow glucose release. Tuna offers lean protein. Avocado adds monounsaturated fats that improve insulin function. Greek yogurt contributes protein and probiotics.",
                "Nutrition Notes": "~480 cal | 35g protein | 18g fat | 45g carbs | 10g fiber",
                "Tags": "Quick, Comfort-food, High-fiber, Mediterranean",
                "Difficulty": "Easy",
                "Equipment Needed": "Microwave or oven, mixing bowl",
                "Date Added": new Date().toISOString().split('T')[0]
            },
            {
                "Meal ID": "LH003",
                "Meal Name": "Sardine & Vegetable Skillet",
                "Type": "Lunch",
                "Prep Time": "12 min",
                "Servings": "1",
                "Ingredients": "- 1 can sardines in olive oil\n- 1 cup zucchini, sliced\n- ½ cup mushrooms, sliced\n- ½ bell pepper, sliced\n- ¼ onion, sliced\n- 1 garlic clove, minced\n831 1 tsp olive oil\n- ½ tsp dried thyme\n- ¼ tsp black pepper\n- Lemon wedge",
                "Instructions": "1. Heat olive oil in skillet over medium.\n2. Sauté onion and garlic 2 min.\n3. Add zucchini, mushrooms, bell pepper, cook 5-6 min until tender-crisp.\n4. Add sardines with their oil, thyme, pepper.\n5. Gently stir to warm through (2 min).\n6. Serve with lemon wedge.",
                "Insulin Benefits": "Sardines provide omega-3s, vitamin D, and protein. Non-starchy vegetables add volume and fiber with minimal carbs. Olive oil enhances insulin sensitivity. This meal is exceptionally low glycemic.",
                "Nutrition Notes": "~380 cal | 25g protein | 25g fat | 12g carbs | 5g fiber",
                "Tags": "Quick, One-pan, Omega-3, Low-carb, Budget",
                "Difficulty": "Easy",
                "Equipment Needed": "Skillet",
                "Date Added": new Date().toISOString().split('T')[0]
            }
        ];
        saveLocalData();
    }

    // ======================
    // MEAL SELECTION
    // ======================
    function selectTodaysMeals() {
        const breakfastMeals = state.meals.filter(meal => meal.Type === 'Breakfast');
        const lunchMeals = state.meals.filter(meal => meal.Type === 'Lunch');
        const dinnerMeals = state.meals.filter(meal => meal.Type === 'Dinner');
        
        // Simple algorithm: pick based on day of week for variety
        const dayOfWeek = new Date().getDay();
        
        if (breakfastMeals.length > 0) {
            const index = dayOfWeek % breakfastMeals.length;
            state.todayMeals.breakfast = breakfastMeals[index];
        }
        
        if (lunchMeals.length > 0) {
            const index = dayOfWeek % lunchMeals.length;
            state.todayMeals.lunch = lunchMeals[index];
        }
        
        if (dinnerMeals.length > 0) {
            const index = (dayOfWeek + 1) % dinnerMeals.length;
            state.todayMeals.dinner = dinnerMeals[index];
        }
    }

    // ======================
    // UI UPDATES
    // ======================
    function updateUI() {
        // Update date
        updateDateDisplay();
        
        // Update breakfast card
        if (state.todayMeals.breakfast) {
            updateMealCard('breakfast', state.todayMeals.breakfast);
        }
        
        // Update lunch card
        if (state.todayMeals.lunch) {
            updateMealCard('lunch', state.todayMeals.lunch);
        }
        
        // Update dinner card
        if (state.todayMeals.dinner) {
            updateMealCard('dinner', state.todayMeals.dinner);
        }
        
        // Update stats
        updateStats();
        
        // Update meal count
        elements.mealCount.textContent = `${state.mealLog.length} meals logged`;
    }

    function updateDateDisplay() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        elements.currentDate.textContent = now.toLocaleDateString('en-US', options);
    }

    function updateMealCard(type, meal) {
        const prefix = type; // 'breakfast', 'lunch', or 'dinner'
        
        elements[`${prefix}Name`].textContent = meal['Meal Name'] || 'No meal selected';
        elements[`${prefix}Time`].textContent = meal['Prep Time'] || '- min';
        elements[`${prefix}Benefit`].textContent = meal['Insulin Benefits']?.substring(0, 100) + '...' || 'Designed for insulin sensitivity.';
        
        // Update tags
        const tagsContainer = elements[`${prefix}Tags`];
        tagsContainer.innerHTML = '';
        if (meal.Tags) {
            const tags = meal.Tags.split(',').slice(0, 3);
            tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'tag';
                tagElement.textContent = tag.trim();
                tagsContainer.appendChild(tagElement);
            });
        }
    }

    function updateStats() {
        elements.totalMeals.textContent = state.mealLog.length;
        
        // Calculate average rating
        const ratings = state.mealLog.filter(log => log.rating).map(log => log.rating);
        const avgRating = ratings.length > 0 ? 
            (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '0.0';
        elements.avgRating.textContent = avgRating;
        
        // Calculate average prep time
        const prepTimes = state.meals
            .filter(meal => meal['Prep Time'])
            .map(meal => parseInt(meal['Prep Time']) || 0);
        const avgPrep = prepTimes.length > 0 ? 
            Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) : '-';
        elements.avgPrep.textContent = avgPrep !== '-' ? `${avgPrep} min` : '-';
        
        // Find top meal
        const mealCounts = {};
        state.mealLog.forEach(log => {
            if (log.mealId) {
                mealCounts[log.mealId] = (mealCounts[log.mealId] || 0) + 1;
            }
        });
        
        let topMealId = null;
        let maxCount = 0;
        Object.entries(mealCounts).forEach(([mealId, count]) => {
            if (count > maxCount) {
                maxCount = count;
                topMealId = mealId;
            }
        });
        
        if (topMealId) {
            const topMeal = state.meals.find(meal => meal['Meal ID'] === topMealId);
            elements.topMeal.textContent = topMeal ? topMeal['Meal Name'].substring(0, 10) + '...' : '-';
        } else {
            elements.topMeal.textContent = '-';
        }
    }

    function showRecipeModal(meal) {
        currentModalMeal = meal;
        
        // Update modal content
        elements.modalMealName.textContent = meal['Meal Name'];
        elements.modalPrepTime.textContent = meal['Prep Time'] || '- min';
        elements.modalServings.textContent = meal['Servings'] || '-';
        elements.modalDifficulty.textContent = meal['Difficulty'] || '-';
        
        // Format ingredients
        if (meal.Ingredients) {
            elements.modalIngredients.innerHTML = meal.Ingredients.split('\n')
                .map(line => `<p>${line}</p>`)
                .join('');
        }
        
        // Format instructions
        if (meal.Instructions) {
            elements.modalInstructions.innerHTML = meal.Instructions.split('\n')
                .map(line => `<p>${line}</p>`)
                .join('');
        }
        
        // Format benefits
        if (meal['Insulin Benefits']) {
            elements.modalBenefits.innerHTML = `<p>${meal['Insulin Benefits']}</p>`;
        }
        
        // Format nutrition
        if (meal['Nutrition Notes']) {
            elements.modalNutrition.innerHTML = `<p>${meal['Nutrition Notes']}</p>`;
        }
        
        // Show modal
        elements.recipeModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function hideRecipeModal() {
        elements.recipeModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        currentModalMeal = null;
    }

    // ======================
    // MEAL LOGGING
    // ======================
    function logMeal(meal, rating = null) {
        const logEntry = {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString(),
            mealId: meal['Meal ID'],
            mealName: meal['Meal Name'],
            mealType: meal.Type,
            rating: rating,
            notes: ''
        };
        
        state.mealLog.push(logEntry);
        saveLocalData();
        updateUI();
        
        // Update meal stats in the meal object
        const mealIndex = state.meals.findIndex(m => m['Meal ID'] === meal['Meal ID']);
        if (mealIndex !== -1) {
            const timesPrepared = parseInt(state.meals[mealIndex]['Times Prepared'] || '0') + 1;
            state.meals[mealIndex]['Times Prepared'] = timesPrepared.toString();
            state.meals[mealIndex]['Last Prepared'] = new Date().toISOString().split('T')[0];
        }
        
        showNotification(`Logged: ${meal['Meal Name']}`, 'success');
    }

    // ======================
    // DATA MANAGEMENT
    // ======================
    function loadLocalData() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                state.mealLog = data.mealLog || [];
                // Merge meals if available (preserve loaded meals, update stats)
                if (data.meals && data.meals.length > 0) {
                    data.meals.forEach(savedMeal => {
                        const existingIndex = state.meals.findIndex(m => m['Meal ID'] === savedMeal['Meal ID']);
                        if (existingIndex !== -1) {
                            // Update stats from saved data
                            state.meals[existingIndex]['Times Prepared'] = savedMeal['Times Prepared'] || '0';
                            state.meals[existingIndex]['Last Prepared'] = savedMeal['Last Prepared'] || '';
                            state.meals[existingIndex]['Rating Avg'] = savedMeal['Rating Avg'] || '';
                            state.meals[existingIndex]['Rating Count'] = savedMeal['Rating Count'] || '0';
                        }
                    });
                }
                console.log('Loaded local data:', state.mealLog.length, 'log entries');
            }
        } catch (error) {
            console.error('Error loading local data:', error);
        }
    }

    function saveLocalData() {
        try {
            const dataToSave = {
                meals: state.meals,
                mealLog: state.mealLog,
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(dataToSave));
        } catch (error) {
            console.error('Error saving local data:', error);
        }
    }

    function exportData() {
        const data = {
            meals: state.meals,
            mealLog: state.mealLog,
            stats: state.stats,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `insulin-meal-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Data exported for ebook analysis!', 'success');
    }

    // ======================
    // NOTIFICATIONS
    // ======================
    function showNotification(message, type = 'info') {
        elements.notificationText.textContent = message;
        
        // Set icon based on type
        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'warning') icon = 'fa-exclamation-triangle';
        if (type === 'error') icon = 'fa-times-circle';
        
        elements.notificationIcon.className = `fas ${icon}`;
        elements.notification.classList.add('show');
        
        setTimeout(() => {
            elements.notification.classList.remove('show');
        }, CONFIG.NOTIFICATION_DURATION);
    }

    // ======================
    // EVENT LISTENERS
    // ======================
    function setupEventListeners() {
        // View recipe buttons
        elements.viewBreakfastBtn.addEventListener('click', () => {
            if (state.todayMeals.breakfast) showRecipeModal(state.todayMeals.breakfast);
        });
        
        elements.viewLunchBtn.addEventListener('click', () => {
            if (state.todayMeals.lunch) showRecipeModal(state.todayMeals.lunch);
        });
        
        elements.viewDinnerBtn.addEventListener('click', () => {
            if (state.todayMeals.dinner) showRecipeModal(state.todayMeals.dinner);
        });
        
        // Log meal buttons
        elements.logBreakfastBtn.addEventListener('click', () => {
            if (state.todayMeals.breakfast) logMeal(state.todayMeals.breakfast);
        });
        
        elements.logLunchBtn.addEventListener('click', () => {
            if (state.todayMeals.lunch) logMeal(state.todayMeals.lunch);
        });
        
        elements.logDinnerBtn.addEventListener('click', () => {
            if (state.todayMeals.dinner) logMeal(state.todayMeals.dinner);
        });
        
        // Modal buttons
        elements.closeModalBtn.addEventListener('click', hideRecipeModal);
        elements.logModalMealBtn.addEventListener('click', () => {
            if (currentModalMeal) {
                logMeal(currentModalMeal);
                hideRecipeModal();
            }
        });
        
        // Close modal on outside click
        elements.recipeModal.addEventListener('click', (e) => {
            if (e.target === elements.recipeModal) {
                hideRecipeModal();
            }
        });
        
        // Refresh button
        elements.refreshBtn.addEventListener('click', () => {
            selectTodaysMeals();
            updateUI();
            showNotification('New meal suggestions loaded!', 'success');
        });
        
        // Other buttons
        elements.viewAllBtn.addEventListener('click', () => {
            showNotification('Browse feature coming soon!', 'info');
        });
        
        elements.logManualBtn.addEventListener('click', () => {
            showNotification('Manual logging feature coming soon!', 'info');
        });
        
        elements.exportBtn.addEventListener('click', exportData);
        
        // Footer links
        document.getElementById('how-it-works').addEventListener('click', (e) => {
            e.preventDefault();
            showNotification('This app helps you track insulin-sensitive meals for your ebook.', 'info');
        });
        
        document.getElementById('add-recipe').addEventListener('click', (e) => {
            e.preventDefault();
            showNotification('Add recipes directly in your Google Sheet.', 'info');
        });
        
        document.getElementById('reset-data').addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Reset all local data? This cannot be undone.')) {
                localStorage.removeItem(CONFIG.STORAGE_KEY);
                state.mealLog = [];
                updateUI();
                showNotification('Data reset successfully.', 'success');
            }
        });
    }
});