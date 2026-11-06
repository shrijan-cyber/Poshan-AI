# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The repository describes people seeking understandable nutrition awareness and meal suggestions that fit familiar Indian foods. Specific age bands, clinical cohorts, and accessibility accommodations are not established as product requirements.

## Product Purpose

PoshanAI is a web application for account-based nutrition tracking, Indian food lookup, report OCR, lifestyle recommendations, and meal-plan suggestions. Its purpose is to help people understand food and nutrition information and explore practical meal choices.

## Positioning

The implemented product combines an Indian food catalog, food logging, report workflows, and household-style meal planning in one web experience. The source does not establish a clinically validated personalization claim or a unique competitive advantage; do not invent either.

## Operating Context

- Users can create an account, sign in, track foods, browse IFCT-derived foods, upload a lab report, complete lifestyle onboarding, and request either a basic diet plan or a report-based seven-day meal plan.
- The frontend is a React/Vite single-page application. The API is Express and MongoDB. Optional queues use Redis/BullMQ; report OCR has a local synchronous fallback, and report-based generation runs synchronously outside production.
- The current interface is English-language web UI. Other languages and native applications are not established in the current implementation.

## Capabilities and Constraints

- Basic diet plans are deterministically composed from validated recipe templates and the shared IFCT catalog. Report-based plans also compose recipes deterministically; the model gateway is limited to recipe cooking instructions and falls back to static recipe instructions.
- Plan nutrition is calculated server-side from IFCT nutrient records and ingredient quantities. Missing nutrients must remain unavailable rather than being fabricated.
- The IFCT runtime file is an application subset. Its manifest records unresolved source mapping and reuse permission; do not describe the dataset as fully source-verified or licensed for redistribution.
- Uploaded reports are processed with OCR and stored with ownership checks. The report model encrypts raw OCR text. Reports and generated plans are educational inputs, not diagnoses.
- Severe health conditions are guarded by the backend. Medical decisions require a qualified professional.
- Redis is used for production asynchronous jobs and distributed capabilities. Local paths support synchronous processing where implemented.
- Email verification is future scope; authentication remains available without verification gating.
- Feature depth, clinician review status, supported locations, pricing, and competitive differentiation are open product decisions unless separately confirmed.

## Brand Commitments

- Preserve the existing PoshanAI name, logo asset (`poshanai-frontend/src/assets/logo.svg`), and forest/sage/paper visual identity present in the frontend.
- Current source colors include forest `#244b36`, deep forest `#173a2c`, moss `#728f5b`, sage `#e8eddf`, paper `#f8f7f1`, and ink `#27362d`. These are implementation evidence, not a separately approved brand standard.
- Current UI voice favors plain, encouraging food and nutrition language. Avoid diagnostic, prescriptive, or fear-based claims.

## Evidence on Hand

- Product behavior: `poshanai-frontend/src/App.jsx`, `poshanai-backend/src/app.js`, route/controller/service files, and current models.
- Nutrition source metadata: `poshanai-backend/src/data/ifct-manifest.json` and `poshanai-backend/src/rag/ifctDataValidation.js`.
- Brand evidence: `poshanai-frontend/src/styles.css`, `poshanai-frontend/tailwind.config.js`, and `poshanai-frontend/src/assets/logo.svg`.
- No clinician validation, customer testimonials, efficacy studies, or published performance benchmarks were verified in this repository. Do not fabricate them.

## Product Principles

1. Make nutrition information understandable and grounded in traceable data.
2. Prefer familiar, practical Indian household food choices.
3. Keep users in control of report review and food logging.
4. Be clear about uncertainty, unavailable values, and the educational scope of recommendations.
5. Protect personal and health information through ownership checks and restrained external data sharing.

## Accessibility & Inclusion

The product is a responsive web application. Treat keyboard operation, semantic controls and labels, visible focus, readable contrast, mobile reflow, reduced motion, and screen-reader status/error announcements as quality requirements. No product-specific conformance certification is documented.
