# Sprint 2: Recipe Engine

## Scope and outcome

The existing deterministic recipe engine was retained. The checked-in catalog has 20 templates and `recipeCatalog.js` explicitly limits the validated catalog to 15–20 entries. No additional templates were added: the current files do not provide provenance for ingredient gram weights, edible portions, cooking yields, or household measures, so adding recipes would turn those assumptions into unsupported nutrition inputs.

The selector now gives `typicalDiet` and `preferredFoods` matches priority among recipes within 10% of the best available safe calorie capacity, provided they can cover at least 90% of an equal share of the daily target. This preserves calorie capacity while letting familiar foods steer the choice. If no recipe meets both thresholds, it falls back to the full eligible set and ranks by capacity. Existing diet compatibility, whitelist, allergy/dislike, region, portion-limit, and backend IFCT calculation behavior remain in place.

## Data validation and limitations

- `recipeCatalog.js` validates each template against `recipeSchema.js`, rejects duplicate recipe IDs and unknown/non-household IFCT codes, checks the supplied cooked weight against `rawQuantityGrams × yieldFactor`, and checks IFCT calories/macros for ±10% energy reconciliation.
- These checks establish referential and arithmetic consistency; they do not establish that a yield factor, cooked weight, household measure, or recipe quantity is empirically sourced. Those fields currently have no per-ingredient provenance metadata.
- Recipe cooking instructions mention ordinary cooking practices, but the templates do not list cooking oil. The IFCT oil records currently have zero energy with positive fat and are rejected by the catalog's unresolved-data guard, so oil has not been added to recipes or nutrition totals.
- IFCT-missing foods such as dahi/curd are not substituted with invented nutrition values. Any future substitution must be explicit and must use a verified catalog record.
- The requested expansion to roughly 25 more recipes is blocked by the 20-template catalog maximum and, more importantly, by the absence of verified recipe/yield source data. Add templates only after their raw weights, yield assumptions, serving basis, and source are recorded.

## Validation

`tests/dietService.test.js` covers diet filtering, restrictions, raw-weight IFCT arithmetic, null nutrients, portion safety, multi-day diversity, grocery aggregation, and AI instruction fallback. A regression case verifies a familiar Rajma-and-rice diet steers lunch selection to the matching validated recipe while the final plan remains within its calorie tolerance.
