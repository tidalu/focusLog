import { describe, expect, it } from 'vitest';
import { AICapacityController } from './capacity-controller.js';

describe('main-process AI capacity controller', () => {
  it('waits fairly, respects provider limits, and removes cancelled waiters', async () => {
    const capacity = new AICapacityController(2);
    const releaseA = await capacity.acquire('a', 1);
    const releaseB = await capacity.acquire('b', 1);
    const abort = new AbortController();
    const waitingA = capacity.acquire('a', 1, 1);
    const cancelled = capacity.acquire('b', 1, 2, abort.signal);
    expect(capacity.snapshot()).toMatchObject({ active: 2, waiting: 2 });
    abort.abort();
    await expect(cancelled).rejects.toThrow('cancelled');
    releaseA();
    const releaseNext = await waitingA;
    expect(capacity.snapshot()).toMatchObject({ active: 2, waiting: 0 });
    releaseNext();
    releaseB();
    expect(capacity.snapshot()).toMatchObject({ active: 0, waiting: 0 });
  });
});
