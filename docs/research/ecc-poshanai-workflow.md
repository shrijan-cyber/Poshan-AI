# ECC workflow assessment for PoshanAI

**Reviewed:** 2026-11-02
**Scope:** Read-only review. No Codex settings, plugin registrations, hooks, or project configuration were changed in this assessment.

## Installation status

The active Codex CLI reports one enabled native ECC plugin: `ecc@ecc`, version `2.2.3`, from the official `https://github.com/affaan-m/ECC.git` marketplace. The local plugin cache exists at `%USERPROFILE%\.codex\plugins\cache\ecc\ecc\2.2.3`; its plugin manifest reports MIT licensing and references packaged skills, MCP configuration, and Codex hooks. The package contains 314 skill directories in this installed version.

The marketplace and plugin were added in response to the prior explicit request to run the two `codex plugin` commands. No additional installation was performed for this audit. The current plugin list also shows enabled `open-code-review-codex`, `rea`, `claude-mem`, and `superpowers` plugins. The remote installed-plugin catalog request failed during the local `codex plugin list --json` call; local installed state was returned successfully. The CLI also emitted non-blocking temporary-directory permission warnings.

## Duplicate and conflict check

- **Native ECC:** One registered marketplace (`ecc`) and one installed plugin (`ecc@ecc`, 2.2.3) were visible. One ECC version directory was present in the plugin cache.
- **Legacy Codex sync:** `%USERPROFILE%\.codex` had `AGENTS.md` and `skills` entries (`.system`, `design-taste-frontend`), but no user-level `agents` or `commands` directory. The user-level `AGENTS.md` contained no ECC/legacy-sync marker. No duplicate ECC skill names were detected in those visible directories. This is a targeted file/directory check, not proof that no ECC files exist anywhere else on the machine.
- **Project Codex config:** No root `.codex` directory was present. The project root `AGENTS.md` is the applicable repository guidance; it forbids enabling hooks/external services without explicit approval and protects PoshanAI-specific IFCT, privacy, and auth rules.
- **Project-local skills:** `.agents/skills` contains 11 skills; `skills-lock.json` records 4 (`diagram-design`, `gravitas`, `impeccable`, `last30days`). `gravitas` already provides scoped engineering work, evidence-based verification, and failure recovery. Design-oriented local skills overlap ECC's frontend guidance. The separate `.claude` tree contains 21 skills, but no ECC marker was found in the targeted search.
- **Review overlap:** The `open-code-review-codex` plugin is already enabled, so a second automated code-review route should not be added without a specific gap. ECC itself has security review and test workflows that may complement, rather than replace, existing project practices.
- **Hooks/MCP:** The ECC manifest references hooks and `.mcp.json`; their contents and runtime behavior were intentionally not inspected. Do not infer that they are safe, trusted, or enabled from plugin installation alone.

## Recommended selective use

Use ECC skills only when a task matches a concrete capability. Do not enable or install separate copies of the skills; they are already packaged in the enabled plugin. Keep project `AGENTS.md` authoritative.

| ECC skill | Fit for PoshanAI | Recommendation |
|---|---|---|
| `security-review` | Auth, file upload, sensitive health data, external API and endpoint changes; directly matches project risk areas | **Use selectively.** Keep its findings subordinate to repository security policy and existing checks. |
| `tdd-workflow` | Regression fixes and new backend/frontend behavior | **Use selectively.** Follow the project’s real test commands; do not adopt generic coverage targets without project approval. |
| `ai-regression-testing` | Model-output validation, prompt changes, fallback behavior and AI-generated code regression coverage | **Use selectively.** Mock provider calls and keep private health data out of fixtures/logs. |
| `backend-patterns` | Node/Express service, route, validation and persistence changes | **Optional.** Use only when it adds a concrete pattern beyond current architecture and `gravitas`. |
| `frontend-patterns` / `react-testing` | React component changes, accessibility and behavior-focused tests | **Optional.** Existing React/Vite architecture and local UI skills remain the source of truth. |
| `database-migrations` | Mongo schema evolution and data migrations | **Use only for schema/data migration tasks.** Its examples mention other databases too; adapt only the Mongo-compatible principles. |
| `agent-architecture-audit` | LLM/agent stack investigations | **Optional for a demonstrated agent-stack incident.** The current PoshanAI AI flow is bounded and mostly deterministic; do not add agents just to use this skill. |
| `architecture-decision-records` | Significant architecture decisions | **Optional** when a durable decision record is requested; not a reason to add process for routine changes. |

### Capabilities to avoid duplicating

- For automated diff review, use the already installed `open-code-review-codex` integration where appropriate; avoid layering another review product by default.
- For implementation discipline and validation, `gravitas` is already installed project-locally. ECC `tdd-workflow` can supplement it but should not replace project-specific acceptance criteria.
- Do not turn on ECC hooks or add ECC MCP servers without a separate review of each executable, permission, trigger, external endpoint, data flow, and failure behavior.
- Do not copy ECC skills into `.agents/skills`, install legacy sync files, or add another marketplace/plugin registration.

## Verification and manual action

The following read-only checks were performed:

```text
codex plugin list --json
Get-ChildItem $env:USERPROFILE\.codex\plugins\cache\ecc\ecc\2.2.3\skills -Directory
Get-ChildItem .agents\skills -Directory
Get-Content skills-lock.json
```

The CLI output confirms ECC is `installed: true` and `enabled: true`; the cache directory and skill folders were present. The official plugin manifest at the cache path identifies the repo and package version. This audit did not run hook code, execute an ECC skill, inspect `.mcp.json` content, or verify that hooks have received trust approval.

**Manual action:** No immediate setup action is needed. Before relying on hooks/MCP, review their manifest targets and behavior and explicitly accept/decline any Codex trust prompt. If a workflow feels duplicative, use the current `codex plugin list --json` and compare before enabling any additional plugin. Do not use ECC's legacy Codex sync alongside the native plugin.

## References

- [ECC repository and current Codex installation guidance](https://github.com/affaan-m/ECC)
- [ECC Codex plugin manifest](https://github.com/affaan-m/ECC/blob/main/.codex-plugin/plugin.json)
- [ECC configure-ecc skill](https://github.com/affaan-m/ECC/blob/main/skills/configure-ecc/SKILL.md)
- [Codex plugin documentation](https://developers.openai.com/plugins/build/plugins)
