# FocusLog Mobile AI Privacy

Android stores and displays mobile-safe AI policy projections. It can request privacy, consent, budget, kill-switch, provider-profile, export, and deletion changes through the durable signed sync outbox. It does not authorize provider execution from cached policy.

## Privacy modes and consent

The mobile AI privacy surface shows Local, Cloud, Hybrid, and Disabled modes from the shared contract. Cloud consent includes concise evidence only: granted state, change time, device reference, and purposes. It does not store prompts, raw provider responses, source text, API keys, authorization headers, or credential blobs.

Revocation is applied locally as a pending state and queued immediately as `ai.consent.revoke`. The authoritative desktop/backend execution path must still recheck current policy before provider invocation, so a stale mobile cache cannot permit a blocked cloud call.

## Provider profiles

Mobile displays sanitized provider profile metadata: display name, local/cloud classification, endpoint host disclosure, capabilities, model availability, validation status, and whether a credential is configured on the authoritative side. Provider secret values and encrypted blobs are never synchronized to mobile while execution ownership is desktop-owned.

## Budgets

Budget projections use exact micro-USD strings for monthly limit, settled, reserved, remaining, request cap, and month. Unknown cloud pricing is shown as a safe block. Mobile budget edits are queued and do not create reservations; the authoritative coordinator enforces aggregate caps and pricing snapshots.

## Kill switches

Mobile exposes independent switches for provider calls, scheduled analyses, provider profile, fallback chain, embeddings, fact extraction, graph update, retrieval Q&A, Playground, cloud execution, and background queue where present. Disabling one switch does not disable unrelated local viewing.

## Data lifecycle

Deletion and export controls produce durable requests. Local tombstones hide synchronized deleted results and derived memory. Export previews exclude credentials, authorization data, secret blobs, deleted content, and Playground data unless explicitly selected.
