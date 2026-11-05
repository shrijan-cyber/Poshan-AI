# Indian food composition data comparison

Snapshot date: 2026-11-05. Counts and coverage below distinguish repository claims from the current PoshanAI checkout. No external data is promoted.

| Dataset | Count / coverage | States and nutrients | IDs, provenance and quality | License posture |
|---|---|---|---|---|
| PoshanAI IFCT application subset | 542 current records; IFCT manifest says 528 official foods (difference of 14 unresolved) | Application fields: energy, protein, carbs, fat, iron, calcium, vitamin D, B12 and fiber. B12/fiber are null in all 542. Raw is the general IFCT basis except poultry/egg; per-record state is absent. | Unique IFCT codes; two normalized duplicate-name candidate groups; no source-row locator; seven unit mappings unverified; 14 oil records have zero energy with positive fat. | Manifest says electronic product redistribution permission unconfirmed; source CSV absent. |
| INDB | README reports 897 NIN raw foods, 144 COFID foods, 54 USDA foods and 1,016 recipes; repository-derived counts, not independently rebuilt here. | Broad nutrient and standard recipe/retention coverage; nutrient basis per 100g except alcohol per 100ml per README. | Multi-source composition requires source-level row mapping and license per subset; values cannot be merged by name. | No dataset license found in reviewed repository; no import. |
| Indian Nutrition Data | Repository claims 620 foods: 528 IFCT 2017 + 92 Gopalan 2004. | energy/protein/fat/carbs/fiber/calcium/iron/vitamin C per schema; source and state details vary by row and need validation. | Repo says a source label; row-level source locator/unit mapping not established by reviewed schema. | CC0 declared by repo, upstream data rights unresolved. |
| USDA FoodData Central | Dynamic API/datasets; no single fixed count quoted here. | Foundation, SR Legacy, FNDDS and branded data have distinct scope, states and nutrient coverage. | Source food IDs and nutrient IDs/units available; preserve dataset type and release/version. | Public domain/CC0 for FDC data; stage and audit exact source fields. |
| Open Food Facts | Dynamic packaged product catalog; count omitted because it changes. | Branded label declarations, serving units, ingredients/allergens and images; not an analytical generic composition table. | Barcode/product ID; labels may have absent, rounded or user-contributed data. | ODbL/DbCL plus separate image terms; keep isolated. |
| OpenNosh community packs | README snapshot claims 168 entries across six CC0 packs. | Community food entries; not equivalent to IFCT analytical coverage. | Source-qualified keys and per-row provenance/licenses are strong design examples. | CC0 applies only to its qualifying contributed pack, not other stores. |

## Measured local audit

The read-only audit used the current IFCT JSON, checked-in manifest and staging directory. It inspected 542 foods: **0 validated, 20 needing review, 522 incomplete, 0 structurally rejected**; 2 duplicate-name candidate groups; 7 unit mappings unverified; 1,084 null values across B12 and fiber; zero staging records. It does not prove scientific correctness. Existing tests report checks over fixtures and source without modifying it.

Current recipe audit: 20 templates / 70 ingredient records, zero invalid IFCT references, zero recipes meeting the full provenance-ready status. Current recipe quantities lack explicit verified unit/state/edible-portion/quantity-source/cooking-yield provenance. Oil/ghee is absent from the recipe templates; that is a limitation, not permission to invent quantities.

## Normalized record proposal

Keep immutable source records and derive a separate searchable projection:

```json
{
  "foodId": "source-qualified-id",
  "canonicalName": "source name as reported",
  "regionalNames": [],
  "category": null,
  "source": { "organization": "", "dataset": "", "version": "", "recordId": "", "recordUrl": null, "license": "", "attribution": null, "checksum": "" },
  "foodState": { "value": null, "status": "unknown" },
  "ediblePortion": { "basis": null, "status": "unknown" },
  "nutrientBasis": { "amount": null, "unit": null, "basis": "per_100g_edible_portion", "status": "unverified" },
  "nutrients": { "protein": { "value": null, "unit": null, "status": "missing" } },
  "image": { "url": null, "creator": null, "license": null, "attribution": null },
  "verification": { "status": "pending_review", "reviewedBy": null, "reviewedAt": null }
}
```

Unknown remains `null` with an explicit status. Never merge on names, average conflicts, or mutate source facts. The proposal is documentation only; no schema migration is included.
