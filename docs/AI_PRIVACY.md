# AI Privacy

FocusLog sends no AI requests while AI is disabled. Local mode rejects cloud profiles before a request is constructed. Cloud and Hybrid modes require profile-specific consent for the active mode.

The current daily-analysis request sends selected, current-revision check-ins for one chosen day, capped by the context-token setting. It labels the data as untrusted inside the prompt. Source logs remain unchanged; generated reflections live in a separate AI-memory table with source provenance.

Windows protected storage holds provider credentials. Database backups and exports must continue to exclude protected credential files and secrets. Redaction and data previews are safety layers, not a guarantee that arbitrary user text has no sensitive content.

These checks are repeated at provider-attempt time. Revoking consent, switching to Local mode, disabling a profile, or enabling a global, profile, or fallback-chain kill switch blocks the next request even if it was queued earlier. Blocks are sanitized policy outcomes, not provider failures; no new cloud reservation is created for a blocked call.

# Daily structured output

Daily evidence references are accepted only when they identify check-ins included in that request's untrusted log context. Validation diagnostics are sanitized and never expose prompts, credentials, or unrelated source text.

Weekly through yearly analysis uses the same owner-isolated evidence policy. Deleted, unavailable, cross-owner, and privacy-blocked records are excluded before prompts are built. Deterministic statistics are trusted local metadata; selected source text remains explicitly untrusted.

Parent analyses do not upload all raw logs by default. Weekly through yearly prompts use exact child summary versions as trusted derived context and only a bounded exceptional raw-evidence set as untrusted text. Dependency links store result IDs, versions, and source revisions; they do not store credentials, lease tokens, raw provider responses, or renderer-supplied secrets.

Analysis schedules store provider/profile/model references, privacy mode, cost caps, timestamps, and sanitized diagnostic state. They do not store provider credentials, raw prompts, raw responses, queue lease tokens, or reservation ownership tokens. A schedule or global execution kill switch blocks enqueue/evaluation without contacting a provider.

Renderer IPC is allowlisted through the secure preload bridge. Analysis result reads return summaries, structured fields, version metadata, safe evidence previews, and exact cost/token disclosures. They never include full prompt bodies, raw provider responses, provider credentials, lease tokens, internal fallback snapshots, or budget reservation ownership tokens.

Embedding namespaces follow the same privacy boundary. Local mode permits only local embedding providers. Cloud and Hybrid modes require explicit consent for the embedding provider profile before cloud namespaces can be created. Namespace projections disclose provider/model, dimensions, metric, chunking version, coverage, status, storage estimate, and rebuild timestamps; they do not disclose raw vectors, raw source text, credentials, prompts, lease tokens, or reservation ownership tokens.

Playground prompt and context tooling uses owner-isolated tables. Context snapshots record source identity, revision, privacy class, stale state, truncation, and provider-upload implication before execution. Safe prompt inspection redacts credential-like values and wraps user/imported/retrieved text in untrusted-content delimiters. Playground prompt copies of production prompts are review artifacts only; editing them does not modify production prompt files.

Playground chat uses the same feature, privacy, consent, provider, kill-switch, budget, capacity, and cancellation gates as other provider-backed AI execution. The service checks the Playground feature switch before resolving credentials and checks current provider policy before creating the provider request. Persistent chat exports contain session/message/run metadata and redacted text only; they exclude API keys, authorization headers, raw provider secrets, queue leases, reservation ownership tokens, and production memory internals.

Playground conversations are not production memory. Messages and partial outputs are not indexed into production embedding namespaces, extracted into facts, written to graph relations, scheduled as analyses, or returned by production semantic search unless a future explicit user workflow copies content into a canonical source.

Facts and graph records are owner-isolated derived data. Automated facts require validated evidence references and store only redacted excerpts in safe evidence/diagnostic surfaces. User corrections are explicit overlays. Deleted or unauthorized source revisions cannot support active facts or graph relations, and stale propagation does not expose credentials, prompts, raw provider responses, lease tokens, or reservation ownership tokens.

Memory retrieval is owner-isolated and excludes deleted, cross-owner, and Playground sources. Local privacy mode never escalates Q&A to a cloud provider. Retrieval plans and answers store redacted excerpts, source IDs/revisions, stale state, citations, provider/model disclosure, and exclusion reasons without credentials or raw provider responses.

## Memory UI privacy boundaries

The Phase 3-E AI Memory UI is read/write only through context-isolated, allowlisted IPC. Main-process services enforce owner scoping and return safe projections for namespaces, indexing progress, search, facts, graph, stale counts, correction actions, rebuild/delete controls, subsystem switches, and safe export preparation.

Renderer projections exclude credentials, authorization headers, raw vectors, raw prompts, raw provider responses, internal queue leases, reservation ownership tokens, and hidden provider snapshots. Cloud/local privacy rules continue to be enforced by the underlying embedding, retrieval, fact, graph, queue, and provider services; the UI cannot bypass those policies.

## Phase 5-A privacy certification

Phase 5-A verifies privacy mode and consent as release gates. Local mode rejects cloud profiles before credentials are needed for a provider request. Cloud and Hybrid modes require a provider-profile consent row for the active mode before cloud execution can proceed.

Consent evidence remains concise: owner, provider profile, mode, and consent timestamp. It does not store prompts, raw provider responses, API keys, authorization headers, or credential material. Provider deletion removes both the profile and the protected credential record.

Safe export and diagnostic surfaces are checked for credential-shaped values, encrypted credential fields, authorization headers, provider secrets, queue lease tokens, reservation owner tokens, and hidden provider snapshots. Production data remains excluded from Playground exchange bundles unless the caller explicitly selects it.

## Mobile AI privacy

Android stores only mobile-safe AI projections and queued user intent. It does not store provider credentials, raw prompts, raw provider responses, queue lease tokens, or budget reservation ownership tokens in AI result, job, usage, memory, outbox, cursor, or tombstone tables.

Mobile AI synchronization is owner/workspace scoped. Cross-profile AI payloads are rejected before merge, exact cost values remain integer micro-unit strings, and tombstones hide deleted analysis or memory-cache records from mobile display. Provider execution, cloud consent, budget reservation, fallback, and provenance enforcement remain on the desktop-owned production path.

Mobile privacy and consent controls can request Local, Cloud, Hybrid, Disabled, cloud consent grant/revoke, and cloud-disabled states through signed sync. The local pending state is visible, but provider invocation is still blocked unless the authoritative desktop/backend policy recheck passes at execution time.
