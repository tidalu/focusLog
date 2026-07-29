import type {
  HierarchicalAnalysisService,
  HierarchicalAnalysisFault
} from './hierarchical-analysis-service.js';
import { parseHierarchicalAnalysisPayload } from './hierarchical-analysis-job.js';
import { AIError } from './errors.js';
import type { AIJobHandler } from './job-worker.js';

export interface HierarchicalAnalysisHandlerOptions {
  fault?: HierarchicalAnalysisFault;
}

export function createHierarchicalAnalysisHandler(
  analysis: HierarchicalAnalysisService,
  options: HierarchicalAnalysisHandlerOptions = {}
): AIJobHandler {
  return async (context) => {
    const payload = parseHierarchicalAnalysisPayload(context.payload);
    if (context.job.requestedProfileId !== payload.providerProfileId)
      throw new AIError('VALIDATION', 'Analysis job provider profile is inconsistent.');
    if (context.job.requestedModelId !== payload.requestedModelId)
      throw new AIError('VALIDATION', 'Analysis job model is inconsistent.');
    if (context.job.privacyMode !== payload.privacyMode)
      throw new AIError('VALIDATION', 'Analysis job privacy snapshot is inconsistent.');
    if (context.job.kind !== `${payload.level}_analysis`)
      throw new AIError('VALIDATION', 'Analysis job kind is inconsistent.');
    if (context.isCancellationRequested())
      throw new AIError('CANCELLATION', 'The analysis was cancelled.', false);
    const currentHash = analysis.sourceRevisionHash(
      payload.level,
      payload.localAnchor,
      payload.timezone
    );
    if (currentHash !== payload.sourceRevisionHash)
      throw new AIError(
        'VALIDATION',
        'Analysis dependencies changed after this job was queued. Enqueue a new version.',
        true
      );
    context.reportProgress({
      stage: 'generating',
      level: payload.level,
      periodId: payload.periodId
    });
    const result = await analysis.analyze(payload, {
      signal: context.signal,
      jobId: context.job.id,
      lease: { workerId: context.workerId, token: context.leaseToken },
      fault: options.fault
    });
    if (context.isCancellationRequested())
      throw new AIError('CANCELLATION', 'The analysis was cancelled.', false);
    context.reportProgress({ stage: 'persisted', resultId: result.id });
    return { resultReference: result.id };
  };
}
