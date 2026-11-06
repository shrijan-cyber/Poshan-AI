# OmniRoute recipe-instruction POC

## Scope

Opt-in gateway adapter for the low-risk task of generating cooking instructions for recipes already selected by the deterministic backend. It is not enabled by default and does not migrate report extraction, food parsing, or medical recommendations.

## Configuration

The default `AI_PROVIDER=legacy` keeps the existing route unchanged:

```dotenv
OMNIROUTE_URL=http://localhost:20128/v1/chat/completions
OMNIROUTE_MODEL=gemini-2.0-flash
OMNIROUTE_API_KEY=
AI_PROVIDER=legacy
```

To opt in for the recipe-instruction POC only:

```dotenv
AI_PROVIDER=omniroute
OMNIROUTE_POC_URL=http://localhost:20128/v1/chat/completions
OMNIROUTE_POC_MODEL=provider-prefix/model-id
OMNIROUTE_POC_API_KEY=server-side-key
AI_REQUEST_TIMEOUT_MS=15000
AI_REQUEST_MAX_RETRIES=1
```

Use an authenticated, loopback-only local OmniRoute endpoint for local evaluation. The API key is sent only by the backend. The POC does not use the POC URL when `AI_PROVIDER=legacy` is selected.

## Request and validation path

1. Deterministic backend code selects the recipe and calculates nutrition.
2. The bounded prompt contains selected recipe identity, validated ingredient references/names, portions, units and household measures.
3. Provider client uses OpenAI Chat Completions JSON-in-prompt mode, abort timeout and up to two retries (configuration accepts 0-2).
4. Existing Joi schema checks response shape, identity and exact meal coverage; existing IFCT alias whitelist rejects instructions that mention unselected foods.
5. Any provider/configuration/timeout/JSON/schema/food validation failure returns safe static recipe instructions. No retry is sent to a different provider.

## Test results

Mock-only tests cover success and usage parsing, transient HTTP retry, timeout normalization, invalid response body, missing configuration, the optional OmniRoute setting, server-side bearer header use, current Gemini-model route compatibility, ingredient whitelist rejection and static fallback. No live provider calls were made.

The focused backend provider + diet-service test run recorded on 4 November 2026 passed 24 tests; backend lint passed. The entire backend suite completed with exit code 0 on that date. Frontend lint, production build and frontend tests (7 tests via `node --test --test-isolation=none`) passed. These are prior-run results, not a fresh run on the current worktree; see `ai-ecosystem-validation-report.md` for limitations. Google currently lists the legacy default `gemini-2.0-flash` as shut down; do not infer that route is currently available.

See `docs/research/omniroute-poshanai-evaluation.md` for limits, privacy review, and the unmeasured latency/cost comparison. This POC does not establish provider quality or production readiness.
