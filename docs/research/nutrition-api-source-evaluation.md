# PoshanAI nutrition API source evaluation

**Reviewed:** 2026-11-02
**Scope:** Non-destructive source evaluation. No API call, external-data import, dataset edit, or integration was performed.

## Executive decision

Keep ICMR-NIN IFCT 2017 as the existing Indian generic-food reference while resolving its source-file provenance and digital reuse permission. FoodData Central (FDC) is the strongest reviewed supplemental data source for isolated comparison or staging, but it is US-centric and must not be substituted into Indian recipes by fuzzy name match. Open Food Facts (OFF) is the strongest product/barcode candidate, not a generic food-composition source; preserve it in a separate ODbL namespace. Neither source should silently provide missing IFCT nutrients or enter production nutrition calculations without a reviewed source-specific identity, basis, and license decision.

The `public-apis/public-apis` project is an index of APIs. Its MIT license applies to the index repository, not the services it lists. A listing does not certify data accuracy, ongoing service availability, commercial permission, or API terms. The full current source baseline is recorded in [nutrition-data-source-evaluation.md](nutrition-data-source-evaluation.md).

## Ranked shortlist

| Rank | Source | Coverage and data character | Auth, rate and freshness | License / commercial use | Fit and recommendation |
|---:|---|---|---|---|---|
| 1 | **ICMR-NIN IFCT 2017** — [publication](https://www.nin.res.in/ebooks/IFCT2017_16122024.pdf), [Food Composition research division](https://www.nin.res.in/researchdivision/foodcomposition.html) | Indian food-composition reference, with food-state and nutrient details defined by the publication. It is the most context-relevant source reviewed for generic Indian ingredients. Repository application contains 542 records; local audit notes source publication count and app count do not reconcile yet. | No official public API identified in the reviewed material. Updates are publication/release based, not a live API feed. | Current repository evidence does not establish digital redistribution rights for its imported file. Confirm terms with ICMR-NIN before adding or redistributing data. | **P0: retain current source, do not rewrite/import.** Reconcile row IDs, units, record state, missing values and rights using authorized source rows first. |
| 2 | **USDA FoodData Central** — [API guide](https://fdc.nal.usda.gov/api-guide/), [data-type documentation](https://fdc.nal.usda.gov/data-documentation/), [downloads](https://fdc.nal.usda.gov/download-datasets/) | Foundation Foods, SR Legacy, FNDDS survey foods and Global Branded Foods are different data types. Foundation includes analytical source information; branded data are manufacturer/supplier-reported and can change. Mostly US foods; no reliable assurance of Indian household coverage. | `data.gov` key required in each API request; default 1,000 requests/hour/IP (DEMO_KEY has lower published limits). API returns current records; Branded API is updated monthly. | FDC data are public domain/CC0 1.0; USDA requests attribution. | **P1: isolated supplemental staging/comparison only.** Preserve `fdcId`, `dataType`, nutrient IDs/names/units/amounts and retrieval/version metadata. Never infer an IFCT identity from name similarity. |
| 3 | **Open Food Facts** — [API documentation](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/), [reuse conditions](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api), [API overview](https://openfoodfacts.github.io/documentation/docs/) | Global packaged products, barcode, brand, ingredients, label nutrition, allergens/traces and related product attributes. Coverage is community contributed and uneven; nutrient values are typically label declarations, not generic analytical composition. | Read API requires a custom identifying User-Agent, no auth; writes need auth. Docs publish 15 product reads/min/IP and 10 searches/min/IP; bulk use should rely on exports/local hosting and be separately planned. API docs are active/current at review; no SLA identified. | Product database is ODbL with attribution and share-alike. OFF states that combining its data with other databases can require releasing the resulting database as open data. Images have distinct licensing. Commercial use is not automatically prohibited, but ODbL obligations remain. | **P1: future barcode lookup only, after license review.** Keep branded records and labels separate from IFCT generic foods. Show data source and user-facing incompleteness clearly. |

### Additional indexed candidates reviewed

| API | Coverage and terms | Priority and decision |
|---|---|---|
| [Food Info](https://food-info.org/developer) | Aggregates several national food-composition datasets and OFF, but no IFCT dataset was listed. API key; provider publishes a limited free tier and paid higher quota. Provider advertises OGL v3.0; component-level source rights, current SLA and data freshness need confirmation. | **P2** comparison-only experiment if source-by-source provenance can be preserved. Not a production Indian composition source. |
| [Edamam Nutrition Analysis](https://developer.edamam.com/edamam-nutrition-api) | Paid NLP nutrition analysis with app credentials and quotas; commercial terms include restrictions on reuse/caching and automated/background calls. Broad international food recognition, not IFCT-traceable by default. | **P2 / defer.** Poor fit for authoritative meal-plan math or batch catalog ingestion. A user-initiated log analysis would need privacy and contract review. |
| [API Ninjas Nutrition](https://api-ninjas.com/api/nutrition) and [branded nutrition](https://api-ninjas.com/api/nutritionbranded) | Keyed API for natural-language nutrition and branded food lookup. Free evaluation access is non-commercial/restricted; current paid quotas and storage/caching restrictions depend on plan. Provider output is not source-level IFCT. | **P2 / reject as nutrition authority.** Do not persist results or transmit personal reports; re-check current pricing/terms for any narrow feature. |
| [TheMealDB](https://www.themealdb.com/docs_api_guide.php) / [Spoonacular](https://spoonacular.com/food-api) | Recipe/search APIs with API/test keys and varying paid/commercial access. Recipe coverage and rights are provider-specific; neither offers verified IFCT identity/basis as its core guarantee. Current quota/pricing for Spoonacular and commercial key details for TheMealDB must be verified with provider before use. | **P2 / defer.** PoshanAI already has a local deterministic recipe catalog; neither should generate authoritative ingredient macros. |

The public index includes additional services and may change. This shortlist limits detailed review to sources with potential nutrition, barcode, or recipe relevance. The index entry itself is not evidence of API reliability. [Public APIs index](https://github.com/public-apis/public-apis) · [repository license](https://github.com/public-apis/public-apis/blob/master/LICENSE).

## Existing integration surface and proposed adapter contract

Current source already has `src/services/foodDataStaging.js` and `src/scripts/stageFoodData.js`. These accept downloaded source JSON, preserve source-specific identifiers and values, and write records with `eligibleForProduction: false`; the staging script refuses to overwrite an existing output. This is a safe non-runtime boundary for evaluating FDC and OFF.

If a live adapter is later approved, it should be a separate read-only module behind a provider-neutral interface, for example:

```js
lookup({ queryOrBarcode, signal }) => {
  source: 'fdc' | 'openfoodfacts',
  sourceRecordId,
  retrievedAt,
  sourceVersionOrRevision,
  license,
  productOrFoodType,
  nutrients: [{ nutrientId, name, amount, unit, basis, derivation }],
  rawPayloadReference
}
```

Contract requirements:

- Make no adapter call from deterministic IFCT recipe/macro calculations.
- Keep `sourceRecordId`, data type, retrieval timestamp, license, original nutrient units and basis intact; never use a display-name match as identity proof.
- Keep missing values `null`; distinguish analytical, label-reported, calculated, and provider-derived values when metadata supports it. Do not fabricate unavailable provenance.
- Keep OFF product records and media outside the IFCT/FDC generic-food namespace. Assess ODbL database combination risks before any persistence or display cache.
- Use request timeout, bounded retry only for transient errors, `Retry-After`/rate headers when available, and per-source circuit-breaker/backoff behavior. Do not retry client errors or fan out search-on-type requests.
- Keep keys server-side; minimize requests and never send report content, symptoms, or user profile data to a food lookup provider.
- User-facing results should say which source supplied a record and whether it is a generic composition value or package label. Never represent a package allergen declaration as a safety guarantee.

## Recommended implementation sequence

1. **P0 — IFCT provenance and permissions:** Obtain authorized source rows and written digital reuse clarification; reconcile application and publication counts, IDs, unit basis, food state, missing nutrients and any duplicate names. No API integration can correct unresolved source mapping safely.
2. **P1 — FDC staging validation:** Extend only the existing staging review/tests if a real comparison question is identified. Keep current source-specific staging, no production import, preserve nutrient IDs/units/nulls and food-type metadata.
3. **P1 — OFF barcode feasibility:** Complete ODbL/commercial review and a separate branded-product data model/cache design before a read-only barcode prototype. Confirm product coverage in PoshanAI’s target markets, request quota, missing-label behavior and deletion/update policy.
4. **P2 — Other APIs only for evidenced gaps:** Re-check first-party pricing, quotas, licensing, SLA, data source and privacy terms just before approval. Do not purchase or depend on a public index’s “free” label.

## Review limitations

- Vendor quotas/pricing and API contracts change. Details above were reviewed on 2026-11-02 and must be confirmed immediately before implementation.
- ICMR-NIN’s IFCT publication was linked from the official site, but the PDF was too large for this browsing tool to retrieve. This report does not claim an independent page-by-page IFCT source-data re-audit.
- No production API call or account-level contract review was performed. Where vendor terms were not independently established, they are marked for confirmation.
- This document does not authorize any API call, dataset reuse, data redistribution, or production import.

## Official references

- [ICMR-NIN IFCT 2017 publication](https://www.nin.res.in/ebooks/IFCT2017_16122024.pdf)
- [ICMR-NIN Food Composition research division](https://www.nin.res.in/researchdivision/foodcomposition.html)
- [USDA FoodData Central API guide](https://fdc.nal.usda.gov/api-guide/)
- [USDA FDC data types](https://fdc.nal.usda.gov/data-documentation/)
- [Open Food Facts API docs](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/)
- [Open Food Facts data reuse conditions](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api)
- [Public APIs index](https://github.com/public-apis/public-apis)
- [Food Info API docs](https://food-info.org/developer)
- [Edamam Nutrition API](https://developer.edamam.com/edamam-nutrition-api)
- [API Ninjas Nutrition API](https://api-ninjas.com/api/nutrition)
