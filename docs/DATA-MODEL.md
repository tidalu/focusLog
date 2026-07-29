# FocusLog Data Model

## Status

Implemented logical and physical data design. Prisma, desktop SQLite, and mobile Drift migrations implement this model without multi-user concepts.

## Data principles

- Every synchronized record belongs to exactly one opaque `owner_id`.
- `owner_id` represents the personal installation namespace, not a user account or SaaS tenant.
- There are no users, organizations, memberships, roles, administrators, passwords, sessions, or refresh tokens.
- Devices are cryptographic principals, not users. A device has a public key, capability metadata, lifecycle state, and revocation state.
- User-visible changes have immutable operation IDs and audit metadata.
- Deletion is represented by a tombstone until the documented retention period expires.
- UTC instants are canonical. Original local time and IANA time-zone context are retained where interpretation matters.

## Identifier and time conventions

All public entity and operation IDs are ULIDs. `owner_id` and `device_id` are opaque, non-guessable identifiers. Timestamps are UTC RFC 3339 instants. `timezone_id` uses an IANA zone name. Local display values are derived, never substituted for canonical instants.

## Shared PostgreSQL entities

| Entity                  | Key fields                                                                                  | Purpose                                                |
| ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `owners`                | `id`, `created_at`, `status`                                                                | Personal synchronization namespace and lifecycle only  |
| `devices`               | `id`, `owner_id`, `public_key`, `is_owner_device`, `platform`, `capabilities`, `revoked_at` | Trusted device identity and lifecycle                  |
| `pairing_requests`      | `id`, `owner_id`, `candidate_public_key`, `expires_at`, `approved_at`, `consumed_at`        | One-time device pairing ceremony                       |
| `focus_modes`           | `id`, `owner_id`, policy fields, `version`, tombstone metadata                              | Reusable reminder configuration                        |
| `focus_sessions`        | `id`, `owner_id`, `focus_mode_id`, schedule snapshot, lifecycle fields                      | Bounded or open-ended focus period                     |
| `reminder_occurrences`  | `id`, `owner_id`, `session_id`, `scheduled_at`, `state`, `effective_at`                     | Stable reminder instance and current state             |
| `reminder_transitions`  | `id`, `occurrence_id`, `from_state`, `to_state`, `acting_device_id`, timing fields, reason  | Immutable lifecycle and audit history                  |
| `check_ins`             | `id`, `owner_id`, `occurrence_id`, `current_revision_id`, tombstone metadata                | Stable logical journal entry                           |
| `check_in_revisions`    | `id`, `check_in_id`, `parent_revision_id`, `body`, conflict fields                          | Immutable, lossless authored content and branches      |
| `log_sections`          | `id`, `check_in_id`, `revision_id`, `category_id`, `position`, `body`, `metadata`           | Ordered structured sections materialized per revision  |
| `categories`            | `id`, `owner_id`, `parent_id`, `path`, `depth`                                              | Automatically inferred hierarchical taxonomy           |
| `tags`, `check_in_tags` | owner-scoped IDs and names                                                                  | Optional non-category classification                   |
| `sync_operations`       | `owner_id`, `operation_id`, `device_id`, `received_at`, result                              | Idempotency record for accepted or rejected operations |
| `sync_changes`          | `owner_id`, `sequence`, `operation_id`, entity reference                                    | Durable ordered feed used for cursor pull              |
| `entity_tombstones`     | owner/entity identity, version, deleted instant, retention expiry                           | Prevent stale-device resurrection                      |
| `device_presence`       | `device_id`, visibility/capabilities, `expires_at`                                          | Short-lived, advisory reminder coordination state      |
| `backup_manifests`      | snapshot ID, schema version, integrity metadata                                             | Backup/restore validation without content logging      |
| `audit_events`          | owner/entity reference, non-content event metadata                                          | Redacted operational and recovery audit trail          |

## Device state and constraints

`devices` permits one active `is_owner_device = true` record per owner namespace. A paired device can be active, revoked, or retired. A revoked device public key must never authenticate a new request.

`pairing_requests` are short-lived, single-use, bound to the candidate public-key fingerprint, and cannot be approved by the candidate itself. Request payloads contain no owner private material.

The owner namespace does not create a server-owned person profile. It exists only to partition a personal collection of devices and synchronized data.

## Check-ins, revisions, and conflicts

`check_ins` represents the stable entry identity used in URLs, exports, reports, and reminder links. `check_in_revisions` records immutable content revisions. A regular edit advances `current_revision_id` with optimistic base-version validation.

If two devices edit the same authored text from the same base version, neither revision is discarded. The service records both branches and the local client creates a `sync_conflicts` item until the owner chooses a resolved revision. A resolution is another immutable revision that cites both parents.

Deleting an entry writes a tombstone and preserves prior revisions for the tombstone retention period. If a stale device submits a new revision after deletion, the revision is retained as conflict history but the deleted entry is not automatically restored.

### Structured journal sections

The raw revision body remains the lossless source for editing and conflict preservation. Every revision also materializes one or more ordered `log_sections` for display, search, and analytics:

- A header line containing adjacent tokens such as `<study><leetcode>` starts a section with the path `study/leetcode`.
- A later tagged header starts another section without creating another check-in.
- Leading or wholly untagged text becomes an `Uncategorized` section with no category foreign key.
- Optional full-line metadata in the form `#key=value` is stored as section JSON while the original line remains in the immutable revision body.
- Category segments are normalized to trimmed lowercase identity. Each prefix is a taxonomy node, so `study` and `study/leetcode` can both be aggregated efficiently.
- The unique `(revision_id, position)` constraint preserves deterministic order, while section IDs permit idempotent cross-device materialization.

Reports count sections, including roll-up to every ancestor path. Timelines continue to count and render the parent check-in as one event containing ordered sections.

## Reminder data

`reminder_occurrences` has one stable identity from creation through terminal outcome. Its current state is materialized for fast queries; `reminder_transitions` is the audit source for every state change.

Required occurrence timing fields include `scheduled_at`, `presented_at`, `resolved_at`, `original_scheduled_at`, `timezone_id`, and optional local scheduling context. A completion references exactly one occurrence; skipped, missed, snoozed, and emergency-dismissed outcomes must not create a completed check-in.

## Local SQLite data model

The local schema mirrors all owner-scoped domain entities needed for offline behavior, plus these local operational tables:

| Local table         | Purpose                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| `outbox_operations` | Immutable operations pending acknowledgement or retry                         |
| `inbox_cursor`      | Last fully applied owner change sequence                                      |
| `sync_conflicts`    | Locally visible unresolved conflicts and resolution state                     |
| `local_metadata`    | Encrypted references to device identity, migration state, and local-only mode |
| `log_sections_fts`  | FTS5 index of independently searchable section bodies                         |
| `sync_failures`     | Recoverable failed-operation diagnostics without journal content              |

A local mutation, relevant transition/audit row, and outbox insert must be one SQLite transaction. Applying remote mutations and advancing `inbox_cursor` must likewise be one transaction.

## Indexes and query design

- Unique index on `(owner_id, operation_id)` for idempotency.
- Unique sequence index on `(owner_id, sequence)` for cursor synchronization.
- Query indexes on owner plus scheduled/resolved instants, session IDs, focus-mode IDs, device IDs, and tombstone status.
- FTS5 indexes local section bodies; category-path, tag, and session filters join through indexed relations.
- PostgreSQL full-text search ranks section bodies and category paths and returns matching sections grouped under their parent check-in.
- Report queries index effective event instant and owner report context; the yearly heatmap aggregates from local occurrence states by selected report time zone.

## Encryption, migration, and backup decisions

SQLite is encrypted at rest using a supported SQLite encryption distribution. Device keys are retained through OS-protected storage, not regular database columns. PostgreSQL uses encrypted storage and encrypted backups in the deployment environment; journal content is omitted from diagnostics and ordinary operational logs.

Database migrations are append-only, versioned, and tested for clean installation, supported upgrade, backup restore, and stale-device synchronization. A backup manifest includes logical schema version, format version, integrity digest, source owner namespace, and encryption metadata. Restore validates before replacing any local database.

## Explicit exclusions

The schema must not add tables or fields for user accounts, email addresses, password verifiers, password-reset flows, refresh/access tokens, team membership, tenant administration, RBAC, server-side administrative impersonation, or employee monitoring.
