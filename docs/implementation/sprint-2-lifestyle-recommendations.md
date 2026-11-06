# Sprint 2 — Lifestyle recommendation engine

## Status and behavior

The lifestyle flow now evaluates a versioned, validated JSON catalog with the same deterministic evaluator after onboarding saves and on `GET /api/lifestyle/recommendations`. The routes remain authenticated. Reads and writes are scoped to `req.user._id`; the profile model has a unique `userId` index. An empty catalog is reported as `503 RECOMMENDATION_RULES_UNAVAILABLE`, not treated as a successful no-match response. A valid profile with no matching rules receives a routine check-up message.

The active catalog contains four conservative discussion topics:

- Vegan diet **and fatigue**: discuss whether B12 assessment is appropriate. Vegan diet alone does not trigger it.
- Fatigue: discuss persistent or life-impacting fatigue with a clinician; the engine does not order a CBC.
- Hair fall: discuss possible causes with a healthcare professional; no particular test is selected.
- Low sun exposure **and bone discomfort**: discuss whether vitamin D assessment is clinically appropriate.

Each result contains the rationale, triggering profile fields, evidence type/scope, source URL, what the topic/test generally measures, and a clinician disclaimer. Duplicate test topics merge factors, rationales, and sources. Logs contain static `ruleId` values only; profile answers and symptom values are not logged. No AI call or lab-result inference is involved.

## Clinical boundaries and sources

Rules use official guidance as conservative grounding, not as diagnosis or clinician approval of this product:

- [NICE NG239 — Vitamin B12 deficiency in over 16s](https://www.nice.org.uk/guidance/ng239/chapter/recommendations): symptoms plus a risk factor may warrant considering B12 testing; a vegan diet is a risk factor, not proof of deficiency.
- [NHS — Tiredness and fatigue](https://www.nhs.uk/symptoms/tiredness-and-fatigue/): persistent fatigue has multiple possible causes and should be discussed with a GP.
- [NHS — Hair loss](https://www.nhs.uk/symptoms/hair-loss/): hair loss has several causes and may merit GP assessment.
- [NICE PH56 — Vitamin D guidance](https://www.nice.org.uk/guidance/ph56/chapter/Recommendations): testing is considered for symptoms or high risk, not as universal screening.

Rules deliberately do not trigger from age, gender, activity, sleep, habits, vegetarian preference, or low sunlight alone. No confirmed-laboratory-abnormality rule is active; this engine evaluates lifestyle profiles only. Clinical review and localization for Indian care settings remain advisable before broad production use.

## API and compatibility

`POST /api/lifestyle/onboarding` preserves the existing `suggestions` field and additionally returns `recommendations`, `disclaimer`, `routineMessage`, `rulesVersion`, and `recommendationStatus`. `GET /api/lifestyle/recommendations` returns the same recommendation evaluator output for the authenticated user's saved profile. Existing frontend handling of legacy arrays and the current response object remains supported. No model migration is required; the existing LifestyleProfile fields and enums are used.

## Files changed for this track

- `poshanai-backend/data/testRules.json`
- `poshanai-backend/src/services/testRules.js`
- `poshanai-backend/src/controllers/lifestyleController.js`
- `poshanai-backend/tests/testRules.test.js`
- `poshanai-backend/tests/lifestyle.test.js`
- `poshanai-frontend/src/components/lifestyle/TestCard.jsx`

## Validation

- Rule engine unit tests: **13 passed, 0 failed**.
- MongoDB-backed lifestyle API tests: **7 passed, 0 failed** after running MongoDB Memory Server with user permission.
- Authentication guard test: included in those suites and passes.
- Backend ESLint for changed evaluator/controller/test files and frontend ESLint for `TestCard.jsx`: passed.
