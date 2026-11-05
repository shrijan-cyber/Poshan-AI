# Recipe diversity and meal planning

## Current baseline

The existing deterministic catalog has 20 recipes and 70 ingredient rows; serving/portion nutrition is calculated by backend IFCT logic. `recipeQualityAudit.js` independently reports nutrition from raw ingredient grams and validates raw/cooked yield consistency and macro-energy tolerance. Audit readiness is limited because ingredient unit, state, edible portion and source evidence are not fully recorded. The audit must not be mistaken for clinical validation.

The current in-progress `dietService.js` work selects a recipe set using preference and diversity scoring, classifies primary protein source, avoids adjacent-day lunch/dinner repetition, applies household/diet/allergy filters, and keeps deterministic instruction fallback. Focused test run for this checkout passed 20/20 on 2026-11-05 (test name `dietService.test.js`). This sprint leaves that user's code intact.

## Next safe improvement

- Add curated protein-source classifications only where ingredient nutrient contribution is based on verified source mappings; preserve unknown category as unknown.
- Score the whole day's primary protein contribution and penalize repetition only when compatible candidates exist.
- Keep preference, allergy and household eligibility as hard constraints; diversity is a soft goal and must not force an unsafe recipe.
- Validate generated AI instructions against the exact scaled ingredients, portion and cooking constraints; fall back to static catalog instructions on parse, schema or ingredient mismatch.
- Aggregate groceries from exact final raw quantities by source-qualified ingredient identity; do not infer purchase weights or yields.
- Expand recipe templates only after their ingredients, portions, raw/cooked states and nutrition provenance are independently verified.

Do not create a second meal-planning database or port Diet App/Mealie source code. AGPL repositories were reviewed only for workflow concepts.
