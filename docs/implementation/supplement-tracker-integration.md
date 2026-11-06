# Supplement tracker integration

## Implemented

Existing personal tracker APIs support owner-scoped saved supplement CRUD and intake history. Intake snapshots the saved label component amounts by servings consumed; users can edit, delete, or duplicate a logged dose to today. Food-derived and label-derived nutrient totals remain separate, and only exact compatible unit aliases are combined. Unknown values remain unavailable. The tracker does not prescribe dosage.

## Partially implemented / missing

- Current nutrient components are limited to the existing micro-nutrient set; general active ingredients such as creatine or CFU strains are not a normalized knowledge catalog.
- No validated cross-unit conversions, per-week schedules, reminders, missed-intake workflow, search/filter UI or pagination beyond the basic history limit.
- No product catalog-to-user-item linking from a verified external source.
- Date-only history exists; full date/time, frequency rules and product form metadata are incomplete.

The daily summary must not count supplement calories absent verified caloric composition. Any conversion requires nutrient-specific validated rules (for example IU conversion varies by compound) and must preserve the original label amount/unit alongside the derived quantity and rule provenance.
