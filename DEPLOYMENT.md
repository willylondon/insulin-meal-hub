# Deployment and release guide

This static PWA has one Vercel function for optional Anthropic generation. Static hosts support the recipe browser and local log only. Use Node 24 LTS; CI tests that runtime. No build command is needed.

## Nutrition and food safety

All 36 built-in recipes retain `nutrition: null`. **Numeric target filtering is disabled**, including for data claiming `verified: true`. AI carbohydrate, calorie and protein inputs only request estimates; passing the estimate checks does not prove actual nutrient content. Ingredient exclusions still apply to Today, Find and generated recipes, but keyword screening is not a clinical assessment.

Do not populate verified values by asking a model or adding a reviewer name. Enabling trustworthy nutrition requires weighed edible ingredients, brand/product and preparation state, food-composition record IDs and version (for example USDA FoodData Central), cooked yield and serving weight, deterministic unit/portion calculations, uncertainty, and independent qualified review. The current recipes do not contain enough information to do that reliably. Implement and test that provenance pipeline before enabling nutrient filtering.

Food-safety screening checks canned ackee, affirmative food temperatures for poultry/ground meat/fish, whole-cut rest time and common contradictory instructions. These are conservative lexical checks, not proof of safe handling, allergen safety or clinical suitability. They cannot understand every wording. Recipe cooking endpoints follow [FoodSafety.gov](https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures); ackee restrictions follow [FDA guidance](https://www.fda.gov/food/natural-toxins-food/hypoglycin-and-ackee-fruit). Recipes still need qualified review.

Do not commit personal health profiles or credentials. A historical-data cleanup is a separate coordinated operation; changing current files cannot remove copies in Git history.

## Production configuration — fail closed

Keep generation disabled unless the owner intentionally enables it after reviewing cost and data processing. This code change does not configure accounts, add secrets or enable AI.

| Variable | Contract |
|---|---|
| `AI_GENERATION_ENABLED` | Exactly `true` to permit the remaining checks; otherwise 503 without a provider call. |
| `VERCEL_ENV` | Must be `production`. Preview and unknown deployments cannot generate, even if secrets were inherited. |
| `ANTHROPIC_API_KEY` | Server-only credential; never commit or send to the browser. |
| `ALLOWED_ORIGINS` | Required comma-separated exact HTTPS origins, e.g. `https://insulin-meal-hub.vercel.app`. No paths, wildcards, credentials or trailing slashes. Request Host/forwarded Host/Referer do not establish trust. |
| `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` | One complete shared-store pair; alternatively use `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Do not configure both pairs or partial pairs. URL must be an HTTPS origin. Unavailable/malformed stores fail closed. |
| `AI_LIMIT_PER_IP_10MIN` | Default 5. If set, canonical nonnegative safe integer string; malformed values fail closed. |
| `AI_LIMIT_PER_IP_DAY` | Default 20; same validation. |
| `AI_LIMIT_GLOBAL_DAY` | Default 200; same validation. Zero prevents any provider calls. |
| `ANTHROPIC_MODEL` | Optional model override. Review model pricing before setting. |

The old `AI_ALLOW_MEMORY_RATE_LIMIT` bypass no longer permits production use. Missing store/origin/environment configuration produces 503 rather than a paid request. Origin checks are browser protections, not authentication; scripts can forge Origin. Shared global/IP limits bound request counts, not dollars. IP hashes are pseudonymous, not anonymous. Verify trusted proxy handling on the deployed platform; forwarded IP headers must be platform-controlled. Concurrency is bounded per instance, and the shared global daily count bounds admitted calls across instances. Set appropriate provider-account budgets/alerts separately and verify their actual enforcement.

Provider retries are disabled: an admitted request makes at most one SDK attempt. Timeout is 25 seconds; output is capped at 2,000 tokens. The JSON body is bounded to 2,000 characters and validated before generation. Output validation rejects unexpected fields, nonfinite quantities, fiber above total carbohydrate, unsupported verification claims and known unsafe cooking omissions. Returned nutrients remain unverified. No code test certifies medical safety.

## Local development and tests

```bash
npm ci --ignore-scripts
npm run check
npm audit --omit=dev --audit-level=high
npm start
```

`npm start` serves static files only. Tests mock the provider and Redis and do not require credentials or network calls. For intentionally configured local API development, memory limits require `NODE_ENV=development` and `AI_LOCAL_DEVELOPMENT=true`, with no `VERCEL`, `VERCEL_ENV` or `VERCEL_URL` markers. Configure an exact loopback HTTP origin in `ALLOWED_ORIGINS`. This is not a staging/preview bypass, and setting it alone does not enable generation. Never use real health data in tests.

## Recipe updates

`meals.json` is the source of truth; `node scripts/export-sheet-csv.mjs` regenerates the local CSV only. Tests check IDs, schemas, missing/unknown nutrition, food-safety screens. The remote sheet remains off. Do not switch it on until its content, edit permissions and privacy are reviewed. Legacy sheet nutrition is discarded; remote fields cannot self-certify verification.

## Installed-app upgrades

Bump the worker version for every release. Core same-origin assets install independently of optional fonts/icons. Online requests bypass HTTP cache; a four-second network deadline uses available offline copies. Cache writes are tracked for the fetch event lifetime, and only this app's cache namespace is cleaned. Failed essential precache leaves the old worker in control. Server failures can use known-good cached assets; uncached offline resources return an explicit 503.

An open tab may retain loaded JavaScript until reload. Test upgrades from an installed prior release, first-controlled offline navigation, failed/slow network, and storage quota failures. Do not claim a fix has reached every installed device merely because deployment succeeded.

## Release verification and privacy

Before enabling paid generation, verify production origins, environment scoping, durable store response handling and budgets with a mocked provider in an isolated test environment. Never use real paid requests merely to check configuration. Public GET checks can confirm security headers and method rejection, but cannot prove POST protection or provider retention.

Meal names, notes and settings remain in browser storage. Generation, when explicitly used after consent, sends selected proteins and preferences to Vercel and Anthropic. Document actual account retention/region settings before enabling it. Reset removes local state, not provider or platform logs. Do not claim regulatory exemption or compliance without appropriate assessment.
