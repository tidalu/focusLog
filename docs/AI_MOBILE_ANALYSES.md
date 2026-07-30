# FocusLog Mobile AI Analyses

Android presents synchronized AI analysis projections for daily, weekly, monthly, quarterly, and yearly periods. Execution remains desktop-owned: mobile requests are durable sync operations that the authoritative desktop/backend queue validates against dependencies, privacy, consent, kill switches, budgets, provider policy, and provenance requirements.

## Analysis navigation

The AI tab provides level navigation for daily, weekly, monthly, quarterly, and yearly analyses. Each level shows eligible period identifiers, synchronized results, missing-result states, stale/superseded status, and queue projections. Period identifiers use the shared wire shape: civil day, ISO-like week, month, quarter, and year strings.

## Result detail

Mobile detail views render readable summaries, structured sections when present, provider/model disclosure, fallback-used disclosure, prompt/schema version when synchronized, token usage, exact micro-USD cost strings, creation time, source period, version, stale state, and safe provenance.

Hidden prompts, raw provider responses, credentials, queue leases, and budget reservation owner tokens are not synchronized or rendered.

## Manual actions

Analyze Now, regeneration, retry, cancellation, and schedule-setting edits are queued through the mobile AI outbox. Duplicate manual taps reuse the existing stable idempotency key and show the existing active job instead of duplicating work.

Cancellation is displayed as pending until authoritative synchronization confirms the terminal state. Mobile discloses that cancellation cannot undo provider usage already incurred by the desktop executor.

## Queue and executor status

For desktop-owned execution, mobile displays executor availability and last-seen information when synchronized. It does not invent progress for provider calls. Queue statuses are renderer-safe projections: queued, waiting, running/leased, retrying, fallback/repair where synchronized, cancelled, failed, dead-lettered, succeeded, and stale.

## Provenance

Mobile can display synchronized child summaries, source records, evidence excerpts, timestamps, stale state, and deleted/unavailable evidence messages. Canonical source opening is allowed only when the source is still available and authorized.
