# Flexible meal frequency — implementation status

The diet wizard and generation route currently accept meal counts from 2 through 6, with optional user-defined labels, categories, and times. The API validates that a supplied schedule length matches `mealsPerDay`. The composer maps the schedule to eligible recipe categories and does not duplicate recipes solely to fill a schedule; unsupported combinations return an honest `unachievable` result.

This is not a guarantee that every frequency can be satisfied for every profile. Catalog coverage, dietary restrictions, calories, and raw-portion limits can make 2- or 6-meal plans infeasible. The current implementation does not model workout timing or explicit per-meal calorie distribution.

Before expanding frequencies further, add recipe coverage by category/diet and test calorie feasibility across representative profiles. Do not relax food restrictions or portion caps to force a plan.
