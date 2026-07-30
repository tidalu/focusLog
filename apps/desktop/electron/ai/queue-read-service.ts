import type { DesktopDatabase } from '../database/database.js';
import type { AIErrorCode } from './types.js';
import type { AIJobStatus } from './job-queue.js';

export interface QueueJobView {
  id: string;
  kind: string;
  status: AIJobStatus;
  priority: number;
  createdAt: string;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  cancellationRequested: boolean;
  providerName: string | null;
  providerType: string | null;
  requestedModelId: string | null;
  actualModelId: string | null;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  errorCode: AIErrorCode | null;
  errorMessage: string | null;
  resultReference: string | null;
  actions: { canCancel: boolean; canRetry: boolean };
}
export interface SafeExecutionSummary {
  job: QueueJobView;
  snapshotVersion: number | null;
  fallbackUsed: boolean;
  attempts: Array<{
    sequence: number;
    providerProfileId: string | null;
    providerType: string | null;
    model: string | null;
    operation: string;
    outcome: string;
    errorCode: AIErrorCode | null;
    retryDecision: string | null;
    fallbackDecision: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    settledMicros: string | null;
  }>;
}

type QueueJobRow = Omit<QueueJobView, 'cancellationRequested' | 'actions'> & {
  cancellationRequested: number;
};

function view(row: QueueJobRow): QueueJobView {
  return {
    ...row,
    cancellationRequested: row.cancellationRequested === 1,
    actions: {
      canCancel: ['queued', 'leased', 'retry_wait'].includes(row.status),
      canRetry: ['failed', 'dead_lettered'].includes(row.status)
    }
  };
}

const select = `SELECT job.id, job.kind, job.status, job.priority, job.created_at AS createdAt,
  job.scheduled_at AS scheduledAt, job.started_at AS startedAt, job.finished_at AS finishedAt,
  job.attempts, job.max_attempts AS maxAttempts, job.run_after AS runAfter,
  job.cancellation_requested AS cancellationRequested, profile.name AS providerName,
  profile.provider_id AS providerType, job.requested_model_id AS requestedModelId,
  job.actual_model_id AS actualModelId, job.duration_ms AS durationMs, job.input_tokens AS inputTokens,
  job.output_tokens AS outputTokens, job.estimated_cost_usd AS estimatedCostUsd,
  job.last_error_code AS errorCode, job.last_error_message AS errorMessage,
  job.result_reference AS resultReference
 FROM ai_jobs job LEFT JOIN ai_provider_profiles profile ON profile.id = job.requested_profile_id
 WHERE job.owner_id = ?`;

export class QueueReadService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string
  ) {}

  list(limit = 50, status?: AIJobStatus): QueueJobView[] {
    const bounded = Math.max(1, Math.min(100, limit));
    const sql = `${select}${status ? ' AND job.status = ?' : ''} ORDER BY job.created_at DESC LIMIT ?`;
    const rows = (
      status
        ? this.database.prepare(sql).all(this.ownerId, status, bounded)
        : this.database.prepare(sql).all(this.ownerId, bounded)
    ) as QueueJobRow[];
    return rows.map(view);
  }

  get(id: string): QueueJobView | null {
    const row = this.database.prepare(`${select} AND job.id = ?`).get(this.ownerId, id) as
      QueueJobRow | undefined;
    return row ? view(row) : null;
  }

  executionSummary(id: string): SafeExecutionSummary | null {
    const job = this.get(id);
    if (!job) return null;
    const snapshot = this.database
      .prepare(
        'SELECT chain_version AS version FROM ai_job_fallback_snapshots WHERE job_id = ? AND owner_id = ?'
      )
      .get(id, this.ownerId) as { version: number | null } | undefined;
    const attempts = this.database
      .prepare(
        `SELECT sequence, provider_profile_id AS providerProfileId, provider_type AS providerType, model_id AS model, operation_type AS operation, outcome, error_code AS errorCode, retry_decision AS retryDecision, fallback_decision AS fallbackDecision, input_tokens AS inputTokens, output_tokens AS outputTokens, settled_cost_micros AS settledMicros FROM ai_provider_attempts WHERE owner_id = ? AND job_id = ? ORDER BY sequence`
      )
      .all(this.ownerId, id) as Array<{
      sequence: number;
      providerProfileId: string | null;
      providerType: string | null;
      model: string | null;
      operation: string;
      outcome: string;
      errorCode: AIErrorCode | null;
      retryDecision: string | null;
      fallbackDecision: string | null;
      inputTokens: number | null;
      outputTokens: number | null;
      settledMicros: number | null;
    }>;
    return {
      job,
      snapshotVersion: snapshot?.version ?? null,
      fallbackUsed: attempts.some(
        (attempt) => attempt.fallbackDecision === 'fallback_succeeded' || attempt.sequence > 1
      ),
      attempts: attempts.map((attempt) => ({
        ...attempt,
        settledMicros: attempt.settledMicros === null ? null : String(attempt.settledMicros)
      }))
    };
  }
}
