# ADR-001: System and Monorepo Architecture

## Status

Accepted

## Date

2026-07-20

## Decision Owners

FocusLog owner and lead architect.

## Context

FocusLog has a TypeScript backend, Electron desktop application, Flutter Android application, shared contracts, and deployment assets. They need coordinated versioning without coupling Flutter to TypeScript runtime packages.

## Decision Drivers

Reproducible builds, isolated platform code, contract consistency, independent testing, and maintainability.

## Decision

Use a modular monorepo with `apps/backend`, `apps/desktop`, `apps/mobile`, `contracts`, `packages`, `generated`, `infra`, and `docs`. Use pnpm workspaces and Turborepo for TypeScript orchestration; Flutter remains an independently buildable application invoked by root automation. Contracts are platform-neutral and generated artifacts are reproducible.

## Alternatives Considered

Separate repositories; a TypeScript-only monorepo that treats Flutter as a package; duplicated handwritten contracts.

## Consequences

### Positive

Atomic cross-component changes, shared CI, one documentation location, and explicit platform boundaries.

### Negative

Build tooling must bridge Node and Flutter commands.

### Risks

Cross-platform tooling drift. Mitigate with documented setup and GitHub Actions validation for every application.

## Security and Privacy Impact

Secrets and platform-specific signing assets remain outside shared packages and version control.

## Operational Impact

Docker deploys only the backend; desktop and Android release pipelines remain independent artifacts.

## Migration or Rollback Plan

The repository is greenfield. Future separation is possible because deployable applications have isolated directories and contracts.

## Validation

CI builds, tests, lints, and generates contracts for all applications from a clean checkout.

## Future Considerations

Review if mobile release tooling becomes materially constrained by root orchestration.

## Supersedes / Superseded By

None.
