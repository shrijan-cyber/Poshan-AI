# PoshanAI report-analysis integration review

**Reviewed:** 2026-11-02
**Decision:** No source-code changes recommended in this sprint. The requested AI report-analysis workflow does not currently exist as an LLM feature; the implementation is a local OCR and deterministic parser. Adding an LLM to this health-data path would increase disclosure risk without a demonstrated requirement.

## Existing flow, verified in source

1. Authenticated upload is routed through `src/routes/reportRoutes.js`, upload validation/rate limiting and `src/controllers/reportController.js`.
2. The backend stores an owned `Report` with `ocrStatus: pending`, then queues it through `src/jobs/queue.js`; development can use the synchronous fallback.
3. `src/services/ocrService.js` extracts PDF/image text locally using `pdfjs-dist` and `tesseract.js`. `src/services/ocrProcessor.js` passes that text to deterministic `src/services/reportParser.js` and persists normalized values.
4. `src/models/Report.js` stores `rawOcrText` with `mongoose-encryption`; list and detail handlers exclude it, and `publicReport()` returns only status, dates, and extracted values.
5. `PATCH /api/reports/:id/review` requires authentication and ownership. The user confirms or corrects the parsed values; server code recalculates normalized value/unit and flags corrected values before save.
6. Report-based meal generation in `src/services/aiService.js` verifies owner, completed OCR, and confirmed/corrected review. Meal selection and nutrition are deterministic backend operations. The only OmniRoute call in that path generates bounded cooking instructions for already selected recipes; it is Joi-validated, food references are checked, and static directions are used on failure. The call receives no raw OCR or report biomarker values.

Evidence files: `src/controllers/reportController.js`, `src/routes/reportRoutes.js`, `src/models/Report.js`, `src/services/ocrService.js`, `src/services/ocrProcessor.js`, `src/services/reportParser.js`, `src/services/aiService.js`, `src/rag/promptBuilder.js`, and existing tests `tests/ocrService.test.js`, `tests/report.test.js`, `tests/reportModel.test.js`, `tests/mealplan.test.js`, and `tests/security.test.js`.

## Fit of Awesome LLM Apps examples

The source repository is a mixed catalog and its examples use differing stacks/licenses; its root README identifies Apache-2.0 for the catalog, but any sample code or dependencies still need review. The most relevant examples inspected were:

- [Typed RAG with Pydantic AI](https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/agentic_typed_rag_pydanticai): schema-typed output, explicit source/chunk IDs, exact quote verification, low-retrieval refusal, and provider-free fake-model tests. The example itself requires Python/Streamlit/Pydantic AI; adapt the invariants, not the framework.
- [Knowledge Graph RAG with citations](https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/knowledge_graph_rag_citations): provenance from extracted facts to document/chunk, then verifiable citations. Its Neo4j/Python/Streamlit stack is unnecessary for PoshanAI’s one-pass biomarker parser.
- [RAG Failure Diagnostics Clinic](https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/rag_failure_diagnostics_clinic): classify retrieval failures separately from generation failures. This is useful as an engineering triage pattern, not as a runtime clinical analyzer; its demo stores bug text and sends it to an LLM, so do not feed it user reports or health logs.

## Gaps and risks

| Finding | Evidence / impact | Safe response |
|---|---|---|
| No AI interpretation step | OCR values are parsed deterministically; OmniRoute receives selected recipe content, not the report. | Do not introduce an LLM without a specific user-facing need and privacy/clinical review. |
| No page/section/span provenance in parsed biomarkers | OCR result is flattened to `rawText`; parser returns nutrient/value/unit/reference range/flag without source offsets or page index. Users cannot navigate a result back to its report location. | Future enhancement: preserve OCR page boundaries and exact matched spans as extraction provenance, with regression fixtures and no model call. |
| Uncertainty is represented coarsely | The parser derives `flag` from an extracted reference range; missing or unparseable range becomes `unknown`. It does not expose extraction confidence or ambiguity/conflict state. | Future enhancement: explicit `unavailable`, `ambiguous`, and `conflicting` parse outcomes; require user review before any report-derived use. Never guess a value. |
| No duplicate/conflict history | Parser keeps only the first recognized value for a nutrient; subsequent occurrences are discarded. | Preserve all candidates with offsets and ask for review when values conflict; do not silently pick an AI answer. |
| Health-sensitive content | Raw OCR is encrypted, but processing and future analytics must continue to avoid logging it or forwarding it to OmniRoute. | Add privacy assertions and test logs/payloads; retain owner filtering and authenticated route checks. |
| Current report-based meal plan uses reviewed low flags | `generateMealPlan` derives target names/supplement guidance from confirmed/corrected report values. It does not ask AI to diagnose, but the wording must remain educational and clinician-directed. | Preserve existing medical disclaimers and clinician review boundaries; never infer a condition or prescribe from the parser. |

These are enhancement opportunities rather than evidence that current report values are AI-generated. Do not state that an AI report analyzer has been implemented.

## Recommended architecture if report interpretation is later approved

Keep source facts and any explanation in distinct fields. A future output shape should refer to stored, reviewed biomarkers by stable IDs rather than repeat a free-form lab value:

```json
{
  "reportId": "owned report identifier",
  "reviewStatus": "confirmed",
  "extractedFacts": [
    {
      "factId": "stable persisted identifier",
      "nutrient": "persisted nutrient identifier",
      "value": null,
      "unit": null,
      "referenceRange": null,
      "flag": "unknown",
      "provenance": {
        "page": null,
        "textSpan": null,
        "method": "local_ocr_parser"
      }
    }
  ],
  "interpretation": {
    "status": "not_generated",
    "text": null,
    "sourceFactIds": [],
    "disclaimer": "Educational information only; discuss results with a qualified healthcare professional."
  }
}
```

This is a contract sketch, not a claim about current API fields. Values and provenance must be server-owned. Any future model output should use a strict server schema, cite only supplied fact IDs, be rejected on unknown references, and never overwrite extracted or user-reviewed facts. Prefer deterministic educational templates and qualified clinician review over external LLM interpretation. If an external model is nevertheless approved, send the minimum necessary abstracted context only after a privacy/legal review; never send raw OCR, identifiers, or full reports by default.

## Test and verification plan for a future change

- Fixture tests for each supported biomarker, unit, reference range, Hindi label and unknown flag.
- Tests retaining multiple occurrences and detecting conflicting values, with report offsets/page attribution when supported by OCR output.
- Authorization tests for another user’s report; authenticated upload/review/get/delete tests remain intact.
- Assertions that raw OCR is absent from API responses, application logs and AI request bodies.
- Model-output tests for valid schema, invalid schema, unsupported `factId`, fabricated quote, low-evidence refusal, timeout and provider error.
- Confirm corrected/reviewed user values are immutable to AI output.
- Keep fixtures deterministic and mocked; no real health data or provider tokens in routine tests.

## Modified source files

None. The available prompt permits a documentation-only plan if source/tests do not support a safe AI change. Current source confirms that adding report interpretation would be a new clinical/privacy feature, not a hardening of an existing AI analyzer. No dependencies, services, APIs, schemas, or nutrition records were changed.

## References

- [Awesome LLM Apps — repository and license](https://github.com/Shubhamsaboo/awesome-llm-apps)
- [Typed RAG example](https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/agentic_typed_rag_pydanticai)
- [Knowledge Graph RAG with citations](https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/knowledge_graph_rag_citations)
- [RAG failure diagnostics](https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/rag_failure_diagnostics_clinic)
