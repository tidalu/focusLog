import { ulid } from 'ulid';

import { AIError, AIProcessLossFault, normalizeProviderError } from './errors.js';
import { type AIJob, type AIJobKind, AIJobQueue } from './job-queue.js';

export interface AIJobHandlerContext<
  TPayload extends Record<string, unknown> = Record<string, unknown>
> {
  job: AIJob;
  payload: TPayload;
  workerId: string;
  leaseToken: string;
  signal: AbortSignal;
  isCancellationRequested(): boolean;
  reportProgress(progress: Record<string, unknown>): void;
}

export type AIJobHandler = (context: AIJobHandlerContext) => Promise<{ resultReference?: string }>;

export interface AIJobWorkerOptions {
  workerId?: string;
  pollIntervalMs?: number;
  leaseDurationMs?: number;
  leaseRenewalMs?: number;
}

export interface AIJobWorkerResources {
  polling: boolean;
  heartbeat: boolean;
  activeExecution: boolean;
}

const defaults = {
  pollIntervalMs: 1_000,
  leaseDurationMs: 30_000,
  leaseRenewalMs: 10_000
};

export class AIJobWorker {
  private readonly workerId: string;
  private readonly pollIntervalMs: number;
  private readonly leaseDurationMs: number;
  private readonly leaseRenewalMs: number;
  private running = false;
  private stopped = false;
  private activeAbort: AbortController | undefined;
  private activeJobId: string | undefined;
  private wakeWaiter: (() => void) | undefined;
  private pollingTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private activeExecution: Promise<void> | undefined;
  private restartWhenIdle = false;

  constructor(
    private readonly queue: AIJobQueue,
    private readonly handlers: Partial<Record<AIJobKind, AIJobHandler>>,
    options: AIJobWorkerOptions = {}
  ) {
    this.workerId = options.workerId ?? `desktop-main-${ulid()}`;
    this.pollIntervalMs = options.pollIntervalMs ?? defaults.pollIntervalMs;
    this.leaseDurationMs = options.leaseDurationMs ?? defaults.leaseDurationMs;
    this.leaseRenewalMs = options.leaseRenewalMs ?? defaults.leaseRenewalMs;
  }

  isRunning(): boolean {
    return this.running;
  }

  hasActiveExecution(): boolean {
    return Boolean(this.activeAbort);
  }

  resources(): AIJobWorkerResources {
    return {
      polling: Boolean(this.pollingTimer),
      heartbeat: Boolean(this.heartbeat),
      activeExecution: Boolean(this.activeExecution)
    };
  }

  start(): void {
    if (this.running) return;
    if (this.activeExecution) {
      this.restartWhenIdle = true;
      return;
    }
    this.queue.recover();
    this.running = true;
    this.stopped = false;
    void this.run();
  }

  async stop(graceMs = 1_000): Promise<void> {
    if (!this.running && !this.activeAbort) return;
    this.stopped = true;
    this.running = false;
    this.activeAbort?.abort();
    this.wakeWaiter?.();
    this.wakeWaiter = undefined;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    const active = this.activeExecution;
    if (!active) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, Math.max(0, graceMs));
      void active
        .catch(() => undefined)
        .finally(() => {
          clearTimeout(timer);
          resolve();
        });
    });
  }

  /**
   * Test-harness equivalent of an unexpected process exit.  Unlike stop(), it
   * neither acknowledges work nor asks the provider to cancel; durable leases
   * are intentionally left for startup recovery.
   */
  abandon(): void {
    this.stopped = true;
    this.running = false;
    this.wakeWaiter?.();
    this.wakeWaiter = undefined;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
  }

  wake(): void {
    this.wakeWaiter?.();
    this.wakeWaiter = undefined;
  }

  requestCancellation(jobId: string) {
    const job = this.queue.requestCancellation(jobId);
    if (job && job.id === this.activeJobId && job.cancellationRequested) this.activeAbort?.abort();
    this.wake();
    return job;
  }

  private async waitForWork(): Promise<void> {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (this.pollingTimer === timer) this.pollingTimer = undefined;
        if (this.wakeWaiter === wake) this.wakeWaiter = undefined;
        resolve();
      }, this.pollIntervalMs);
      this.pollingTimer = timer;
      const wake = () => {
        clearTimeout(timer);
        if (this.pollingTimer === timer) this.pollingTimer = undefined;
        resolve();
      };
      this.wakeWaiter = wake;
    });
  }

  private async run(): Promise<void> {
    while (this.running) {
      this.queue.reclaimExpiredLeases();
      const job = this.queue.leaseNext(this.workerId, this.leaseDurationMs);
      if (!job) {
        await this.waitForWork();
        continue;
      }
      const execution = this.execute(job);
      this.activeExecution = execution;
      await execution;
      if (this.activeExecution === execution) this.activeExecution = undefined;
      if (this.restartWhenIdle) {
        this.restartWhenIdle = false;
        this.start();
      }
    }
  }

  private async execute(job: AIJob): Promise<void> {
    const leaseToken = job.leaseToken;
    if (!leaseToken) return;
    const controller = new AbortController();
    this.activeAbort = controller;
    this.activeJobId = job.id;
    let lostLease = false;
    const heartbeat = setInterval(() => {
      if (!this.running) return;
      const current = this.queue.get(job.id);
      if (current?.cancellationRequested) {
        controller.abort();
        return;
      }
      if (!this.queue.renewLease(job.id, this.workerId, leaseToken, this.leaseDurationMs)) {
        lostLease = true;
        controller.abort();
      }
    }, this.leaseRenewalMs);
    this.heartbeat = heartbeat;
    const context: AIJobHandlerContext = {
      job,
      payload: job.payload,
      workerId: this.workerId,
      leaseToken,
      signal: controller.signal,
      isCancellationRequested: () =>
        controller.signal.aborted || Boolean(this.queue.get(job.id)?.cancellationRequested),
      reportProgress: (progress) => {
        if (lostLease || controller.signal.aborted) return;
        // Progress is diagnostic only; a stale worker must not alter a reclaimed job.
        const current = this.queue.get(job.id);
        if (current?.leaseOwner === this.workerId && current.leaseToken === leaseToken)
          this.queue.updateProgress(job.id, this.workerId, leaseToken, progress);
      }
    };
    try {
      const handler = this.handlers[job.kind];
      if (!handler)
        throw new AIError('UNSUPPORTED_JOB_TYPE', `Unsupported AI job type: ${job.kind}.`, false);
      if (context.isCancellationRequested())
        throw new AIError('CANCELLATION', 'The AI job was cancelled.', false);
      const result = await handler(context);
      if (this.stopped || lostLease) return;
      if (context.isCancellationRequested()) {
        this.queue.fail(
          job.id,
          this.workerId,
          leaseToken,
          'CANCELLATION',
          'The AI job was cancelled.',
          false
        );
        return;
      }
      this.queue.complete(job.id, this.workerId, leaseToken, result.resultReference);
    } catch (error) {
      if (error instanceof AIProcessLossFault) return;
      if (this.stopped || lostLease) return;
      const normalized = normalizeProviderError(error);
      this.queue.fail(
        job.id,
        this.workerId,
        leaseToken,
        normalized.code,
        normalized.message,
        normalized.retryable
      );
    } finally {
      clearInterval(heartbeat);
      if (this.heartbeat === heartbeat) this.heartbeat = undefined;
      if (this.activeAbort === controller) this.activeAbort = undefined;
      if (this.activeJobId === job.id) this.activeJobId = undefined;
    }
  }
}
