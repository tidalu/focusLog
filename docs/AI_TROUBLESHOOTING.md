# AI Troubleshooting

## A daily-analysis job is stuck in `leased`

Closing FocusLog while a provider is generating output stops the local worker immediately. The incomplete response is not saved. On the next start, a non-expired lease is left untouched and an expired lease is retried (or dead-lettered after its attempt limit). If an analysis result was saved before the app closed, startup reconciliation marks the linked job successful without calling the provider again.

## A job is waiting in `retry_wait` or is dead-lettered

`retry_wait` respects its stored next-run timestamp, including across restarts. A dead-lettered daily job can be retried from its status control; the original failure remains available as a separate queue record. Check the provider profile, privacy mode, cloud consent, and selected model before retrying.

Weekly, monthly, quarterly, and yearly jobs can also enter `retry_wait` while waiting for required child summaries. FocusLog enqueues the oldest missing child first and does not publish the parent until the exact child versions exist. If a child changes while a parent provider call is running, the parent response is discarded and retried against the new dependency set.

## A scheduled analysis did not run

Schedules enqueue only closed periods. Check the schedule enabled flag, schedule kill switch, timezone, local run time, provider profile, selected model, privacy mode, consent, fallback chain, and budget cap. If FocusLog was closed at the run time, startup catch-up queues missed periods up to the schedule catch-up limit and records a sanitized diagnostic when more periods remain.

## Cancellation remains pending

A leased job changes to cancellation-pending until its active provider request observes the abort signal. Closing the app aborts local work; do not expect a partial response to appear as a daily reflection. Repeating cancellation is safe once a job is already cancelled. If a provider reports billable partial usage while stopping, FocusLog records a sanitized cancellation and settles only that reported integer amount; the unused reservation is made available. This neither retries the provider nor opens its circuit breaker. A provider that reports no usage follows the normal reservation-release path, and a late response cannot create a reflection or alter the settled cancellation.

If a restart happens after a retryable attempt, the stored retry time is authoritative: FocusLog does not call the provider early or replay the completed attempt. If it happens after result persistence but before queue acknowledgement, the result is linked back to the job during startup and is not generated again. If it happens before persistence, the expired lease is recovered and the normal retry path continues; there is no partial reflection or usage record to clean up.

## Daily structured output was rejected

New daily results require schema version 1, the queued period, bounded fields, and evidence IDs from the supplied check-ins. Invalid provider JSON is not saved; retry/repair policy can be applied by later queue work.

- **Could not reach provider:** check the endpoint and that a local server is running. The connection test reports a normalized error without showing credentials.
- **Cloud consent is required:** select Cloud or Hybrid privacy mode, then select Allow cloud data for that exact profile.
- **Local privacy mode blocks the provider:** choose a local profile or intentionally change the global privacy mode.
- **No model available:** refresh/test the profile and select a discovered model, or enter a custom model ID if the server does not support discovery.
- **Local server unavailable:** start Ollama or LM Studio, then run Test connection. Ollama must have at least one installed model; LM Studio must have a compatible local server and model available.
- **Structured output unsupported:** choose a model with JSON-schema support or allow the clearly labelled prompt-enforced JSON repair fallback. Compatible endpoints are probed rather than assumed to support native schemas.
- **Streaming interrupted:** the request is cancelled or failed safely; partial output is never persisted as a completed analysis.
- **AI is disabled:** enable the global AI mode and the relevant feature switch.
- **AI execution is currently disabled by policy:** a global, provider, or fallback-chain kill switch is active. Clear the applicable switch and retry; this does not consume a provider retry.
- **Monthly AI budget would be exceeded:** wait for the next monthly period or increase the exact fixed-point limit. Unknown cloud pricing is intentionally blocked when a hard cap applies.
- **No logs for analysis:** daily analysis only uses current check-in revisions for the selected day.
- **Analysis evidence was rejected:** generated structured output cited a source outside the bounded selected evidence set; FocusLog does not save it as a successful reflection.
- **Parent analysis is stale:** one exact child version it depended on was regenerated. The stale result is retained for audit, and an eligible recomputation can create a new current version.
- **Analyze Now returned an existing job:** an equivalent active or completed durable job already exists for that level, period, dependency hash, prompt version, provider/model/privacy snapshot, and regeneration number.
- **Scheduled catch-up is limited:** the configured catch-up limit was reached. Later scheduler evaluations continue from the persisted last eligible period.
- **Analysis result cannot be opened:** the result may belong to another owner, have been removed, or fail the safe ID validator. The renderer never receives raw database rows or internal job payloads.
- **Evidence is unavailable:** the source log was deleted or is no longer authorized for the current owner. The analysis version remains auditable, but the UI hides the evidence preview.
- **Embedding namespace will not activate:** coverage is incomplete or at least one vector has the wrong dimension, metric, model, or chunking version. The previous active namespace remains active until the replacement verifies.
- **Cloud embeddings are blocked:** Local mode never sends embedding text to cloud providers. Switch intentionally to Cloud or Hybrid and grant consent for that exact profile before creating a cloud namespace.
- **Deleting embeddings did not delete logs:** this is expected. Embedding namespaces are derived data; deletion removes chunks and vectors only.
- **A Playground prompt will not save:** check for missing declared variables, unused or invalid variables, triple-brace interpolation, a closing untrusted-content delimiter in the template, invalid JSON schema, or a selected provider that does not support structured output.
- **A context snapshot is shorter than expected:** the configured context token budget, reserved output tokens, evidence-count limit, recency ordering, or per-source-type limits caused an item to be truncated or omitted. The snapshot records truncation counts and source metadata for inspection.
- **A deleted source is missing from Playground context:** deleted or unavailable canonical sources are excluded before prompt rendering. Historical snapshots remain frozen, but safe inspection redacts credential-like text.
- **A Playground chat run is interrupted after restart:** FocusLog marks queued/running/streaming Playground runs as interrupted and does not replay the provider automatically. Partial output remains labelled partial and is not fed into later messages unless the user explicitly retries/regenerates.
- **Stopping a Playground response leaves partial text:** this is expected for streaming providers. Cancellation aborts the provider where supported, persists the partial state honestly, releases/settles budget through the production coordinator, and rejects late completion.
- **A Playground chat is blocked by policy:** check global AI mode, the Playground feature switch, provider profile enabled state, privacy mode, cloud consent, provider/global kill switches, and budget caps. These blocks occur before provider execution and are sanitized.
- **A fact was rejected:** automated fact extraction requires at least one current source revision from the same owner. Unsupported evidence IDs, deleted revisions, unsupported predicates, and unqualified temporal claims are rejected before persistence.
- **Two facts contradict each other:** this is expected when evidence conflicts. FocusLog preserves both as derived records with status history until reconciliation or an explicit user correction resolves the conflict.
- **A graph edge became unsupported:** a source revision or supporting fact was deleted, changed, rejected, or marked stale. The edge remains auditable but is not presented as active support.
- **A memory answer was rejected:** the generated answer did not cite retrieved evidence, failed structured JSON validation, omitted required stale/contradiction disclosure, or attempted to cite evidence outside the retrieval plan.
- **Raw logs are not included in a broad memory answer:** the retrieval planner prefers facts, graph relations, and summaries for broad questions. Raw excerpts are added only when evidence is required or the query is focused and budget allows it.
- **Local memory Q&A blocks a provider:** Local privacy mode cannot silently use cloud providers. Select a local profile or intentionally change privacy/consent settings.
- **A Playground import was rejected:** check for oversized JSON/JSONL, path traversal, executable file extensions, duplicate case IDs, unsupported provider IDs, credential-shaped content, or production data without explicit consent.
- **A Playground evaluation changed after rerun:** reruns create new immutable evaluation-run rows against the same frozen dataset/configuration; compare the run summaries rather than editing historical results.
- **A Playground feature is blocked by a switch:** the status projection reports the exact switch, such as `playground_execution`, `provider_calls`, `cloud_execution`, or a feature switch. Disabling embeddings does not disable local prompt editing or evaluation dataset management.

Do not put credentials in endpoints, log text, exports, or environment files committed to source control.

## Mobile AI sync

If an Android AI action stays pending, verify the normal FocusLog sync connection first. Mobile AI actions share the signed durable outbox and use the same retry/backoff behavior as check-ins and reminders.

If an AI result appears stale or disappears on Android, the desktop may have regenerated or deleted the derived result. Mobile tombstones intentionally hide deleted analysis, semantic search, fact, graph, and Q&A cache records; canonical logs are not deleted by AI cache cleanup.

If Android reports an unsupported AI schema version, update the app before relying on AI mobile projections. Future schema versions fail safely rather than merging incompatible result, usage, or provenance data.

If an AI mobile sync payload is rejected for privacy/security, check that it belongs to the same owner/workspace and that the backend is not sending credentials, raw prompts, raw provider responses, lease tokens, reservation ownership tokens, or other internal execution data.

## Mobile AI analyses

If Analyze Now shows an existing job instead of queueing another request, an equivalent active job is already pending for the same level, period, and regeneration mode. This is expected and prevents duplicate desktop queue work.

If the mobile AI tab says the executor is unavailable, open FocusLog on the paired desktop and synchronize. Android does not run the AI scheduler or provider worker.

If retry or cancellation is disabled, the synchronized job state is not eligible for that action. Failed or dead-lettered jobs can be retried; queued, leased, or retry-wait jobs can request cancellation. Cancellation remains pending until the authoritative queue confirms it.

If evidence cannot be opened, it may have been deleted, superseded, unavailable offline, or rejected by owner/workspace privacy checks. The result remains auditable, but deleted evidence is not shown as active support.

## Mobile AI privacy, budgets, and switches

If a mobile privacy, consent, budget, or kill-switch change shows as pending, synchronize the device. The local pending state is intentionally not proof that a cloud provider call is authorized; desktop/backend execution rechecks current policy before invocation.

If cloud execution remains blocked after enabling Cloud or Hybrid on mobile, verify cloud consent, the cloud execution switch, provider profile validation, unknown pricing, and the authoritative monthly/request budget. Mobile never uses cached policy to bypass those checks.

If provider credentials appear missing on Android, that is expected for desktop-owned execution. Android displays `credentialConfigured` metadata only and does not store provider secrets.

## Mobile AI memory

If mobile memory search returns no results, synchronize with the paired desktop/backend executor and check namespace coverage. Android searches the synchronized safe cache; it does not generate embeddings locally.

If a fact is missing, it may lack evidence, be stale, be privacy-blocked, or have been deleted. Mobile hides unsupported facts without evidence rather than presenting them as active knowledge.

If Playground content appears in production mobile memory, treat it as a release blocker. Playground-only payloads are excluded by the mobile repository before display.

If Q&A stays pending, the request is waiting for the authoritative retrieval service. Source text in memory results is untrusted and cannot change privacy, provider, switch, deletion, or tool behavior.

## AI Memory controls

If semantic search or memory Q&A appears unavailable, open AI Memory and check the active namespace, chunk coverage, pending/failed indexing counts, subsystem switches, and diagnostics. A missing namespace means semantic search cannot run until embeddings are rebuilt. Failed chunks can be retried by rebuilding the active namespace through the durable queue.

If facts or graph records look wrong, reject the automated fact or create a correction overlay from the Facts panel. This preserves provenance and extraction history. For graph entity ambiguity, use split before relying on relations for retrieval.

Derived-memory deletion is recoverable by rebuild and never deletes canonical FocusLog logs. It requires typing `DELETE DERIVED MEMORY`. If diagnostics contain provider or policy failures, the UI shows sanitized messages only; check provider settings, privacy mode, consent, budgets, and subsystem switches before retrying.

## Playground gate checks

If the Playground page shows a failed isolation invariant, do not use Playground outputs as production memory until the related safe service is repaired. The gate status identifies whether the failure is from Playground namespaces, scheduled-job isolation, production prompt isolation, or sanitized diagnostics. Re-run the adversarial corpus from the Playground page after clearing unsafe imported artifacts or subsystem configuration.

## Phase 5-A certification failures

Run the Phase 5-A focused certification test when changing provider adapters, IPC, preload APIs, prompt/retrieval boundaries, imports, exports, credentials, privacy mode, consent, or diagnostics.

- **Traceability row failed:** update `docs/AI_RELEASE_CHECKLIST.md` and the row in `phase5TraceabilityRows` with real code, tests, and docs. Do not mark an unsupported behavior as implemented.
- **Credential leak detected:** remove the secret-bearing field from the projection/export/diagnostic and store only `credentialConfigured` or a safe reference.
- **Electron hardening failed:** keep context isolation, disabled Node integration, sandboxing, the focuslog preload allowlist, and the main-process CSP registration.
- **Network security failed:** cloud endpoints must be HTTPS, URL credentials/query/fragment are invalid, redirects must remain blocked, and provider response bodies must stay bounded.
- **Prompt/content boundary failed:** retrieved, imported, logged, fact, graph, and Playground text must be treated as untrusted and cannot authorize provider, privacy, switch, budget, file, or mutation behavior.
- **Privacy certification failed:** Local mode must reject cloud execution; Cloud/Hybrid require profile-specific consent evidence without storing prompts, responses, API keys, or authorization data.
- **Export certification failed:** remove credentials, encrypted blobs, internal ownership tokens, raw private prompts, raw provider responses, deleted data, and unselected production content from the bundle.

## Phase 5-B migration and reliability recovery

- **Database schema is newer than this app:** install a newer FocusLog build before opening the database. The app refuses to continue so it does not treat unknown future tables or columns as current.
- **Migration was interrupted:** restart FocusLog. Migrations are transactional; the failed version is not recorded as applied, partial schema is not considered complete, and initialization retries safely.
- **Backup cannot be written:** free disk space and retry. Backup/export writing uses an atomic temporary file; low-space preflight blocks rather than producing a partial archive.
- **Backup restore failed authentication:** the recovery key is wrong or the archive was modified. Live data is not replaced until the archive decrypts, validates, and passes staging integrity checks.
- **Derived AI memory is corrupt:** canonical FocusLog logs remain safe. FocusLog can mark incompatible vector namespaces failed, facts stale, graph edges unsupported, and Playground runs interrupted, then rebuild derived data from canonical sources.
- **Embedding vector dimension mismatch:** rebuild the affected namespace. The old namespace is not mixed with incompatible dimensions, metrics, or models.
- **Fact or graph evidence disappeared:** facts become stale and graph edges become unsupported. Deleted or unavailable evidence is not presented as active support.
- **Queue job recovered after crash:** stale workers cannot complete reclaimed jobs because completion checks the current lease owner and lease token. A recovered job either retries, reconciles a committed result, cancels, or dead-letters according to its durable state.
- **Budget reservation recovered after interruption:** pre-call expired reservations are released; provider-started or usage-uncertain reservations use the conservative documented settlement policy. Recovery is idempotent and does not double-release or double-settle.
- **Provider fault after restart:** check network, endpoint, credentials, local-model availability, model list, rate limits, privacy mode, consent, and budget. Normalized recovery messages omit API keys, authorization headers, lease tokens, reservation ownership tokens, raw prompts, and raw provider responses.

## Phase 3 performance artifact

For Phase 3 memory performance regressions, run:

```powershell
pnpm --filter @focuslog/desktop build:main
node apps/desktop/dist-electron/ai/phase3-performance-harness-runner.js artifacts/phase3/phase3-200k-benchmark.json
```

Compare the resulting JSON timings, memory, database size, counts, and security booleans against `docs/AI_PERFORMANCE.md`. If the benchmark fails, first inspect disk space, native SQLite availability, and whether another process is heavily contending for the same storage device.

## Phase 5-C provider and performance certification

- **Provider row is untested:** no opt-in environment variables were present for that provider, or `FOCUSLOG_PHASE5C_LIVE` was not set to `1`. This is safer than falsely certifying an unconfigured endpoint.
- **Local provider row failed:** confirm Ollama or LM Studio is running on the configured loopback endpoint and that the selected model is installed and discoverable.
- **Cloud provider row failed:** check endpoint HTTPS validation, credential validity, selected model ID, consent to run a live smoke, provider status, and quota. Do not paste API keys into bug reports.
- **OpenAI-compatible row failed:** verify the endpoint supports `/models`, `/chat/completions`, streaming events, and embeddings if an embedding model was configured.
- **Structured output failed:** the provider may not support native JSON schema for that model. The adapter fallback remains tested, but the live row records the limitation.
- **Cancellation failed:** the provider returned a completed response after an already-aborted request. Treat this as a provider/path limitation and keep late-completion rejection in application code.
- **Performance threshold failed:** compare the generated artifact with `docs/AI_PERFORMANCE.md`, check disk/CPU contention, rerun once on a warmed native dependency, and inspect which threshold regressed before changing product limits.
- **Artifact contains a secret-shaped value:** stop release certification and fix the projection/redaction path before sharing the artifact.

## Mobile AI lifecycle

If Android is closed or backgrounded while AI work is pending, the local durable outbox keeps the request or cancellation. The paired desktop/backend executor remains authoritative. Reopening Android reconstructs pending actions, accepted actions awaiting results, queued-for-desktop jobs, cancellation requests, and executor availability from synchronized records.

If a notification opens the wrong profile or workspace, FocusLog blocks the deep link and records a sanitized lifecycle diagnostic. Notification payloads contain only safe target IDs and never include private log text, credentials, prompts, raw provider responses, authorization data, lease tokens, or reservation ownership.

If sync fails after a network switch, token refresh, DNS/TLS error, or backend outage, mobile schedules normal bounded retry/backoff and keeps the AI action idempotent. Do not retry by creating another manual request unless the UI shows the original request was rejected.

## Mobile Playground

If Android shows Playground as desktop-required, that is the expected M-G product decision. Open the paired desktop app to create sessions, edit prompts, run providers, compare models, mutate datasets, or promote reviewed prompt changes.

If a Playground session does not appear on Android, synchronize with the paired desktop/backend. Android displays only safe shared metadata and does not read desktop-only raw prompt or provider response bodies.

If a Playground import is rejected, check the schema version, artifact type, file/name path, size, duplicate case IDs, unsupported providers, executable extensions, and credential-shaped fields. Embedded instructions are retained only as inert untrusted data warnings.

If Playground content appears in production mobile search, analyses, facts, graph, schedules, or memory Q&A, treat it as a release blocker.

## Mobile AI release gate

If `pnpm mobile:analyze`, `pnpm mobile:test`, or `pnpm mobile:build` fails with `flutter is not recognized`, install Flutter and Android SDK or run the configured mobile CI runner. Do not mark Android AI verified until the commands in `docs/AI_MOBILE_COMMANDS.md` pass.

If a release artifact was not built, installed, and launched, do not claim Android release certification. Run the M-I smoke sequence: fresh install, upgrade from latest stable mobile data, offline/reconnect, AI route navigation, deletion/tombstone check, diagnostics/export scan, and protected-data cleanup according to policy.

If an Android release build fails signing, confirm the protected signing secrets are available only in trusted push or release-candidate CI contexts. Pull requests from untrusted contexts must not receive signing material.

If a mobile migration fails during M-I, preserve the database, do not downgrade it destructively, and verify canonical check-ins, outbox operations, tombstones, and AI projections remain readable before retrying initialization.

# Phase 5-D UX recovery

AI recovery messages must tell the user what happened, whether data is safe, whether retry is appropriate, and the next action. Release-critical states covered by the Phase 5-D certification include empty provider lists, loading, streaming, cancellation, offline sync, invalid provider configuration, missing local model software, consent required, budget exceeded, rate limiting, provider unavailable, queue delay, dead letters, stale memory, rebuild in progress, partial provider support, import rejection, export safety, and diagnostic export.

The safe diagnostic export is available from the AI settings recovery panel. By default it excludes credentials, encrypted credential blobs, authorization headers, secret endpoints, raw private logs, full private prompts, raw provider responses, lease tokens, reservation-owner tokens, debug dumps, and deleted source payloads. If private content is explicitly selected, FocusLog displays a warning before sharing.
