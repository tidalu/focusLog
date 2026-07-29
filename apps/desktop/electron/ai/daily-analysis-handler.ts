import type { AnalysisService } from './analysis-service.js';
import type { CoordinatorEntry } from './provider-execution-coordinator.js';
import { parseDailyAnalysisPayload } from './daily-analysis-job.js';
import { AIError } from './errors.js';
import type { AIJobHandler } from './job-worker.js';

export type DailyAnalysisFault =
  'after_validation_before_persistence' | 'after_persistence_before_acknowledgement';

/**
 * Internal composition hook used by lifecycle tests.  It is deliberately injected
 * by the main-process runtime and is never part of an IPC payload.
 */
export interface DailyAnalysisHandlerOptions {
  fault?: DailyAnalysisFault;
  /** Internal lifecycle barriers passed into the production coordinator. */
  coordinatorHooks?: {
    afterPolicyValidation?(): void | Promise<void>;
    afterReservation?(): void | Promise<void>;
    beforeFallback?(entry: CoordinatorEntry): void | Promise<void>;
  };
}

export function createDailyAnalysisHandler(
  analysis: AnalysisService,
  options: DailyAnalysisHandlerOptions = {}
): AIJobHandler {
  return async (context) => {
    const payload = parseDailyAnalysisPayload(context.payload);
    if (context.job.requestedProfileId !== payload.providerProfileId)
      throw new AIError('VALIDATION', 'Daily analysis job provider profile is inconsistent.');
    if (context.job.requestedModelId !== payload.requestedModelId)
      throw new AIError('VALIDATION', 'Daily analysis job model is inconsistent.');
    if (context.job.privacyMode !== payload.privacyMode)
      throw new AIError('VALIDATION', 'Daily analysis job privacy snapshot is inconsistent.');
    if (context.isCancellationRequested())
      throw new AIError('CANCELLATION', 'The daily analysis was cancelled.', false);
    const currentSourceHash = analysis.dailySourceRevisionHash(payload.localDate, payload.timezone);
    if (currentSourceHash !== payload.sourceRevisionHash)
      throw new AIError(
        'VALIDATION',
        'The source records changed after this daily analysis was queued. Enqueue a new analysis version.',
        false
      );
    context.reportProgress({ stage: 'generating' });
    const result = await analysis.analyzeDaily(payload.providerProfileId, payload.localDate, {
      signal: context.signal,
      jobId: context.job.id,
      timezone: payload.timezone,
      expectedModel: payload.requestedModelId,
      expectedPrivacyMode: payload.privacyMode,
      fault: options.fault,
      lease: { workerId: context.workerId, token: context.leaseToken },
      coordinatorHooks: options.coordinatorHooks
    });
    if (context.isCancellationRequested())
      throw new AIError('CANCELLATION', 'The daily analysis was cancelled.', false);
    context.reportProgress({ stage: 'persisted', resultId: result.id });
    return { resultReference: result.id };
  };
}
