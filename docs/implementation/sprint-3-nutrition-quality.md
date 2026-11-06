# Sprint 3 — Food data quality audit

## Scope and method

`src/services/foodDataQualityAudit.js` builds a read-only report from the shared IFCT loader and source-specific staging batches. It delegates basic IFCT structure/value checks to `ifctDataValidation.js` and validates staging batches through `foodDataStaging.js`. It does not modify source files, normalize nutrient values, infer food identity, or promote records.

Classifications:

- **Validated:** all required identity, nutrient, unit, per-100g edible-basis, food-state and source evidence is verified.
- **Needs review:** suspicious energy values, duplicate identifiers/names, unsupported units, or a staging record with unresolved review fields.
- **Incomplete:** required nutrient or record-level provenance evidence is absent, while no definitive invalid value was detected.
- **Rejected:** the IFCT validator identifies an invalid/duplicate code or malformed/non-finite/negative data; staging importer rejection rows and duplicate source IDs across batches are included.
- **Potential duplicate:** candidate identity only. Exact normalized names or high token similarity are reported for human comparison; no automatic merge occurs. Open Food Facts product labels are excluded from generic composition matching.

Plausibility bounds for external nutrient values are intentionally broad screening thresholds, not clinical/nutritional corrections: energy is flagged above 900 kcal or 4000 kJ per 100g; macro/fiber gram values above 100g; micronutrient values above 10,000mg or 1,000,000µg per 100g. Negative and non-finite numbers are invalid. Unknown units and null amounts remain unresolved; no conversion or imputation occurs. IFCT's existing validator also reports large energy/macronutrient discrepancies and zero energy with positive fat.

The exported `evaluatePromotionApproval(record, approval)` is a domain gate for any future promotion workflow. It requires an explicitly eligible, fully verified record and an approval object documenting reviewer identity, timestamp, review of identity, license, nutrient units, edible-portion basis, food state, duplicate search, and explicit duplicate resolution. It does not write data or establish reviewer authorization; any future promotion endpoint must enforce reviewer authorization and invoke this gate. The existing staging CLI remains production-ineligible and has no promotion operation.

## Baseline from this checkout

Audit execution used the live IFCT file, its checked-in manifest, and `data/staging/` at run time (2026-11-02). No staging directory or batch files existed.

| Source/status | Count |
| --- | ---: |
| IFCT application records inspected | 542 |
| USDA FDC staging records | 0 |
| Open Food Facts staging records | 0 |
| Total records | 542 |
| Validated | 0 |
| Needs review | 20 |
| Incomplete | 522 |
| Rejected | 0 |
| Potential duplicate name groups | 2 |
| Duplicate IFCT codes | 0 |

The 20 records needing review include 14 oil records with zero energy and positive fat, four records in two duplicate normalized-name groups, and energy/macro mismatches for `E033`, `N001`, and `Q001` (with `Q001` overlapping the duplicate-name review). The groups are `cat fish` (`P009`, `S001`) and `crab` (`Q001`, `S007`). They remain separate records pending source-level review.

### Nutrient and provenance findings

- Vitamin B12 is `null` in all 542 records; fiber is `null` in all 542 records: **1,084 missing nutrient values** total. Neither is replaced with zero or estimated.
- Seven nutrient fields have unverified source unit mappings in the manifest (calories, protein, carbohydrate, fat, iron, calcium, vitamin D). B12 and fiber are marked unavailable in the application subset.
- Record-level raw/cooked state and a source-row locator are absent for all 542 records. The manifest states a general IFCT basis but specifically cautions that record-level state/source mapping is unavailable.
- The application subset has 542 records versus the manifest's official reported count of 528. The source CSV is unavailable and the source-column mapping is unverified, so the 14-record difference cannot be reconciled here.
- IFCT codes are unique in the current file. No external staging IDs exist to compare across batches.
- The source manifest says IFCT electronic storage/product redistribution permission is unconfirmed. Obtain written permission before production redistribution.
- The current IFCT validator reports three `ENERGY_MACRO_MISMATCH` codes (`E033`, `N001`, `Q001`). Such comparisons are warning-only because source unit mapping remains unverified.

## Use

```js
import { runFoodDataQualityAudit } from './src/services/foodDataQualityAudit.js';

const report = runFoodDataQualityAudit();
```

Tests can call `buildFoodDataQualityReport({ ifctFoods, manifest, stagingBatches })` with fixtures. Each report includes a per-record status and reasons, per-source summaries, validation warnings, staging rejections, and an explicit `automaticPromotion: false` boundary.

## Tests

`tests/foodDataQualityAudit.test.js` covers null preservation, missing unit/state/provenance, duplicate names without merging, suspicious energy, invalid numeric values, staging rejection/duplicate IDs, no automatic promotion, and the explicit approval gate. Result: **6 passed, 0 failed**. The report reads production source data read-only; tests use fixtures.

## Limitations / required follow-up

- “Validated” is a provenance-completeness label from this validator, not a claim of scientific correctness; a human must verify against authorized source rows.
- No human approval UI, reviewer identity provider, audit trail store, or production promotion endpoint exists. The gate is a reusable validation function, not a complete governance workflow.
- Similar names can refer to different species, varieties, or preparations; potential matches must never be merged on name alone.
- No source values, IFCT data, staging records, or recipes were modified by this audit.
