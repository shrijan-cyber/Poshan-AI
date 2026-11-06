# Codex repository guidance

## Shared rules

- Check `git status` before changes; preserve unrelated staged, unstaged, and untracked work. Source and the current worktree override stale documentation.
- Preserve unrelated staged, unstaged, and untracked user work. Do not revert or absorb it into this task.
- Do not read, print, copy, or commit `.env` files or credentials. Use the checked-in examples for environment names.
- Keep changes scoped to the request. Do not add dependencies or refactor unrelated code unless the user asks.
- Open only task-relevant sections of `AI_CONTEXT.json`, `PROJECT_AI_GUIDE.json`, `PRODUCT.md`, `DESIGN.md`, and `docs/`. Do not load sprint reports or orientation files wholesale by default.
- Follow the closest nested `AGENTS.md` for frontend, backend, or nutrition work. Inspect source and focused tests before describing behavior.

## Product and data safety

- PoshanAI is a nutrition-awareness and Indian meal-planning product, not a diagnosis or treatment service. Preserve medical disclaimers and refer clinical decisions to qualified professionals.
- Treat IFCT dataset values and provenance as sensitive project data. Do not edit, regenerate, replace, or import nutrition records unless explicitly requested. Never invent a missing nutrient value.
- Nutrition arithmetic and meal selection are backend responsibilities. The AI gateway may only do the bounded task implemented by the backend; validate any model output before persistence.
- Maintain old saved-plan/API compatibility when changing plan schemas or response shapes.

## Documentation and interface

- Keep `PRODUCT.md` factual; distinguish implemented behavior from planned capability. Keep `DESIGN.md` grounded in existing CSS, Tailwind configuration, components, and assets. Do not treat tool-generated generic recommendations as approved product decisions.
- Verify architecture diagrams against source files and label optional or future infrastructure accurately.
- Use only relevant project-local skills from `.agents/skills`; review their behavior before execution. Do not enable hooks, plugins, MCP servers, external services, or global configuration changes without explicit user approval.

## Verification and Git

- Run the narrowest relevant lint, build, and tests after implementation. Report exact commands and results; distinguish pre-existing failures from failures caused by the change.
- Never commit, push, publish, deploy, or stage unrelated files unless the user explicitly asks. Keep the working tree reviewable.
