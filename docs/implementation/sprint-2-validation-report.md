# Sprint 2 — Validation and quality report

## Implementation status

| Track | Status | Result |
| --- | --- | --- |
| USDA FoodData Central adapter | Completed, mocked/read-only | Server-side search/detail client, timeouts, normalized error codes and rate-limit metadata. Returns original USDA response records plus separate source metadata. No production catalog import. |
| Food import pipeline | Completed, staging-only | Versioned FDC/OFF staging batches with source identifiers, provenance, hashes, null preservation, duplicate/rejection reporting, idempotent no-overwrite writes, and production-ineligible status. |
| Recipe engine | Partial, safely constrained | Existing 20-recipe catalog retained. Typical-diet preference now steers safe recipe ranking. **0 recipes added** because raw quantities, yields, household measures, and oil energy lack adequate source provenance. |
| Lifestyle recommendations | Completed | Validated versioned rules, shared evaluator, account-scoped API flow, no-match messaging, sources and clinical disclaimers. |

## Focused test results

- USDA client mock suite: **6 passed, 0 failed** (`foodDataCentralClient.test.js`).
- Food staging suite: **7 passed, 0 failed** (`foodDataStaging.test.js`).
- Recipe/diet service suite: **13 passed, 0 failed** (`dietService.test.js`, reported by its owner agent).
- Lifestyle rule unit suite: **13 passed, 0 failed** (`testRules.test.js`); unauthenticated route test also passed.
- MongoDB-backed lifestyle API suite: **7 passed, 0 failed** (`lifestyle.test.js`). It initially could not start `mongod` in the sandbox (`spawn EPERM`); after the user approved the local test process, the suite passed.
- Backend ESLint over `src` and `tests`: passed. Frontend ESLint for `TestCard.jsx`: passed.
- Frontend production build: passed (`vite build`, 2,504 modules).
- No full backend test suite was run; focused suites cover each modified track and relevant lifestyle API behavior.
- Tests make no external FDC/OFF calls.

## Quality/security audit

- **Models and validation:** Lifestyle routes apply Joi validation before the controller; model enums/ranges and consent validation provide a persistence boundary. The unique `userId` index enforces one saved profile per account. The staging importer applies source-specific validators and validates whole batches before writing.
- **Authentication and authorization:** Onboarding and recommendations routes require `verifyToken`. Controllers use only the authenticated subject for profile upserts and reads. The integration suite verifies unauthenticated denial and profile isolation.
- **External API security:** FDC credentials are server configuration (`FDC_API_KEY`), never a frontend setting. The adapter does not log the URL/key, rejects unconfigured use without a request, times out, and maps provider failures. The USDA API requires its key as a query parameter; production proxy/access logs must redact that parameter. No public FDC proxy route was added.
- **Health-data handling:** Rule evaluation logs only static rule identifiers. The frontend receives factors for the signed-in user's own results. No raw health profile is sent to an external AI service by this implementation.
- **Redis/BullMQ:** These tracks add no queue work and do not change Redis/BullMQ behavior. Existing reminder/notification jobs were outside the modified execution paths; no Redis-backed tests were run for this sprint.
- **Frontend/backend contract:** Onboarding keeps legacy `suggestions` and adds the shared `recommendations` response; the recommendations page supports the current object and legacy arrays. Recipe APIs and persisted nutrition records were not changed.
- **Integration test setup:** Existing integration tests use `mongodb-memory-server`; running them requires permission to launch a local `mongod` subprocess in this Windows sandbox. The lifestyle integration suite was run and passed after permission was granted.

## Data, licensing, and remaining review

- USDA FoodData Central records are preserved in provider form; staging adds explicit provenance without inferring equivalence to IFCT. USDA documents FDC data as public-domain/CC0 and requests attribution: [FoodData Central API Guide](https://fdc.nal.usda.gov/api-guide/).
- Open Food Facts branded label records remain separate from generic food composition data; its ODbL obligations require review before redistribution or combining data: [Open Food Facts data reuse conditions](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api).
- Recipe grams, serving basis, and cooking yields still need evidence/provenance. Existing IFCT zero-energy/positive-fat oil rows need source review before oil can safely be added to recipe totals. Do not promote staging data or add recipes until those issues are resolved.
- Lifestyle references are public clinical guidance, but the rules have not received formal clinician sign-off for PoshanAI deployment. Keep the disclaimer and narrow triggers; obtain domain review before expanding rules.
- Manual configuration: set `FDC_API_KEY` only in the backend runtime if USDA calls are needed. No key is required for tests or existing plan generation.
