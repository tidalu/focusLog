import { AIError } from './errors.js';

interface Waiter {
  id: number;
  profileId: string;
  providerLimit: number;
  priority: number;
  resolve(release: () => void): void;
  reject(error: Error): void;
  signal?: AbortSignal;
}

/** Main-process-only, fair, cancellable capacity controller. Capacity is acquired before a budget reservation. */
export class AICapacityController {
  private active = 0;
  private readonly perProfile = new Map<string, number>();
  private readonly waiters: Waiter[] = [];
  private nextId = 0;
  constructor(private globalLimit = 2) {}
  configure(limit: number): void {
    if (!Number.isInteger(limit) || limit < 1 || limit > 32)
      throw new AIError('VALIDATION', 'Global AI concurrency must be between 1 and 32.');
    this.globalLimit = limit;
    this.pump();
  }
  async acquire(
    profileId: string,
    providerLimit: number,
    priority = 100,
    signal?: AbortSignal
  ): Promise<() => void> {
    if (!Number.isInteger(providerLimit) || providerLimit < 1 || providerLimit > 32)
      throw new AIError('VALIDATION', 'Provider concurrency must be between 1 and 32.');
    if (signal?.aborted) throw new AIError('CANCELLATION', 'The AI job was cancelled.', false);
    if (this.available(profileId, providerLimit) && this.waiters.length === 0)
      return this.claim(profileId);
    return new Promise<() => void>((resolve, reject) => {
      const waiter: Waiter = {
        id: this.nextId++,
        profileId,
        providerLimit,
        priority,
        resolve,
        reject,
        signal
      };
      const abort = () => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(
          new AIError('CANCELLATION', 'The AI job was cancelled while waiting for capacity.', false)
        );
      };
      signal?.addEventListener('abort', abort, { once: true });
      this.waiters.push(waiter);
      this.waiters.sort((a, b) => a.priority - b.priority || a.id - b.id);
      this.pump();
    });
  }
  snapshot(): {
    globalLimit: number;
    active: number;
    waiting: number;
    providers: Array<{ profileId: string; active: number; waiting: number }>;
  } {
    const ids = new Set([
      ...this.perProfile.keys(),
      ...this.waiters.map((waiter) => waiter.profileId)
    ]);
    return {
      globalLimit: this.globalLimit,
      active: this.active,
      waiting: this.waiters.length,
      providers: [...ids].sort().map((profileId) => ({
        profileId,
        active: this.perProfile.get(profileId) ?? 0,
        waiting: this.waiters.filter((waiter) => waiter.profileId === profileId).length
      }))
    };
  }
  private available(profileId: string, providerLimit: number): boolean {
    return this.active < this.globalLimit && (this.perProfile.get(profileId) ?? 0) < providerLimit;
  }
  private claim(profileId: string): () => void {
    this.active += 1;
    this.perProfile.set(profileId, (this.perProfile.get(profileId) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      const count = (this.perProfile.get(profileId) ?? 1) - 1;
      if (count) this.perProfile.set(profileId, count);
      else this.perProfile.delete(profileId);
      this.pump();
    };
  }
  private pump(): void {
    if (this.active >= this.globalLimit) return;
    for (const waiter of [...this.waiters]) {
      if (!this.available(waiter.profileId, waiter.providerLimit)) continue;
      this.waiters.splice(this.waiters.indexOf(waiter), 1);
      waiter.resolve(this.claim(waiter.profileId));
      if (this.active >= this.globalLimit) return;
    }
  }
}
