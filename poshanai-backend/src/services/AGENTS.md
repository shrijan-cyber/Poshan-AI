# Backend service guidance

- Services own reusable domain logic; controllers handle HTTP concerns and routes own request validation. Avoid duplicate business rules across service/controller paths.
- Keep outbound AI calls narrowly scoped, server-side, time-bounded, retry-bounded and schema-validated. No provider fallback may silently expand data sharing.
- For meal planning, grocery lists, IFCT or report features, also follow [`src/rag/AGENTS.md`](../rag/AGENTS.md). Nutrition and medical safety rules remain applicable across services.
- Keep focused tests deterministic and offline. Do not use live health data or live provider calls in tests.
