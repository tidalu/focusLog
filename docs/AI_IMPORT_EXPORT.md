# AI Import and Export

Phase 4-D introduces safe Playground exchange bundles using the `focuslog.playground.exchange.v1` envelope.

## Supported artifacts

The safe exchange service supports Playground sessions, prompt templates, evaluation datasets, benchmark results, retrieval configurations, and structured schemas. Exports contain a manifest with artifact type, artifact ID, export timestamp, production-data inclusion flag, and a content hash.

## Safety rules

Exports redact credential-shaped strings and omit credential, secret, authorization, encrypted credential, lease, and internal reservation fields. Production data is excluded unless the caller explicitly requests it and the artifact type permits that disclosure.

Imports validate size, artifact schema, supported artifact type, supported provider identifiers, duplicate dataset case IDs, path traversal in source names, executable extensions, and credential-shaped content. Embedded instructions in imported artifacts are treated as untrusted data and recorded as warnings rather than executed.

## Rejected artifacts

FocusLog rejects unsafe relative paths, absolute paths, path traversal, executable scripts, oversized JSON/JSONL, unsupported provider IDs, namespace collisions, duplicate dataset case IDs, credential-shaped fields, and encrypted credential blobs.

## Phase 4-E gate coverage

The integrated gate reruns exchange validation with adversarial content and confirms imported instructions are retained only as inert data warnings. Export projections are safe by default, require explicit production-data inclusion, and record exchange diagnostics without credentials, raw private prompts, raw provider output, or path internals.

## Phase 5-A export certification

Phase 5-A treats export safety as a release gate. Automated certification scans safe exchange bundles and diagnostic projections for API keys, authorization headers, encrypted credential fields, URL credentials, queue lease tokens, reservation owner tokens, hidden provider snapshots, and unselected production data.

Production data can be included only through an explicit option and remains labeled in the export manifest. Credential-shaped imported content is rejected; embedded instructions remain inert data warnings and cannot change provider, privacy, switch, budget, namespace, or deletion behavior.

## Mobile export requests

Android can queue safe AI export requests and display a local preview of included categories. The preview and request exclude provider credentials, encrypted secret blobs, authorization data, deleted content, internal lease/reservation fields, and Playground data unless Playground is explicitly selected. The authoritative export builder performs final selection and redaction before producing an artifact.

## Mobile Playground exchange

Mobile Phase M-G supports safe Playground import validation and export previews for sessions, prompt templates, evaluation datasets, retrieval configurations, structured schemas, and diagnostic bundles. Validation rejects unsupported schemas, oversized artifacts, duplicate case IDs, unsafe paths/names, executable extensions, unsupported artifact types, and credential-shaped fields. Embedded instructions are treated as inert untrusted data warnings.

Mobile export previews exclude credentials, raw prompts, raw provider responses, authorization data, deleted content, and production data by default.
