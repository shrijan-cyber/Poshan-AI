# Sprint 4 — Validation report

## Status

| Workstream | Status | Result |
| --- | --- | --- |
| Dashboard experience | Completed | Reuses real daily log/profile data, includes links and saved-plan/recommendation panels with loading, error, retry, and empty states. The latest-plan card handles basic versus report-based navigation. |
| Food Library experience | Partial | Debounced search, categories, expandable per-100 g macro details, unavailable values, and request states are implemented. The current catalog API returns at most eight matches through this client and does not expose dietary tags, detailed nutrients, preparation state, source row, or pagination. |
| Diet-plan and grocery experience | Partial | Structured cards, backend grocery loading/render/download, legacy-plan handling, and optional persisted nutrition totals are implemented. Report-based per-day actual nutrition is not stored, and older plans do not gain backfilled totals; these show unavailable. |
| Production readiness | Partial | API/auth rate limits now share Redis in production and the health endpoint fails readiness when required Redis is down. Security and integration checks pass. Browser journey testing and live multi-instance Redis checks remain unavailable. |

## Features and contracts

- Dashboard reads existing user-scoped endpoints and links basic saved plans to `/diet-plan/view` and report plans to `/meal-plan/:id`.
- Food Library uses the existing public `GET /foods/search` route and existing Axios client. No backend catalog API changes or food/nutrition records were made.
- `GET /diet-plans/:id/grocery-list` and `GET /mealplans/:id/grocery-list` remain unchanged and authenticated. The frontend downloads only the names and quantities returned by these endpoints.
- Additive persistence/API fields: `DietPlan.dailyNutrition[]` stores deterministic daily totals; `MealPlan.meals[].calories` and `macros` store deterministic per-meal totals. All are optional for old documents; no migration or backfill runs. Existing model responses gain fields for newly generated plans.
- Updated one stale food-log assertion to require unavailable aggregate macros to remain `null` rather than be treated as zero.
- API and auth rate limits now use the existing Redis-backed store in production. Redis store failures fail closed with 503. Production health returns 503 when required Redis is unavailable; local Redis remains optional/degraded.

## Files changed for Sprint 4

- Backend: `src/app.js`, `src/routes/authRoutes.js`, `src/middleware/sensitiveRateLimiter.js`, `src/services/healthService.js`, `src/models/DietPlan.js`, `src/models/MealPlan.js`.
- Backend tests: `tests/healthService.test.js`, `tests/sensitiveRateLimiter.test.js`, `tests/dietPlanGrocery.test.js`, `tests/mealplan.test.js`, `tests/foodLog.test.js`.
- Frontend: `src/pages/Dashboard.jsx`, `src/pages/FoodLibrary.jsx`, `src/pages/DietPlanResult.jsx`, `src/pages/MealPlanView.jsx`, `src/api/mealPlanApi.js`, `src/components/diet/StructuredMealCard.jsx`, `src/components/diet/GroceryListPanel.jsx`, `src/utils/groceryListDownload.js`.
- Frontend tests: `tests/groceryListDownload.test.js`.
- Documentation: `sprint-4-dashboard.md`, `sprint-4-food-library.md`, `sprint-4-diet-plan-ux.md`, `sprint-4-production-readiness.md`.

This checkout already contained unrelated uncommitted Sprint 2/3, UI, booking, notifications, and documentation work. It was preserved; this report does not attribute those existing edits to Sprint 4.

## Validation

- Backend full suite: `npm.cmd test` — **206 passed, 0 failed** (MongoDB Memory Server; rerun after final schema changes).
- Backend lint: `npm.cmd run lint` — passed.
- Frontend tests: `npm.cmd test` — **7 passed, 0 failed**.
- Frontend lint: `npm.cmd run lint` — passed.
- Frontend build: `npm.cmd run build` — passed; Vite transformed 2,508 modules.
- `git diff --check` — passed; Git emitted only line-ending conversion warnings for existing LF worktree files.
- The initial sandboxed test/build attempts encountered Windows `spawn EPERM`; the checks were rerun successfully in the permitted execution context.
- Backend `build` was not run because its script writes IFCT output. No IFCT values or recipe records were changed.

## Browser and device testing

Not run. The connected Chrome session had only `about:blank`, and `docker compose ps` could not reach Docker Desktop (`permission denied` to its engine). No app/API browser session was available. The authenticated journeys (signup/login, onboarding, dashboard, food search, plan generation/details/grocery, report upload, recommendations, and profile update) therefore remain unverified end-to-end in a browser. MongoDB-backed API integration tests cover selected auth, report, plan, ownership, and logging paths.

## Remaining limits and production blockers

- The food search API does not expose enough metadata for verified dietary filtering, raw/cooked status, detailed nutrient profiles, source-row attribution, or server pagination.
- Report-based meal plans still do not persist daily actual totals. Existing plans do not get nutrition backfilled; unavailable states are intentional.
- Current IFCT and recipe provenance limitations from Sprint 3 remain. Nutrition accuracy, source authorization/redistribution permission, and recipe weights/yields must be resolved before authoritative production nutrition claims.
- Redis store behavior has unit coverage, but no live multi-instance Redis failover test was possible. Production proxy, worker, private storage, and full browser/device journeys still require a staging environment.

No files were staged, committed, or pushed.
