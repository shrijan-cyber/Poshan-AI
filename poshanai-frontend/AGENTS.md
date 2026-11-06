# Frontend guidance

- Keep the React/Vite JavaScript + JSX architecture. Do not introduce TypeScript, Next.js, new state systems, or new dependencies without a requested need.
- Use the existing Axios client, auth interceptors, Redux/context conventions, routes, and reusable components. Verify API request/response contracts from backend source before changing callers.
- Preserve existing behavior outside the requested scope. Keep business logic and nutrition calculations out of presentation-only components.
- Follow the current forest/sage/paper styles, responsive layout, semantic controls, keyboard operation, visible focus, accessible status/error messages, and reduced-motion behavior.
- Inspect only relevant route/page/components and their tests. Run focused frontend tests, then lint/build when the change warrants them; report what was actually run.
