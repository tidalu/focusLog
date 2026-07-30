import type { AIQueueRuntime } from './queue-runtime.js';
import type { AnalysisSchedulerRuntime } from './analysis-scheduler.js';

export interface AppLifecycleLike {
  on(event: 'before-quit', listener: () => void): void;
}
export interface LifecycleLogger {
  error(message: string): void;
}

const registeredApps = new WeakSet<AppLifecycleLike>();

export function registerQueueRuntimeLifecycle(
  app: AppLifecycleLike,
  runtime: AIQueueRuntime,
  logger: LifecycleLogger = { error: () => undefined },
  scheduler?: AnalysisSchedulerRuntime
): void {
  if (registeredApps.has(app)) return;
  registeredApps.add(app);
  let stopping = false;
  app.on('before-quit', () => {
    if (stopping) return;
    stopping = true;
    scheduler?.stop();
    void runtime.stop().catch(() => logger.error('AI queue runtime shutdown failed.'));
  });
}
