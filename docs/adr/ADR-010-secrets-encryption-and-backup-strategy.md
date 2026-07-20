# ADR-010: Secrets, Encryption, and Backup Strategy

## Status

Accepted and implemented. Non-owner-device promotion after total owner-device loss remains a future protocol decision.

## Date

2026-07-20

## Decision Owners

FocusLog owner and lead architect.

## Context

FocusLog stores sensitive personal journal content and relies on device keys rather than passwords. It requires local encryption, protected device-key storage, encrypted backups, rotation, recovery, and log redaction.

## Decision Drivers

Privacy, offline durability, no password/account recovery, secure revocation, portable backup, and recoverability after device loss.

## Decision

Use OS-protected storage for device-key material and random local database keys, SQLCipher-compatible encrypted SQLite locally, encrypted PostgreSQL storage/backups operationally, TLS in transit, and content-redacted diagnostics. Windows uses DPAPI-backed Electron `safeStorage`; Android uses Keystore-backed secure storage and disables Android auto-backup.

Portable archives use a random 256-bit `FLRK1` recovery key, HKDF-SHA-256 with a random 256-bit salt, and AES-256-GCM with a 96-bit nonce. The envelope carries format/schema versions and a SHA-256 payload digest. Full backups include the source device credential only inside the encrypted payload so reinstall can recover that signed identity; data exports omit it. Restore authenticates and validates in a staging database before transactional replacement. The backend never receives the recovery key.

Permanent deletion removes backend owner data transactionally where configured, destroys protected local keys, and removes local database artifacts. This is cryptographic erasure rather than an unverifiable SSD overwrite claim.

## Alternatives Considered

Plain local databases, unencrypted exports, password-account recovery, server-held device secrets, and optional encryption.

## Consequences

### Positive

Strong protection of local and backup data while preserving the pairing-only ownership model.

### Negative

Recovery requires preserving a separate high-entropy recovery key; there is intentionally no convenience reset flow. Restoring a revoked credential does not re-authorize it, and a paired non-owner credential cannot yet promote itself when every owner device is lost.

### Risks

Key loss and unusable backups. Mitigate with explicit backup verification, recovery drills, owner education, and a tested recovery ceremony.

## Security and Privacy Impact

Private keys are never logged or exposed to UI runtimes. Content is excluded from ordinary telemetry and diagnostics. Secret rotation and device revocation are auditable.

## Operational Impact

Deployment must supply, rotate, and audit backend secrets; backup retention and restore testing are mandatory operational tasks.

## Migration or Rollback Plan

Backup formats include version and encryption metadata. New formats require compatible readers or a documented export/re-encryption migration.

## Validation

Test secure storage, encryption at rest, backup creation, integrity validation, restore, redaction, secret scanning, and owner-device recovery.

## Future Considerations

Optional end-to-end encrypted synchronization is out of scope and requires a new ADR.

## Supersedes / Superseded By

None.
