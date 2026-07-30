# AI embeddings

Phase 3-A introduces embedding architecture and lifecycle storage. It does not yet enable semantic retrieval as a product feature.

## Ownership and storage

Embedding namespaces are device-scoped derived data owned by the local desktop owner namespace. Canonical logs, revisions, daily memories, and parent analysis results remain authoritative. Embedding chunks and vectors may be deleted and rebuilt without deleting canonical records.

FocusLog stores vectors in the encrypted desktop SQLite database as JSON plus strict metadata in `ai_vector_*` tables. This avoids a new external vector database and avoids packaging a SQLite vector extension before there is a measured retrieval need. The schema records dimensions, metric, provider/model, hashes, coverage, and lifecycle state so a future approximate-nearest-neighbor extension can be adopted without changing ownership semantics.

## Chunking policy

`focuslog-chunking-v1` supports `check_in_revision`, `daily_analysis`, and `analysis_result` sources. Text is normalized deterministically, short logs become one chunk, and longer content uses bounded character windows with overlap. Chunk IDs are deterministic hashes over namespace, source type, source ID, source revision, chunk index, chunking version, and content hash.

Structured metadata is stored separately as sorted JSON and is not split as content. Attachments are not embedded in Phase 3-A; future attachment extraction must create its own source revision identity and privacy classification.

## Namespace lifecycle

Namespaces move through `building`, `active`, `deprecated`, `failed`, and `deleted`. A replacement namespace can be built while the prior namespace remains active. Activation requires complete vector coverage and matching dimensions, metric, model, provider, and chunking version. Activation atomically deprecates the old active namespace for the same owner/name and marks the verified replacement active.

Deleting a namespace removes only derived chunks and vector records, then marks the namespace deleted for audit. It never deletes check-ins, revisions, daily memories, or analysis results.

## Privacy

Local mode permits only local embedding providers. Cloud and Hybrid modes require explicit provider-profile consent before creating cloud embedding namespaces. Safe projections expose namespace identity, provider/model, dimensions, metric, chunk policy, coverage, status, storage estimate, and rebuild timestamps. They do not expose credentials, raw source text, raw vectors, prompts, lease tokens, or reservation ownership tokens.

## Memory UI controls

Phase 3-E exposes embedding namespace status through the AI Memory page. The projection includes only safe metadata: namespace ID/name, provider/model, dimensions, coverage status, indexed/expected chunk counts, storage estimate, and last indexing timestamp. Raw vector values and chunk text are not exposed to renderer IPC.

The active namespace can be queued for rebuild through the derived-memory control surface. Deleting embeddings from this surface marks namespaces deleted and removes derived chunks/vectors for the owner, while preserving canonical logs and other production source records.

## Phase 3-F performance validation

The 200,000-log harness validates deterministic chunk generation, namespace-compatible vector persistence, coverage verification, activation, targeted invalidation after edits/deletions, restart/reopen stability, and storage growth. The benchmark stores deterministic synthetic vectors for repeatable performance measurement without live credentials; real provider embedding generation remains governed by the configured provider adapter and privacy/consent policy.
