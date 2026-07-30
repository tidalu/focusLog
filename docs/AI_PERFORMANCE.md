# AI performance certification

## Phase 3-F 200,000-log memory harness

The Phase 3-F benchmark is deterministic and synthetic. It never uses real user data. The default harness seed is `focuslog-phase3-f-200k-v1`, and the release gate log count is exactly 200,000.

Implementation:

- `apps/desktop/electron/ai/phase3-performance-harness.ts`
- `apps/desktop/electron/ai/phase3-performance-harness-runner.ts`
- `apps/desktop/electron/ai/phase3-performance-harness.test.ts`

The harness uses a file-backed encrypted SQLite database initialized through production migrations. It creates synthetic logs across years, categories, project names, timezones/DST examples, Unicode/multilingual content, deleted records, edits, and adversarial instruction strings. It exercises chunk generation, namespace-compatible vector persistence, fact/graph extraction from supported evidence, retrieval planning, staleness propagation, deletion cleanup, safe renderer projection, restart/reopen initialization, and artifact writing.

The benchmark deliberately stores deterministic synthetic vectors for performance and compatibility measurement so it can run without opt-in live provider credentials. Live embedding-provider certification remains a later provider gate; production services must still use configured provider adapters for real embedding generation.

## Latest recorded result

Command:

```powershell
pnpm --filter @focuslog/desktop build:main
node apps/desktop/dist-electron/ai/phase3-performance-harness-runner.js artifacts/phase3/phase3-200k-benchmark.json
```

Environment:

- Date: 2026-07-29
- Node: recorded in `artifacts/phase3/phase3-200k-benchmark.json`
- Dataset: 200,000 synthetic logs
- Seed: `focuslog-phase3-f-200k-v1`

Result summary:

| Metric                                         |            Result |
| ---------------------------------------------- | ----------------: |
| Startup and migration                          |           2.78 ms |
| Synthetic log generation and insert            |      17,890.84 ms |
| Chunk generation, indexing, vector persistence |      65,276.39 ms |
| Fact batching and graph throughput             |          11.14 ms |
| Semantic/hybrid/filtered queries               |           5.76 ms |
| Staleness propagation                          |         521.27 ms |
| Incremental edit reindex marking               |         899.85 ms |
| Deletion cleanup propagation                   |         500.20 ms |
| Renderer-safe projection                       |         659.55 ms |
| Restart reopen and initialize                  |         264.15 ms |
| Database size                                  | 401,453,056 bytes |
| RSS memory at result capture                   |  91,066,368 bytes |
| Heap used at result capture                    |   6,458,408 bytes |

Counts:

- Logs: 200,000
- Chunks: 200,000
- Active vectors after targeted invalidation: 199,997
- Facts: 3
- Graph nodes: 6
- Graph edges: 3
- Stale memory count: 2
- Logs after reopen: 200,000

Security checks in the artifact:

- Diagnostics are credential-free.
- Deleted sources are excluded from retrieval plan items.
- Playground data is excluded at the service boundary.
- Semantic/hybrid search does not call a generation model.

## Thresholds

The harness records explicit thresholds in its JSON artifact. Current release thresholds are intentionally broad enough for local development hardware while still catching order-of-magnitude regressions:

- Startup/migration: 5 seconds.
- Synthetic insert: 90 seconds.
- Chunk/vector persistence: 180 seconds.
- Semantic/hybrid filtered queries: 3 seconds.
- Restart/reopen: 5 seconds.

Long-duration soak, alternative ANN algorithms, additional embedding providers/models, and learned ranking experiments remain in the Phase 3 hardening backlog.

## Mobile AI M-H performance and resource gate

Android mobile AI performance is measured against synchronized projection behavior, not local provider, embedding, fact, graph, or Playground execution. The release fixture is `synthetic_mobile_ai_mh_v1`, documented in `docs/AI_MOBILE_PERFORMANCE.md`.

Mobile thresholds cover cold/warm projection startup, route navigation, large-list rendering, search response rendering, sync application, export preview, deletion cleanup, bounded diagnostics, and outbox/resource backpressure. Mobile resource caps are exposed through `MobileAIRepository.mobileResourcePolicy()` and surfaced in the AI safety screen.

The current local Windows verification cannot execute Flutter gates because `flutter` is unavailable on PATH. Shared source tests still pin the thresholds, CI configuration, endpoint policy, and safety UI strings until Android tooling is available.

## Phase 5-C release-like performance certification

Phase 5-C reuses the Phase 3-F harness from a compiled Electron main-process build and saves a release-gate artifact:

```powershell
pnpm --filter @focuslog/desktop build:main
node apps/desktop/dist-electron/ai/phase5-provider-performance-runner.js --performance --release-like
```

The runner writes `artifacts/phase5/phase5c-provider-performance-certification.json` and `artifacts/phase5/phase5c-200k-performance.json`. The certification compares the harness metrics against the same thresholds listed above and records:

- environment, command, date, seed, and log count;
- startup/migration, synthetic insert, chunk/vector persistence, semantic/hybrid query, renderer-safe projection, restart/reopen, and deletion/staleness timings;
- RSS, heap usage, database size, row counts, and query-plan summaries;
- security booleans for secret-free diagnostics, Playground exclusion, deleted-source exclusion, and no generation-model call during semantic search;
- resource controls for bounded renderer projection, startup/backlog behavior, queue backpressure documentation, import/context/response limits, and index justification.

Focused tests run the same certification shape with a smaller synthetic dataset so PR checks remain fast; the release candidate gate must run the `--release-like` command with the full 200,000-log dataset.

Latest Phase 5-C release-like run:

| Metric                                         |                 Result |
| ---------------------------------------------- | ---------------------: |
| Date                                           |             2026-07-29 |
| Dataset                                        | 200,000 synthetic logs |
| Startup and migration                          |                6.15 ms |
| Synthetic log generation and insert            |           53,795.73 ms |
| Chunk generation, indexing, vector persistence |          189,627.15 ms |
| Fact batching and graph throughput             |               36.82 ms |
| Semantic/hybrid/filtered queries               |               25.20 ms |
| Staleness propagation                          |            1,344.14 ms |
| Incremental edit reindex marking               |            2,397.05 ms |
| Deletion cleanup propagation                   |            1,290.67 ms |
| Renderer-safe projection                       |            1,461.27 ms |
| Restart reopen and initialize                  |              427.97 ms |
| Database size                                  |      401,608,704 bytes |
| RSS memory at result capture                   |       98,586,624 bytes |
| Heap used at result capture                    |        6,611,792 bytes |
| Threshold status                               |                 failed |

The Phase 5-C run recorded no configured live providers in this environment. Provider rows were therefore written as explicitly untested. The release-like performance gate completed but did not pass because chunk generation, indexing, and vector persistence exceeded the 180,000 ms threshold.

# Phase 5-D resource controls

Phase 5-D certifies that release diagnostics and support surfaces remain bounded. Diagnostic export includes summaries rather than raw private logs, raw prompts, full provider responses, raw vectors, or benchmark datasets. Packaging excludes unneeded benchmark data, debug logs, temporary exports, and source maps from the shipped desktop artifact.

The release-candidate CI lane packages the Windows desktop application and performs a clean-install smoke. Extended OS/hardware installer and accessibility matrices are tracked in the Phase 5 hardening backlog rather than blocking this representative package gate.
