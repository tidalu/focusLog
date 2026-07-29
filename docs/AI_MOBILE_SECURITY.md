# FocusLog AI Mobile Security

Mobile AI state follows the same local-first single-owner model as the rest of FocusLog.

## Secure local storage

The Android database is opened through SQLCipher using a key stored by `flutter_secure_storage` with encrypted shared preferences. AI tables are created inside that encrypted database. Provider credentials are not stored in AI projection, outbox, cache, diagnostic, or tombstone rows.

## Redaction and validation

Mobile AI repository writes reject payload keys that would expose provider secrets, raw prompts, raw provider responses, queue lease tokens, or budget reservation ownership tokens. Safe read models use summaries, structured fields, IDs, stale state, and exact cost strings.

## Isolation

Every AI row includes owner and workspace scope. Inbound synchronization rejects mismatched owner/workspace payloads. Playground job types remain desktop-only in the shared contract, and Playground data must not be accepted into production analysis, memory, fact, graph, or search projections.

## Deletion

Tombstones mark analysis results and memory cache entries deleted before they are returned to UI surfaces. Derived AI rows can be rebuilt; canonical logs are not deleted by AI cache deletion.

## M-D policy and credential boundary

Because Mobile Phase M-A keeps production AI execution desktop-owned, provider secrets are not synchronized to Android. The M-D policy surface displays only sanitized profile metadata and a boolean `credentialConfigured` disclosure. Credential values, encrypted credential blobs, authorization headers, request inspection payloads, and endpoint secrets remain absent from SQLite, outbox payloads, exports, diagnostics, notifications, and UI state.

If a future architecture selects per-device mobile execution, that change requires a separate acceptance package for platform credential create/update/delete, endpoint validation, redacted request inspection, and secure deletion. It is not silently enabled by the M-D UI.

## Lifecycle diagnostics and notifications

Mobile AI lifecycle diagnostics store only normalized state, category, optional safe job ID, timestamp, and sanitized reason. Notification intents store target kind and target ID rather than private source text. Deep links validate owner/workspace before opening synchronized AI jobs, results, memory, facts, or graph records.

Authorization headers, credentials, raw private logs, raw prompts, raw provider responses, secret endpoints, lease tokens, and reservation ownership tokens are excluded from diagnostics, notifications, outbox payloads, and safe read models.

## M-H mobile security certification

Mobile AI network entry points call `requireFocusLogSafeEndpoint`, which permits HTTPS endpoints and narrowly scoped localhost development URLs only. Pairing/API and synchronization responses are capped at 262,144 bytes before JSON parsing.

`MobileAIRepository.mobileSecurityReview()` returns a safe audit projection for credential mode, transport, deep links, notifications, imports, exports, prompt-injection boundary, platform configuration, screenshot/clipboard policy, and diagnostics. This projection contains no credentials, authorization headers, raw prompts, raw provider responses, lease tokens, reservation-owner tokens, or private content.

Android manifest review is pinned by tests:

- `android:allowBackup="false"`.
- `android:usesCleartextTraffic="false"`.
- exported AI components are not introduced.
- no `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission is requested.

Mobile AI import validation treats embedded instructions as untrusted content. Synchronized source text, Playground metadata, memory excerpts, and diagnostics cannot authorize privacy changes, provider changes, deletion, or tool/action execution.
