# PoshanAI frontend redesign route inventory

Route source: `poshanai-frontend/src/App.jsx`. Protected routes keep their `ProtectedRoute` boundary; public routes keep the shared `PublicLayout` where currently registered.

| Route | Component | Existing function preserved | Visual direction and reusable UI | Verification |
|---|---|---|---|---|
| `/` | `Landing.jsx` | Product introduction, approach and signup/dashboard CTA | Editorial hero, existing food illustration and feature storytelling; public Navbar/Footer | Responsive hero and all CTA targets |
| `/login` | `Login.jsx` | Password login, validation, recovery and auth state | Shared auth surface, labeled fields and feedback | Submit, invalid credentials and narrow view |
| `/login-otp` | `OtpLogin.jsx` | OTP request, verification and password-reset flow | Shared auth card, visible step and errors | Request, verify, resend, reset and keyboard flow |
| `/two-factor-verify` | `TwoFactorVerify.jsx` | Authenticator/backup verification and expiry handling | Focused security form with status and recovery | Valid/invalid code, expiry and focus |
| `/register` | `Register.jsx` | Account creation, validation and navigation | Shared auth card and reusable controls | Validation, submit and mobile layout |
| `/food-library` | `FoodLibrary.jsx` | Nutrient-category browsing and detail modal | Searchable/browsable category grid with `TiltCard` and `NutrientModal` | Category open/close, keyboard and unavailable values |
| `/dashboard` | `Dashboard.jsx` | User summary, logs, reports, plans and quick actions | Data-led dashboard cards and existing chart/progress components | Loading/error/empty and real response values |
| `/calorie-tracker` | `CalorieTracker.jsx` | Daily log, add-food modal, pagination and totals | Meal journal, calorie ring and macro bars | Add/remove, failure recovery and narrow layout |
| `/diet-plan` | `DietPlanWizard.jsx` | Multi-step plan inputs, validation and generation request | Progressive form, progress indicator and review of choices | Required/optional fields, validation and submit |
| `/diet-plan/view` | `DietPlanResult.jsx` | Saved/basic plan details, ingredients and grocery download | Nutrition summary and recipe cards with backend values | Loading/error/empty, null nutrients and download |
| `/meal-plan` | `MealPlanView.jsx` | Report-based plan list and generation states | Day navigation, meals, instructions and grocery actions | Queued/synchronous/error and old saved plans |
| `/meal-plan/:id` | `MealPlanView.jsx` | Specific saved report-based plan | Same detail composition with selected plan context | Ownership/API errors and plan response shape |
| `/upload` | `UploadReport.jsx` | File validation, upload, OCR progress and recovery | Clear upload target, processing status and report states | File errors, progress, retry and completion |
| `/onboarding` | `Onboarding.jsx` | Consent, lifestyle answers, persistence and gating | Compact progressive questionnaire with clear choices | Consent, skip/edit path, save and mobile layout |
| `/recommendations` | `Recommendations.jsx` | Rule-based suggestions, explanation and disclaimer | Explainable recommendation cards and reassuring empty state | Existing API states, disclaimer and empty result |
| `/experts` | `Experts.jsx` | Expert discovery, availability and booking | Credential-forward expert list and booking flow | Loading/error/empty, booking feedback and mobile |
| `/profile` | `Profile.jsx` | Profile editing, save feedback and two-factor settings | Grouped personal/preferences/security settings | Load/save failures, validation and security controls |
| `/not-found` and `*` | `NotFound.jsx` | Recovery to a valid product route | Branded recovery message and clear home action | Direct route and wildcard redirect |

## Shared redesign work in this change

- Unified authenticated workspace shell, active navigation, mobile sidebar/backdrop and links to existing routes.
- Shared public/authenticated skip link, color tokens, page heading typography, form control focus/surfaces, touch target sizing, and reduced-motion behavior.
- Reused existing page content, cards, data state, APIs, and authentication. No demo nutrition, fake plans, or fabricated backend states were introduced.

## Verification status

Static route/config inspection is complete. Frontend lint and production build are the automated acceptance checks. Browser screenshots, keyboard/screen-reader sessions, mobile device sizes, theme contrast measurement, and live API interaction require a running browser and test accounts; do not infer these from a successful build.
