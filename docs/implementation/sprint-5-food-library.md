# Sprint 5 — Food Library API

## Status

Implemented against the existing static 542-record IFCT application catalog. The catalog is not Mongo-backed, so no database indexes or migration were needed. Search remains read-only and uses the existing `/api/foods` and `/api/foods/search` routes.

## API behavior

`GET /api/foods/search?q=rice&page=1&limit=6&category=Cereals%20and%20Millets` supports:

- Word-prefix text search with deterministic score, name-length, name, and IFCT-code ordering.
- Server-side category filtering.
- Server-side source filtering when a record has source/provenance metadata. Current records inherit only the dataset-level IFCT 2017 provenance from the checked-in manifest; the response explicitly marks record-level mapping unavailable.
- A `state` filter (`raw`, `cooked`, or `processed`) when record-level preparation-state metadata exists. The current catalog has no such field, so these filters return no results rather than infer state from food category.
- Bounded pagination (`page` 1–1000, `limit` 1–50) and additive top-level `pagination` and `filters.categories` metadata.

The existing `data` property remains an array, preserving existing API consumers. Nutrients remain as stored; unknown nutrient values stay `null`. Search continues to exclude records with unavailable calorie data as before. No packaged-food records, dietary labels, prices, or raw/cooked states were invented. Source reference URLs are exposed only from the checked-in dataset manifest.

The frontend Food Library now sends page/category parameters, uses the server pagination metadata, and displays source/state only when the API provides it. Existing clients that send only `q`/`limit` continue to receive the same `data` array shape.

## Validation

- Backend focused test: `node --import ./src/scripts/setTestEnvironment.js --test --experimental-test-module-mocks tests/foodLog.test.js` — 15 passed, 0 failed.
- Backend changed-file ESLint — passed.
- Frontend Food Library/API ESLint — passed.

## Remaining catalog limits

The IFCT manifest says record-level source matching and record-level raw/cooked state are unavailable. The API reports these limitations rather than fabricating per-record provenance or preparation state. License/reuse restrictions in the manifest remain unresolved and are not changed by this work.
