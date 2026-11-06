# Ingredient quantity accuracy — implementation status

## Current safeguards

- Meal nutrition is calculated by the backend from raw ingredient weights and IFCT records; AI is not the nutrition calculator.
- Unknown nutrient values remain unavailable rather than being replaced with invented values.
- Recipe portioning has raw-weight limits and may return `unachievable` rather than force an oversized staple portion.
- Grocery aggregation is based on ingredient records and raw quantities.

## Known data limitations

The audited IFCT catalog has 542 records and the checked-in recipe catalog has 20 templates. Recipe ingredient-level source traceability, raw/cooked state metadata, and cooked-yield evidence are incomplete in the current records. IFCT oil entries with zero energy and positive fat are flagged and excluded from calculations pending authoritative resolution. Therefore, oil/ghee must not be added to recipes using those unresolved records, and no replacement values should be guessed.

Next work is an approved, source-backed data correction process with immutable source snapshots, review metadata, and regression fixtures. No IFCT rows were changed in this sprint.
