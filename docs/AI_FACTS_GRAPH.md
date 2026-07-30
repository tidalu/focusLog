# AI Facts and Knowledge Graph

## Mobile facts and graph

Android shows evidence-backed fact and graph projections only. Facts without synchronized evidence are filtered out. Fact reject, correction, re-extraction, graph merge, split, remove, and rebuild actions are queued through durable sync and preserve authoritative extraction/provenance history.

Mobile graph rendering favors accurate inspectable node, edge, confidence, status, neighbor, and evidence data over animated visualization.

Facts and graph records are derived data. Canonical check-ins and immutable revisions remain authoritative.

## Fact records

Phase 3-C adds versioned fact records in `ai_fact_records` with:

- owner isolation;
- subject, predicate, object value, normalized value, and fact type;
- lifecycle status: proposed, active, reinforced, superseded, contradicted, stale, rejected, or corrected;
- confidence and optional temporal validity;
- prompt/schema/provider/model provenance;
- origin metadata for automated extraction, imports, and user overlays;
- status history and explicit correction records.

Automated facts require at least one valid source revision in `ai_fact_record_evidence`. Deleted, unavailable, cross-owner, or unsupported evidence IDs are rejected. Evidence excerpts are redacted in safe projections and diagnostics.

## Extraction and reconciliation

Structured extraction candidates are validated before persistence. Unsupported predicates, unsupported fact types, missing evidence, invalid evidence IDs, and unqualified temporal facts are rejected.

Reconciliation is additive:

- matching evidence reinforces the strongest supported fact;
- conflicting object values create contradicted records that can coexist;
- supersession and contradiction are recorded in status history;
- user rejection and correction create explicit records rather than rewriting extraction history.

## Knowledge graph

Graph entities, aliases, relations, relation evidence, and graph events live in Phase 3-C tables. Relations are evidence-backed and can be rebuilt from active facts.

Entity resolution is conservative. Obvious high-confidence aliases can be stored, but similar names alone do not merge entities. User split and correction flows preserve provenance. Cyclic alias relations are rejected.

## Queue jobs

The durable AI queue recognizes:

- `fact_extract_source`
- `fact_reconcile_subject`
- `fact_mark_stale`
- `fact_rebuild_range`
- `graph_update_from_fact`
- `graph_resolve_entity`
- `graph_rebuild_subject`
- `graph_remove_unsupported_edges`

Handlers run through `FactGraphService.queueHandlers()` and preserve queue leasing, cancellation, idempotency, restart safety, and sanitized errors.

## Deletion and staleness

When a source revision is deleted or changed, `markSourceStale` marks dependent facts stale and graph relations unsupported. Deleted evidence is never presented as active support.

## Memory UI inspection and correction

Phase 3-E provides fact and graph inspection through validated main-process IPC. Fact projections include subject, predicate, value, status, confidence, evidence count, origin, validity window, provider profile ID, and model ID. Automated extractions are visually distinguished from user-curated overlays.

Fact rejection and correction use the production `FactGraphService`; corrections create explicit user-overlay records and preserve extraction history instead of silently rewriting automated records. Graph controls expose searchable nodes, relation evidence, and entity split workflows. Derived facts/graph can be deleted only after explicit confirmation and the deletion does not touch canonical logs.
