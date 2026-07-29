import type { DesktopDatabase } from '../database/database.js';
import type { AnalysisLevel } from './analysis-contracts.js';
import { AIError } from './errors.js';

export interface SafeAnalysisVersion {
  id: string;
  level: AnalysisLevel;
  periodId: string;
  timezone: string;
  version: number;
  status: 'current' | 'stale' | 'superseded' | 'legacy';
  staleReason: string | null;
  summary: string;
  confidence: string | null;
  completeness: string | null;
  providerProfileId: string | null;
  providerName: string | null;
  providerId: string | null;
  modelId: string | null;
  fallbackUsed: boolean;
  promptVersion: string;
  schemaVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costMicros: string | null;
  jobId: string | null;
  createdAt: string;
}

export interface SafeAnalysisResult extends SafeAnalysisVersion {
  structured: Record<string, unknown> | null;
  children: Array<{
    id: string;
    level: AnalysisLevel;
    periodId: string;
    version: number;
    status: string | null;
  }>;
  evidence: Array<{
    evidenceId: string;
    checkInId: string;
    revisionId: string;
    occurredAt: string;
    available: boolean;
    preview: string | null;
  }>;
  history: SafeAnalysisVersion[];
}

const levels: AnalysisLevel[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
function level(value: unknown): AnalysisLevel {
  if (!levels.includes(value as AnalysisLevel))
    throw new AIError('VALIDATION', 'Choose a valid analysis level.');
  return value as AnalysisLevel;
}
function boundedText(value: string | null | undefined, max = 220): string | null {
  if (!value) return null;
  return value.replace(/\s+/gu, ' ').trim().slice(0, max);
}
function confidenceFrom(value: string | null): {
  confidence: string | null;
  completeness: string | null;
} {
  if (!value) return { confidence: null, completeness: null };
  try {
    const parsed = JSON.parse(value) as {
      result?: { confidence?: unknown; completeness?: unknown };
      confidence?: unknown;
      dataCompleteness?: { level?: unknown };
    };
    return {
      confidence:
        typeof parsed.result?.confidence === 'string'
          ? parsed.result.confidence
          : typeof parsed.confidence === 'string'
            ? parsed.confidence
            : null,
      completeness:
        typeof parsed.result?.completeness === 'string'
          ? parsed.result.completeness
          : typeof parsed.dataCompleteness?.level === 'string'
            ? parsed.dataCompleteness.level
            : null
    };
  } catch {
    return { confidence: null, completeness: null };
  }
}

type ParentRow = {
  id: string;
  level: AnalysisLevel;
  periodId: string;
  timezone: string;
  version: number;
  status: 'current' | 'stale' | 'superseded';
  staleReason: string | null;
  summary: string;
  structuredJson: string;
  providerProfileId: string | null;
  providerName: string | null;
  providerId: string | null;
  modelId: string | null;
  fallbackUsed: number;
  promptVersion: string;
  schemaVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costMicros: number | null;
  jobId: string | null;
  createdAt: string;
};

export class AnalysisReadService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string
  ) {}

  list(levelInput: unknown, limit = 25): SafeAnalysisVersion[] {
    const requested = level(levelInput);
    const bounded = Math.max(1, Math.min(100, Number(limit) || 25));
    if (requested === 'daily') {
      const rows = this.database
        .prepare(
          `SELECT memory.id, 'daily' AS level, memory.period_key AS periodId, 'UTC' AS timezone, memory.version,
          CASE WHEN memory.status = 'ACTIVE' THEN 'current' WHEN memory.status = 'SUPERSEDED' THEN 'superseded' ELSE 'legacy' END AS status,
          NULL AS staleReason, memory.content AS summary, memory.structured_result_json AS structuredJson,
          memory.provider_profile_id AS providerProfileId, profile.name AS providerName, profile.provider_id AS providerId,
          usage.model_id AS modelId, 0 AS fallbackUsed, memory.prompt_version AS promptVersion, memory.schema_version AS schemaVersion,
          usage.input_tokens AS inputTokens, usage.output_tokens AS outputTokens, usage.total_tokens AS totalTokens,
          CASE WHEN usage.estimated_cost_usd IS NULL THEN NULL ELSE CAST(ROUND(usage.estimated_cost_usd * 1000000) AS INTEGER) END AS costMicros,
          memory.job_id AS jobId, memory.created_at AS createdAt
         FROM ai_memories memory
         LEFT JOIN ai_provider_profiles profile ON profile.id = memory.provider_profile_id AND profile.owner_id = memory.owner_id
         LEFT JOIN ai_usage_records usage ON usage.job_id = memory.job_id AND usage.owner_id = memory.owner_id
         WHERE memory.owner_id = ? AND memory.period_kind = 'DAY'
         ORDER BY memory.created_at DESC, memory.version DESC LIMIT ?`
        )
        .all(this.ownerId, bounded) as ParentRow[];
      return rows.map((row) => this.version(row, 'legacy'));
    }
    const rows = this.parentQuery(
      'WHERE result.owner_id = ? AND result.level = ? ORDER BY result.created_at DESC, result.version DESC LIMIT ?'
    ).all(this.ownerId, requested, bounded) as ParentRow[];
    return rows.map((row) => this.version(row));
  }

  get(id: unknown): SafeAnalysisResult {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{6,80}$/u.test(id))
      throw new AIError('VALIDATION', 'Choose a valid analysis result.');
    const parent = this.parentQuery('WHERE result.owner_id = ? AND result.id = ?').get(
      this.ownerId,
      id
    ) as ParentRow | undefined;
    if (parent) return this.parentResult(parent);
    const daily = this.database
      .prepare(
        `SELECT memory.id, 'daily' AS level, memory.period_key AS periodId, 'UTC' AS timezone, memory.version,
        CASE WHEN memory.status = 'ACTIVE' THEN 'current' WHEN memory.status = 'SUPERSEDED' THEN 'superseded' ELSE 'legacy' END AS status,
        NULL AS staleReason, memory.content AS summary, memory.structured_result_json AS structuredJson,
        memory.provider_profile_id AS providerProfileId, profile.name AS providerName, profile.provider_id AS providerId,
        usage.model_id AS modelId, 0 AS fallbackUsed, memory.prompt_version AS promptVersion, memory.schema_version AS schemaVersion,
        usage.input_tokens AS inputTokens, usage.output_tokens AS outputTokens, usage.total_tokens AS totalTokens,
        CASE WHEN usage.estimated_cost_usd IS NULL THEN NULL ELSE CAST(ROUND(usage.estimated_cost_usd * 1000000) AS INTEGER) END AS costMicros,
        memory.job_id AS jobId, memory.created_at AS createdAt
       FROM ai_memories memory
       LEFT JOIN ai_provider_profiles profile ON profile.id = memory.provider_profile_id AND profile.owner_id = memory.owner_id
       LEFT JOIN ai_usage_records usage ON usage.job_id = memory.job_id AND usage.owner_id = memory.owner_id
       WHERE memory.owner_id = ? AND memory.id = ?`
      )
      .get(this.ownerId, id) as ParentRow | undefined;
    if (!daily) throw new AIError('VALIDATION', 'The analysis result is unavailable.');
    return {
      ...this.version(daily),
      structured: this.structured(daily.structuredJson),
      children: [],
      evidence: this.dailyEvidence(daily.id),
      history: this.list('daily', 50).filter((item) => item.periodId === daily.periodId)
    };
  }

  dependencyStatus(
    levelInput: unknown,
    periodIdInput: unknown
  ): Array<{ level: AnalysisLevel; periodId: string; status: 'available' | 'missing' }> {
    const requested = level(levelInput);
    if (typeof periodIdInput !== 'string' || !periodIdInput.trim())
      throw new AIError('VALIDATION', 'Choose a valid analysis period.');
    if (requested === 'daily') return [];
    const rows = this.database
      .prepare(
        `SELECT child_level AS level, child_period_id AS periodId, child_result_id AS id
         FROM ai_analysis_child_sources source
         JOIN ai_analysis_results result ON result.id = source.analysis_result_id
        WHERE result.owner_id = ? AND result.level = ? AND result.period_id = ? AND result.status IN ('current','stale')
        ORDER BY source.child_period_id`
      )
      .all(this.ownerId, requested, periodIdInput) as Array<{
      level: AnalysisLevel;
      periodId: string;
      id: string;
    }>;
    return rows.map((row) => ({
      level: row.level,
      periodId: row.periodId,
      status: 'available' as const
    }));
  }

  schedulerStatus(): {
    schedules: number;
    diagnostics: Array<{ level: AnalysisLevel; code: string; message: string; createdAt: string }>;
  } {
    const schedules = (
      this.database
        .prepare('SELECT COUNT(*) AS count FROM ai_analysis_schedules WHERE owner_id = ?')
        .get(this.ownerId) as { count: number }
    ).count;
    const diagnostics = this.database
      .prepare(
        'SELECT level, code, message, created_at AS createdAt FROM ai_analysis_schedule_diagnostics WHERE owner_id = ? ORDER BY created_at DESC LIMIT 20'
      )
      .all(this.ownerId) as Array<{
      level: AnalysisLevel;
      code: string;
      message: string;
      createdAt: string;
    }>;
    return { schedules, diagnostics };
  }

  private parentQuery(where: string) {
    return this.database.prepare(
      `SELECT result.id, result.level, result.period_id AS periodId, result.timezone_id AS timezone,
        result.version, result.status, result.stale_reason AS staleReason, result.readable_summary AS summary,
        result.structured_result_json AS structuredJson, result.provider_profile_id AS providerProfileId,
        profile.name AS providerName, result.provider_id AS providerId, result.model_id AS modelId,
        result.fallback_used AS fallbackUsed, result.prompt_version AS promptVersion, result.schema_version AS schemaVersion,
        usage.input_tokens AS inputTokens, usage.output_tokens AS outputTokens, usage.total_tokens AS totalTokens,
        result.estimated_cost_usd AS costMicros, result.job_id AS jobId, result.created_at AS createdAt
       FROM ai_analysis_results result
       LEFT JOIN ai_provider_profiles profile ON profile.id = result.provider_profile_id AND profile.owner_id = result.owner_id
       LEFT JOIN ai_usage_records usage ON usage.id = result.usage_record_id AND usage.owner_id = result.owner_id
       ${where}`
    );
  }

  private parentResult(row: ParentRow): SafeAnalysisResult {
    const history = this.parentQuery(
      'WHERE result.owner_id = ? AND result.level = ? AND result.period_id = ? ORDER BY result.version DESC'
    ).all(this.ownerId, row.level, row.periodId) as ParentRow[];
    const children = this.database
      .prepare(
        `SELECT source.child_result_id AS id, source.child_level AS level, source.child_period_id AS periodId,
              source.child_version AS version, COALESCE(result.status, memory.status) AS status
         FROM ai_analysis_child_sources source
         LEFT JOIN ai_analysis_results result ON result.id = source.child_result_id AND result.owner_id = source.owner_id
         LEFT JOIN ai_memories memory ON memory.id = source.child_result_id AND memory.owner_id = source.owner_id
        WHERE source.owner_id = ? AND source.analysis_result_id = ?
        ORDER BY source.child_period_id LIMIT 100`
      )
      .all(this.ownerId, row.id) as SafeAnalysisResult['children'];
    return {
      ...this.version(row),
      structured: this.structured(row.structuredJson),
      children,
      evidence: this.parentEvidence(row.id),
      history: history.map((item) => this.version(item))
    };
  }

  private version(row: ParentRow, dailyFallback?: 'legacy'): SafeAnalysisVersion {
    const extracted = confidenceFrom(row.structuredJson);
    return {
      id: row.id,
      level: row.level,
      periodId: row.periodId,
      timezone: row.timezone,
      version: row.version,
      status:
        row.status === 'current' || row.status === 'stale' || row.status === 'superseded'
          ? row.status
          : (dailyFallback ?? 'legacy'),
      staleReason: row.staleReason,
      summary: row.summary,
      confidence: extracted.confidence,
      completeness: extracted.completeness,
      providerProfileId: row.providerProfileId,
      providerName: row.providerName,
      providerId: row.providerId,
      modelId: row.modelId,
      fallbackUsed: row.fallbackUsed === 1,
      promptVersion: row.promptVersion,
      schemaVersion: row.schemaVersion,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
      costMicros: row.costMicros === null ? null : String(row.costMicros),
      jobId: row.jobId,
      createdAt: row.createdAt
    };
  }

  private structured(value: string | null): Record<string, unknown> | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private parentEvidence(id: string): SafeAnalysisResult['evidence'] {
    return this.database
      .prepare(
        `SELECT source.evidence_id AS evidenceId, source.check_in_id AS checkInId, source.revision_id AS revisionId,
              source.occurred_at AS occurredAt,
              CASE WHEN check_ins.deleted_at IS NULL AND check_ins.owner_id = ? THEN 1 ELSE 0 END AS available,
              check_in_revisions.body AS body
         FROM ai_analysis_log_sources source
         LEFT JOIN check_ins ON check_ins.id = source.check_in_id AND check_ins.owner_id = source.owner_id
         LEFT JOIN check_in_revisions ON check_in_revisions.id = source.revision_id AND check_in_revisions.check_in_id = check_ins.id
        WHERE source.owner_id = ? AND source.analysis_result_id = ?
        ORDER BY source.occurred_at LIMIT 100`
      )
      .all(this.ownerId, this.ownerId, id)
      .map((row) => {
        const item = row as {
          evidenceId: string;
          checkInId: string;
          revisionId: string;
          occurredAt: string;
          available: number;
          body: string | null;
        };
        return {
          evidenceId: item.evidenceId,
          checkInId: item.checkInId,
          revisionId: item.revisionId,
          occurredAt: item.occurredAt,
          available: item.available === 1,
          preview: item.available === 1 ? boundedText(item.body) : null
        };
      });
  }

  private dailyEvidence(id: string): SafeAnalysisResult['evidence'] {
    return this.database
      .prepare(
        `SELECT source.check_in_id AS evidenceId, source.check_in_id AS checkInId, source.revision_id AS revisionId,
              check_ins.submitted_at AS occurredAt,
              CASE WHEN check_ins.deleted_at IS NULL AND check_ins.owner_id = ? THEN 1 ELSE 0 END AS available,
              check_in_revisions.body AS body
         FROM ai_memory_sources source
         LEFT JOIN check_ins ON check_ins.id = source.check_in_id
         LEFT JOIN check_in_revisions ON check_in_revisions.id = source.revision_id AND check_in_revisions.check_in_id = check_ins.id
        WHERE source.memory_id = ?
        ORDER BY check_ins.submitted_at LIMIT 100`
      )
      .all(this.ownerId, id)
      .map((row) => {
        const item = row as {
          evidenceId: string;
          checkInId: string;
          revisionId: string;
          occurredAt: string;
          available: number;
          body: string | null;
        };
        return {
          evidenceId: item.evidenceId,
          checkInId: item.checkInId,
          revisionId: item.revisionId,
          occurredAt: item.occurredAt,
          available: item.available === 1,
          preview: item.available === 1 ? boundedText(item.body) : null
        };
      });
  }
}
