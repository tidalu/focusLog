# ADR-002: Server Database Selection

## Status

Accepted

## Date

2026-07-20

## Decision Owners

FocusLog owner and lead architect.

## Context

Synchronized devices require durable transactions, operation idempotency, ordered change feeds, reports, tombstones, backup, and recovery.

## Decision Drivers

Transactional integrity, relational consistency, reporting, migration support, backup maturity, and long-term operations.

## Decision

Use PostgreSQL as the shared server database and Prisma for schema migrations and routine persistence. Use reviewed parameterized SQL where synchronization ordering, locking, or batch behavior requires precise control.

## Alternatives Considered

Managed PostgreSQL variants, MongoDB, Firebase, and SQLite as the server database.

## Consequences

### Positive

Strong transactions, indexes, operational maturity, point-in-time recovery options, and natural representation of owner/device/entity relations.

### Negative

Requires PostgreSQL operations and backup discipline.

### Risks

Incorrect query/index design can affect historical reports. Mitigate with query plans, report fixtures, and performance tests.

## Security and Privacy Impact

PostgreSQL storage and backups are encrypted by the deployment environment; content is excluded from diagnostics by default.

## Operational Impact

Docker deployment includes PostgreSQL or connects to a managed PostgreSQL service with documented backup and restore procedures.

## Migration or Rollback Plan

Append-only Prisma migrations are tested for clean deployment, supported upgrades, and restore. Unsafe rollback uses backup/forward migration procedures.

## Validation

Migration, idempotency, cursor, backup, restore, and report-query tests run in CI.

## Future Considerations

Managed PostgreSQL may replace self-hosted PostgreSQL without changing the logical model.

## Supersedes / Superseded By

None.
