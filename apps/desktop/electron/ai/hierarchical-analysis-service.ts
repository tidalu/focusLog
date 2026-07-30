import { createHash } from 'node:crypto';
import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import { analysisPeriod } from './analysis-periods.js';
import type { AnalysisLevel, AnalysisPeriod } from './analysis-contracts.js';
import { parseAnalysisResultV1, type AnalysisResultV1 } from './analysis-schema.js';
import { analysisStatistics, type StatisticsRecord } from './analysis-statistics.js';
import { selectAnalysisEvidence, renderUntrustedEvidence } from './analysis-evidence.js';
import type { AnalysisEvidence } from './analysis-contracts.js';
import { AIService } from './ai-service.js';
import { AIError, AIProcessLossFault } from './errors.js';
import { loadBuiltinPrompt, renderPrompt } from './prompts.js';
import {
  ProviderExecutionCoordinator,
  type CoordinatorEntry
} from './provider-execution-coordinator.js';
import { createProviderAdapter } from './providers.js';
import { PricingCatalog } from './pricing-catalog.js';
import { usdToMicros } from './budget-service.js';
import { AIJobQueue, type AIJobKind } from './job-queue.js';
import {
  HIERARCHICAL_ANALYSIS_PAYLOAD_VERSION,
  hierarchicalAnalysisIdempotencyKey,
  type HierarchicalAnalysisJobPayload,
  type ParentAnalysisLevel
} from './hierarchical-analysis-job.js';
import {
  DAILY_ANALYSIS_PAYLOAD_VERSION,
  dailyAnalysisIdempotencyKey,
  dailyPeriodBounds
} from './daily-analysis-job.js';
import type { GenerationResult, PrivacyMode } from './types.js';

export type HierarchicalAnalysisFault =
  'after_validation_before_persistence' | 'after_persistence_before_acknowledgement';

interface ChildSummary {
  id: string;
  kind: 'ai_analysis_results' | 'ai_memories';
  level: AnalysisLevel;
  periodId: string;
  version: number;
  summary: string;
}

interface RawRecord {
  ownerId: string;
  sourceId: string;
  revisionId: string;
  occurredAt: string;
  text: string;
  category: string | null;
  project: string | null;
  deletedAt: string | null;
  available: number;
  privacyAllowed: number;
  pinned: number;
}

interface PreparedInput {
  period: AnalysisPeriod;
  childLevel: AnalysisLevel;
  children: ChildSummary[];
  evidence: AnalysisEvidence[];
  statistics: ReturnType<typeof analysisStatistics>;
  sourceRevisionHash: string;
  missing: string[];
}

const levelToKind: Record<ParentAnalysisLevel, AIJobKind> = {
  weekly: 'weekly_analysis',
  monthly: 'monthly_analysis',
  quarterly: 'quarterly_analysis',
  yearly: 'yearly_analysis'
};
const childLevel: Record<ParentAnalysisLevel, AnalysisLevel> = {
  weekly: 'daily',
  monthly: 'weekly',
  quarterly: 'monthly',
  yearly: 'quarterly'
};
const timestamp = () => new Date().toISOString();
const datePlus = (value: string, days: number) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
};
const hash = (parts: readonly string[]) =>
  createHash('sha256').update(parts.join('\u001f')).digest('hex');

function periodsBetween(level: AnalysisLevel, parent: AnalysisPeriod): AnalysisPeriod[] {
  if (level === 'daily') {
    const result: AnalysisPeriod[] = [];
    for (let day = parent.localStart; day < parent.localEnd; day = datePlus(day, 1))
      result.push(analysisPeriod('daily', day, parent.timezone));
    return result;
  }
  const result: AnalysisPeriod[] = [];
  let cursor = parent.localStart;
  while (cursor < parent.localEnd) {
    const period = analysisPeriod(level, cursor, parent.timezone);
    if (!result.some((item) => item.periodId === period.periodId)) result.push(period);
    cursor = period.localEnd <= cursor ? datePlus(cursor, 1) : period.localEnd;
  }
  return result.filter(
    (period) => period.localStart >= parent.localStart && period.localStart < parent.localEnd
  );
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).slice(0, 100_000);
}

export class HierarchicalAnalysisService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly ai: AIService
  ) {}

  sourceRevisionHash(level: ParentAnalysisLevel, localAnchor: string, timezone: string): string {
    return this.prepare(level, localAnchor, timezone).sourceRevisionHash;
  }

  enqueue(
    queue: AIJobQueue,
    input: {
      level: ParentAnalysisLevel;
      localAnchor: string;
      timezone: string;
      providerProfileId: string;
      requestedModelId: string;
      privacyMode: PrivacyMode;
      regeneration?: number;
      trigger?: 'manual' | 'scheduled' | 'dependency';
    }
  ) {
    const prompt = loadBuiltinPrompt(input.level);
    const period = analysisPeriod(input.level, input.localAnchor, input.timezone);
    const payload: HierarchicalAnalysisJobPayload = {
      schemaVersion: HIERARCHICAL_ANALYSIS_PAYLOAD_VERSION,
      level: input.level,
      localAnchor: input.localAnchor,
      timezone: input.timezone,
      periodId: period.periodId,
      periodStartUtc: period.periodStartUtc,
      periodEndUtc: period.periodEndUtc,
      providerProfileId: input.providerProfileId,
      requestedModelId: input.requestedModelId,
      privacyMode: input.privacyMode,
      promptId: prompt.id,
      promptVersion: prompt.version,
      sourceRevisionHash: this.sourceRevisionHash(input.level, input.localAnchor, input.timezone),
      regeneration: input.regeneration ?? 0,
      trigger: input.trigger ?? 'manual'
    };
    return queue.enqueue({
      kind: levelToKind[input.level],
      idempotencyKey: hierarchicalAnalysisIdempotencyKey(payload),
      payload: { ...payload },
      requestedProfileId: input.providerProfileId,
      requestedModelId: input.requestedModelId,
      privacyMode: input.privacyMode
    });
  }

  async analyze(
    payload: HierarchicalAnalysisJobPayload,
    options: {
      signal?: AbortSignal;
      jobId?: string;
      fault?: HierarchicalAnalysisFault;
      lease?: { workerId: string; token: string };
    } = {}
  ): Promise<{ id: string; content: string; sourceCount: number }> {
    if (options.signal?.aborted)
      throw new AIError('CANCELLATION', 'The analysis was cancelled.', false);
    const settings = this.ai.getSettings();
    const config = this.ai.requireExecution(payload.providerProfileId, 'analyses');
    if (settings.mode !== payload.privacyMode)
      throw new AIError(
        'PERMISSION',
        'AI privacy settings changed after this analysis was queued.'
      );
    if (!config.profile.generationModel)
      throw new AIError(
        'INVALID_CONFIGURATION',
        'Select a generation model for this provider profile.'
      );
    if (config.profile.generationModel !== payload.requestedModelId)
      throw new AIError(
        'INVALID_CONFIGURATION',
        'The selected provider model changed after this analysis was queued.'
      );
    const prepared = this.prepare(payload.level, payload.localAnchor, payload.timezone);
    if (prepared.sourceRevisionHash !== payload.sourceRevisionHash)
      throw new AIError(
        'VALIDATION',
        'Analysis dependencies changed after this job was queued.',
        true
      );
    if (prepared.missing.length) {
      this.enqueueMissingChildren(payload, prepared);
      throw new AIError(
        'PROVIDER_UNAVAILABLE',
        `Waiting for ${prepared.missing.length} required child analysis result(s).`,
        true
      );
    }
    if (options.jobId) {
      const existing = this.database
        .prepare(
          'SELECT id, readable_summary AS content FROM ai_analysis_results WHERE owner_id = ? AND job_id = ? LIMIT 1'
        )
        .get(this.ownerId, options.jobId) as { id: string; content: string } | undefined;
      if (existing)
        return { ...existing, sourceCount: prepared.children.length + prepared.evidence.length };
    }
    const prompt = loadBuiltinPrompt(payload.level);
    const evidenceText = [
      '<trusted_child_summaries>',
      ...prepared.children.map(
        (child) =>
          `[${child.level}:${child.periodId}:v${child.version}:${child.id}]\n${child.summary}`
      ),
      '</trusted_child_summaries>',
      renderUntrustedEvidence(prepared.evidence)
    ].join('\n');
    const rendered = renderPrompt(prompt.content, {
      period_id: prepared.period.periodId,
      statistics: JSON.stringify(prepared.statistics),
      evidence: evidenceText
    });
    const allowedEvidence = new Set([
      ...prepared.children.map((child) => child.id),
      ...prepared.evidence.map((item) => item.sourceId)
    ]);
    const durableJobRecord = options.jobId
      ? (this.database
          .prepare('SELECT attempts FROM ai_jobs WHERE id = ? AND owner_id = ?')
          .get(options.jobId, this.ownerId) as { attempts: number } | undefined)
      : undefined;
    const durableJob = Boolean(durableJobRecord && options.jobId);
    const selectedModel = config.profile.generationModel;
    const snapshot =
      durableJob && options.jobId
        ? (this.database
            .prepare(
              'SELECT snapshot_json AS snapshot FROM ai_job_fallback_snapshots WHERE job_id = ? AND owner_id = ?'
            )
            .get(options.jobId, this.ownerId) as { snapshot: string } | undefined)
        : undefined;
    const parsedSnapshot = snapshot
      ? (() => {
          const parsed = JSON.parse(snapshot.snapshot) as {
            schemaVersion?: number;
            entries?: CoordinatorEntry[];
            requestCapMicros?: number | null;
          };
          if (
            parsed.schemaVersion !== 1 ||
            !Array.isArray(parsed.entries) ||
            !parsed.entries.length
          )
            throw new AIError('VALIDATION', 'The queued fallback snapshot is unsupported.');
          return parsed;
        })()
      : undefined;
    const entries: CoordinatorEntry[] = parsedSnapshot?.entries ?? [
      {
        providerProfileId: config.profile.id,
        providerType: config.profile.providerId,
        model: selectedModel,
        maxSameProviderRetries: config.profile.retryLimit,
        allowFallback: false
      }
    ];
    const pricing = new PricingCatalog();
    const settingsRequestCap =
      settings.requestCostCapUsd === null
        ? null
        : usdToMicros(settings.requestCostCapUsd.toFixed(6));
    const queuedRequestCap = parsedSnapshot?.requestCapMicros ?? null;
    const effectiveRequestCap =
      settingsRequestCap === null
        ? queuedRequestCap
        : queuedRequestCap === null
          ? settingsRequestCap
          : Math.min(settingsRequestCap, queuedRequestCap);
    const started = performance.now();
    const generationRequest = {
      model: selectedModel,
      prompt: rendered,
      maxOutputTokens: Math.min(settings.maxOutputTokens, config.profile.maxOutputTokens),
      temperature: config.profile.temperature,
      topP: config.profile.topP,
      signal: options.signal
    };
    const result = durableJob
      ? await new ProviderExecutionCoordinator(
          this.database,
          this.ownerId
        ).execute<GenerationResult>({
          jobId: options.jobId!,
          queueAttempt: durableJobRecord!.attempts,
          signal: options.signal,
          lease: options.lease,
          enforceCurrentPolicy: true,
          entries,
          budget: {
            requestCapMicros: effectiveRequestCap,
            monthlyLimitMicros:
              settings.monthlyCloudBudgetUsd === null
                ? null
                : usdToMicros(settings.monthlyCloudBudgetUsd.toFixed(6)),
            pricingQuote: (entry) =>
              pricing.quote(entry.providerType, entry.model, {
                inputTokens: Math.ceil(rendered.length / 4),
                outputTokens: generationRequest.maxOutputTokens
              }),
            actualMicros: (value, _entry, snapshot) =>
              pricing.estimateFromSnapshot(snapshot, {
                inputTokens: value.usage.inputTokens ?? Math.ceil(rendered.length / 4),
                outputTokens: value.usage.outputTokens ?? generationRequest.maxOutputTokens
              })
          },
          invoke: async (entry, signal) => {
            const current =
              entry.providerProfileId === config.profile.id
                ? config
                : this.ai.requireExecution(entry.providerProfileId, 'analyses');
            return createProviderAdapter(current).generate({
              ...generationRequest,
              model: entry.model,
              signal
            });
          }
        })
      : {
          value: await createProviderAdapter(config).generate(generationRequest),
          providerProfileId: config.profile.id,
          model: selectedModel,
          fallbackUsed: false
        };
    const parsed = parseAnalysisResultV1(
      JSON.parse(result.value.text),
      payload.level,
      prepared.period.periodId,
      allowedEvidence
    );
    if (options.signal?.aborted)
      throw new AIError('CANCELLATION', 'The analysis was cancelled.', false);
    if (options.fault === 'after_validation_before_persistence')
      throw new AIError('PROVIDER_UNAVAILABLE', 'Injected analysis interruption.', true);
    const latest = this.prepare(payload.level, payload.localAnchor, payload.timezone);
    if (latest.sourceRevisionHash !== payload.sourceRevisionHash) {
      this.enqueue(queueFor(this.database, this.ownerId), {
        ...payload,
        trigger: 'dependency',
        regeneration: payload.regeneration + 1
      });
      throw new AIError(
        'PROVIDER_UNAVAILABLE',
        'Analysis dependencies changed while the provider was running.',
        true
      );
    }
    const id = this.persist(payload, prepared, parsed.result, {
      jobId: options.jobId,
      providerProfileId: result.providerProfileId,
      providerId: config.profile.providerId,
      model: result.model,
      fallbackUsed: result.fallbackUsed,
      usage: result.value.usage,
      durationMs: Math.round(performance.now() - started)
    });
    if (options.fault === 'after_persistence_before_acknowledgement')
      throw new AIProcessLossFault();
    return {
      id,
      content: parsed.result.summary,
      sourceCount: prepared.children.length + prepared.evidence.length
    };
  }

  markDependentsStale(sourceResultIds: readonly string[], reason: string): number {
    if (!sourceResultIds.length) return 0;
    let changed = 0;
    const seen = new Set<string>();
    const visit = (sourceId: string) => {
      if (seen.has(sourceId)) return;
      seen.add(sourceId);
      const dependents = this.database
        .prepare(
          `SELECT result.id, result.level, result.period_id AS periodId
             FROM ai_analysis_child_sources source
             JOIN ai_analysis_results result ON result.id = source.analysis_result_id
            WHERE source.owner_id = ? AND source.child_result_id = ? AND result.status = 'current'`
        )
        .all(this.ownerId, sourceId) as Array<{
        id: string;
        level: AnalysisLevel;
        periodId: string;
      }>;
      for (const dependent of dependents) {
        const now = timestamp();
        const updated = this.database
          .prepare(
            `UPDATE ai_analysis_results SET status = 'stale', stale_reason = ?, updated_at = ?
              WHERE id = ? AND owner_id = ? AND status = 'current'`
          )
          .run(reason, now, dependent.id, this.ownerId).changes;
        if (updated) {
          changed += 1;
          this.database
            .prepare(
              `INSERT OR IGNORE INTO ai_analysis_dependency_events (id, owner_id, source_result_id, dependent_result_id, event_type, message, created_at)
               VALUES (?, ?, ?, ?, 'stale', ?, ?)`
            )
            .run(ulid(), this.ownerId, sourceId, dependent.id, reason.slice(0, 500), now);
          visit(dependent.id);
        }
      }
    };
    for (const id of sourceResultIds) visit(id);
    return changed;
  }

  private prepare(
    level: ParentAnalysisLevel,
    localAnchor: string,
    timezone: string
  ): PreparedInput {
    const period = analysisPeriod(level, localAnchor, timezone);
    const requiredChildLevel = childLevel[level];
    const required = periodsBetween(requiredChildLevel, period);
    const children = required.flatMap((child) => {
      const result = this.currentChild(requiredChildLevel, child.periodId);
      return result ? [result] : [];
    });
    const missing = required
      .filter((child) => !children.some((result) => result.periodId === child.periodId))
      .map((child) => child.localStart);
    const raw = this.rawRecords(period);
    const statistics = analysisStatistics(
      raw.map(
        (record) =>
          ({
            id: record.sourceId,
            ownerId: record.ownerId,
            submittedAt: record.occurredAt,
            text: record.text,
            category: record.category ?? undefined,
            project: record.project ?? undefined
          }) satisfies StatisticsRecord
      ),
      period
    );
    const evidence = selectAnalysisEvidence(
      this.ownerId,
      raw.map((record) => ({
        ownerId: record.ownerId,
        id: record.sourceId,
        revisionId: record.revisionId,
        submittedAt: record.occurredAt,
        content: record.text,
        deleted: Boolean(record.deletedAt),
        available: record.available === 1,
        privacyAllowed: record.privacyAllowed === 1,
        pinned: record.pinned === 1
      })),
      { maxCount: 8, maxCharacters: 8_000 }
    );
    return {
      period,
      childLevel: requiredChildLevel,
      children,
      evidence,
      statistics,
      missing,
      sourceRevisionHash: hash([
        period.boundaryPolicyVersion,
        ...children.map(
          (child) => `${child.level}:${child.periodId}:${child.id}:v${child.version}`
        ),
        ...evidence.map((item) => `${item.sourceId}:${item.revisionId}`)
      ])
    };
  }

  private currentChild(level: AnalysisLevel, periodId: string): ChildSummary | null {
    if (level === 'daily') {
      const memory = this.database
        .prepare(
          `SELECT id, version, content FROM ai_memories
            WHERE owner_id = ? AND period_kind = 'DAY' AND period_key = ? AND status = 'ACTIVE'
            ORDER BY version DESC LIMIT 1`
        )
        .get(this.ownerId, periodId) as
        { id: string; version: number; content: string } | undefined;
      return memory
        ? {
            id: memory.id,
            kind: 'ai_memories',
            level,
            periodId,
            version: memory.version,
            summary: memory.content
          }
        : null;
    }
    const result = this.database
      .prepare(
        `SELECT id, version, readable_summary AS summary FROM ai_analysis_results
          WHERE owner_id = ? AND level = ? AND period_id = ? AND status = 'current'
          ORDER BY version DESC LIMIT 1`
      )
      .get(this.ownerId, level, periodId) as
      { id: string; version: number; summary: string } | undefined;
    return result ? { ...result, kind: 'ai_analysis_results', level, periodId } : null;
  }

  private rawRecords(period: AnalysisPeriod): RawRecord[] {
    return this.database
      .prepare(
        `SELECT check_ins.owner_id AS ownerId, check_ins.id AS sourceId, check_in_revisions.id AS revisionId,
                check_ins.submitted_at AS occurredAt, check_in_revisions.body AS text, NULL AS category,
                NULL AS project, check_ins.deleted_at AS deletedAt, 1 AS available, 1 AS privacyAllowed, 0 AS pinned
           FROM check_ins JOIN check_in_revisions ON check_in_revisions.id = check_ins.current_revision_id
          WHERE check_ins.owner_id = ? AND check_ins.deleted_at IS NULL
            AND check_ins.submitted_at >= ? AND check_ins.submitted_at < ?
          ORDER BY check_ins.submitted_at ASC LIMIT 1000`
      )
      .all(this.ownerId, period.periodStartUtc, period.periodEndUtc) as RawRecord[];
  }

  private enqueueMissingChildren(
    payload: HierarchicalAnalysisJobPayload,
    prepared: PreparedInput
  ): void {
    const queue = queueFor(this.database, this.ownerId);
    const oldest = prepared.missing[0];
    if (!oldest) return;
    if (prepared.childLevel === 'daily') {
      const prompt = loadBuiltinPrompt('daily');
      const bounds = dailyPeriodBounds(oldest, payload.timezone);
      const dailyPayload = {
        schemaVersion: DAILY_ANALYSIS_PAYLOAD_VERSION,
        localDate: oldest,
        timezone: payload.timezone,
        ...bounds,
        providerProfileId: payload.providerProfileId,
        requestedModelId: payload.requestedModelId,
        privacyMode: payload.privacyMode,
        promptId: prompt.id,
        promptVersion: prompt.version,
        sourceRevisionHash: createHash('sha256')
          .update(
            this.rawRecords(analysisPeriod('daily', oldest, payload.timezone))
              .map((item) => item.revisionId)
              .join(',')
          )
          .digest('hex'),
        regeneration: 0,
        trigger: 'scheduled' as const
      };
      queue.enqueue({
        kind: 'daily_analysis',
        idempotencyKey: dailyAnalysisIdempotencyKey(dailyPayload),
        payload: { ...dailyPayload },
        requestedProfileId: payload.providerProfileId,
        requestedModelId: payload.requestedModelId,
        privacyMode: payload.privacyMode
      });
      return;
    }
    this.enqueue(queue, {
      level: prepared.childLevel as ParentAnalysisLevel,
      localAnchor: oldest,
      timezone: payload.timezone,
      providerProfileId: payload.providerProfileId,
      requestedModelId: payload.requestedModelId,
      privacyMode: payload.privacyMode,
      trigger: 'dependency'
    });
  }

  private persist(
    payload: HierarchicalAnalysisJobPayload,
    prepared: PreparedInput,
    result: AnalysisResultV1,
    metadata: {
      jobId?: string;
      providerProfileId: string;
      providerId: string;
      model: string;
      fallbackUsed: boolean;
      usage: GenerationResult['usage'];
      durationMs: number;
    }
  ): string {
    const prompt = loadBuiltinPrompt(payload.level);
    const id = ulid();
    const createdAt = timestamp();
    let usageId: string | null = null;
    const previous = this.database
      .prepare(
        `SELECT id, version FROM ai_analysis_results
          WHERE owner_id = ? AND level = ? AND period_id = ? AND status = 'current'
          ORDER BY version DESC LIMIT 1`
      )
      .get(this.ownerId, payload.level, prepared.period.periodId) as
      { id: string; version: number } | undefined;
    const version =
      ((
        this.database
          .prepare(
            'SELECT COALESCE(MAX(version), 0) AS version FROM ai_analysis_results WHERE owner_id = ? AND level = ? AND period_id = ?'
          )
          .get(this.ownerId, payload.level, prepared.period.periodId) as { version: number }
      ).version ?? 0) + 1;
    this.database.transaction(() => {
      if (metadata.jobId) {
        const existing = this.database
          .prepare('SELECT id FROM ai_analysis_results WHERE owner_id = ? AND job_id = ? LIMIT 1')
          .get(this.ownerId, metadata.jobId) as { id: string } | undefined;
        if (existing) return;
      }
      if (previous)
        this.database
          .prepare(
            'UPDATE ai_analysis_results SET status = ?, superseded_by_result_id = ?, updated_at = ? WHERE id = ? AND owner_id = ?'
          )
          .run('superseded', id, createdAt, previous.id, this.ownerId);
      usageId = ulid();
      this.database
        .prepare(
          `INSERT INTO ai_analysis_results (id, owner_id, level, period_id, timezone_id, local_start, local_end, period_start_utc, period_end_utc,
             boundary_policy_version, version, status, source_revision_hash, statistics_json, structured_result_json, readable_summary,
             prompt_id, prompt_version, schema_version, generation_metadata_json, provider_profile_id, provider_id, model_id, fallback_used,
             usage_record_id, estimated_cost_usd, job_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'current', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          this.ownerId,
          payload.level,
          prepared.period.periodId,
          prepared.period.timezone,
          prepared.period.localStart,
          prepared.period.localEnd,
          prepared.period.periodStartUtc,
          prepared.period.periodEndUtc,
          prepared.period.boundaryPolicyVersion,
          version,
          payload.sourceRevisionHash,
          safeJson(prepared.statistics),
          safeJson({
            schemaVersion: 1,
            level: payload.level,
            periodId: prepared.period.periodId,
            result
          }),
          result.summary,
          prompt.id,
          prompt.version,
          prompt.outputSchemaVersion,
          safeJson({
            providerProfileId: metadata.providerProfileId,
            providerId: metadata.providerId,
            model: metadata.model,
            fallbackUsed: metadata.fallbackUsed
          }),
          metadata.providerProfileId,
          metadata.providerId,
          metadata.model,
          Number(metadata.fallbackUsed),
          usageId,
          null,
          metadata.jobId ?? null,
          createdAt,
          createdAt
        );
      const childInsert = this.database.prepare(
        `INSERT INTO ai_analysis_child_sources (analysis_result_id, owner_id, child_result_id, child_level, child_period_id, child_version, child_source_kind)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const child of prepared.children)
        childInsert.run(
          id,
          this.ownerId,
          child.id,
          child.level,
          child.periodId,
          child.version,
          child.kind
        );
      const evidenceInsert = this.database.prepare(
        `INSERT INTO ai_analysis_log_sources (analysis_result_id, owner_id, evidence_id, check_in_id, revision_id, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const source of prepared.evidence)
        evidenceInsert.run(
          id,
          this.ownerId,
          source.sourceId,
          source.sourceId,
          source.revisionId,
          source.occurredAt
        );
      this.database
        .prepare(
          `INSERT INTO ai_usage_records (id, owner_id, job_id, purpose, provider_profile_id, model_id, prompt_version,
             duration_ms, input_tokens, output_tokens, total_tokens, usage_reported, estimated_cost_usd, pricing_version, outcome, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?)`
        )
        .run(
          usageId,
          this.ownerId,
          metadata.jobId ?? null,
          `${payload.level}-analysis`,
          metadata.providerProfileId,
          metadata.model,
          prompt.version,
          metadata.durationMs,
          metadata.usage.inputTokens ?? null,
          metadata.usage.outputTokens ?? null,
          metadata.usage.totalTokens ?? null,
          Number(metadata.usage.reported),
          null,
          null,
          createdAt
        );
      if (metadata.jobId)
        this.database
          .prepare(
            'UPDATE ai_jobs SET actual_profile_id = ?, actual_model_id = ?, updated_at = ? WHERE id = ? AND owner_id = ?'
          )
          .run(metadata.providerProfileId, metadata.model, createdAt, metadata.jobId, this.ownerId);
    })();
    this.markDependentsStale(
      previous ? [previous.id] : [],
      `${payload.level} analysis was regenerated.`
    );
    return id;
  }
}

function queueFor(database: DesktopDatabase, ownerId: string): AIJobQueue {
  return new AIJobQueue(database, ownerId);
}
