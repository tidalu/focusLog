# Database Design and Migration Guide

## Status

Foundation implementation: PostgreSQL/Prisma, Electron SQLite, and Flutter Drift schemas are present. Feature-specific write services have not been implemented.

## Stores and ownership boundary

FocusLog uses three stores with the same logical owner-scoped data model:

| Store             | Location              | Authority                                                                       |
| ----------------- | --------------------- | ------------------------------------------------------------------------------- |
| PostgreSQL        | Synchronized backend  | Durable accepted shared history and ordered synchronization feed                |
| SQLite            | Electron main process | Immediate desktop capture, local history, outbox, and offline search foundation |
| SQLite with Drift | Flutter application   | Immediate Android capture, local history, outbox, and offline operation         |

`owners` is an opaque personal namespace only. It is not a user account. The schema contains no login, password, email, token, role, administrator, organization, or membership table.

## Identifiers and time

- Public synchronized IDs are ULID strings stored as `VARCHAR(26)` in PostgreSQL and `TEXT` in SQLite.
- Server timestamps use `TIMESTAMPTZ(3)`. SQLite stores UTC `DateTime` values and retains `timezone_id` wherever a local-time interpretation is required.
- `version` is an operation/version ULID on mutable synchronized records.
- `operation_id` is immutable and idempotent. `(owner_id, device_id, device_sequence)` is unique.
- The server's owner-wide `sequence` is unique per owner and drives cursor pull.

## Main entity groups

| Group               | Tables                                                                          |
| ------------------- | ------------------------------------------------------------------------------- |
| Ownership           | `owners`, `devices`, `device_pairings`, `settings`                              |
| Focus and reminders | `focus_modes`, `focus_sessions`, `reminder_occurrences`, `reminder_transitions` |
| Journal             | `check_ins`, `check_in_revisions`, `tags`, `categories`, `check_in_tags`        |
| Synchronization     | `sync_operations`, `sync_cursors`, `conflicts`, `tombstones`                    |
| Portability         | `backup_manifests`                                                              |

`check_in_revisions` preserves concurrent authored content instead of silently overwriting it. `conflicts` retains the local and remote operation context until the owner resolves or dismisses it.

## Tombstones

Focus modes, sessions, check-ins, tags, and categories have `deleted_at`. Their synchronized deletion also writes a `tombstones` row keyed by `(owner_id, entity_type, entity_id)`. The row records deletion version and retention deadline, preventing a stale device or restored backup from recreating deleted content.

Tombstones must only be pruned after the approved retention policy and a stale-device safety check; no pruning job is included in this foundation.

## Query indexes

The migrations include indexes for:

- device ownership/status and pairing expiration;
- active sessions and due reminder occurrence lookup;
- reminder-transition history;
- chronological check-in/revision queries and deleted-record filtering;
- synchronization pull/idempotency/entity lookup;
- open conflict queues; and
- tombstone-retention cleanup.

Desktop and Drift SQLite create equivalent local query indexes. Drift creates its local indexes during database opening after its schema migration is complete.

## Migrations

### PostgreSQL

Prisma schema: `apps/backend/prisma/schema.prisma`.

Version-controlled baseline migration: `apps/backend/prisma/migrations/202607200001_initial_persistence/migration.sql`.

```powershell
pnpm --filter @focuslog/backend prisma:validate
pnpm --filter @focuslog/backend prisma:migrate:deploy
pnpm --filter @focuslog/backend prisma:seed
pnpm --filter @focuslog/backend test:migrations
```

Use `prisma:migrate:dev` only for a new reviewed migration in a development database. Never edit an already-applied migration; add a new migration instead.

### Electron SQLite

Versioned migrations live in `apps/desktop/electron/database/migrations.ts`. The migration runner creates `schema_migrations`, enables foreign keys and WAL mode, and applies each migration transactionally.

```powershell
pnpm --filter @focuslog/desktop test:database
```

### Flutter Drift

Drift schema and migration strategy live in `apps/mobile/lib/data/database/app_database.dart`. Generated Drift code is reproducible and must be regenerated after table changes:

```powershell
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter test test/database
```

Every schema change must increment `schemaVersion`, add an explicit upgrade branch, provide test coverage, and document compatibility with synchronization and backup restore.

## Seed and test data

The backend seed creates an isolated development owner namespace, focus mode, category, and tag with fixed development-only IDs. It deliberately does not create a trusted device or static device credential; real devices must bootstrap or pair cryptographically. It never runs automatically in production. Electron and Flutter test seeds create only deterministic non-credential fixture data.

## Validation status

PostgreSQL migration application requires an available PostgreSQL service. The repository contains static migration-contract tests, Prisma validation/generation, Electron in-memory SQLite migration tests, and Drift tests that CI runs after Flutter code generation.

## Local encryption and recovery

Electron uses `better-sqlite3-multiple-ciphers` in SQLCipher compatibility mode. Android Drift loads `sqlcipher_flutter_libs`. Each installation generates a random 256-bit key and stores only its OS-wrapped form through Windows DPAPI/Electron `safeStorage` or Android Keystore-backed secure storage. Existing plaintext databases are migrated to encrypted form before normal opening and are validated before use.

Encrypted portable backups are staged and integrity checked before transactional restore. Tests cover encrypted reopen, plaintext migration, reinstall key recovery, complete restore, tamper/wrong-key rejection, and cryptographic erasure.
