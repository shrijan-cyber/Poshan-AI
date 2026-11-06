# Meal variety, protein-source labeling, and recipe instruction safety

## Root causes addressed

- Recipe selection optimized calorie fit/preferences, so the same protein family could be selected repeatedly.
- Old stored meal `proteinSource` text was not always evidence-backed; dish names alone can confuse dish variety with protein variety.
- AI instructions could mention cooking staples/ingredients outside the selected recipe, and fallback instructions were not consistently checked.

## Changes

- Added bounded candidate-set scoring to favor different IFCT-derived primary protein categories while preserving restrictions and calorie/portion limits.
- A source badge is emitted only when an IFCT ingredient contributes materially to calculated meal protein. Legacy opaque source text is optional and no longer drives the badge.
- Added display warnings when plan constraints limit source variety.
- AI instruction generation stays bounded to selected recipes and IFCT ingredients. Joi shape, recipe identity, meal coverage and ingredient whitelist checks reject unsafe output; static directions are validated, with generic deterministic directions as last resort.
- Added optional backend-only provider selection and bounded timeout/retry handling for the instruction pilot. Nutrition and recipe selection remain deterministic.

## Files in this focused change

- `poshanai-backend/src/services/dietService.js`
- `poshanai-backend/src/services/aiService.js`
- `poshanai-backend/src/services/aiProviders/chatCompletionProvider.js`
- `poshanai-backend/src/config/env.js`
- `poshanai-backend/src/models/DietPlan.js`
- `poshanai-backend/src/models/MealPlan.js`
- `poshanai-backend/tests/dietService.test.js`
- `poshanai-backend/tests/aiProvider.test.js`
- `poshanai-backend/.env.example`
- `poshanai-frontend/src/components/diet/StructuredMealCard.jsx`
- `poshanai-frontend/src/pages/DietPlanResult.jsx`
- `poshanai-frontend/src/pages/MealPlanView.jsx`

Existing user changes were already present in the worktree; this document does not claim every modified repository file belongs to this task.

## Validation and limitations

Focused backend verification on 4 November 2026: `node --import ./src/scripts/setTestEnvironment.js --test --test-isolation=none --experimental-test-module-mocks tests/aiProvider.test.js tests/dietService.test.js` — 24 passed, 0 failed at the time recorded. Backend lint passed; full backend test command completed exit code 0. Frontend lint and production build passed; frontend tests passed 7/7 with `node --test --test-isolation=none` because the standard runner was blocked by sandbox `spawn EPERM`. These are prior-run results, not a fresh run on the current checkout. No IFCT nutrition source records were edited.

Protein source variety is a preference score, not a clinical protein adequacy guarantee. Some plans may remain protein-heavy or report a diversity warning when restrictions/catalog availability constrain choices. No IFCT nutrition source records were edited.
