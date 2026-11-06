# Advanced diet plan alternatives — implementation status

## Current behavior

The backend deterministically composes a single plan from the checked-in recipe catalog. It calculates nutrition from raw ingredient weights and the shared IFCT catalog, applies recipe eligibility and portion constraints, and can return `unachievable` when the requested schedule or calorie target cannot be safely composed. The current result flow does not persist or compare multiple alternatives, select a preferred alternative, or replace/regenerate an individual meal.

## Follow-up work

Add alternatives only after defining stable recipe-set scoring, independent nutrition totals per alternative, persistence semantics, and backward-compatible response fields. A selected alternative must preserve ingredient validation and dietary restrictions. Meal replacement must re-run whole-day calorie, macro, diversity, and portion validation. Do not present model-generated nutrition values as authoritative.

## Acceptance checks

- Multiple alternatives have distinct recipe sets and independently calculated IFCT totals.
- Selecting an alternative persists only the chosen plan and keeps legacy plans readable.
- Replacing one meal revalidates the whole day and refuses unsafe portions.
- API tests cover ownership, invalid alternatives, restrictions, and legacy response compatibility.
