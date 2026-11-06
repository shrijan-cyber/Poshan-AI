# PoshanAI Codex workflow and repository integration

## Scope and safety

- This setup is limited to local agent guidance, reviewed project-local skills, product/design documentation, architecture diagrams, and a source-based UX audit.
- No production dependencies, environment files, IFCT records, recipe data, schemas, or application behavior were changed.
- No commit, push, deployment, hook activation, plugin trust, account connection, scraper run, or external data collection was performed.
- `CLAUDE.md`, `.mcp.json`, and the existing Claude/Ruflo configuration were left as-is. `AGENTS.md` is the Codex/agent guidance layer.

## Repository baseline and preserved work

At the beginning of this task the current branch was `main` at `c19d94c` (the prior IFCT P0 change). Existing user changes were already present and were preserved:

- Modified: `poshanai-backend/package.json`, `src/app.js`, `src/config/constants.js`, expert/notification controllers, reminder/worker jobs, Expert/Notification models, expert/notification routes, retest-reminder service/test, and `poshanai-frontend/src/main.jsx`.
- Untracked: booking controller/model/routes, notification queue/worker/service, expert booking service, and `enrichIfctData.js` / `seedExperts.js` scripts.
- `.env` exists and remains uninspected/unmodified.

The locally installed Codex CLI reported `0.164.0-alpha.11.1`; Node `v24.21.0`, npm `11.19.0`, Python `3.14.7`. Tool versions are a local machine snapshot, not project prerequisites.

## Repository map

| Area | Current implementation |
|---|---|
| `poshanai-frontend/` | React 18 + Vite 6 + Tailwind 3 SPA; React Router; Redux Toolkit/context; Axios client with refresh handling. |
| `poshanai-backend/` | Node/Express 4 ESM API; Joi validation; Mongoose/MongoDB; JWT access token and refresh cookie. |
| `src/rag/` | Shared IFCT loader/manifest validation, household whitelist, prompt construction and retrieval. |
| `src/services/` | Deterministic diet composer, recipe catalog, grocery aggregation, OCR, bounded AI integration, report storage. |
| `src/jobs/` | BullMQ/Redis queues and workers for OCR, meal generation and other background work. |
| `ai-service/` | Reserved extension point; no active Python nutrition service was found. |
| Root | Docker Compose, Nginx, AI context files, existing Claude/Ruflo guidance. |

## Eight-repository evaluation

| Repository | Finding and intended fit | Decision |
|---|---|---|
| [Impeccable](https://github.com/pbakaus/impeccable) | Product/design context and UI refinement workflow; Apache-2.0. Its optional detector hook runs on UI edits; its launcher verifies a downloaded engine against a checksum manifest. | Installed local skill v4.8.0; did not enable hook. Context launcher was attempted but could not create its verified binary cache outside the workspace. |
| [Scrapling](https://github.com/D4Vinci/Scrapling) | Python scraping/crawling framework (BSD-3-Clause) with stealth/anti-bot capabilities; does not fit the current Node backend. Scraping health datasets is outside scope and raises source/license/privacy questions. | Evaluated only; not installed, configured, or run. |
| [Last30Days](https://github.com/mvanhorn/last30days-skill) | Recency-focused research skill (MIT). Its source connectors send queries to external services; optional source credentials/cookies can widen data access, and setup may install other CLIs. | Installed skill v3.31.0 only. No setup wizard, credentials/cookies, external sources, or searches were used. |
| [Onyx](https://github.com/onyx-dot-app/onyx) | Full self-hosted enterprise search/assistant stack; Community Edition is MIT and includes its own ingestion, storage, indexing, and worker infrastructure. It substantially exceeds PoshanAI's bounded IFCT catalog/RAG needs. | Architecture comparison only; no services or dependencies added. |
| [Humanizer](https://github.com/Humanizr/Humanizer) | MIT .NET library for humanizing strings, dates, times, numbers, and quantities. The current Node/React app has no need for a cross-runtime dependency; existing JavaScript APIs cover relevant display needs. | Evaluated only; not installed. |
| [Diagram Design](https://github.com/cathrynlavery/diagram-design) | Codex-compatible architecture/flow diagram skill (MIT); local instructions/scripts and no server/telemetry per its privacy docs. Its default palette required project-specific customization before output. | Installed local skill v2.6; user selected PoshanAI forest/sage/paper tokens, which were applied to the local diagram style guide. No plugin/hook. |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Local UI/accessibility pattern and search catalog (MIT; installed skill metadata v2.15.0) useful for a frontend source audit. Generic recommendations can be irrelevant and must not override the actual product. | Installed through official Codex CLI setup. Its bundled local folders are present under `.agents/skills`; no package dependency or runtime hook added. Its nutrition query returned an irrelevant romance palette, explicitly rejected. |
| [Ponytail](https://github.com/DietrichGebert/ponytail) | Codex plugin (MIT) adds prompt/session/subagent lifecycle hooks and mode behavior. Hook inspection found state-file writes and subprocess execution, so it is not silently safe to trust. | Evaluated only; not installed/enabled. Requires explicit user approval through Codex hook review before use. |

### Installation and trust state

- Project-local skill root: `.agents/skills/`.
- Installed this session: Impeccable, Diagram Design, Last30Days, UI UX Pro Max and the folders delivered by its official setup. `skills-lock.json` tracks the Vercel-installed skills. Gravitas was already present before this setup.
- The official installers created files only under `.agents/skills` and updated `skills-lock.json`; no `package.json` dependency was added by this setup.
- Hooks, plugin marketplaces, user accounts, credentials, browser cookies, scraper sources, and optional research providers were not enabled.
- The Impeccable launcher (`.agents/skills/impeccable/scripts/impeccable.cmd context`) failed closed because it could not write `C:\Users\SHRIJAN\.impeccable\bin\0.1.18`. No unverified binary was run. Its project-context fallback was followed by reading `AI_CONTEXT.json`, `PROJECT_AI_GUIDE.json`, source, CSS, and routes directly.
- UI UX Pro Max is used as a pattern reference; Impeccable governs durable product/design notes; Diagram Design governs diagrams. The incumbent PoshanAI source and this product/design record outrank generic skill output.

## Environment and local run notes

- Read `.env.example` and `.env.production.example` for variable names; do not copy real values into docs or prompts.
- MongoDB is required. `REDIS_URL` enables queued/background work; source implements synchronous local fallbacks for OCR and meal generation. Production async processing expects Redis.
- Frontend scripts: `npm run dev`, `npm run lint`, `npm run build` from `poshanai-frontend/`.
- Backend scripts: `npm run dev`, `npm run lint`, `npm test` from `poshanai-backend/`. Backend tests may provision an in-memory Mongo server; external services are separately required for queue integration.
- Docker Compose config includes MongoDB, Redis, API, OCR worker, and web/Nginx. Do not run production services as part of this documentation task.

## Architecture sources and diagrams

The self-contained `docs/architecture/poshanai-system-map.html` has five inline-SVG diagrams: runtime architecture, basic plan generation, report upload/report-based generation, IFCT/nutrition data flow, and both grocery aggregation paths. It uses the user-selected project palette and system fonts; it makes no external network requests.

Grounding files include `poshanai-frontend/src/App.jsx`, `poshanai-backend/src/app.js`, route/controller/service files, `src/jobs/queue.js`, `mealPlanQueue.js` and `worker.js`, and `src/data/ifct-manifest.json`. Notable source distinction: `DietPlan` grocery results use `groceryService`; the `MealPlan` grocery endpoint currently contains its own aggregation loop.

## Competitor research status

`docs/research/competitor-research-template.md` is a blank evidence template. No competitor study was run and no product roadmap or feature claims were added. Future research must separate verified facts, community signals, interpretations, and hypotheses.

## IFCT guardrail

The earlier IFCT P0 work remains in the current baseline. This task did not alter `ifct_2017.json`, `ifct-manifest.json`, recipe templates, nutrition math, or their source/provenance declarations. Preserve the existing unresolved source-mapping and reuse-permission cautions.

## Verification and completion

Run the frontend lint/build and backend lint for this documentation/skills change. Application tests are not required because application source was not changed. Final status and exact verification results are recorded in the task response; no files were staged or committed.
