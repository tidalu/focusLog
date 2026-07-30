# AI Memory

## Mobile memory projections

Android displays synchronized safe projections for namespace status, semantic/hybrid search, facts, graph nodes, and evidence-backed Q&A. Mobile actions queue authoritative requests for Q&A, fact correction/rejection/re-extraction, graph merge/split/remove/rebuild, and memory pause/rebuild/delete. Mobile does not create fake vectors, facts, graph records, or embeddings locally.

Deleted, privacy-blocked, unavailable, cross-profile, and Playground-only memory payloads are excluded from mobile production memory views.

AI memories are versioned derived records; they never replace check-ins. A daily reflection stores its prompt version, schema version, provider profile, source-revision watermark and explicit `ai_memory_sources` links.

Phase 3-C adds evidence-backed fact and graph memory. Automated facts require validated source-revision evidence; graph relations carry fact/source evidence; user corrections are explicit overlays rather than silent rewrites. Source deletion or revision changes mark dependent facts stale and graph relations unsupported while canonical logs remain authoritative.

Phase 3-A adds production embedding namespace lifecycle tables and services. Embedding chunks and vectors are derived from source revisions, daily memories, or parent analysis results; their source evidence must be preserved, and deleting or rebuilding an embedding namespace must not delete source logs.

Phase 3-D adds targeted memory staleness propagation and retrieval planning. Source edits/deletions mark affected daily summaries, parent analyses, vector chunks/records, facts, and graph relations stale or unsupported while recording a bounded recompute order. Retrieval plans prefer facts/graph and summaries before raw logs and disclose stale or contradictory evidence.

Phase 3-F adds the deterministic 200,000-log memory performance harness. Namespaces carry chunking version, provider/model, dimensions, metric, coverage, and lifecycle state so large rebuilds can be measured without mixing incompatible vectors.

Phase 5-B certifies derived-memory corruption recovery. `Phase5ReliabilityService` can inspect active/building embedding namespaces for vector dimension or metric mismatches, mark incompatible namespaces failed, mark facts with missing or deleted evidence stale, and mark graph relations whose supporting facts are no longer active as unsupported. These repairs are bounded, diagnostic-only by default, and never delete canonical FocusLog logs.

If derived tables are damaged, rebuild embeddings, facts, or graph data from the canonical source logs and analysis versions. Recovery diagnostics record only safe references, prior/resulting states, timestamps, and normalized reasons; they exclude credentials, raw prompts, raw provider responses, lease tokens, reservation ownership tokens, and private content.

## Phase 3-E memory UI and controls

The AI Memory section is a context-isolated renderer surface backed by `AIMemoryControlService` in Electron main. It exposes only safe projections: namespace identity, provider/model IDs, dimensions, coverage, storage estimate, indexing progress, stale counts, fact/graph counts, diagnostics, and subsystem state. It never returns raw vectors, hidden prompts, credentials, lease tokens, reservation ownership tokens, or raw provider responses.

The UI includes:

- Overview: active namespace, chunk coverage, pending/failed indexing, fact count, graph node/edge count, stale memory count, diagnostics, and subsystem switches.
- Search: semantic, hybrid, and keyword retrieval results with score, excerpt, source type, stale state, namespace/model disclosure, retrieval explanation, and an open-source reference only for authorized canonical log sources.
- Facts: status/confidence/evidence/provider disclosure, rejection, user-curated correction overlays, and re-extraction requests through the normal derived-memory queue policy.
- Graph: searchable entities, relation evidence, split workflow, and rebuild controls using inspectable data rather than requiring an animated graph.
- Controls: pause switches for embeddings, facts, graph, and retrieval; active namespace rebuild; safe export preparation; and confirmed derived-memory deletion that preserves canonical logs.

Destructive memory actions require the explicit confirmation phrase `DELETE DERIVED MEMORY` and operate only on derived tables. Canonical FocusLog entries remain authoritative and are deleted only through the canonical deletion flows.
