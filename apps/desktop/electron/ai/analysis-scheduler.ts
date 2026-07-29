import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import type { AIService } from './ai-service.js';
import type { AnalysisService } from './analysis-service.js';
import { analysisPeriod, analysisTimeZone } from './analysis-periods.js';
import type { AnalysisLevel, AnalysisPeriod } from './analysis-contracts.js';
import {
  DAILY_ANALYSIS_PAYLOAD_VERSION,
  dailyAnalysisIdempotencyKey,
  dailyPeriodBounds
} from './daily-analysis-job.js';
import {
  HIERARCHICAL_ANALYSIS_PAYLOAD_VERSION,
  hierarchicalAnalysisIdempotencyKey,
  type ParentAnalysisLevel
} from './hierarchical-analysis-job.js';
import { HierarchicalAnalysisService } from './hierarchical-analysis-service.js';
import { FallbackChainService, type FallbackSnapshot } from './fallback-chain-service.js';
import { AIJobQueue, type AIJob, type EnqueueJob } from './job-queue.js';
import { loadBuiltinPrompt } from './prompts.js';
import { AIError } from './errors.js';
import type { PrivacyMode, ProviderId } from './types.js';

export interface AnalysisScheduleInput {
  level: AnalysisLevel;
  enabled: boolean;
  localTime: string;
  timezone: string;
  providerProfileId: string;
  modelMode?: 'profile_default' | 'fixed';
  modelId?: string | null;
  fallbackChainId?: string | null;
  privacyMode: PrivacyMode;
  maxCostMicros?: string | null;
  killSwitchEnabled?: boolean;
  catchUpLimit?: number;
}

export interface AnalysisScheduleView {
  level: AnalysisLevel;
  enabled: boolean;
  localTime: string;
  timezone: string;
  providerProfileId: string | null;
  modelMode: 'profile_default' | 'fixed';
  modelId: string | null;
  fallbackChainId: string | null;
  privacyMode: PrivacyMode;
  maxCostMicros: string | null;
  killSwitchEnabled: boolean;
  catchUpLimit: number;
  lastEvaluationAt: string | null;
  lastEligiblePeriodId: string | null;
  nextExpectedRunAt: string | null;
  lastSuccessAt: string | null;
  diagnostic: { code: string; message: string; at: string } | null;
}

export interface AnalyzeNowInput {
  level: AnalysisLevel;
  localAnchor: string;
  timezone: string;
  providerProfileId: string;
  modelId?: string | null;
  fallbackChainId?: string | null;
  privacyMode?: PrivacyMode;
  maxCostMicros?: string | null;
  regenerate?: boolean;
}

export interface AnalyzeNowResult {
  job: AIJob;
  period: AnalysisPeriod;
  regeneration: number;
  missingDependencies: Array<{ level: AnalysisLevel; periodId: string }>;
}

type ScheduleRow = {
  level: AnalysisLevel;
  enabled: number;
  localTime: string;
  timezone: string;
  providerProfileId: string | null;
  modelMode: 'profile_default' | 'fixed';
  modelId: string | null;
  fallbackChainId: string | null;
  privacyMode: PrivacyMode;
  maxCostMicros: string | null;
  killSwitchEnabled: number;
  catchUpLimit: number;
  lastEvaluationAt: string | null;
  lastEligiblePeriodId: string | null;
  nextExpectedRunAt: string | null;
  lastSuccessAt: string | null;
  diagnosticJson: string | null;
};

const levels: AnalysisLevel[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
const parentLevels = new Set<AnalysisLevel>(['weekly', 'monthly', 'quarterly', 'yearly']);
const requiredChildLevel: Record<ParentAnalysisLevel, AnalysisLevel> = {
  weekly: 'daily',
  monthly: 'weekly',
  quarterly: 'monthly',
  yearly: 'quarterly'
};
const timestamp = (date = new Date()) => date.toISOString();
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/u;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;

function validateLevel(level: unknown): AnalysisLevel {
  if (!levels.includes(level as AnalysisLevel))
    throw new AIError('VALIDATION', 'Choose a valid analysis level.');
  return level as AnalysisLevel;
}

function validateDate(value: string): string {
  if (!datePattern.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)))
    throw new AIError('VALIDATION', 'Choose a valid analysis date.');
  return value;
}

function validateTime(value: string): string {
  if (!timePattern.test(value))
    throw new AIError('VALIDATION', 'Choose a valid local schedule time.');
  return value;
}

function validateMicros(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (!/^\d{1,18}$/u.test(value))
    throw new AIError('VALIDATION', 'AI schedule cost caps must use integer micro-units.');
  return value;
}

function plusDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

function localParts(date: Date, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((all, part) => {
      if (part.type !== 'literal') all[part.type] = part.value;
      return all;
    }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  };
}

function previousPeriod(
  level: AnalysisLevel,
  localStart: string,
  timezone: string
): AnalysisPeriod {
  if (level === 'daily') return analysisPeriod(level, plusDays(localStart, -1), timezone);
  if (level === 'weekly') return analysisPeriod(level, plusDays(localStart, -1), timezone);
  const [year, month] = localStart.split('-').map(Number);
  if (level === 'monthly')
    return analysisPeriod(
      level,
      new Date(Date.UTC(year!, month! - 2, 1)).toISOString().slice(0, 10),
      timezone
    );
  if (level === 'quarterly')
    return analysisPeriod(
      level,
      new Date(Date.UTC(year!, month! - 4, 1)).toISOString().slice(0, 10),
      timezone
    );
  return analysisPeriod(level, `${year! - 1}-01-01`, timezone);
}

function nextPeriod(level: AnalysisLevel, localStart: string, timezone: string): AnalysisPeriod {
  const period = analysisPeriod(level, localStart, timezone);
  return analysisPeriod(level, period.localEnd, timezone);
}

function lastClosedPeriod(
  level: AnalysisLevel,
  at: Date,
  timezone: string,
  localTime: string
): AnalysisPeriod {
  const local = localParts(at, timezone);
  const current = analysisPeriod(level, local.date, timezone);
  const previous = previousPeriod(level, current.localStart, timezone);
  if (local.date === current.localStart && local.time < localTime)
    return previousPeriod(level, previous.localStart, timezone);
  return previous;
}

function periodById(level: AnalysisLevel, periodId: string, timezone: string): AnalysisPeriod {
  if (level === 'daily') return analysisPeriod(level, periodId, timezone);
  if (level === 'monthly') return analysisPeriod(level, `${periodId}-01`, timezone);
  if (level === 'quarterly') {
    const match = /^(\d{4})-Q([1-4])$/u.exec(periodId);
    if (!match) throw new AIError('VALIDATION', 'Stored analysis period is invalid.');
    return analysisPeriod(
      level,
      `${match[1]}-${String((Number(match[2]) - 1) * 3 + 1).padStart(2, '0')}-01`,
      timezone
    );
  }
  if (level === 'yearly') return analysisPeriod(level, `${periodId}-01-01`, timezone);
  const week = /^(\d{4})-W(\d{2})$/u.exec(periodId);
  if (!week) throw new AIError('VALIDATION', 'Stored analysis period is invalid.');
  let cursor = `${week[1]}-01-04`;
  let period = analysisPeriod('weekly', cursor, timezone);
  while (period.periodId < periodId) {
    cursor = period.localEnd;
    period = analysisPeriod('weekly', cursor, timezone);
  }
  return period;
}

function toView(row: ScheduleRow): AnalysisScheduleView {
  return {
    level: row.level,
    enabled: row.enabled === 1,
    localTime: row.localTime,
    timezone: row.timezone,
    providerProfileId: row.providerProfileId,
    modelMode: row.modelMode,
    modelId: row.modelId,
    fallbackChainId: row.fallbackChainId,
    privacyMode: row.privacyMode,
    maxCostMicros: row.maxCostMicros,
    killSwitchEnabled: row.killSwitchEnabled === 1,
    catchUpLimit: row.catchUpLimit,
    lastEvaluationAt: row.lastEvaluationAt,
    lastEligiblePeriodId: row.lastEligiblePeriodId,
    nextExpectedRunAt: row.nextExpectedRunAt,
    lastSuccessAt: row.lastSuccessAt,
    diagnostic: row.diagnosticJson
      ? (JSON.parse(row.diagnosticJson) as AnalysisScheduleView['diagnostic'])
      : null
  };
}

export class AnalysisSchedulerService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly ai: AIService,
    private readonly daily: AnalysisService,
    private readonly hierarchy = new HierarchicalAnalysisService(database, ownerId, ai),
    private readonly queue = new AIJobQueue(database, ownerId)
  ) {}

  save(input: AnalysisScheduleInput): AnalysisScheduleView {
    const level = validateLevel(input.level);
    const localTime = validateTime(input.localTime);
    const timezone = analysisTimeZone(input.timezone);
    const profile = this.profile(input.providerProfileId);
    const modelMode = input.modelMode ?? 'profile_default';
    if (modelMode !== 'profile_default' && modelMode !== 'fixed')
      throw new AIError('VALIDATION', 'Choose a valid analysis model mode.');
    const model = modelMode === 'fixed' ? input.modelId?.trim() : profile.model;
    if (!model)
      throw new AIError(
        'INVALID_CONFIGURATION',
        'Select a generation model for this analysis schedule.'
      );
    if (
      input.fallbackChainId &&
      !new FallbackChainService(this.database, this.ownerId).read(input.fallbackChainId)
    )
      throw new AIError('INVALID_CONFIGURATION', 'The fallback chain is unavailable.');
    const maxCostMicros = validateMicros(input.maxCostMicros);
    const catchUpLimit = input.catchUpLimit ?? 3;
    if (!Number.isInteger(catchUpLimit) || catchUpLimit < 1 || catchUpLimit > 30)
      throw new AIError('VALIDATION', 'Catch-up limit must be between 1 and 30.');
    const now = timestamp();
    this.database
      .prepare(
        `INSERT INTO ai_analysis_schedules (owner_id, level, enabled, local_time, timezone_id, provider_profile_id,
          model_mode, model_id, fallback_chain_id, privacy_mode, max_cost_micros, kill_switch_enabled, catch_up_limit,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(owner_id, level) DO UPDATE SET enabled=excluded.enabled, local_time=excluded.local_time,
          timezone_id=excluded.timezone_id, provider_profile_id=excluded.provider_profile_id,
          model_mode=excluded.model_mode, model_id=excluded.model_id, fallback_chain_id=excluded.fallback_chain_id,
          privacy_mode=excluded.privacy_mode, max_cost_micros=excluded.max_cost_micros,
          kill_switch_enabled=excluded.kill_switch_enabled, catch_up_limit=excluded.catch_up_limit, updated_at=excluded.updated_at`
      )
      .run(
        this.ownerId,
        level,
        Number(input.enabled),
        localTime,
        timezone,
        profile.id,
        modelMode,
        modelMode === 'fixed' ? model : null,
        input.fallbackChainId ?? null,
        input.privacyMode,
        maxCostMicros,
        Number(input.killSwitchEnabled ?? false),
        catchUpLimit,
        now,
        now
      );
    return this.get(level)!;
  }

  get(level: AnalysisLevel): AnalysisScheduleView | null {
    const row = this.database
      .prepare(
        `SELECT level, enabled, local_time AS localTime, timezone_id AS timezone, provider_profile_id AS providerProfileId,
          model_mode AS modelMode, model_id AS modelId, fallback_chain_id AS fallbackChainId, privacy_mode AS privacyMode,
          max_cost_micros AS maxCostMicros, kill_switch_enabled AS killSwitchEnabled, catch_up_limit AS catchUpLimit,
          last_evaluation_at AS lastEvaluationAt, last_eligible_period_id AS lastEligiblePeriodId,
          next_expected_run_at AS nextExpectedRunAt, last_success_at AS lastSuccessAt, diagnostic_json AS diagnosticJson
         FROM ai_analysis_schedules WHERE owner_id = ? AND level = ?`
      )
      .get(this.ownerId, level) as ScheduleRow | undefined;
    return row ? toView(row) : null;
  }

  list(): AnalysisScheduleView[] {
    return levels.flatMap((level) => {
      const schedule = this.get(level);
      return schedule ? [schedule] : [];
    });
  }

  analyzeNow(input: AnalyzeNowInput): AnalyzeNowResult {
    const level = validateLevel(input.level);
    const timezone = analysisTimeZone(input.timezone);
    const localAnchor = validateDate(input.localAnchor);
    const privacyMode = input.privacyMode ?? this.ai.getSettings().mode;
    const profile = this.profile(input.providerProfileId);
    const model = input.modelId?.trim() || profile.model;
    if (!model)
      throw new AIError('INVALID_CONFIGURATION', 'Select a generation model for this analysis.');
    const period = analysisPeriod(level, localAnchor, timezone);
    const regeneration = input.regenerate ? this.nextRegeneration(level, period.periodId) : 0;
    const job = this.enqueuePeriod({
      level,
      period,
      timezone,
      providerProfileId: profile.id,
      providerId: profile.providerId,
      model,
      privacyMode,
      fallbackChainId: input.fallbackChainId ?? null,
      maxCostMicros: validateMicros(input.maxCostMicros),
      regeneration,
      trigger: 'manual'
    });
    return {
      job,
      period,
      regeneration,
      missingDependencies:
        level === 'daily' ? [] : this.missingDependencies(level as ParentAnalysisLevel, period)
    };
  }

  evaluate(at = new Date()): { evaluated: number; enqueued: number; limited: number } {
    let evaluated = 0;
    let enqueued = 0;
    let limited = 0;
    for (const schedule of this.list()) {
      evaluated += 1;
      const now = timestamp(at);
      if (!schedule.enabled || schedule.killSwitchEnabled) {
        this.updateScheduleState(schedule.level, {
          lastEvaluationAt: now,
          diagnostic: schedule.killSwitchEnabled
            ? {
                code: 'SCHEDULE_DISABLED',
                message: 'This analysis schedule is disabled by its schedule kill switch.',
                at: now
              }
            : null
        });
        continue;
      }
      try {
        const profile = schedule.providerProfileId
          ? this.profile(schedule.providerProfileId)
          : null;
        if (!profile)
          throw new AIError(
            'INVALID_CONFIGURATION',
            'Choose an AI provider profile for this schedule.'
          );
        const model = schedule.modelMode === 'fixed' ? schedule.modelId : profile.model;
        if (!model)
          throw new AIError(
            'INVALID_CONFIGURATION',
            'Select a generation model for this schedule.'
          );
        const closed = lastClosedPeriod(schedule.level, at, schedule.timezone, schedule.localTime);
        const periods = this.missedPeriods(schedule, closed);
        const due = periods.slice(0, schedule.catchUpLimit);
        limited += Math.max(0, periods.length - due.length);
        for (const period of this.orderForDependencies(schedule.level, due)) {
          const job = this.enqueuePeriod({
            level: period.level,
            period,
            timezone: schedule.timezone,
            providerProfileId: profile.id,
            providerId: profile.providerId,
            model,
            privacyMode: schedule.privacyMode,
            fallbackChainId: schedule.fallbackChainId,
            maxCostMicros: schedule.maxCostMicros,
            regeneration: 0,
            trigger: 'scheduled'
          });
          if (['queued', 'retry_wait', 'leased'].includes(job.status)) enqueued += 1;
        }
        this.updateScheduleState(schedule.level, {
          lastEvaluationAt: now,
          lastEligiblePeriodId: due.at(-1)?.periodId ?? schedule.lastEligiblePeriodId,
          nextExpectedRunAt: this.nextExpectedRun(closed, schedule.localTime),
          lastSuccessAt: due.length ? now : schedule.lastSuccessAt,
          diagnostic: limited
            ? {
                code: 'CATCH_UP_LIMIT',
                message: `${limited} eligible period(s) remain for a later evaluation.`,
                at: now
              }
            : null
        });
      } catch (error) {
        const diagnostic = {
          code: error instanceof AIError ? error.code : 'UNKNOWN',
          message:
            error instanceof Error
              ? error.message.slice(0, 300)
              : 'Analysis schedule evaluation failed.',
          at: now
        };
        this.recordDiagnostic(schedule.level, diagnostic.code, diagnostic.message, now);
        this.updateScheduleState(schedule.level, { lastEvaluationAt: now, diagnostic });
      }
    }
    return { evaluated, enqueued, limited };
  }

  private enqueuePeriod(input: {
    level: AnalysisLevel;
    period: AnalysisPeriod;
    timezone: string;
    providerProfileId: string;
    providerId: ProviderId;
    model: string;
    privacyMode: PrivacyMode;
    fallbackChainId: string | null;
    maxCostMicros: string | null;
    regeneration: number;
    trigger: 'manual' | 'scheduled';
  }): AIJob {
    const fallbackSnapshot = this.fallbackSnapshot(input);
    if (input.level === 'daily') {
      const prompt = loadBuiltinPrompt('daily');
      const payload = {
        schemaVersion: DAILY_ANALYSIS_PAYLOAD_VERSION,
        localDate: input.period.localStart,
        timezone: input.timezone,
        ...dailyPeriodBounds(input.period.localStart, input.timezone),
        providerProfileId: input.providerProfileId,
        requestedModelId: input.model,
        privacyMode: input.privacyMode,
        promptId: prompt.id,
        promptVersion: prompt.version,
        sourceRevisionHash: this.daily.dailySourceRevisionHash(
          input.period.localStart,
          input.timezone
        ),
        regeneration: input.regeneration,
        trigger: input.trigger
      };
      return this.queue.enqueue({
        kind: 'daily_analysis',
        idempotencyKey: dailyAnalysisIdempotencyKey(payload),
        payload,
        requestedProfileId: input.providerProfileId,
        requestedModelId: input.model,
        privacyMode: input.privacyMode,
        fallbackSnapshot
      });
    }
    const prompt = loadBuiltinPrompt(input.level);
    const payload = {
      schemaVersion: HIERARCHICAL_ANALYSIS_PAYLOAD_VERSION,
      level: input.level as ParentAnalysisLevel,
      localAnchor: input.period.localStart,
      timezone: input.timezone,
      periodId: input.period.periodId,
      periodStartUtc: input.period.periodStartUtc,
      periodEndUtc: input.period.periodEndUtc,
      providerProfileId: input.providerProfileId,
      requestedModelId: input.model,
      privacyMode: input.privacyMode,
      promptId: prompt.id,
      promptVersion: prompt.version,
      sourceRevisionHash: this.hierarchy.sourceRevisionHash(
        input.level as ParentAnalysisLevel,
        input.period.localStart,
        input.timezone
      ),
      regeneration: input.regeneration,
      trigger: input.trigger
    };
    return this.queue.enqueue({
      kind: `${input.level}_analysis` as EnqueueJob['kind'],
      idempotencyKey: hierarchicalAnalysisIdempotencyKey(payload),
      payload: { ...payload },
      requestedProfileId: input.providerProfileId,
      requestedModelId: input.model,
      privacyMode: input.privacyMode,
      fallbackSnapshot
    });
  }

  private fallbackSnapshot(input: {
    providerProfileId: string;
    providerId: ProviderId;
    model: string;
    privacyMode: PrivacyMode;
    fallbackChainId: string | null;
    maxCostMicros: string | null;
  }): EnqueueJob['fallbackSnapshot'] {
    const requestCapMicros = input.maxCostMicros === null ? null : Number(input.maxCostMicros);
    if (input.fallbackChainId) {
      const snapshot = new FallbackChainService(this.database, this.ownerId).snapshot(
        input.fallbackChainId,
        input.privacyMode
      ) as FallbackSnapshot;
      return {
        schemaVersion: 1,
        chainId: snapshot.chainId,
        chainVersion: snapshot.chainVersion,
        entries: snapshot.entries,
        requestCapMicros,
        consentPurpose: 'analyses'
      };
    }
    return {
      schemaVersion: 1,
      entries: [
        {
          providerProfileId: input.providerProfileId,
          providerType: input.providerId,
          model: input.model,
          maxSameProviderRetries: 0,
          allowFallback: false
        }
      ],
      requestCapMicros,
      consentPurpose: 'analyses'
    };
  }

  private missedPeriods(schedule: AnalysisScheduleView, closed: AnalysisPeriod): AnalysisPeriod[] {
    const periods: AnalysisPeriod[] = [];
    let cursor = schedule.lastEligiblePeriodId
      ? nextPeriod(
          schedule.level,
          periodById(schedule.level, schedule.lastEligiblePeriodId, schedule.timezone).localStart,
          schedule.timezone
        )
      : closed;
    while (
      cursor.periodId <= closed.periodId &&
      periods.length < Math.max(schedule.catchUpLimit, 1) + 30
    ) {
      periods.push(cursor);
      cursor = nextPeriod(schedule.level, cursor.localStart, schedule.timezone);
    }
    return periods.filter((period) => period.periodStartUtc <= closed.periodStartUtc);
  }

  private orderForDependencies(level: AnalysisLevel, periods: AnalysisPeriod[]): AnalysisPeriod[] {
    if (!parentLevels.has(level)) return periods;
    const child = requiredChildLevel[level as ParentAnalysisLevel];
    return periods.flatMap((period) => {
      return [...this.childPeriods(child, period), period];
    });
  }

  private nextExpectedRun(closed: AnalysisPeriod, localTime: string): string {
    return `${nextPeriod(closed.level, closed.localStart, closed.timezone).localEnd}T${localTime}:00[${closed.timezone}]`;
  }

  private nextRegeneration(level: AnalysisLevel, periodId: string): number {
    const resultRow =
      level === 'daily'
        ? (this.database
            .prepare(
              "SELECT COALESCE(MAX(version), 0) AS version FROM ai_memories WHERE owner_id = ? AND period_kind = 'DAY' AND period_key = ?"
            )
            .get(this.ownerId, periodId) as { version: number })
        : (this.database
            .prepare(
              'SELECT COALESCE(MAX(version), 0) AS version FROM ai_analysis_results WHERE owner_id = ? AND level = ? AND period_id = ?'
            )
            .get(this.ownerId, level, periodId) as { version: number });
    const jobRow =
      level === 'daily'
        ? (this.database
            .prepare(
              "SELECT COALESCE(MAX(CAST(json_extract(payload_json, '$.regeneration') AS INTEGER)), -1) AS regeneration FROM ai_jobs WHERE owner_id = ? AND kind = 'daily_analysis' AND json_extract(payload_json, '$.localDate') = ?"
            )
            .get(this.ownerId, periodId) as { regeneration: number })
        : (this.database
            .prepare(
              "SELECT COALESCE(MAX(CAST(json_extract(payload_json, '$.regeneration') AS INTEGER)), -1) AS regeneration FROM ai_jobs WHERE owner_id = ? AND kind = ? AND json_extract(payload_json, '$.periodId') = ?"
            )
            .get(this.ownerId, `${level}_analysis`, periodId) as { regeneration: number });
    return Math.max(resultRow.version, jobRow.regeneration + 1);
  }

  private missingDependencies(
    level: ParentAnalysisLevel,
    period: AnalysisPeriod
  ): Array<{ level: AnalysisLevel; periodId: string }> {
    const child = requiredChildLevel[level];
    const missing: Array<{ level: AnalysisLevel; periodId: string }> = [];
    for (const childPeriod of this.childPeriods(child, period)) {
      const exists =
        child === 'daily'
          ? this.database
              .prepare(
                "SELECT 1 FROM ai_memories WHERE owner_id = ? AND period_kind = 'DAY' AND period_key = ? AND status = 'ACTIVE'"
              )
              .get(this.ownerId, childPeriod.periodId)
          : this.database
              .prepare(
                "SELECT 1 FROM ai_analysis_results WHERE owner_id = ? AND level = ? AND period_id = ? AND status = 'current'"
              )
              .get(this.ownerId, child, childPeriod.periodId);
      if (!exists) missing.push({ level: child, periodId: childPeriod.periodId });
    }
    return missing;
  }

  private childPeriods(level: AnalysisLevel, parent: AnalysisPeriod): AnalysisPeriod[] {
    if (level === 'daily') {
      const result: AnalysisPeriod[] = [];
      for (let day = parent.localStart; day < parent.localEnd; day = plusDays(day, 1))
        result.push(analysisPeriod('daily', day, parent.timezone));
      return result;
    }
    const result: AnalysisPeriod[] = [];
    let cursor = parent.localStart;
    while (cursor < parent.localEnd) {
      const period = analysisPeriod(level, cursor, parent.timezone);
      if (!result.some((item) => item.periodId === period.periodId)) result.push(period);
      cursor = period.localEnd <= cursor ? plusDays(cursor, 1) : period.localEnd;
    }
    return result.filter(
      (period) => period.localStart >= parent.localStart && period.localStart < parent.localEnd
    );
  }

  private profile(profileId: string): { id: string; providerId: ProviderId; model: string | null } {
    const row = this.database
      .prepare(
        'SELECT id, provider_id AS providerId, generation_model AS model FROM ai_provider_profiles WHERE id = ? AND owner_id = ? AND enabled = 1'
      )
      .get(profileId, this.ownerId) as
      { id: string; providerId: ProviderId; model: string | null } | undefined;
    if (!row)
      throw new AIError(
        'INVALID_CONFIGURATION',
        'The selected AI provider profile is unavailable.'
      );
    return row;
  }

  private updateScheduleState(
    level: AnalysisLevel,
    input: {
      lastEvaluationAt?: string;
      lastEligiblePeriodId?: string | null;
      nextExpectedRunAt?: string | null;
      lastSuccessAt?: string | null;
      diagnostic?: AnalysisScheduleView['diagnostic'];
    }
  ): void {
    this.database
      .prepare(
        `UPDATE ai_analysis_schedules SET last_evaluation_at = COALESCE(?, last_evaluation_at),
          last_eligible_period_id = COALESCE(?, last_eligible_period_id),
          next_expected_run_at = COALESCE(?, next_expected_run_at),
          last_success_at = COALESCE(?, last_success_at),
          diagnostic_json = ?, updated_at = ?
         WHERE owner_id = ? AND level = ?`
      )
      .run(
        input.lastEvaluationAt ?? null,
        input.lastEligiblePeriodId ?? null,
        input.nextExpectedRunAt ?? null,
        input.lastSuccessAt ?? null,
        input.diagnostic ? JSON.stringify(input.diagnostic) : null,
        timestamp(),
        this.ownerId,
        level
      );
  }

  private recordDiagnostic(level: AnalysisLevel, code: string, message: string, at: string): void {
    this.database
      .prepare(
        'INSERT INTO ai_analysis_schedule_diagnostics (id, owner_id, level, code, message, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(ulid(), this.ownerId, level, code, message.slice(0, 500), at);
    this.database
      .prepare(
        `DELETE FROM ai_analysis_schedule_diagnostics WHERE owner_id = ? AND id NOT IN
         (SELECT id FROM ai_analysis_schedule_diagnostics WHERE owner_id = ? ORDER BY created_at DESC, id DESC LIMIT 100)`
      )
      .run(this.ownerId, this.ownerId);
  }
}

export class AnalysisSchedulerRuntime {
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(
    private readonly scheduler: AnalysisSchedulerService,
    private readonly wake: () => void,
    private readonly intervalMs = 60_000,
    private readonly clock = () => new Date()
  ) {}
  start(): void {
    if (this.timer) return;
    this.evaluate();
    this.timer = setInterval(() => this.evaluate(), this.intervalMs);
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  evaluate(): ReturnType<AnalysisSchedulerService['evaluate']> {
    const result = this.scheduler.evaluate(this.clock());
    if (result.enqueued) this.wake();
    return result;
  }
  isRunning(): boolean {
    return Boolean(this.timer);
  }
}
