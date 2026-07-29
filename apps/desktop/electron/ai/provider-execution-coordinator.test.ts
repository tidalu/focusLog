import { describe, expect, it, vi } from 'vitest';
import { openDesktopDatabase } from '../database/database.js';
import { ProviderExecutionCoordinator } from './provider-execution-coordinator.js';
import { ExecutionPolicyService } from './execution-policy-service.js';
import { CircuitBreakerService } from './circuit-breaker-service.js';
import { AIUsageCancellationError, AIUsageError } from './errors.js';
import { PricingCatalog } from './pricing-catalog.js';
import { BudgetService } from './budget-service.js';

describe('provider execution coordinator', () => {
  it('persists same-provider retry and cross-provider fallback attempts in order', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const coordinator = new ProviderExecutionCoordinator(db, 'owner');
    let calls = 0;
    const result = await coordinator.execute({
      jobId: 'job',
      queueAttempt: 1,
      entries: [
        {
          providerProfileId: 'a',
          providerType: 'ollama',
          model: 'a',
          maxSameProviderRetries: 1,
          allowFallback: true
        },
        {
          providerProfileId: 'b',
          providerType: 'ollama',
          model: 'b',
          maxSameProviderRetries: 0,
          allowFallback: false
        }
      ],
      async invoke(entry) {
        calls += 1;
        if (calls < 3) throw new TypeError('offline');
        return entry.model;
      }
    });
    expect(result).toMatchObject({
      value: 'b',
      providerProfileId: 'b',
      fallbackUsed: true,
      attempts: 3
    });
    expect(
      db
        .prepare(
          'SELECT sequence, provider_profile_id AS profile, outcome FROM ai_provider_attempts ORDER BY sequence'
        )
        .all()
    ).toEqual([
      { sequence: 1, profile: 'a', outcome: 'failed' },
      { sequence: 2, profile: 'a', outcome: 'failed' },
      { sequence: 3, profile: 'b', outcome: 'succeeded' }
    ]);
    db.close();
  });
  it('aborts an active provider request when a live global kill switch changes', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_settings (owner_id,mode,updated_at) VALUES ('owner','LOCAL','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    let started = false;
    const execution = new ProviderExecutionCoordinator(db, 'owner').execute({
      jobId: 'job',
      queueAttempt: 1,
      enforceCurrentPolicy: true,
      entries: [
        {
          providerProfileId: 'p',
          providerType: 'ollama',
          model: 'm',
          maxSameProviderRetries: 0,
          allowFallback: false
        }
      ],
      invoke: async (_entry, signal) =>
        new Promise<string>((_resolve, reject) => {
          started = true;
          signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        })
    });
    await vi.waitFor(() => expect(started).toBe(true));
    new ExecutionPolicyService(db, 'owner').set('global', '', true);
    await expect(execution).rejects.toThrow('stopped');
    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM ai_provider_attempts WHERE outcome = 'failed'")
        .get()
    ).toEqual({ count: 1 });
    db.close();
  });
  it('does not invoke an open provider or create an attempt before fallback policy decides', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const breaker = new CircuitBreakerService(db, 'owner', 1, 60_000);
    breaker.record('p', 'TIMEOUT', false);
    let calls = 0;
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        entries: [
          {
            providerProfileId: 'p',
            providerType: 'ollama',
            model: 'm',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        invoke: async () => {
          calls += 1;
          return 'never';
        }
      })
    ).rejects.toThrow('temporarily unavailable');
    expect(calls).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_provider_attempts').get()).toEqual({
      count: 0
    });
    db.close();
  });
  it('records queued structured repair through the same controlled coordinator path', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        operationType: 'structured_repair',
        repairIndex: 1,
        entries: [
          {
            providerProfileId: 'p',
            providerType: 'ollama',
            model: 'm',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        invoke: async () => 'valid-json'
      })
    ).resolves.toMatchObject({ value: 'valid-json' });
    expect(
      db
        .prepare(
          'SELECT operation_type AS operation, structured_repair_count AS repairIndex FROM ai_provider_attempts'
        )
        .get()
    ).toEqual({ operation: 'structured_repair', repairIndex: 1 });
    db.close();
  });
  it('cancels before the first provider attempt without creating history or calling a provider', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const abort = new AbortController();
    abort.abort();
    let calls = 0;
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        signal: abort.signal,
        entries: [
          {
            providerProfileId: 'p',
            providerType: 'ollama',
            model: 'm',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        invoke: async () => {
          calls += 1;
          return 'never';
        }
      })
    ).rejects.toThrow('cancelled');
    expect(calls).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_provider_attempts').get()).toEqual({
      count: 0
    });
    db.close();
  });
  it('cancels after policy validation without creating an attempt, reservation, provider call, or breaker failure', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_settings (owner_id,mode,updated_at) VALUES ('owner','LOCAL','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    let calls = 0;
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        enforceCurrentPolicy: true,
        entries: [
          {
            providerProfileId: 'p',
            providerType: 'ollama',
            model: 'm',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        hooks: {
          afterPolicyValidation: () => {
            db.prepare("UPDATE ai_jobs SET cancellation_requested = 1 WHERE id = 'job'").run();
          }
        },
        budget: { requestCapMicros: 1_000, monthlyLimitMicros: 1_000, estimateMicros: () => 1 },
        invoke: async () => {
          calls += 1;
          return 'never';
        }
      })
    ).rejects.toThrow('cancelled');
    expect(calls).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_provider_attempts').get()).toEqual({
      count: 0
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_budget_reservations').get()).toEqual({
      count: 0
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_circuit_breakers').get()).toEqual({
      count: 0
    });
    db.close();
  });
  it('releases a reservation exactly once when cancellation wins before provider invocation', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    let calls = 0;
    const request = {
      jobId: 'job',
      queueAttempt: 1,
      entries: [
        {
          providerProfileId: 'p',
          providerType: 'ollama',
          model: 'm',
          maxSameProviderRetries: 0,
          allowFallback: false
        }
      ],
      hooks: {
        afterReservation: () => {
          db.prepare("UPDATE ai_jobs SET cancellation_requested = 1 WHERE id = 'job'").run();
        }
      },
      budget: { requestCapMicros: 1_000, monthlyLimitMicros: 1_000, estimateMicros: () => 7 },
      invoke: async () => {
        calls += 1;
        return 'never';
      }
    };
    await expect(new ProviderExecutionCoordinator(db, 'owner').execute(request)).rejects.toThrow(
      'cancelled'
    );
    await expect(new ProviderExecutionCoordinator(db, 'owner').execute(request)).rejects.toThrow(
      'cancelled'
    );
    expect(calls).toBe(0);
    expect(
      db.prepare('SELECT status, reserved_micros AS reserved FROM ai_budget_reservations').all()
    ).toEqual([{ status: 'released', reserved: 7 }]);
    expect(
      db.prepare('SELECT outcome, error_code AS code FROM ai_provider_attempts').all()
    ).toEqual([{ outcome: 'failed', code: 'CANCELLATION' }]);
    db.close();
  });
  it('cancels before fallback without invoking the next provider', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const calls: string[] = [];
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        entries: [
          {
            providerProfileId: 'a',
            providerType: 'ollama',
            model: 'a',
            maxSameProviderRetries: 0,
            allowFallback: true
          },
          {
            providerProfileId: 'b',
            providerType: 'ollama',
            model: 'b',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        hooks: {
          beforeFallback: () => {
            db.prepare("UPDATE ai_jobs SET cancellation_requested = 1 WHERE id = 'job'").run();
          }
        },
        invoke: async (entry) => {
          calls.push(entry.model);
          throw new TypeError('offline');
        }
      })
    ).rejects.toThrow('cancelled');
    expect(calls).toEqual(['a']);
    expect(
      db
        .prepare(
          'SELECT sequence, provider_profile_id AS profile, outcome FROM ai_provider_attempts'
        )
        .all()
    ).toEqual([{ sequence: 1, profile: 'a', outcome: 'failed' }]);
    db.close();
  });
  it('releases a committed reservation when a policy switch wins the final pre-provider gate', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_settings (owner_id,mode,updated_at) VALUES ('owner','LOCAL','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    let calls = 0;
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        enforceCurrentPolicy: true,
        entries: [
          {
            providerProfileId: 'p',
            providerType: 'ollama',
            model: 'm',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        hooks: {
          afterReservation: () => new ExecutionPolicyService(db, 'owner').set('global', '', true)
        },
        budget: { requestCapMicros: 10, monthlyLimitMicros: 10, estimateMicros: () => 1 },
        invoke: async () => {
          calls += 1;
          return 'never';
        }
      })
    ).rejects.toThrow('disabled');
    expect(calls).toBe(0);
    expect(db.prepare('SELECT status FROM ai_budget_reservations').all()).toEqual([
      { status: 'released' }
    ]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_circuit_breakers').get()).toEqual({
      count: 0
    });
    db.close();
  });
  it('releases a cloud reservation when consent is revoked after commit and before invocation', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('cloud','owner','Cloud','openai',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_settings (owner_id,mode,updated_at) VALUES ('owner','CLOUD','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_cloud_consents (id,owner_id,provider_profile_id,mode,consented_at) VALUES ('consent','owner','cloud','CLOUD','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    let calls = 0;
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        enforceCurrentPolicy: true,
        entries: [
          {
            providerProfileId: 'cloud',
            providerType: 'openai',
            model: 'm',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        hooks: {
          afterReservation: () => {
            db.prepare("DELETE FROM ai_cloud_consents WHERE id = 'consent'").run();
          }
        },
        budget: { requestCapMicros: 10, monthlyLimitMicros: 10, estimateMicros: () => 1 },
        invoke: async () => {
          calls += 1;
          return 'never';
        }
      })
    ).rejects.toThrow('consent');
    expect(calls).toBe(0);
    expect(db.prepare('SELECT status FROM ai_budget_reservations').all()).toEqual([
      { status: 'released' }
    ]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_usage_records').get()).toEqual({
      count: 0
    });
    db.close();
  });
  it('blocks cloud consent revocation before reservation without creating a financial hold', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('cloud','owner','Cloud','openai',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_settings (owner_id,mode,updated_at) VALUES ('owner','CLOUD','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_cloud_consents (id,owner_id,provider_profile_id,mode,consented_at) VALUES ('consent','owner','cloud','CLOUD','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    let calls = 0;
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        enforceCurrentPolicy: true,
        entries: [
          {
            providerProfileId: 'cloud',
            providerType: 'openai',
            model: 'm',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        hooks: {
          beforeReservation: () => {
            db.prepare("DELETE FROM ai_cloud_consents WHERE id = 'consent'").run();
          }
        },
        budget: { requestCapMicros: 10, monthlyLimitMicros: 10, estimateMicros: () => 1 },
        invoke: async () => {
          calls += 1;
          return 'never';
        }
      })
    ).rejects.toThrow('consent');
    expect(calls).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_budget_reservations').get()).toEqual({
      count: 0
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_usage_records').get()).toEqual({
      count: 0
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_circuit_breakers').get()).toEqual({
      count: 0
    });
    expect(
      db.prepare('SELECT outcome, error_code AS code FROM ai_provider_attempts').all()
    ).toEqual([{ outcome: 'failed', code: 'PERMISSION' }]);
    expect(db.prepare("SELECT status FROM ai_jobs WHERE id = 'job'").get()).toEqual({
      status: 'leased'
    });
    db.close();
  });
  it('blocks a cloud attempt when privacy changes to Local before reservation', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('cloud','owner','Cloud','openai',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_settings (owner_id,mode,updated_at) VALUES ('owner','CLOUD','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_cloud_consents (id,owner_id,provider_profile_id,mode,consented_at) VALUES ('consent','owner','cloud','CLOUD','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    let calls = 0;
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        enforceCurrentPolicy: true,
        entries: [
          {
            providerProfileId: 'cloud',
            providerType: 'openai',
            model: 'm',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        hooks: {
          beforeReservation: () => {
            db.prepare("UPDATE ai_settings SET mode = 'LOCAL' WHERE owner_id = 'owner'").run();
          }
        },
        budget: { requestCapMicros: 10, monthlyLimitMicros: 10, estimateMicros: () => 1 },
        invoke: async () => {
          calls += 1;
          return 'never';
        }
      })
    ).rejects.toThrow('Local privacy');
    expect(calls).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_budget_reservations').get()).toEqual({
      count: 0
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_usage_records').get()).toEqual({
      count: 0
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_circuit_breakers').get()).toEqual({
      count: 0
    });
    expect(
      db.prepare('SELECT outcome, error_code AS code FROM ai_provider_attempts').all()
    ).toEqual([{ outcome: 'failed', code: 'PERMISSION' }]);
    expect(db.prepare("SELECT status FROM ai_jobs WHERE id = 'job'").get()).toEqual({
      status: 'leased'
    });
    db.close();
  });
  it('settles a retryable provider failure that reports incurred integer usage', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        entries: [
          {
            providerProfileId: 'p',
            providerType: 'ollama',
            model: 'm',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        budget: { requestCapMicros: 10, monthlyLimitMicros: 10, estimateMicros: () => 5 },
        invoke: async () => {
          throw new AIUsageError(
            'NETWORK_UNAVAILABLE',
            'Provider interrupted after reporting usage.',
            true,
            3
          );
        }
      })
    ).rejects.toThrow('interrupted');
    expect(
      db
        .prepare(
          'SELECT status, settled_micros AS settled, settlement_source AS source FROM ai_budget_reservations'
        )
        .all()
    ).toEqual([{ status: 'settled', settled: 3, source: 'reported' }]);
    expect(
      db.prepare('SELECT settled_cost_micros AS settled, outcome FROM ai_provider_attempts').all()
    ).toEqual([{ settled: 3, outcome: 'failed' }]);
    db.close();
  });
  it('settles a non-retryable authentication failure that reports incurred integer usage', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    let calls = 0;
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        entries: [
          {
            providerProfileId: 'p',
            providerType: 'ollama',
            model: 'm',
            maxSameProviderRetries: 2,
            allowFallback: false
          }
        ],
        budget: { requestCapMicros: 10, monthlyLimitMicros: 10, estimateMicros: () => 5 },
        invoke: async () => {
          calls += 1;
          throw new AIUsageError(
            'AUTHENTICATION',
            'Provider rejected the request after billable work.',
            false,
            2
          );
        }
      })
    ).rejects.toThrow('rejected');
    expect(calls).toBe(1);
    expect(
      db.prepare('SELECT status, settled_micros AS settled FROM ai_budget_reservations').all()
    ).toEqual([{ status: 'settled', settled: 2 }]);
    expect(
      db
        .prepare(
          'SELECT error_code AS code, settled_cost_micros AS settled FROM ai_provider_attempts'
        )
        .all()
    ).toEqual([{ code: 'AUTHENTICATION', settled: 2 }]);
    db.close();
  });
  it('releases a reservation when the provider switch changes after commit', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_settings (owner_id,mode,updated_at) VALUES ('owner','LOCAL','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    let calls = 0;
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        enforceCurrentPolicy: true,
        entries: [
          {
            providerProfileId: 'p',
            providerType: 'ollama',
            model: 'm',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        hooks: {
          afterReservation: () => new ExecutionPolicyService(db, 'owner').set('provider', 'p', true)
        },
        budget: { requestCapMicros: 10, monthlyLimitMicros: 10, estimateMicros: () => 1 },
        invoke: async () => {
          calls += 1;
          return 'never';
        }
      })
    ).rejects.toThrow('disabled');
    expect(calls).toBe(0);
    expect(db.prepare('SELECT status FROM ai_budget_reservations').all()).toEqual([
      { status: 'released' }
    ]);
    db.close();
  });
  it('releases a reservation when its fallback chain switch changes after commit', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_settings (owner_id,mode,updated_at) VALUES ('owner','LOCAL','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    let calls = 0;
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        chainId: 'chain',
        enforceCurrentPolicy: true,
        entries: [
          {
            providerProfileId: 'p',
            providerType: 'ollama',
            model: 'm',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        hooks: {
          afterReservation: () =>
            new ExecutionPolicyService(db, 'owner').set('chain', 'chain', true)
        },
        budget: { requestCapMicros: 10, monthlyLimitMicros: 10, estimateMicros: () => 1 },
        invoke: async () => {
          calls += 1;
          return 'never';
        }
      })
    ).rejects.toThrow('disabled');
    expect(calls).toBe(0);
    expect(db.prepare('SELECT status FROM ai_budget_reservations').all()).toEqual([
      { status: 'released' }
    ]);
    db.close();
  });
  it('releases once when global and provider switches compete after reservation commit', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_settings (owner_id,mode,updated_at) VALUES ('owner','LOCAL','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    let calls = 0;
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        enforceCurrentPolicy: true,
        entries: [
          {
            providerProfileId: 'p',
            providerType: 'ollama',
            model: 'm',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        hooks: {
          afterReservation: () => {
            const policy = new ExecutionPolicyService(db, 'owner');
            policy.set('global', '', true);
            policy.set('provider', 'p', true);
          }
        },
        budget: { requestCapMicros: 10, monthlyLimitMicros: 10, estimateMicros: () => 1 },
        invoke: async () => {
          calls += 1;
          return 'never';
        }
      })
    ).rejects.toThrow('disabled');
    expect(calls).toBe(0);
    expect(db.prepare('SELECT status FROM ai_budget_reservations').all()).toEqual([
      { status: 'released' }
    ]);
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM ai_provider_attempts WHERE outcome = ?')
        .get('failed')
    ).toEqual({ count: 1 });
    db.close();
  });
  it('persists an immutable cloud pricing snapshot before invoking the provider', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('cloud','owner','Cloud','openai',1,'gpt','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id,owner_id,kind,idempotency_key,payload_json,status,schema_version,priority,attempts,max_attempts,run_after,scheduled_at,created_at,updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const pricing = new PricingCatalog([
      {
        providerType: 'openai',
        model: 'gpt',
        currency: 'USD',
        inputMicrosPerMillion: 1_000_000,
        outputMicrosPerMillion: 2_000_000,
        fixedMicros: 1,
        version: 'catalog-2026-07'
      }
    ]);
    let calls = 0;
    await new ProviderExecutionCoordinator(db, 'owner').execute({
      jobId: 'job',
      queueAttempt: 1,
      entries: [
        {
          providerProfileId: 'cloud',
          providerType: 'openai',
          model: 'gpt',
          maxSameProviderRetries: 0,
          allowFallback: false
        }
      ],
      budget: {
        requestCapMicros: 100,
        monthlyLimitMicros: 100,
        pricingQuote: (entry) =>
          pricing.quote(entry.providerType, entry.model, { inputTokens: 2, outputTokens: 3 }),
        actualMicros: (value, _entry, snapshot) => pricing.estimateFromSnapshot(snapshot, value)
      },
      invoke: async () => {
        calls += 1;
        return { inputTokens: 1, outputTokens: 0 };
      }
    });
    const row = db
      .prepare(
        'SELECT pricing_version AS version, pricing_snapshot_json AS snapshot, reserved_micros AS reserved, settled_micros AS settled FROM ai_budget_reservations'
      )
      .get() as { version: string; snapshot: string; reserved: number; settled: number };
    const snapshot = JSON.parse(row.snapshot) as Record<string, unknown>;
    expect(calls).toBe(1);
    expect(row).toMatchObject({ version: 'catalog-2026-07', reserved: 9, settled: 2 });
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      catalogueVersion: 'catalog-2026-07',
      providerType: 'openai',
      model: 'gpt',
      inputMicrosPerMillion: '1000000',
      outputMicrosPerMillion: '2000000',
      fixedMicros: '1',
      estimatedReservationMicros: '9',
      localZeroCost: false
    });
    expect(row.snapshot).not.toMatch(/api[_-]?key|authorization|secret|prompt|lease/iu);
    db.close();
  });
  it('persists explicit local zero-cost snapshots and blocks unknown cloud pricing before invocation', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('local','owner','Local','ollama',1,'m','2026-01-01','2026-01-01'), ('cloud','owner','Cloud','openai',1,'unknown','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id,owner_id,kind,idempotency_key,payload_json,status,schema_version,priority,attempts,max_attempts,run_after,scheduled_at,created_at,updated_at) VALUES ('local-job','owner','daily_analysis','local','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01'), ('cloud-job','owner','daily_analysis','cloud','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const pricing = new PricingCatalog();
    let calls = 0;
    await new ProviderExecutionCoordinator(db, 'owner').execute({
      jobId: 'local-job',
      queueAttempt: 1,
      entries: [
        {
          providerProfileId: 'local',
          providerType: 'ollama',
          model: 'm',
          maxSameProviderRetries: 0,
          allowFallback: false
        }
      ],
      budget: {
        requestCapMicros: 10,
        monthlyLimitMicros: 10,
        pricingQuote: (entry) =>
          pricing.quote(entry.providerType, entry.model, { inputTokens: 20, outputTokens: 20 })
      },
      invoke: async () => {
        calls += 1;
        return 'local';
      }
    });
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'cloud-job',
        queueAttempt: 1,
        entries: [
          {
            providerProfileId: 'cloud',
            providerType: 'openai',
            model: 'unknown',
            maxSameProviderRetries: 0,
            allowFallback: false
          }
        ],
        budget: {
          requestCapMicros: 10,
          monthlyLimitMicros: 10,
          pricingQuote: (entry) =>
            pricing.quote(entry.providerType, entry.model, { inputTokens: 1 })
        },
        invoke: async () => {
          calls += 1;
          return 'cloud';
        }
      })
    ).rejects.toThrow('price estimate');
    const local = JSON.parse(
      (
        db
          .prepare(
            "SELECT pricing_snapshot_json AS snapshot FROM ai_budget_reservations WHERE job_id = 'local-job'"
          )
          .get() as { snapshot: string }
      ).snapshot
    ) as Record<string, unknown>;
    expect(calls).toBe(1);
    expect(local).toMatchObject({
      localZeroCost: true,
      estimatedReservationMicros: '0',
      inputMicrosPerMillion: '0',
      outputMicrosPerMillion: '0'
    });
    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM ai_budget_reservations WHERE job_id = 'cloud-job'")
        .get()
    ).toEqual({ count: 0 });
    db.close();
  });
  it('persists distinct snapshots for retry, fallback, and structured repair attempts', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('a','owner','A','openai',1,'a','2026-01-01','2026-01-01'), ('b','owner','B','anthropic',1,'b','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id,owner_id,kind,idempotency_key,payload_json,status,schema_version,priority,attempts,max_attempts,run_after,scheduled_at,created_at,updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01'), ('repair','owner','daily_analysis','repair','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const pricing = new PricingCatalog([
      {
        providerType: 'openai',
        model: 'a',
        currency: 'USD',
        inputMicrosPerMillion: 1_000_000,
        outputMicrosPerMillion: 0,
        version: 'a-v1'
      },
      {
        providerType: 'anthropic',
        model: 'b',
        currency: 'USD',
        inputMicrosPerMillion: 2_000_000,
        outputMicrosPerMillion: 0,
        version: 'b-v1'
      }
    ]);
    let calls = 0;
    const budget = {
      requestCapMicros: 100,
      monthlyLimitMicros: 100,
      pricingQuote: (entry: { providerType: string; model: string }) =>
        pricing.quote(entry.providerType, entry.model, { inputTokens: 1 })
    };
    await new ProviderExecutionCoordinator(db, 'owner').execute({
      jobId: 'job',
      queueAttempt: 1,
      entries: [
        {
          providerProfileId: 'a',
          providerType: 'openai',
          model: 'a',
          maxSameProviderRetries: 1,
          allowFallback: true
        },
        {
          providerProfileId: 'b',
          providerType: 'anthropic',
          model: 'b',
          maxSameProviderRetries: 0,
          allowFallback: false
        }
      ],
      budget,
      invoke: async (entry) => {
        calls += 1;
        if (calls < 3) throw new TypeError('offline');
        return entry.model;
      }
    });
    await new ProviderExecutionCoordinator(db, 'owner').execute({
      jobId: 'repair',
      queueAttempt: 1,
      operationType: 'structured_repair',
      repairIndex: 1,
      entries: [
        {
          providerProfileId: 'a',
          providerType: 'openai',
          model: 'a',
          maxSameProviderRetries: 0,
          allowFallback: false
        }
      ],
      budget,
      invoke: async () => 'repair'
    });
    const rows = db
      .prepare(
        'SELECT reservation.pricing_version AS version, attempt.operation_type AS operation FROM ai_budget_reservations reservation JOIN ai_provider_attempts attempt ON attempt.id = reservation.provider_attempt_id ORDER BY attempt.job_id, attempt.sequence'
      )
      .all();
    expect(rows).toEqual([
      { version: 'a-v1', operation: 'generation' },
      { version: 'a-v1', operation: 'generation' },
      { version: 'b-v1', operation: 'generation' },
      { version: 'a-v1', operation: 'structured_repair' }
    ]);
    db.close();
  });
  it('settles billable cancellation exactly once without retry, fallback, breaker failure, or late completion', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id,owner_id,kind,idempotency_key,payload_json,status,schema_version,priority,attempts,max_attempts,run_after,scheduled_at,created_at,updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const controller = new AbortController();
    let signalObserved = false;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const begun = new Promise<void>((resolve) => {
      started = resolve;
    });
    let calls = 0;
    const execution = new ProviderExecutionCoordinator(db, 'owner').execute({
      jobId: 'job',
      queueAttempt: 1,
      signal: controller.signal,
      entries: [
        {
          providerProfileId: 'p',
          providerType: 'ollama',
          model: 'm',
          maxSameProviderRetries: 2,
          allowFallback: true
        },
        {
          providerProfileId: 'fallback',
          providerType: 'ollama',
          model: 'fallback',
          maxSameProviderRetries: 0,
          allowFallback: false
        }
      ],
      budget: { requestCapMicros: 5, monthlyLimitMicros: 10, estimateMicros: () => 5 },
      invoke: async (_entry, signal) => {
        calls += 1;
        signal?.addEventListener(
          'abort',
          () => {
            signalObserved = true;
          },
          { once: true }
        );
        started();
        await barrier;
        throw new AIUsageCancellationError('Provider cancelled after billable work.', 3, {
          inputTokens: 11,
          outputTokens: 7,
          partial: true
        });
      }
    });
    await begun;
    controller.abort();
    controller.abort();
    release();
    await expect(execution).rejects.toMatchObject({ code: 'CANCELLATION' });
    const reservationId = (
      db.prepare('SELECT id FROM ai_budget_reservations').get() as { id: string }
    ).id;
    const lateProviderCallback = () => new BudgetService(db, 'owner').settle(reservationId, 3);
    expect(signalObserved).toBe(true);
    expect(calls).toBe(1);
    expect(
      db
        .prepare(
          'SELECT status, reserved_micros AS reserved, settled_micros AS settled FROM ai_budget_reservations'
        )
        .all()
    ).toEqual([{ status: 'settled', reserved: 5, settled: 3 }]);
    expect(
      db
        .prepare(
          'SELECT outcome, error_code AS code, cancellation_state AS cancellation, settled_cost_micros AS settled, reported_cost_micros AS reported, input_tokens AS input, output_tokens AS output FROM ai_provider_attempts'
        )
        .all()
    ).toEqual([
      {
        outcome: 'failed',
        code: 'CANCELLATION',
        cancellation: 'usage_reported',
        settled: 3,
        reported: 3,
        input: 11,
        output: 7
      }
    ]);
    expect(
      db
        .prepare(
          "SELECT COALESCE(SUM(settled_micros), 0) AS settled, COALESCE(SUM(CASE WHEN status = 'reserved' THEN reserved_micros ELSE 0 END), 0) AS reserved FROM ai_budget_reservations"
        )
        .get()
    ).toEqual({ settled: 3, reserved: 0 });
    expect(lateProviderCallback()).toBe(false);
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_circuit_breakers').get()).toEqual({
      count: 0
    });
    expect(db.prepare("SELECT status FROM ai_jobs WHERE id = 'job'").get()).toEqual({
      status: 'leased'
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_memories').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_usage_records').get()).toEqual({
      count: 0
    });
    expect(JSON.stringify(db.prepare('SELECT * FROM ai_budget_reservations').all())).not.toMatch(
      /CANCELLATION_FIXTURE_SECRET|authorization|lease-token/iu
    );
    db.close();
  });
  it('settles a cancellation whose reported cost exactly equals its reservation', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id,owner_id,kind,idempotency_key,payload_json,status,schema_version,priority,attempts,max_attempts,run_after,scheduled_at,created_at,updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const controller = new AbortController();
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        signal: controller.signal,
        entries: [
          {
            providerProfileId: 'p',
            providerType: 'ollama',
            model: 'm',
            maxSameProviderRetries: 1,
            allowFallback: false
          }
        ],
        budget: { requestCapMicros: 5, monthlyLimitMicros: 5, estimateMicros: () => 5 },
        invoke: async (_entry, signal) => {
          controller.abort();
          expect(signal?.aborted).toBe(true);
          throw new AIUsageCancellationError('Provider cancelled after billable work.', 5);
        }
      })
    ).rejects.toMatchObject({ code: 'CANCELLATION' });
    expect(
      db.prepare('SELECT status, settled_micros AS settled FROM ai_budget_reservations').all()
    ).toEqual([{ status: 'settled', settled: 5 }]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_provider_attempts').get()).toEqual({
      count: 1
    });
    db.close();
  });
  it('releases a cancelled reservation when no billable usage was reported', async () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_jobs (id,owner_id,kind,idempotency_key,payload_json,status,schema_version,priority,attempts,max_attempts,run_after,scheduled_at,created_at,updated_at) VALUES ('job','owner','daily_analysis','job','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const controller = new AbortController();
    await expect(
      new ProviderExecutionCoordinator(db, 'owner').execute({
        jobId: 'job',
        queueAttempt: 1,
        signal: controller.signal,
        entries: [
          {
            providerProfileId: 'p',
            providerType: 'ollama',
            model: 'm',
            maxSameProviderRetries: 1,
            allowFallback: false
          }
        ],
        budget: { requestCapMicros: 5, monthlyLimitMicros: 5, estimateMicros: () => 5 },
        invoke: async () => {
          controller.abort();
          throw new DOMException('Cancelled', 'AbortError');
        }
      })
    ).rejects.toMatchObject({ code: 'CANCELLATION' });
    expect(
      db.prepare('SELECT status, settled_micros AS settled FROM ai_budget_reservations').all()
    ).toEqual([{ status: 'released', settled: null }]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_circuit_breakers').get()).toEqual({
      count: 0
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_provider_attempts').get()).toEqual({
      count: 1
    });
    db.close();
  });
});
