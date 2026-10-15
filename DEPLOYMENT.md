# Deployment Guide

The app is a static PWA plus one Vercel serverless function (`api/generate-meal.js`) that calls the Anthropic API. It is designed for **Vercel**. Other static hosts can serve the recipes and meal log, but the AI generator will not work there.

## What the app is (and isn't)

- Recipe ideas and an on-device meal log.
- **Not** a medical device. It gives no medical advice and does not calculate insulin or medication doses.
- Recipes have **not** been reviewed by a dietitian, clinician or food-safety specialist. Nutrition values are withheld (`"nutrition": null` in `meals.json`) until per-serving figures are calculated from weighed ingredients and reviewed.

Do not put real health information (lab results, diagnoses, medications) in this repository or its docs. Use clearly made-up examples if you need one.

## Deploy to Vercel

1. Import the GitHub repository in Vercel. No build command is needed; Vercel installs `@anthropic-ai/sdk` for the function from `package.json`.
2. Set environment variables (Project → Settings → Environment Variables):

   | Variable | Required | Purpose |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | for AI | Server-side API key. Never exposed to the browser. |
   | `AI_GENERATION_ENABLED` | for AI | Must be `true` or the endpoint returns 503. Set to anything else to switch AI off instantly. |
   | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | for AI in production | Shared rate-limit store (Upstash Redis from the Vercel Marketplace; `KV_REST_API_URL` / `KV_REST_API_TOKEN` also work). **In production the endpoint refuses to call the AI without it.** |
   | `AI_LIMIT_PER_IP_10MIN` | no | Requests per visitor per 10 minutes (default 5). |
   | `AI_LIMIT_PER_IP_DAY` | no | Requests per visitor per day (default 20). |
   | `AI_LIMIT_GLOBAL_DAY` | no | Total requests per day for the whole app (default 200). This is the main cost cap. |
   | `ALLOWED_ORIGINS` | no | Extra origins allowed to call the API, comma-separated (e.g. a custom domain). The deployment's own host is always allowed. |
   | `ANTHROPIC_MODEL` | no | Override the model (default `claude-haiku-4-5-20251001`). |
   | `AI_ALLOW_MEMORY_RATE_LIMIT` | no | `true` lets production run with per-instance in-memory limits. Not recommended: limits then don't hold across instances. |

3. Also set a **monthly spend limit and usage alerts** in the Anthropic Console. The app's limits bound request counts; the Console limit is the hard backstop on cost.
4. Deploy, then check:
   - The app loads, shows today's meals, and works offline after the first visit.
   - Response headers include `Content-Security-Policy` and `X-Content-Type-Options`.
   - In a preview deployment, a cross-site `POST /api/generate-meal` (no matching `Origin`) returns 403, and repeated requests eventually return 429.

## How the AI endpoint is protected

In order, before any paid call is made:

1. Switched off unless `AI_GENERATION_ENABLED=true`.
2. The request's `Origin` must be the app itself (or `ALLOWED_ORIGINS`). This stops other websites from using it through visitors' browsers. It does **not** stop scripts that fake the header; the rate limits handle those.
3. JSON body of at most 2,000 characters, with every field checked against a fixed list or range.
4. Per-visitor and global daily limits (visitor IPs are stored only as truncated SHA-256 hashes).
5. At most 4 concurrent calls per instance, a 25 s provider timeout, and `max_tokens` 2,000.

The AI's answer must match a strict JSON schema and then pass the same checks as the built-in recipes: your carb limit and calorie target, gout and heart exclusions, the selected protein, and the food-safety rules (canned ackee only, cooking temperatures for poultry and pork). If any check fails, the recipe is withheld rather than shown. Errors returned to the browser never include provider responses; server logs carry a request ID.

## Recipe data

- `meals.json` is the single source of recipes. `test/meals-data.test.js` checks it on every run: no duplicate IDs, no fresh ackee, cooking temperatures for raw poultry and pork, no unverified nutrition.
- To add nutrition, calculate per-serving values from weighed ingredients, have them reviewed, then set `"nutrition": { "calories": …, "protein": …, "carbs": …, "fiber": …, "verified": true, "source": "who reviewed it" }`. Only verified nutrition is used to apply carb limits to the built-in recipes.
- The old Google Sheet is **off** (`USE_REMOTE_SHEET: false` in `app.js`) because it still holds the previous recipes. To use it again, re-import `meals-for-sheet.csv` (run `node scripts/export-sheet-csv.mjs`), check the sheet's sharing settings, then set the flag to `true`. Sheet rows that fail the safety checks are dropped automatically, and sheet nutrition is never treated as verified.

## Releasing an update

Bump `VERSION` in `sw.js` on each release. Same-origin files are fetched network-first, so installed apps pick up new code on their next online visit; the version bump refreshes the offline copy.

## Local development

```bash
npm install
npm run check      # syntax check + tests
npx vercel dev     # app + API at http://localhost:3000
```

`npm start` serves the static files only (no API).

## Privacy summary

- Meal log, notes and settings: stored only in the browser (`localStorage`). Not sent anywhere.
- AI generator (only when used, after the in-app notice is accepted): selected proteins, meal type, carb level, calorie and protein targets, budget, and the gout/heart choices go to the Vercel function and to Anthropic.
- Check the current data-retention terms of Vercel and Anthropic for your account and describe them accurately to users.
