# ADR-007: Mobile Framework Selection

## Status

Accepted

## Date

2026-07-20

## Decision Owners

FocusLog owner and lead architect.

## Context

Android needs a maintainable personal-journal UI, local persistence, secure device identity, notifications, alarm scheduling, and platform-compliant reminder behavior.

## Decision Drivers

Android delivery constraints, local persistence, accessible UI, platform channels, packaging maturity, and development speed.

## Decision

Use Flutter/Dart for the application and narrow Kotlin platform adapters for Android alarms, notification channels, permitted full-screen intents, foreground-service behavior, lifecycle signals, and Keystore access.

## Alternatives Considered

Native Android/Kotlin, React Native, and .NET MAUI.

## Consequences

### Positive

Consistent feature UI, strong local data tooling, and direct native integration where Android requires it.

### Negative

Reminder reliability remains bounded by Android/OEM background and notification policies.

### Risks

Platform-channel drift and OEM battery restrictions. Mitigate with minimal adapters, device testing, clear owner guidance, and recovery on next app execution.

## Security and Privacy Impact

Private-key references use Android Keystore-backed storage; raw keys are not held in Dart UI state.

## Operational Impact

APK signing, permissions, notification channels, and supported Android versions require release documentation.

## Migration or Rollback Plan

SQLite schema is versioned and tested; Android upgrade handling must preserve alarms and local outbox state.

## Validation

Test cold start, offline capture, alarms, notification settings, reboot/restart recovery, pairing, revocation, and accessibility on supported devices.

## Future Considerations

iOS support would require a separate ADR and native scheduling analysis.

## Supersedes / Superseded By

None.
