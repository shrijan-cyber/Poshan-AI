# Sprint 6 — Observability, error handling, and performance

## Implemented behavior

- Backend logging uses Winston JSON output with timestamps. The logger admits a small allowlist of operational fields, redacts email addresses, MongoDB URLs, bearer credentials, and 24-character object IDs, and does not serialize raw `Error` objects or stacks.
- `requestLogger` creates a server-side UUID, sends it in `X-Request-ID`, carries it through `AsyncLocalStorage`, and logs method, path, status, and elapsed milliseconds. It does not trust a caller-supplied correlation ID.
- API error responses include the request ID. HTTP 5xx responses now always use a generic message in development and production; internal exception messages are not sent to clients. Specific safe 4xx messages remain available for validation and expected domain errors.
- OmniRoute requests have a 30-second timeout. Timeout, connection, and non-success HTTP outcomes are logged without prompt contents, credentials, or raw provider response bodies. Recipe instruction generation retains its static-recipe fallback when the model call or output validation fails.
- Redis/Mongo readiness and liveness, plus safe Redis failure logging and teardown, are documented in the Sprint 5 Redis report.

## Regression coverage

`tests/observability.test.js` verifies that an internal exception message/code is not returned from a 500 response and that the request ID in the response body matches the `X-Request-ID` header.

## Findings and remaining gaps

- Request duration is measured at the HTTP boundary, but there is no persisted latency distribution, trace export, or per-database-query timing. No p50/p95/p99 claims can be made from current repository evidence.
- Food search uses the bounded static IFCT catalog; the Sprint 5 API work paginates in memory and does not require Mongo indexes. Other indexes should only be added after examining representative Mongo `explain()` output and workload measurements. No index was added here.
- Existing API tests cover auth, ownership, reports, and food logging, but full browser error-state checks and production telemetry integration are not available in this environment.
- The AI service records timeout/connect/HTTP status events and uses a static fallback for recipe instructions. It does not expose provider response bodies or token cost metrics; adding cost telemetry requires a provider contract that reliably supplies usage data.
- No monitoring dependency or external telemetry service was introduced.

## Validation

- Focused regression test: `node --import ./src/scripts/setTestEnvironment.js --test tests/observability.test.js` — **not yet verified**; the local process launcher returned Windows `CreateProcessAsUserW failed: 5 (Access is denied.)` before Node started.
- Targeted ESLint: `npm.cmd exec -- eslint src/middleware/errorHandler.js tests/observability.test.js` — **not yet verified** for the same process-launch failure.
- The integrating Sprint 6 report records the final integrated test and lint results.
