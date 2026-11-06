# PoshanAI nutrition data source and staging audit

Audited 2026-11-02 against the checked-in application data and the linked source material. This is a data-quality baseline, not clinical guidance.

## Repository baseline

| Measure | Observed |
| --- | ---: |
| IFCT application records | 542 |
| Unique IFCT codes | 542 |
| Exact normalized duplicate-name groups | 2: cat fish (`P009`, `S001`), crab (`Q001`, `S007`) |
| Recipe templates | 20 |
| Recipe ingredient references | 70 |
| Invalid recipe IFCT references | 0 |
| Records missing B12 | 542 |
| Records missing fiber | 542 |

The checked-in manifest reports 528 foods in the IFCT publication, while the application subset contains 542 records. The source CSV is unavailable; source column mapping and record-level source locators are unverified; electronic reuse permission is not confirmed. Nutrients are expressed by the app as per 100 g edible portion, but source units and mappings remain unverified in the manifest. Raw/cooked state is not available per record. Do not infer these missing facts from names or category.

The recipe catalog validates IFCT codes, required macros and raw/cooked yield arithmetic at load time. Its templates carry no source provenance for household measures or yield factors, so those values cannot be independently validated as measured. Current loader logic also rejects non-finite/null energy and macros for recipe ingredients, which means missing macro values cannot silently become zero for selected recipes. This does not establish that source mappings or values are correct.

## Source comparison and reuse constraints

| Source | Version/coverage | Method and practical fit | Reuse and PoshanAI decision |
| --- | --- | --- | --- |
| ICMR-NIN IFCT | 2017; Indian raw-food composition, with poultry and egg exceptions described by the publication | Analytical food composition, generally raw edible portions; verify individual record state and units against authorized source rows | Existing source CSV, record mapping and digital redistribution permission are unresolved in this repository. Keep current data unchanged and seek authorization before redistributing or rebuilding. [IFCT 2017](https://www.nin.res.in/ebooks/IFCT2017_16122024.pdf) |
| USDA FoodData Central | Foundation Foods, SR Legacy, FNDDS and Branded Foods are distinct data types/releases | Food type, sampling, preparation and portion data vary; treat data type and source ID as mandatory. Missing values remain missing. Do not equate a FDC record with an Indian household ingredient solely by name. | FDC data are released under CC0 1.0, with attribution requested. New `stageFoodData.js fdc ...` workflow writes isolated staging records and preserves nutrient IDs/units; no runtime import. [FDC downloads](https://fdc.nal.usda.gov/download-datasets/), [FDC API guide](https://fdc.nal.usda.gov/api-guide/) |
| Open Food Facts | Continuously contributed packaged-product/barcode database | Label declarations and branded formulation; not equivalent to analytical generic food composition. Values can be absent or label-reported. | ODbL obligations apply. Keep a separate ODbL staging namespace; do not merge with IFCT/FDC or treat package labels as generic ingredient values without a licensing and provenance decision. [OFF data reuse conditions](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api) |
| Anuvaad INDB | Published methodology describes 528 IFCT 2017 and 369 IFCT 2004 items plus UK/US tables and 1,014 recipes | Recipe values are calculated from ingredient composition; this does not independently validate ingredient identity, yield, or the source tables | Reviewed methodology does not establish a redistribution license for records/recipes. Do not copy it into the catalog. [INDB methodology](https://www.anuvaad.org.in/methodology/) |
| ICMR-NIN Dietary Guidelines | 2024 | Public health guidance; not a food-composition dataset and not a clinical test-rule approval source | Use as nutrition-guideline context only, not as a substitute for nutrient data or qualified clinical review. [DGI 2024](https://www.nin.res.in/dietaryguidelines/pdfjs/locale/DGI24thJune2024fin.pdf) |

## Staging workflow implemented

`poshanai-backend/src/scripts/stageFoodData.js` accepts a previously downloaded FDC or Open Food Facts JSON file and writes an source-specific JSON file under `poshanai-backend/data/staging/`. The command refuses to overwrite an existing staging file. FDC staging retains selected source nutrient IDs, original amounts and units (including `null`); OFF staging retains package/barcode, label nutrition, ingredient and allergen fields separately. Both mark records ineligible for production pending review. This is a local staging/import step, not an automated web downloader; credentials and external API access are intentionally not required.

Examples:

```powershell
cd poshanai-backend
node src/scripts/stageFoodData.js fdc .\downloads\fdc-foods.json fdc-foundation-2026.json
node src/scripts/stageFoodData.js off .\downloads\off-products.json off-products-2026.json
```

Before production promotion, require identity matching, explicit per-nutrient units/basis, food state, edible portion, source locator, license approval, null-preserving checks, and a reviewed change set. Promotion must not overwrite IFCT records by matching display names.

## Current nutrition calculation risks

- **Source correctness unresolved:** the manifest flags an unavailable authorized CSV and unverified source-column/unit mapping; existing application numbers cannot be independently recalculated to source rows here.
- **Record-count discrepancy:** 542 app records versus 528 published IFCT foods remains unexplained.
- **Duplicate display names:** cat fish and crab map to multiple IFCT codes and should not be deduplicated without source review.
- **Missing values:** B12 and fiber are absent for every current record; the recipe API must keep them unavailable, never infer a numeric value.
- **Energy anomalies:** the manifest flags 14 oil records with zero energy and positive fat. The recipe catalog rejects these for recipe use; source reconciliation remains necessary.
- **State and yields:** IFCT state is only general, not record-specific. Recipe yield factors and household measures have no traceable per-recipe source.
- **Clinical rules:** the lifestyle recommendation catalog is gated pending qualified clinician review; food-composition sources and DGI guidance do not approve medical testing rules.

## Next implementation sequence

1. Obtain authorized IFCT source rows and written reuse permission; reconcile 542/528, code/name duplicates, energy units and record states.
2. Add a versioned normalized observation model that stores source record, source version, nutrient code, value, unit, basis, data status, state and license separately from canonical household food identity.
3. Run source-specific audit reports on staging data; require explicit reviewed identity mappings and conflict handling before production promotion.
4. Add recipe provenance fields for each ingredient quantity, serving measure and yield, with validation refusing untraceable values for authoritative nutrition output.
5. Build regression fixtures from verified source rows, including unit conversions, nulls, raw/cooked basis, scale invariance and source updates.
6. Have a qualified clinician review and version the test recommendation rules before activating any rule.
