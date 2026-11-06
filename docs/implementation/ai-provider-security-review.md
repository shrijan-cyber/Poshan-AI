# AI provider POC security and privacy review

**Scope:** source review of current backend adapter and configuration; no live network/provider use. This is not a production security certification.

| Control | Evidence / current behavior | Residual risk / action |
|---|---|---|
| Credential boundary | Adapter attaches bearer key server-side; values are read by backend environment config. No frontend provider calls in this POC. | Keep `OMNIROUTE_*_API_KEY` out of Vite config, logs, client responses and screenshots. Rotate any key accidentally exposed. |
| Payload minimization | Recipe instruction path sends only chosen recipe and allowed IFCT ingredients/portion descriptions. | Food parser remains a separate existing route and can send diary text plus catalog externally; do not assume recipe POC protections cover it. Review/approve that data flow separately. |
| Sensitive data | POC path does not call report/OCR/lifestyle services or include profile/health fields. | Do not route any lab values, symptoms, report text, personal identifier or raw food diary to OmniRoute/experimental models. |
| Logs | Adapter logs provider label, elapsed milliseconds, attempt, optional token count and optional gateway cost header; not prompt or response. | Metadata can still reveal activity; keep retention/access controlled. Do not add request bodies to error logs. |
| Output validation | JSON parsing, Joi schema, exact meal coverage/IDs and allowlisted ingredient term checks precede use. | A text-level food detector is not a complete safety proof; static fallback remains safest path. Test adversarial paraphrases before broader use. |
| Reliability | Request timeout and bounded retries; no cross-provider failover; local static fallback. | Retry can repeat a request to same provider and incur cost. Gateway/provider availability untested live. |
| Gateway exposure | Env examples support local loopback URL. | Require auth; bind loopback; firewall any remote listener; review OmniRoute admin, key storage, upstream routing, logs and retention. Self-hosting gateway does not make upstream processing local. |
| Data terms and licensing | OmniRoute repository MIT. Upstream terms/model license and retention are separate. Google's free API tier says submitted content may improve products; paid tier says it is not used for that purpose. FCC is AGPL-3.0-only. | Legal/privacy review for chosen upstream and commercial use. Do not treat free API as private. [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [OmniRoute license](https://github.com/cheaper-inference/OmniRoute/blob/main/LICENSE), [FCC license](https://github.com/Alishahryar1/free-claude-code/blob/main/LICENSE) |

## Release gate

Before production use: choose a non-retired model; verify provider terms, region, retention and training behavior; confirm backend-only secret injection and gateway auth; add health monitoring without prompt content; run mocked and synthetic end-to-end tests; document incident/key rotation procedure; have privacy/security owners approve. No sensitive workflow is approved by this POC.
