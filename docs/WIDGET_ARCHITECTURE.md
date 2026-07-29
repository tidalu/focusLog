# FocusLog widget architecture

FocusLog widgets are local-first read models. They render a versioned schema-1 snapshot for one explicit profile, rather than querying the backend or executing analytics independently.

The desktop `WidgetService` reads the encrypted SQLite database through the existing reporting service, reminder rows, and persisted AI memory. Android Flutter code calculates the same existing daily-report and reminder values, then writes a privacy-filtered snapshot to Android private preferences; the native `AppWidgetProvider` only reads that snapshot. Neither implementation contains credentials, prompts, tokens, or a log history.

Daily completion is the existing deterministic daily-report percentage: completed reminder intervals divided by completed plus missed intervals, rounded to a whole percentage. `focusScore` is that same existing report value. Focus duration is the clipped duration of completed or active sessions inside the configured local report day. AI content is read-only persisted `ai_memories` on desktop; widgets never call an AI provider.

Local writes happen first, followed by snapshot refresh and an asynchronous existing sync request. A failed sync never rolls back the local log.

## Snapshot fields

`schemaVersion`, profile ID, creation/freshness timestamp, local date/timezone, completion, log count, focus duration and score, session state, next reminder, recent activity, pending-sync/offline state, privacy state, and optionally an already-persisted insight are included. Missing or unavailable data becomes a safe empty state.

The snapshot is profile scoped. A configured profile mismatch causes Android to show a reconfiguration state; desktop snapshot generation is bound to the active owner database.
