# FocusLog AI Mobile Sync

Mobile AI synchronization reuses the existing signed outbox and pull loop. AI-specific logic is layered onto that production sync path rather than introducing a separate provider or queue runner on Android.

## Push

Android writes user intent into both:

- `ai_mobile_outbox_actions`, the local AI action ledger.
- `outbox_operations`, the existing signed sync outbox.

When the backend accepts, deduplicates, or reports a conflict for an AI operation, the sync worker marks the matching AI action as accepted or conflict. Retry/backoff remains the shared outbox behavior.

## Pull and merge

Remote `ai.*` changes are applied through the mobile AI repository. The merge rules are:

- Reject unsupported future schema versions with a safe compatibility error.
- Reject cross-owner or cross-workspace payloads.
- Keep exact result versions and select the newest non-deleted version for current display.
- Accept out-of-order deltas without downgrading the current result.
- Apply tombstones before exposing cached memory or analysis records.
- Preserve exact usage strings without floating-point conversion.
- Reject secret-bearing payload fields.

## Execution ownership

Android never invokes an AI provider for production analyses, embeddings, facts, graph updates, retrieval Q&A, or Playground. Those jobs remain desktop-owned or desktop-only according to `contracts/ai/mobile-ai-v1.json`.

## Analysis experience sync

The AI analysis screen reads only `ai_mobile_*` projection tables. Analyze Now, regeneration, retry, cancellation, schedule edits, and schedule kill-switch changes enter the durable outbox as `ai.*` sync operations. Repeated taps use stable idempotency keys and display the existing active equivalent job.

Executor availability, queue state, dependency waits, budget/policy blocks, fallback, repair, stale state, and provenance are displayed only when synchronized from the authoritative platform. Mobile does not infer provider progress.

## Lifecycle and reconnect recovery

Mobile Phase M-F adds `MobileAIExecutionAdapter` on top of the durable AI outbox and sync worker. Foreground sync, WorkManager-triggered sync, cold start, resume, backgrounding, and suspension record bounded safe lifecycle diagnostics. Offline requests and cancellations remain in the owner/workspace-scoped outbox until signed synchronization succeeds.

For the frozen desktop-owned execution architecture, Android synchronizes request, cancellation, status, and result projections only. It does not run provider calls, queue workers, retries, fallbacks, structured repair, reservation settlement, or embedding jobs locally.
