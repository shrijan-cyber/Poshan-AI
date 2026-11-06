# Sprint 3 — Validation report

## Status summary

| Task | Status | Result |
| --- | --- | --- |
| Nutrition data quality and staging review | Completed | Added a read-only audit, per-record status report, staging review, duplicate candidates, and explicit human-evidence approval gate. No food data was changed or promoted. |
| Recipe provenance and nutrition accuracy | Partial | Added reproducible recipe audits and nutrition calculations. All 20 recipes are usable with limitations; none have enough provenance to be marked ready. No recipes or nutrition values were changed. |
| Diet-plan engine reliability | Completed | Added target/restriction validation, blocked-recipe filtering, safe unachievable results, and provenance warnings. Report-based generation already uses the shared composer and validation pipeline. |
| Frontend/backend integration and security | Completed | Fixed multipart report upload serialization and terminal unachievable-job polling; added regression coverage. Audited actual route and ownership contracts. |

## Food data baseline

Read-only report from `runFoodDataQualityAudit()` on 2026-11-02:

| Source/status | Records |
| --- | ---: |
| IFCT 2017 application subset | 542 |
| USDA/FDC staging | 0 |
| Open Food Facts staging | 0 |
| Validated | 0 |
| Needs review | 20 |
| Incomplete | 522 |
| Rejected | 0 |
| Potential duplicate name groups | 2 |
| Duplicate IFCT identifiers | 0 |

Additional findings: **1,084 null nutrient values** (B12 and fiber are null in all 542 records); seven nutrient source-unit mappings are unverified; record-level raw/cooked state and source-row locator are absent for all 542; 14 records have zero energy with positive fat; three codes fail the existing macro-energy check. The manifest reports 528 official records while the application subset contains 542; without the source CSV and verified mapping, this difference remains unresolved. IFCT redistribution permission is unconfirmed.

## Recipe baseline

All 20 templates and 70 ingredient rows were audited. They reference 15 unique IFCT codes, with **0 invalid references**. No ingredient row has an explicit unit, preparation state, edible-portion percentage, quantity source, or yield source. No recipe includes cooking oil/ghee. Cooked-weight arithmetic and existing IFCT macro-energy calculations pass the audit checks, but those checks do not establish empirical yield or recipe accuracy.

Readiness: **0 ready, 20 usable with limitations, 0 blocked**. Do not call the current recipe totals complete household nutrition: added cooking fats are omitted, and ingredient quantity/yield provenance is not established. No recipe data was added or rewritten.

## Engine and integration changes

- Basic-plan generation validates demographics, enum values, target calories/macros, allergies and dislikes independently. It filters recipes through the provenance audit, keeps the household/diet/region checks, and returns `unachievable` when restrictions or physical portion limits prevent a safe plan. Existing persisted and API nutrition shapes remain intact; provenance warnings use the existing disclaimer field.
- Report-based generation already follows deterministic composition, bounded AI instructions, post-generation validation, ownership checks and persistence. The sync controller and BullMQ worker use that generator. Its existing validation covers day/meal coverage, weight bounds and daily calorie bounds.
- The frontend report uploader had inherited the Axios JSON content type. It now preserves `FormData` and lets the browser set the multipart boundary; a submission lock prevents duplicate uploads.
- The report-plan poller now stops on the backend's terminal `unachievable` state and presents its message instead of polling indefinitely.
- Route comparison found `/api/v1` and `/api` compatibility mounts align with existing API modules. `/logs` and `/daily-logs` are distinct intentional contracts. All inspected private report, plan, profile, booking, notification and logging operations derive ownership from the authenticated user; admin routes require the admin role. Notification APIs currently have no frontend consumer.

## Test results

Focused suites run for this sprint: **71 passed, 0 failed**.

- `foodDataQualityAudit.test.js`: 6 passed.
- `recipeQualityAudit.test.js`: 6 passed.
- `dietService.test.js`: 17 passed.
- `mealplan.test.js`: 9 passed (MongoDB Memory Server).
- `report.test.js`: 12 passed (MongoDB Memory Server).
- `smartLog.test.js`: 4 passed (mocked DailyLog and AI response).
- `foodDataStaging.test.js`: 7 passed.
- `foodDataCentralClient.test.js`: 6 passed (mocked provider).
- Frontend `npm test`: 4 passed (multipart request and job-status cases).

Validation commands:

- `npm.cmd --prefix poshanai-backend run lint` — passed.
- `npm.cmd --prefix poshanai-frontend run lint` — passed.
- `npm.cmd --prefix poshanai-frontend test` — passed, 4/4.
- `npm.cmd --prefix poshanai-frontend run build` — passed, 2,505 modules transformed.
- `git diff --check` — passed.

MongoDB-backed tests ran after approval to start the local test process. FDC tests use mocks only; no live external API calls were made. The full backend test suite was not run. The backend `build` script was not run because it rebuilds the IFCT data file, which this sprint must not overwrite. Browser/device end-to-end testing was not run; the repository has no browser test suite configured.

## Security and data-use findings

- FDC credentials remain server-only. The client is not mounted as a public proxy and does not include keys in error messages. Deployment proxy/access logs should redact FDC's required query parameter.
- Report uploads are authenticated and rate-limited, check both MIME and file signature, enforce a 10 MB size limit, and use private storage. Report reads/reviews/deletes are owner-scoped.
- Request logs omit request bodies and raw OCR text. Error responses include request IDs, avoid stack traces, and hide internal 5xx messages in production.
- FoodData Central records remain isolated from IFCT and are staged with provenance; Open Food Facts labels remain a separate product-data namespace. No record is automatically promoted.
- Clinical lifestyle rules are sourced but have not received formal PoshanAI clinician sign-off.

## Production readiness blockers

PoshanAI is **not production-ready for authoritative nutrition claims** based on this audit. The IFCT source mapping, record-level state/source rows, redistribution permission, suspicious oil energy values, and recipe measurement/yield provenance remain unresolved. Twenty recipes may be used only with the limitations already surfaced; none qualify as fully provenance-complete. External source staging must remain separate until a trusted reviewer workflow exists and explicitly approves records. Browser-level accessibility/device tests and deployed reverse-proxy/storage/Redis smoke tests remain manual follow-up.
