# Codex context-efficiency POC and PoshanAI instructions

**Date:** 5 November 2026. **Mode:** no-install, local read-only measurement. No global Codex config or hooks touched; no external model calls. This POC measures guidance-file bytes, not token billing or output quality.

## Local baseline and measurement

The five project guidance documents inspected for this audit total **87,791 bytes**: `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `AI_CONTEXT.json`, and `PROJECT_AI_GUIDE.json`. The root `AGENTS.md` alone is **2,520 bytes**. Loading only the root instruction file first therefore reduces this guidance-file byte payload by **97.13%** for this one audit scenario:

| Scenario | Inputs | Bytes | Change |
|---|---|---:|---:|
| Broad orientation | All five files above | 87,791 | baseline |
| Hierarchical first pass | Root `AGENTS.md` only; open relevant source/docs on demand | 2,520 | −97.13% initial guidance bytes |

Reproduce in PowerShell from repository root:

```powershell
$files = 'AGENTS.md','PRODUCT.md','DESIGN.md','AI_CONTEXT.json','PROJECT_AI_GUIDE.json'
Get-Item $files | Measure-Object -Property Length -Sum
Get-Item AGENTS.md | Select-Object Name,Length
```

An installed Python `tiktoken` package was present, but its `cl100k_base` encoding file was not cached and attempted network access. The attempt failed due the restricted network environment; no download/install was attempted. Therefore exact tokenizer counts for this local sample are **unavailable**. Byte reduction is a direct local measurement, not a token-savings claim. Capsule/lowfat/Compaction numbers cited in the comparison are each vendor/project's own methodology, not a result of this POC.

## Quality and exact-recovery results

- **Response quality impact:** not measured; no model request was made.
- **Exact recovery:** no compression transform ran. Original source documents remain untouched, and a targeted follow-up can reopen exact sections/line ranges. This verifies source availability, not an external tool's recovery behavior.
- **Normal Codex behavior / Windows compatibility:** not exercised because no software, MCP server, plugin, or hook was installed.
- **Conclusion:** a sizeable reduction in initial documentation bytes appears available before adopting any compressor. The safe quality strategy is deferred retrieval from source, not lossy summarization of project invariants.

## Recommended hierarchical project instruction system

### Always loaded: root `AGENTS.md`

Keep only durable, high-impact invariants:

- protect uncommitted work, secrets and nutrition provenance;
- preserve security/API compatibility;
- never let AI own nutrition arithmetic or clinical decisions;
- exact validation/reporting requirements;
- a compact routing line to relevant docs and source.

Remove mandatory full reads of large orientation documents from every task. Use `AI_CONTEXT.json` and `PROJECT_AI_GUIDE.json` as lookup/reference docs, opened by relevant sections only. Keep current factual content in `PRODUCT.md` and design evidence in `DESIGN.md`, but do not load them automatically for backend-only work.

### On-demand task context

| Task | Load first | Then inspect |
|---|---|---|
| UI/design | `DESIGN.md`, relevant page/component | CSS tokens, route and reusable component actually touched |
| Product copy/feature scope | relevant `PRODUCT.md` section | current route/controller behavior before wording capability |
| Backend/API | relevant section of `PROJECT_AI_GUIDE.json` if needed | routes, controller, service, schema, tests |
| Nutrition | nutrition data provenance section | IFCT loader/catalog/calculator and relevant recipe tests |
| OCR/report | report workflow section | upload/parser/storage/controller and privacy tests |
| Ops/Redis | queue/runtime section | compose/config/worker and related health tests |

Use `rg`/`rg --files`, narrow `Get-Content` ranges, and focused tests. Summarize long command output at the source (PowerShell filters, Node test reporter, `git diff --stat`) rather than sending complete logs repeatedly. Avoid putting generated full-repo maps into root instructions. Keep generated indexes ignored or reviewed before commit and regenerate when source changes.

## Candidate recommendation

Capsule is the primary external candidate because its documented surface covers terminal, file, web and project context with exact local evidence expansion. Before any installation:

1. Obtain explicit approval for local plugin/MCP changes; do not change global Codex config before that approval.
2. Use a pinned release (the README points to v1.0.7 at review time), verify the published SHA-256 sidecar, inspect `.codex-plugin/plugin.json`, `.mcp.json`, hook definitions, file permissions and test scripts.
3. Use a disposable Windows user/Codex profile or isolated config; avoid trusting hooks. If a hook-free MCP registration is not supported, stop at the code review.
4. Run the project's tests in isolation and exercise one harmless synthetic command, bounded file read, and exact `expand` recovery. Compare original and recovered bytes/hash; check that secrets/ignored files are not indexed.
5. Compare representative PoshanAI task prompts with/without the plugin using provider-visible input counts where the provider reports them. Score tests, source references, omissions and regressions—not just input size. Do not test on medical/report data.
6. Review all changed config/artifact paths, then disable/remove only the approved tool-owned entries. Preserve existing Codex settings.

This plan is not an installation. No repository tool was installed during this audit.

## External-source evidence

- [Capsule README and benchmark](https://github.com/hakiyaka/capsule): Windows, plugin/MCP/hooks, test/benchmark locations, one measured web example.
- [Capsule privacy](https://github.com/hakiyaka/capsule/blob/main/PRIVACY.md): local state and memory capture controls.
- [Compaction safety](https://www.compaction.dev/docs/safety) and [hook behavior](https://www.compaction.dev/docs/hooks): hook defaults, fail-open claims, content-free receipts, byte recovery versus semantic validation.
- [CodeSight README](https://github.com/Houseofmvps/codesight): Codex MCP setup, index/wiki and benchmark claims.
- [lowfat README](https://github.com/zdk/lowfat): command-level `cl100k_base` examples and admitted small-run limitations.
