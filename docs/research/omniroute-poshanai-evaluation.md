# OmniRoute and PoshanAI: Gateway Evaluation

**Status:** Local POC only; no production migration or live provider calls were performed. Reviewed 4 November 2026.

## Existing architecture found

The backend does not currently use Google's Gemini SDK or direct Gemini REST API. `src/config/env.js` configures `OMNIROUTE_URL`, `OMNIROUTE_MODEL` (default `gemini-2.0-flash`) and `OMNIROUTE_API_KEY`; `aiService.js` and `aiFoodParserService.js` send OpenAI Chat Completions requests to that endpoint. The present runtime therefore already depends on an OpenAI-compatible gateway endpoint, with a Gemini model ID as the default. The checked-in `.env.example` also contains `GEMINI_API_KEY`, but current service code does not read it. This POC preserves the current route under `AI_PROVIDER=legacy` and adds a separate opt-in route for recipe instructions.

## OmniRoute protocol and fit

OmniRoute documents an OpenAI-shaped `/v1` API, bearer-key authentication and model IDs normally prefixed by provider; `POST /v1/chat/completions` accepts `messages`, while provider capability varies. It is a strong protocol fit for the current Node `fetch` implementation and does not require a new SDK. [OpenAI compatibility](https://github.com/cheaper-inference/OmniRoute/wiki/Openai-Compatibility)

The project's repository advertises broad provider/model routing and quota-aware fallback. Those features are gateway behavior; they do not establish the reliability, privacy, licensing or free-tier availability of each upstream model. Current advertised counts and free quotas are time-sensitive and were not treated as guarantees. [OmniRoute repository](https://github.com/cheaper-inference/OmniRoute)

OmniRoute's repository license is MIT. That license covers OmniRoute software, not model weights, upstream APIs, provider terms, data retention, or usage rights. [OmniRoute LICENSE](https://github.com/cheaper-inference/OmniRoute/blob/main/LICENSE)

## POC changes and boundaries

- Added a small OpenAI-compatible Chat Completions provider client with timeout, one bounded retry by default, normalized failures, and metadata-only operational logging.
- Existing endpoint/model/key remain the default and preserve the prior Gemini-model route.
- `AI_PROVIDER=omniroute` opts recipe-instruction generation into separate `OMNIROUTE_POC_*` settings. Missing settings produce the existing static-recipe fallback.
- The pilot receives selected recipe IDs/names, validated IFCT ingredient IDs/names, quantities, units, and household measures. It receives no account identity, profile, lab report, OCR text, symptoms, or health targets.
- Existing Joi output validation and ingredient-whitelist validation still gate AI instructions. Invalid JSON, schema violations, recipe ID changes, omissions, or unlisted foods fall back to static instructions. Nutrition remains calculated by backend IFCT code.
- No automatic cross-provider failover occurs: a provider failure falls back locally. This prevents an implicit reroute that could change the recipient of data.

## Reliability and cost comparison

No real gateway, Gemini, or other provider was called, so this work cannot make an empirical claim about latency, real-world success rate, cost, token usage, model quality, or outage behavior. Mocked tests verify protocol parsing, one retry on HTTP 503, timeout normalization, missing configuration, successful usage metadata parsing, and static recipe fallback. Token usage is logged only when the upstream response supplies it. A cost field is logged only when the response includes OmniRoute's documented `X-OmniRoute-Response-Cost` header; no price is estimated from token counts. [API reference](https://github.com/cheaper-inference/OmniRoute/blob/release/v3.8.53/docs/reference/API_REFERENCE.md)

The existing Gemini-model route remains the compatibility baseline; the optional OmniRoute endpoint has no measured quality or cost advantage yet. For production comparison, run the same non-personal, fixed recipe corpus through both configured routes, record response-time percentiles, completed requests, schema validity, whitelist violations and provider-reported usage/cost, and repeat enough times to include rate limits and transient failures. Do not benchmark report interpretation or send health data.

## Security and privacy

- Keep all keys in backend environment configuration. Never place them in Vite variables or frontend payloads.
- Bind local OmniRoute to loopback and require its bearer authentication if accessible beyond the API process. Do not expose an unauthenticated gateway to the LAN or public internet. OmniRoute's documentation notes that remote mode gives connected agents access to gateway capabilities; avoid broad MCP/REST credentials for this narrow application integration. [OmniRoute API and remote-mode documentation](https://github.com/cheaper-inference/OmniRoute)
- This POC sends recipe-only data. It must not be reused for report interpretation, symptom rules or other sensitive workflows without a separately approved provider privacy and retention review.
- Provider routing can cross upstream vendors. Review each upstream's data handling, retention, training use, region, terms and model license before enabling it. A self-hosted gateway does not make upstream processing local.
- Logs contain provider name, latency, attempt count, optional token usage and optional reported cost; they do not contain prompts, ingredient lists, report contents or credentials.
- AI instructions are untrusted display content. They cannot add foods because the backend rejects food references outside the selected recipe's IFCT whitelist.

## Recommendation

**Defer production adoption; permit the local recipe-instruction POC.** The transport integration is feasible and tests are mocked. Do not alter the default provider or send health/report data. Promote only after a separately approved evaluation demonstrates reliability and confirms upstream privacy, retention, terms and economics.
