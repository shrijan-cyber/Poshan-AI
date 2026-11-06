# Food log and supplement integration

Daily logging now reports separate food-derived, supplement-label-derived, and combined micronutrient totals. Supplement totals use the saved label snapshot and consumed servings. Values are combined only when nutrient identity and units are compatible under the existing exact-unit alias rules; unsupported units and missing values remain `null`/unavailable. No nutrient values are inferred from product names, and no dosage is prescribed.

The API retains the existing daily-log response fields and adds source-separated totals and supplement details. Regression tests cover known values, unknown IFCT nutrients, unsupported units, and empty supplement logs. Frontend display changes show the two sources separately.
