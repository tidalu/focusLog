# FocusLog Architecture

## Status

Approved architecture baseline. Documentation is complete enough to begin implementation only after explicit implementation approval.

## Scope

FocusLog is a personal, single-owner, local-first activity journal for Windows and Android. It is not a multi-user SaaS product and has no organization, tenant, membership, role, administrator, login, password, or refresh-token concept.

The product has one personal owner and one or more trusted devices. A device becomes trusted through explicit pairing with the owner device. The owner device can revoke a paired device. Device maintenance is a personal product capability, not an administrative subsystem.

The Foundation SRS remains the requirements baseline. This document and the related architecture documents record the approved interpretation where the Foundation SRS intentionally deferred detailed requirements.

## Technology baseline

| Area                   | Decision                                                  |
| ---------------------- | --------------------------------------------------------- |
| Backend                | TypeScript, Fastify, Prisma                               |
| Shared persistence     | PostgreSQL                                                |
| Desktop                | Electron and TypeScript                                   |
| Android                | Flutter/Dart with narrow Kotlin platform adapters         |
| Local persistence      | SQLite                                                    |
| Deployment             | Docker                                                    |
| Continuous integration | GitHub Actions                                            |
| Contract format        | OpenAPI 3.1 for REST and JSON Schema for WebSocket frames |

## Final architecture

```text
 +---------------------+                 +-----------------------------------+
 | Electron desktop    |                 | Fastify backend                   |
 |                     | HTTPS / WSS     |                                   |
 | SQLite              +---------------->+ Device pairing and revocation      |
 | outbox + sync       <----------------+ Sync and presence gateway          |
 | reminder engine     |                 | PostgreSQL shared history          |
 +----------+----------+                 +----------------+------------------+
            |                                             |
            | native Windows APIs                         | encrypted backups
            v                                             v
  notifications, tray, overlay                      backup storage

 +---------------------+
 | Flutter Android     |
 |                     |
 | SQLite              |
 | outbox + sync       |
 | reminder engine     |
 +----------+----------+
            |
            v
  Android alarms, notifications, permitted full-screen UI
```

Every device is operationally autonomous. It commits domain changes to SQLite before it reports success to the owner. The transactional outbox synchronizes later when connectivity is available. This allows focus sessions, reminders, check-ins, history, search, daily reports, and the yearly heatmap to remain useful offline for locally available data.

PostgreSQL is the durable convergence point for synchronized installations. The backend does not control user interaction and does not schedule a device in place of its local reminder engine. REST carries durable mutations and recovery; WebSocket only accelerates presence and reminder coordination.

## Data flow

### Local action and synchronization

1. The owner creates a check-in, changes a session, or transitions a reminder.
2. The device validates the action locally.
3. One SQLite transaction writes the domain state, immutable audit transition, and immutable outbox operation.
4. The UI reports success after that transaction commits; network availability is not required.
5. The synchronization worker sends queued operation batches through the signed REST protocol.
6. The backend verifies the device, applies each new operation atomically, and assigns an owner-wide change sequence.
7. The device records acknowledgements and pulls changes after its last committed cursor.
8. Applying remote changes and advancing the cursor is one SQLite transaction.

### Pairing and revocation

1. A new device generates a device key pair and a short-lived pairing request.
2. The owner device scans or enters the one-time pairing request and verifies its fingerprint.
3. The owner device signs a pairing approval.
4. The backend records the paired device public key and allows it to synchronize.
5. The owner device can later revoke that device. The backend rejects all future signed requests from it and sends a revocation event to other devices.

## Component responsibilities

| Component               | Responsibilities                                                                                           | Must not do                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Electron main process   | SQLite access, secure-key access, synchronization, Windows lifecycle, tray, overlay creation, IPC boundary | Expose Node, filesystem, database, or private keys to the renderer  |
| Electron renderer       | Accessible desktop UI and view state                                                                       | Perform privileged OS or database operations directly               |
| Flutter application     | Mobile UI, domain workflows, local reports and history                                                     | Store raw private keys in UI state                                  |
| Android Kotlin adapters | Alarms, notification channels, permitted full-screen presentation, platform lifecycle signals              | Bypass Android notification, lock-screen, or battery controls       |
| Local domain store      | Durable state, migrations, FTS, outbox, inbox cursor, conflicts                                            | Depend on network availability for a local commit                   |
| Reminder engine         | Persisted occurrence lifecycle, recovery, local presentation policy                                        | Treat in-memory timers or WebSocket delivery as authoritative state |
| Sync worker             | Idempotent push/pull, cursor recovery, retry, conflict surfacing                                           | Silently discard failed operations or conflicting content           |
| Fastify backend         | Device verification, pairing, revocation, operation sequencing, synchronization, presence routing          | Act as a multi-user access-control or administrator system          |
| PostgreSQL              | Shared owner-scoped records, transactions, sequence ordering, backups                                      | Replace local-device persistence for offline actions                |

## Ownership and device trust

There is no traditional account registration or sign-in. The first synchronized installation creates an opaque owner identifier and its own asymmetric key pair, then registers itself as the owner device. The device private key remains in OS-protected storage; the backend stores its public key, device identifier, owner identifier, and lifecycle metadata.

All REST requests and WebSocket handshakes are device-authenticated with a device ID, timestamp, nonce, request-body hash, and signature. The backend verifies the signature against the registered public key, rejects replayed or expired requests, and checks revocation state. TLS is mandatory. This is cryptographic device authentication only; it has no password, user session, access token, refresh token, or server-side login flow.

Pairing creates a new independent device key pair. No private key is copied from the owner device. The owner device remains the normal authority for pairing and revocation. If every trusted device is lost, recovery requires a previously created encrypted backup containing recovery material; the service does not provide password, email, or administrator recovery.

## Functional architecture decisions

- Local-only mode creates no remote owner record, does not start synchronization, and never uploads data. Moving into synchronized mode is explicit, previewed, and reversible until confirmed.
- Reports, heatmaps, and search query local SQLite, so they remain usable offline.
- Mutations are immutable operations with ULID identifiers. Retrying an operation cannot create a second user-visible change.
- Non-overlapping concurrent edits merge. Conflicting user-authored text is preserved in immutable revisions and surfaced for resolution.
- Deletion creates a tombstone. A stale edit cannot silently recreate deleted content.
- WebSocket delivery can be duplicated, delayed, or lost. REST cursor catch-up is the recovery mechanism.
- Reminder presentation is coordinated best-effort. A network partition can cause duplicate presentation, but one completion safely resolves the shared occurrence.

## Reporting requirements

### Daily report

`REP-001` The application must provide a daily report for every date represented in locally available history, including offline.

`REP-002` The report must display: completed check-ins; scheduled, completed, snoozed, skipped, emergency-dismissed, missed, and pending occurrence counts; completion rate; response-delay summary; focus-mode and category breakdowns when data exists; overlapping sessions; and the complete chronological log.

`REP-003` Completed, skipped, emergency-dismissed, and missed outcomes must remain distinct. Every metric whose meaning depends on those outcomes must identify its numerator and denominator.

`REP-004` The report uses the owner-selected report time zone by default, preserves original time-zone context in details, and never changes stored instants when the displayed time zone changes.

### Yearly heatmap and day log

`REP-010` The application must provide an accessible yearly heatmap for any selected year, including leap years.

`REP-011` A day cell represents that date's completion rate. A no-terminal-outcome day must be visually distinct from a zero-completion-rate day. A legend explains every band and state.

`REP-012` Color is not the sole carrier of meaning: each cell has its date, numeric value, metric definition, report time zone, and text alternative.

`REP-013` Every day cell is keyboard reachable, screen-reader usable, and available in a non-color tabular alternative.

`REP-006` Clicking, tapping, or keyboard-activating a daily-report or heatmap day opens that day's complete chronological log.

`REP-007` The log includes every check-in, reminder occurrence, transition, session boundary, and relevant synchronization/conflict indicator for the selected reporting day. Filters may hide entries only after the complete view is available.

`REP-008` An item displays its type, pertinent scheduled/presented/submitted time, focus mode, session, outcome, device when available, and time-zone context. Opening its detail preserves selected-day context.

`REP-009` Events belong to a reporting day by their effective instant in the selected report time zone. Overlapping sessions appear as context; individual reminder transitions retain their own event-day assignment.

## Implementation boundary

No production application code has been written under this architecture. Before implementation, the ADRs in `docs/adr/`, the data model, synchronization protocol, reminder specification, and security model must remain mutually consistent. The unresolved policy decisions at the end of `docs/REMINDERS.md` and `docs/SECURITY.md` require final product approval before their dependent features are built.
