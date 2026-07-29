# FocusLog AI Mobile Data Layer

Mobile AI storage is a safe, owner-scoped projection of desktop-owned AI work. Android can read synchronized AI results, queue user intent while offline, and apply deletion/tombstone updates, but it does not execute providers or mutate canonical desktop AI state directly.

## Storage

Mobile schema version 6 adds these derived AI tables:

- `ai_mobile_analysis_results` for daily-to-yearly result summaries, structured JSON, provenance, provider/model disclosure, exact micro-unit cost strings, and stale/deleted state.
- `ai_mobile_job_projections` for renderer-safe queue status without leases, ownership tokens, reservations, prompts, or raw provider responses.
- `ai_mobile_usage_summaries` for exact reserved/settled micro-unit strings by period and purpose.
- `ai_mobile_settings` for mobile-safe AI setting snapshots.
- `ai_mobile_memory_cache` for bounded semantic search, fact, graph, and Q&A projections. It stores source IDs/revisions and stale state, not raw vectors or credentials.
- `ai_mobile_outbox_actions` for durable offline AI user actions.
- `ai_mobile_inbox_cursors` for AI delta feeds when the backend exposes separate cursors.
- `ai_mobile_tombstones` for deleted AI-derived records and source invalidation.

Canonical logs remain in the existing mobile tables. AI tables are derived and can be rebuilt from desktop/backend synchronization without deleting canonical check-ins.

## Offline actions

The outbox supports manual analysis requests, cancellation, retry, settings updates, fact corrections, and deletion requests. Each action has a stable idempotency key and a sync operation ID that fits the shared 26-character sync contract.

Duplicate mobile requests return the existing operation instead of creating a second job. The desktop queue and backend remain responsible for final policy, privacy, budget, provider, and provenance enforcement.

## Exact money and safe projection

Amounts are stored as integer micro-unit strings, following `aiMobileMicroUnitPattern`. Mobile projections reject secret-bearing fields such as API keys, authorization headers, raw prompts, raw provider responses, lease tokens, and reservation ownership tokens.
