# AI budgets and reservations

FocusLog enforces money using integer USD micro-units (one USD is `1_000_000` units), never binary floating-point values. Decimal input accepts at most six fractional digits and read models serialize amounts as integers or fixed six-place decimal strings.

Before every queued provider invocation, the coordinator rechecks cancellation, current privacy and consent, all kill switches, profile/model validity, the request aggregate cap, and the calendar-month workspace budget. A request cap includes retries and fallbacks. Unknown cloud pricing is blocked whenever a cap is active; explicitly local providers reserve zero.

A reservation is inserted transactionally with a unique `(job, planned attempt)` key. The transaction sums settled and active reserved amounts before inserting, so competing jobs cannot both consume the final capacity. A successful call settles once; a call that never began releases once. Expired unstarted reservations are released during recovery. A settled reservation remains settled if the process exits before queue acknowledgement.

The monthly period is `YYYY-MM` in the configured UTC budget period. Changing display time zones does not reopen already-accounted spending. Safe budget projections include only period, currency, limit, settled, reserved, and remaining amounts; they never expose provider credentials, lease tokens, or reservation ownership data.

Pricing rules are versioned and use integer micro-units per million tokens plus optional fixed fees. At each reservation, the coordinator commits an immutable, sanitized pricing snapshot: catalogue version, provider/model identity, integer rates, rounding policy, token assumptions, and exact reserved micro-units. Each retry, fallback, and structured repair receives a new snapshot. Settlement uses provider-reported cost when permitted, otherwise it recalculates from that committed snapshot and reported token usage; it never silently switches to a newer catalogue. Explicit local zero-cost rules carry a `localZeroCost` marker, while unknown cloud models are blocked and never represented as zero. Renderer-safe financial projections expose only whether pricing is known, catalogue version, and the reserved amount—not the snapshot itself.

Cancellation is also checked after reservation and before invocation. If it wins at that boundary, the reservation is released once and no provider call or settled cost is recorded. A provider call that reaches durable successful persistence settles once; startup reconciliation reuses that committed state rather than creating a second reservation, usage row, or result.

If a provider reports sanitized billable usage while honouring cancellation, the reservation settles exactly that integer micro-unit amount rather than being released in full. The unused estimate becomes available immediately. The attempt is recorded as cancellation with safe token/cost metadata, does not count as a circuit-breaker failure, and cannot retry or fall back. A cancellation without reported usage retains the normal full-release path. Late provider callbacks cannot change the settled reservation or persist a result.

## Mobile budget controls

Android budget projections display authoritative month, currency, monthly limit, settled, reserved, remaining, request cap, and unknown-pricing block state as exact micro-unit strings. Mobile edits are queued as `ai.budget.update` operations and do not reserve funds locally. Duplicate offline actions reuse stable outbox semantics; the desktop/backend coordinator remains responsible for aggregate cap enforcement, request caps, pricing snapshots, and reservation settlement.
