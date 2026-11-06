# Backend guidance

- Keep the existing Node.js ESM, Express, Joi, Mongoose and service/controller/route architecture. Avoid new dependencies or parallel frameworks without an explicit need.
- Validate request input at the route boundary. Enforce authentication, ownership, and authorization in backend code; never rely on frontend-only guards.
- Preserve existing API fields and previously stored document compatibility. Inspect route, controller, service, model, middleware and focused tests before changing a contract.
- Keep secrets server-side. Do not log credentials, PII, report contents or raw health data. Return normalized errors without upstream prompt/response bodies.
- Use focused tests and lint. Do not call external providers during tests; mock network calls and preserve deterministic fallback behavior.
