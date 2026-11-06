# Codex context and inference optimization: final plan

**Reviewed:** 5 November 2026
**Environment:** Windows 11, VS Code, Codex CLI, `D:\FinalYearProject`
**Scope:** Repository/source and license review, read-only Codex configuration audit, local guidance-size measurement, and a no-install comparison. No provider calls or private PoshanAI source uploads were made. No package, plugin, hook, or global setting was changed.

## Executive decision

Use the project’s hierarchical instructions first, then test **one** context tool: Capsule, in an isolated profile and with hooks disabled or individually reviewed. Do not combine Capsule, Compaction, CodeSight, and lowfat; they overlap on context retrieval and/or output reduction. The initial local measurement already shows a large reduction from not loading five orientation files for every task.

For inference routing, retain the current Codex subscription workflow as the coding baseline. If a separate synthetic-only provider-routing trial is approved, **OmniRoute is the more relevant candidate** than DSH-GOD because it is a general OpenAI-compatible gateway. This is not a recommendation to route PoshanAI code, reports, or health data through it. DSH-GOD is not recommended for this workflow.

No evidence supports a dollar-savings estimate yet. Exact token usage, compressor A/B quality, provider price, and a monthly request baseline were unavailable. Do not interpret repository marketing claims as PoshanAI results.

## Nine-repository comparison

| Repository | License and Windows/Codex fit | Main benefit and overlap | Evidence, risks, cost | Decision |
|---|---|---|---|---|
| [Capsule](https://github.com/hakiyaka/capsule) | MIT; README claims Windows and local Codex plugin/MCP support; Node 18+. | Broad retrieval/output/context tools and exact evidence recovery; overlaps with the other three context tools. | Project reports 25,877 characters reduced to a 519-character model-facing lease for one web result (97.99%) with byte-exact recovery. This is one vendor workload, not token billing or task-quality evidence. Bundled MCP and lifecycle hooks have broad local access; inspect before trust. | **P1 test candidate**, only one context tool, isolated and hook-minimized. Best coverage fit, not yet locally validated. |
| [Compaction](https://github.com/philipppohlmann/compaction) | Apache-2.0 CLI/core; Community Hybrid Engine has separate terms. Official docs reviewed do not establish a native Windows 11 persistent install path; Windows/VS Code compatibility remains unverified. | Codex hook-based input/output compaction and recovery; directly overlaps Capsule/lowfat. | Current project docs report provider-reported input reductions on selected uncached API sessions and estimated output reductions. It retains local recovery material. No independent PoshanAI run; hook behavior/config changes require review. | **Defer/reject for this Windows profile** pending native Windows verification and hook approval. Do not pair with Capsule. |
| [CodeSight](https://github.com/Houseofmvps/codesight) | MIT; Node 18+, `npx`; README documents Codex MCP. Native Windows behavior not tested. | Static project map/wiki, dependency and schema extraction. Overlaps Capsule’s project-context features, but is less of a terminal compressor. | Author reports 7–12x base and 60–131x targeted wiki reductions; tokenizer/corpus and independent reproducibility were not verified. Generates `.codesight` artifacts that may stale or expose repository structure. `--init` and `--hook` write project files/hooks. | **Optional P2** only if project navigation remains a measured bottleneck after instruction cleanup; no automatic init/hook. |
| [lowfat](https://github.com/zdk/lowfat) | Apache-2.0; Rust CLI/releases list Windows builds; no Codex MCP integration documented. Local Windows/Codex workflow not tested. | Narrow terminal-output filters; overlaps Capsule’s command-output projection. | README gives small `cl100k_base` examples (e.g. `git diff` −15% full / −97% ultra; `git log` −93%/−97%) and identifies them as directional single-repo figures. Ultra mode can discard detail and is not exact-recovery. Local-only claim still leaves local history/cache to protect. | **Reject for now**: less Codex integration and riskier lossy output than the selected trial. Revisit only for a demonstrated terminal-output problem. |
| [DSH-GOD](https://github.com/crackerghost/DSH-GOD) | Fork retains upstream MIT notices. Standalone Node service requires Node `^22.19.0` or `>=24`; Windows desktop app is the officially supported desktop build. Repository includes Codex connection recipes. | Alternative inference router/service, not a context optimization tool. Overlaps OmniRoute and adds a separate local gateway. | Current README notes upstream updater/announcement/EAC references remain configured for the upstream project. Its shared/free provider availability has quotas and upstream terms; user prompts/tool output go to selected providers. A fork/updater mismatch is a supply-chain and trust concern. | **Reject** for PoshanAI/Codex inference. No demonstrated quality, privacy, or cost advantage over the current workflow. |
| [OmniRoute](https://github.com/cheaper-inference/OmniRoute) | MIT gateway; Node/Docker options and Codex launcher/configuration documented. Windows path is plausible through Node/Docker but not locally tested in this audit. | General OpenAI-compatible multi-provider gateway. Appropriate for an isolated synthetic routing POC, but not a context compressor. | Gateway adds credential, log, routing and local-network attack surfaces; upstream retention and pricing vary. Any “free” quota is provider-specific and volatile. Never route health/report data without explicit provider approval. | **P2 optional synthetic-only POC**, if model switching is a separate goal. Keep off the default Codex/PoshanAI route. |
| [Free Claude Code](https://github.com/Alishahryar1/free-claude-code) | AGPL-3.0-only; project advertises Windows, VS Code and Codex. Local compatibility not tested. | Proxy/harness, provider switching, optional RTK/Headroom. Overlaps OmniRoute and can alter global tool setup. | Installer/release behavior and optional integrations broaden supply-chain/config risk. Credential handling is local and not established as encrypted at rest. Providers receive prompts/code. No reliable free quota or comparative quality evidence. | **Reject on the active profile**; no cost/privacy evidence justifies another harness. Isolated sandbox only if separately approved. |
| [Everything Claude Code (ECC)](https://github.com/affaan-m/ECC) | MIT project/plugin; native Codex plugin path is documented. Skills/hooks may have separate runtime/tool dependencies. | Skills, agents, hooks and workflows. High overlap with currently configured Codex plugins, local skills and project `AGENTS.md`. | Read-only config metadata shows ECC already has a plugin section and hook state. Existing environment also has project-local skills and `AGENTS.md`. Adding legacy sync or another copy would duplicate instructions/hooks. | **Keep existing installation as-is; do not add another method.** Select individual skills only after an overlap audit and explicit approval. |
| [Awesome Free LLM APIs](https://github.com/open-free-llm-api/awesome-freellm-apis) | MIT applies to the directory; no runtime installation or Codex integration. | Discovery list for provider/model candidates; no context savings. | Provider counts, free status, model IDs, context sizes and limits can become stale. Each provider’s license, privacy and quota governs actual use. | **P2 reference only.** Verify any candidate against provider primary documentation; never infer privacy or “free forever.” |

Related index repositories from the broader PoshanAI research—such as [Awesome-LLM](https://github.com/Hannibal046/Awesome-LLM) and [public-apis](https://github.com/public-apis/public-apis)—are discovery catalogs, not runtime dependencies. Their linked tools/data have independent licenses and current-status checks; existing research is in [AI ecosystem comparison](ai-ecosystem-comparison.md) and [external repository audit](external-repository-audit.md).

## Read-only Codex configuration audit

The audit inspected only metadata/table names; it did not print configuration values, credentials, or environment files.

- Codex CLI reports `codex-cli 0.164.0-alpha.11.1`.
- `%USERPROFILE%\.codex\config.toml` exists (3,070 bytes). It contains project-specific entries and five configured plugin sections: Superpowers, claude-mem, open-code-review, REA, and ECC. Hook-state sections exist for claude-mem and ECC. There is no standalone `hooks.json` in the profile root.
- A prior `codex mcp list` showed `chrome-devtools` and `mcp-search` as enabled but `Unsupported` in this CLI. Codex emitted access-denied warnings for stale temporary PATH aliases. This suggests an environment/runtime limitation; it does not prove the configured servers work.
- No model-provider section was found in the prior metadata scan. No global config values were changed.
- Token/usage consumption could not be read from the available non-interactive tools. Do not inspect raw conversation/session logs for a token estimate; they can contain source, prompts and personal data. The user can record the Codex `/status` view or account Usage page during an approved benchmark.

**Implication:** do not add Capsule/Compaction hooks or another plugin on top of the current hook-bearing plugin set without reviewing the exact event and permission overlap. No automatic Codex config changes are proposed in this phase.

## Measured local context and benchmark status

Current file byte sizes were measured from the worktree. These are UTF-8 file bytes, **not tokenizer counts**.

| Initial context scenario | Files | Bytes | Byte reduction vs. five-file orientation |
|---|---|---:|---:|
| Broad orientation baseline | `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `AI_CONTEXT.json`, `PROJECT_AI_GUIDE.json` | 87,816 | — |
| Global project guidance only | root `AGENTS.md` | 2,545 | 97.10% |
| Frontend task start | root + `poshanai-frontend/AGENTS.md` | 3,410 | 96.12% |
| Backend task start | root + `poshanai-backend/AGENTS.md` | 3,366 | 96.17% |
| Backend service task start | root + backend + `src/services/AGENTS.md` | 4,017 | 95.43% |
| RAG task start | root + backend + `src/rag/AGENTS.md` | 4,507 | 94.87% |

This only compares bytes of instruction documents. It does not account for source files subsequently opened, cached input, model tokenization, response quality, or subscription quota. Exact token counts and model quality impact are **not measured**. The prior POC explains why the installed tokenizer could not provide a count without an unavailable encoding asset: [context-efficiency POC](codex-context-efficiency-poc.md).

The requested identical synthetic coding-task A/B benchmark was **not run**: Capsule, Compaction, CodeSight and lowfat are not installed, and the instruction forbids installation before approval. No compressor before/after result can honestly be reported. The repo-published numbers in the table above remain vendor/author measurements, not this project’s benchmark.

### Approved benchmark protocol for a later phase

After approval, use a disposable synthetic JavaScript repository (no PoshanAI files) and the same frozen task prompts, model, Codex build and temperature/settings across runs:

1. Baseline: implement a small pure function, fix one seeded bug with tests, and explain a second module’s call path. Save patch, test output, provider-reported input/output tokens, latency and task score.
2. Run each candidate separately (never stack compressors); use a fresh session and identical repository snapshot for each task.
3. Score exact acceptance tests, correctness, evidence paths, omitted requirements and latency. For any exact-recovery feature, compare recovered source bytes/SHA-256 with originals.
4. Repeat each task at least five times if model nondeterminism applies. Publish median input tokens/latency and pass rate; mark unavailable provider metrics as N/A.
5. Do not send PoshanAI private source, reports, health data, or actual user food logs to experimental providers.

## DSH-GOD vs. OmniRoute: inference decision

Both are inference-routing options and neither reduces the prompt by itself. They do not change Codex plan entitlements; third-party provider API requests are billed/quota-limited separately. DSH-GOD is coupled to its own plugin ecosystem and a free/shared provider model; current source notes upstream account/updater authorization dependencies. OmniRoute is the more general API gateway and aligns with PoshanAI’s existing OpenAI-compatible backend boundary, but it introduces provider credential storage, routing logs, local service exposure and upstream data-policy differences. **Choose neither for private PoshanAI data in this audit.** For a later, explicitly approved synthetic-only trial, test OmniRoute alone against direct Gemini/OpenAI-compatible access using the same coding tasks. Never silently fail over sensitive prompts to a different provider.

Cost comparison is currently unavailable: no live pricing/quota was queried, no usage baseline was accessible, and “free” offerings have provider-specific limits and terms. Router infrastructure can add rather than reduce cost via retries, fallback calls or duplicate requests.

## Capsule vs. Compaction decision

Capsule is the better first candidate for this Windows setup because its current README explicitly claims Windows support and its documented scope includes Codex local plugin/MCP, terminal/file/project retrieval and byte-exact evidence expansion. Compaction reports stronger provider-measured input data for some runs, but official documentation reviewed here did not establish native Windows support, and its hook-based installation conflicts with the existing plugin hook surface. These are fit judgments, not benchmark wins.

**Recommendation:** do not install both. If the user approves a POC, review a pinned Capsule release’s plugin manifest and hook declarations first. If hooks cannot be disabled or isolated, stop and select no compressor. Keep Compaction deferred until its Windows path is documented and it can be tested without overlapping hook changes.

## PoshanAI instruction review

The current structure is already hierarchical: root `AGENTS.md` contains cross-cutting security/product rules, with frontend, backend, backend-service and RAG guidance in nested files. This lets task-specific work avoid loading `PRODUCT.md`, `DESIGN.md`, `AI_CONTEXT.json` and the large `PROJECT_AI_GUIDE.json` by default. The broad read is 87,816 bytes versus 2,545–4,507 bytes for the measured task-specific entry points.

The root currently repeats the preserve-unrelated-work rule in adjacent bullets. Remove that duplication in a later reviewed docs change. Keep nutrition provenance, secret handling, API compatibility, and deterministic backend nutrition ownership intact; those are high-value instructions, not candidates for lossy compression. Route to relevant reference sections only when the task calls for them. Do not run a generated-index/init command that creates or replaces more instruction files.

## Recommended smallest effective combination

1. **P0 — Project-local hierarchical instructions:** keep the root and nested `AGENTS.md` files; load product/design/AI reference docs on demand. No tool or provider cost. Benefit is directly measured in initial guidance bytes.
2. **P1 — Capsule, conditional POC only:** add only after explicit approval, manifest/hook review, isolated config, pin/checksum verification, and synthetic tests. Expected benefit is less repeated terminal/file/context payload; actual savings and quality impact remain unmeasured. Do not stack with Compaction, CodeSight or lowfat.
3. **Optional separate inference experiment — OmniRoute:** only if model choice/provider cost is a distinct objective; use synthetic prompts and one provider at a time. It is not part of the context optimization combination.

**Reject/defer:** DSH-GOD, FCC, Compaction on this Windows setup, and lowfat for now. Keep CodeSight as a later project-index alternative only if Capsule proves inadequate. Keep ECC as currently configured; do not add a second installation/sync method. Use free-model directories only to discover candidates.

## Post-approval Windows plan (not executed)

These are proposed commands, not actions taken. They place the source under a separate local evaluation folder and do not install a global npm package or run a remote installer. Pin and checksum verification must be completed before extraction or execution.

```powershell
# Review the pinned Capsule source in an isolated folder
$poc = Join-Path $env:LOCALAPPDATA 'PoshanAI-Codex-POC\capsule'
New-Item -ItemType Directory -Force (Split-Path $poc) | Out-Null
git clone --branch v1.0.7 --depth 1 https://github.com/hakiyaka/capsule.git $poc
Set-Location $poc
npm ci
npm test
```

Before `npm ci`, inspect `package.json`, lockfile, `.codex-plugin/plugin.json`, `.mcp.json`, hook declarations, ignore rules, and the pinned tag/commit. `npm ci` executes package lifecycle scripts; if review finds an unexpected script or network behavior, do not run it. Do not use `npm run hooks:install`. For Codex registration, use a disposable Windows account/config or a project-local marketplace and repo-local `.codex/config.toml`; do not run `codex plugin marketplace add` against the active profile. Capsule’s README documents local plugin activation but does not provide a single safe CLI add command that avoids config writes. Review Codex’s current plugin UI/marketplace behavior at approval time and require explicit review of any hook-trust prompt.

### Backup and rollback (only after approval)

Back up only the exact Codex config files that the approved setup will touch. Do not copy environment files or credentials into the repository.

```powershell
$codexHome = Join-Path $env:USERPROFILE '.codex'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $env:LOCALAPPDATA "PoshanAI-Codex-POC\backup-$stamp"
New-Item -ItemType Directory -Force $backup | Out-Null
Copy-Item (Join-Path $codexHome 'config.toml') $backup
if (Test-Path (Join-Path $codexHome 'hooks.json')) {
  Copy-Item (Join-Path $codexHome 'hooks.json') $backup
}
```

Prefer the disposable profile to keep rollback simple. For a project-local trial, remove only the approved plugin entry and marketplace metadata, then delete only the POC folder after confirming no generated evidence is needed. For a profile-level trial, restore the backed-up file(s) only after comparing current contents and preserving changes made since the backup. Do not overwrite the whole profile or reset Codex settings.

## Cost and security summary

- **Verified savings:** no token or dollar savings measured. Direct verified monthly savings are **$0** because there is no before/after usage or bill data. This means “not demonstrated,” not that a future benefit is impossible.
- **Estimate method:** for an API-billed workflow only, estimate monthly delta as measured eligible input-token reduction × current provider input price, minus any added provider, gateway, retry and tool costs. For a fixed Codex subscription, do not convert token reduction to dollars unless the plan’s usage billing demonstrably changes.
- **Main risks:** plugins/MCP tools and hooks can execute commands or read/edit files; generated project indexes can expose repo structure; compressor caches/recovery stores may contain sensitive snippets; alternate providers receive prompts and may retain/use data; free quotas can change; auto-fallback can route sensitive data unexpectedly.
- **Controls:** separate synthetic corpus, no health data, loopback/auth for any local gateway, no secret logging, exact upstream/privacy review, pinned version/checksum, least-privilege tool set, inspect changed paths, and explicit approval before activation.

## Sources

- [Capsule source, install, benchmark and action surface](https://github.com/hakiyaka/capsule)
- [Compaction repository and methodology](https://github.com/philipppohlmann/compaction), [safety](https://www.compaction.dev/docs/safety), [hooks](https://www.compaction.dev/docs/hooks)
- [CodeSight source and Codex MCP instructions](https://github.com/Houseofmvps/codesight)
- [lowfat source and benchmark notes](https://github.com/zdk/lowfat)
- [DSH-GOD source, standalone requirements and fork note](https://github.com/crackerghost/DSH-GOD)
- [OmniRoute source](https://github.com/cheaper-inference/OmniRoute)
- [FCC source](https://github.com/Alishahryar1/free-claude-code), [license](https://github.com/Alishahryar1/free-claude-code/blob/main/LICENSE)
- [ECC](https://github.com/affaan-m/ECC)
- [Awesome Free LLM APIs](https://github.com/open-free-llm-api/awesome-freellm-apis)
- [OpenAI Codex plugin documentation](https://developers.openai.com/plugins/build/plugins)

**Stop point:** this report is the final installation plan. No installation, config edit, provider call, commit, or push has been made. Await user approval before starting the POC.
