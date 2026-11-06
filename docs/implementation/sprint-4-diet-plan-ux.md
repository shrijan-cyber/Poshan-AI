# Sprint 4 — Diet plan and grocery experience

## Status: Partial

Basic and report-based plan pages now render saved meals through a shared responsive card. Cards show the saved dish/meal name, meal category and day, portion text, backend-provided calories/macros, ingredient quantities and available raw/cooked labels, plus recipe instructions only when saved. Missing nutrition, ingredient details, or instructions are shown as unavailable. Older plans continue to use their existing `items` and `cookingInstructions` fields.

Basic plans now persist the deterministic composer's daily IFCT totals in an optional `dailyNutrition` field. The view reads that stored daily summary and per-meal values without recalculating nutrition in React. Older saved plans remain readable; if they do not contain a persisted daily total, the daily calorie summary is marked unavailable. Report-based meal plans persist the composer's existing per-meal calories/macros through optional additive fields; the current `MealPlan` response does not persist daily actual totals, so the page explicitly says daily actual totals are unavailable rather than deriving new nutrition values in the browser.

Both views now fetch grocery categories from the authenticated backend endpoints. The shared panel displays only returned ingredient names and quantities, has loading/empty/error/retry states, and downloads a text file without adding prices or quantities. It preserves the two existing grocery response shapes: basic-plan `foodName`/`quantityLabel` and report-plan `name`/`quantity`.

## API changes

Added optional `dailyNutrition` persistence to basic diet plans plus per-meal `calories` and `macros` persistence to report-based meal plans so the UI can display the deterministic composer's existing IFCT calculations. Existing documents remain valid and unmodified; old documents show nutrition as unavailable when those fields are absent. This is an additive API response change. Added `getMealPlanGroceryList(id)` for the existing `GET /mealplans/:id/grocery-list` route; the basic plan continues to use `GET /diet-plans/:id/grocery-list`. Both calls use the existing Axios client and auth interceptors.

## Files

- `poshanai-frontend/src/components/diet/StructuredMealCard.jsx`
- `poshanai-frontend/src/components/diet/GroceryListPanel.jsx`
- `poshanai-frontend/src/utils/groceryListDownload.js`
- `poshanai-frontend/src/api/mealPlanApi.js`
- `poshanai-frontend/src/pages/DietPlanResult.jsx`
- `poshanai-frontend/src/pages/MealPlanView.jsx`
- `poshanai-frontend/tests/groceryListDownload.test.js`
- `poshanai-backend/src/models/MealPlan.js`
- `poshanai-backend/tests/mealplan.test.js`
- `poshanai-backend/src/models/DietPlan.js`
- `poshanai-backend/tests/dietPlanGrocery.test.js`

## Validation and limits

- Focused ESLint for the changed frontend files: passed.
- Grocery formatter assertions: 5 passed using a direct Node.js assertion run.
- `node --test tests/groceryListDownload.test.js` could not start the Node test worker in this environment (`spawn EPERM`); the test cases are present but the test-runner result is unverified.
- No browser or device-level checks were available in this workstream.
- Existing recipe provenance remains incomplete as documented in Sprint 3. This UI surfaces available saved data and does not make unsupported recipes or quantities appear verified.
