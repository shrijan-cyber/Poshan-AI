# LLM app patterns applicable to PoshanAI

**Reviewed:** 2026-11-02
**Research source:** [awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps), a community example catalog (root license Apache-2.0; check each sample and dependency before reuse).

## Existing implementation boundary

Current source describes a JavaScript MERN system. Backend AI calls use the existing OmniRoute-compatible chat-completions path (Gemini model setting); IFCT food retrieval, recipe choice and authoritative nutrition math are deterministic backend operations. Local report OCR uses `pdfjs-dist` and `tesseract.js`. Redis/BullMQ supports asynchronous jobs with local synchronous fallback. There is no active Python AI/OCR service.

Accordingly, these examples are patterns to adapt in existing Node/Express code. Adding Python, LangChain, a second provider, or an agent runtime is not justified by the examples alone.

## Opportunities

| Pattern/example area | Proposed PoshanAI use | Priority / effort | Model/API cost | Risks / constraints |
|---|---|---|---|---|
| Typed output and validation (the catalog includes typed RAG examples) | Keep AI response narrowly typed (instructions/swaps); validate against the existing Joi contract, whitelist, and selected recipe IDs before save. Reject extra or unknown food references. | **P1**, low | No additional calls; same token volume as existing bounded call. | Validate backend schema and response, not just prompt. Review example dependencies/licenses if code is reused. |
| Grounded retrieval and abstention | If no catalog evidence exists, return an explicit unavailable/refusal state instead of inventing a food, nutrient, or source. Carry IFCT record references in server data, never ask the model to resolve authoritative nutrition. | **P1**, low-medium | No new call needed. | Must preserve missing values as null and avoid converting retrieval failure into fabricated data. |
| Evaluation and hallucination-control tests | Build deterministic fixture cases for household eligibility, dietary restrictions, invalid foods, unsupported claims, prompt injection, and null nutrition. Use fake model responses for unit tests. | **P1**, low-medium | Zero model cost for mock suite; optional eval runs incur current gateway tokens. | Golden fixtures must be source-reviewed; synthetic medical cases must not be presented as clinical truth. |
| Retrieval diagnostic metrics | Measure catalog retrieval hit/miss, selected record identity and invalid model-output rejection; keep personal health details out of logs. | **P1**, medium | Local compute; no additional token cost. | Do not log raw reports, lab values, or full prompts. Metrics need privacy review and low-cardinality labels. |
| PDF analysis demos | Use only to identify failure cases in existing local OCR and parser. | **P2**, medium | Avoids cloud OCR/token fee and data transfer. | Existing local OCR is already implemented; do not upload medical reports to demo services or add Python without measured need. |
| Tool calling / autonomous agents | No current bounded use: plan composer, food catalog, and persistence already have deterministic ownership. | **P2 — defer**, high | Likely increases model calls and unpredictable tokens. | Could expand medical data exposure, authorization surface and write scope. Do not expose unrestricted profile/catalog tools. |
| Memory examples | No cross-session health memory needed for current product path; profile is stored in application DB with auth controls. | **P2 — defer**, medium-high | Storage plus model context cost. | Duplicates profile data and raises retention, consent, deletion, and privacy questions. |

## Recommended implementation sequence

1. Add offline tests around the existing `aiService.js` schema and fallback path; keep provider calls mocked.
2. Add a small golden evaluation set to the current JavaScript test suite for catalog grounding, restrictions, and “no evidence, no claim.”
3. Instrument aggregate success/failure/validation counts only; prohibit raw prompt and health content in logs.
4. Revisit external retrieval, agents, or memory only after a measured gap cannot be handled by existing deterministic architecture.

## Cost and data policy

Do not estimate gateway pricing from model names: actual cost depends on configured OmniRoute provider/model, token rates, and account terms, which were not available from repository source. The recommendations above avoid new calls. Existing bounded generation calls retain their current cost. Never send raw OCR, report identifiers, lab values, or personal diet descriptions to external AI unless a separate privacy review explicitly approves the payload and purpose. Source-specific details and derived nutrition remain backend-owned.

## Reference

- [awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps)
- [Typed agentic RAG example directory](https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/agentic_rag)
- [Apache License 2.0](https://github.com/Shubhamsaboo/awesome-llm-apps/blob/main/LICENSE)
