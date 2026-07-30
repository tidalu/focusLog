import type { AnalysisService } from './analysis-service.js';
import {
  DAILY_ANALYSIS_PAYLOAD_VERSION,
  dailyAnalysisIdempotencyKey,
  dailyPeriodBounds,
  validateTimeZone
} from './daily-analysis-job.js';
import type { AIJobQueue, AIJobStatus } from './job-queue.js';
import type { AIJobWorker } from './job-worker.js';
import { loadBuiltinPrompt } from './prompts.js';
import type { QueueReadService } from './queue-read-service.js';
import type { AIService } from './ai-service.js';
import type { DesktopDatabase } from '../database/database.js';
import { FallbackChainService } from './fallback-chain-service.js';
import { BudgetService } from './budget-service.js';
import { CircuitBreakerService } from './circuit-breaker-service.js';
import { ExecutionPolicyService } from './execution-policy-service.js';
import type { AICapacityController } from './capacity-controller.js';
import type {
  AnalysisSchedulerService,
  AnalysisScheduleInput,
  AnalyzeNowInput
} from './analysis-scheduler.js';
import type { AnalysisReadService } from './analysis-read-service.js';
import type { AnalysisLevel } from './analysis-contracts.js';

export interface IpcMainLike {
  handle(channel: string, listener: (_event: unknown, ...args: unknown[]) => unknown): void;
}
export interface QueueIpcDependencies {
  ipcMain: IpcMainLike;
  ai: AIService;
  analysis: AnalysisService;
  queue: AIJobQueue;
  worker: AIJobWorker;
  read: QueueReadService;
  database: DesktopDatabase;
  ownerId: string;
  capacity: AICapacityController;
  scheduler?: AnalysisSchedulerService;
  analysisRead?: AnalysisReadService;
}
function jobId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{10,64}$/u.test(value))
    throw new Error('Choose a valid AI job.');
  return value;
}
function analysisLevel(value: unknown): AnalysisLevel {
  if (!['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(String(value)))
    throw new Error('Choose a valid analysis level.');
  return value as AnalysisLevel;
}
function privacyMode(value: unknown): AnalysisScheduleInput['privacyMode'] {
  if (!['DISABLED', 'LOCAL', 'CLOUD', 'HYBRID'].includes(String(value)))
    throw new Error('Choose a valid analysis privacy mode.');
  return value as AnalysisScheduleInput['privacyMode'];
}
function objectInput(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}
function safeString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200)
    throw new Error(`${field} is invalid.`);
  return value;
}
function scheduleInput(value: unknown): AnalysisScheduleInput {
  const input = objectInput(value, 'AI analysis schedule is invalid.');
  return {
    level: analysisLevel(input.level),
    enabled: Boolean(input.enabled),
    localTime: safeString(input.localTime, 'Schedule local time'),
    timezone: safeString(input.timezone, 'Schedule timezone'),
    providerProfileId: safeString(input.providerProfileId, 'Schedule provider profile'),
    modelMode: input.modelMode === 'fixed' ? 'fixed' : 'profile_default',
    modelId:
      input.modelId === null || input.modelId === undefined
        ? null
        : safeString(input.modelId, 'Schedule model'),
    fallbackChainId:
      input.fallbackChainId === null ||
      input.fallbackChainId === undefined ||
      input.fallbackChainId === ''
        ? null
        : safeString(input.fallbackChainId, 'Schedule fallback chain'),
    privacyMode: privacyMode(input.privacyMode),
    maxCostMicros:
      input.maxCostMicros === null ||
      input.maxCostMicros === undefined ||
      input.maxCostMicros === ''
        ? null
        : safeString(input.maxCostMicros, 'Schedule cost cap'),
    killSwitchEnabled: Boolean(input.killSwitchEnabled),
    catchUpLimit: input.catchUpLimit === undefined ? undefined : Number(input.catchUpLimit)
  };
}
function analyzeInput(value: unknown): AnalyzeNowInput {
  const input = objectInput(value, 'Analyze Now request is invalid.');
  return {
    level: analysisLevel(input.level),
    localAnchor: safeString(input.localAnchor, 'Analysis period'),
    timezone: safeString(input.timezone, 'Analysis timezone'),
    providerProfileId: safeString(input.providerProfileId, 'Analysis provider profile'),
    modelId:
      input.modelId === null || input.modelId === undefined || input.modelId === ''
        ? null
        : safeString(input.modelId, 'Analysis model'),
    fallbackChainId:
      input.fallbackChainId === null ||
      input.fallbackChainId === undefined ||
      input.fallbackChainId === ''
        ? null
        : safeString(input.fallbackChainId, 'Analysis fallback chain'),
    privacyMode: privacyMode(input.privacyMode),
    maxCostMicros:
      input.maxCostMicros === null ||
      input.maxCostMicros === undefined ||
      input.maxCostMicros === ''
        ? null
        : safeString(input.maxCostMicros, 'Analysis cost cap'),
    regenerate: Boolean(input.regenerate)
  };
}

export function registerAIQueueIpcHandlers({
  ipcMain,
  ai,
  analysis,
  queue,
  worker,
  read,
  database,
  ownerId,
  capacity,
  scheduler,
  analysisRead
}: QueueIpcDependencies): void {
  ipcMain.handle('focuslog:analyze-daily', (_event, profileId, day) => {
    if (typeof profileId !== 'string' || !profileId.trim())
      throw new Error('Choose an AI provider profile.');
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(day))
      throw new Error('Choose a valid analysis day.');
    const config = ai.requireExecution(profileId, 'analyses');
    if (!config.profile.generationModel)
      throw new Error('Select a generation model for this provider profile.');
    const timezone = validateTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    const prompt = loadBuiltinPrompt('daily');
    const payload = {
      schemaVersion: DAILY_ANALYSIS_PAYLOAD_VERSION,
      localDate: day,
      timezone,
      ...dailyPeriodBounds(day, timezone),
      providerProfileId: config.profile.id,
      requestedModelId: config.profile.generationModel,
      privacyMode: ai.getSettings().mode,
      promptId: prompt.id,
      promptVersion: prompt.version,
      sourceRevisionHash: analysis.dailySourceRevisionHash(day, timezone),
      regeneration: 0,
      trigger: 'manual' as const
    };
    const job = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: dailyAnalysisIdempotencyKey(payload),
      payload,
      requestedProfileId: config.profile.id,
      requestedModelId: config.profile.generationModel,
      privacyMode: payload.privacyMode,
      fallbackSnapshot: {
        schemaVersion: 1,
        entries: [
          {
            providerProfileId: config.profile.id,
            providerType: config.profile.providerId,
            model: config.profile.generationModel,
            maxSameProviderRetries: config.profile.retryLimit,
            allowFallback: false
          }
        ],
        consentPurpose: 'analyses'
      }
    });
    worker.wake();
    return {
      id: job.id,
      status: job.status,
      localDate: payload.localDate,
      createdAt: job.createdAt
    };
  });
  ipcMain.handle('focuslog:ai-queue-counts', () => queue.counts());
  ipcMain.handle('focuslog:ai-queue-jobs', (_event, input) => {
    const value = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    const limit = value.limit === undefined ? 50 : Number(value.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error('Queue list limit must be between 1 and 100.');
    const status = value.status;
    if (
      status !== undefined &&
      ![
        'queued',
        'leased',
        'retry_wait',
        'succeeded',
        'failed',
        'cancelled',
        'dead_lettered'
      ].includes(String(status))
    )
      throw new Error('Choose a valid AI job status.');
    return read.list(limit, status as AIJobStatus | undefined);
  });
  ipcMain.handle('focuslog:ai-queue-job', (_event, id) => read.get(jobId(id)));
  ipcMain.handle('focuslog:ai-queue-execution', (_event, id) => read.executionSummary(jobId(id)));
  ipcMain.handle('focuslog:cancel-ai-job', (_event, id) => {
    const existing = read.get(jobId(id));
    if (!existing) throw new Error('The AI job no longer exists.');
    if (!existing.actions.canCancel) {
      if (existing.status === 'cancelled') return existing;
      throw new Error('This AI job can no longer be cancelled.');
    }
    const job = worker.requestCancellation(existing.id);
    return job ? read.get(job.id) : null;
  });
  ipcMain.handle('focuslog:retry-ai-job', (_event, id) => {
    const job = queue.retry(jobId(id));
    if (!job) throw new Error('Only failed or dead-lettered AI jobs can be retried.');
    worker.wake();
    return read.get(job.id);
  });
  ipcMain.handle('focuslog:wake-ai-queue', () => {
    worker.wake();
    return { running: worker.isRunning() };
  });
  ipcMain.handle('focuslog:ai-fallback-chains', () =>
    new FallbackChainService(database, ownerId).list()
  );
  ipcMain.handle('focuslog:ai-budget-summary', (_event, period) => {
    const month =
      typeof period === 'string' && /^\d{4}-\d{2}$/u.test(period)
        ? period
        : new Date().toISOString().slice(0, 7);
    const settings = database
      .prepare(
        'SELECT monthly_hard_limit_micros AS monthlyLimit, request_hard_limit_micros AS requestLimit FROM ai_budget_settings WHERE owner_id = ?'
      )
      .get(ownerId) as { monthlyLimit: number | null; requestLimit: number | null } | undefined;
    const snapshot = new BudgetService(database, ownerId).snapshot(
      month,
      settings?.monthlyLimit ?? null
    );
    return {
      periodKey: snapshot.periodKey,
      currency: snapshot.currency,
      limitMicros: snapshot.limitMicros === null ? null : String(snapshot.limitMicros),
      settledMicros: String(snapshot.settledMicros),
      reservedMicros: String(snapshot.reservedMicros),
      remainingMicros: snapshot.remainingMicros === null ? null : String(snapshot.remainingMicros),
      requestCapMicros:
        settings?.requestLimit === null || settings?.requestLimit === undefined
          ? null
          : String(settings.requestLimit)
    };
  });
  ipcMain.handle('focuslog:ai-kill-switches', () =>
    new ExecutionPolicyService(database, ownerId).read()
  );
  ipcMain.handle('focuslog:set-ai-kill-switch', (_event, input) => {
    if (!input || typeof input !== 'object') throw new Error('AI execution control is invalid.');
    const value = input as Record<string, unknown>;
    const scope = value.scope;
    const targetId = value.targetId;
    const enabled = value.enabled;
    if (
      !['global', 'provider', 'chain'].includes(String(scope)) ||
      typeof targetId !== 'string' ||
      typeof enabled !== 'boolean'
    )
      throw new Error('AI execution control is invalid.');
    if (scope === 'global' && targetId !== '')
      throw new Error('Global AI execution control has no target.');
    if (
      scope === 'provider' &&
      !database
        .prepare('SELECT 1 FROM ai_provider_profiles WHERE id = ? AND owner_id = ?')
        .get(targetId, ownerId)
    )
      throw new Error('AI provider control target is unavailable.');
    if (
      scope === 'chain' &&
      !database
        .prepare('SELECT 1 FROM ai_fallback_chains WHERE id = ? AND owner_id = ?')
        .get(targetId, ownerId)
    )
      throw new Error('AI fallback control target is unavailable.');
    new ExecutionPolicyService(database, ownerId).set(
      scope as 'global' | 'provider' | 'chain',
      targetId,
      enabled
    );
    return new ExecutionPolicyService(database, ownerId).read();
  });
  ipcMain.handle('focuslog:ai-circuit-breakers', () =>
    new CircuitBreakerService(database, ownerId).safeStates()
  );
  ipcMain.handle('focuslog:ai-concurrency', () => capacity.snapshot());
  ipcMain.handle('focuslog:ai-analysis-schedules', () => scheduler?.list() ?? []);
  ipcMain.handle('focuslog:save-ai-analysis-schedule', (_event, input) => {
    if (!scheduler) throw new Error('AI analysis scheduler is unavailable.');
    return scheduler.save(scheduleInput(input));
  });
  ipcMain.handle('focuslog:analyze-now', (_event, input) => {
    if (!scheduler) throw new Error('AI analysis scheduler is unavailable.');
    const result = scheduler.analyzeNow(analyzeInput(input));
    worker.wake();
    return {
      job: read.get(result.job.id),
      period: result.period,
      regeneration: result.regeneration,
      missingDependencies: result.missingDependencies
    };
  });
  ipcMain.handle('focuslog:ai-analysis-versions', (_event, input) => {
    if (!analysisRead) throw new Error('AI analysis read model is unavailable.');
    const value = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    return analysisRead.list(
      analysisLevel(value.level),
      value.limit === undefined ? 25 : Number(value.limit)
    );
  });
  ipcMain.handle('focuslog:ai-analysis-result', (_event, id) => {
    if (!analysisRead) throw new Error('AI analysis read model is unavailable.');
    return analysisRead.get(id);
  });
  ipcMain.handle('focuslog:ai-analysis-dependencies', (_event, input) => {
    if (!analysisRead) throw new Error('AI analysis read model is unavailable.');
    const value = objectInput(input, 'Analysis dependency request is invalid.');
    return analysisRead.dependencyStatus(
      analysisLevel(value.level),
      safeString(value.periodId, 'Analysis period')
    );
  });
  ipcMain.handle('focuslog:ai-scheduler-status', () => {
    if (!analysisRead) throw new Error('AI analysis read model is unavailable.');
    return analysisRead.schedulerStatus();
  });
}
