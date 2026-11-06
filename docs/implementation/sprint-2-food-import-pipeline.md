# Sprint 2 — staging-first food import pipeline

**Status:** Implemented as a local staging pipeline only. No production food catalog, IFCT file, or database was changed.

## Architecture

`src/services/foodDataStaging.js` validates and normalizes source payloads into immutable-by-convention batch documents. `src/scripts/stageFoodData.js` reads a previously downloaded JSON payload, validates the complete staging batch, and writes it under `data/staging/`. The script refuses to replace a different existing output file. Re-running the same source content produces the same batch ID and is treated as already staged.

Supported source formats:

- FoodData Central detail objects, `/foods/search` response objects (`foods`), arrays, and downloaded `FoundationFoods`, `SRLegacyFoods`, `SurveyFoods`, or `BrandedFoods` collections.
- Open Food Facts product arrays or `{ products: [...] }` responses. These remain packaged label records in the OFF namespace and are not converted to generic food-composition entries.

The FDC staging entry point accepts either the raw provider JSON or the client wrapper `{ data, sourceMetadata }`; wrapper provenance is sanitized to remove credential-like fields before persistence. Existing exported `stageFdcFoods()` and `stageOpenFoodFactsProducts()` helpers still return record arrays. The richer `prepareFdcImport()` and `prepareOpenFoodFactsImport()` methods return the complete versioned batch and rejection report.

Each accepted record carries a stable source ID, source-specific license and URL, source data type/version where supplied, source metadata, deterministic content hash, batch ID, and import timestamp. FDC nutrient IDs/names/units and values are retained without unit conversion; zero remains zero and unknown remains `null`. Nutrient basis and raw/cooked state are explicit, initially unverified values. OFF label nutrients remain under `labelNutrition` with the original per-100g/per-serving key names.

## Review and promotion boundary

Every batch sets `productionImport: false`, `reviewStatus: staging_review_required`, and each row has `eligibleForProduction: false`. The importer creates no promotion operation. Human review must establish source identity, nutrient basis and units, edible-portion basis, food state, license suitability, and eligibility before a separate future promotion mechanism can be designed. There is no name-based catalog matching, nutrient averaging, fabricated nutrient, or production import.

Invalid records are omitted from `records` and collected in `rejectedRecords` with input index, source ID if available, content hash, and a concrete validation reason. Duplicate source IDs within the same payload are rejected. Missing FDC values are preserved as null rather than dropped or replaced.

## CLI

Run from `poshanai-backend` with a downloaded source payload and a new output file name:

```powershell
node src/scripts/stageFoodData.js fdc .\downloads\fdc-response.json fdc-review.json
node src/scripts/stageFoodData.js off .\downloads\off-products.json off-review.json
```

The output is saved to `data/staging/<filename>`. The report prints accepted/rejected counts, batch ID and output path. Repeating identical source content with the same filename reports “Already staged”; different content at that path is refused. The CLI makes no network calls and requires no API credentials.

## Validation and tests

Changed files: `src/services/foodDataStaging.js`, `src/scripts/stageFoodData.js`, `tests/foodDataStaging.test.js`, and this document. There are no frontend/API route changes and no new environment variables; this pipeline reads local source downloads and does not call external APIs.

`tests/foodDataStaging.test.js` covers FDC search/detail/download shapes, stable IDs, source metadata redaction, unit and nutrient ID preservation, null versus zero, unknown raw/cooked state, malformed and duplicate record reports, stable batch identity across timestamps/order, OFF separation, batch safety validation, and idempotent/no-overwrite writing. Result: **7 tests passed, 0 failed**. Run with:

```powershell
node --import ./src/scripts/setTestEnvironment.js tests/foodDataStaging.test.js
```

## Limitations

- Staging is JSON-file based; no import manifest database, approval UI, cross-batch catalog deduplication store, or promotion tool exists.
- Per-100g edible-portion basis is a required review target, not asserted as verified by the importer. Source-specific basis must be checked before any nutrient is usable by nutrition calculations.
- Raw/cooked/fresh/dried/processed state is left unverified unless reviewed separately. FDC record descriptions alone are not treated as proof of preparation state.
- Source versions are recorded from available FDC fields or wrapper metadata; absent versions are labeled `not-reported`.
- OFF carries ODbL obligations; keep it separate and review data reuse/redistribution terms before serving or combining data. See [Open Food Facts reuse conditions](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api).
- FoodData Central is CC0/public-domain data with attribution requested; do not infer an IFCT match by name. See the [USDA API guide](https://fdc.nal.usda.gov/api-guide/).
