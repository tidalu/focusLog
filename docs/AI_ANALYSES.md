# AI analyses

## Mobile analysis experience

Android consumes synchronized safe projections for daily, weekly, monthly, quarterly, and yearly analyses. Mobile can queue Analyze Now, explicit regeneration, retry, cancellation, and schedule-setting updates through the durable sync outbox, but provider execution remains in the desktop-owned queue architecture.

Mobile result views show readable summaries, structured sections, provider/model, fallback, prompt/schema version, token usage, exact micro-USD cost strings, staleness, period identifiers, and safe provenance. They do not show raw prompts, raw provider responses, credentials, internal queue leases, or reservation ownership tokens.

FocusLog uses one shared calendar contract for daily, weekly, monthly, quarterly, and yearly reflections. Each descriptor records its level, IANA timezone, local inclusive start and exclusive end, UTC boundaries, stable period ID, and the `calendar-v1` boundary policy. Weeks use ISO Monday-to-Monday boundaries; months, quarters, and years use calendar boundaries. Period calculation is pure and does not depend on the host machine timezone.

Statistics are calculated in application code before prompt construction. They are stable serialized objects with a source range, count unit, missing-data signals, distributions, time-of-day counts, recurring themes, project activity, outliers, and comparable-period delta. Logs and previously generated summaries remain untrusted content; they are never used to calculate statistics.

Evidence is owner-isolated and revision-addressed. Deleted, unavailable, and privacy-blocked records are excluded. Selection is deterministic, bounded by count and characters, and rendered inside explicit `untrusted_evidence` delimiters. Schemas reject references to sources that were not supplied.

All five prompt files carry ID, semantic version, level, schema version, variables, privacy classification, expected context, and change notes. Weekly through yearly use the shared structured envelope. Daily retains its historical structured V1 parser and persistence shape; new daily requests use the shared period-boundary utility without rewriting old free-form or structured results.

## Hierarchy and versions

Weekly, monthly, quarterly, and yearly analyses are durable queue jobs. Weekly jobs use the exact active daily summary versions for the week plus a bounded set of exceptional raw evidence. Monthly uses weekly versions, quarterly uses monthly versions, and yearly uses quarterly versions. Parent prompts keep trusted child summaries and untrusted raw evidence in separate sections.

Parent results are stored in `ai_analysis_results` as immutable versions. One version per owner, level, and period is `current`; regenerated results supersede the prior current version while retaining the old record for audit. `ai_analysis_child_sources` stores exact child result IDs and versions, and `ai_analysis_log_sources` stores exact raw log evidence revisions.

Before a parent result is published, FocusLog rechecks the dependency revision hash captured when the job was queued. If a child changed while the provider was running, the stale response is not made current and a bounded retry is queued. When a daily result is regenerated, only weekly results linked to the previous daily version are marked stale, and that staleness cascades through exact weekly-to-monthly, monthly-to-quarterly, and quarterly-to-yearly links.

## Scheduling and Analyze Now

Each analysis level can have a persistent schedule with enabled state, local execution time, timezone, provider profile, model mode, optional fallback chain, privacy mode, per-run micro-unit cost cap, catch-up limit, and a schedule-specific kill switch. The scheduler runs in Electron main process after database initialization and migrations. It evaluates closed periods only; manual Analyze Now is the explicit path for open or in-progress periods.

Scheduled work never calls providers directly. Evaluation computes eligible periods with the shared calendar utilities, enqueues durable jobs with stable idempotency keys, and wakes the existing queue worker. Catch-up is oldest-first and dependency-aware: parent levels enqueue immediate child periods before parent jobs and leave excess periods for later evaluations when the configured limit is reached.

Manual Analyze Now uses the same durable enqueue path for daily, weekly, monthly, quarterly, and yearly periods. Equivalent active or completed work is returned instead of duplicated. Explicit regeneration records a new regeneration number and creates a new version when the job completes, preserving prior results.

## Analysis UI disclosure

The desktop AI settings surface now exposes all five analysis levels. Each level shows schedule controls, durable job actions, scheduler/catch-up diagnostics, latest versions, stale/superseded state, readable summaries, structured sections, exact child/evidence provenance, provider/model, fallback disclosure, prompt/schema versions, token counts, and exact cost strings. Evidence previews are shown only when the source is still available to the current owner; otherwise the UI displays an unavailable evidence state.
