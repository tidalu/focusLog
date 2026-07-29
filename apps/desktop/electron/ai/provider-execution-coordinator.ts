import { ulid } from 'ulid';
import type { DesktopDatabase } from '../database/database.js';
import {
  AIError,
  AIUsageCancellationError,
  AIUsageError,
  normalizeProviderError
} from './errors.js';
import { BudgetService } from './budget-service.js';
import { ExecutionPolicyService } from './execution-policy-service.js';
import { CircuitBreakerService } from './circuit-breaker-service.js';
import { AICapacityController } from './capacity-controller.js';
import { decideProviderAction } from './provider-decision.js';
import type { PricingQuote, PricingSnapshot } from './pricing-catalog.js';

export interface CoordinatorEntry {
  providerProfileId: string;
  providerType: string;
  model: string;
  maxSameProviderRetries: number;
  allowFallback: boolean;
  concurrencyLimit?: number;
}
export interface CoordinatorRequest<T> {
  jobId: string;
  queueAttempt: number;
  entries: CoordinatorEntry[];
  signal?: AbortSignal;
  /** Enables re-reading privacy, consent, switches, profile state and cancellation before every call. */
  enforceCurrentPolicy?: boolean;
  chainId?: string;
  operationType?: 'generation' | 'structured_repair';
  repairIndex?: number;
  /** Lease identity from the production worker.  A stale process must not start or settle work. */
  lease?: { workerId: string; token: string };
  /** Internal composition barriers for deterministic lifecycle tests; never supplied by IPC. */
  hooks?: {
    afterPolicyValidation?(): void | Promise<void>;
    beforeReservation?(): void | Promise<void>;
    afterReservation?(): void | Promise<void>;
    beforeFallback?(entry: CoordinatorEntry): void | Promise<void>;
  };
  budget?: {
    requestCapMicros: number | null;
    monthlyLimitMicros: number | null;
    periodKey?: string;
    estimateMicros?(entry: CoordinatorEntry): number | null;
    pricingQuote?(entry: CoordinatorEntry): PricingQuote | null;
    actualMicros?(value: T, entry: CoordinatorEntry, snapshot: PricingSnapshot): number | null;
  };
  invoke(entry: CoordinatorEntry, signal?: AbortSignal): Promise<T>;
}
export interface CoordinatorResult<T> {
  value: T;
  providerProfileId: string;
  model: string;
  fallbackUsed: boolean;
  attempts: number;
}

const now = () => new Date().toISOString();
const capacities = new WeakMap<object, AICapacityController>();
function sharedCapacity(database: DesktopDatabase): AICapacityController {
  let controller = capacities.get(database);
  if (!controller) {
    controller = new AICapacityController();
    capacities.set(database, controller);
  }
  return controller;
}
/** Shared main-process capacity state, exposed only to privileged composition and safe status IPC. */
export function providerCapacityFor(database: DesktopDatabase): AICapacityController {
  return sharedCapacity(database);
}
function legacyQuote(entry: CoordinatorEntry, amount: number): PricingQuote {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new AIError('VALIDATION', 'Budget amounts use non-negative integer micro-units.');
  const snapshot: PricingSnapshot = {
    schemaVersion: 1,
    catalogueVersion: 'legacy-estimate-v1',
    providerType: entry.providerType,
    model: entry.model,
    currency: 'USD',
    inputMicrosPerMillion: '0',
    outputMicrosPerMillion: '0',
    cachedMicrosPerMillion: null,
    fixedMicros: String(amount),
    rounding: 'ceil-per-component',
    localZeroCost: false,
    estimatedInputTokens: '0',
    estimatedOutputTokens: '0',
    estimatedCachedTokens: '0',
    estimatedReservationMicros: String(amount)
  };
  return { version: snapshot.catalogueVersion, snapshot, estimatedMicros: amount };
}

/** Single bounded retry/fallback loop. Provider adapters are invoked only via this coordinator. */
export class ProviderExecutionCoordinator {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly capacity = sharedCapacity(database)
  ) {}
  async execute<T>(request: CoordinatorRequest<T>): Promise<CoordinatorResult<T>> {
    let sequence = (
      this.database
        .prepare(
          'SELECT COALESCE(MAX(sequence), 0) AS value FROM ai_provider_attempts WHERE job_id = ?'
        )
        .get(request.jobId) as { value: number }
    ).value;
    let total = 0;
    for (let index = 0; index < request.entries.length; index += 1) {
      const entry = request.entries[index]!;
      for (let retry = 0; retry <= entry.maxSameProviderRetries; retry += 1) {
        this.assertJobCanExecute(request);
        if (request.enforceCurrentPolicy)
          new ExecutionPolicyService(this.database, this.ownerId).assertCurrentAttempt(
            entry.providerProfileId,
            request.chainId
          );
        await request.hooks?.afterPolicyValidation?.();
        this.assertJobCanExecute(request);
        const breakerEnabled = Boolean(
          this.database
            .prepare('SELECT 1 FROM ai_provider_profiles WHERE id = ? AND owner_id = ?')
            .get(entry.providerProfileId, this.ownerId)
        );
        const breaker = new CircuitBreakerService(this.database, this.ownerId);
        const probe = breakerEnabled
          ? breaker.acquireProbe(entry.providerProfileId)
          : { state: 'closed' as const };
        if (probe.state === 'open') {
          if (entry.allowFallback && index + 1 < request.entries.length) break;
          throw new AIError(
            'PROVIDER_UNAVAILABLE',
            'This provider is temporarily unavailable.',
            true
          );
        }
        // Capacity is intentionally acquired before budget reservation, preventing long-held reservations while waiting.
        const releaseCapacity = await this.capacity.acquire(
          entry.providerProfileId,
          entry.concurrencyLimit ?? 1,
          100,
          request.signal
        );
        this.assertJobCanExecute(request);
        sequence += 1;
        total += 1;
        const id = ulid();
        const started = now();
        this.database
          .prepare(
            `INSERT INTO ai_provider_attempts (id, owner_id, job_id, sequence, queue_attempt, fallback_position, provider_profile_id, provider_type, model_id, operation_type, structured_repair_count, started_at, outcome, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?)`
          )
          .run(
            id,
            this.ownerId,
            request.jobId,
            sequence,
            request.queueAttempt,
            index,
            entry.providerProfileId,
            entry.providerType,
            entry.model,
            request.operationType ?? 'generation',
            request.repairIndex ?? 0,
            started,
            started,
            started
          );
        let reservationId: string | undefined;
        let reservationPricing: PricingSnapshot | undefined;
        let providerStarted = false;
        const invocationAbort = new AbortController();
        const abortFromRequest = () => invocationAbort.abort();
        request.signal?.addEventListener('abort', abortFromRequest, { once: true });
        const policyTimer = request.enforceCurrentPolicy
          ? setInterval(() => {
              try {
                new ExecutionPolicyService(this.database, this.ownerId).assertCurrentAttempt(
                  entry.providerProfileId,
                  request.chainId
                );
              } catch {
                invocationAbort.abort();
              }
            }, 25)
          : undefined;
        try {
          if (request.budget) {
            await request.hooks?.beforeReservation?.();
            this.assertJobCanExecute(request);
            if (request.enforceCurrentPolicy)
              new ExecutionPolicyService(this.database, this.ownerId).assertCurrentAttempt(
                entry.providerProfileId,
                request.chainId
              );
            const quote = request.budget.pricingQuote
              ? request.budget.pricingQuote(entry)
              : (() => {
                  const estimated = request.budget.estimateMicros?.(entry);
                  return estimated === null || estimated === undefined
                    ? null
                    : legacyQuote(entry, estimated);
                })();
            if (!quote)
              throw new AIError(
                'BUDGET_EXCEEDED',
                'This cloud model has no enforceable price estimate.'
              );
            const amount = quote.estimatedMicros;
            reservationPricing = quote.snapshot;
            reservationId = new BudgetService(this.database, this.ownerId).reserve(
              request.jobId,
              `${request.queueAttempt}:${sequence}`,
              entry.providerProfileId,
              amount,
              request.budget.periodKey ?? now().slice(0, 7),
              request.budget.monthlyLimitMicros,
              request.budget.requestCapMicros,
              request.lease,
              id,
              {
                version: quote.version,
                snapshot: quote.snapshot as unknown as Record<string, unknown>
              }
            );
            this.database
              .prepare(
                'UPDATE ai_provider_attempts SET reserved_cost_micros = ? WHERE id = ? AND owner_id = ?'
              )
              .run(amount, id, this.ownerId);
            await request.hooks?.afterReservation?.();
            this.assertJobCanExecute(request);
            if (request.enforceCurrentPolicy)
              new ExecutionPolicyService(this.database, this.ownerId).assertCurrentAttempt(
                entry.providerProfileId,
                request.chainId
              );
          }
          providerStarted = true;
          this.database
            .prepare(
              'UPDATE ai_provider_attempts SET provider_started_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?'
            )
            .run(now(), now(), id, this.ownerId);
          const value = await request.invoke(entry, invocationAbort.signal);
          if (invocationAbort.signal.aborted)
            throw new AIError(
              'CANCELLATION',
              'The provider request was stopped by current execution policy.',
              false
            );
          if (reservationId && request.budget) {
            const settled =
              request.budget.actualMicros?.(value, entry, reservationPricing!) ??
              (reservationPricing ? Number(reservationPricing.estimatedReservationMicros) : 0);
            new BudgetService(this.database, this.ownerId).settle(
              reservationId,
              settled,
              request.budget.actualMicros ? 'reported' : 'conservative',
              request.lease
            );
            this.database
              .prepare(
                'UPDATE ai_provider_attempts SET settled_cost_micros = ? WHERE id = ? AND owner_id = ?'
              )
              .run(settled, id, this.ownerId);
          }
          const finished = now();
          this.database
            .prepare(
              `UPDATE ai_provider_attempts SET outcome = 'succeeded', finished_at = ?, duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER), fallback_decision = ?, updated_at = ? WHERE id = ? AND owner_id = ?`
            )
            .run(
              finished,
              finished,
              index > 0 ? 'fallback_succeeded' : 'primary_succeeded',
              finished,
              id,
              this.ownerId
            );
          if (breakerEnabled) breaker.record(entry.providerProfileId, null, true);
          return {
            value,
            providerProfileId: entry.providerProfileId,
            model: entry.model,
            fallbackUsed: index > 0,
            attempts: total
          };
        } catch (error) {
          const usageError =
            error &&
            typeof error === 'object' &&
            'incurredMicros' in error &&
            Number.isSafeInteger((error as { incurredMicros?: unknown }).incurredMicros)
              ? (error as AIUsageError)
              : undefined;
          if (reservationId && usageError) {
            new BudgetService(this.database, this.ownerId).settle(
              reservationId,
              usageError.incurredMicros,
              'reported',
              request.lease
            );
            const usage =
              usageError instanceof AIUsageCancellationError ? usageError.usage : undefined;
            this.database
              .prepare(
                'UPDATE ai_provider_attempts SET settled_cost_micros = ?, reported_cost_micros = ?, input_tokens = ?, output_tokens = ?, cancellation_state = ? WHERE id = ? AND owner_id = ?'
              )
              .run(
                usageError.incurredMicros,
                usageError.incurredMicros,
                usage?.inputTokens ?? null,
                usage?.outputTokens ?? null,
                usageError.code === 'CANCELLATION' ? 'usage_reported' : null,
                id,
                this.ownerId
              );
          } else if (reservationId)
            new BudgetService(this.database, this.ownerId).release(reservationId, request.lease);
          const cancelled = invocationAbort.signal.aborted || usageError?.code === 'CANCELLATION';
          const normalized =
            usageError?.code === 'CANCELLATION'
              ? usageError
              : cancelled
                ? new AIError(
                    'CANCELLATION',
                    'The provider request was stopped by current execution policy.',
                    false
                  )
                : (usageError ?? normalizeProviderError(error));
          const action = decideProviderAction({
            phase: 'after_failure',
            errorCode: normalized.code,
            cancelled,
            privacyMode: 'LOCAL',
            consentValid: true,
            killSwitchEnabled: true,
            capacityAvailable: true,
            circuitState: 'closed',
            sameProviderRetries: retry,
            totalAttempts: total,
            maxSameProviderRetries: entry.maxSameProviderRetries,
            maxTotalAttempts: 8,
            hasFallback: entry.allowFallback && index + 1 < request.entries.length,
            requestCostRemainingMicros: Number.MAX_SAFE_INTEGER,
            estimatedAttemptCostMicros: 0,
            elapsedMs: 0,
            maxElapsedMs: 600_000,
            queueAttemptsRemaining: 1
          });
          if (providerStarted && breakerEnabled && !cancelled)
            breaker.record(entry.providerProfileId, normalized.code, false);
          const finished = now();
          this.database
            .prepare(
              `UPDATE ai_provider_attempts SET outcome = 'failed', error_code = ?, error_detail = ?, retry_decision = ?, finished_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?`
            )
            .run(
              normalized.code,
              normalized.message.slice(0, 500),
              action,
              finished,
              finished,
              id,
              this.ownerId
            );
          if (action === 'retry_same_provider') continue;
          if (action === 'fallback_next_provider') {
            await request.hooks?.beforeFallback?.(request.entries[index + 1]!);
            this.assertJobCanExecute(request);
            break;
          }
          throw normalized;
        } finally {
          if (policyTimer) clearInterval(policyTimer);
          request.signal?.removeEventListener('abort', abortFromRequest);
          releaseCapacity();
        }
      }
    }
    throw new AIError('PROVIDER_UNAVAILABLE', 'No fallback provider completed the request.', true);
  }

  private assertJobCanExecute<T>(request: CoordinatorRequest<T>): void {
    if (request.signal?.aborted)
      throw new AIError('CANCELLATION', 'The AI job was cancelled.', false);
    const job = this.database
      .prepare(
        'SELECT status, cancellation_requested AS cancelled, lease_owner AS leaseOwner, lease_token AS leaseToken FROM ai_jobs WHERE id = ? AND owner_id = ?'
      )
      .get(request.jobId, this.ownerId) as
      | { status: string; cancelled: number; leaseOwner: string | null; leaseToken: string | null }
      | undefined;
    if (!job || job.cancelled)
      throw new AIError('CANCELLATION', 'The AI job was cancelled.', false);
    if (
      request.lease &&
      (job.status !== 'leased' ||
        job.leaseOwner !== request.lease.workerId ||
        job.leaseToken !== request.lease.token)
    )
      throw new AIError('CANCELLATION', 'The AI job lease is no longer active.', false);
  }
}
