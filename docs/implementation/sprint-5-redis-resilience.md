# Sprint 5 — Redis resilience and production readiness

## Status

The code paths now distinguish process liveness from dependency readiness, fail closed when the shared Redis rate-limit store is unavailable, retry/recreate Redis-backed clients, and close API-owned Redis resources during shutdown. Redis outage/recovery behavior is covered with deterministic mocks. No live Redis outage/recovery was run.

## Behavior

- `GET /health/live` reports process liveness independently of MongoDB and Redis. An optional dependency outage does not cause an orchestrator to restart a running process.
- `GET /health/ready` checks MongoDB and Redis. Production is unhealthy when either required dependency is unavailable and returns 503. In local development, Redis remains optional; the response can be degraded with HTTP 200 while synchronous/local fallbacks remain available. Existing `GET /health` remains a readiness alias for compatibility.
- Production configuration still requires `REDIS_URL`. The API and auth rate-limit stores remain Redis-backed in production and fail closed with a generic 503 response when Redis operations fail; there is no unlimited fallback.
- The Redis health probe retries briefly and reconstructs its client on subsequent probes after a terminal connection failure. The shared rate-limit ioredis client uses its reconnect strategy; queue clients are discarded after failed enqueue attempts so later requests can create a fresh connection. BullMQ worker clients retain their reconnect behavior.
- Meal-plan generation uses its existing synchronous fallback if enqueueing fails due to Redis. Report OCR returns a retryable 503 in production instead of running expensive OCR inline; development retains its bounded synchronous fallback.
- Shutdown closes the HTTP listener and independently attempts to close OCR, meal-plan, health-check, and rate-limit Redis resources. Cleanup uses `Promise.allSettled` so one close error does not prevent the remaining clients from closing.
- Redis errors are logged as generic events or safe error metadata. Raw Redis error messages are not logged from the health probe, rate-limit store, or worker startup path.

## Tests and verification

- `node --import ./src/scripts/setTestEnvironment.js --test tests/healthService.test.js tests/sensitiveRateLimiter.test.js tests/mealPlanQueue.test.js` — 11 passed, 0 failed.
- Focused ESLint via `npm.cmd exec -- eslint src/app.js src/jobs/worker.js src/middleware/sensitiveRateLimiter.js src/server.js src/services/healthService.js tests/healthService.test.js tests/sensitiveRateLimiter.test.js` — passed.
- `tests/healthService.test.js` verifies production readiness failure when Redis is down, local degraded readiness, MongoDB failure, and dependency-independent liveness.
- `tests/sensitiveRateLimiter.test.js` verifies atomic namespaced counting, fail-closed behavior, recovery after a simulated outage, and sanitized Redis operation errors.
- `tests/mealPlanQueue.test.js` verifies local synchronous behavior and queue fallback when a production Redis connection fails.
- Live Redis failover, a Redis container, and multi-replica coordination were not run. No service was started for this workstream.

## Files

- `poshanai-backend/src/app.js`
- `poshanai-backend/src/jobs/worker.js`
- `poshanai-backend/src/middleware/sensitiveRateLimiter.js`
- `poshanai-backend/src/server.js`
- `poshanai-backend/src/services/healthService.js`
- `poshanai-backend/tests/healthService.test.js`
- `poshanai-backend/tests/sensitiveRateLimiter.test.js`
