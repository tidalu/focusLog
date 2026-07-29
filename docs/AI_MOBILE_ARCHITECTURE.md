# FocusLog AI Mobile Architecture

## Repository inventory

FocusLog currently contains these targets:

| Target                      | Present | Framework/package                                                                 | Persistence                                                | Networking/sync                              | Test tooling                                               | Evidence                                                                                                              |
| --------------------------- | ------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Desktop                     | Yes     | Electron, React, Vite, TypeScript package `@focuslog/desktop`                     | Encrypted SQLite through `better-sqlite3-multiple-ciphers` | Signed REST/WebSocket sync clients           | Vitest, ESLint, TypeScript, Vite build                     | `apps/desktop/package.json`, `apps/desktop/electron/database/database.ts`                                             |
| Backend/sync service        | Yes     | Fastify, Prisma, TypeScript package `@focuslog/backend`                           | PostgreSQL via Prisma migrations                           | REST v1 and WebSocket advisory events        | Vitest, ESLint, TypeScript, Prisma validation              | `apps/backend/package.json`, `apps/backend/prisma/schema.prisma`, `apps/backend/src/routes/v1.ts`                     |
| Android mobile              | Yes     | Flutter/Dart app `focuslog_mobile` with narrow Kotlin Android adapters            | Drift SQLite with SQLCipher support                        | Signed REST sync worker and WebSocket hints  | Flutter analyze/test, build runner, Android Gradle wrapper | `apps/mobile/pubspec.yaml`, `apps/mobile/lib/data/database/app_database.dart`, `apps/mobile/android/app/build.gradle` |
| iOS mobile                  | No      | Not applicable - platform absent                                                  | Not applicable - platform absent                           | Not applicable - platform absent             | Not applicable - platform absent                           | No `apps/mobile/ios`, `.xcodeproj`, `.xcworkspace`, or Podfile present                                                |
| Shared TypeScript contracts | Yes     | `@focuslog/shared-types`, `@focuslog/shared-validation`, `@focuslog/shared-utils` | Not applicable                                             | Generated REST/WebSocket/AI mobile constants | Node test, TypeScript, ESLint                              | `packages/shared-types`, `contracts`, `scripts/generate-contracts.mjs`                                                |

Android package details:

- Minimum Android SDK follows `flutter.minSdkVersion` from the Flutter Android plugin.
- Compile SDK and target SDK follow the pinned Flutter toolchain values in `apps/mobile/android/app/build.gradle`.
- Local database technology is Drift over SQLite, with SQLCipher available through `sqlcipher_flutter_libs`.
- State management is currently Flutter widget state and repository services rather than a separate state-management framework.
- Networking uses `http`, `web_socket_channel`, signed device identity, and durable local outbox tables.
- Notification/background integration uses `flutter_local_notifications`, WorkManager, timezone data, and Kotlin platform adapters.

Current mobile AI-related code before M-A:

- Android widget snapshot code can display privacy-filtered persisted AI memory summaries from local repository projections.
- No mobile provider adapters, direct mobile AI queue worker, mobile AI Playground, mobile embeddings, mobile fact extraction, or mobile graph execution service exists.
- `apps/mobile/lib/generated/contracts.dart` now contains generated AI mobile contract vocabulary from `contracts/ai/mobile-ai-v1.json`.

## Frozen execution ownership

M-A freezes desktop-owned execution for production AI and desktop-only execution for Playground. Android may request, display, synchronize, and safely cache projections when later packages add those flows; it must not call providers directly or bypass queue, policy, budget, provenance, or redaction.

| AI category                                             | Enqueues                                                                            | Executes provider/derived work                     | Stores authoritative result                                           | Offline behavior                                                                         | Conflict/duplicate rule                                                                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily-to-yearly analyses                                | Desktop now; future mobile request must synchronize an owner-scoped durable request | Desktop main-process AI queue                      | Desktop encrypted AI tables, synchronized by future approved envelope | Mobile remains read-only or queues a request envelope until sync; no local provider call | Stable idempotency key includes owner/profile, level, period, provider/model/privacy snapshot, source hash, prompt/schema version, and regeneration |
| Embedding indexing/rebuild/delete/verify                | Desktop queue                                                                       | Desktop main-process embedding services            | Desktop vector namespace tables                                       | Mobile sees safe namespace status only after sync                                        | Namespace activation is atomic; incompatible vectors never mix                                                                                      |
| Fact extraction/reconciliation/staleness                | Desktop queue                                                                       | Desktop main-process fact service                  | Desktop fact tables with evidence links                               | Mobile sees safe facts only after sync                                                   | Evidence-backed fact IDs and user correction overlays prevent silent rewrites                                                                       |
| Graph updates/resolution/rebuild/cleanup                | Desktop queue                                                                       | Desktop main-process graph service                 | Desktop graph tables                                                  | Mobile sees safe graph projections only after sync                                       | Graph relations require evidence and preserve unsupported/tombstone states                                                                          |
| Retrieval Q&A                                           | Desktop queue/coordinator                                                           | Desktop retrieval planner and provider coordinator | Desktop retrieval/answer records or transient safe projections        | Mobile can show unavailable/read-only status if desktop executor is offline              | Retrieved content cannot authorize actions; provenance identifies exact source revisions/results                                                    |
| Playground chat, prompt tooling, comparison, evaluation | Desktop only                                                                        | Desktop only                                       | Desktop Playground tables only                                        | Android not applicable in M-A                                                            | Playground data must not enter production analyses, memory, facts, graph, search, or schedules                                                      |

The generated ownership map is `aiMobileExecutionOwnership` in TypeScript and Dart. It deliberately contains no `mobile_direct_provider_execution` owner.

## Identity and authority model

- Owner identity is the single-owner namespace from ADR-005.
- Device identity is per-device signed identity with platform values currently limited to Windows and Android in backend Prisma.
- Workspace/profile identity is owner-scoped; cross-owner/profile records are invalid at API, sync, local database, and UI boundaries.
- Canonical records are owner logs, revisions, categories, sessions, reminders, tombstones, sync operations, and backups.
- AI analyses, embeddings, facts, graph records, retrieval answers, and Playground records are derived data. Derived rows cannot delete or rewrite canonical logs.
- User-curated corrections outrank automated extraction but remain overlays/history, not invisible rewrites.
- Tombstones and deleted-source rules exclude deleted data from mobile-safe projections and future AI synchronization envelopes.

## Shared versioned contracts

`contracts/ai/mobile-ai-v1.json` is the source for M-A AI mobile vocabulary:

- schema version and safe handling of unknown future versions;
- AI job types/statuses;
- normalized error codes;
- privacy modes;
- provenance kinds;
- exact micro-USD string pattern;
- execution-ownership matrix;
- fields forbidden in mobile-safe/sync artifacts.

`scripts/generate-contracts.mjs` emits the contract into:

- `packages/shared-types/src/generated-contracts.ts`
- `apps/mobile/lib/generated/contracts.dart`

Desktop/backend TypeScript consumes the shared package; Android consumes the generated Dart source. Later packages must extend the JSON source and regenerate instead of hand-copying incompatible mobile types.

## Branch, migration, and compatibility strategy

- Use forward migrations only. Do not edit applied desktop SQLite, mobile Drift, or backend Prisma migrations.
- Desktop SQLite migration numbers remain allocated in `apps/desktop/electron/database/migrations.ts`.
- Mobile Drift schema versions remain allocated in `apps/mobile/lib/data/database/app_database.dart`.
- Backend Prisma migrations use timestamped directories under `apps/backend/prisma/migrations`.
- Shared AI contract changes are versioned through `contracts/ai/mobile-ai-v1.json`; breaking mobile AI contract changes require a new schema version and safe reader behavior.
- Older mobile versions encountering a future AI schema must return `READ_ONLY_UNSUPPORTED_AI_SCHEMA` or remain read-only rather than corrupting state.
- Contract generation and `pnpm contracts:check` are the merge gate for desktop/mobile/backend contract changes.

## Prohibited silent changes

Later packages may not silently switch analyses, embeddings, facts, graph, retrieval Q&A, or Playground to mobile direct-provider execution. Any architecture change needs a concrete defect, an updated acceptance row, and a compatible shared-contract migration.

## Mobile Phase M-F execution adapter

`MobileAIExecutionAdapter` is the Android lifecycle boundary for the frozen desktop-owned AI execution model. It handles cold start, foreground/background transitions, reconnect, offline, token-refresh, profile-switch, notification-intent, and deep-link validation while preserving the rule that Android does not execute AI providers or derived-memory workers.

The adapter reconstructs state from `ai_mobile_outbox_actions`, `ai_mobile_job_projections`, synchronized result/memory projections, and executor availability. Pending actions remain owner/workspace-scoped and idempotent after restart or profile changes.
