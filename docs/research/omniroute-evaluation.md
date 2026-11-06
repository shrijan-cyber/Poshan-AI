# OmniRoute evaluation for PoshanAI

**Status:** optional local recipe-instruction POC only; no deployment, live call, or production routing change. Reviewed 5 November 2026.

## Feasibility and fit

The backend already uses a server-side OpenAI-compatible `fetch` endpoint. OmniRoute documents `/v1/chat/completions`, bearer auth and provider-prefixed model IDs; model capabilities depend on the selected upstream. It is a protocol fit, but offers little architecture value beyond routing/management until PoshanAI needs multiple approved providers. [Compatibility contract](https://github.com/cheaper-inference/OmniRoute/wiki/Openai-Compatibility)

OmniRoute is MIT-licensed; that covers the gateway code, not upstream models or data handling. The project's provider/model counts, free tier, routing and cost claims are not reliability or privacy guarantees. The gateway adds another service, credential store, logging surface and possible data-routing layer. [Repository](https://github.com/cheaper-inference/OmniRoute), [license](https://github.com/cheaper-inference/OmniRoute/blob/main/LICENSE)

## Existing POC design

- `AI_PROVIDER=legacy` retains the current endpoint path; `AI_PROVIDER=omniroute` is opt-in for recipe instructions only, with separate `OMNIROUTE_POC_*` settings.
- The provider wrapper uses native `fetch`, bounded timeout/retries, normalized errors and usage/cost metadata logging when returned.
- Input is selected recipe identity, IFCT references/names, quantities and household measures. No profile, identifier, diary, report, OCR or health values are passed to the pilot.
- Existing Joi response checks, exact meal identity/coverage and ingredient allowlist validate output; on failure, static checked instructions are used. No cross-provider failover occurs.
- Backend alone selects recipes and calculates every nutrient. AI output cannot alter meals, ingredients, quantities or macros.

## Measurements and limitations

Mock tests cover successful response/usage parsing, HTTP retry, timeout, bad JSON body, missing config, server-only bearer key, legacy route compatibility, and fallback. This provides protocol-path confidence only. No live endpoint/model was called, therefore latency, provider success, token use, cost, quality, context behavior and actual fallback behavior at gateway level are unmeasured. The existing configured `gemini-2.0-flash` is shut down per current Google model documentation; the legacy path must be reconfigured by an owner before runtime availability can be claimed. [Google model status](https://ai.google.dev/gemini-api/docs/models)

## Security and operational requirements

Keep gateway/API keys backend-only. Bind local gateway to loopback and require auth. Do not enable remote mode or broad fallback. Review each upstream's privacy, retention, training, geographic processing, commercial terms and model license before adding it. Cost/usage fields can be absent and must remain unknown. Do not route report interpretation, lab results, symptoms, medical recommendations, or personal food logs through the POC.

## Decision

**Defer production adoption.** Retain only the already implemented opt-in local POC, with synthetic data. Production adoption requires a selected live model (the current default is retired), approved privacy/terms, an authenticated deployment design, and an approved benchmark. No additional gateway or runtime dependency is justified now.
