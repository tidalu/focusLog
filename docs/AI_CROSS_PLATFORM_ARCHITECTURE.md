# FocusLog AI Cross-Platform Architecture

FocusLog AI uses one authoritative execution architecture across the currently present targets:

- Desktop is the authoritative AI executor for analyses, embeddings, facts, graph updates, retrieval Q&A, Playground, rebuilds, and scheduled work.
- Backend synchronizes owner/device/profile-scoped envelopes and does not reinterpret AI cost, provenance, deletion, or policy fields.
- Android reads mobile-safe projections and queues durable outbox requests for the authoritative executor. It does not execute providers in the current architecture.
- iOS is not applicable because no iOS application target exists in this repository.

## Execution ownership

| AI area                        | Authoritative execution owner         | Android behavior                                                                     | Duplicate prevention                                                 |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Daily-to-yearly analyses       | Desktop queue/runtime                 | Queue request, status, cancellation, retry, result, provenance, and cost projections | Stable owner/workspace/profile/period/action idempotency keys        |
| Embeddings and semantic search | Desktop memory/indexing services      | Synchronized namespace/search projections only                                       | Namespace IDs, chunk hashes, tombstones, and source revisions        |
| Facts and graph                | Desktop fact/graph services           | Synchronized safe facts, graph nodes/edges, and correction outbox actions            | Evidence IDs, correction overlays, and graph action idempotency      |
| Retrieval Q&A                  | Desktop retrieval planner/coordinator | Outbox request and synchronized answer/evidence projection                           | Request idempotency and answer/result linkage                        |
| Playground                     | Desktop-only                          | Read-only shared session/evaluation metadata where synchronized                      | Playground-only projection tables and production-promotion rejection |
| Scheduled work                 | Desktop scheduler                     | Schedule settings outbox and safe status projection                                  | Schedule idempotency keys and authoritative queue dedupe             |

## Shared contracts

`contracts/ai/mobile-ai-v1.json` remains the source of truth for mobile AI job/status/error/privacy/provenance/exact-money/redaction vocabulary. It generates:

- `packages/shared-types/src/generated-contracts.ts`
- `apps/mobile/lib/generated/contracts.dart`

Unknown future AI schema versions must fail safe or become read-only. No platform may reinterpret micro-unit costs as floating point or silently drop provenance.

## Current platform inventory

| Target  | Status                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------- |
| Desktop | Present and verified through lint, typecheck, full tests, and production build in this workspace.             |
| Backend | Present and verified through lint, typecheck, tests, build, and Prisma schema validation in this workspace.   |
| Android | Source is present, but local runtime/build certification is blocked because `flutter` is unavailable on PATH. |
| iOS     | Not applicable - platform absent.                                                                             |

## Cross-platform release declaration policy

The final cross-platform completion declaration is not permitted while any present platform has an unverified release-critical build/test/install gate. Android therefore remains a concrete release blocker in this environment until the commands in `docs/AI_MOBILE_COMMANDS.md` run successfully and an artifact is installed/launched.
