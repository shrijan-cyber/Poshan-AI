# Health-test recommendations and nutrition-data implementation plan

## Phase 0 findings

- `POST /api/lifestyle/onboarding` validates and persists controlled diet, symptom, sun-exposure, habit, family-history and sleep answers in `LifestyleProfile`; the frontend sends those fields in the existing request.
- `GET /api/lifestyle/recommendations` currently returns `recommendations: []` both when no profile exists and when the rules do not match. `Recommendations.jsx` therefore renders the ordinary no-match message for missing onboarding data.
- `data/testRules.json` contains five rules but no review metadata. `testRules.js` evaluates conditions exactly and logs only the rule ID. One existing rule contains an unreferenced age cutoff.
- The IFCT application subset has 542 records versus 528 reported by the official IFCT publication. The checked-in manifest states reuse permission and source-column/unit mapping are not confirmed. All 542 records have `null` B12 and fiber; there are two duplicate normalized names. All 70 ingredient references across 20 recipes resolve, but recipes have no per-yield provenance.

## Planned changes and dependencies

1. **Rule catalog** — version the rule schema, require explicit catalog and per-rule review metadata, keep new/current candidates in `pending` state, and activate only when both catalog and individual rules are approved. Keep conditions deterministic and limited to structured answers; do not infer symptoms from free-text diet descriptions.
2. **Rule service** — validate metadata and condition schemas at load time; expose catalog status/version, evaluate only approved rules, deduplicate by test identity, include rationale/factors/disclaimer, and log only rule IDs.
3. **Controller/API** — distinguish `needs_onboarding`, `pending_clinical_review`, `ready` with matches, and `ready` with no matches. Add fields while preserving existing `recommendations`, `suggestions`, and `disclaimer` keys.
4. **Frontend** — render pending-review and no-profile states separately; show cards only for backend-approved recommendations; keep no-match copy reassuring and preserve existing API client/auth behavior.
5. **Tests** — validate schema/review gates, condition evaluation, deduplication, disclaimer presence, empty results, controller missing-profile status and frontend status rendering where a UI test runner exists.
6. **Food-data staging** — create source-specific normalizers and import/audit scripts that write only under a separate staging namespace. Preserve source IDs, nutrient units, food state uncertainty, nulls and source/license metadata. Require manual review before any staged record can become a runtime food.
7. **Source/license documentation** — document USDA FoodData Central's CC0 status, Open Food Facts' ODbL obligations, and the INDB methodology/coverage with its reuse license unconfirmed. Do not import INDB or merge packaged food records into the IFCT catalog.
8. **Recipe data** — do not add recipe quantities or cooking yields until each has a traceable source. Existing 20 recipes and their IFCT references remain unchanged; add a validator/report for missing recipe provenance rather than fabricating it.

## Migration and operational risks

- Current recommendations have no clinical approval evidence. They must remain unavailable to end users until a qualified clinician reviews and approves both the rule set and each rule. The API must state this instead of showing a misleading no-match result.
- Existing onboarding documents remain readable; the recommendation catalog is a static versioned JSON artifact, so there is no database migration for rule versioning.
- IFCT licensing and unit/column mapping are unresolved in the checked-in manifest. Do not rewrite its checksum, data, recipe values, or current runtime catalog.
- USDA data types have different purpose and state/portion characteristics. USDA candidates stay separate from IFCT until identity, units, state and provenance are reviewed. Branded Open Food Facts data stays in a separate ODbL namespace.
- INDB methodology reports sources and recipe calculations but does not establish a redistribution license in the reviewed material; no records or recipes will be copied from it.

## Acceptance checks

- User without onboarding user gets a distinct onboarding state; onboarded user with only pending rules gets a distinct clinician-review state; a true active-rule no-match keeps a reassuring no-match state.
- Pending rules never appear in the user-facing recommendation array. An approved test fixture can be evaluated deterministically and produces rationale, triggering factors and a disclaimer.
- Duplicate suggestions consolidate; no health-answer values appear in logs.
- Importers preserve null nutrients and source IDs, reject unknown units and do not write production data. The audit reports actual counts and unresolved fields.
- Backend: focused rule/import tests, backend lint, then backend test suite. Frontend: lint and production build. No live clinical or data-source integration is claimed unless actually run.
