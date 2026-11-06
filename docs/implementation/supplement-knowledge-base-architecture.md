# Supplement Knowledge Base architecture

## Status

**Research/design only; knowledge catalog and interaction API are not implemented or populated.** Existing `UserSupplement` and `SupplementLog` remain the user's personal tracker. Do not reuse their owner-scoped records as public clinical knowledge.

## Proposed normalized model

- `SupplementProduct`: source ID/label ID, product name, brand, serving and product form; references ingredient composition rows.
- `SupplementIngredient`: stable canonical ID, primary/common/scientific names, aliases and category. Normalize once; product ingredients reference this ID.
- `SupplementComposition`: product + ingredient + label amount/unit + per-serving basis + proprietary-blend/amount-disclosed flags. Do not coerce absent amount to zero.
- `SupplementEvidence`: ingredient + claim + study type/population/outcome/limitations + PMID/DOI + source and review status/date.
- `SupplementInteraction`: ingredient pair or ingredient/drug class + status (`known`, `potential`, `insufficient-evidence`, `not-reviewed`) + source-backed text, severity only when source-supported, references and review state.
- `SupplementSource` / import batch: source/version/retrieval date/license, checksum, validation outcome, reviewer and approval/promotion history.

Keep label facts, evidence syntheses, interaction assertions and user logs separate. Use Mongo ObjectId references plus unique canonical IDs and compound indexes. Every medical-facing fact must include provenance and review state. Missing interaction records map to `not-reviewed`, never “no interaction.”

## API boundary

Read-only knowledge search/detail/compare endpoints may expose only approved catalog records. User tracking routes remain authenticated and owner-scoped. Staging/import routes require a separately authorized operator, idempotency key, source/license record and explicit approval before promotion. Do not call an AI model to infer evidence, interaction severity or dosage.

## Sources and governance

Prefer direct NIH DSLD label facts under CC0 attribution for product labels. Use NIH ODS/NCCIH pages for reviewed educational text. PMIDs/DOIs are references, not evidence grades by themselves. Restricted repository datasets are not production dependencies. Clinical review is required before surfacing benefit, risk, contraindication or drug-interaction guidance.
