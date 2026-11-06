# Supplement data import pipeline

## Status

No external supplement records have been imported. The existing staging tools for food data are not a supplement importer and must not be repurposed to bypass supplement licensing review.

## Approved pipeline design

1. Record source, endpoint/file, version or retrieval timestamp, license, attribution and any source-specific restrictions.
2. Store the untouched original response in a restricted staging area with checksum and import-batch ID.
3. Parse label facts without interpreting them as efficacy or safety claims.
4. Normalize ingredient names using reviewed aliases while retaining the exact label string.
5. Parse units only when explicitly represented; preserve unknown units and missing quantities.
6. Validate product/ingredient relationships, label serving basis, IDs, PMID/DOI syntax and duplicate keys.
7. Write accepted and rejected rows to separate batch outputs with rejection reasons.
8. Require a reviewer to verify source/license and a clinical reviewer for evidence/interaction claims.
9. Promote transactionally and idempotently; never overwrite reviewed records without an explicit revision and audit record.
10. Keep rollback by batch/version and report counts/checksums.

## Source eligibility

NIH DSLD is the current candidate for label facts (CC0; attribution requested, documented API quotas). Hermetica and the SuppDB sample are non-commercial and cannot enter production. iDISK requires source-level rights clearance. Verified Supplement Evidence is CC BY 4.0 but still requires attribution and claim-level review. See the linked research audits before any import. This document describes a gate; it does not claim an importer exists.
