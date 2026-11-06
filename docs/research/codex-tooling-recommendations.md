# ECC and Codex tooling recommendations for PoshanAI

**Reviewed:** 2026-11-02
**Scope:** Compatibility and overlap audit only. Nothing was installed, enabled, or copied.

## Current local tooling baseline

The repository already has root `AGENTS.md` guidance and 11 project-local skill directories: `banner-design`, `brand`, `design`, `design-system`, `diagram-design`, `gravitas`, `impeccable`, `last30days`, `slides`, `ui-styling`, and `ui-ux-pro-max`. `skills-lock.json` records a subset; verify its current role before any lifecycle changes. `gravitas` covers scoped implementation, evidence-backed verification, and failure recovery. The project also has tests, lint/build scripts, existing `.codex` and `.mcp.json` context. The MCP file was not read because it can contain credentials/configuration and is outside this audit’s need.

## ECC assessment

[ECC](https://github.com/affaan-m/ECC) is MIT-licensed and currently documents a native Codex marketplace plugin. Its public counts (skills, agents, commands) vary by release and should be treated as repository-maintainer claims, not an assurance of fit. The plugin includes skills and may include MCP configuration and hooks. Codex handles plugin lifecycle and explicit hook trust. ECC documents native commands:

```text
codex plugin marketplace add affaan-m/ECC
codex plugin add ecc@ecc
codex plugin list --json
```

These are reference commands only; they were not run. ECC also has a legacy copied-sync route. Do not combine it with native plugin installation. Native Codex does not use Claude’s scope or hook-profile choices; do not apply instructions for another harness.

| Capability | Existing overlap | Recommendation | Priority / effort / cost |
|---|---|---|---|
| Skills and agent prompts | 11 local skills and `AGENTS.md` already define design, audit and engineering workflows | Defer bulk install. Compare only a specifically needed skill with existing versions; avoid duplicate always-loaded guidance. | **P2**; low audit effort; MIT, no API charge, but added context/token load and update burden. |
| Security scanning | Project security instructions and `gravitas`; no evidence this makes ECC’s specific scanner redundant | Candidate for a narrow, read-only trial after reviewing scanner permissions and output; do not install yet. | **P1** candidate; medium; likely local execution, potential runtime/context cost. |
| Code review / testing workflow | Existing test/lint scripts plus `gravitas` verification | Compare exact workflow behavior before adopting. Prefer a single isolated skill if it closes an identified gap. | **P1** candidate; low-medium; no external API required unless the workflow configures one. |
| Hooks | Current project instructions are policy text; ECC hooks can execute on lifecycle events and require trust | Leave disabled until exact hook source, trigger, command, write scope and data egress are reviewed. | **P2**; high trust/maintenance risk; no direct API fee but runtime and permission impact. |
| MCP servers | Existing project MCP configuration exists | Do not merge plugin MCP configuration into `.mcp.json`; inspect endpoints and credentials only in a separately scoped review. | **P2**; medium-high; potential external API charges and project-context disclosure. |
| Context management | `AGENTS.md`, project context JSON and installed skills are already substantial | Keep current project rules concise; avoid installing redundant broad context. Measure prompt/context cost before adding. | **P2**; low-medium; context tokens accumulate across sessions. |

## Compatibility and licensing notes

- ECC’s code/plugin license is MIT; third-party MCP services, packages, and tools have separate licenses and terms.
- Official Codex plugin docs describe distribution of skills and optional MCP/hooks. A plugin install is not equivalent to copying one isolated prompt.
- A native plugin could install a broad set even if the intended use is one security or testing capability. Inspect its current manifest, skills, hooks, scripts and MCP config from the pinned release before approving.
- Native plugin installation is preferable to legacy sync if selected, but only one method should be used. Do not run `npx`, clone ECC, install dependencies, or change Codex plugin state as part of this audit.
- Keep PoshanAI `AGENTS.md` authoritative for project constraints. Do not let generic ECC instructions override IFCT provenance, medical privacy, auth, or no-secret rules.

## Recommendation

1. **P1:** Do a read-only, version-pinned comparison of one security-review or code-review skill with `gravitas` and existing CI/scripts. Capture exact unique value and required permissions.
2. **P2:** If a unique benefit is demonstrated and approved, use the official native Codex marketplace route, inspect any hook trust prompt, verify installed plugin state, then check for duplication. Do not use legacy sync concurrently.
3. **P2:** Keep hooks and extra MCP servers off unless separately reviewed and explicitly approved.

No installation is recommended at this point because overlap is high and the smallest useful profile has not been demonstrated.

## Official references

- [ECC repository](https://github.com/affaan-m/ECC)
- [ECC Codex plugin manifest](https://github.com/affaan-m/ECC/blob/main/.codex-plugin/plugin.json)
- [ECC configuration skill](https://github.com/affaan-m/ECC/blob/main/skills/configure-ecc/SKILL.md)
- [Codex plugin building documentation](https://developers.openai.com/plugins/build/plugins)
- [Codex plugin concepts](https://developers.openai.com/plugins/concepts/plugins)
- [Codex skill concepts](https://developers.openai.com/plugins/concepts/skills)
