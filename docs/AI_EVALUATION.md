# AI Evaluation

Phase 4-C adds Playground comparison and deterministic inspection metadata.

## Comparison runs

Model comparisons store one comparison group plus individual provider/model runs. Every run receives the identical frozen prompt/context input and equivalent supported parameters. Persisted side-by-side disclosure includes provider/model, capability snapshot, output, stop reason, fallback flag, token usage, cost placeholder, status, and sanitized error code/message.

Comparison metadata distinguishes deterministic checks, user ratings, and optional future model-based judgments. FocusLog does not claim broad model superiority from one response.

## Inspectors and workbench exports

Embedding inspections record sampled vectors and pairwise similarity for Playground-only namespaces. Retrieval inspections record deterministic candidate stages, exclusion reasons, final context, and truncation without invoking a generation model. Structured-output workbench exports include the redacted prompt, schema, accepted status, and deterministic validation checks, but never credentials or raw provider secrets.

## Phase 4-D datasets and reproducible runs

Evaluation datasets are versioned in `ai_playground_eval_datasets`, `ai_playground_eval_dataset_versions`, and `ai_playground_eval_cases`. Each run freezes the dataset version, prompt/context references, comparison group, provider/model, evaluator profile, app/schema versions, and evaluator configuration.

Deterministic evaluators cover schema validity, required fields, evidence/citation validity, unsupported citations, output length, keyword accuracy, classification accuracy, latency, cost, tokens, retry count, fallback expectation, and reference-answer containment. Optional model-based evaluation is stored only as a clearly labelled subjective evaluator with evaluator profile, label, and cost disclosure; it does not replace deterministic checks.

Reruns create a new evaluation run against the same frozen dataset/configuration. Historical comparison reports run-to-run deltas without mutating the original runs.

## Phase 4-E benchmark and evaluation UI gate

The integrated Playground page surfaces dataset counts, evaluation history, benchmark records, deterministic pass/fail summaries, optional subjective evaluator labels, and usage/cost disclosure through safe projections. Evaluation records remain immutable; reruns and comparisons add new rows rather than rewriting prior results.

## Nonblocking future work

Advanced statistical model comparison, full-vector visualization, and learned retrieval tuning remain in the Phase 4 hardening backlog.

## Mobile evaluation summaries

Android displays synchronized Playground evaluation summaries only. It shows frozen dataset/prompt/context/provider/evaluator version metadata, deterministic score summaries, optional subjective labels, exact cost strings, and status. Android does not run evaluators or claim model superiority from one comparison.
