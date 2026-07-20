# ADR-004: Synchronization Architecture

## Status

Accepted

## Date

2026-07-20

## Decision Owners

FocusLog owner and lead architect.

## Context

Multiple trusted devices must synchronize while offline operation, retries, concurrent changes, deletion, and reminder races remain safe.

## Decision Drivers

Local-first behavior, idempotency, conflict preservation, deletion safety, predictable recovery, and platform-neutral contracts.

## Decision

Use immutable signed operations with ULID operation IDs, a transactional local outbox, REST batch push/cursor pull, PostgreSQL owner-wide change sequences, durable tombstones, and explicit revision conflicts. Use WebSocket only for advisory presence, coordination, and sync-available hints.

## Alternatives Considered

WebSocket-only replication, last-write-wins updates, direct database replication, and cloud-provider proprietary sync.

## Consequences

### Positive

Offline safety, retry-safe behavior, deterministic catch-up, and no silent loss of authored text.

### Negative

The protocol, cursor handling, and conflict UI require deliberate implementation and testing.

### Risks

Stale devices and partitions. Mitigate with tombstone retention, snapshot hydration, idempotency, and race tests.

## Security and Privacy Impact

Operations are device-signed and scope-checked to one owner namespace; WebSocket is not trusted as durable state.

## Operational Impact

Monitor queue failures, cursor lag, rejected operations, and reconnect behavior without logging content.

## Migration or Rollback Plan

Protocol version fields permit additive evolution. Clients unable to satisfy a supported version receive `resync-required` or upgrade guidance.

## Validation

Run offline, duplicate, reconnect, crash, conflict, tombstone, revoke, and partition tests.

## Future Considerations

Optional end-to-end encrypted synchronization would require a new ADR and migration design.

## Supersedes / Superseded By

None.
