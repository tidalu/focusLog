import type { DesktopDatabase } from '../database/database.js';
import type { AnalysisService } from './analysis-service.js';
import { AIJobQueue } from './job-queue.js';
import { AIJobWorker, type AIJobWorkerOptions } from './job-worker.js';
import { QueueReadService } from './queue-read-service.js';
import {
  createDailyAnalysisHandler,
  type DailyAnalysisHandlerOptions
} from './daily-analysis-handler.js';
import { BudgetService } from './budget-service.js';
import { HierarchicalAnalysisService } from './hierarchical-analysis-service.js';
import {
  createHierarchicalAnalysisHandler,
  type HierarchicalAnalysisHandlerOptions
} from './hierarchical-analysis-handler.js';
import type { AIService } from './ai-service.js';
import { FactGraphService } from './fact-graph-service.js';

export interface AIQueueRuntimeOptions extends AIJobWorkerOptions {
  dailyAnalysis?: DailyAnalysisHandlerOptions;
  hierarchicalAnalysis?: HierarchicalAnalysisHandlerOptions;
}

/** The single production composition used by Electron startup and lifecycle tests. */
export class AIQueueRuntime {
  readonly queue: AIJobQueue;
  readonly worker: AIJobWorker;
  readonly read: QueueReadService;

  private readonly budget: BudgetService;
  constructor(
    database: DesktopDatabase,
    ownerId: string,
    analysis: AnalysisService,
    options: AIQueueRuntimeOptions = {},
    ai?: AIService
  ) {
    this.queue = new AIJobQueue(database, ownerId);
    this.read = new QueueReadService(database, ownerId);
    this.budget = new BudgetService(database, ownerId);
    const hierarchical = ai ? new HierarchicalAnalysisService(database, ownerId, ai) : undefined;
    const factGraph = new FactGraphService(database, ownerId);
    this.worker = new AIJobWorker(
      this.queue,
      {
        daily_analysis: createDailyAnalysisHandler(analysis, options.dailyAnalysis),
        weekly_analysis: hierarchical
          ? createHierarchicalAnalysisHandler(hierarchical, options.hierarchicalAnalysis)
          : undefined,
        monthly_analysis: hierarchical
          ? createHierarchicalAnalysisHandler(hierarchical, options.hierarchicalAnalysis)
          : undefined,
        quarterly_analysis: hierarchical
          ? createHierarchicalAnalysisHandler(hierarchical, options.hierarchicalAnalysis)
          : undefined,
        yearly_analysis: hierarchical
          ? createHierarchicalAnalysisHandler(hierarchical, options.hierarchicalAnalysis)
          : undefined,
        ...factGraph.queueHandlers()
      },
      options
    );
  }

  async start(): Promise<void> {
    this.queue.recover();
    this.budget.recoverInterrupted();
    this.worker.start();
  }
  async stop(graceMs = 1_000): Promise<void> {
    await this.worker.stop(graceMs);
  }
  /** Internal production-equivalent crash harness; not registered with IPC. */
  abandonForProcessLoss(): void {
    this.worker.abandon();
  }
  wake(): void {
    this.worker.wake();
  }
  requestCancellation(jobId: string) {
    return this.worker.requestCancellation(jobId);
  }
  isRunning(): boolean {
    return this.worker.isRunning();
  }
}

export function createAIQueueRuntime(
  database: DesktopDatabase,
  ownerId: string,
  analysis: AnalysisService,
  options?: AIQueueRuntimeOptions,
  ai?: AIService
): AIQueueRuntime {
  return new AIQueueRuntime(database, ownerId, analysis, options, ai);
}
