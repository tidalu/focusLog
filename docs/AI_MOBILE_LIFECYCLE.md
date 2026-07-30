# FocusLog Mobile AI Lifecycle

Mobile AI execution follows the Mobile Phase M-A ownership matrix. Release-critical production AI jobs are desktop-owned, so Android never starts provider adapters, leases AI queue work, reads provider credentials, or computes vectors locally.

## Execution adapter

`MobileAIExecutionAdapter` is the Android lifecycle boundary for AI work. It records cold start, resume, background, suspension, offline, reconnect, token-refresh, profile-switch, and deep-link decisions as bounded diagnostics. Its recovery path rebuilds state from durable outbox actions, job projections, result projections, and executor availability.

## Offline and restart behavior

Manual requests, regeneration, cancellation, retry, settings, memory, fact, graph, deletion, and export actions are persisted before the UI treats them as queued. Reconnect transmits them through the normal signed sync worker. Repeated reconnects use stable idempotency keys, so the authoritative desktop/backend side sees one logical request.

After process termination or app restart, Android reconstructs:

- pending local AI actions;
- accepted actions awaiting result synchronization;
- queued or running desktop-owned jobs;
- pending cancellation requests;
- executor availability and last-seen state.

## Background work

Android background work is limited to platform-supported synchronization and reminder recovery. For desktop-owned AI execution, background work may synchronize status and cancellation requests; it must not run providers, repair structured output, settle budgets, or publish AI results locally.

## Notifications and deep links

Mobile stores safe notification intents for completed, failed, blocked, executor-unavailable, consent-required, budget-blocked, and stale AI outcomes. Notification payloads include only owner/workspace IDs, target kind, and target ID. They exclude credentials, authorization headers, prompts, raw provider responses, private source text, lease tokens, and reservation ownership.

Deep links validate owner, workspace, target kind, and target ID before opening AI content. Cross-profile links are rejected and recorded as sanitized lifecycle diagnostics.

## Diagnostics

Diagnostics store only normalized state, category, optional safe job ID, timestamp, and a sanitized reason. The store is bounded to the latest 200 rows per owner/workspace.
