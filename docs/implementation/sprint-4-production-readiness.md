# Sprint 4 — Production readiness and quality

## Scope and audit result

This review followed the authenticated React API clients through Express mounts, middleware, controllers, services, and the relevant models. The canonical client path is `/api/v1`; the same routers remain mounted under `/api` for compatibility. High-risk conditions found during review were addressed without changing request/response contracts.

## Implemented hardening

- **Distributed request limits:** the general API and public registration/login limiters now use the existing Redis-backed rate-limit store. This makes limits consistent across production API replicas; Redis is already a required production dependency. The existing login key keeps the email hashed and combines it with the normalized client IP. When the store is unavailable, requests fail closed with a retryable 503 rather than silently losing protection.
- **Readiness signal:** production health now reports `unhealthy` (HTTP 503) if MongoDB or required Redis is unavailable. In non-production, Redis remains optional and its outage reports `degraded` (HTTP 200) with the development OCR fallback message. This corrects the former production health response that implied OCR could fall back synchronously while uploads actually return 503.
- **Regression coverage:** Redis store namespacing, atomic increment result handling, decrement/reset, fail-closed behavior, and the production versus local readiness states have focused tests.

## Security and reliability audit

| Area | Evidence from source | Result / limitation |
| --- | --- | --- |
| Authentication | `authRoutes.js`, `authMiddleware.js`, JWT HS256 algorithm pinning, access-token account/status lookup, refresh-token cookie path | Protected routes require bearer access tokens; tests cover cross-tenant access, token algorithm rejection, and auth limiter bypass in test mode. Browser sign-in was not exercised. |
| Protected frontend navigation | `ProtectedRoute.jsx` checks session and onboarding completion | Route guard is UX protection; backend authorization remains authoritative. |
| Ownership | Report, diet-plan, meal-plan, daily-log, lifestyle, booking, and notification controllers derive user filters from `req.user` | Inspected saved-resource reads/mutations are user-scoped; admin routes require role authorization. |
| Request validation | Joi schemas on auth, profile, report, meal-plan, food/log, and lifestyle routes | Unknown fields are rejected or stripped according to each route schema. Contract validation tests exist for logging, meal plans, and reports. |
| Rate limiting | `sensitiveRateLimiter.js`, auth/OTP/report/meal-plan routes, API middleware | Sensitive routes already use Redis when configured. The general API and register/login limits now do as well in production. Redis outage is intentionally fail-closed. |
| Upload restrictions | `uploadMiddleware.js`, `reportRoutes.js`, `reportController.js` | Authenticated, one-file upload; PDF/JPEG/PNG MIME and signature checks; 10 MB limit; private storage key; per-user count/size quota; report retrieval is owner-scoped. Production queue outage deletes the queued report and returns retryable 503. |
| Sensitive-data logging | `requestLogger.js`, `logger.js`, `errorHandler.js` | Request bodies/OCR text are not logged; logger allows only operational fields and redacts email, Mongo IDs, bearer tokens, and Mongo connection strings from messages. Production 5xx responses hide internal details. |
| Environment | `config/env.js` | Production requires Redis, valid distinct JWT secrets of at least 32 characters, TLS for non-local MongoDB, and valid storage configuration. Actual `.env` files were not read. |
| External APIs | `aiService.js`, `foodDataCentralClient.js` and their tests | AI instructions fall back to static recipe directions; provider failures avoid exposing credentials in responses. FDC adapter uses server-only key and mocked-provider tests; deployment access logs must redact its query-string key. |
| MongoDB efficiency | paginated report/meal-plan reads, bounded dashboard requests, indexes declared in models | No unbounded report/plan list query found in the reviewed endpoints. No new indexes were added. |
| Redis/BullMQ | report queue, meal-plan queue, workers, health service | Meal-plan generation falls back synchronously on unavailable Redis; development report OCR also falls back synchronously. Production report OCR requires Redis and returns 503 when the queue is unavailable. Readiness now reflects this dependency. Worker/reverse-proxy deployment behavior still needs environment smoke testing. |

## User-journey verification

Backend tests cover portions of registration/login, profile/onboarding authorization, plan generation, report upload/ownership, food logging, grocery aggregation, and recommendation rules. A complete browser-run of the ten requested journeys was not possible during this sprint: Docker Desktop denied access to its engine, and the connected Chrome session contained only `about:blank`; no app services were running in that browser. No synthetic account or health report was created in a possibly persistent local database.

## Files changed for this task

- `poshanai-backend/src/app.js`
- `poshanai-backend/src/routes/authRoutes.js`
- `poshanai-backend/src/middleware/sensitiveRateLimiter.js`
- `poshanai-backend/src/services/healthService.js`
- `poshanai-backend/tests/sensitiveRateLimiter.test.js`
- `poshanai-backend/tests/healthService.test.js`

## Remaining production blockers

- IFCT record-level source/unit mapping, redistribution permission, and recipe quantity/yield provenance remain unresolved (see Sprint 3 data reports); do not present current plans as authoritative nutrition advice.
- A real production/staging environment still needs Redis outage, proxy/IP handling, storage lifecycle, email/OTP provider, and worker recovery smoke tests.
- Browser/device accessibility and the complete authenticated journey matrix remain unverified until an isolated, non-production test environment is available.
- Distributed rate-limit behavior is unit-tested at the store layer but has not been exercised against a live multi-instance Redis deployment.
