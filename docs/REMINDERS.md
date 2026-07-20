# FocusLog Reminder Design

## Status

Implemented reminder architecture and mandatory completion rule. The production defaults below are persisted in every focus mode and occurrence snapshot, so later policy changes do not reinterpret historical reminders.

## Principles

Reminders must be noticeable, predictable, recoverable, accessible, and compatible with Windows and Android controls. They are locally scheduled and locally durable. A backend outage cannot prevent a valid local check-in from being saved.

Standard mode provides visible entry, permitted snooze, permitted skip, and clear validation. Strict mode may remove ordinary dismissal, but it must always provide a documented accessible emergency dismissal and must never bypass operating-system controls, security screens, assistive technology, emergency communication, or platform notification controls.

## Occurrence lifecycle

```text
scheduled -> due -> presented -> completed
                         |-> snoozed -> due
                         |-> skipped
                         |-> emergency_dismissed
                         |-> missed
                         `-> superseded
```

`overdue` is a derived condition of `due`, not a state. `cancelled` may be represented as `superseded` when a session or policy invalidates an occurrence. Every permitted transition is persisted before UI success is reported.

| State                 | Meaning                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `scheduled`           | A session policy created the occurrence with a due instant                                 |
| `due`                 | The due instant passed and no terminal result exists                                       |
| `presented`           | A selected device displayed or notified the occurrence                                     |
| `snoozed`             | The owner chose an allowed deferment; original due time remains recorded                   |
| `completed`           | A valid check-in was durably stored for the occurrence                                     |
| `skipped`             | The owner used a policy-permitted skip; it is not completion                               |
| `emergency_dismissed` | The accessible emergency escape was used; it is not completion                             |
| `missed`              | The response/recovery policy reached an uncompleted terminal outcome                       |
| `superseded`          | Equivalent presentation or session/policy change made this occurrence no longer actionable |

## Completion rule

`REM-020` A reminder occurrence must not transition to `completed` unless the linked check-in description has at least 20 Unicode characters after trimming leading and trailing whitespace.

- The local device evaluates the rule before writing its completion transaction.
- The backend revalidates the rule when it accepts the operation.
- The UI shows the remaining character count and associates validation feedback with the text field for assistive technology.
- The rule applies to reminder-originated completions in Standard and Strict modes.
- A manual entry, snooze, skip, missed outcome, or emergency dismissal must not be represented as a completion and is not forced through this text rule.
- Valid local completion remains available during backend/network outage.

## Scheduling and recovery

The reminder engine persists the policy snapshot, original due instant, effective due instant, IANA time zone, and relevant monotonic timing observation where available. In-memory timers are an optimization only.

On startup, resume, sleep/hibernate recovery, clock adjustment, DST transition, or time-zone change, the engine reconstructs occurrences from SQLite and compares stored due instants with current clock and monotonic information. It records a recovery decision and consolidates overdue work into one appropriate prompt; it must not create an uncontrolled sequence of overlays.

## Multi-device presentation

The backend uses short-lived advisory presence to choose one eligible online device: foreground-capable first, then most recently active capable, then owner preference. The selected device receives a short-lived claim. No coordination method can guarantee exactly-once visible presentation while devices are partitioned, so duplicate display is safe by design.

Every display uses the stable occurrence ID. Completion, snooze, skip, and dismissal operations are idempotent. When one device resolves an occurrence, synchronized devices dismiss or mark equivalent local prompts as superseded. Duplicate concurrent completion cannot create a second user-visible check-in.

## Platform adapters

| Platform               | Responsibilities                                                                                          | Limitation handling                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Windows/Electron       | Main-process scheduler, tray, autostart, sleep/resume detection, overlay window, notification integration | Never expose privileged APIs to renderer; recover missed occurrences after restart/wake                       |
| Android/Flutter        | App workflow and local state                                                                              | UI never assumes background execution is perpetual                                                            |
| Android/Kotlin adapter | Alarm scheduling, notification channels, permitted foreground service/full-screen presentation            | Use only Android-approved mechanisms; disclose battery/notification limitations and recover on next execution |

## Accessibility and emergency escape

Overlays must support keyboard navigation, visible focus, screen-reader labels, high-contrast modes, and scaling. Strict mode’s emergency dismissal must be discoverable, keyboard-accessible, screen-reader-accessible, and recorded honestly. It must not imitate a successful check-in.

## Production reminder policy

1. Cadence is fixed from the focus-session start time. Completion, restart, and sleep do not drift the interval anchor.
2. The default interval is 30 minutes and remains configurable from 1 to 1,440 minutes.
3. Allowed snoozes are 5, 10, and 15 minutes, with a maximum of three snoozes per occurrence.
4. The default response window is 60 minutes. An occurrence that was never presented becomes `missed` when recovery finds it beyond that window. A presented occurrence remains available for an explicitly late completion unless its policy disables late completion.
5. Recovery presents only the oldest actionable occurrence. Other overdue occurrences remain durable and do not create an overlay or notification storm.
6. Concurrent device resolution is server-canonical and idempotent. The first valid completion creates the one canonical check-in; later competing text is retained as conflict data rather than overwritten.
7. Android support starts at API 23 and targets API 35. AlarmManager-backed notifications use inexact allow-while-idle scheduling; WorkManager, boot receivers, and foreground/app-resume reconciliation cover permitted recovery. FocusLog does not bypass force-stop, battery optimization, notification permission, or OEM controls.

These values must be approved before scheduler implementation because they determine durable historical meaning.
