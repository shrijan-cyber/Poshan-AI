# AI provider POC: implementation and operating boundary

## Current implementation

`src/services/aiProviders/chatCompletionProvider.js` is a small OpenAI-compatible Chat Completions adapter using native `fetch`. `aiService.js` selects the existing route by default and allows `AI_PROVIDER=omniroute` to use isolated POC settings for recipe instructions. The POC accepts configurable URL, model and backend-only key, a bounded timeout, and 0–2 retries. It normalizes transport/timeout/HTTP failures and reads usage plus OmniRoute reported cost only when supplied.

The adapter is deliberately used only for recipe instructions. The deterministic composer chooses recipes and calculates nutrition; prompt input is limited to selected recipe/ingredient data. Joi shape validation, meal identity and ingredient allowlisting reject unsafe output. Static instructions are the fallback. There is no automatic provider-to-provider reroute.

## Configuration contract

Default: `AI_PROVIDER=legacy`; existing `OMNIROUTE_URL`, `OMNIROUTE_MODEL`, `OMNIROUTE_API_KEY` remain server-side. POC opt-in: `AI_PROVIDER=omniroute` plus `OMNIROUTE_POC_URL`, `OMNIROUTE_POC_MODEL`, and optional `OMNIROUTE_POC_API_KEY`; timeout/retry use `AI_REQUEST_TIMEOUT_MS` and `AI_REQUEST_MAX_RETRIES`. Use a loopback authenticated gateway for local synthetic testing. Never define these secrets as `VITE_*`.

## Test coverage and explicit gaps

`tests/aiProvider.test.js` mocks provider responses and covers success/usage, transient HTTP retry, timeout, invalid response JSON, missing config, separate POC endpoint/model/key, legacy endpoint compatibility and static fallback. `dietService.test.js` covers ingredient rejection/fallback. No live provider request, response quality benchmark, actual upstream timeout, gateway health check, prompt-injection robustness campaign or measured cost/latency was run. Existing route's default model (`gemini-2.0-flash`) is shut down according to current Google docs; this audit does not change model routing. Select a live approved model in a separate change before runtime use.

## Extension rule

Add no more than one additional provider until an explicit benchmark and privacy review justifies it. Provider adapter must not accept user health data, profile, OCR/report text or unvalidated recipe entries. Keep model-specific structured output capabilities behind the existing Joi validator. Nutrition, food selection, portion sizes, cooked yields and grocery aggregation remain backend deterministic.
