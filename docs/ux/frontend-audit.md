# Frontend UX and accessibility audit

**Scope:** static source review of every route registered in `poshanai-frontend/src/App.jsx`, shared layout, API client, and core workflow components. No browser session, screen-reader pass, device matrix, contrast measurement, or user research was run. Findings below distinguish source evidence from items that still need runtime verification.

## Redesign implementation update

The shared visual foundation has been updated: authenticated/public navigation surfaces, responsive workspace navigation, skip links, forest/sage/paper tokens, editorial page headings, consistent form controls, touch target sizing, and reduced-motion behavior. The route-level structure and verification matrix are recorded in [redesign-route-inventory.md](redesign-route-inventory.md). Existing screen-specific data and interaction components remain in place. This code-level update is not a visual acceptance sign-off; browser review, accessibility interaction checks, theme contrast measurement, and viewport testing remain open because no browser automation/runtime session was available during implementation.

## Prioritized work schedule

### P0 — protect the health-data workflows

1. **Run a keyboard and assistive-technology pass on the complete report-to-plan path.** Include report upload, OCR pending/failed/completed states, review/edit, diet preferences, generation, and recipe details. Status: upload has alert/status roles and the wizard validates, but static source review cannot establish focus order, focus return, announcement timing, or screen-reader comprehension. Evidence: `src/pages/UploadReport.jsx`; `src/pages/DietPlanWizard.jsx`; `src/pages/DietPlanResult.jsx`; `src/pages/MealPlanView.jsx`.
2. **Make the distinction between measured, calculated, and unavailable values unmistakable.** Preserve backend `null` values in every chart/card and give the user a plain-language explanation. Avoid treating plan suggestions or lifestyle test suggestions as diagnoses. Evidence: API models permit nullable micronutrients (`poshanai-backend/src/models/MealPlan.js`); `PRODUCT.md` records the educational-only boundary.

### P1 — improve task completion and recovery

3. **Exercise upload and plan-generation recovery at mobile widths.** Verify retry actions, OCR polling feedback, queue fallback messages, empty state, and navigation after an interrupted session. Upload currently communicates progress using a status message while polling (`UploadReport.jsx`); confirm that prolonged processing remains understandable and does not appear frozen.
4. **Audit forms end to end.** For Login, Register, OTP, two-factor, Profile, Onboarding, and DietPlanWizard, check visible labels, programmatic error association, preserved values after errors, password-manager/paste behavior, keyboard selection controls, and explicit optional-field labels. The two-factor form includes `aria-invalid`, `aria-describedby`, and `role="alert"`; verify that the other forms meet the same standard rather than assuming a shared implementation.
5. **Keep users oriented in long nutrition surfaces.** Verify page heading hierarchy, selected plan/date context, meal grouping, ingredient disclosure state, and back navigation on Dashboard, DietPlanResult, MealPlanView, CalorieTracker, and Recommendations.

### P2 — unify the current design language

6. **Consolidate semantic color tokens.** Tailwind defines `forest #244b36`, but the Navbar has a separate hard-coded `#1E5631`; OTP auth also carries local hex tokens. This creates measurable token drift in source. Normalize only in a separately scoped UI task and verify light/dark contrast after consolidation. Evidence: `src/components/layout/Navbar.jsx`; `src/pages/OtpLogin.jsx`; `src/styles.css`; `tailwind.config.js`.
7. **Compare all loading, empty, error, and success states.** Shared route suspense and UI primitives exist, but their visual and live-region behavior should be checked across each route so one failure mode does not look like an empty result.
8. **Check narrow viewport and text scaling.** Test 320/375px widths, 200% zoom, landscape and long translated strings. No non-English localization is currently evidenced; this is resilience testing, not a claim that translations are supported.

### P3 — polish after task-flow findings

9. Review visual density, chart labeling, icon names, motion/reduced-motion behavior, and line length across marketing, dashboard, and food library pages. Only adjust items that a browser audit confirms.

## Route-by-route coverage

Routes below are from `src/App.jsx`; “verify” means the code path was included in the audit, with runtime behavior still unproven.

| Route / screen | Audit focus | Evidence |
|---|---|---|
| `/` Landing | Navigation, hero CTA, mobile image/layout, proof claims | `pages/Landing.jsx`, `styles.css` |
| `/login` | Labels, errors, password-manager behavior, recovery | `pages/Login.jsx`, `context/AuthContext.jsx` |
| `/login-otp` | Purpose selection, OTP errors, step changes and focus | `pages/OtpLogin.jsx` |
| `/two-factor-verify` | Code/backup mode, expiry feedback, error announcement | `pages/TwoFactorVerify.jsx` |
| `/register` | Validation, password guidance, success transition | `pages/Register.jsx` |
| `/food-library` | Search labeling, result density, empty and no-match states | `pages/FoodLibrary.jsx` |
| `/dashboard` | Daily-summary hierarchy, chart semantics, logging feedback | `pages/Dashboard.jsx` |
| `/experts` | Search/filter, booking feedback, schedule accessibility | `pages/Experts.jsx` |
| `/profile` | Required/optional fields, 2FA controls, save/retry state | `pages/Profile.jsx` |
| `/upload` | File constraints, upload progress, OCR pending/failure/retry | `pages/UploadReport.jsx` |
| `/meal-plan` and `/meal-plan/:id` | Plan selection, meal grouping, detail navigation, status | `pages/MealPlanView.jsx` |
| `/diet-plan` | Wizard length, required vs optional preferences, validation | `pages/DietPlanWizard.jsx` |
| `/diet-plan/view` | Nutrition targets, incomplete warnings, meal/ingredient disclosures | `pages/DietPlanResult.jsx` |
| `/onboarding` | Consent clarity, sensitive-answer skip/edit path | `pages/Onboarding.jsx` |
| `/recommendations` | Explain rule trigger, disclaimer, reassuring empty state | `pages/Recommendations.jsx` |
| `/calorie-tracker` | Portion basis, search, add/delete confirmation, daily total | `pages/CalorieTracker.jsx` |
| `/not-found` | Recovery link and understandable route error | `pages/NotFound.jsx` |

## Existing strengths observed in source

- Route pages are lazy-loaded with a shared loading state (`App.jsx`).
- Shared layouts and protected-route boundaries are explicit (`components/layout/Layout.jsx`, `routes/ProtectedRoute.jsx`).
- The app includes an Axios client with centralized auth refresh and API error normalization (`src/api/client.js`).
- Several workflow screens use semantic forms and explicit alert/status roles; the report-upload flow is an example (`pages/UploadReport.jsx`).
- The codebase already uses Lucide icons and a forest/sage/paper palette; keep these as the incumbent direction.

## Tool guidance applied cautiously

UI UX Pro Max React guidance reinforced semantic controls and accessible Testing Library queries. Its generic product search returned a romance/wedding palette for the nutrition query, so that generated recommendation was rejected as irrelevant. The product's existing palette and components remain authoritative. This is a source audit, not a redesign or feature roadmap.

## Acceptance checklist for a follow-up visual audit

- [ ] Keyboard-only flow through each route and all disclosures.
- [ ] Screen reader checks for headings, labels, validation, asynchronous status, and chart summaries.
- [ ] Light and dark theme contrast checks for text, controls, focus, and data charts.
- [ ] 320/375/768/1024/1440px viewport snapshots; no horizontal overflow.
- [ ] 200% text zoom, reduced motion, and long content/long names.
- [ ] Report OCR queued, synchronous, error, retry and completed states.
- [ ] Diet generation success, unachievable, incomplete-data, empty and error states.
