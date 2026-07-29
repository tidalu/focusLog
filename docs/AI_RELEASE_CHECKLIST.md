# Phase 5-D UX, diagnostics, packaging, and CI gates

Phase 5-D adds release evidence for user-facing recovery states, accessibility, diagnostics, packaging, and CI separation:

- Implementation: `apps/desktop/electron/ai/phase5-ux-diagnostics-packaging-service.ts`.
- IPC/UI: `focuslog:ai-phase5d-certification`, `focuslog:ai-diagnostic-export`, preload APIs, and the AI settings recovery/diagnostics panel.
- Focused test: `apps/desktop/electron/ai/phase5-ux-diagnostics-packaging-service.test.ts`.
- CI: `.github/workflows/desktop-ai-release-gates.yml` separates `fast-pr`, `nightly`, and `release-candidate`; live provider smoke is opt-in and unavailable to untrusted pull requests.
- Packaging evidence: `apps/desktop/package.json` packages only `dist/renderer`, `dist-electron`, `prompts`, and `package.json`; Windows workflows build/install/uninstall NSIS artifacts.

The safe diagnostic export includes queue history windows, normalized error codes, breaker-state names, namespace/stale/rebuild summaries, exact micro-USD totals, app/schema versions, and runtime platform metadata. It excludes credentials, encrypted credential blobs, authorization headers, secret endpoints, raw private logs, full private prompts, raw provider responses, lease tokens, reservation-owner tokens, debug dumps, and deleted source payloads by default. Private content requires explicit user selection and a warning.

# FocusLog AI Release Checklist

This checklist maps Phase 1-4 AI requirements to current code, executable tests, and documentation. Status values are limited to implemented, tested, documented, intentionally unsupported, nonblocking limitation, or release blocker.

## Traceability summary

| Area                 | Requirement                                                                                                                     | Code evidence                                                                                                               | Test evidence                                                                                                      | Docs                                | Status                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ----------------------------------------------- |
| Providers            | Provider configuration, model discovery, endpoint validation, capabilities, credential redaction, and opt-in live certification | `apps/desktop/electron/ai/ai-service.ts`, `providers.ts`, `url-security.ts`, `phase5-provider-performance-certification.ts` | `ai-platform.test.ts`, `phase5-certification-service.test.ts`, `phase5-provider-performance-certification.test.ts` | `AI_PROVIDERS.md`, `AI_SECURITY.md` | tested; live paths require opt-in configuration |
| Queue                | Durable leasing, startup recovery, cancellation, stale completion rejection, lifecycle cleanup                                  | `queue-runtime.ts`, `job-queue.ts`, `job-worker.ts`                                                                         | `queue-runtime-lifecycle.test.ts`, `queue-runtime-process-loss.test.ts`                                            | `AI_QUEUE.md`                       | tested                                          |
| Fallback             | Fallback chains, structured repair, cancellation, and attempt history                                                           | `provider-execution-coordinator.ts`, `fallback-chain-service.ts`                                                            | `provider-execution-coordinator.test.ts`                                                                           | `AI_PROVIDERS.md`, `AI_QUEUE.md`    | tested                                          |
| Budgets              | Exact reservations, settlement, release, monthly/request caps, recovery                                                         | `budget-service.ts`, `provider-execution-coordinator.ts`                                                                    | `budget-service.test.ts`, `provider-execution-coordinator.test.ts`                                                 | `AI_BUDGETS.md`                     | tested                                          |
| Analyses             | Daily-to-yearly analyses, dependencies, scheduling, manual execution, staleness, regeneration                                   | `daily-analysis-handler.ts`, `hierarchical-analysis-handler.ts`, `analysis-scheduler.ts`                                    | `daily-analysis-queue.test.ts`, `hierarchical-analysis.test.ts`, `analysis-scheduler.test.ts`                      | `AI_ANALYSES.md`                    | tested                                          |
| Usage                | Usage/cost records linked to attempts/results and safe disclosures                                                              | `daily-analysis-handler.ts`, `playground-chat-service.ts`                                                                   | `queue-runtime-process-loss.test.ts`, `playground-chat-service.test.ts`                                            | `AI_BUDGETS.md`, `AI_PLAYGROUND.md` | tested                                          |
| Embeddings           | Namespaces, chunking, activation, deletion, privacy, and indexing                                                               | `embedding-namespace-service.ts`, `embedding-chunking.ts`                                                                   | `embedding-namespace-service.test.ts`                                                                              | `AI_EMBEDDINGS.md`                  | tested                                          |
| Search               | Semantic/hybrid retrieval, FTS, filters, deleted-source exclusion, no generation call                                           | `memory-retrieval-service.ts`                                                                                               | `memory-retrieval-service.test.ts`, `phase3-performance-harness.test.ts`                                           | `AI_RETRIEVAL.md`                   | tested                                          |
| Facts                | Evidence-backed fact extraction, lifecycle, correction overlays, deletion/staleness                                             | `fact-graph-service.ts`                                                                                                     | `fact-graph-service.test.ts`                                                                                       | `AI_FACTS_GRAPH.md`                 | tested                                          |
| Graph                | Evidence-backed graph nodes/edges, conservative merge/split, provenance                                                         | `fact-graph-service.ts`                                                                                                     | `fact-graph-service.test.ts`                                                                                       | `AI_FACTS_GRAPH.md`                 | tested                                          |
| Retrieval Q&A        | Deterministic planner, evidence-backed answers, stale/contradiction disclosure, injection resistance                            | `memory-retrieval-service.ts`                                                                                               | `memory-retrieval-service.test.ts`                                                                                 | `AI_RETRIEVAL.md`, `AI_SECURITY.md` | tested                                          |
| Memory UI            | Overview, search, facts, graph, rebuild/delete controls, safe projections                                                       | `AIMemoryPage.tsx`, `main.ts`, `preload.cts`                                                                                | `AIMemoryPage.test.ts`                                                                                             | `AI_MEMORY.md`                      | tested                                          |
| Playground           | Isolation, chat, streaming, prompt/context tooling, comparison, inspectors, workbench, UI                                       | `playground-*.ts`, `AIPlaygroundPage.tsx`                                                                                   | `playground-*.test.ts`, `AIPlaygroundPage.test.ts`                                                                 | `AI_PLAYGROUND.md`                  | tested                                          |
| Evaluation           | Datasets, deterministic evaluators, reproducible runs, model-evaluator label, benchmark history                                 | `playground-evaluation-service.ts`                                                                                          | `playground-evaluation-service.test.ts`                                                                            | `AI_EVALUATION.md`                  | tested                                          |
| Import/export        | Safe Playground exchange, path validation, production-data consent, secret exclusion                                            | `playground-evaluation-service.ts`                                                                                          | `playground-evaluation-service.test.ts`, `phase5-certification-service.test.ts`                                    | `AI_IMPORT_EXPORT.md`               | tested                                          |
| Switches             | Independent subsystem kill switches and exact blocked-state reporting                                                           | `playground-evaluation-service.ts`, `ai-service.ts`                                                                         | `playground-evaluation-service.test.ts`                                                                            | `AI_TROUBLESHOOTING.md`             | tested                                          |
| Adversarial security | Application-boundary corpus for prompt/content/import/retrieval attacks                                                         | `phase5-certification-service.ts`, `playground-evaluation-service.ts`                                                       | `phase5-certification-service.test.ts`                                                                             | `AI_SECURITY.md`                    | tested                                          |
| Performance          | Deterministic 200,000-log harness and documented release metrics                                                                | `phase3-performance-harness.ts`, `phase3-performance-harness-runner.ts`                                                     | `phase3-performance-harness.test.ts`                                                                               | `AI_PERFORMANCE.md`                 | tested                                          |

## Phase 5-A certification checklist

- Credential storage uses protected local files; renderer-safe provider projections expose `credentialConfigured` but not secrets.
- Provider deletion removes the provider profile and deletes the protected credential file.
- Cloud endpoints must be HTTPS. Explicit local providers may use loopback/private HTTP endpoints only.
- Provider redirects are blocked to prevent authorization leakage.
- Provider JSON and streaming responses are bounded.
- Electron windows use context isolation, disabled Node integration, sandboxing, allowlisted preload IPC, and a registered Content Security Policy.
- Imported, retrieved, logged, summarized, fact, graph, and Playground content is treated as untrusted data.
- Exports omit credentials, encrypted credential blobs, authorization headers, internal leases, reservation ownership tokens, hidden provider snapshots, and production data unless explicitly selected.
- Local privacy mode rejects cloud execution. Cloud/Hybrid require provider-profile consent before cloud use.
- Release diagnostics are bounded and credential-free.

## Current blockers and limitations

Release blockers: Phase 5-A, Phase 5-B, and Phase 5-D have representative executable evidence. The final Phase 5-E gate remains blocked until the opt-in live provider certification command succeeds for at least one local path, one direct cloud path, and one OpenAI-compatible path, and until the release-like 200,000-log performance artifact passes thresholds. Do not use release-candidate certification language until `docs/AI_PHASE5_ACCEPTANCE.md` rows 5C-2, 5C-3, 5C-4, 5C-5, 5E-1, and 5E-4 are updated from `Blocked by concrete defect` to `Implemented and verified` with dated artifacts.

Nonblocking limitations are tracked in `docs/AI_PHASE5_HARDENING_BACKLOG.md`: third-party penetration testing, extended fuzzing beyond the release corpus, future platform-specific privacy reviews, long-duration chaos testing, physical multi-machine power-loss testing, additional filesystem/provider-specific permutations, additional models per provider, multi-day provider soak, and hardware matrix beyond release target devices.

## Phase 5-B reliability certification

Phase 5-B adds release evidence for migration safety and reliability faults:

- Migrations are audited for sequential unique versions, deterministic SQL, AI boundary coverage, and no destructive canonical-table drops.
- Empty and representative large file-backed databases upgrade to the latest schema; repeated reopen preserves FTS search and canonical check-ins.
- Databases stamped with a newer schema version are rejected with an actionable update message rather than opened as partially compatible.
- Interrupted migrations remain transactional: the failed migration version is not recorded, partial schema is not treated as complete, canonical tables remain readable, and the next initialization can retry.
- Encrypted backups cover canonical user data before destructive recovery workflows; derived AI data remains rebuildable from canonical logs and current services.
- Derived corruption repair marks incompatible vector namespaces failed, facts with unavailable evidence stale, graph relations unsupported, and interrupted Playground runs interrupted/cancelled without deleting canonical logs.
- Queue stale-worker acknowledgements are rejected, duplicate idempotency keys do not create duplicate final jobs, and expired reservations recover idempotently.
- Provider/network/privacy/budget faults return sanitized actionable recovery messages and never trigger Local-to-cloud escalation.

## Phase 5-C provider and performance certification

Phase 5-C adds an opt-in provider/performance certification runner:

- Provider artifact: `artifacts/phase5/phase5c-provider-performance-certification.json`.
- Implementation: `apps/desktop/electron/ai/phase5-provider-performance-certification.ts`.
- Runner: `apps/desktop/electron/ai/phase5-provider-performance-runner.ts`.
- Focused test: `apps/desktop/electron/ai/phase5-provider-performance-certification.test.ts`.

Live smokes are disabled by default. To certify real providers, set `FOCUSLOG_PHASE5C_LIVE=1` plus provider-specific variables such as `FOCUSLOG_LIVE_OLLAMA_MODEL`, `FOCUSLOG_LIVE_OPENAI_API_KEY`, `FOCUSLOG_LIVE_OPENAI_MODEL`, `FOCUSLOG_LIVE_OPENAI_COMPATIBLE_ENDPOINT`, and `FOCUSLOG_LIVE_OPENAI_COMPATIBLE_MODEL`. The runner records OpenAI, Anthropic, Gemini, OpenRouter, Ollama, LM Studio, and generic OpenAI-compatible rows as certified, failed, or explicitly untested. It does not write API keys, authorization headers, prompts, raw responses, or provider secrets to artifacts.

The performance certification reuses the deterministic Phase 3-F 200,000-log harness in a release-like main-process build and compares startup, indexing, semantic/hybrid query, renderer-safe projection, restart/reopen, memory, database size, and security booleans against the recorded threshold artifact. The latest local run completed the 200,000-log harness but persisted `thresholdsPassed=false` because vector persistence measured 189,627.15 ms against the 180,000 ms threshold.

## Phase 5-E final release certification

Phase 5-E adds the final release-candidate gate:

- Implementation: `apps/desktop/electron/ai/phase5-final-release-certification.ts`.
- Focused test: `apps/desktop/electron/ai/phase5-final-release-certification.test.ts`.
- Report: `docs/AI_FINAL_RELEASE_REPORT.md`.
- Acceptance rows: `docs/AI_PHASE5_ACCEPTANCE.md` rows 5E-1 through 5E-4.

The gate intentionally refuses final certification while release-critical rows remain blocked. In this environment the blockers are the required opt-in live provider smoke matrix and the failed release-like 200,000-log performance threshold. At least one local provider, one direct cloud provider, and one OpenAI-compatible provider must complete real round-trip certification with redacted artifacts, and the 200,000-log artifact must pass its thresholds. Hermetic adapter tests, security/privacy tests, queue recovery tests, focused performance harnesses, package smoke, and documentation are still valuable evidence, but they do not replace those release-critical gates.

## Mobile M-H security, accessibility, performance, packaging, and CI gate

M-H adds mobile-specific release evidence for:

- HTTPS/local-only endpoint enforcement in mobile API and sync clients.
- response-size caps before mobile JSON parsing.
- Android manifest security review (`allowBackup=false`, cleartext disabled, no battery-optimization bypass).
- AI safety screen accessibility and recovery text.
- synthetic mobile projection performance/resource thresholds.
- safe diagnostics and export defaults.
- Android packaging readiness and M-I install/upgrade smoke preparation.
- CI split into fast PR, nightly, and release-candidate mobile AI gates.

Local Android verification remains blocked until Flutter is available on PATH. Shared source tests verify M-H code/configuration evidence in this environment; Android tests are present for the Flutter-equipped CI lane.

## Mobile M-I release gate status

M-I records the final mobile-only release gate in `docs/AI_MOBILE_RELEASE_REPORT.md`.

Verified in the current Windows environment:

- shared contracts and generated contract drift checks.
- source-level mobile AI acceptance, security, performance, packaging, and release-report checks.
- desktop/backend preservation gates.
- Android/iOS platform inventory evidence.

Blocked in the current Windows environment:

- Android Flutter static analysis.
- Android Flutter unit/widget/integration tests.
- Android debug/release artifact build.
- install/launch smoke.
- upgrade/data migration smoke on an emulator or physical device.

Concrete blocker: `flutter` is unavailable on PATH. Do not mark Android mobile AI as fully certified until the Android commands in `docs/AI_MOBILE_COMMANDS.md` run successfully and a built artifact is installed and launched.

## X-FINAL cross-platform release gate status

X-FINAL adds `docs/AI_CROSS_PLATFORM_ARCHITECTURE.md`, `docs/AI_CROSS_PLATFORM_ACCEPTANCE.md`, `docs/AI_CROSS_PLATFORM_HARDENING_BACKLOG.md`, and the typed shared snapshot `packages/shared-types/src/cross-platform-release.ts`.

Verified in this environment:

- desktop lint, typecheck, full tests with FTS benchmark, and production build.
- backend lint, typecheck, tests, build, and Prisma schema validation.
- shared contract generation/drift checks and shared TypeScript tests.
- source-level cross-platform architecture, ownership, Playground isolation, and no-false-certification checks.

Blocked by concrete release defect:

- Android Flutter analyze, tests, build, install/launch, upgrade, and offline/lifecycle smoke because `flutter` is unavailable on PATH.
- Backend `prisma:migrate:status` release-candidate database check when `DATABASE_URL` is not configured.

iOS remains `Not applicable - platform absent`.

Do not use the final cross-platform completion declaration until the Android commands in `docs/AI_MOBILE_COMMANDS.md` pass and an Android artifact is actually installed and launched.
