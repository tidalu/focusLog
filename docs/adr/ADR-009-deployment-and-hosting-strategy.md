# ADR-009: Deployment and Hosting Strategy

## Status

Accepted

## Date

2026-07-20

## Decision Owners

FocusLog owner and lead architect.

## Context

The backend must be deployable reproducibly, support TLS, database backups, observability, upgrade, and recovery without introducing SaaS administration features.

## Decision Drivers

Simple self-hosting, repeatable deployment, PostgreSQL compatibility, transport security, backup, rollback, and low maintenance burden.

## Decision

Package the Fastify backend in Docker. Support documented Docker Compose deployment with PostgreSQL, reverse-proxy TLS termination, environment-injected secrets, encrypted backup storage, health checks, and structured redacted observability. GitHub Actions validates builds and images; deployment promotion remains an explicit release operation.

## Alternatives Considered

Serverless-only hosting, bespoke VM provisioning, managed proprietary backend platforms, and no self-hostable deployment.

## Consequences

### Positive

Reproducible environment, clear local/production parity, portable hosting, and straightforward backup procedures.

### Negative

Operators remain responsible for TLS, database maintenance, and backup recovery where self-hosted.

### Risks

Misconfigured secrets or backups. Mitigate with startup validation, documented environment templates, recovery drills, and CI checks.

## Security and Privacy Impact

TLS is mandatory, secrets are external to images, and monitoring redacts journal content. Deployment does not create a product administrator role.

## Operational Impact

Document health checks, alerts, database backup/PITR, restore, upgrades, rollback, domain/certificate renewal, and incident procedures.

## Migration or Rollback Plan

Use backward-compatible application/database deployment order. Roll back application images only when compatible with deployed migrations; otherwise restore or forward-fix from validated backups.

## Validation

Run Docker startup, health, migration, backup/restore, and recovery exercises from a clean environment.

## Future Considerations

Managed PostgreSQL or managed container hosting can be adopted without changing product ownership semantics.

## Supersedes / Superseded By

None.
