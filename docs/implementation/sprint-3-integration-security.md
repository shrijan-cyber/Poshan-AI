# Sprint 3 — Frontend/backend integration and security

## Audit scope and outcome

Audited actual React routes and API calls against Express route mounts and middleware. The SPA uses `/api/v1` by default; Express mounts the same routers under `/api/v1` and the documented compatibility alias `/api`. The report uploader inherited the Axios client's JSON content type, which caused Axios to serialize `FormData` instead of sending a multipart file body. The upload now clears that header so the browser supplies its multipart boundary. A request lock also prevents duplicate uploads while processing. The report-based meal-plan poller previously treated `unachievable` as an in-progress state and retried forever; it now treats that status as terminal and shows the backend message.

| Workflow | Frontend contract | Backend contract and guard |
| --- | --- | --- |
| Landing | `/` | Static public page; no API contract. |
| Login, registration, OTP, 2FA | `authApi.js` under `/auth` | `/auth` and `/auth/otp`; Joi validators and auth-specific limiters; login/registration remain separate from protected routes. |
| Onboarding | `/onboarding` submits through `lifestyleApi.js` | Authenticated `/lifestyle/onboarding`; Joi values align with LifestyleProfile enums. |
| Dashboard | `/dashboard` uses report, meal-plan, and daily-log API modules | `/reports`, `/mealplans`, and `/daily-logs`; authenticated data is scoped to the current user. |
| Food Library | `/food-library` uses the food search API | Public, read-only `/foods/search`; no account data is returned. |
| Food search and food logging | `foodLogApi.js` uses `/foods/search` and legacy `/logs`; `dailyLogApi.js` uses `/daily-logs` | Public read-only food catalog; distinct validated legacy and DailyLog write contracts, both user-authenticated. Smart Log is authenticated, limited, validated, and returns a preview that can be confirmed through the DailyLog contract. |
| Basic diet plan | `/diet-plan` wizard and `/diet-plan/view` use `dietPlanApi.js` | Authenticated, validated `/diet-plans/generate-basic`; saved-plan reads and grocery lists are owner-filtered. |
| Report-based meal plan | `mealPlanApi.js` uses `/mealplans` | Authenticated generation, list, job status, recipes, grocery list and status updates; controller reads/writes include authenticated user ownership. |
| Reports | `reportApi.js` uses `/reports` | Upload, list, read, review and delete are authenticated; file upload enforces MIME, magic-byte, size and count checks and uses private storage. Report queries are filtered by `req.user._id`. |
| Lifestyle recommendations | `lifestyleApi.js` uses `/lifestyle` | Authenticated onboarding and recommendation reads; profiles are fetched by authenticated user ID. |
| Profile and calories | `userApi.js` uses `/users/me`; calorie UI uses `/calories/maintenance` | Authenticated self-service routes; identity is derived from the access token, not request-body user IDs. |
| Calorie tracker | `/calorie-tracker` uses Redux plus the legacy food log API; dashboard Smart Log uses DailyLog | `/logs` and `/daily-logs` remain intentionally separate, authenticated contracts. Smart Log API integration tests pass. |
| Experts and bookings | `expertsApi.js` uses `/experts` and `/experts/book` | Directory is public; booking requires authentication and Joi validation. `/bookings` is authenticated and user-scoped. |
| Notifications | No notification API client or UI consumer found in `poshanai-frontend/src` | Authenticated list/read operations are filtered by the current user ID; current notification delivery is backend-only. |
| Administration | No user-facing API call | Admin router applies `verifyToken` and `requireRole('admin')` to all routes. |

## Security and reliability checks

- `ProtectedRoute` improves navigation UX; backend `verifyToken` remains authoritative. Refresh tokens are handled through the existing Axios client with credentials, and access tokens are held in memory and added by its interceptor.
- `app.js` configures explicit proxy trust, Helmet, credentialed origin allowlisting, JSON limits, Mongo operator sanitization, global API limits and request IDs. Sensitive report, Smart Log, and meal-plan generation routes have additional limits.
- Request logs contain method, path, status, timing and request ID; the logger filters metadata and redacts credentials, email addresses, and Mongo IDs. No request bodies or raw OCR text are logged by the inspected paths. Production error responses hide internal 5xx messages and never return stack traces.
- USDA credentials are server-side `FDC_API_KEY`; no `VITE_*` key exists. The adapter is not exposed through an application route, and its errors do not include request URLs or keys. USDA transmits its key as a query parameter, so deployment proxy/access logs must redact it.
- The report upload middleware validates both declared MIME and file signature and removes local staging files after private storage. Ownership checks remain in report controllers.
- `/logs` and `/daily-logs` are intentionally separate legacy/current contracts; route aliases preserve `/api` callers. The two plan generators (`/diet-plans` and `/mealplans`) also remain distinct.
- Notification routes and background delivery exist in the backend, but no frontend consumer was found. This is an unconnected feature surface, not a request/response mismatch; no new notification UI was added in a reliability sprint.

## Verification

- `tests/smartLog.test.js`: **4 passed, 0 failed** using `node --experimental-test-module-mocks --import ./src/scripts/setTestEnvironment.js ./tests/smartLog.test.js`.
- `tests/reportApi.test.js`: **1 passed, 0 failed** using `node ./tests/reportApi.test.js`; verifies the upload body remains `FormData` and has no manually supplied content type.
- `tests/mealPlanJobStatus.test.js`: **3 passed, 0 failed**; covers completed, pending, failed, and unachievable generation states.
- `tests/lifestyleAuth.test.js` and the MongoDB-backed `tests/lifestyle.test.js`: authentication and user scoping checks passed; see `sprint-3-validation-report.md`.
- Route-level controller integration and live browser/device workflows were not run for every page. The repository has no frontend test script; frontend lint/build verify compilation but do not establish browser-level behavior.
- Other inspected endpoint contracts and authorization rules matched their backend routes; existing contracts were retained.

## Remaining manual verification

- Run a deployed-environment smoke test through the actual reverse proxy, especially CORS, proxy-hop configuration, refresh cookies, and FDC key redaction.
- Exercise report upload/OCR, meal-plan background jobs, notifications, and expert booking against a non-production deployment with MongoDB/Redis and the configured storage provider.
- Perform browser keyboard, screen-reader, and device-matrix checks; those are not covered by the repository's current automated test scripts.
