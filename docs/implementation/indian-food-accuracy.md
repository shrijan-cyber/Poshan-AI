# Indian food accuracy and recipe coverage

## Current safeguards

The deterministic backend recipe composer uses shared IFCT records, household food eligibility, dietary restrictions, allergies/dislikes, raw gram quantities and portion caps. It calculates nutrients server-side and returns `unachievable` instead of forcing unsafe portions. Flexible schedules from 2–6 meals carry labels and times. Grocery aggregation uses raw ingredient quantities.

## Known limits

The audited catalog snapshot contained 542 IFCT records and 20 recipe templates. Recipe source traceability, explicit raw/cooked state and supported cooked-yield evidence are incomplete. There are no independently verified cooking-fat quantities in the recipe templates. IFCT oil records flagged with zero energy and positive fat are unresolved; the calculation service rejects them. Curd/oats or other absent foods must not receive imputed nutrient records. Seed expansion is likewise blocked until food identity/state and IFCT mapping are verified.

Do not add oil retention assumptions. Store added oil separately from consumed oil; only calculate consumed quantity when a validated method/source exists. Do not present household measures unless the conversion is documented. No IFCT data or recipes were changed by the research work in this sprint.
