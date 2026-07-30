# AI Retrieval

## Mobile retrieval and Q&A

Mobile semantic/hybrid search uses synchronized safe cache records and exposes retrieval mode, score, namespace, model, metadata, stale state, and source identity. Mobile Q&A submits durable `ai.retrieval_qa.request` operations to the authoritative retrieval service. Cached answers disclose provider/model, fallback, uncertainty, stale sources, and evidence references.

Mobile source text remains untrusted and cannot authorize app actions, provider changes, privacy changes, deletion, or tool use.

Phase 3-D adds deterministic hierarchical memory retrieval.

## Staleness propagation

`MemoryRetrievalService.propagateSourceChange` handles source edit/delete events for a check-in revision. It marks affected daily memories, parent analysis results, embedding chunks/vectors, facts, and graph relations stale or unsupported. The service records a bounded `ai_memory_staleness_events` diagnostic with affected counts and dependency-aware recompute order.

Staleness is targeted. Unrelated owners, periods, facts, graph entities, and vector chunks are not touched.

## Retrieval planner

The planner builds a smallest-sufficient context in deterministic order:

1. Facts and corrections.
2. Graph neighbors/relations.
3. Broad daily-to-yearly summaries.
4. Focused raw excerpts only when evidence is explicitly required or the query is focused.

Plans use query type, time range, entities, privacy mode, provider/model hints, token budget, cost budget, stale state, and exclusion reasons. Deleted logs, Playground data, cross-owner data, and privacy-blocked provider escalation are excluded.

## Evidence-backed Q&A

Memory Q&A uses a persisted retrieval plan and invokes generation through the production `ProviderExecutionCoordinator`. Answers must return structured JSON with citations that reference retrieved plan items. If stale, unsupported, superseded, contradicted, or weak evidence is present, the answer must disclose it before acceptance.

## Prompt-injection resistance

Retrieved text is rendered inside `<untrusted_memory>` blocks. Source text cannot change provider, privacy, tool, budget, kill-switch, or application-action policy. Closing delimiter attempts are replaced in safe prompt inspection, and credential-like strings are redacted.

## AI Memory search UI

The AI Memory search screen uses the production retrieval planner and does not call a generation model. It supports semantic, hybrid, and keyword modes with source-type, date, and entity filters at the service boundary. Results disclose retrieval mode, namespace/model, score, source type, stale state, classification, token estimate, redacted excerpt, and deterministic explanation/exclusion reasons.

Deleted sources, Playground data, wrong-owner records, privacy-blocked content, and unavailable namespaces are excluded before results reach the renderer. Canonical source opening is represented with safe check-in/revision references only when the source is still authorized.

## Phase 3-F retrieval performance

The 200,000-log harness measures broad and focused retrieval plans after namespace, chunk, vector, fact, graph, and staleness data have been populated. The semantic/hybrid search path records plan items, stale disclosure, and exclusion reasons without invoking a text-generation provider. The latest recorded full run completed semantic/hybrid/filtered query planning in 5.76 ms and saved the exact query-plan summary in `artifacts/phase3/phase3-200k-benchmark.json`.

## Playground retrieval inspector

The Phase 4-C retrieval inspector exposes retrieval planning stages without mutating production memory. It records query normalization, keyword and summary candidates, fact and graph semantic candidates, metadata filters, deterministic hybrid scoring inputs, deduplication/exclusion reasons, final context, and token truncation. Production sources remain read-only and privacy-controlled; Playground namespaces remain excluded from production retrieval.
