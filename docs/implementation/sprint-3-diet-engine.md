# Sprint 3 — Diet plan engine reliability

## Scope

The existing plan-generation architecture and response shape remain in place. The basic-plan route still calls `generateBasicDietPlan()`, enhances only cooking instructions, calculates grocery ingredients from the composed raw quantities, and stores the plan through the existing `DietPlan` model. Report-based generation continues to call `composeRecipeMealPlan()` and returns its existing unachievable result to the controller/worker.

The report-based flow was traced through `generateMealPlan()` → `composeRecipeMealPlan()` → bounded `enhanceRecipeInstructions()` → `validateGeneratedMealPlan()` → `MealPlan.create()`. The synchronous controller path and BullMQ worker call the same generator. `validateGeneratedMealPlan()` checks day coverage, meal categories, raw item weight, and absolute daily calorie bounds; the shared composer applies the profile-relative ±10% calorie validation and ingredient caps before either path stores a plan. AI instructions are restricted to selected ingredients and `swapSuggestion` is fixed to `null`, so no unvalidated food substitution enters the persisted plan.

## Reliability behavior

- **Target validation:** Age, weight, height, gender, activity level, and goal are validated before deriving calories. Values outside existing profile ranges or unsupported enum values return stable client errors. Calorie and macro targets must be finite, positive/non-negative as appropriate, and macro energy must reconcile with the calorie target within 1% (rounding tolerance).
- **Final nutrition:** Each meal and day uses the backend IFCT calculation from recorded raw ingredient grams. Null nutrient values remain null. Existing macro-energy validation remains at ±10%; the final daily calorie target must also fall within ±10% without exceeding portion limits.
- **Portion safety:** Existing raw rice, atta, dal, and total meal raw-weight caps remain enforced during scaling. Targets that cannot fit safe portions or the supported minimum factor return `status: "unachievable"`; the service does not force a plan.
- **Recipe eligibility:** Diet compatibility, household whitelist, region, allergies, and dislikes are evaluated independently. Both restriction fields must be arrays of non-empty food names; malformed values are rejected rather than silently ignored. Familiar foods can rank only recipes that already pass these safety checks. If a required category has no eligible recipe, the service returns an unachievable result instead of throwing a generic no-match exception.
- **Coverage and diversity:** Requested categories are composed deterministically; the standard three-meal plan includes Breakfast, Lunch, and Dinner, and four-meal plans add a Snack. Existing consecutive-day lunch/dinner diversity remains active.
- **Provenance gate:** `auditRecipeProvenance()` is called for catalog entries. Recipes marked `blocked` are excluded from selection; selected recipes with unresolved provenance limitations add a concise evidence warning to the existing persisted `disclaimer` field. No nutrition values, household measures, or yields are inferred by this audit.
- **Grocery and persistence:** Grocery aggregation continues to read selected structured raw ingredients, and saved plans continue to retain ingredient-level calculated nutrients in the existing `items` payload. No model or endpoint contract changes were needed.

## API compatibility

The service preserves the generated plan's existing fields. Existing callers already recognize `{ status: "unachievable", message }`; the basic-plan controller maps it to HTTP 422 and does not save an impossible plan. Successful plans retain `targetCalories`, `macroTargets`, `macros`, `dailyNutrition`, `meals`, `type`, `profile`, and `disclaimer`. The disclaimer warning is persisted in the existing schema field.

## Files

- `poshanai-backend/src/services/dietService.js`
- `poshanai-backend/tests/dietService.test.js`
- `poshanai-backend/src/services/recipeQualityAudit.js` (dependency delivered by the recipe-provenance workstream)

## Tests and limitations

Focused `dietService.test.js`: **17 passed, 0 failed**. ESLint passed for the modified service and test. Tests cover IFCT arithmetic/nulls, scale factors, target validation, restrictions, household preference ranking, 3- and 4-meal coverage, required-category gaps, calorie/portion limits, multi-day diversity, grocery aggregation, and AI instruction fallback.

The recipe audit currently finds that source quantity, raw/cooked state, edible portion, yield, and oil provenance remain incomplete for at least some existing recipes. The plan keeps the recorded weights and IFCT values as the calculation basis and warns users; it does not claim measured recipe-level accuracy. No recipe or IFCT records were changed.
