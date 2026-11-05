# Indian food data integration plan

## Current behavior and safe boundary

`ifctLoader.js` loads the one IFCT application JSON. `foodCatalog.service.js` exposes catalog search and server-side food-log macro scaling. A read-only audit/staging pipeline exists (`foodDataStaging.js`, `foodDataQualityAudit.js`, `stageFoodData.js`) with source-separated batches and automatic promotion disabled. The manifest records source/basis uncertainty. No production data was edited in this sprint.

## Staging-only flow

1. Source adapter fetches only an explicitly configured source and records source ID, release, URL, license, capture time and content hash.
2. Preserve original nutrient labels, units, nulls and state. Keep FDC, OFF, INDB, IFCT and contributed records in separate namespaces.
3. Validate stable IDs, duplicates, plausible values, units and serving/edible basis. A name similarity is only a human review candidate.
4. Require evidence for license, identity, measurement basis, state and source-row locator. Promotion requires an authorized reviewer and audit record; never use `eligibleForProduction` alone as authorization.
5. Build an additive search projection only after approval. Food logs keep the source-qualified food identifier and snapshot the selected food name/portion/calculated values for history stability.

## Blockers

- Obtain ICMR-NIN permission for electronic product storage/distribution of IFCT data.
- Resolve 542 vs 528 record count and obtain original authorized CSV/column map.
- Verify all seven unit mappings; review zero-energy oils and three macro-energy mismatches.
- Obtain INDB dataset permission and per-source terms; do not infer from its publication.
- Reconcile `Indian Nutrition Data` source lineage and upstream rights before use.
- No major food-catalog database migration until these decisions and the normalized-record proposal are approved.

The normalized record proposal is in `docs/research/indian-food-data-quality-comparison.md`. Existing FDC/OFF staging is the only import path evaluated; this sprint did not call external data APIs or add credentials.
