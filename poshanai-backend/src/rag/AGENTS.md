# Nutrition, IFCT and RAG guidance

- Treat the checked-in IFCT source, manifest, mappings and provenance as immutable unless the user explicitly requests a data change. Never invent, silently impute, or convert an unknown nutrient to zero.
- Nutrition arithmetic, eligible food selection, portions, raw/cooked weights and grocery quantities are backend-owned deterministic behavior. Compute from validated food records and documented units.
- Preserve raw ingredient basis separately from cooked household serving descriptions. Do not double-count food or apply an undocumented yield/unit conversion.
- The LLM may perform only the bounded task given to it. It must not select unapproved foods, determine portions/macros, interpret medical reports, diagnose, or override validated IFCT output. Validate output and retain safe deterministic fallback.
- Keep the product educational, preserve clinician disclaimers, and do not send private health/report data to an experimental or unapproved provider.
- Read relevant IFCT manifest/catalog/calculator and recipe tests for nutrition changes; do not load all implementation reports by default.
