# ADR-008: API Contract and Code Generation

## Status

Accepted

## Date

2026-07-20

## Decision Owners

FocusLog owner and lead architect.

## Context

The TypeScript backend/Electron applications and Flutter application need stable, versioned APIs without manually duplicated protocol models.

## Decision Drivers

Platform neutrality, validation, backwards compatibility, generation, testability, and clear external contracts.

## Decision

Use OpenAPI 3.1 as the source of truth for REST and JSON Schema as the source of truth for WebSocket/synchronization frames. Generate TypeScript and Dart transport models/clients where practical. Keep scheduling and conflict rules in written specifications plus cross-platform test vectors rather than direct TypeScript package consumption by Flutter.

## Alternatives Considered

Handwritten duplicate models, TypeScript-only shared packages, GraphQL-first contracts, and unversioned event payloads.

## Consequences

### Positive

Explicit versioning, reproducible generation, and contract tests across all applications.

### Negative

Schema evolution requires discipline and generator maintenance.

### Risks

Generated client drift. Mitigate by committing reproducible generated artifacts where required and validating regeneration in CI.

## Security and Privacy Impact

Contracts include device signature, input validation, and content-redaction rules; schemas do not publish secrets.

## Operational Impact

Breaking contract changes require versioning, compatibility tests, and release notes.

## Migration or Rollback Plan

Additive changes are preferred. Breaking changes require a parallel supported protocol version or coordinated upgrade path.

## Validation

CI regenerates clients, validates schemas, and runs REST/event contract tests.

## Future Considerations

Evaluate richer generated test-vector tooling after initial synchronization implementation.

## Supersedes / Superseded By

None.
