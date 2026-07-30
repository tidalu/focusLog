# FocusLog Mobile AI Accessibility

The mobile AI analysis surface uses standard Flutter Material controls for tab navigation, list tiles, buttons, switches, dropdowns, and cards. These controls provide keyboard/focus and screen-reader affordances in the same pattern as the rest of the app.

## Required states

The AI screen includes accessible text states for loading synchronized projections, empty/missing analysis results, executor unavailable, policy or compatibility errors, stale results, deleted or unavailable evidence, and pending queued actions.

## Controls

Analyze Now, regeneration, retry, cancellation, schedule enabled, and schedule kill-switch controls have visible labels or tooltips. Disabled controls disclose why an existing active job is being reused or why an action is not eligible.

## Long content

Readable summaries, structured sections, and evidence excerpts render in scrollable views with bounded previews. Raw prompts and provider responses are not exposed to screen readers or visual UI.

## Memory accessibility

The mobile memory surface uses labelled search fields, dropdown modes, list tiles, expansion tiles, and explicit buttons for Q&A, fact actions, graph requests, and memory controls. Empty/offline/cache states are textual. Large search, fact, graph, and Q&A lists are bounded and scrollable.

## M-H safety and recovery surface

The AI safety screen uses Material cards, text labels, chips, and `Semantics` annotations for security review, resource limits, performance thresholds, packaging readiness, and privacy-safe diagnostics. Loading and failure states are exposed as live regions so screen readers announce state changes.

Cost, resource, and technical status are represented as text, not color alone. Long diagnostics and threshold lists are scrollable and do not expose raw prompts or provider responses to assistive technology.

Representative M-H accessibility coverage checks:

- every AI route remains reachable through bottom navigation.
- the safety screen has labelled refresh, loading, failure, and status content.
- resource-limit state is expressed in text and a live-region chip.
- diagnostics explain exclusions for credentials, raw prompts, raw provider responses, authorization data, lease tokens, and reservation ownership tokens.
