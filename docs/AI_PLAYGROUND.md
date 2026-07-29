# AI Playground

The Playground is isolated derived data. Playground prompts, prompt versions, context snapshots, imported test documents, synthetic fixtures, chat sessions, messages, runs, branches, temporary attachments, and Playground namespace references are stored separately from production analyses, schedules, memory, facts, graph records, and production embedding namespaces.

## Persistent chat

Playground chat sessions are persisted in `ai_playground_sessions`, `ai_playground_messages`, `ai_playground_runs`, `ai_playground_branches`, `ai_playground_run_events`, `ai_playground_attachments`, and `ai_playground_namespace_refs`. These tables are the explicit data boundary for Playground conversations. They may reference production provider profiles or frozen prompt/context snapshots, but they do not become production analyses, facts, graph records, schedules, or production memory chunks.

Supported chat operations include new session, rename, archive, delete, duplicate, branch from a message, edit-and-resend, regenerate, stop, retry with another model, inspect metadata, and export-ready safe session reads. Deletes mark only Playground session/message/attachment/namespace-reference rows deleted; canonical logs and production derived records are not removed by Playground deletion.

Each run stores a frozen request record with prompt/context references, provider profile, provider/model, parameters, output or partial output, latency, token usage, cost disclosure, fallback flag, error state, cancellation state, and timestamps. Provider execution goes through the production `ProviderExecutionCoordinator`, so current privacy, consent, feature switches, kill switches, provider capacity, budget reservation, cancellation, and stale-completion checks are reused instead of bypassed by the Playground.

Streaming runs persist partial output honestly. Stopping a run aborts the active provider request where the adapter supports cancellation, records the run as cancelled, and prevents late completion from writing a successful output, usage record, result linkage, or assistant message finalization. Startup reconciliation marks queued/running/streaming Playground runs as interrupted without replaying providers.

## Prompt editor

Playground prompts are versioned. A prompt definition has immutable versions for system instructions, optional developer instructions, user template, declared variables, structured-output schema, untrusted-content delimiters, and metadata.

Supported prompt operations:

- Create a Playground prompt.
- Save a new immutable version.
- Diff two versions.
- Restore an older version by creating a new version.
- Duplicate a prompt.
- Archive a prompt.
- Export a prompt in an import-ready shape.
- Copy a production prompt into Playground for review.

Copying a production prompt never edits production prompt files. Exports mark production promotion as requiring an explicit reviewed patch; there is no silent one-click production update path.

## Context snapshots

Before execution, the context builder freezes an ordered snapshot. Each item records source type, source ID and revision where applicable, canonical/derived/Playground classification, stale state, retrieval score, privacy class, estimated tokens, truncation, provider-upload implication, and safe metadata.

Supported context source categories include manual text, selected logs, date/category/project placeholders, daily-to-yearly summaries, facts, graph neighbors, semantic results, imported documents, and synthetic fixtures. Playground-created items remain Playground-only.

Snapshots are immutable. If a source log changes after a snapshot is built, the run continues to reference the frozen source revision and safe prompt inspection discloses the original snapshot rather than silently mutating historical input.

## Token budgeting

The builder enforces `maxContextTokens` and `reservedOutputTokens`, requires reserved output to leave room for context, applies per-source-type and total evidence-count limits, sorts deterministically by retrieval score with optional recency weighting, truncates oversized items, and omits excess items. Token estimates are deterministic character-based estimates suitable for preflight safety checks; provider-specific exact tokenization remains a later execution concern.

## Safe inspection

Final prompt inspection wraps retrieved/user/imported content in untrusted-content delimiters and blocks delimiter escape attempts from context content and interpolated variables. Safe projections redact API-key and authorization patterns and do not expose credentials, lease tokens, reservation ownership tokens, or raw provider responses.

## Model comparison

Playground comparison groups persist one frozen input hash and one run per selected provider/model. Each run uses the same frozen prompt/context snapshot and records provider/model, capability disclosure, output, stop reason, fallback flag, latency placeholder, token usage, and sanitized error details. Comparison metadata can store deterministic checks and user ratings, but the UI and service do not infer broad model superiority from a single response.

## Inspectors

The embedding inspector embeds user-supplied test text through the normal provider policy path, records sampled vector values, pairwise cosine similarity, usage, and a Playground namespace reference. Inspector namespaces remain in a non-active Playground-only lifecycle and are never activated as production memory namespaces.

The retrieval inspector records query normalization, keyword/summary candidates, fact/graph semantic candidates, metadata filters, exclusion reasons, final context items, and token truncation. It uses production retrieval planning read-only and does not call a generation model or mutate production memory.

## Structured-output workbench

The structured-output workbench runs provider-native structured mode or prompt JSON fallback through the production coordinator. It stores the schema, redacted prompt, raw redacted response, parsed output, validation errors, repair attempts, final accepted output, and an export-ready deterministic test case. Repair is bounded to one explicit repair call in this package.

## Evaluation and safe exchange

Playground evaluation datasets are versioned and every evaluation run freezes the dataset version plus prompt, context, comparison, provider/model, parameters, and evaluator configuration. Deterministic evaluators produce reproducible pass/fail summaries and per-case scores. Model-based judging is optional, labelled subjective, and records evaluator profile/cost separately.

Safe exchange exports Playground sessions, prompt templates, datasets, benchmark results, retrieval configurations, and structured schemas through redacted bundles. Imports validate schema, size, path safety, duplicate IDs, provider identifiers, and credential-shaped content before persistence.

Subsystem switches are independent for provider calls, scheduled analyses, embeddings, fact extraction, graph updates, retrieval Q&A, Playground execution, cloud execution, and background queue processing. Safe projections show the exact blocking switch so disabling one subsystem does not imply unrelated local functionality is unavailable.

## Phase 4-E integrated UI gate

The renderer exposes a practical AI Playground page with session sidebar, chat workspace disclosure, prompt editor/context builder disclosure, model comparison, retrieval inspector, structured-output workbench, datasets/evaluation, benchmark history, usage/cost, error/capability, import/export, and subsystem switch panels. The page uses context-isolated preload IPC for safe status/certification projections, keyboard-focusable controls, labelled regions, loading/empty/error/cancelled/interrupted/blocked/streaming/success states, responsive layout, and large-list scroll containers.

The page is an operational status/control surface for the persisted Playground services from Phases 4-A through 4-D. It uses the production safe projections and does not expose raw prompts, provider responses, credentials, leases, reservation owners, or production namespace activation.

## Mobile Playground decision

Mobile Phase M-G keeps Playground execution as a desktop-only power-user tool. Android may display synchronized safe session, run, evaluation, diagnostic, and export-preview metadata, but it cannot run providers, edit prompts, stream responses, compare models, mutate datasets, or promote Playground output into production memory.

Mobile Playground projections are stored separately from production analyses, memory, facts, graph, search, schedules, and Q&A. The Android UI must show a desktop-required state instead of claiming mobile parity.
