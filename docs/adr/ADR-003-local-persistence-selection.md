# ADR-003: Local Persistence Selection

## Status

Accepted

## Date

2026-07-20

## Decision Owners

FocusLog owner and lead architect.

## Context

Desktop and Android must remain useful offline, survive crashes, queue operations durably, support local full-text search, and protect journal data at rest.

## Decision Drivers

Transactions, crash recovery, encrypted storage, migrations, FTS, queue durability, and library maturity.

## Decision

Use encrypted SQLite on Electron and Flutter. The local schema stores domain state, immutable outbox operations, inbox cursor, conflicts, and FTS indexes. Device identity material remains in OS-protected secure storage rather than ordinary database fields.

## Alternatives Considered

Plain SQLite, file-based JSON stores, Realm, and remote-only persistence.

## Consequences

### Positive

Fast atomic local writes, offline search/reports, portable database semantics, and durable recovery.

### Negative

Encrypted SQLite native dependencies and cross-platform migration testing add delivery complexity.

### Risks

Platform binding incompatibility. Mitigate by selecting and validating supported encryption adapters early on Windows and Android.

## Security and Privacy Impact

Local journal data is encrypted at rest; raw private keys are not stored in the UI or database.

## Operational Impact

Restore and migration procedures must verify encrypted database integrity before normal operation resumes.

## Migration or Rollback Plan

Use append-only, tested local migrations. Failed migrations recover from validated pre-migration backup rather than partial rollback.

## Validation

Test atomic action-plus-outbox commits, process interruption, upgrades, FTS, encryption, backup, and restore on both platforms.

## Future Considerations

Revisit only if a replacement preserves SQLite-equivalent transaction, offline, and encryption guarantees.

## Supersedes / Superseded By

None.
