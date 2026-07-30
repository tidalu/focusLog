# AI providers

Provider invocation belongs to the main-process coordinator. Before every initial attempt, retry, and fallback it revalidates the selected profile, current privacy mode, cloud consent, and persisted global/provider/chain kill switches. These restrictions take precedence over a queued fallback snapshot.

Cloud models without an enforceable price estimate are blocked before reservation and provider credential resolution; they are never treated as zero-cost. Each allowed invocation commits its own immutable pricing snapshot containing only safe provider/model identity, integer pricing rates, rounding rules, and token assumptions. Explicit local providers use a distinguishable zero-cost snapshot. Provider responses, credentials, and reservation identifiers are never exposed in queue or budget read models.

The coordinator passes the worker's `AbortSignal` to each adapter. Cancellation or loss of the worker lease stops a current request, records only a sanitized cancellation outcome, and prevents later retry or fallback calls. A late provider response is ignored before daily persistence and cannot turn a cancelled or reclaimed job into success.

When an adapter can safely report billable partial usage during cancellation, it returns a sanitized usage-bearing cancellation outcome with integer cost and optional token counts. FocusLog settles that amount once, records the cancellation without breaker failure, and releases the unused reservation remainder. It never retains raw response data, prompts, credentials, authorization data, or lease values in that outcome.

Daily requests ask providers for only the versioned structured JSON contract. Native schema modes are used where available and the returned value is runtime-validated; arbitrary free-form output is not a successful new daily result.

All analysis levels use versioned prompts and strict structured schemas. Invalid output, including a reference to unseen evidence, remains a validation failure and follows the existing bounded repair policy when execution is queued.

## Phase 5-C live provider certification

Live provider certification is opt-in and separate from normal tests. Run it only with user-approved local providers or cloud credentials:

```powershell
pnpm --filter @focuslog/desktop build:main
$env:FOCUSLOG_PHASE5C_LIVE='1'
node apps/desktop/dist-electron/ai/phase5-provider-performance-runner.js
```

Provider-specific configuration is read from environment variables and never printed as secrets:

| Provider          | Required configuration for live smoke                                                                 | Optional embedding variable                       |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Ollama            | `FOCUSLOG_LIVE_OLLAMA_MODEL`; optional `FOCUSLOG_LIVE_OLLAMA_ENDPOINT` defaults to loopback           | `FOCUSLOG_LIVE_OLLAMA_EMBEDDING_MODEL`            |
| LM Studio         | `FOCUSLOG_LIVE_LM_STUDIO_MODEL`; optional `FOCUSLOG_LIVE_LM_STUDIO_ENDPOINT` defaults to loopback     | `FOCUSLOG_LIVE_LM_STUDIO_EMBEDDING_MODEL`         |
| OpenAI            | `FOCUSLOG_LIVE_OPENAI_API_KEY`, `FOCUSLOG_LIVE_OPENAI_MODEL`                                          | `FOCUSLOG_LIVE_OPENAI_EMBEDDING_MODEL`            |
| Anthropic         | `FOCUSLOG_LIVE_ANTHROPIC_API_KEY`, `FOCUSLOG_LIVE_ANTHROPIC_MODEL`                                    | not supported by the adapter                      |
| Gemini            | `FOCUSLOG_LIVE_GEMINI_API_KEY`, `FOCUSLOG_LIVE_GEMINI_MODEL`                                          | `FOCUSLOG_LIVE_GEMINI_EMBEDDING_MODEL`            |
| OpenRouter        | `FOCUSLOG_LIVE_OPENROUTER_API_KEY`, `FOCUSLOG_LIVE_OPENROUTER_MODEL`                                  | `FOCUSLOG_LIVE_OPENROUTER_EMBEDDING_MODEL`        |
| OpenAI-compatible | `FOCUSLOG_LIVE_OPENAI_COMPATIBLE_ENDPOINT`, `FOCUSLOG_LIVE_OPENAI_COMPATIBLE_MODEL`; optional API key | `FOCUSLOG_LIVE_OPENAI_COMPATIBLE_EMBEDDING_MODEL` |

The certification matrix records model discovery, selected generation model, streaming, cancellation, structured output, usage reporting, embeddings where configured, unsupported capabilities, limitations, SDK/runtime version, date, and endpoint class. Providers without opt-in configuration are recorded as **untested**, not passed.

Invalid credentials, timeout, rate-limit, malformed response, redirect, and response-size behavior are covered by deterministic adapter certification tests instead of deliberately burning live provider quota or inducing unsafe throttling.
