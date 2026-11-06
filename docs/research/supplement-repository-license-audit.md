# Supplement repository license audit

Checked 2026-11-06 against the repositories' published README/LICENSE pages. This is an engineering eligibility review, not legal advice. A repository code license does not automatically clear third-party dataset rights.

| Source | Published license / data terms | Commercial/redistribution status | PoshanAI decision |
|---|---|---|---|
| [iDISK 2.0](https://github.com/houyurain/iDISK2.0) | Repository includes Apache License 2.0. Dataset combines DSLD, LNHPD, MSKCC and other source material; per-source reuse rights are not established by the code license. | Apache permits commercial code reuse with notices; bundled/derived clinical data remain source-dependent. | Research/reference only until every source and field is rights-cleared. Do not import the bundle. |
| [Hermetica Supplement Encyclopedia](https://github.com/mindexpansive/hermetica-supplement-encyclopedia) | CC BY-NC-SA 4.0 per README. | Non-commercial only; share-alike applies to adaptations. | Reject for PoshanAI production data. Research-only evaluation, no copying or API dependence for commercial service. |
| [Verified Supplement Evidence](https://github.com/erinheit451/verified-supplement-evidence) | CC BY 4.0 per README, with DOI/citation instructions. | Commercial reuse is permitted with attribution and license notice; verify each underlying claim/source and third-party rights. | Eligible for a separately attributed staging evaluation, not automatic publication of medical claims. No data imported. |
| [SuppDB](https://github.com/SuppDB/supplements-nootropics-suppdb) | Repository sample data/docs: CC BY-NC 4.0; full normalized catalog and safety layer require a paid commercial license. | Sample prohibited for commercial use. Full dataset needs separate commercial license. Underlying DSLD/PubChem facts do not license SuppDB's compilation. | Do not use sample in production. Evaluate paid license only if a later business case justifies it. |
| [NIH DSLD](https://dsld.od.nih.gov/api-guide) | NIH ODS states DSLD data are public domain / CC0 1.0; requests source attribution. | Reuse and redistribution allowed; API rate limits apply. | Preferred product-label source for a controlled importer, with DSLD label ID, retrieval/version date and attribution. Labels are declared product information, not independent efficacy/safety evidence. |

The iDISK paper reports integrating DSLD, LNHPD, MSKCC and NMCD. Access to source content and downstream terms must be independently verified; the [repository Apache license](https://github.com/houyurain/iDISK2.0/blob/main/LICENSE) should not be interpreted as relicensing those sources. GitHub itself cautions that license detection is limited and not legal advice ([GitHub license API documentation](https://docs.github.com/en/rest/licenses/licenses)).

## Source content boundaries

- PubMed records and identifiers are discovery/reference data; the underlying abstracts and article full texts retain their own copyright and access terms. Store identifiers and bibliographic metadata; link out instead of copying abstracts unless reuse rights allow it.
- NIH ODS fact sheets are a safer source for reviewed consumer-facing summaries; record exact article URL, update/review date, and source. Do not scrape/publish derivative claims without review.
- iDISK and Hermetica datasets include disease/drug/benefit relationships that require clinical and licensing review before display.
- No external dataset was downloaded, imported, or placed in PoshanAI during this audit.
