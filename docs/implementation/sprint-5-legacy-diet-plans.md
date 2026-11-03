# Sprint 5 — Legacy diet-plan compatibility

## Outcome

Existing plans remain readable without database migration or mutation. The basic-plan and report-plan API projections now add `nutritionAvailability` and per-meal `nutritionStatus` metadata. Existing fields and saved values are preserved.

Statuses apply to persisted nutrition values:

- `stored`: all expected calorie and macro values are present in the saved document.
- `incomplete`: at least one nutrition value exists, but part of the daily or meal summary is missing.
- `unavailable`: no usable saved nutrition summary exists.
- `recalculated` is reserved for future plans backed by verified source provenance; no current plan is labeled this way.

Missing values stay missing. The response annotator does not infer quantities, calculate nutrition, or write data. Basic plans with persisted meal nutrition but no `dailyNutrition` are marked incomplete, and the daily summary remains unavailable. Report plans have no persisted per-day aggregate, so daily actuals remain unavailable even when all saved meal totals are present.

## Why historical IFCT recalculation is disabled

The checked-in `poshanai-backend/src/data/ifct-manifest.json` says `sourceColumnMappingVerified: false`, nutrient source units are unverified, and record-level source matching is unavailable. It also states that the source CSV is not present and electronic reuse permission is unconfirmed. Although some historical plans include IFCT codes and raw weights, those facts alone do not provide verified source records. No existing plans meet the required provenance bar for recalculation.

The API exposes a reason under `nutritionAvailability.recalculation` when saved nutrition is incomplete or unavailable. No automatic or destructive backfill is run. A read-only preview is available as `node src/scripts/previewLegacyNutritionBackfill.js --confirm-read-only` from `poshanai-backend`; it reports counts only, requires an explicit flag, and never writes to MongoDB. Do not run it against a production database without the appropriate operational authorization. Once source mapping and permissions are resolved, its safe-candidate count can guide a separately approved backfill design.

## Compatibility and files

- `poshanai-backend/src/services/planNutritionCompatibility.js` assesses only stored fields and annotates API response data.
- `poshanai-backend/src/controllers/dietPlanController.js` and `src/controllers/mealPlanController.js` attach the additive metadata to owned/listed plans.
- `poshanai-frontend/src/pages/DietPlanResult.jsx`, `src/pages/MealPlanView.jsx`, and `src/components/diet/StructuredMealCard.jsx` explain stored, incomplete, and unavailable values without rendering missing data as zero.
- `poshanai-backend/tests/planNutritionCompatibility.test.js` covers current, incomplete, unavailable, and null-valued plans.

## Validation

Focused test command: `node --test tests/planNutritionCompatibility.test.js` from `poshanai-backend`. Record the actual result in the sprint validation report after integration. A MongoDB preview/backfill was not run; no database was modified.
