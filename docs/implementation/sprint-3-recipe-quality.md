# Sprint 3 — Recipe provenance and nutrition accuracy

## Audit result

Audited the checked-in `src/data/recipes.json` with a read-only validator against the shared IFCT loader.

| Measure | Result |
| --- | ---: |
| Recipe templates | 20 |
| Ingredient rows | 70 |
| Unique referenced IFCT codes | 15 |
| Invalid IFCT references | 0 |
| Rows with an explicit unit field | 0 / 70 |
| Rows with a raw/cooked/other preparation state | 0 / 70 |
| Rows with documented edible-portion percentage | 0 / 70 |
| Rows with quantity-source citation | 0 / 70 |
| Rows with yield-source citation | 0 / 70 |
| Recipes listing cooking oil/ghee as an ingredient | 0 / 20 |
| Recipes marked ready | 0 / 20 |
| Recipes usable with limitations | 20 / 20 |
| Recipes blocked by a detected reference/math/data error | 0 / 20 |

All current entries contain `rawQuantityGrams`, `yieldFactor`, and `cookedWeightGrams`, and the cooked-weight arithmetic passes the 0.1 g tolerance. Those fields are internally consistent, but the recipe schema currently has no source fields to establish that the quantities, edible portions, yield factors, or household measures are evidence-based. The ingredient field name implies grams, but there is no separate unit or food-state field. The recipes also omit cooking oil/ghee; therefore the reported IFCT totals exclude any added cooking fat and must not be presented as including it. The existing IFCT oil rows have unresolved energy/fat values per the prior Sprint 2 audit, so no oil amounts or nutrient values were added.

## Recipe readiness

`usable with limitations` means the IFCT references exist and raw-gram arithmetic, yield arithmetic, and macro-energy reconciliation are reproducible, but provenance is incomplete. It does not certify real-world portion accuracy or complete meal nutrition. `blocked` is reserved for invalid references, impossible quantities/servings, missing primary nutrient data, inconsistent cooked weights, or macro-derived energy deviating by more than 10%. `ready` requires complete measurement, food-state, edible-portion, quantity/yield source, and cooking-fat accounting where applicable.

| Recipe | Status | Recipe | Status |
| --- | --- | --- | --- |
| Poha | Usable with limitations | Moong Dal Chilla | Usable with limitations |
| Besan Chilla | Usable with limitations | Moong Dal Idli | Usable with limitations |
| Paneer Bhurji with Roti | Usable with limitations | Egg Bhurji with Roti | Usable with limitations |
| Roti with Moong Dal and Gobhi | Usable with limitations | Rajma Chawal | Usable with limitations |
| Moong Dal Khichdi | Usable with limitations | Chole Chawal | Usable with limitations |
| Palak Paneer with Roti | Usable with limitations | Egg Curry with Rice | Usable with limitations |
| Chicken and Rice Bowl | Usable with limitations | Masoor Dal with Rice | Usable with limitations |
| Gobhi Paneer with Roti | Usable with limitations | Spinach Moong Dal Rice | Usable with limitations |
| Besan and Gobhi Roti Wrap | Usable with limitations | Moong Dal Chaat | Usable with limitations |
| Paneer and Tomato Bowl | Usable with limitations | Boiled Egg and Tomato Bowl | Usable with limitations |

No recipe data was edited. No empirical source or approved preparation-yield reference was available to justify changing quantities, household measures, or cooking yields.

## Implementation

Added `src/services/recipeQualityAudit.js` with these read-only exports:

- `auditRecipeProvenance(recipe, foods?)`: returns `readiness`, `errors`, `warnings`, and independently recalculated nutrition.
- `auditRecipeCatalog(recipes?, foods?)`: returns recipe/ingredient counts, readiness counts, and each recipe audit.
- `calculateRecipeNutrition(recipe, foods?, scaleFactor?)`: computes whole-recipe and per-serving nutrition using `(IFCT value per 100 g × raw grams) / 100`; scale changes are linear. Missing nutrient values remain `null` if any ingredient is missing that nutrient.

The tool does not mutate or promote catalog data. Existing production planning continues to use the current recipe catalog and its backend IFCT calculations. Runtime gating should reject `blocked` results but may expose warnings for `usable_with_limitations` results until provenance review is complete. The current schema's `unknown(false)` policy means source/state/unit fields require an intentional schema version change before they can be persisted on recipes.

## Tests

`tests/recipeQualityAudit.test.js` covers raw-weight arithmetic, whole-recipe/per-serving totals, linear portion scaling, null micronutrients, invalid IFCT references, cooked-yield mismatches, absent provenance/oil warnings, macro-energy deviation over 10%, and the full catalog readiness count. Result: **6 passed, 0 failed**.

Run from `poshanai-backend`:

```powershell
node --import ./src/scripts/setTestEnvironment.js ./tests/recipeQualityAudit.test.js
```

## Remaining work / constraints

- Collect traceable source material for ingredient weights, edible portions, yields, and household conversions before recipes can be marked ready.
- Establish verified oil/ghee ingredient weights and resolve the IFCT oil-record anomaly before adding their calories/fat.
- Consider an explicit recipe data-schema version for `unit`, `state`, `ediblePortionPercent`, `quantitySource`, `yieldSource`, and source/version metadata. Do not simply make these optional defaults that appear verified.
- No new recipes or nutrient records were introduced.
