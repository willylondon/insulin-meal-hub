// Insulin-Smart Meal Hub - Main JavaScript
// Enhanced Version v1.1 - Deployed April 12, 2026
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

    // Health Profile (based on user's provided metrics)
    const HEALTH_PROFILE = {
        hba1c: 6.7,           // %
        fastingGlucose: 5.6,  // mmol/L
        cholesterol: {
            total: 6.04,      // mmol/L
            ldl: 3.62,        // mmol/L
            hdlLdlRatio: 0.34,
            cholHdlRatio: 5.0
        },
        uricAcid: 0.44,       // mmol/L
        ggt: null,            // mildly elevated
        creatinine: 96,       // umol/L
        egfr: 96,             // mL/min/1.73m²
        medications: [
            'Metformin XR 500 mg, half tablet once daily before a meal',
            'Febuxostat 40 mg once daily',
            'Rosuvastatin 20 mg nightly'
        ],
        goals: [
            'Improve blood sugar control',
            'Support insulin sensitivity',
            'Reduce cholesterol burden',
            'Lower gout-trigger risk'
        ]
    };

    // HTML escaping function for XSS protection
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Customization Settings (user-adjustable)
    const CUSTOM_SETTINGS = {
        // Budget: low, medium, high
        budget: 'medium',
        // Meal timing: early (before 8am), normal (8am-1pm), late (after 1pm), any
        mealTiming: 'any',
        // Ingredients on hand (comma-separated string) - Jamaican accessible
        ingredientsOnHand: 'chicken, eggs, tuna, sardines, mackerel, ackee, saltfish, pumpkin, sweet potato, callaloo, cabbage, carrot, onion, tomato, garlic, thyme, scallion, bell pepper, coconut milk, olive oil, brown rice, oats, quinoa, beans, lentils, plantain, banana, avocado',
        // Calorie target per meal (kcal) - adjusted for weight loss goal
        calorieTarget: 500,
        // Protein target per meal (g) - optimized for insulin resistance
        proteinTarget: 35,
        // Carb tolerance: very-low (<20g), low (20-40g), moderate (40-60g), high (>60g)
        carbTolerance: 'moderate',
        // Weight loss goal: none, mild (0.5kg/week), moderate (1kg/week), aggressive (1.5kg/week)
        weightLossGoal: 'moderate',
        // Meal mode: breakfast, lunch, dinner, snack, any
        mealMode: 'any',
        // Jamaican cuisine preference: traditional, fusion, simple, any
        cuisinePreference: 'traditional',
        // Cooking time preference: quick (<20min), moderate (20-40min), any
        cookingTime: 'any',
        // Meal prep friendly: yes, no, any
        mealPrepFriendly: 'any',
        // Portion size: small, medium, large, extra-large
        portionSize: 'medium',
        // Dietary restrictions: none, vegetarian, pescatarian, dairy-free, gluten-free
        dietaryRestriction: 'none',
        // Additional preferences
        avoidGoutTriggers: true,
        prioritizeHeartHealth: true,
        minimizeGlucoseSpikes: true,
        favorJamaicanIngredients: true,
        limitProcessedFoods: true,
        includeFiberRichFoods: true
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
    
    // ======================
    // MEAL SCORING & FILTERING
    // ======================
    function parseNutritionNotes(notes) {
        // Parse "~450 cal | 35g protein | 25g fat | 15g carbs | 10g fiber"
        if (!notes) return { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 };
        
        const result = { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 };
        
        // Extract calories
        const calMatch = notes.match(/(\d+)\s*cal/);
        if (calMatch) result.calories = parseInt(calMatch[1]);
        
        // Extract protein
        const proteinMatch = notes.match(/(\d+)\s*g\s*protein/);
        if (proteinMatch) result.protein = parseInt(proteinMatch[1]);
        
        // Extract carbs
        const carbsMatch = notes.match(/(\d+)\s*g\s*carbs/);
        if (carbsMatch) result.carbs = parseInt(carbsMatch[1]);
        
        // Extract fiber
        const fiberMatch = notes.match(/(\d+)\s*g\s*fiber/);
        if (fiberMatch) result.fiber = parseInt(fiberMatch[1]);
        
        // Extract fat
        const fatMatch = notes.match(/(\d+)\s*g\s*fat/);
        if (fatMatch) result.fat = parseInt(fatMatch[1]);
        
        return result;
    }
    
    function scoreMeal(meal, profile = HEALTH_PROFILE, settings = CUSTOM_SETTINGS) {
        const scores = {
            bloodSugar: 5,  // 1-10
            insulinResistance: 5,
            heartHealth: 5,
            goutFriendly: 5,
            overall: 5
        };
        
        const flags = [];
        const substitutions = [];
        
        // Parse nutrition
        const nutrition = parseNutritionNotes(meal['Nutrition Notes']);
        
        // Apply settings adjustments
        let settingsBonus = 0;
        
        // Medication-aware considerations
        const medicationFlags = [];
        if (profile.medications) {
            profile.medications.forEach(med => {
                if (med.includes('Metformin') && nutrition.carbs > 50) {
                    medicationFlags.push('High carb meal - pair with Metformin as prescribed');
                }
                if (med.includes('Febuxostat') && meal.Ingredients) {
                    const ing = meal.Ingredients.toLowerCase();
                    const highPurine = ['organ meat', 'liver', 'kidney', 'anchovy', 'sardine', 'mackerel', 'scallop'];
                    highPurine.forEach(item => {
                        if (ing.includes(item)) {
                            medicationFlags.push('Contains high-purine foods - continue Febuxostat as prescribed');
                        }
                    });
                }
                if (med.includes('Rosuvastatin') && meal.Ingredients) {
                    const ing = meal.Ingredients.toLowerCase();
                    const highSaturatedFat = ['butter', 'cream', 'cheese', 'fried', 'processed meat', 'bacon', 'sausage'];
                    highSaturatedFat.forEach(item => {
                        if (ing.includes(item)) {
                            medicationFlags.push('High saturated fat - continue Rosuvastatin as prescribed');
                        }
                    });
                }
            });
        }
        
        // 1. Blood Sugar Friendliness
        // Enhanced for HbA1c 6.7% and fasting glucose 5.6 mmol/L
        let bloodSugarScore = 5;
        
        // Carb optimization for insulin resistance
        if (nutrition.carbs > 0) {
            const fiberRatio = nutrition.fiber / nutrition.carbs;
            // Higher fiber ratio is better
            if (fiberRatio > 0.2) bloodSugarScore += 3;
            else if (fiberRatio > 0.15) bloodSugarScore += 2;
            else if (fiberRatio < 0.05) bloodSugarScore -= 2;
            
            // Carb quantity optimization
            if (nutrition.carbs >= 15 && nutrition.carbs <= 45) bloodSugarScore += 2; // Ideal range
            else if (nutrition.carbs < 15) bloodSugarScore += 1; // Very low carb
            else if (nutrition.carbs > 60) bloodSugarScore -= 3; // Too high
            else if (nutrition.carbs > 45) bloodSugarScore -= 1; // Moderately high
        }
        
        // Adjust for carb tolerance setting
        if (settings.carbTolerance === 'low' && nutrition.carbs > 25) {
            bloodSugarScore -= 2;
            flags.push('High carbs for low-carb preference');
            substitutions.push('Reduce carb portion by 1/3 or substitute with more vegetables');
        } else if (settings.carbTolerance === 'moderate' && nutrition.carbs > 40) {
            bloodSugarScore -= 1;
            flags.push('Moderately high carbs - consider portion control');
        } else if (settings.carbTolerance === 'high' && nutrition.carbs < 20) {
            bloodSugarScore += 1; // more carbs desired
        }
        
        // Check tags for low-carb, high-fiber
        if (meal.Tags) {
            const tags = meal.Tags.toLowerCase();
            if (tags.includes('low-carb')) bloodSugarScore += 1;
            if (tags.includes('high-fiber')) bloodSugarScore += 1;
            if (tags.includes('sugar') || tags.includes('sweet')) bloodSugarScore -= 2;
        }
        
        // Check ingredients for glycemic impact
        if (meal.Ingredients) {
            const ing = meal.Ingredients.toLowerCase();
            
            // High glycemic to avoid
            const highGi = ['sugar', 'honey', 'syrup', 'molasses', 'white rice', 'white bread', 'white flour', 'potato', 'ripe plantain'];
            // Low glycemic Jamaican-accessible foods to favor
            const lowGi = ['sweet potato', 'pumpkin', 'oats', 'quinoa', 'brown rice', 'green banana', 'green plantain', 'yam', 'dasheen', 'coco'];
            // Jamaican superfoods for blood sugar
            const jamaicanSuperfoods = ['callaloo', 'cho-cho', 'cabbage', 'okra', 'string beans', 'pak-choi', 'carrot juice (fresh)'];
            
            highGi.forEach(item => { 
                if (ing.includes(item)) {
                    bloodSugarScore -= 2;
                    flags.push(`Contains ${item} - may spike blood sugar`);
                    substitutions.push(`Replace ${item} with sweet potato or pumpkin`);
                }
            });
            lowGi.forEach(item => { 
                if (ing.includes(item)) {
                    bloodSugarScore += 1;
                    if (item === 'sweet potato' || item === 'pumpkin') bloodSugarScore += 1; // Bonus for best options
                }
            });
            jamaicanSuperfoods.forEach(item => { 
                if (ing.includes(item)) bloodSugarScore += 1;
            });
        }
        
        scores.bloodSugar = Math.max(1, Math.min(10, bloodSugarScore));
        
        // 2. Insulin Resistance Support
        // Enhanced for optimal insulin sensitivity
        let insulinScore = 5;
        
        // Protein optimization for insulin resistance
        if (nutrition.protein >= 30 && nutrition.protein <= 50) insulinScore += 3; // Ideal range
        else if (nutrition.protein >= 25) insulinScore += 2;
        else if (nutrition.protein >= 20) insulinScore += 1;
        else if (nutrition.protein < 15) insulinScore -= 2;
        
        // Healthy fat optimization
        if (nutrition.fat >= 15 && nutrition.fat <= 30) insulinScore += 2; // Ideal range
        else if (nutrition.fat >= 10) insulinScore += 1;
        else if (nutrition.fat > 35) insulinScore -= 1; // Too high fat
        
        // Protein-to-carb ratio important for insulin sensitivity
        if (nutrition.carbs > 0 && nutrition.protein > 0) {
            const proteinToCarbRatio = nutrition.protein / nutrition.carbs;
            if (proteinToCarbRatio > 1.0) insulinScore += 2; // Excellent ratio
            else if (proteinToCarbRatio > 0.7) insulinScore += 1; // Good ratio
            else if (proteinToCarbRatio < 0.3) insulinScore -= 1; // Poor ratio
        }
        
        // Adjust for protein target
        if (settings.proteinTarget) {
            const diff = nutrition.protein - settings.proteinTarget;
            if (diff >= 10) insulinScore += 2;
            else if (diff >= 5) insulinScore += 1;
            else if (diff <= -10) insulinScore -= 2;
            else if (diff <= -5) insulinScore -= 1;
        }
        
        // Check for protein sources
        if (meal.Ingredients) {
            const ing = meal.Ingredients.toLowerCase();
            
            // Optimal proteins for insulin resistance (Jamaican-accessible)
            const optimalProteins = ['chicken', 'turkey', 'egg', 'mackerel', 'sardine', 'tofu', 'greek yogurt', 'cottage cheese', 'lentils', 'kidney beans', 'gunga peas'];
            // Good proteins
            const goodProteins = ['fish', 'beans', 'yogurt', 'cheese', 'pork loin', 'lean beef'];
            // Proteins to limit
            const limitProteins = ['processed meat', 'sausage', 'bacon', 'fried chicken', 'fried fish', 'spam', 'corned beef'];
            // Proteins to avoid with gout considerations
            const goutRiskProteins = ['organ meat', 'liver', 'kidney', 'anchovy', 'scallop', 'mussels'];
            
            optimalProteins.forEach(item => { 
                if (ing.includes(item)) {
                    insulinScore += 1;
                    if (item === 'egg' || item === 'chicken') insulinScore += 0.5; // Bonus for best options
                }
            });
            goodProteins.forEach(item => { 
                if (ing.includes(item)) insulinScore += 0.5;
            });
            limitProteins.forEach(item => { 
                if (ing.includes(item)) {
                    insulinScore -= 2;
                    flags.push(`Contains ${item} - may worsen insulin resistance`);
                    substitutions.push(`Replace ${item} with grilled chicken or baked fish`);
                }
            });
            goutRiskProteins.forEach(item => { 
                if (ing.includes(item)) {
                    insulinScore -= 1; // Cross-impact with gout
                }
            });
        }
        
        scores.insulinResistance = Math.max(1, Math.min(10, insulinScore));
        
        // 3. Heart/Cholesterol Friendliness - Enhanced for elevated cholesterol
        let heartScore = 4; // Start lower due to elevated cholesterol (Total: 6.04, LDL: 3.62)
        
        // Check for cholesterol-friendly ingredients
        if (meal.Ingredients) {
            const ing = meal.Ingredients.toLowerCase();
            
            // Excellent for cholesterol (increase score)
            const cholesterolExcellent = ['olive oil', 'avocado', 'nuts', 'almonds', 'walnuts', 'seeds', 'flaxseed', 
                                         'salmon', 'sardines', 'mackerel', 'omega-3', 'oats', 'barley', 'beans', 
                                         'lentils', 'okra', 'eggplant', 'apple', 'berries', 'garlic', 'onion'];
            // Good for cholesterol
            const cholesterolGood = ['canola oil', 'avocado oil', 'lean chicken', 'turkey', 'tofu', 'soy', 
                                    'green leafy vegetables', 'carrots', 'sweet potato', 'whole grains'];
            // Neutral for cholesterol
            const cholesterolNeutral = ['rice', 'pasta', 'bread', 'potato', 'corn', 'moderate cheese', 'yogurt'];
            // Risky for cholesterol (decrease score)
            const cholesterolRisky = ['butter', 'cream', 'full-fat cheese', 'fried foods', 'processed meat', 
                                     'bacon', 'sausage', 'hot dog', 'pastry', 'cake', 'cookies', 'ice cream'];
            // Very risky for cholesterol (significant decrease)
            const cholesterolVeryRisky = ['trans fat', 'hydrogenated oil', 'shortening', 'palm oil', 'coconut oil', 
                                         'organ meats', 'high-fat red meat', 'fast food'];
            
            cholesterolExcellent.forEach(item => { 
                if (ing.includes(item)) {
                    heartScore += 2;
                    if (item === 'oats' || item === 'beans' || item === 'salmon') heartScore += 1; // Bonus for best options
                }
            });
            cholesterolGood.forEach(item => { 
                if (ing.includes(item)) heartScore += 1;
            });
            cholesterolRisky.forEach(item => { 
                if (ing.includes(item)) {
                    heartScore -= 2;
                    flags.push(`Contains ${item} - may worsen cholesterol`);
                    substitutions.push(`Replace ${item} with olive oil, avocado, or nuts`);
                }
            });
            cholesterolVeryRisky.forEach(item => { 
                if (ing.includes(item)) {
                    heartScore -= 3;
                    flags.push(`Contains ${item} - significant cholesterol risk`);
                    substitutions.push(`Avoid ${item} completely for cholesterol management`);
                }
            });
        }
        
        // Adjust based on nutrition facts
        if (nutrition.fat > 0) {
            // Estimate saturated fat (simplified)
            const estimatedSatFat = nutrition.fat * 0.3; // Rough estimate
            if (estimatedSatFat > 10) heartScore -= 2;
            else if (estimatedSatFat > 5) heartScore -= 1;
            else if (estimatedSatFat < 3) heartScore += 1;
        }
        
        // Fiber is excellent for cholesterol
        if (nutrition.fiber >= 10) heartScore += 2;
        else if (nutrition.fiber >= 5) heartScore += 1;
        
        // Apply prioritize heart health setting (always true for this profile)
        if (settings.prioritizeHeartHealth || profile.cholesterol.total > 5.0) {
            // Stricter scoring for elevated cholesterol
            if (heartScore >= 7) heartScore += 1;
            if (heartScore <= 5) heartScore -= 1;
            if (heartScore <= 3) heartScore -= 1; // Additional penalty for poor choices
        }
        
        // Check tags for cholesterol benefits
        if (meal.Tags) {
            const tags = meal.Tags.toLowerCase();
            if (tags.includes('omega-3') || tags.includes('high-fiber') || tags.includes('heart-healthy')) {
                heartScore += 2;
            }
            if (tags.includes('low-saturated-fat') || tags.includes('cholesterol-friendly')) {
                heartScore += 1;
            }
        }
        
        scores.heartHealth = Math.max(1, Math.min(10, heartScore));
        
        // 4. Gout Friendliness - Enhanced for uric acid 0.44 mmol/L
        let goutScore = 6; // Start at moderate due to elevated uric acid
        
        if (meal.Ingredients) {
            const ing = meal.Ingredients.toLowerCase();
            
            // Purine content classification for gout
            const veryHighPurine = ['organ meat', 'liver', 'kidney', 'heart', 'brain', 'sweetbreads'];
            const highPurine = ['anchovy', 'sardine', 'mackerel', 'scallop', 'mussels', 'herring', 'trout'];
            const moderatePurine = ['beef', 'pork', 'lamb', 'veal', 'bacon', 'salmon', 'tuna', 'chicken', 'turkey', 'duck'];
            const lowPurine = ['egg', 'tofu', 'cheese', 'milk', 'yogurt', 'nuts', 'beans', 'lentils', 'vegetables', 'fruits'];
            const goutProtective = ['cherry', 'berries', 'citrus', 'coffee', 'low-fat dairy', 'olive oil', 'whole grains'];
            
            // Score adjustments based on purine content
            veryHighPurine.forEach(item => { 
                if (ing.includes(item)) {
                    goutScore -= 4;
                    flags.push(`Contains ${item} - very high purine, high gout risk`);
                    substitutions.push(`Replace ${item} with egg, tofu, or low-fat dairy`);
                }
            });
            highPurine.forEach(item => { 
                if (ing.includes(item)) {
                    goutScore -= 3;
                    flags.push(`Contains ${item} - high purine, moderate gout risk`);
                }
            });
            moderatePurine.forEach(item => { 
                if (ing.includes(item)) {
                    goutScore -= 1;
                    // Allow moderate purine in controlled portions
                }
            });
            lowPurine.forEach(item => { 
                if (ing.includes(item)) goutScore += 1;
            });
            goutProtective.forEach(item => { 
                if (ing.includes(item)) goutScore += 2;
            });
        }
        
        // Adjust based on uric acid level in profile
        if (profile.uricAcid > 0.42) { // Elevated uric acid threshold
            goutScore -= 1; // Be more cautious
            if (goutScore < 5) goutScore -= 1; // Additional penalty for risky meals
        }
        
        // Apply avoid gout triggers setting
        if (settings.avoidGoutTriggers) {
            // Be stricter with gout triggers
            if (goutScore < 6) goutScore -= 1;
            if (goutScore < 4) goutScore -= 1; // Additional penalty for very risky meals
        }
        
        scores.goutFriendly = Math.max(1, Math.min(10, goutScore));
        
        // Overall score (weighted average)
        scores.overall = Math.round(
            (scores.bloodSugar * 0.3) +
            (scores.insulinResistance * 0.3) +
            (scores.heartHealth * 0.2) +
            (scores.goutFriendly * 0.2)
        );
        
        // Generate flags based on settings
        if (settings.carbTolerance === 'low' && nutrition.carbs > 30) {
            flags.push('High carbs for low-carb preference');
        }
        if (settings.proteinTarget && nutrition.protein < settings.proteinTarget - 5) {
            flags.push('Low protein for your target');
        }
        if (settings.calorieTarget && nutrition.calories > settings.calorieTarget + 100) {
            flags.push('High calorie for your target');
        }
        
        // Original flags
        if (scores.bloodSugar < 4) flags.push('May cause glucose spike');
        if (scores.bloodSugar > 7) flags.push('Excellent for blood sugar');
        
        if (scores.insulinResistance < 4) flags.push('Low protein for insulin support');
        if (scores.insulinResistance > 7) flags.push('Great for insulin sensitivity');
        
        if (scores.heartHealth < 4) flags.push('Consider heart health alternatives');
        if (scores.heartHealth > 7) flags.push('Heart-healthy ingredients');
        
        if (scores.goutFriendly < 4) flags.push('High purine content - caution if gout prone');
        if (scores.goutFriendly > 7) flags.push('Gout-friendly');
        
        // Substitution suggestions
        if (scores.bloodSugar < 5 && nutrition.carbs > 40) {
            substitutions.push('Consider reducing portion size or pairing with more protein/fat');
        }
        if (scores.goutFriendly < 5) {
            substitutions.push('Swap high-purine proteins for chicken, eggs, or tofu');
        }
        
        // Add medication flags to main flags array
        if (medicationFlags.length > 0) {
            flags.push(...medicationFlags);
        }
        
        return { scores, flags, substitutions, nutrition };
    }
    
    function filterAndRankMeals(meals, mealType, settings = CUSTOM_SETTINGS) {
        // First filter by meal type
        let filtered = meals.filter(meal => meal.Type === mealType);
        
        if (filtered.length === 0) return [];
        
        // Score each meal
        const scored = filtered.map(meal => {
            const scoring = scoreMeal(meal, HEALTH_PROFILE, settings);
            
            // Calculate custom score with adjustments
            let customScore = scoring.scores.overall;
            
            // Adjust for ingredients on hand
            if (settings.ingredientsOnHand) {
                const ingredientsList = settings.ingredientsOnHand.toLowerCase().split(/[,\s]+/).filter(i => i.length > 2);
                const mealIngredients = meal.Ingredients?.toLowerCase() || '';
                let matchCount = 0;
                ingredientsList.forEach(ing => {
                    if (mealIngredients.includes(ing)) matchCount++;
                });
                // Boost score if at least one ingredient matches
                if (matchCount > 0) {
                    customScore += Math.min(3, matchCount);
                }
            }
            
            // Adjust for budget
            if (settings.budget === 'low' && meal.Tags?.toLowerCase().includes('budget')) {
                customScore += 2;
            } else if (settings.budget === 'high' && meal.Tags?.toLowerCase().includes('premium')) {
                customScore += 2;
            }
            
            // Adjust for weight loss goal
            if (settings.weightLossGoal === 'aggressive' && scoring.nutrition.calories < 400) {
                customScore += 2;
            } else if (settings.weightLossGoal === 'moderate' && scoring.nutrition.calories < 500) {
                customScore += 1;
            } else if (settings.weightLossGoal === 'mild' && scoring.nutrition.calories < 600) {
                customScore += 1;
            }
            
            // Adjust for Jamaican cuisine preference
            if (settings.cuisinePreference === 'traditional' && meal.Tags?.toLowerCase().includes('jamaican')) {
                customScore += 2;
            } else if (settings.cuisinePreference === 'fusion' && meal.Tags?.toLowerCase().includes('fusion')) {
                customScore += 2;
            } else if (settings.cuisinePreference === 'simple' && meal['Prep Time']?.includes('15') || meal['Prep Time']?.includes('20')) {
                customScore += 1;
            }
            
            // Adjust for cooking time preference
            if (settings.cookingTime === 'quick') {
                const prepTime = parseInt(meal['Prep Time']?.match(/\d+/)?.[0] || '30');
                if (prepTime <= 20) customScore += 2;
            } else if (settings.cookingTime === 'moderate') {
                const prepTime = parseInt(meal['Prep Time']?.match(/\d+/)?.[0] || '30');
                if (prepTime >= 20 && prepTime <= 40) customScore += 1;
            }
            
            // Adjust for meal prep friendly
            if (settings.mealPrepFriendly === 'yes' && meal.Tags?.toLowerCase().includes('meal-prep')) {
                customScore += 2;
            }
            
            // Adjust for portion size
            if (settings.portionSize === 'small' && scoring.nutrition.calories < 400) {
                customScore += 1;
            } else if (settings.portionSize === 'large' && scoring.nutrition.calories > 600) {
                customScore += 1;
            }
            
            // Adjust for dietary restrictions
            if (settings.dietaryRestriction === 'vegetarian' && !meal.Ingredients?.toLowerCase().includes('chicken') && 
                !meal.Ingredients?.toLowerCase().includes('fish') && !meal.Ingredients?.toLowerCase().includes('meat')) {
                customScore += 2;
            } else if (settings.dietaryRestriction === 'pescatarian' && 
                (meal.Ingredients?.toLowerCase().includes('fish') || meal.Ingredients?.toLowerCase().includes('seafood'))) {
                customScore += 2;
            }
            
            // Adjust for Jamaican ingredients preference
            if (settings.favorJamaicanIngredients) {
                const jamaicanIngredients = ['ackee', 'saltfish', 'callaloo', 'plantain', 'green banana', 'yam', 'dasheen', 'coco', 'cho-cho', 'scotch bonnet', 'thyme', 'allspice'];
                const mealIngredients = meal.Ingredients?.toLowerCase() || '';
                jamaicanIngredients.forEach(ing => {
                    if (mealIngredients.includes(ing)) customScore += 0.5;
                });
            }
            
            // Adjust for processed foods limit
            if (settings.limitProcessedFoods) {
                const processedFoods = ['processed', 'canned', 'packaged', 'instant', 'fried', 'fast food'];
                const mealIngredients = meal.Ingredients?.toLowerCase() || '';
                processedFoods.forEach(item => {
                    if (mealIngredients.includes(item)) customScore -= 2;
                });
            }
            
            // Adjust for fiber preference
            if (settings.includeFiberRichFoods && scoring.nutrition.fiber >= 8) {
                customScore += 1;
            }
            
            return {
                meal,
                scoring,
                customScore: Math.max(1, Math.min(10, customScore))
            };
        });
        
        // Sort by custom score descending
        scored.sort((a, b) => b.customScore - a.customScore);
        
        return scored;
    }
    // ======================
    // SETTINGS MANAGEMENT
    // ======================
    function toggleSettingsPanel() {
        const panel = elements.settingsPanel;
        const grid = elements.settingsPanel.querySelector('.settings-grid');
        const button = elements.toggleSettingsBtn;
        
        if (grid.style.display === 'none') {
            grid.style.display = '';
            panel.style.paddingBottom = '16px';
            button.innerHTML = '<i class="fas fa-chevron-up"></i> Hide';
        } else {
            grid.style.display = 'none';
            panel.style.paddingBottom = '8px';
            button.innerHTML = '<i class="fas fa-chevron-down"></i> Show';
        }
    }
    
    function loadSavedSettings() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY + '_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                // Update UI elements
                elements.budgetSelect.value = settings.budget || 'medium';
                elements.calorieTargetInput.value = settings.calorieTarget || 500;
                elements.proteinTargetInput.value = settings.proteinTarget || 30;
                elements.carbToleranceSelect.value = settings.carbTolerance || 'moderate';
                elements.weightLossGoalSelect.value = settings.weightLossGoal || 'moderate';
                elements.ingredientsOnHandInput.value = settings.ingredientsOnHand || 'chicken, eggs, tuna, sardines, salmon, ackee, pumpkin, sweet potato, callaloo, cabbage';
                elements.avoidGoutCheckbox.checked = settings.avoidGoutTriggers !== false;
                elements.prioritizeHeartCheckbox.checked = settings.prioritizeHeartHealth !== false;
                
                // Update range value displays
                updateRangeValue();
            }
        } catch (e) {
            // console.warn('Could not load saved settings:', e);
        }
    }
    
    function applySettings() {
        const settings = {
            budget: elements.budgetSelect.value,
            calorieTarget: parseInt(elements.calorieTargetInput.value),
            proteinTarget: parseInt(elements.proteinTargetInput.value),
            carbTolerance: elements.carbToleranceSelect.value,
            weightLossGoal: elements.weightLossGoalSelect.value,
            ingredientsOnHand: elements.ingredientsOnHandInput.value,
            avoidGoutTriggers: elements.avoidGoutCheckbox.checked,
            prioritizeHeartHealth: elements.prioritizeHeartCheckbox.checked,
            mealTiming: 'any',
            mealMode: 'any'
        };
        
        // Save to localStorage
        localStorage.setItem(CONFIG.STORAGE_KEY + '_settings', JSON.stringify(settings));
        
        // Re-select meals with new settings
        selectTodaysMeals();
        updateUI();
        
        showNotification('Settings applied! Refreshing meal suggestions...', 'success');
    }
    
    function updateRangeValue() {
        // Update calorie target display
        const calorieValue = elements.calorieTargetInput.value;
        const calorieDisplay = elements.calorieTargetInput.nextElementSibling;
        if (calorieDisplay && calorieDisplay.className === 'range-value') {
            calorieDisplay.textContent = `${calorieValue} kcal per meal`;
        }
        
        // Update protein target display
        const proteinValue = elements.proteinTargetInput.value;
        const proteinDisplay = elements.proteinTargetInput.nextElementSibling;
        if (proteinDisplay && proteinDisplay.className === 'range-value') {
            proteinDisplay.textContent = `${proteinValue}g protein per meal`;
        }
    }
    ;
        });
        
        // Sort by overall score descending
        scored.sort((a, b) => b.customScore - a.customScore);
        
        return scored;
    }
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
        notificationText: document.getElementById('notification-text'),
        
        // Settings Panel Elements
        settingsPanel: document.getElementById('settings-panel'),
        toggleSettingsBtn: document.getElementById('toggle-settings'),
        applySettingsBtn: document.getElementById('apply-settings'),
        budgetSelect: document.getElementById('budget'),
        calorieTargetInput: document.getElementById('calorie-target'),
        proteinTargetInput: document.getElementById('protein-target'),
        carbToleranceSelect: document.getElementById('carb-tolerance'),
        weightLossGoalSelect: document.getElementById('weight-loss-goal'),
        ingredientsOnHandInput: document.getElementById('ingredients-on-hand'),
        avoidGoutCheckbox: document.getElementById('avoid-gout'),
        prioritizeHeartCheckbox: document.getElementById('prioritize-heart')
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
        
        // Load saved settings
        loadSavedSettings();
        
        // Try to load meals from Google Sheets
        try {
            await loadMealsFromGoogleSheets();
        } catch (error) {
            // console.warn('Could not load from Google Sheets, using fallback:', error);
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
        
        // console.log(`Loaded ${state.meals.length} meals from Google Sheets`);
        saveLocalData();
    }

    async function loadFallbackData() {
        try {
            const response = await fetch(CONFIG.FALLBACK_DATA_URL);
            const data = await response.json();
            state.meals = data.meals;
            // console.log(`Loaded ${state.meals.length} meals from fallback data`);
            saveLocalData();
        } catch (error) {
            // console.error('Could not load fallback data:', error);
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
        // Get customization settings from localStorage if available
        let customSettings = CUSTOM_SETTINGS;
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY + '_settings');
            if (saved) {
                customSettings = { ...CUSTOM_SETTINGS, ...JSON.parse(saved) };
            }
        } catch (e) {
            // console.warn('Could not load custom settings:', e);
        }
        
        // Filter and rank meals for each type
        const breakfastRanked = filterAndRankMeals(state.meals, 'Breakfast', customSettings);
        const lunchRanked = filterAndRankMeals(state.meals, 'Lunch', customSettings);
        const dinnerRanked = filterAndRankMeals(state.meals, 'Dinner', customSettings);
        
        // Select top meal for each type, but add some variety
        // Use day of week to pick from top 3 options
        const dayOfWeek = new Date().getDay();
        
        if (breakfastRanked.length > 0) {
            const topN = Math.min(3, breakfastRanked.length);
            const index = dayOfWeek % topN;
            state.todayMeals.breakfast = breakfastRanked[index].meal;
            state.todayMeals.breakfast.scoring = breakfastRanked[index].scoring;
        }
        
        if (lunchRanked.length > 0) {
            const topN = Math.min(3, lunchRanked.length);
            const index = (dayOfWeek + 1) % topN;
            state.todayMeals.lunch = lunchRanked[index].meal;
            state.todayMeals.lunch.scoring = lunchRanked[index].scoring;
        }
        
        if (dinnerRanked.length > 0) {
            const topN = Math.min(3, dinnerRanked.length);
            const index = (dayOfWeek + 2) % topN;
            state.todayMeals.dinner = dinnerRanked[index].meal;
            state.todayMeals.dinner.scoring = dinnerRanked[index].scoring;
        }
        
        // Log selection for debugging
        // console.log('Selected meals with scoring:', {
        //     breakfast: state.todayMeals.breakfast?.scoring?.scores,
        //     lunch: state.todayMeals.lunch?.scoring?.scores,
        //     dinner: state.todayMeals.dinner?.scoring?.scores
        // });
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
        
        // Truncate benefit text
        const benefitText = meal['Insulin Benefits']?.substring(0, 100) + '...' || 'Designed for insulin sensitivity.';
        elements[`${prefix}Benefit`].textContent = benefitText;
        
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
        
        // Add score badges if scoring data exists
        if (meal.scoring) {
            const scores = meal.scoring.scores;
            const scoreContainer = document.createElement('div');
            scoreContainer.className = 'score-badges';
            scoreContainer.style.marginTop = '8px';
            scoreContainer.style.display = 'flex';
            scoreContainer.style.gap = '4px';
            scoreContainer.style.flexWrap = 'wrap';
            
            // Create badge for each score
            const scoreLabels = [
                { key: 'bloodSugar', label: 'Sugar', color: '#2E86AB' },
                { key: 'insulinResistance', label: 'Insulin', color: '#4CAF50' },
                { key: 'heartHealth', label: 'Heart', color: '#FF9800' },
                { key: 'goutFriendly', label: 'Gout', color: '#9C27B0' }
            ];
            
            scoreLabels.forEach(item => {
                if (scores[item.key]) {
                    const badge = document.createElement('span');
                    badge.className = 'score-badge';
                    badge.textContent = `${item.label}: ${scores[item.key]}/10`;
                    badge.style.backgroundColor = item.color;
                    badge.style.color = 'white';
                    badge.style.padding = '2px 6px';
                    badge.style.borderRadius = '10px';
                    badge.style.fontSize = '11px';
                    badge.style.fontWeight = '600';
                    scoreContainer.appendChild(badge);
                }
            });
            
            // Add overall badge
            const overallBadge = document.createElement('span');
            overallBadge.className = 'score-badge-overall';
            overallBadge.textContent = `Overall: ${scores.overall}/10`;
            overallBadge.style.backgroundColor = '#333';
            overallBadge.style.color = 'white';
            overallBadge.style.padding = '2px 8px';
            overallBadge.style.borderRadius = '10px';
            overallBadge.style.fontSize = '11px';
            overallBadge.style.fontWeight = 'bold';
            scoreContainer.appendChild(overallBadge);
            
            // Insert after tags container
            tagsContainer.parentNode.insertBefore(scoreContainer, tagsContainer.nextSibling);
            
            // Add flags tooltip if any
            if (meal.scoring.flags && meal.scoring.flags.length > 0) {
                const flagIcon = document.createElement('span');
                flagIcon.innerHTML = ' ⚠️';
                flagIcon.title = meal.scoring.flags.join('\n');
                flagIcon.style.cursor = 'help';
                elements[`${prefix}Name`].appendChild(flagIcon);
            }
        }
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
                .map(line => `<p>${escapeHtml(line)}</p>`)
                .join('');
        }
        
        // Format instructions
        if (meal.Instructions) {
            elements.modalInstructions.innerHTML = meal.Instructions.split('\n')
                .map(line => `<p>${escapeHtml(line)}</p>`)
                .join('');
        }
        
        // Format benefits
        if (meal['Insulin Benefits']) {
            elements.modalBenefits.innerHTML = `<p>${escapeHtml(meal['Insulin Benefits'])}</p>`;
        }
        
        // Format nutrition
        if (meal['Nutrition Notes']) {
            elements.modalNutrition.innerHTML = `<p>${escapeHtml(meal['Nutrition Notes'])}</p>`;
        }
        
        // Add portion guidance section
        const existingPortionSection = document.getElementById('portion-guidance-section');
        if (existingPortionSection) {
            existingPortionSection.remove();
        }
        
        if (meal.scoring) {
            const nutrition = meal.scoring.nutrition;
            const portionSection = document.createElement('div');
            portionSection.id = 'portion-guidance-section';
            portionSection.style.marginTop = '15px';
            portionSection.style.padding = '12px';
            portionSection.style.backgroundColor = '#e8f4fd';
            portionSection.style.borderRadius = '8px';
            portionSection.style.border = '1px solid #cce7ff';
            
            let portionHtml = `<h4 style="margin-top: 0; color: #2E86AB;"><i class="fas fa-utensils"></i> Portion Guidance</h4>`;
            
            // Carb portion guidance for insulin resistance
            if (nutrition.carbs > 0) {
                let carbGuidance = '';
                if (nutrition.carbs <= 20) {
                    carbGuidance = 'Low carb portion - good for blood sugar control';
                } else if (nutrition.carbs <= 40) {
                    carbGuidance = 'Moderate carb portion - pair with protein and fat';
                } else if (nutrition.carbs <= 60) {
                    carbGuidance = 'High carb portion - consider reducing by 1/4 for better glucose control';
                } else {
                    carbGuidance = 'Very high carb portion - reduce by 1/3 or split into two meals';
                }
                portionHtml += `<p style="margin: 8px 0;"><strong>Carbohydrates (${nutrition.carbs}g):</strong> ${carbGuidance}</p>`;
            }
            
            // Protein portion guidance
            if (nutrition.protein > 0) {
                let proteinGuidance = '';
                if (nutrition.protein >= 30) {
                    proteinGuidance = 'Excellent protein amount for insulin sensitivity';
                } else if (nutrition.protein >= 20) {
                    proteinGuidance = 'Good protein amount - maintain this level';
                } else {
                    proteinGuidance = 'Consider adding 10-15g more protein (e.g., 1 egg or 50g chicken)';
                }
                portionHtml += `<p style="margin: 8px 0;"><strong>Protein (${nutrition.protein}g):</strong> ${proteinGuidance}</p>`;
            }
            
            // Practical portion tips
            portionHtml += `<div style="margin-top: 10px; padding: 10px; background: white; border-radius: 6px;">
                <h5 style="margin-top: 0; color: #7ED321;"><i class="fas fa-lightbulb"></i> Practical Tips:</h5>
                <ul style="margin: 8px 0; padding-left: 20px;">
                    <li>Use palm-sized protein portions (chicken, fish, tofu)</li>
                    <li>Fill half your plate with non-starchy vegetables</li>
                    <li>Limit starchy carbs to 1/4 plate (about 1/2 cup cooked)</li>
                    <li>Add healthy fats: 1 tbsp olive oil, 1/4 avocado, or small handful of nuts</li>
                    <li>Drink water before and during meals to aid digestion</li>
                    <li>Eat slowly, chew thoroughly - aim for 20+ minutes per meal</li>
                </ul>
            </div>`;
            
            // Meal prep tips if applicable
            if (meal.Tags?.toLowerCase().includes('meal-prep')) {
                portionHtml += `<div style="margin-top: 10px; padding: 10px; background: #fff8e1; border-radius: 6px;">
                    <h5 style="margin-top: 0; color: #FF9800;"><i class="fas fa-box"></i> Meal Prep Friendly:</h5>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        <li>Can be prepared in advance and stored 3-4 days in refrigerator</li>
                        <li>Freeze individual portions for up to 3 months</li>
                        <li>Reheat gently to preserve nutrients</li>
                        <li>Portion into containers immediately after cooking</li>
                    </ul>
                </div>`;
            }
            
            portionSection.innerHTML = portionHtml;
            elements.modalNutrition.parentNode.insertBefore(portionSection, elements.modalNutrition.nextSibling);
        }
        
        // Add health scoring section if available
        const existingScoreSection = document.getElementById('health-score-section');
        if (existingScoreSection) {
            existingScoreSection.remove();
        }
        
        if (meal.scoring) {
            const scores = meal.scoring.scores;
            const flags = meal.scoring.flags;
            const substitutions = meal.scoring.substitutions;
            const nutrition = meal.scoring.nutrition;
            
            const scoreSection = document.createElement('div');
            scoreSection.id = 'health-score-section';
            scoreSection.style.marginTop = '20px';
            scoreSection.style.padding = '15px';
            scoreSection.style.backgroundColor = '#f8f9fa';
            scoreSection.style.borderRadius = '8px';
            scoreSection.style.border = '1px solid #dee2e6';
            
            let html = `<h3 style="margin-top: 0; color: #2E86AB;"><i class="fas fa-heartbeat"></i> Health Profile Analysis</h3>`;
            
            // Score grid
            html += `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px;">`;
            const scoreConfig = [
                { key: 'bloodSugar', label: 'Blood Sugar', color: '#2E86AB', icon: 'fa-chart-line' },
                { key: 'insulinResistance', label: 'Insulin Support', color: '#4CAF50', icon: 'fa-shield-alt' },
                { key: 'heartHealth', label: 'Heart Health', color: '#FF9800', icon: 'fa-heart' },
                { key: 'goutFriendly', label: 'Gout Friendly', color: '#9C27B0', icon: 'fa-exclamation-triangle' }
            ];
            
            scoreConfig.forEach(item => {
                const value = scores[item.key];
                let rating = '';
                if (value >= 9) rating = 'Excellent';
                else if (value >= 7) rating = 'Good';
                else if (value >= 5) rating = 'Moderate';
                else if (value >= 3) rating = 'Poor';
                else rating = 'Avoid';
                
                html += `
                <div style="background: white; padding: 10px; border-radius: 6px; border-left: 4px solid ${item.color};">
                    <div style="font-weight: 600; font-size: 14px; color: ${item.color};">
                        <i class="fas ${item.icon}"></i> ${item.label}
                    </div>
                    <div style="font-size: 24px; font-weight: 700; margin: 5px 0;">${value}/10</div>
                    <div style="font-size: 12px; color: #666;">${rating}</div>
                </div>`;
            });
            html += `</div>`;
            
            // Overall score
            html += `<div style="background: #333; color: white; padding: 10px; border-radius: 6px; margin-bottom: 15px; text-align: center;">
                <div style="font-size: 16px; font-weight: 600;">Overall Health Score</div>
                <div style="font-size: 32px; font-weight: 700;">${scores.overall}/10</div>
            </div>`;
            
            // Flags
            if (flags.length > 0) {
                html += `<div style="margin-bottom: 15px;">
                    <h4 style="margin-bottom: 8px; color: #FF6B6B;"><i class="fas fa-flag"></i> Considerations</h4>
                    <ul style="margin: 0; padding-left: 20px;">`;
                flags.forEach(flag => {
                    html += `<li style="margin-bottom: 5px; font-size: 14px;">${escapeHtml(flag)}</li>`;
                });
                html += `</ul></div>`;
            }
            
            // Substitutions
            if (substitutions.length > 0) {
                html += `<div style="margin-bottom: 15px;">
                    <h4 style="margin-bottom: 8px; color: #7ED321;"><i class="fas fa-exchange-alt"></i> Suggestions for Improvement</h4>
                    <ul style="margin: 0; padding-left: 20px;">`;
                substitutions.forEach(sub => {
                    html += `<li style="margin-bottom: 5px; font-size: 14px;">${escapeHtml(sub)}</li>`;
                });
                html += `</ul></div>`;
            }
            
            // Nutrition summary
            html += `<div style="font-size: 13px; color: #666; border-top: 1px dashed #ccc; padding-top: 10px;">
                <strong>Nutrition per serving:</strong> ${nutrition.calories} cal, ${nutrition.protein}g protein, ${nutrition.carbs}g carbs, ${nutrition.fiber}g fiber
            </div>`;
            
            scoreSection.innerHTML = html;
            
            // Insert after nutrition section
            const nutritionElement = elements.modalNutrition.parentNode;
            nutritionElement.parentNode.insertBefore(scoreSection, nutritionElement.nextSibling);
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
                // console.log('Loaded local data:', state.mealLog.length, 'log entries');
            }
        } catch (error) {
            // console.error('Error loading local data:', error);
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
            // console.error('Error saving local data:', error);
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
        // Settings Panel Events
        elements.toggleSettingsBtn.addEventListener('click', toggleSettingsPanel);
        elements.applySettingsBtn.addEventListener('click', applySettings);
        
        // Live updates for numeric inputs
        elements.calorieTargetInput.addEventListener('change', updateRangeValue);
        elements.proteinTargetInput.addEventListener('change', updateRangeValue);
        
        // Load saved settings on init
        loadSavedSettings();
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