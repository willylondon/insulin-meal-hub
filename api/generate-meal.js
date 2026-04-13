// Vercel Serverless Function — AI Meal Generator
// Requires: ANTHROPIC_API_KEY environment variable set in Vercel dashboard
// Model: claude-haiku-4-5-20251001 (Haiku — fast and cheap)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured. Add ANTHROPIC_API_KEY in Vercel environment variables.' });
    }

    const { proteins = [], preferences = {}, mealType = 'any' } = req.body || {};

    const proteinList = proteins.length > 0 ? proteins.join(', ') : 'any available protein';
    const carbLevel = preferences.carbTolerance === 'low' ? 'very low carb (under 30g)'
        : preferences.carbTolerance === 'high' ? 'moderate carb (up to 60g)'
        : 'moderate carb (30-50g)';
    const restrictions = [
        preferences.avoidGout ? 'avoid gout triggers (no organ meats, shellfish, red meat, high-purine foods)' : '',
        preferences.prioritizeHeart ? 'heart-healthy (lean proteins, healthy fats, no saturated fat)' : '',
    ].filter(Boolean).join('; ');
    const mealTypeGuide = mealType === 'any' ? 'Choose the most appropriate meal type (Breakfast, Lunch, or Dinner)'
        : `This must be a ${mealType} meal`;

    const prompt = `You are a nutrition expert creating insulin-smart Jamaican meals for someone managing blood sugar levels.

Create ONE meal recipe using these available proteins: ${proteinList}
${mealType !== 'any' ? `Meal type: ${mealType}` : ''}
Carb target: ${carbLevel}
Calorie target: approximately ${preferences.calorieTarget || 500} kcal
${restrictions ? `Dietary restrictions: ${restrictions}` : ''}
Budget: ${preferences.budget || 'medium'}

Requirements:
- Use Jamaican ingredients and cooking styles where possible (callaloo, pumpkin, ackee, scotch bonnet, scallion, thyme, etc.)
- Prioritize insulin sensitivity: low glycemic index, high fiber, adequate protein
- ${mealTypeGuide}
- Keep it practical and easy to make at home

Respond with ONLY a valid JSON object, no markdown, no explanation:
{
  "Meal Name": "...",
  "Type": "Breakfast|Lunch|Dinner",
  "Prep Time": "X min",
  "Servings": "1",
  "Difficulty": "Easy|Medium|Hard",
  "Ingredients": "- ingredient 1\\n- ingredient 2\\n- ingredient 3",
  "Instructions": "1. Step one\\n2. Step two\\n3. Step three",
  "Insulin Benefits": "One sentence on why this is good for blood sugar.",
  "Nutrition Notes": "~X calories | Xg protein | Xg carbs | Xg fiber",
  "Tags": "Tag1, Tag2, Tag3",
  "Meal ID": "AI-001"
}`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            return res.status(502).json({ error: 'Claude API error', detail: err });
        }

        const data = await response.json();
        const text = data.content?.[0]?.text || '';

        // Extract JSON — handles any accidental markdown wrapping
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return res.status(502).json({ error: 'Could not parse meal from AI response', raw: text });
        }

        const meal = JSON.parse(jsonMatch[0]);
        meal['Meal ID'] = 'AI-' + Date.now();

        return res.status(200).json(meal);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
