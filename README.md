# Insulin-Smart Meal Hub

A mobile-first PWA with Jamaican-style recipe ideas, an optional AI recipe generator, and a meal log that stays on your device.

> **Not medical advice.** The app does not calculate insulin or medication doses. Recipes and nutrition have not been reviewed by a dietitian or clinician, and blood-sugar responses vary from person to person. Talk to your care team about portions and carbohydrates.

## Features

- **Today's plan**: one breakfast, lunch and dinner suggestion per day from 36 recipes, filtered by your gout and heart-health settings.
- **Protein finder**: find recipes by what's in your fridge, or ask the AI generator for one. AI recipes are checked against your settings and food-safety rules before they're shown.
- **Meal log**: log meals with notes, see streaks, export to CSV. Stored only in this browser.
- **Offline**: installable PWA that works without a connection after the first visit.

## Project layout

```
index.html               App markup
style.css                Styles
app.js                   Browser logic (ES module)
meal-rules.js            Shared rules: settings, dietary exclusions, food-safety checks, CSV
meals.json               Recipe dataset (single source of truth)
api/generate-meal.js     Vercel function for AI recipes
api/_lib/rate-limit.js   Rate limiter (Upstash Redis or in-memory)
sw.js                    Service worker (network-first, offline fallback)
scripts/                 Maintenance scripts (sheet CSV export)
test/                    Node test suite
```

## Development

```bash
npm install
npm run check     # syntax check + tests
npx vercel dev    # run app + API locally
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for environment variables, the AI endpoint's protections, recipe data rules and the privacy summary.

## License

MIT
