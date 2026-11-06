# Nutrition data provenance audit — baseline

## Inspected snapshot

- IFCT food records: 542, loaded through the shared IFCT loader.
- Recipe templates: 20.
- Recipe ingredient entries: 70.
- Invalid IFCT references found in the audited recipes: 0.
- Recipes blocked by the existing quality audit: 0; recipes deemed ready for unrestricted production use: 0 (limitations remain).
- IFCT records flagged for zero energy with positive fat: unresolved oil records; the loader logs a warning and the nutrition calculation path rejects unresolved energy.

These are repository snapshot counts, not a claim of independent verification against the source publication. The repository does not provide item-level source pages for every mapped value, so external provenance could not be confirmed from the stored data alone. Missing nutrient values must remain missing. No external food composition records were imported or modified.

## Risks and next steps

Add item-level provenance (source/version/record/page or table, transformation, review status), explicit raw/cooked state, and recipe-level calculation fixtures through a reviewed migration. Resolve flagged IFCT energy/fat conflicts only from authoritative source documentation and retain an audit trail. Review licensing before redistributing any external dataset. Do not infer recipe accuracy from reference validity alone.
