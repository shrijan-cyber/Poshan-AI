# Supplement data source evaluation

Checked 2026-11-06. Source suitability is field-specific; product label facts are not evidence of efficacy or safety.

| Source | Useful fields | Constraints and quality risks | Recommended role |
|---|---|---|---|
| NIH ODS DSLD | U.S. product/brand labels, serving size, ingredient panel, declared amounts, label IDs; API/search/download | Labels can be incomplete, proprietary blends may hide amounts, products can change, U.S.-centric; 1,000 requests/hour/IP without API key and 10,000/hour with key per API guide; CC0 with requested attribution | Product-label data, source-attributed staging and lookup. Not clinical evidence or an Indian-market catalog. |
| NIH ODS fact sheets / NCCIH | Reviewed consumer summaries, precautions and references | Topic-specific coverage; review date matters; not a machine-complete interaction graph | Human-reviewed source for bounded educational content and outbound references. |
| PubMed / NCBI | Bibliographic records, PMID, publication metadata, abstracts where available | Not a clinical guideline; study quality/populations differ; article copyrights apply; an identifier does not validate a claim | Citation lookup/metadata only; require evidence appraisal before showing a claim. |
| iDISK 2.0 | Product/ingredient/drug/disease relationship schema and retrieval research | Mixed-source terms (DSLD/LNHPD/MSKCC/NMCD); Apache code license does not clear dataset rights; derived clinical associations need verification | Schema/research reference only pending source-by-source permission and review. |
| Hermetica | Ingredient profiles and large interaction graph | CC BY-NC-SA 4.0; automated evidence scores and severity; non-commercial and share-alike conflict with production use | Reject production import and runtime dependency. |
| Verified Supplement Evidence | Evidence tiers, PMIDs, bioavailability and interaction datasets | CC BY 4.0; secondary compilation/methodology and U.S. population/cost assumptions require verification; publication changes | Research/staging candidate with attribution; human validation before any claim. |
| SuppDB | Product composition, DSLD identifiers, PubChem normalization and an interaction layer | Sample is CC BY-NC 4.0; full catalog/safety data require a paid commercial license; product labeling is not safety review | Reject free sample for production; consider commercial license or independently ingest CC0 DSLD records. |

## Recommendation

Use direct NIH DSLD API for label facts, plus carefully curated NIH ODS/NCCIH source links for educational context. Keep PubMed identifiers as references, not automatic proof. Do not import iDISK/Hermetica/SuppDB safety edges into production now. No supplement data is imported by the current implementation.

API access and terms: [NIH ODS DSLD API Guide](https://dsld.od.nih.gov/api-guide). The guide currently states an unauthenticated limit of 1,000 requests/hour/IP, 10,000/hour with an api.data.gov key, and CC0 1.0 with attribution requested. Confirm again before production integration.
