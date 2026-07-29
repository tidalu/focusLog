# FocusLog Mobile AI Memory

Android memory features are synchronized safe projections of the production semantic memory system. Mobile does not create embeddings, extract facts, update graph records, or run retrieval Q&A locally unless a future architecture explicitly selects mobile execution.

## Semantic and hybrid search

Mobile search reads `ai.search.cache` records from the encrypted `ai_mobile_memory_cache` table. The repository supports query text, mode, date range, category, project, source type, result limit, and relevance threshold filters. Results disclose source ID, source type, excerpt, score, timestamp, namespace, model, mode, metadata, and stale state.

Deleted, unavailable, privacy-blocked, cross-profile, and Playground-only payloads are excluded before display. Cached results are clearly synchronized/offline projections; Q&A or new semantic indexing requires the authoritative executor.

## Facts

Mobile fact views require evidence. Unsupported fact projections without source evidence are filtered out. Displayed facts include subject, predicate, value, status, confidence, validity, provider/model disclosure, evidence count, and stale/superseded/contradicted states where synchronized.

Fact reject, correction, and re-extraction requests are durable `ai.fact.*` outbox operations. Corrections are curated overlays or authoritative requests; mobile never rewrites automated extraction history in place.

## Knowledge graph

Mobile graph views show searchable node records, type, status, confidence, neighbor relationships, and evidence counts. Merge, split, remove, and rebuild actions are queued as `ai.graph.*` requests and resolved by the authoritative graph service.

## Evidence-backed Q&A

Mobile Q&A submits questions through `ai.retrieval_qa.request`. Cached answers show answer text, provider/model, fallback disclosure, uncertainty, stale-source disclosure, and evidence references. Retrieved/source text is treated as untrusted data and cannot change privacy, provider, deletion, or tool behavior.

## Memory controls

Mobile displays active namespace, coverage, pending/failed jobs, stale count, embedding provider/model, storage estimate, and paused state when synchronized. Pause, resume, rebuild, and delete requests enter the durable outbox. Heavy work remains desktop/backend-owned.
