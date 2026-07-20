# Reporting implementation

FocusLog reports are local-first. Desktop queries encrypted SQLite and Android queries encrypted Drift/SQLite, so locally available history remains reportable without the backend. The backend exposes the same reporting boundaries for authenticated devices.

## Reporting day

A request contains a civil date (`YYYY-MM-DD`) and an IANA `timezoneId`. The reporting interval is the half-open range from that date's local start of day to the next date's local start of day. Stored UTC instants are never changed. Consequently, a daylight-saving transition day can contain 23, 24, or 25 hours.

Event assignment uses:

- `check_ins.submitted_at` for check-ins;
- `reminder_occurrences.resolved_at`, falling back to `scheduled_at`, for occurrence outcomes;
- `reminder_transitions.occurred_at` for transition history;
- `focus_sessions.started_at` and `ended_at` for session-boundary log entries; and
- `conflicts.created_at` for synchronization-conflict indicators.

An overlapping session contributes only the portion inside the selected day. An active session is additionally clipped at the current instant, so today's tracked time cannot include future minutes.

## Daily metrics

- Completed intervals: terminal reminder occurrences in `COMPLETED`.
- Missed intervals: terminal reminder occurrences in `MISSED`.
- Focus score: `completed / (completed + missed) × 100`, rounded to the nearest integer. With no completed or missed intervals, the score is zero.
- Categories: current, non-deleted check-ins grouped by category, with missing categories reported as `Uncategorized`.
- Trends: non-deleted check-ins in the 7, 30, and 365 civil days ending on the selected report day.
- Timeline: check-ins, reminder occurrences, transitions, session boundaries, and conflicts ordered by canonical instant and stable ID.

The report includes its time-zone ID and actual local-day duration. Timeline items preserve the original time-zone context where the source entity stores it.

## Yearly heatmap

The heatmap accepts any year from 1970 through 9998 and returns every date from January 1 through December 31, including February 29 in leap years. The activity value is the number of non-deleted check-ins assigned to the date in the selected report time zone.

Intensity is deterministic:

- `0`: no check-ins;
- `1`: positive values through the first active-day quartile;
- `2`: values through the median active-day quartile;
- `3`: values through the third active-day quartile; and
- `4`: values above the third quartile.

Quartiles are calculated only from positive days in the selected year. The response includes the thresholds and metric description so clients do not infer or silently change the scale. Desktop and Android arrange cells in Sunday-first week columns, expose a text alternative, and make every real date selectable. Selecting a date opens the same complete day log used by the daily report.

## API

- `GET /api/v1/reports/daily?day=YYYY-MM-DD&timezoneId=Area/City`
- `GET /api/v1/reports/heatmap?year=YYYY&timezoneId=Area/City`

Both endpoints require signed device authentication. Invalid dates and unknown IANA zones are rejected.

## Long-term query support

PostgreSQL, desktop SQLite, and Drift migrations include owner/time indexes for check-ins, reminder resolution, reminder transitions, and overlapping sessions. Heatmap queries read only the selected year's UTC envelope, then assign each instant to its local date. They do not scan or synthesize the owner's entire history.
