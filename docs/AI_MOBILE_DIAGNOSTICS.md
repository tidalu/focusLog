# FocusLog Mobile AI Diagnostics

Mobile diagnostics are privacy-safe summaries for troubleshooting paired Android AI behavior.

## Included by default

- AI mobile contract version and mobile schema version.
- Workspace-safe sync cursor count.
- Pending AI outbox count.
- Synchronized AI result, job, and usage-summary counts.
- Desktop executor availability and execution-owner disclosure.
- Playground product decision and independent Playground switch state.
- Latest bounded lifecycle diagnostic category/state.

## Excluded by default

Diagnostics exclude private log text, raw prompts, raw provider responses, credentials, encrypted credential blobs, authorization headers, secret endpoint parameters, lease tokens, reservation ownership, internal machine IDs not required by the format, and deleted-source content.

Requests for richer content are represented as `requires_explicit_desktop_export`; Android does not silently include private production data.
