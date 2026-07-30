import { describe, expect, it, vi } from 'vitest';
import { registerQueueRuntimeLifecycle } from './queue-runtime-lifecycle.js';

describe('queue runtime Electron lifecycle', () => {
  it('stops the production runtime once across repeated quit events', async () => {
    let callback: (() => void) | undefined;
    const stop = vi.fn().mockResolvedValue(undefined);
    registerQueueRuntimeLifecycle(
      {
        on: (_event, listener) => {
          callback = listener;
        }
      },
      { stop } as never
    );
    callback?.();
    callback?.();
    await Promise.resolve();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('contains shutdown failures and registers once when renderer windows are recreated', async () => {
    const callbacks: Array<() => void> = [];
    const secret = 'PHASE2B_LIFECYCLE_SECRET_KEY';
    const log = vi.fn();
    const stop = vi.fn().mockRejectedValue(new Error(`Bearer ${secret} ${secret}`));
    const app = {
      on: (_event: 'before-quit', listener: () => void) => {
        callbacks.push(listener);
      }
    };
    registerQueueRuntimeLifecycle(app, { stop } as never, { error: log });
    registerQueueRuntimeLifecycle(app, { stop } as never, { error: log });
    expect(callbacks).toHaveLength(1);
    callbacks[0]?.();
    await Promise.resolve();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('AI queue runtime shutdown failed.');
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
});
