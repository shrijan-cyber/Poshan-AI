# Food Library nutrient profiles

## Implemented in this sprint

The existing `GET /api/foods/search` response keeps its old array shape and the existing flattened and nested macro fields. It now adds five existing IFCT fields (`iron`, `calcium`, `vitaminD`, `vitaminB12`, `fiber`) and `nutrientMetadata` describing catalog unit/missing status. Search/detail behavior is additive; food logging still calculates only its existing backend macros. No nutrition values or database records were changed.

Food Library now shows these additional fields per 100g. Null/missing values display as “Unavailable”; when a non-null value's unit mapping is unverified, the UI identifies that. It explains the subset's unresolved mapping and state limitations. It does not scale micros to a serving or claim unrecorded raw/cooked states.

## Current supported coverage and limits

The catalog contains nine fields: energy, protein, carbohydrate, total fat, iron, calcium, vitamin D, B12 and fiber. In the current dataset B12 and fiber are null for all 542 rows. Seven unit mappings are unverified; record-level source mapping and preparation state are missing. No saturated/unsaturated fat, sugars, cholesterol, vitamins A/C/E/K or full B-complex/mineral profile is present. These should remain unavailable until licensed, mapped source records are verified.

Serving units are used by existing logging only where present in the IFCT-enriched record. They are not generalized to a household serving conversion. Raw/cooked conversion is withheld unless a verified state/yield exists.

## Deferred

Do not add nutrient comparison across incompatible bases. Once source permissions and unit maps are complete, extend the projection with nutrient availability status and verified unit, then add per-serving display only through backend calculation from a verified gram basis. Avoid frontend nutrition math.
