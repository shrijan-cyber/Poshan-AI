# PoshanAI visual system

The frontend uses a premium editorial wellness direction for an Indian-first nutrition-awareness product. UI changes preserve the forest, sage and paper identity and the real product content and behavior.

## Foundations

- **Platform:** Responsive React web application with React Router, lazy route components, shared public and authenticated layouts, Redux state and existing API clients.
- **Body type:** Inter, then system sans-serif fallbacks.
- **Display type:** Georgia/Times New Roman for page-level editorial headings; interface and data labels remain sans-serif.
- **Icons:** `lucide-react`; avoid emoji in controls and use accessible names for icon-only actions.
- **Styling:** Tailwind CSS 3 plus `src/styles.css`; dark mode uses the existing class-based `ThemeContext`.

## Semantic tokens

| Token | Value |
|---|---|
| Forest | `#244b36` |
| Deep forest | `#173a2c` |
| Moss | `#728f5b` |
| Sage | `#e8eddf` |
| Paper | `#f8f7f1` |
| Ink | `#27362d` |
| Surface | `#fffefa` (light), `#18231c` (dark) |
| Subtle border | `rgb(39 54 45 / 11%)` |
| Card shadow | `0 8px 24px rgb(23 58 44 / 7%)` |
| Focus | Forest green, lightened for dark mode |

## Layout and reusable patterns

- `PublicLayout` holds public pages, shared navigation and footer.
- `Layout` holds authenticated pages with an accessible responsive workspace sidebar, theme action and sign-out action. The sidebar covers Dashboard, tracker, diet and meal plans, food library, experts, tests, profile, report upload and lifestyle profile.
- Common `Card`, `Button`, input, select and textarea styles share restrained borders, rounded corners, readable focus and comfortable touch targets.
- Data pages retain their domain-specific layouts and existing loading, error, empty and success handling. Missing nutrition remains missing; health suggestions remain educational and keep their doctor disclaimer.
- Page transitions and button feedback respect `prefers-reduced-motion`.

## Route-specific composition

The route inventory and each screen's content, established functionality, reused components and verification needs live in [the frontend redesign route inventory](docs/ux/redesign-route-inventory.md). Use each screen's task to guide its composition: editorial persuasion on Landing, focused completion on auth/forms, scanning and comparison on nutrition data pages, and transparent meal detail on plan pages.

## Quality boundary

Semantic labels, keyboard-operable controls, visible focus, responsive reflow, reduced motion, and honest loading/error/empty states are implementation requirements. Automated lint/build results do not establish browser, screen-reader, contrast, or device-matrix compliance; see [the frontend UX audit](docs/ux/frontend-audit.md) for what has and has not been verified.
