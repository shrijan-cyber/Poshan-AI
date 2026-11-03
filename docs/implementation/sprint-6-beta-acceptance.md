# Sprint 6 — Beta acceptance checklist

## Execution status

**Browser acceptance is blocked before the application journey.** At the Sprint 5 browser check, Chrome exposed only `about:blank`; the frontend (`http://localhost:5173`) and API (`http://localhost:5000/health`) both returned `net::ERR_CONNECTION_REFUSED`. No service was started, no account was created, and no report or other health data was submitted. This sprint did not claim a browser pass.

The route inventory below was checked against `poshanai-frontend/src/App.jsx`. The expected behavior is the acceptance target; actual behavior is marked unverified unless the referenced implementation is independently confirmed by source or automated checks.

## New-user journey

| Feature | Expected behavior | Actual result | Status | Known limitation |
| --- | --- | --- | --- | --- |
| Landing | Public home route loads and links to registration/login | Browser unavailable | Blocked | No visual, console, keyboard, or responsive verification |
| Registration | Valid account can register; invalid fields show actionable errors | Browser unavailable | Blocked | No synthetic account created |
| Login | Valid credentials authenticate; invalid credentials remain rejected | Browser unavailable | Blocked | No session/cookie journey exercised |
| Onboarding | Required profile fields validate and save; optional preferences remain optional | Browser unavailable | Blocked | Persistence and duplicate-submit behavior unverified |
| Lifestyle profile | Authenticated profile answers save and load for the same user | Browser unavailable | Blocked | Privacy/ownership requires API and browser test account |
| Dashboard | Shows user-scoped tracker, plan and recommendation states; links navigate correctly | Source route exists; no browser session | Blocked | Loading/empty/error and real responses not exercised |
| Food Library search | Search returns records with unknown nutrients shown as unavailable | Sprint 5 added bounded server-side pagination and filters; no browser session | Blocked | API pagination UI interaction and details not exercised |
| Food Library filters | Category/source/state filters only reflect available metadata | Sprint 5 code integrates filters; no browser session | Blocked | Current IFCT catalog lacks row-level raw/cooked/source mapping |
| Food details | Shows returned metadata and does not infer missing provenance/nutrients | Browser unavailable | Blocked | No detail panel interaction verified |
| Diet plan generation | Authenticated request produces a saved plan or actionable failure | Browser unavailable | Blocked | No plan generated; never use non-synthetic health inputs |
| Meal details | Saved values and ingredient quantities are displayed; legacy unavailable values stay unavailable | Sprint 5 added compatibility states; no browser session | Blocked | No current or legacy plan loaded in browser |
| Grocery list | Authenticated backend list loads, retries on failure and downloads returned data | Sprint 5 integration exists; no browser session | Blocked | No download/browser network verification |
| Calorie tracker | User can log food and see validation/loading/error/empty states | Browser unavailable | Blocked | No end-to-end log submitted |
| Report upload | Valid synthetic report can be uploaded; invalid type/size rejected; processing status visible | Browser unavailable | Blocked | No test fixture submitted; no report data used |
| Recommendations | Saved profile rules render with rationale and medical disclaimer | Browser unavailable | Blocked | No user profile or recommendations response loaded |
| Profile updates | Authenticated user can update only their own profile | Browser unavailable | Blocked | No account or object-authorization journey exercised |
| Logout | Session is invalidated and protected routes require authentication | Browser unavailable | Blocked | Token/cookie invalidation unverified in browser |

## Cross-cutting UX checks

| Check | Expected behavior | Actual result | Status |
| --- | --- | --- | --- |
| Desktop and mobile layout | Content remains usable at desktop, tablet, and mobile widths | No application page loaded | Blocked |
| Keyboard navigation | Controls are reachable, operable, and visibly focused | No application page loaded | Blocked |
| Accessibility basics | Inputs have labels; errors and status updates are understandable; reduced motion is respected | `App.jsx` uses `MotionConfig reducedMotion="user"`; page-level checks not run | Partial |
| Loading/empty/error states | Each async flow communicates its state and offers retry where appropriate | Implemented in selected Sprint 4/5 pages; no browser interaction | Partial |
| Network failure | Failures are visible and do not appear as success | No browser request could be made | Blocked |
| Duplicate submission | Repeated submit is prevented or safely handled | Not exercised | Blocked |
| Color contrast/text readability | Text and controls meet accessible contrast/readability expectations | No rendered page available for measurement | Blocked |

## Manual prerequisites to close the checklist

1. Start the approved local or isolated staging stack and verify the frontend and API health endpoints are reachable.
2. Use an isolated test database, synthetic account, and synthetic report fixture only.
3. Run each journey at desktop and mobile widths; capture browser console/network failures and screenshots for defects.
4. Exercise unauthenticated/protected-route behavior, invalid uploads, retry/error states, keyboard navigation, and duplicate submits.
5. Record actual responses and artifacts in this table before marking any journey passed.

No production database, real user health record, live infrastructure, or deployment was touched for this checklist.
