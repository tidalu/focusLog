# FocusLog AI Architecture

## Status

Desktop AI owns provider execution, durable AI queues, memory, Playground, and production persistence. FocusLog is fully usable with AI disabled. Android synchronizes mobile-safe AI projections and queues mobile actions through the existing signed outbox; it does not execute providers, run embedding/fact/graph workers, or store provider credentials.

## Repository assessment

| Boundary           | Current responsibility                                   | AI ownership                                                                                       |
| ------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Electron renderer  | React views and transient UI state                       | Receives masked credential state only; uses narrow IPC                                             |
| Electron main      | SQLite, DPAPI/safeStorage, sync and privileged IPC       | Owns provider requests, protected credentials, AI persistence and consent checks                   |
| Desktop SQLite     | Encrypted local source-of-truth and transactional outbox | Stores non-secret profiles, queues, memories, provenance, usage and isolated playground namespaces |
| Fastify/PostgreSQL | Device-authenticated synchronization convergence         | Synchronizes signed mobile actions and safe projections; no provider execution                     |
| Flutter/Android    | Offline mobile journal and safe AI companion views       | Reads safe AI projections, queues actions, and preserves desktop-owned execution                   |

The desktop database uses transactional numbered migrations in `apps/desktop/electron/database/migrations.ts`; migration 6 is additive and leaves logs untouched. Current source logs are `check_ins` and immutable `check_in_revisions`, with `current_revision_id` selecting the authoritative revision.

## Trust boundary

```text
React renderer -- IPC (no credentials) --> Electron main --> provider endpoint
                                         |                 |
                                         v                 v
                                  encrypted SQLite       protected credential file
                                  profiles, jobs,        DPAPI / Electron safeStorage
                                  memory, usage
```

Provider credentials never enter application settings, SQLite, sync payloads, exports, prompts, or logs. The only database state is `credential_configured`. The secret is protected by Windows DPAPI through Electron `safeStorage`, in a file named from a SHA-256 profile identifier rather than a human-readable provider name.

Custom endpoints are parsed before storage. Cloud endpoints require HTTPS; HTTP is permitted only for local provider profiles on loopback or private LAN ranges. URLs containing credentials, queries, fragments, unsupported schemes, or redirects are rejected. Requests use bounded JSON response handling, a timeout, cancellation, and `redirect: 'manual'` so credentials cannot cross origins.

## Provider platform

Provider-independent business services use `AIProviderAdapter` for health checks, model discovery, generation and embeddings. Provider protocol code stays in `apps/desktop/electron/ai/providers.ts`.

| Provider           | Discovery          | Streaming/cancel | Native structured output                               | JSON repair fallback | Embeddings         |
| ------------------ | ------------------ | ---------------- | ------------------------------------------------------ | -------------------- | ------------------ |
| Ollama             | `/api/tags`        | NDJSON / yes     | `format` schema; server/model dependent                | yes                  | `/api/embed`       |
| Gemini             | `/models`          | SSE / yes        | `responseMimeType` + `responseSchema`; model dependent | yes                  | `embedContent`     |
| OpenAI             | `/models`          | SSE / yes        | Chat Completions `json_schema`; model dependent        | yes                  | `/embeddings`      |
| Anthropic          | `/v1/models`       | SSE / yes        | No native schema call in this adapter                  | yes                  | Not offered        |
| OpenRouter         | OpenAI-compatible  | SSE / yes        | `json_schema`; routed-model dependent                  | yes                  | OpenAI-compatible  |
| LM Studio          | OpenAI-compatible  | SSE / yes        | OpenAI-style `json_schema`; server/model dependent     | yes                  | OpenAI-compatible  |
| Generic compatible | Endpoint-dependent | SSE / yes        | Probed via OpenAI-style request; not presumed          | yes                  | Endpoint-dependent |

All native structured responses are parsed and validated locally. If a compatible provider rejects a native schema request, the adapter uses one bounded prompt-enforced JSON repair attempt; authentication, cancellation, permission, privacy, and configuration failures never enter the repair loop.

Model results are cached locally for ten minutes; expired results remain visible as stale if a refresh fails. Custom model IDs remain possible because a model list may be incomplete or unsupported. Provider errors are normalized into safe, provider-independent codes.

## Privacy, consent, and kill switches

- `DISABLED`: no AI execution.
- `LOCAL`: cloud profiles are rejected; no cloud fallback exists.
- `CLOUD` and `HYBRID`: every cloud profile must receive an explicit consent record for the active mode before its first execution.
- Independent flags exist for analyses, facts, graph, embeddings and Playground. A disabled feature fails before provider execution and does not alter other feature data.

The first completed vertical slice is a queued daily reflection. The renderer validates and enqueues a versioned daily job, then the main-process worker loads only current revisions for the selected local calendar day (maximum 1,000 candidates and the configured context budget), encloses them in `untrusted_logs`, sends them through the selected provider, then writes a versioned `ai_memories` record plus source revision provenance. Original logs are never modified.

## Mobile AI boundary

Android uses generated shared AI contracts and encrypted local Drift/SQLite tables for analysis results, job projections, usage summaries, settings, memory cache, facts, graph snapshots, Q&A history, lifecycle diagnostics, notification intents, Playground projections, and diagnostic export metadata.

Mobile AI actions are durable outbox records and remain idempotent across reconnects. The paired desktop/backend authority revalidates privacy, consent, budgets, kill switches, provider configuration, queue state, deletion, and ownership before execution.

Android network clients require HTTPS except trusted localhost development endpoints. Response bodies are capped before parsing. Mobile diagnostics and exports exclude credentials, authorization headers, raw prompts, raw provider responses, lease tokens, reservation ownership tokens, and deleted data by default.

The current local Windows environment cannot certify Android release execution because Flutter is unavailable on PATH. `docs/AI_MOBILE_RELEASE_REPORT.md` records the mobile release gate status.

## Durable AI queue foundation

Migration 7 adds a device-scoped `ai_jobs` state machine and migration 8 links a persisted daily memory to its queue job. The Electron main process is the sole execution owner: `AIJobWorker` leases eligible work, renews leases during execution, observes persisted cancellation, normalizes handler errors, and accepts a completion only from the lease owner/token. The daily-analysis IPC no longer executes a provider request directly; it creates a payload with local-period boundaries, profile/model/privacy snapshots, prompt version, and a source-revision hash, then wakes the worker. The result, provenance, usage record, and job link are persisted before lease-safe success acknowledgement, allowing an acknowledgement retry to reuse an already persisted result.

Daily, weekly, monthly, quarterly, and yearly handlers are registered in the same main-process runtime. Startup recovery reconciles a valid persisted daily memory or shared analysis result to its queued, retry-wait, or leased job before reclaiming expired process-local leases. Renderer queue inspection and cancel/retry requests are validated IPC operations that expose only sanitized read models. Shutdown stops new leasing and aborts active work without marking interrupted output successful.

Queued daily generation is routed through the production provider coordinator. Immediately before each provider invocation it rereads cancellation, profile state, privacy mode, active-mode cloud consent, and persisted global/provider/chain kill switches. The fallback order may be snapshotted, but that snapshot never overrides a later restriction. A bounded fixed-point reservation is recorded before an invocation with a per-attempt immutable pricing snapshot. The snapshot captures only versioned integer pricing rules and assumptions used for that attempt; token-based settlement reuses it rather than a later catalogue, and renderer models expose only safe pricing state.

The coordinator treats cancellation and lease ownership as execution boundaries, not merely queue state. It checks both before capacity acquisition, after policy validation, after reservation, and before a fallback entry starts. A cancellation before an invocation produces no provider call; one after a reservation releases that reservation exactly once. During a call the worker abort signal is forwarded to the adapter, suppresses retries/fallback, and prevents a late response from persisting a result. A process that exits after durable result/usage persistence is reconciled to success on startup; an exit before persistence leaves no partial result and the durable retry state resumes with monotonic attempt history.

Daily analysis now uses structured result V1. Migration 12 stores its validated JSON beside the existing readable `content` summary; legacy memories remain readable with no fabricated structured value. Validation occurs before the single result/provenance/usage transaction. A single invalid queued response may receive one coordinator-routed `structured_repair` attempt; the repair repeats policy, lease, budget, and validation checks, and an invalid repair is rejected without persistence.

Phase 2D-A adds pure shared analysis contracts for all calendar levels. Analysis periods retain local and UTC boundaries, timezone, stable IDs, and a boundary-policy version. Deterministic statistics and evidence are produced in application code before prompt rendering; only selected revision-addressed evidence is enclosed as untrusted content. Daily remains compatible with historical V1/free-form records while using the shared daily boundary utility for new work.

Phase 2D-B adds hierarchical parent analysis persistence. Weekly uses exact daily summary versions; monthly uses weekly; quarterly uses monthly; yearly uses quarterly. Parent result versions are stored in `ai_analysis_results` with immutable child links in `ai_analysis_child_sources`, raw revision evidence in `ai_analysis_log_sources`, prompt/schema/generation metadata, provider/model disclosure, usage linkage, and current/superseded/stale state. Parent jobs recheck child revisions before publishing; changed dependencies create a bounded retry instead of a current stale result.

Phase 2D-D exposes the analysis system through allowlisted, context-isolated IPC. Main-process handlers validate runtime payloads, enforce owner/profile references through production services, and return safe read models only. Renderer-visible projections include schedules, queue job actions, analysis versions, current/stale result status, child/evidence provenance, provider/model, fallback use, token counts, and exact cost strings. They exclude credentials, full prompts, raw provider responses, lease tokens, internal fallback snapshots, and reservation ownership tokens.

## Playground execution boundary

Playground tables and namespaces are isolated derived data. Production analyses, schedules, memory indexing, facts, graph updates, semantic search, and retrieval Q&A exclude Playground records by construction. Playground services may read authorized production sources only as frozen read-only context snapshots; they cannot activate production namespaces or mutate production prompts.

## Phase 5-A certification boundary

Phase 5-A adds a release-certification layer rather than a new AI capability. `Phase5CertificationService` records traceability rows for providers, queue, fallback, budgets, analyses, usage, embeddings, search, facts, graph, retrieval, memory UI, Playground, evaluation, import/export, subsystem switches, adversarial protections, and performance.

The Electron main process registers security headers before renderer windows are created. The Content Security Policy permits local scripts and styles, HTTPS network traffic, and explicit loopback local-provider traffic; it blocks framing, form submissions, object embeds, and referrer leakage. This complements context isolation, disabled renderer Node integration, sandboxing, and the allowlisted preload bridge.

Security and privacy certification reads safe projections and source surfaces, then fails on credential-shaped strings, encrypted credential fields, authorization headers, queue lease tokens, reservation ownership tokens, or URL credentials. Certification diagnostics are bounded and sanitized.

## Phase 5-B reliability certification boundary

Phase 5-B certifies migration and fault behavior without introducing broad new AI capabilities. `Phase5ReliabilityService` audits migration ordering, validates current database integrity, performs disk-space preflight calculations for backup workflows, repairs derived AI corruption, and creates safe recovery messages.

The database initializer rejects future schema versions with a specific update-required message. This prevents downgrade/open-with-unknown-schema behavior from being confused with a valid current schema.

Derived repair operates only on rebuildable AI data. Incompatible vector namespaces are marked failed for rebuild, facts with missing/deleted evidence become stale, graph relations whose source facts are no longer active become unsupported, and interrupted Playground runs are marked interrupted with their queue jobs cancelled. Canonical FocusLog logs, revisions, owners, devices, settings, and sync records are not deleted by derived repair.

Phase 4-A adds persistent Playground chat without merging it into production memory. Chat sessions, messages, runs, branches, events, temporary attachments, and Playground namespace references live in dedicated `ai_playground_*` tables. The legacy prompt-run table is preserved as `ai_playground_legacy_runs`; new chat execution uses the Phase 4-A run table.

Mobile Phase M-A freezes cross-platform AI ownership before Android AI surfaces are added. Production analyses, embeddings, facts, graph updates, retrieval Q&A, and rebuilds remain desktop-owned through the durable desktop AI queue; Playground remains desktop-only. Android may consume generated, safe, owner-scoped AI contracts and later request/synchronize approved projections, but it must not call providers directly or create incompatible AI schemas. The shared contract source is `contracts/ai/mobile-ai-v1.json`, generated into TypeScript and Dart by `scripts/generate-contracts.mjs`.

Playground chat may read production sources only through frozen, privacy-checked context snapshots and may use provider profiles through the production provider coordinator. It does not write production analysis results, daily-to-yearly memory, facts, graph entities/relations, production vector chunks, schedules, or production namespace activation state. This keeps Playground experimentation from silently changing the user's long-term memory.

The chat service records a small durable AI job per provider-backed run so the existing coordinator can enforce policy, capacity, budget reservation, provider-attempt history, cancellation, and stale-operation rejection. Startup reconciliation treats unfinished Playground runs as interrupted and does not replay a provider call or fabricate successful output.

## Prompt and embedding policy

Built-in prompt templates live in `apps/desktop/prompts` with stable ID, semantic version, purpose and output schema version. Templates consistently delimit log content as untrusted data; prompts must never execute instructions contained in logs or previously derived data.

Phase 3-A stores embedding namespaces as device-scoped derived data in encrypted SQLite. Vectors are persisted as JSON with strict dimensions, metric, provider/model, chunking version, hashes, coverage, lifecycle, and event metadata. No external vector database or SQLite vector extension is required for packaging in this phase; future ANN storage can be introduced behind the namespace contract after measured retrieval workloads justify it.

Embedding chunks are deterministic and source-revision addressed. Rebuilding creates a new `building` namespace while the prior active namespace remains available. Activation requires complete compatible coverage and atomically deprecates the old namespace. Derived chunks and vectors are safely discardable; deleting a namespace never deletes canonical logs, revisions, memories, or analysis results.

## Derived-data consistency and future sync

Phase 3-C facts and graph records use dedicated versioned tables (`ai_fact_records`, `ai_fact_record_evidence`, `ai_fact_status_history`, `ai_fact_corrections`, `ai_graph_entities`, `ai_graph_aliases`, `ai_graph_relations`, `ai_graph_relation_evidence`, and `ai_graph_events`). They are deliberately additive. Contradicting evidence creates contradicted facts/relations and user corrections create explicit overlays; neither path rewrites canonical source logs or erases extraction history.

Fact/graph queue jobs run through the durable AI queue and production service handlers. The service validates source-revision evidence, rejects unsupported predicates/evidence IDs, records bounded redacted diagnostics, and marks dependent facts/relations stale or unsupported after source deletion/change. Derived-data synchronization beyond this device remains future work and must preserve these provenance and evidence invariants.

Phase 3-D introduces `MemoryRetrievalService` as the dependency-aware retrieval planner and memory staleness bridge. It records retrieval plans and plan items in `ai_retrieval_*` tables, stores structured Q&A provenance in `ai_memory_qa_answers`, and records source-change propagation in `ai_memory_staleness_events`. Q&A generation uses the production provider coordinator after retrieval; retrieved content is always untrusted evidence and cannot authorize provider, privacy, budget, switch, tool, or mutation changes.

## Verification

```powershell
pnpm --filter @focuslog/desktop typecheck
pnpm --filter @focuslog/desktop exec vitest run --config vitest.config.ts electron/ai/ai-platform.test.ts
pnpm --filter @focuslog/desktop lint
pnpm --filter @focuslog/desktop build
```

### FTS regression investigation (2026-07-21)

The reported FTS result is not caused by migration 6. The AI migration creates only new `ai_*` tables and indexes; it does not modify `check_ins`, `check_in_revisions`, the FTS virtual table, its triggers, or any source-log index. The same `check-in-search.test.ts` was executed from a detached worktree at the exact `main` commit (`d4db1ed`) and showed a comparable total test duration of approximately 1.9 seconds while its in-test 1.5 second search assertion passed. The prior 6.9-second assertion failure therefore appears to be benchmark-host contention/flakiness or an existing baseline issue, not AI schema coupling. The isolated current-branch test also passes. This remains recorded as an unrelated baseline reliability concern; it is not silently absorbed into AI work.

The complete desktop suite is also run with `pnpm --filter @focuslog/desktop test`.

## Phase 3-F memory gate

Phase 3-F closes the memory subsystem with a deterministic file-backed performance and integration harness. The harness initializes an encrypted SQLite database through production migrations, inserts 200,000 synthetic logs, persists deterministic chunks and namespace-compatible vectors, runs fact/graph extraction from supported evidence, executes retrieval planning without a generation-model call, propagates source edits/deletions, reopens the database, and writes reproducible JSON results under `artifacts/phase3/`.

The production queue runtime now registers fact and graph job handlers in the main worker composition, so Phase 3 derived-memory jobs use the durable queue instead of a test-only worker. Playground data remains isolated at the data/service boundary and is excluded from memory retrieval.

## Phase 4 Playground boundary

Playground chat, prompt/context snapshots, comparisons, inspectors, evaluation datasets, exchange records, and subsystem switches live behind dedicated tables and safe services. Renderer access is context-isolated and allowlisted. Production analyses, schedules, facts, graph records, memory namespaces, retrieval, and prompt files remain authoritative and are not mutated by Playground experiments. The Phase 4-E gate exposes read-only certification projections for adversarial redaction and isolation invariants.
