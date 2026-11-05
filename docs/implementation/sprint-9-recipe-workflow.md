# Sprint 9 — recipe workflow status

The current deterministic recipe selector, primary protein-source grouping, dietary restriction/allergy filtering, portion scaling, static cooking-instruction fallback, and grocery aggregation are retained. Focused `dietService.test.js` covers dietary compatibility, protein identity despite different dish names, daily variety, portions, grocery deduplication, and instruction safety.

## Existing capability

- Household search and category filtering are available in Food Library.
- Meal plans can be generated and saved as `MealPlan` records; existing list, detail, status, recipe and grocery endpoints remain.
- Ingredient nutrition derives from IFCT raw weights in backend code; the AI cannot author macros.
- AI instructions are constrained to the selected recipe ingredients; static recipe directions remain the fallback.
- Grocery aggregation reads persisted final meal ingredients and preserves raw/cooked distinction where present.

## Not added in this phase

The current meal-plan contract has no saved-recipe collection or owner-scoped recipe-favorite API. It also has no verified replace/regenerate-one-meal endpoint. Adding those safely requires a domain operation that reselects only compatible recipes, recomputes all nutrients from verified ingredient rows, enforces per-day target/range limits, persists an atomic replacement and invalidates/rebuilds the grocery list. A display-only swap would leave nutrition and groceries inconsistent, so no unsafe partial endpoint was added.

Next implementation should define that backend operation and transaction/version semantics first, then expose matching UI controls. Keep AI restricted to instructions; do not use it to invent recipe ingredients or recalculate macros. Current data limitations in `recipeQualityAudit.js` still prevent calling all templates provenance-complete.
