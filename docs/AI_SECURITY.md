# AI Security

## Prompt and context boundaries

Production and Playground prompt construction use application-enforced boundaries around untrusted content. Retrieved text, imported content, logs, facts, graph labels, and synthetic fixtures cannot change provider configuration, privacy mode, kill switches, tools, budgets, or application actions.

Prompt inspection is redacted. Safe projections exclude credentials, authorization headers, raw provider responses, queue lease tokens, reservation ownership tokens, and hidden internal prompt snapshots.

Playground variable interpolation is treated as untrusted content. Closing delimiter strings in variables or context items are replaced before safe final-prompt inspection, preventing variable content from escaping the intended boundary.

## Playground isolation

Playground prompt definitions, context snapshots, chat sessions, messages, runs, branches, temporary attachments, and Playground namespace references are owner-isolated and stored in dedicated tables. Playground data is not a production analysis, schedule input, production memory namespace, fact, or graph record.

Provider-backed chat runs execute only through the production provider coordinator. The coordinator reuses policy, privacy, consent, kill-switch, budget, capacity, cancellation, and stale-completion protections; renderer code cannot reach a separate provider path. Streaming cancellation records partial output as partial/cancelled and late provider completion is rejected.

Safe Playground reads and exports redact credential-shaped text and omit raw credentials, authorization headers, provider secrets, queue lease tokens, reservation ownership tokens, and internal provider snapshots.

## Production prompt safety

Copying production prompts into Playground records the production prompt identity and version for traceability, but does not mutate production prompt files. Production promotion requires an explicit reviewed patch outside the Playground service.

## Retrieval injection resistance

Memory retrieval treats logs, summaries, facts, graph labels, imports, and retrieved text as untrusted. Q&A prompts use fixed system instructions plus explicit `<untrusted_memory>` delimiters. Retrieved content is not allowed to change privacy, providers, tools, kill switches, budgets, or application actions. Answers are accepted only when structured citations reference retrieved plan items and required stale/contradiction disclosures are present.

## Phase 3 memory security gate

Phase 3-F verifies memory retrieval and UI projections against a synthetic adversarial corpus containing credential-shaped text and delimiter-escape attempts. Retrieved and diagnostic content remains redacted and enclosed as untrusted evidence; semantic/hybrid search does not call a generation model and cannot authorize provider, privacy, switch, budget, tool, or mutation changes.

The benchmark artifact records explicit booleans for credential-free diagnostics, Playground exclusion, deleted-source exclusion, and no-generation semantic search. These checks supplement the focused redaction, citation validation, Local/cloud isolation, and safe IPC tests.

## Phase 4-C inspection safety

Model comparison, embedding inspection, retrieval inspection, and structured-output workbench calls all run through production policy/coordinator gates where provider execution is needed. Comparison and workbench errors are normalized and redacted. Embedding inspector namespaces are tagged through Playground references and are not activated as production namespaces. Retrieval inspection is read-only and never authorizes generation, deletion, provider changes, privacy changes, or namespace activation.

## Phase 4-D exchange and switch safety

Evaluation imports and exchange bundles are data, not instructions. The importer rejects path traversal, executable extensions, oversized payloads, duplicate dataset case IDs, unsupported provider IDs, credential-shaped strings, encrypted credential blobs, and namespace collisions. Embedded instructions are recorded as untrusted warnings.

Subsystem switch projections report exact blockers for provider calls, scheduled analyses, embeddings, fact extraction, graph updates, retrieval Q&A, Playground execution, cloud execution, and background queue work. Independent switches must not cascade into unrelated allowed local subsystems unless the global AI mode or privacy mode explicitly requires it.

## Mobile Playground isolation

Android stores Playground projections in mobile Playground-only tables and excludes them from production analysis, semantic search, facts, graph, schedules, and memory Q&A. Mobile Playground import/export and diagnostics exclude credentials, raw prompts, raw provider responses, authorization data, lease tokens, reservation ownership, secret endpoints, and production data by default.

Mobile cannot activate production namespaces, promote Playground output into production memory, or mutate production prompt files.

## Mobile M-H security hardening

Mobile API and synchronization clients enforce HTTPS endpoints with only documented localhost development exceptions through `requireFocusLogSafeEndpoint`. Pairing/API and sync responses are capped before JSON parsing. Android AI surfaces expose a safety screen for credential mode, transport, deep-link allowlists, notifications, import/export validation, prompt-injection boundaries, platform configuration, resource status, and diagnostics.

Android release configuration keeps backup disabled, cleartext disabled, exported components minimized, and battery-optimization bypass permissions absent. Mobile AI diagnostics and exports exclude credentials, authorization headers, raw prompts, raw provider responses, lease tokens, reservation ownership tokens, private content, and deleted data by default.

## Phase 4-E adversarial corpus

The Phase 4 gate includes a dedicated adversarial corpus for instruction override, credential exfiltration, privacy changes, forced cloud fallback, production mutation/deletion, false fact/graph claims, JSON/delimiter escape, tool-call injection, citation manipulation, Unicode/markup hiding, context explosion, and uncontrolled fallback cost. Application boundaries sanitize diagnostics, reject unsafe imports, keep retrieval content untrusted, require structured evidence validation, and expose only safe certification booleans to the renderer.

Isolation certification verifies that Playground messages do not become facts, Playground namespaces do not become active production namespaces, scheduled analysis jobs do not reference Playground tables, prompt copies do not mutate production prompt files, Playground deletion does not remove canonical logs, and inspectors cannot activate production memory.

## Phase 5-A security certification

Phase 5-A adds an executable certification layer in `apps/desktop/electron/ai/phase5-certification-service.ts`. It audits the Phase 1-4 AI surfaces for traceability, credential-shaped leaks, Electron hardening, network controls, untrusted prompt/content boundaries, privacy consent evidence, export safety, and bounded adversarial diagnostics.

Electron windows register a restrictive Content Security Policy from the main process. The policy keeps scripts local, blocks object/embed and framing surfaces, disables form actions, and limits network connections to HTTPS plus explicit loopback local-provider endpoints. The secure preload remains the only renderer bridge and uses allowlisted `ipcRenderer.invoke` calls.

Cloud provider endpoints must use HTTPS and may not include URL credentials, query strings, or fragments. Redirect responses are rejected before credentials can follow them. JSON and streaming provider responses are size-bounded, timeouts are enforced, and provider errors are normalized before reaching renderer-safe projections.

The Phase 5-A adversarial corpus supplements Phase 4-E with release-certification checks for credential exfiltration, forced cloud escalation, policy mutation, delimiter escape, citation manipulation, Unicode hiding, and context explosion. Diagnostics are bounded and redacted before persistence or renderer exposure.

# Phase 5-D diagnostics

The Phase 5-D diagnostic export is privacy-preserving by default. It may include app/schema versions, queue history windows, normalized error codes, breaker-state names, namespace coverage summaries, stale counts, rebuild progress, exact micro-USD totals, and platform metadata. It excludes credentials, encrypted credential blobs, authorization headers, private endpoint details, raw private logs, full private prompts, raw provider responses, lease tokens, financial owner handles, debug dumps, and deleted source payloads unless the user explicitly selects private content and accepts the warning.

Diagnostic messages are sanitized before export and renderer display. They must not contain raw provider responses, stack traces with secrets, API keys, authorization headers, or internal queue/financial ownership tokens.
