import { ulid } from 'ulid';
import type { DesktopDatabase } from '../database/database.js';
import { AIError } from './errors.js';

export const MICROS_PER_USD = 1_000_000;
export function usdToMicros(value: string): number {
  if (!/^\d+(?:\.\d{1,6})?$/u.test(value))
    throw new AIError('VALIDATION', 'Use a USD amount with at most six decimal places.');
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * MICROS_PER_USD + Number(fraction.padEnd(6, '0'));
}

export function microsToUsd(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new AIError('VALIDATION', 'Budget amounts use non-negative integer micro-units.');
  return `${Math.floor(value / MICROS_PER_USD)}.${String(value % MICROS_PER_USD).padStart(6, '0')}`;
}

export interface BudgetSnapshot {
  periodKey: string;
  currency: 'USD';
  limitMicros: number | null;
  settledMicros: number;
  reservedMicros: number;
  remainingMicros: number | null;
}
export interface SafeBudgetProjection {
  periodKey: string;
  currency: 'USD';
  limitMicros: string | null;
  settledMicros: string;
  reservedMicros: string;
  remainingMicros: string | null;
  jobSettledMicros: string;
  jobReservedMicros: string;
}
export interface SafeFinancialProjection extends SafeBudgetProjection {
  requestCapMicros: string | null;
  pricingKnown: boolean;
  pricingVersion: string | null;
  blockReason: string | null;
  recoveryState: 'none' | 'active_reservation' | 'expired_reservation';
}

export class BudgetService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string
  ) {}
  reserve(
    jobId: string,
    plannedAttemptKey: string,
    profileId: string | null,
    micros: number,
    month: string,
    limitMicros: number | null,
    requestCapMicros: number | null = null,
    lease?: { workerId: string; token: string },
    providerAttemptId?: string,
    pricing?: { version: string; snapshot: Record<string, unknown> }
  ): string {
    if (!Number.isSafeInteger(micros) || micros < 0)
      throw new AIError('VALIDATION', 'Budget amounts use non-negative integer micro-units.');
    return this.database.transaction(() => {
      if (lease) {
        const current = this.database
          .prepare(
            'SELECT 1 FROM ai_jobs WHERE id = ? AND owner_id = ? AND status = ? AND lease_owner = ? AND lease_token = ? AND cancellation_requested = 0'
          )
          .get(jobId, this.ownerId, 'leased', lease.workerId, lease.token);
        if (!current)
          throw new AIError('CANCELLATION', 'The AI job lease is no longer active.', false);
      }
      const existing = this.database
        .prepare(
          'SELECT id FROM ai_budget_reservations WHERE job_id = ? AND planned_attempt_key = ?'
        )
        .get(jobId, plannedAttemptKey) as { id: string } | undefined;
      if (existing) return existing.id;
      const totals = this.totals(month);
      if (limitMicros !== null && totals.settled + totals.reserved + micros > limitMicros)
        throw new AIError('BUDGET_EXCEEDED', 'The monthly AI budget would be exceeded.');
      const request = this.database
        .prepare(
          `SELECT COALESCE(SUM(CASE WHEN status = 'settled' THEN settled_micros ELSE 0 END), 0) AS settled, COALESCE(SUM(CASE WHEN status = 'reserved' THEN reserved_micros ELSE 0 END), 0) AS reserved FROM ai_budget_reservations WHERE owner_id = ? AND job_id = ? AND currency = 'USD'`
        )
        .get(this.ownerId, jobId) as { settled: number; reserved: number };
      if (
        requestCapMicros !== null &&
        request.settled + request.reserved + micros > requestCapMicros
      )
        throw new AIError('BUDGET_EXCEEDED', 'The AI request cost cap would be exceeded.');
      const id = ulid();
      const now = new Date().toISOString();
      this.database
        .prepare(
          `INSERT INTO ai_budget_reservations (id, owner_id, job_id, provider_attempt_id, planned_attempt_key, provider_profile_id, period_key, currency, reserved_micros, status, expires_at, created_at, updated_at, pricing_version, pricing_snapshot_json) VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', ?, 'reserved', ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          this.ownerId,
          jobId,
          providerAttemptId ?? null,
          plannedAttemptKey,
          profileId,
          month,
          micros,
          new Date(Date.now() + 600_000).toISOString(),
          now,
          now,
          pricing?.version ?? null,
          pricing ? JSON.stringify(pricing.snapshot) : null
        );
      return id;
    })();
  }
  settle(
    id: string,
    micros: number,
    source: 'reported' | 'estimated' | 'conservative' = 'reported',
    lease?: { workerId: string; token: string }
  ): boolean {
    if (!Number.isSafeInteger(micros) || micros < 0)
      throw new AIError('VALIDATION', 'Budget amounts use non-negative integer micro-units.');
    const now = new Date().toISOString();
    return this.database.transaction(() => {
      if (lease && !this.activeLeaseForReservation(id, lease)) return false;
      return (
        this.database
          .prepare(
            `UPDATE ai_budget_reservations SET status = 'settled', settled_micros = ?, settlement_source = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'reserved'`
          )
          .run(micros, source, now, id, this.ownerId).changes === 1
      );
    })();
  }
  release(id: string, lease?: { workerId: string; token: string }): boolean {
    return this.database.transaction(() => {
      if (lease && !this.activeLeaseForReservation(id, lease)) return false;
      return (
        this.database
          .prepare(
            `UPDATE ai_budget_reservations SET status = 'released', updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'reserved'`
          )
          .run(new Date().toISOString(), id, this.ownerId).changes === 1
      );
    })();
  }
  snapshot(month: string, limitMicros: number | null): BudgetSnapshot {
    const totals = this.totals(month);
    return {
      periodKey: month,
      currency: 'USD',
      limitMicros,
      settledMicros: totals.settled,
      reservedMicros: totals.reserved,
      remainingMicros:
        limitMicros === null ? null : Math.max(0, limitMicros - totals.settled - totals.reserved)
    };
  }
  safeProjection(month: string, limitMicros: number | null, jobId: string): SafeBudgetProjection {
    const snapshot = this.snapshot(month, limitMicros);
    const job = this.database
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN status = 'settled' THEN settled_micros ELSE 0 END), 0) AS settled, COALESCE(SUM(CASE WHEN status = 'reserved' THEN reserved_micros ELSE 0 END), 0) AS reserved FROM ai_budget_reservations WHERE owner_id = ? AND job_id = ? AND period_key = ? AND currency = 'USD'`
      )
      .get(this.ownerId, jobId, month) as { settled: number; reserved: number };
    return {
      periodKey: snapshot.periodKey,
      currency: 'USD',
      limitMicros: snapshot.limitMicros === null ? null : String(snapshot.limitMicros),
      settledMicros: String(snapshot.settledMicros),
      reservedMicros: String(snapshot.reservedMicros),
      remainingMicros: snapshot.remainingMicros === null ? null : String(snapshot.remainingMicros),
      jobSettledMicros: String(job.settled),
      jobReservedMicros: String(job.reserved)
    };
  }
  financialProjection(
    month: string,
    limitMicros: number | null,
    jobId: string,
    options: {
      requestCapMicros?: number | null;
      pricingKnown?: boolean;
      pricingVersion?: string | null;
      blockReason?: string | null;
    } = {}
  ): SafeFinancialProjection {
    const base = this.safeProjection(month, limitMicros, jobId);
    const recovery = this.database
      .prepare(
        `SELECT MIN(expires_at) AS expiry FROM ai_budget_reservations WHERE owner_id = ? AND job_id = ? AND status = 'reserved'`
      )
      .get(this.ownerId, jobId) as { expiry: string | null };
    const persistedPricing = this.database
      .prepare(
        `SELECT pricing_version AS version, pricing_snapshot_json AS snapshot FROM ai_budget_reservations WHERE owner_id = ? AND job_id = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(this.ownerId, jobId) as { version: string | null; snapshot: string | null } | undefined;
    const recoveryState =
      recovery.expiry === null
        ? 'none'
        : recovery.expiry <= new Date().toISOString()
          ? 'expired_reservation'
          : 'active_reservation';
    const blockReason = options.blockReason
      ? options.blockReason
          .replace(/(bearer|api[_-]?key|authorization)\s+[^\s,;]+/giu, '$1 [redacted]')
          .slice(0, 160)
      : null;
    return {
      ...base,
      requestCapMicros:
        options.requestCapMicros === undefined || options.requestCapMicros === null
          ? null
          : String(options.requestCapMicros),
      pricingKnown: options.pricingKnown ?? Boolean(persistedPricing?.snapshot),
      pricingVersion: options.pricingVersion ?? persistedPricing?.version ?? null,
      blockReason,
      recoveryState
    };
  }
  recoverExpired(now = new Date().toISOString()): number {
    return this.database
      .prepare(
        `UPDATE ai_budget_reservations SET status = 'released', updated_at = ? WHERE owner_id = ? AND status = 'reserved' AND expires_at <= ?`
      )
      .run(now, this.ownerId, now).changes;
  }
  /** Conservative startup recovery: an expired in-flight call is charged its reservation; an expired pre-call hold is released. */
  recoverInterrupted(now = new Date().toISOString()): {
    released: number;
    conservativelySettled: number;
  } {
    const rows = this.database
      .prepare(
        `SELECT reservation.id, reservation.job_id AS jobId, reservation.reserved_micros AS reserved, attempt.provider_started_at AS providerStartedAt, EXISTS(SELECT 1 FROM ai_usage_records usage WHERE usage.owner_id = reservation.owner_id AND usage.job_id = reservation.job_id AND usage.outcome = 'SUCCESS') AS usagePersisted FROM ai_budget_reservations reservation LEFT JOIN ai_provider_attempts attempt ON attempt.id = reservation.provider_attempt_id WHERE reservation.owner_id = ? AND reservation.status = 'reserved' AND (reservation.expires_at <= ? OR EXISTS(SELECT 1 FROM ai_usage_records usage WHERE usage.owner_id = reservation.owner_id AND usage.job_id = reservation.job_id AND usage.outcome = 'SUCCESS'))`
      )
      .all(this.ownerId, now) as Array<{
      id: string;
      jobId: string;
      reserved: number;
      providerStartedAt: string | null;
      usagePersisted: number;
    }>;
    let released = 0;
    let conservativelySettled = 0;
    this.database.transaction(() => {
      for (const row of rows) {
        const settle = Boolean(row.usagePersisted) || Boolean(row.providerStartedAt);
        const result = settle
          ? this.database
              .prepare(
                `UPDATE ai_budget_reservations SET status = 'settled', settled_micros = reserved_micros, settlement_source = 'conservative', updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'reserved'`
              )
              .run(now, row.id, this.ownerId)
          : this.database
              .prepare(
                `UPDATE ai_budget_reservations SET status = 'released', updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'reserved'`
              )
              .run(now, row.id, this.ownerId);
        if (result.changes !== 1) continue;
        if (settle) conservativelySettled += 1;
        else released += 1;
        const category = row.usagePersisted
          ? 'usage_persisted_unsettled'
          : row.providerStartedAt
            ? 'usage_uncertain'
            : 'pre_call_expired';
        const reason = row.usagePersisted
          ? 'Persisted provider usage required settlement.'
          : row.providerStartedAt
            ? 'Provider usage was uncertain after interruption.'
            : 'Provider invocation had not started.';
        this.database
          .prepare(
            `INSERT OR IGNORE INTO ai_budget_recovery_diagnostics (id, owner_id, reservation_id, job_id, category, prior_state, resulting_state, reason, created_at) VALUES (?, ?, ?, ?, ?, 'reserved', ?, ?, ?)`
          )
          .run(
            ulid(),
            this.ownerId,
            row.id,
            row.jobId,
            category,
            settle ? 'settled' : 'released',
            reason,
            now
          );
      }
    })();
    return { released, conservativelySettled };
  }
  private totals(month: string): { settled: number; reserved: number } {
    return this.database
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN status = 'settled' THEN settled_micros ELSE 0 END), 0) AS settled, COALESCE(SUM(CASE WHEN status = 'reserved' THEN reserved_micros ELSE 0 END), 0) AS reserved FROM ai_budget_reservations WHERE owner_id = ? AND period_key = ? AND currency = 'USD'`
      )
      .get(this.ownerId, month) as { settled: number; reserved: number };
  }
  private activeLeaseForReservation(
    id: string,
    lease: { workerId: string; token: string }
  ): boolean {
    return Boolean(
      this.database
        .prepare(
          `SELECT 1 FROM ai_budget_reservations reservation JOIN ai_jobs job ON job.id = reservation.job_id WHERE reservation.id = ? AND reservation.owner_id = ? AND job.owner_id = ? AND job.status = 'leased' AND job.lease_owner = ? AND job.lease_token = ?`
        )
        .get(id, this.ownerId, this.ownerId, lease.workerId, lease.token)
    );
  }
}
