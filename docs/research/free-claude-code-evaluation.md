# Free Claude Code (FCC) evaluation for Windows Codex and PoshanAI

**Review date:** 5 November 2026. **Disposition:** research only; not installed or run.

## Findings

FCC is a Python local proxy/harness with model/provider switching and launchers. Its README advertises Windows, Codex, VS Code, multiple providers, retries/fallback and optional RTK/Headroom. These are repository claims, not local Windows compatibility or model-quality evidence. Its license is AGPL-3.0-only; evaluate network-service source obligations with counsel before redistribution or embedding. [README](https://github.com/Alishahryar1/free-claude-code), [LICENSE](https://github.com/Alishahryar1/free-claude-code/blob/main/LICENSE)

The PowerShell installer reviewed is large and resolves a release before fetching a version-specific installer. It can install/reuse several coding agents, alter PATH and create shortcuts; the optional RTK/Headroom path configures additional tools. Treat remote installer execution as supply-chain-sensitive. Do not run the mutable `main` installer. [Installer source](https://github.com/Alishahryar1/free-claude-code/blob/main/scripts/install.ps1)

FCC’s Codex launcher appears to provide per-invocation configuration overrides; this does not prove all installer/Admin UI flows preserve every existing `%USERPROFILE%\.codex` setting. Existing Codex can coexist only after isolated profile testing. No global configuration was touched in this audit.

The reviewed credential persistence path uses local dotenv-style configuration; secret masking in UI/runtime types is not encryption at rest. The public review did not establish the default network bind/auth posture for every run mode, a no-telemetry guarantee, or independent security audit. Providers receive prompts and repository context; any “free” provider is a third party unless inference is demonstrably local. Do not send PoshanAI code, credentials, reports or health data to an unapproved provider.

## Cost and quality

FCC does not itself make inference free. Free quotas change, throttle and may prohibit certain use. Fallback/retries can incur multiple upstream calls and increase latency. There is no measured benchmark for coding quality, context retention, tool calling, latency or cost in the present Codex workflow. RTK/Headroom claims require a separate token/output correctness evaluation.

| Workflow | Cost/quality evidence | Recommendation |
|---|---|---|
| Current Codex | Existing user workflow; no measured baseline supplied in this repo. | Keep as baseline. |
| FCC + free provider | Quota/terms volatile; no local test, quality or privacy approval. | Isolated synthetic test only. |
| FCC + paid provider | Provider costs/terms still apply; no comparative benchmark. | No adoption decision without test. |
| PoshanAI Gemini/OmniRoute | App integration only; POC tests mocked. Existing default model is shut down. | Independently fix model config; keep recipe-only experimental boundary. |

## Recommendation and safe test

**Test further only if desired, in Windows Sandbox/VM or a separate Windows account and disposable Codex profile.** Pin and review release scripts and hashes, back up profile config, disable RTK/Headroom/browser sessions/remote access first, bind proxy to loopback with auth, use a synthetic repository and approved provider, inspect changed settings after uninstall. Do not install FCC on the active PoshanAI developer profile at this stage.

No FCC code was installed into PoshanAI, no global Codex configuration was changed, and no provider call was made.
