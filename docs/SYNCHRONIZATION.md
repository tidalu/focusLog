# FocusLog Synchronization Protocol

## Status

Approved protocol design. The OpenAPI and event schemas implemented later are the machine-readable source of truth and must conform to this document.

## Goals and non-goals

Synchronization converges a single personal owner's data between trusted devices while preserving offline capture, idempotency, deletions, and conflicting authored text. It does not provide collaboration, shared workspaces, multi-user authorization, or real-time remote control.

## Authority model

The local SQLite store is authoritative for an interaction until the device can synchronize. PostgreSQL is authoritative for the shared accepted history and owner-wide change sequence. The backend validates device signatures and operation rules; it does not require users to log in.

WebSocket presence is advisory. REST synchronization is authoritative and recoverable.

## Operation envelope

Every mutable action is represented as an immutable operation:

```json
{
  "protocolVersion": 1,
  "operationId": "ULID",
  "ownerId": "opaque-owner-id",
  "deviceId": "opaque-device-id",
  "deviceSequence": 42,
  "entityType": "check_in",
  "entityId": "ULID",
  "kind": "check_in.revise",
  "baseVersion": "ULID-or-null",
  "occurredAt": "UTC RFC 3339 instant",
  "payload": {},
  "signature": "base64url"
}
```

The signed canonical representation includes the body hash, timestamp, nonce, device identity, and operation envelope. A device must never reuse an operation ID for different content.

## Push and pull

### Push

`POST /api/v1/sync/push` accepts bounded ordered batches. For every operation it returns one of: `accepted`, `duplicate`, `conflict`, or `rejected` with a stable machine-readable reason.

- `accepted` means the operation was applied transactionally and assigned a server change sequence.
- `duplicate` returns the original durable result for a prior operation ID.
- `conflict` preserves the relevant content and supplies references required for local conflict resolution.
- `rejected` remains visible in local diagnostics and is never silently removed from the outbox.

### Pull

`GET /api/v1/sync/pull?cursor={sequence}` returns a bounded, ordered page of owner-scoped changes after that cursor and a next cursor. A client applies the full page and advances its local cursor in one transaction. If the cursor has expired or is invalid, the server directs a paginated snapshot hydration followed by normal cursor pull.

### Journal section payloads

`check_in.create`, `check_in.revise`, and `reminder.complete` operations carry the immutable raw body plus an ordered `sections` array. Each section includes its ULID, normalized category path segments, canonical path, body, optional string metadata, and position. The backend validates identifiers, path bounds, unique positions, and metadata shape before materialization.

The raw body remains the conflict source of truth. Section data is a deterministic, query-oriented projection and is never allowed to overwrite a sibling authored revision. During rolling upgrades, a receiver that gets an older operation without `sections` runs the same deterministic parser locally; duplicate operations remain harmless because the operation envelope and section constraints are idempotent.

## Offline queue and retries

1. Validate locally and write the mutation, audit row, and outbox operation atomically.
2. Attempt synchronization when a trusted network path exists.
3. Retry transient failures with bounded exponential backoff and random jitter.
4. Stop automatic retry for permanent protocol or revocation errors and surface a recoverable diagnostic.
5. Retain outbox records until durable acknowledgement. Never discard an operation because the UI has moved on.
6. On application restart, resume from durable outbox and cursor state.

## Idempotency and ordering

The backend deduplicates with unique `(owner_id, operation_id)`. It can accept an operation more than once only as a duplicate acknowledgement. Server change sequence is monotonic per owner namespace and is used solely for pull ordering; it is not a replacement for the device-local sequence.

The protocol does not assume ordered network delivery. A client may receive a WebSocket hint before a REST acknowledgement, may retry a timed-out request, and may reconnect after missed events without creating duplicate check-ins.

## Conflict and deletion rules

| Situation                                   | Rule                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Different fields changed from a common base | Merge automatically when unambiguous                                                                             |
| Same authored text changed concurrently     | Preserve immutable sibling revisions and create a visible conflict                                               |
| Same reminder transition delivered twice    | Deduplicate by operation ID and occurrence transition rules                                                      |
| Completion on two devices during partition  | One canonical completion; preserve duplicate action as reconciled audit evidence, never create a second check-in |
| Delete races with stale edit                | Tombstone remains current; preserve the edit as recoverable conflict history                                     |
| Stale device replays deleted entity         | Reject resurrection and send current tombstone in pull data                                                      |

Tombstones remain available for a documented retention window that exceeds supported device-offline and backup-restore periods. Pruning requires a server-side safety policy and a migration test.

## WebSocket coordination

Endpoint: `wss://{host}/v1/events`.

Frames are JSON Schema validated and include protocol version, owner ID, device ID, timestamp, nonce, and device signature where the frame changes state. Main frames are:

- `hello` and `welcome` for negotiated protocol/cursor/capabilities.
- `presence.heartbeat` for app visibility and reminder capability.
- `reminder.claim-request` and `reminder.claim-granted` for a short-lived presentation claim.
- `reminder.resolved` to supersede equivalent displays after an outcome.
- `sync.available` as a hint to use REST pull.
- `device.revoked`, `error`, and `resync-required`.

Presence expires automatically. Normal target preference is foreground-capable device, then most recently active capable device, then owner preference. A claim has a short TTL. WebSocket loss never blocks local reminder presentation or completion.

## Local-only and transition rules

Local-only mode has no device registration, remote owner namespace, WebSocket connection, or synchronization queue. Enabling synchronization is an explicit previewed migration: the application creates an owner device, snapshots local entities into operations, warns that data will be uploaded, and requires confirmation. Disabling synchronization does not silently delete remote data or credentials; the owner chooses a documented detach/export action.

## Required tests

- Offline create, edit, delete, session and reminder actions synchronize after reconnect.
- Retried push and duplicate WebSocket frames create no duplicate visible entry.
- Restart during outbox processing resumes safely.
- Cursor gap, expired cursor, snapshot hydration, and reconnect converge correctly.
- Concurrent text edits retain both authored versions.
- Tombstone/edit races do not resurrect deleted data.
- Revoked devices cannot push, pull, or connect after revocation is observed.
- Partitioned devices resolving the same reminder do not produce duplicate check-ins.
