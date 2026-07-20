# FocusLog Security Model

## Status

Implemented security baseline for the pairing-only personal ownership model. Release still requires Windows installer and Android-device validation.

## Security objectives

- Protect a personal owner's journal content and device trust relationships.
- Permit offline operation without weakening local data durability.
- Prevent unauthorized devices from synchronizing or pairing themselves.
- Support prompt device revocation.
- Limit diagnostics and operations access so journal content is not exposed by default.
- Preserve owner control without passwords, user accounts, administrative roles, or server-side impersonation.

## Trust model

The system has one personal owner namespace and multiple trusted devices. The first synchronized device is the owner device. Each trusted device owns an independent asymmetric key pair. The private key stays on that device; the public key is registered with the backend.

The backend is trusted to store and synchronize the owner's records and to verify device proofs. It is not a user identity provider, account administrator, or recovery authority. No product feature permits an operator to sign in as the owner, reset a password, impersonate a device, or grant a role.

## Device authentication

Traditional authentication is intentionally excluded:

- no user registration or login;
- no email/password verifier or password recovery;
- no cookie session, access token, or refresh token;
- no roles, administrator accounts, memberships, or RBAC;
- no server-issued credential that can act independently of a device key.

For each signed request, the device supplies its identifier, UTC timestamp, unique nonce, method/path, canonical body hash, protocol version, and signature. The server verifies all fields, device ownership, public-key signature, timestamp freshness, nonce uniqueness, and revocation state. TLS protects transport. Request and WebSocket handshake verification must be shared code, not duplicated security logic.

## Pairing ceremony

1. Candidate device creates a fresh key pair and one-time pairing request.
2. Candidate displays a request ID and public-key fingerprint as a QR code or equivalent short transfer.
3. Owner device verifies the displayed fingerprint and explicitly approves the pairing request by signing it.
4. Backend verifies that approval and records the candidate public key as a paired device.
5. Candidate synchronizes using its own key; it never receives an owner private key.

Pairing requests are short-lived, single-use, bound to a candidate key fingerprint, rate-limited, and invalidated on cancellation. The candidate cannot approve itself. Pairing must be visible in the owner-device audit trail.

## Revocation and loss

The owner device can revoke a paired device. The backend immediately denies new signed REST and WebSocket requests for the revoked key, invalidates pending pairing attempts involving it, and emits a revocation event to remaining trusted devices. Revocation is recorded in a redacted audit trail.

Revocation cannot reliably erase an offline or hostile device. The product must state this clearly and must not claim remote wipe. Historical data created by the device remains in the owner history.

Loss of all trusted devices has no service-operated reset path. A full encrypted backup contains the source device credential inside the authenticated encrypted payload, allowing the same trusted device identity to be recovered after reinstall. Encrypted exports omit credential recovery material. A recovery from a revoked credential, or promotion of a recovered non-owner device when no owner device remains, still requires a future owner-device promotion protocol.

## Data protection

- TLS is mandatory for all backend communication; WSS is mandatory for events.
- Local SQLite databases are encrypted at rest with a supported SQLite encryption distribution.
- Device-key references are protected by Windows credential storage or Android Keystore-backed storage. Raw private keys are never exposed to Electron renderer or Flutter UI state.
- PostgreSQL runs on encrypted storage; production backups are encrypted and integrity checked.
- Journal body text, tags, and detailed activity metadata are excluded from ordinary logs, telemetry, error reports, and metrics.
- Backup/export actions require explicit owner initiation and confirmation; restore validates format, integrity, and destructive consequences before replacing local data.

Desktop uses SQLCipher-compatible SQLite with a random 256-bit key protected by Electron `safeStorage` (DPAPI on Windows). Android uses SQLCipher with a random 256-bit key held in Keystore-backed `flutter_secure_storage`; Android automatic application backup is disabled so an unusable wrapped key is not restored onto another installation.

Portable backups and exports use a random 256-bit recovery key displayed as `FLRK1-<base64url>`. HKDF-SHA-256 derives an archive key with a per-archive 256-bit salt. The payload is encrypted and authenticated with AES-256-GCM, includes a SHA-256 integrity digest, format/schema versions, and is written atomically. The recovery key is not an account password and is never sent to the backend. Restore authenticates and schema-validates the archive, imports into a staging database, checks referential and SQLite integrity, and only then replaces live data transactionally.

Permanent deletion first deletes synchronized owner data transactionally when a backend is configured, then destroys local database, backup, and device keys before deleting SQLite, WAL, and SHM files. Key destruction is the effective erasure boundary on flash storage; FocusLog does not claim reliable physical-sector overwrite.

## Secure application boundaries

Electron uses context isolation, sandboxed renderers, restrictive content-security policy, typed narrow preload APIs, and no renderer Node integration. Backend input is schema validated and parameterized through Prisma or reviewed parameterized SQL. Generated API clients and manual platform adapters validate all untrusted cross-boundary data.

Flutter uses platform channels with typed, minimal payloads. Android adapters use only approved notifications, alarms, foreground-service, and full-screen mechanisms. Neither platform attempts to bypass lock-screen, security, accessibility, notification, or battery-management controls.

## Operational security

Docker images run with minimal privileges, pinned base images, non-secret configuration, health checks, and vulnerability scanning in GitHub Actions. Production secrets are injected by the deployment environment, never committed, baked into an image, or included in installer assets.

Operational personnel receive no normal path to journal content. Exceptional support access, if ever introduced, requires a separate product decision, explicit owner authorization, auditability, and a revision of this document; it is not part of the current design.

## Required security validation

- Signature, nonce, timestamp, owner binding, and revocation tests for REST and WebSocket.
- Candidate self-pairing, expired pairing, replay, and fingerprint mismatch tests.
- Local encrypted-store, backup encryption, and secret-redaction tests.
- Renderer/IPC boundary tests and Android platform-channel validation.
- Dependency, container, static-analysis, and secret-scanning checks in GitHub Actions.
- Threat-model review of owner-device loss and encrypted-backup recovery before release.

## Remaining security decision

Recovery-key derivation and credential recovery are implemented without passwords, email, administrators, or server-held substitute keys. A backend protocol for promoting a recovered, previously paired non-owner device when every owner device is lost remains out of scope and must be resolved before claiming recovery from every possible all-device-loss scenario.
