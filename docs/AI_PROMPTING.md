# AI Prompting

FocusLog treats user logs, imported documents, retrieved text, facts, graph labels, and Playground content as untrusted input.

## Playground prompt validation

The Playground prompt service validates:

- Required system instructions and user template.
- Declared versus used `{{variable}}` placeholders.
- Unsafe triple-brace interpolation.
- Invalid variable names.
- Distinct untrusted-content delimiters.
- Closing delimiter injection in user templates and developer instructions.
- Oversized prompt templates before they can become Playground versions.
- JSON structured-output schemas.
- Provider capability for native or JSON structured output when a provider profile is selected.

Imported or copied prompt content is treated as untrusted until reviewed. Playground edits do not modify production prompts.

## Delimiters

Context items are rendered inside explicit untrusted-content blocks. If source content or a user-supplied variable contains the closing delimiter, it is replaced in the inspected prompt so retrieved text cannot escape its boundary or impersonate instructions.

## Context budgeting

The context builder requires `reservedOutputTokens` to leave room inside `maxContextTokens`, rejects excessive context budgets, applies optional evidence-count limits, and applies deterministic recency weighting when configured. The persisted snapshot records the final ordered items, adjusted retrieval score, stale state, token estimate, truncation, and provider-upload implication.

## Structured output

Structured schemas must be JSON object schemas. Providers without native or JSON structured-output support are rejected at prompt validation time for structured Playground prompts.

The Phase 4-C structured-output workbench can run provider-native structured output or prompt JSON fallback through the production coordinator. It validates parsed JSON against the selected object schema, records validation errors, and performs at most one bounded repair call when prompt JSON fallback is explicitly allowed. Workbench templates cover analysis, fact, graph-update, and retrieval-planning shapes as safe starting points for later prompt experiments.

## Promotion safety

Production prompt files can be copied into Playground for experimentation. Promotion back to production requires an explicit patch/export review and is intentionally not automatic.

## Phase 4-E prompt boundary gate

The integrated adversarial gate checks delimiter escape, instruction override, citation manipulation, and context-explosion attacks across prompt/context tooling and imports. Safe prompt inspection remains redacted and treats copied/imported content as untrusted data.
