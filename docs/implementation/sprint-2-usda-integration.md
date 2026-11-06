# Sprint 2 — USDA FoodData Central client

## Status

Implemented as a reusable, read-only backend client. It does not import records into the production IFCT catalog and is not called by diet generation.

## Architecture

`src/services/foodDataCentralClient.js` sends server-side GET requests to the official FDC Search and Food Details endpoints. `FDC_API_KEY` is optional in local configuration; absent configuration produces `FDC_NOT_CONFIGURED` and does not make a request. The API key is sent only to USDA as its required `api_key` query parameter. It is not included in returned payload metadata or error messages.

The client returns the provider JSON unchanged in `data`. It returns transport provenance separately (`source`, license, endpoint, retrieval timestamp, rate-limit headers, ETag and Last-Modified). FDC data type, nutrient identifiers, original values/units, publication dates, and other record metadata remain in the original `data` response.

Rate limits are surfaced from `X-RateLimit-Limit` and `X-RateLimit-Remaining`. A 429 is returned immediately as `FDC_RATE_LIMITED` with parsed `Retry-After` milliseconds; the client does not retry automatically. Requests time out after 10 seconds by default. Errors are mapped to stable HTTP-style error codes.

## Configuration

Set `FDC_API_KEY` in the backend runtime environment. It is blank in the checked-in examples. Do not set it in any `VITE_*` variable or expose it to the browser. No key is required until the server-side client is used.

## Data-use conditions and limits

USDA states FDC data are public-domain/CC0 1.0 and asks users to identify FoodData Central as the source. The standard API limit is 1,000 requests/hour/IP; exceeding that can temporarily block the API key for one hour. The client exposes rate-limit metadata and respects provider `Retry-After` without speculative retry. FDC Foundation, SR Legacy, Survey (FNDDS), and Branded records have differing coverage/methods; an FDC name match is not evidence of equivalence to an IFCT food. Keep FDC staging/source records separate and do not use them for authoritative PoshanAI recipe math without an explicit identity and provenance review.

Source: [USDA FoodData Central API Guide](https://fdc.nal.usda.gov/api-guide/)

## Tests

Focused tests mock `fetch` and cover search/detail requests, raw-data preservation, server-key placement, missing-key behavior, argument validation, timeouts, network/JSON/shape failures, rate-limit headers, and `Retry-After`. No external API requests are made by tests.

## Remaining limitations

- There is no production route or frontend integration by design.
- No automatic source dataset/version mapping is inferred when the provider omits it; original response metadata is preserved for staging/review.
- FDC rate-limit headers may be absent; `null` means the provider supplied no value.
