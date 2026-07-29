import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import type { AIErrorCode, PrivacyMode } from './types.js';

export type AIJobKind =
  | 'daily_analysis'
  | 'weekly_analysis'
  | 'monthly_analysis'
  | 'quarterly_analysis'
  | 'yearly_analysis'
  | 'fact_extract_source'
  | 'fact_reconcile_subject'
  | 'fact_mark_stale'
  | 'fact_rebuild_range'
  | 'graph_update_from_fact'
  | 'graph_resolve_entity'
  | 'graph_rebuild_subject'
  | 'graph_remove_unsupported_edges';
export type AIJobStatus =
  'queued' | 'leased' | 'retry_wait' | 'succeeded' | 'failed' | 'cancelled' | 'dead_lettered';

export interface AIJob {
  id: string;
  ownerId: string;
  kind: AIJobKind;
  status: AIJobStatus;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  leaseOwner: string | null;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
  cancellationRequested: boolean;
  requestedProfileId: string | null;
  requestedModelId: string | null;
  privacyMode: PrivacyMode | null;
  lastErrorCode: AIErrorCode | null;
  lastErrorMessage: string | null;
  resultReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueJob {
  kind: AIJobKind;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
  runAfter?: Date;
  requestedProfileId?: string;
  requestedModelId?: string;
  privacyMode?: PrivacyMode;
  fallbackSnapshot?: {
    schemaVersion: 1;
    chainId?: string | null;
    chainVersion?: number | null;
    entries: Array<{
      providerProfileId: string;
      providerType: string;
      model: string;
      maxSameProviderRetries: number;
      allowFallback: boolean;
    }>;
    requestCapMicros?: number | null;
    consentPurpose?: string;
  };
}

type JobRow = Omit<AIJob, 'payload' | 'cancellationRequested'> & {
  payload: string;
  cancellationRequested: number;
};

function timestamp(value = new Date()): string {
  return value.toISOString();
}
function parseJob(row: JobRow): AIJob {
  return {
    ...row,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    cancellationRequested: row.cancellationRequested === 1
  };
}
function safeErrorDetail(value: string): string {
  return value
    .replace(/(?:bearer|api[_-]?key|x-api-key)\s+[^\s,;]+/giu, '$1 [redacted]')
    .slice(0, 500);
}

export function retryDelay(attempt: number, random = Math.random): number {
  const base = Math.min(300_000, 1_000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (0.75 + random() * 0.5));
}

export function isRetryableJobError(code: AIErrorCode): boolean {
  return ['NETWORK_UNAVAILABLE', 'TIMEOUT', 'RATE_LIMIT', 'PROVIDER_UNAVAILABLE'].includes(code);
}

export class AIJobQueue {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string
  ) {}

  enqueue(input: EnqueueJob): AIJob {
    if (!input.idempotencyKey.trim()) throw new Error('AI jobs require an idempotency key.');
    const existing = this.database
      .prepare(
        `SELECT id, owner_id AS ownerId, kind, status, idempotency_key AS idempotencyKey, payload_json AS payload,
              priority, attempts, max_attempts AS maxAttempts, run_after AS runAfter, lease_owner AS leaseOwner,
              lease_token AS leaseToken, lease_expires_at AS leaseExpiresAt,
              cancellation_requested AS cancellationRequested, requested_profile_id AS requestedProfileId,
              requested_model_id AS requestedModelId, privacy_mode AS privacyMode, last_error_code AS lastErrorCode,
              last_error_message AS lastErrorMessage, result_reference AS resultReference, created_at AS createdAt, updated_at AS updatedAt
         FROM ai_jobs WHERE owner_id = ? AND idempotency_key = ? AND status IN ('queued','leased','retry_wait','succeeded')`
      )
      .get(this.ownerId, input.idempotencyKey) as JobRow | undefined;
    if (existing) return parseJob(existing);
    const id = ulid();
    const now = timestamp();
    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, requested_profile_id, requested_model_id, privacy_mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'queued', 1, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          this.ownerId,
          input.kind,
          input.idempotencyKey,
          JSON.stringify(input.payload),
          input.priority ?? 100,
          input.maxAttempts ?? 3,
          timestamp(input.runAfter),
          timestamp(input.runAfter),
          input.requestedProfileId ?? null,
          input.requestedModelId ?? null,
          input.privacyMode ?? null,
          now,
          now
        );
      if (input.fallbackSnapshot) {
        const snapshot = input.fallbackSnapshot;
        if (
          snapshot.schemaVersion !== 1 ||
          !Array.isArray(snapshot.entries) ||
          snapshot.entries.some((entry) => !entry.providerProfileId || !entry.model)
        )
          throw new Error('AI fallback snapshot is invalid.');
        this.database
          .prepare(
            `INSERT INTO ai_job_fallback_snapshots (job_id, owner_id, chain_id, chain_version, snapshot_json, request_cap_micros, privacy_mode, consent_purpose, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            id,
            this.ownerId,
            snapshot.chainId ?? null,
            snapshot.chainVersion ?? null,
            JSON.stringify(snapshot),
            snapshot.requestCapMicros ?? null,
            input.privacyMode ?? 'DISABLED',
            snapshot.consentPurpose ?? 'analyses',
            now
          );
      }
    })();
    return this.get(id)!;
  }

  fallbackSnapshot(id: string): EnqueueJob['fallbackSnapshot'] | null {
    const row = this.database
      .prepare(
        'SELECT snapshot_json AS snapshot FROM ai_job_fallback_snapshots WHERE job_id = ? AND owner_id = ?'
      )
      .get(id, this.ownerId) as { snapshot: string } | undefined;
    if (!row) return null;
    const value = JSON.parse(row.snapshot) as EnqueueJob['fallbackSnapshot'];
    if (!value || value.schemaVersion !== 1 || !Array.isArray(value.entries))
      throw new Error('AI fallback snapshot schema is unsupported.');
    return value;
  }

  get(id: string): AIJob | null {
    const row = this.database
      .prepare(
        `SELECT id, owner_id AS ownerId, kind, status, idempotency_key AS idempotencyKey, payload_json AS payload,
              priority, attempts, max_attempts AS maxAttempts, run_after AS runAfter, lease_owner AS leaseOwner,
              lease_token AS leaseToken, lease_expires_at AS leaseExpiresAt,
              cancellation_requested AS cancellationRequested, requested_profile_id AS requestedProfileId,
              requested_model_id AS requestedModelId, privacy_mode AS privacyMode, last_error_code AS lastErrorCode,
              last_error_message AS lastErrorMessage, result_reference AS resultReference, created_at AS createdAt, updated_at AS updatedAt
         FROM ai_jobs WHERE id = ? AND owner_id = ?`
      )
      .get(id, this.ownerId) as JobRow | undefined;
    return row ? parseJob(row) : null;
  }

  leaseNext(workerId: string, leaseMs: number, at = new Date()): AIJob | null {
    const now = timestamp(at);
    const expiry = timestamp(new Date(at.getTime() + leaseMs));
    const token = ulid();
    return this.database.transaction(() => {
      const candidate = this.database
        .prepare(
          `SELECT id FROM ai_jobs WHERE owner_id = ? AND cancellation_requested = 0
           AND status IN ('queued', 'retry_wait') AND run_after <= ?
         ORDER BY priority DESC, created_at ASC LIMIT 1`
        )
        .get(this.ownerId, now) as { id: string } | undefined;
      if (!candidate) return null;
      const updated = this.database
        .prepare(
          `UPDATE ai_jobs SET status = 'leased', attempts = attempts + 1, lease_owner = ?, lease_token = ?,
           lease_acquired_at = ?, lease_expires_at = ?, started_at = COALESCE(started_at, ?), updated_at = ?
         WHERE id = ? AND status IN ('queued','retry_wait') AND cancellation_requested = 0`
        )
        .run(workerId, token, now, expiry, now, now, candidate.id);
      return updated.changes === 1 ? this.get(candidate.id) : null;
    })();
  }

  renewLease(
    jobId: string,
    workerId: string,
    leaseToken: string,
    leaseMs: number,
    at = new Date()
  ): boolean {
    return (
      this.database
        .prepare(
          `UPDATE ai_jobs SET lease_expires_at = ?, updated_at = ?
        WHERE id = ? AND owner_id = ? AND status = 'leased' AND lease_owner = ? AND lease_token = ? AND cancellation_requested = 0`
        )
        .run(
          timestamp(new Date(at.getTime() + leaseMs)),
          timestamp(at),
          jobId,
          this.ownerId,
          workerId,
          leaseToken
        ).changes === 1
    );
  }

  updateProgress(
    jobId: string,
    workerId: string,
    leaseToken: string,
    progress: Record<string, unknown>
  ): boolean {
    return (
      this.database
        .prepare(
          `UPDATE ai_jobs SET progress_json = ?, updated_at = ?
           WHERE id = ? AND owner_id = ? AND status = 'leased' AND lease_owner = ? AND lease_token = ?`
        )
        .run(JSON.stringify(progress), timestamp(), jobId, this.ownerId, workerId, leaseToken)
        .changes === 1
    );
  }

  reclaimExpiredLeases(at = new Date()): number {
    return this.database
      .prepare(
        `UPDATE ai_jobs SET status = CASE WHEN cancellation_requested = 1 THEN 'cancelled' WHEN attempts < max_attempts THEN 'retry_wait' ELSE 'dead_lettered' END,
        lease_owner = NULL, lease_token = NULL, lease_acquired_at = NULL, lease_expires_at = NULL,
        run_after = ?, finished_at = CASE WHEN cancellation_requested = 1 OR attempts >= max_attempts THEN ? ELSE NULL END,
        updated_at = ?, last_error_code = 'PROVIDER_UNAVAILABLE',
        last_error_message = 'AI worker lease expired before the job completed.',
        dead_letter_reason = CASE WHEN cancellation_requested = 1 OR attempts < max_attempts THEN NULL ELSE 'AI worker lease expired before the job completed.' END
       WHERE owner_id = ? AND status = 'leased' AND lease_expires_at <= ?`
      )
      .run(timestamp(at), timestamp(at), timestamp(at), this.ownerId, timestamp(at)).changes;
  }

  reconcilePersistedResults(): { reconciled: number; orphaned: number } {
    return this.database.transaction(() => {
      const results = this.database
        .prepare(
          `SELECT memory.id AS resultId, memory.job_id AS jobId, job.status AS jobStatus
             FROM ai_memories memory LEFT JOIN ai_jobs job ON job.id = memory.job_id AND job.owner_id = memory.owner_id
            WHERE memory.owner_id = ? AND memory.job_id IS NOT NULL AND memory.content <> ''`
        )
        .all(this.ownerId) as Array<{
        resultId: string;
        jobId: string;
        jobStatus: AIJobStatus | null;
      }>;
      results.push(
        ...(this.database
          .prepare(
            `SELECT result.id AS resultId, result.job_id AS jobId, job.status AS jobStatus
               FROM ai_analysis_results result LEFT JOIN ai_jobs job ON job.id = result.job_id AND job.owner_id = result.owner_id
              WHERE result.owner_id = ? AND result.job_id IS NOT NULL AND result.readable_summary <> ''`
          )
          .all(this.ownerId) as Array<{
          resultId: string;
          jobId: string;
          jobStatus: AIJobStatus | null;
        }>)
      );
      let reconciled = 0;
      let orphaned = 0;
      const finish = this.database.prepare(
        `UPDATE ai_jobs SET status = 'succeeded', finished_at = ?, completed_at = ?, updated_at = ?, result_reference = ?,
          lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL
         WHERE id = ? AND owner_id = ? AND status IN ('queued','leased','retry_wait')`
      );
      for (const result of results) {
        if (!result.jobStatus) {
          orphaned += 1;
          this.recordDiagnostic(
            null,
            'ORPHAN_RESULT',
            `Analysis result ${result.resultId} has no queue job.`
          );
          continue;
        }
        const now = timestamp();
        if (finish.run(now, now, now, result.resultId, result.jobId, this.ownerId).changes === 1)
          reconciled += 1;
      }
      return { reconciled, orphaned };
    })();
  }

  recover(at = new Date()): { reconciled: number; reclaimed: number; orphaned: number } {
    const reconciliation = this.reconcilePersistedResults();
    const reclaimed = this.reclaimExpiredLeases(at);
    if (reconciliation.reconciled || reclaimed || reconciliation.orphaned)
      this.recordDiagnostic(
        null,
        'STARTUP_RECOVERY',
        `Reconciled ${reconciliation.reconciled} result(s), reclaimed ${reclaimed} lease(s), found ${reconciliation.orphaned} orphan result(s).`
      );
    return { ...reconciliation, reclaimed };
  }

  retry(id: string): AIJob | null {
    const previous = this.get(id);
    if (!previous || !['failed', 'dead_lettered'].includes(previous.status)) return null;
    const retryKey = `${previous.idempotencyKey}:manual-retry:${previous.id}`;
    return this.enqueue({
      kind: previous.kind,
      idempotencyKey: retryKey,
      payload: { ...previous.payload, retryOf: previous.id },
      priority: previous.priority,
      maxAttempts: previous.maxAttempts,
      requestedProfileId: previous.requestedProfileId ?? undefined,
      requestedModelId: previous.requestedModelId ?? undefined,
      privacyMode: previous.privacyMode ?? undefined
    });
  }

  counts(): Record<AIJobStatus, number> {
    const result: Record<AIJobStatus, number> = {
      queued: 0,
      leased: 0,
      retry_wait: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
      dead_lettered: 0
    };
    const rows = this.database
      .prepare('SELECT status, COUNT(*) AS count FROM ai_jobs WHERE owner_id = ? GROUP BY status')
      .all(this.ownerId) as Array<{ status: AIJobStatus; count: number }>;
    for (const row of rows) result[row.status] = row.count;
    return result;
  }

  private recordDiagnostic(jobId: string | null, code: string, message: string): void {
    this.database
      .prepare(
        `INSERT INTO ai_queue_diagnostics (id, owner_id, job_id, code, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(ulid(), this.ownerId, jobId, code, safeErrorDetail(message), timestamp());
    this.database
      .prepare(
        `DELETE FROM ai_queue_diagnostics WHERE owner_id = ? AND id NOT IN
         (SELECT id FROM ai_queue_diagnostics WHERE owner_id = ? ORDER BY created_at DESC, id DESC LIMIT 100)`
      )
      .run(this.ownerId, this.ownerId);
  }

  requestCancellation(id: string): AIJob | null {
    const job = this.get(id);
    if (!job) return null;
    const now = timestamp();
    if (job.status === 'queued' || job.status === 'retry_wait') {
      this.database
        .prepare(
          `UPDATE ai_jobs SET status = 'cancelled', cancellation_requested = 1, finished_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?`
        )
        .run(now, now, id, this.ownerId);
    } else if (job.status === 'leased') {
      this.database
        .prepare(
          `UPDATE ai_jobs SET cancellation_requested = 1, updated_at = ? WHERE id = ? AND owner_id = ?`
        )
        .run(now, id, this.ownerId);
    }
    return this.get(id);
  }

  complete(jobId: string, workerId: string, leaseToken: string, resultReference?: string): boolean {
    const now = timestamp();
    return (
      this.database
        .prepare(
          `UPDATE ai_jobs SET status = 'succeeded', finished_at = ?, completed_at = ?, updated_at = ?, result_reference = ?,
        lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL
       WHERE id = ? AND owner_id = ? AND status = 'leased' AND lease_owner = ? AND lease_token = ? AND cancellation_requested = 0`
        )
        .run(now, now, now, resultReference ?? null, jobId, this.ownerId, workerId, leaseToken)
        .changes === 1
    );
  }

  fail(
    jobId: string,
    workerId: string,
    leaseToken: string,
    code: AIErrorCode,
    message: string,
    retryable = isRetryableJobError(code),
    at = new Date()
  ): AIJob | null {
    const job = this.get(jobId);
    if (
      !job ||
      job.status !== 'leased' ||
      job.leaseOwner !== workerId ||
      job.leaseToken !== leaseToken
    )
      return null;
    const now = timestamp(at);
    const nextStatus: AIJobStatus = job.cancellationRequested
      ? 'cancelled'
      : retryable && job.attempts < job.maxAttempts
        ? 'retry_wait'
        : retryable
          ? 'dead_lettered'
          : 'failed';
    const nextRun =
      nextStatus === 'retry_wait'
        ? timestamp(new Date(at.getTime() + retryDelay(job.attempts)))
        : now;
    this.database
      .prepare(
        `UPDATE ai_jobs SET status = ?, run_after = ?, finished_at = CASE WHEN ? IN ('failed','cancelled','dead_lettered') THEN ? ELSE NULL END,
        updated_at = ?, lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL, last_error_code = ?, last_error_message = ?, dead_letter_reason = CASE WHEN ? = 'dead_lettered' THEN ? ELSE NULL END
       WHERE id = ? AND owner_id = ? AND status = 'leased' AND lease_owner = ? AND lease_token = ?`
      )
      .run(
        nextStatus,
        nextRun,
        nextStatus,
        now,
        now,
        code,
        safeErrorDetail(message),
        nextStatus,
        safeErrorDetail(message),
        jobId,
        this.ownerId,
        workerId,
        leaseToken
      );
    return this.get(jobId);
  }

  list(limit = 100): AIJob[] {
    const ids = this.database
      .prepare('SELECT id FROM ai_jobs WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(this.ownerId, limit) as Array<{ id: string }>;
    return ids.flatMap((row) => {
      const job = this.get(row.id);
      return job ? [job] : [];
    });
  }
}
