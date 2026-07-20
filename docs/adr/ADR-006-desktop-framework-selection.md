# ADR-006: Desktop Framework Selection

## Status

Accepted

## Date

2026-07-20

## Decision Owners

FocusLog owner and lead architect.

## Context

The Windows application needs a durable local store, tray and autostart integration, reminder overlays, sleep/resume handling, secure native boundaries, packaging, and updates.

## Decision Drivers

Windows lifecycle access, overlay capabilities, packaging maturity, security hardening, developer productivity, and TypeScript alignment.

## Decision

Use Electron with TypeScript. The Electron main process owns persistence, synchronization, secure-key access, tray/autostart behavior, platform events, and overlay creation. The renderer is sandboxed and communicates through narrow typed preload APIs.

## Alternatives Considered

Tauri, native Windows development, and .NET MAUI.

## Consequences

### Positive

Mature Windows tooling, strong TypeScript ecosystem, reliable tray/window APIs, and compatible update/packaging paths.

### Negative

Larger runtime and strict security-boundary discipline are required.

### Risks

Renderer privilege exposure and resource use. Mitigate with context isolation, sandboxing, CSP, no Node renderer access, and performance budgets.

## Security and Privacy Impact

Private keys and database access remain in the main process; renderer IPC is validated and least-privilege.

## Operational Impact

Windows signing, auto-update, install, repair, and uninstall procedures must be documented and tested.

## Migration or Rollback Plan

Greenfield decision. Versioned local migrations and installer rollback/recovery procedures protect upgrades.

## Validation

Test reminder persistence, sleep/resume, crash recovery, IPC security, tray/autostart, installer behavior, and accessibility.

## Future Considerations

Revisit only if Electron cannot meet supported Windows performance or overlay requirements.

## Supersedes / Superseded By

None.
