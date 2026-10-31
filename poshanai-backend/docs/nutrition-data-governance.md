# IFCT nutrition data governance

## Current catalog and provenance

The runtime catalog is `data/ifct_2017.json`: 542 application records attributed to ICMR-NIN's *Indian Food Composition Tables 2017* (Longvah et al., 2017). The official publication describes 528 analyzed foods across 20 food groups and more than 150 food components, based on national sampling and laboratory analysis. Except for eggs, the publication states that foods are raw; each food has a four-character code and record identification. The official reference is [IFCT 2017](https://www.nin.res.in/ebooks/IFCT2017_16122024.pdf). The checked-in artifact has SHA-256 `fe3ad3f3a250f0c23fc3ace7906097fcdbe19f8d80bd1cfe113b5b41d15bdc2e`.

All 542 application codes are unique, but this count is 14 higher than the 528 foods reported in IFCT 2017. Two normalized English names are duplicated across codes: `cat fish` (P009, S001) and `crab` (Q001, S007). These may denote distinct categories or duplicate mappings; without source locators they cannot safely be merged. Both the count discrepancy and duplicate names are emitted for review; no extra records are assumed official and no foods are merged.

The original CSV expected at `package/index.csv` is absent from this checkout, as is a verified source-header/unit mapping. Consequently, the artifact's record-level source locators, source column names, source units, and mapping from CSV rows to IFCT entries cannot currently be verified. The manifest records that limitation. Its nutrient `dataStatus` is `unknown` unless the nutrient is wholly absent from this application subset; the manifest does not label unverified values as analytical or measured.

The IFCT table basis is per 100 g edible portion. The original IFCT 2017 publication says all nutrient values are analytical and based on regional composite samples averaged over six geographical regions, and cautions that food composition varies with processing and biological factors. The application subset does not provide enough record-level state metadata to verify its food-to-source matching. Serving measures in the legacy builder are application presentation metadata, not IFCT measurements.

## Missing values, zeros, and unresolved records

- A blank source nutrient remains `null`; it must not be imputed as zero or inferred from another food.
- Numeric zero remains zero in the stored catalog and validation report. A suspicious zero is not silently rewritten.
- Every one of the 542 current records has `vitaminB12` and `fiber` set to null. Their units are unavailable in this subset and are deliberately marked unknown in the manifest.
- Codes T001–T014 contain 0 kcal with positive fat. Their energy values remain unchanged in the source catalog, are flagged by the audit, are exposed as unavailable in the existing food API, and are blocked from nutrition calculations. Do not replace these values without checking the authorized IFCT source rows.
- The legacy builder used `kJ / 4.184`; IFCT describes the relation as `1 kcal = 4.18 kJ`. Because source units and source rows are unavailable, the energy conversion discrepancy is unresolved. The new parser uses the IFCT stated factor only when a verified mapping explicitly declares a kJ source.

## Rebuilding the application subset

`src/scripts/buildIfctData.js` accepts only an explicitly named-header mapping with source units, expected row count, and SHA-256 checksum. It does not infer column positions or units. It writes a separate generated artifact under `data/generated/`; runtime data and source CSV paths are protected from overwrite. The mapping file must be created only after a maintainer has checked the authorized source file. No generated output should replace `data/ifct_2017.json` without review of source provenance, changed records, and API compatibility.

At present, `npm run build` cannot rebuild the dataset because the source CSV is unavailable. This is an expected, safe failure. Do not run `src/scripts/enrichIfctData.js`: category-mean imputation would create unsupported nutrition values and erase the distinction between missing and measured data.

## Reuse and licensing

The project has not confirmed permission for electronic storage or redistribution of IFCT-derived data in a product. IFCT 2017 allows personal use with attribution but prohibits electronic storage/reproduction for creating a product without prior written NIN permission; obtain that permission before product distribution. The [Indian Nutrient Databank (INDB)](https://www.anuvaad.org.in/indian-nutrient-databank/) is a separate 1,014-recipe resource. Its documented methodology combines IFCT 2017 and 2004 with UK and US food composition data, then calculates recipes from ingredient quantities; it is useful for future evaluation but must not be conflated with an IFCT-only catalog. The INDB portal describes it as open access, but this review did not establish a dataset reuse license suitable for PoshanAI. The [ICMR-NIN Dietary Guidelines for Indians 2024](https://nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf) provides dietary guidance and household measures, not a replacement food-composition table; the PDF carries a similar restriction on electronic reuse in a product. No external data source has been imported as part of this work.

## Validation requirements

Before a future catalog update:

1. Preserve the authorized source file's exact checksum and version.
2. Independently verify every source header and unit mapping.
3. Record source locators and per-field provenance/status when available.
4. Compare every generated record with the existing catalog and review changed values.
5. Run the IFCT structural audit and nutrient calculation regression tests.
6. Confirm missing values remain null and investigate suspicious zeros and energy/macro mismatches without automatic correction.
7. Review raw/cooked basis, edible portions, and recipe serving yields separately from nutrient measurements.
