# AI Job Queue

The Electron main process owns FocusLog's device-scoped AI queue. Renderer processes request safe operations through IPC; they never call providers or receive provider credentials. A future backend or Android worker requires a separately designed ownership and synchronization protocol.

`ai_jobs` is the durable state machine: `queued` → `leased` → `succeeded`, `retry_wait`, `failed`, `cancelled`, or `dead_lettered`. Queue rows have an owner-scoped idempotency key, lease owner, and opaque lease token. Lease renewal, progress, completion, and failure all check that pair, so a stale worker cannot acknowledge a reclaimed job. Eligible jobs honor `run_after`; expired leases return to retry-wait when attempts remain and dead-letter once the retry limit is exhausted.

## Main-process worker

`AIJobWorker` starts once with the Electron main process and is not tied to a renderer window. It wakes immediately after enqueue and uses a bounded idle poll when no work is available. Each leased job gets an abort controller and a lease-renewal heartbeat. Renewal failure or a cancellation request aborts the active handler; a worker that loses ownership does not persist a completion. Shutdown aborts local work and leaves the lease for normal expiry/reclaim rather than falsely marking it cancelled.

Startup occurs only after encrypted database migrations and required AI services are initialized. The worker first reconciles already persisted daily results with their jobs, then reclaims expired leases; it never reclaims a non-expired lease. Leases are process-local: after an unclean termination they expire and are recovered by the next process. `ai_queue_diagnostics` stores bounded, credential-free recovery messages. Results whose job no longer exists are preserved and recorded as orphan diagnostics; terminal jobs are never fabricated into success.

Handlers are explicitly registered for `daily_analysis`, `weekly_analysis`, `monthly_analysis`, `quarterly_analysis`, and `yearly_analysis`. Retryable provider/network and dependency-wait errors use the existing bounded exponential backoff; configuration, privacy, consent, payload, cancellation, and unsupported-job errors are terminal.

## Queued daily analysis

The daily-analysis IPC validates the profile and date, rechecks the analyses kill switch, privacy mode, and cloud consent, then creates a versioned payload and enqueues it. It returns only a safe job summary; it never waits for generation. The payload contains the local date, IANA timezone, UTC period bounds, profile/model and privacy snapshots, prompt version, source-revision hash, regeneration version, and trigger origin. It deliberately contains no raw log text.

The idempotency key includes the daily analysis kind, profile, model, privacy mode, local date/timezone, source revision hash, prompt version, and regeneration version. Repeated clicks return the active or completed equivalent job. A changed source hash yields a distinct job. The handler rechecks source hash, privacy, consent, and cancellation before provider work; provider cancellation is propagated through `AbortSignal` and partial output is never persisted.

Migration 8 adds an `ai_memories.job_id` link with a unique owner/job index. Daily result, provenance, and usage are persisted before lease-safe completion. If a process stops after persistence but before acknowledgement, a retry finds that linked result and acknowledges the job without creating a second memory or usage record.

## Hierarchical analysis jobs

Parent analysis payloads snapshot the level, period descriptor, provider/model/privacy, prompt version, source revision hash, and regeneration number. Weekly jobs require current daily summaries for the exact week; monthly requires weekly; quarterly requires monthly; yearly requires quarterly. If a required child is missing, the handler enqueues the oldest missing child through the durable queue and places the parent into retry wait. Dependency resolution never calls a provider directly.

Parent results are stored in `ai_analysis_results`. Startup reconciliation treats a linked shared result the same way as a linked daily memory: if persistence completed before queue acknowledgement, the job is marked succeeded without replaying the provider. Before persistence, the handler rechecks the captured dependency hash; if a child changed during provider execution, the stale response is discarded and one bounded recomputation is queued.

## Analysis scheduler

`AnalysisSchedulerRuntime` is a main-process timer registered with the queue runtime lifecycle. It starts after migrations and queue recovery, evaluates persistent per-level schedules, enqueues closed eligible periods, and stops its timer on application quit. The scheduler never invokes provider adapters; it only writes durable queue rows and wakes the worker.

Catch-up state is persisted on `ai_analysis_schedules` with last evaluation, last eligible period, next expected run, last success, and bounded sanitized diagnostics. Repeated evaluations use stable idempotency keys and the queue's owner-scoped uniqueness to avoid duplicate active or completed equivalent jobs.

Manual Analyze Now shares the same enqueue helpers. Cancellation remains a queue operation, and regeneration is represented in the queued payload so a later completed job creates a new immutable result version.

## Queue inspection and control

The preload bridge exposes only safe job projections: status, timestamps, counts, requested provider display data, model, normalized error code/message, result reference, and allowed actions. It never exposes payload JSON, lease tokens, credentials, provider response bodies, or prompts. The main process validates job IDs, list limits, and status filters.

Queued and retry-wait jobs cancel immediately. A leased job records cancellation and aborts the active worker request. A repeated cancellation of an already-cancelled job is idempotent; cancellation of another terminal job is rejected. Manual retry is limited to failed or dead-lettered jobs and creates one deterministic active retry job while preserving the original terminal record.

The shutdown policy is immediate bounded interruption: the worker stops leasing and polling, aborts its active handler, and stops renewal timers without waiting indefinitely for an uncooperative provider. No partial output is persisted; the outstanding lease is recovered after expiry on the next startup.

Phase 5-B reliability certification verifies queue crash and stale-worker boundaries with durable lease ownership. A process that disappears without graceful shutdown leaves its lease intact until expiry; the next runtime can reclaim the job after the deterministic expiry window. Completion, failure, progress, and renewal continue to require the current lease owner and opaque token, so a stale runtime cannot mark a recovered job succeeded or create duplicate result/usage records.

Financial recovery is idempotent. Interrupted pre-call reservations can be released after expiry, while provider-started or usage-uncertain reservations follow the conservative settlement policy documented in `docs/AI_BUDGETS.md`. Recovery must leave one valid reservation state, exact request/monthly totals, and bounded secret-free diagnostics.

Cancellation is rechecked at the coordinator boundaries after policy validation, after any budget reservation, and before a fallback starts. Therefore a queued cancellation has no attempt or reservation, a pre-call cancellation releases its sole reservation, and an in-flight cancellation is forwarded to the provider. If that provider reports billable usage while cancelling, the attempt settles that exact integer amount once, records a sanitized cancellation outcome, and releases the unused estimate; it does not retry, fall back, or increment the breaker. A provider response arriving after cancellation or lease loss cannot acknowledge or persist success. Retry eligibility, queue attempts, the immutable fallback snapshot, and provider-attempt sequence are durable: restarting from `retry_wait` waits for the stored eligibility time, then continues rather than replaying completed calls.

New daily results must validate against structured schema V1 before persistence. The readable summary remains the compatible memory content, while the validated JSON and validation marker are retained transactionally. Older free-form rows remain legacy-readable.

For a queued response that fails JSON or V1 validation, the worker may make exactly one coordinator-recorded `structured_repair` attempt. It is a separate budgeted provider attempt and cannot bypass cancellation, lease, privacy, consent, or kill-switch checks. A repair that remains invalid leaves no successful result.

# AI queue and execution controls

Provider attempts use one strict ordering: cancellation; current policy (kill switches, profile ownership, privacy, and consent); circuit breaker; capacity acquisition; exact budget reservation; provider invocation; settlement; breaker outcome; and capacity release. Capacity is acquired before budget reservation so waiting jobs never hold funds. Waiting is priority ordered, cancellable, and lives only in the main process, so a restart starts with no leaked capacity.

Daily jobs persist a versioned, sanitized fallback snapshot at enqueue. The coordinator reads that snapshot rather than later chain edits, while still revalidating current profile, privacy, consent, and kill-switch restrictions before every provider call. Unsupported snapshot schema versions fail safely.

An open breaker does not consume capacity or create a reservation. When its cooldown expires, exactly one bounded half-open probe may run. Network, timeout, rate-limit, provider-unavailable, and malformed-response failures qualify; cancellation, policy, validation, and budget failures do not.
