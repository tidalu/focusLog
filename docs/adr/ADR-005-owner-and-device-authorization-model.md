# ADR-005: Owner and Device Authorization Model

## Status

Accepted

## Date

2026-07-20

## Decision Owners

FocusLog owner and lead architect.

## Context

FocusLog is a personal system with one owner and several trusted devices. It must authorize synchronization without introducing traditional accounts or administrative users.

## Decision Drivers

Simple personal ownership, secure pairing, revocation, offline use, no password recovery surface, and server-independent device trust.

## Decision

Use an owner device and paired-device model. The first synchronized device generates an owner namespace and asymmetric key pair. Each paired device creates an independent key pair and is explicitly approved by the owner device through a short-lived fingerprint-verified pairing ceremony. Requests are signed; revocation disables a device public key.

There are no users table, login, password, access token, refresh token, role, administrator, email recovery, or server-side impersonation flow.

## Alternatives Considered

Email/password accounts, OAuth/OIDC, magic links, server-issued refresh tokens, and role-based administration.

## Consequences

### Positive

Small attack surface, clear personal ownership, independent device revocation, and no account-management subsystem.

### Negative

Loss of all trusted devices cannot use a service reset; encrypted-backup recovery is required.

### Risks

Weak pairing UX or lost owner device. Mitigate with fingerprint confirmation, short-lived pairing, audit records, and a tested backup recovery ceremony.

## Security and Privacy Impact

Private keys remain in platform-secure storage. TLS, signed requests, nonces, timestamps, and revocation checks protect remote access.

## Operational Impact

The service stores device public keys and owner-scoped data only; it does not operate user accounts.

## Migration or Rollback Plan

Greenfield decision. Any future identity model needs a superseding ADR and explicit migration; it must not be added incidentally.

## Validation

Test owner bootstrap, pairing, self-pair prevention, replay rejection, revocation, and all-device-loss backup recovery.

## Future Considerations

Specify encrypted-backup recovery material before release.

## Supersedes / Superseded By

None.
