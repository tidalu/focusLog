# FocusLog Mobile AI Performance

Mobile AI uses a remote-heavy, desktop-owned execution architecture. Android measures synchronized projection storage, rendering, sync application, diagnostics, and export behavior. It does not claim local embedding, fact extraction, graph building, provider execution, or Playground generation throughput.

## Synthetic M-H fixture

The representative M-H fixture is `synthetic_mobile_ai_mh_v1`. It uses synthetic analysis history, semantic search results, fact snapshots, graph nodes, long Q&A records, pending job projections, and Playground metadata. Real user data must not be used for benchmark fixtures.

`MobileAIRepository.mobilePerformanceSnapshot()` records:

- analysis row count.
- memory/search row count.
- fact row count.
- graph row count.
- pending job/outbox count.
- Playground projection count.
- startup, navigation, search-render, sync-apply, export, and deletion-cleanup thresholds.

## Release thresholds

| Metric                        | M-H threshold | Notes                                        |
| ----------------------------- | ------------: | -------------------------------------------- |
| Cold startup projection read  |      1,500 ms | Must not synchronously execute AI work.      |
| AI route navigation/render    |        300 ms | Uses bounded queries and scrollable lists.   |
| Search response rendering     |        500 ms | Client renders synchronized cache only.      |
| Sync apply batch              |      1,000 ms | Pull/push payloads are response-size capped. |
| Export preview                |      1,500 ms | Preview excludes private content by default. |
| Deletion cleanup view refresh |      1,000 ms | Tombstones hide deleted derived content.     |

## Resource controls

`MobileAIRepository.mobileResourcePolicy()` exposes current counts and caps:

- maximum cached records: 500.
- maximum response bytes: 262,144.
- maximum import bytes: 262,144.
- maximum context preview bytes: 32,768.
- maximum streaming buffer bytes: 65,536.
- maximum background retries: 5.
- maximum outbox actions: 500.
- maximum diagnostic export bytes: 131,072.

When a limit is reached, mobile must show recovery text: pause new mobile AI actions, synchronize with the paired desktop, then retry. Authoritative structured data is not silently truncated; mobile either rejects oversized import/response data or discloses bounded previews.

## Background and UI-thread policy

Android synchronizes AI status/projections only. Provider calls, queue workers, embeddings, fact extraction, graph updates, and Playground execution remain desktop-owned. Mobile UI reads bounded projections and uses scrollable Material lists instead of loading unbounded source data into a route.
