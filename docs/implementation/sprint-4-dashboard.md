# Sprint 4 — Dashboard experience

## Status: Completed

The dashboard now links directly to the food log, Food Library, and diet-plan flow. Its latest-plan panel reads the newest saved basic or report-based plan from the existing user-scoped `/diet-plans` response. Basic plans route to `/diet-plan/view`; report-based plans route to their saved `/meal-plan/:id` page. It displays persisted plan status where available and labels a saved basic plan as saved.

The new lifestyle check-in panel reads the authenticated user's existing `/lifestyle/recommendations` endpoint. It renders up to two returned topics and backend rationale, links to the full recommendations page, and has distinct loading, request-error/retry, no-onboarding, pending-review, no-match, and unexpected-response states. It retains the medical disclaimer and does not infer recommendations or profile facts.

Daily calories, targets, macro progress, food history, and micronutrient availability remain provided by the existing `CalorieTracker` component and its `/daily-logs/today` and `/calories/maintenance` calls. No duplicate calls or nutrition calculations were added to the dashboard.

## API and data

- No backend or API contract changes.
- Plan, log, profile, and recommendation data are obtained through the existing authenticated frontend client and user-scoped endpoints.
- Missing recommendation or profile data is shown as unavailable/incomplete, never as fabricated statistics.

## Files

- `poshanai-frontend/src/pages/Dashboard.jsx`
- `docs/implementation/sprint-4-dashboard.md`

## Validation and limits

- Dashboard-specific browser/device testing was not available in this workstream.
- Frontend lint and production build should be verified during Sprint 4 integration.
