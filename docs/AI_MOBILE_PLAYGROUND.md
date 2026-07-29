# FocusLog Mobile Playground

## Product decision

Mobile Phase M-G chooses `desktop_only_power_user_tool` for Playground execution. Android may inspect synchronized safe Playground metadata, diagnostics, and export previews, but it does not create sessions, edit prompts, run providers, stream responses, compare models, mutate datasets, or promote Playground output into production memory.

This matches the frozen M-A execution ownership matrix: production AI execution is desktop-owned and Playground execution is desktop-only. Keeping Playground execution on desktop avoids mobile credential storage, hidden provider calls, budget bypass, unsafe prompt mutation, and OS-background execution ambiguity.

## Supported Android behavior

Android supports:

- read-only shared Playground session summaries;
- run metadata for status, cancellation/partial state, provider/model, token counts, exact micro-unit cost, fallback, structured validity, and frozen prompt/context metadata;
- evaluation summaries with deterministic scores and clearly labelled subjective metadata;
- safe diagnostics and export previews;
- import validation for schema, size, duplicate IDs, path/name safety, unsupported artifact types, embedded instructions, and credential-shaped fields;
- independent Playground execution switch updates through the normal durable outbox;
- Playground-only deletion requests that explicitly do not delete production records.

## Unsupported Android behavior

Android does not support Playground execution, prompt editing, production prompt promotion, streaming, retry-with-model, comparison execution, dataset mutation, or local embedding/retrieval experiments. The UI must show a desktop-required state rather than mock these features.

## Isolation

Mobile stores Playground projections in `ai_mobile_playground_projections`, separate from analysis results, job projections, memory search cache, facts, graph snapshots, and Q&A history. Playground rows are never returned from production mobile search or memory APIs.

Inbound Playground projections that attempt production promotion or production namespace activation are rejected. Playground deletion requests use `deleteScope: playground_only` and `deleteProductionData: false`.

## Diagnostics and exchange

Mobile diagnostics expose application/schema metadata, sync state, pending outbox count, executor availability, usage summary counts, and subsystem switch state. They exclude credentials, authorization data, raw private prompts, raw provider responses, private source text, lease tokens, and reservation ownership tokens.

Mobile export previews are safe by default and exclude production data unless a desktop export flow explicitly selects it.
