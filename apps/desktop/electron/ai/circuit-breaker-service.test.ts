import { describe, expect, it } from 'vitest';
import { openDesktopDatabase } from '../database/database.js';
import { CircuitBreakerService } from './circuit-breaker-service.js';

describe('persistent circuit breaker', () => {
  it('opens on qualifying failures and permits exactly one half-open probe after cooldown', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id, owner_id, name, provider_id, enabled, temperature, top_p, max_output_tokens, timeout_ms, retry_limit, concurrency_limit, automatic_analysis, priority, credential_configured, created_at, updated_at) VALUES ('p','owner','P','ollama',1,.2,1,1,30000,1,1,0,1,0,'2026-01-01','2026-01-01')"
    ).run();
    const breaker = new CircuitBreakerService(db, 'owner', 2, 10);
    breaker.record('p', 'TIMEOUT', false);
    expect(breaker.record('p', 'TIMEOUT', false)).toBe('open');
    expect(breaker.acquireProbe('p', 'generation', new Date()).state).toBe('open');
    const probe = breaker.acquireProbe('p', 'generation', new Date(Date.now() + 20));
    expect(probe.state).toBe('half_open');
    expect(breaker.acquireProbe('p', 'generation', new Date(Date.now() + 20)).state).toBe('open');
    expect(breaker.record('p', null, true)).toBe('closed');
    db.close();
  });
  it('does not open for cancellation, policy, or budget outcomes', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id, owner_id, name, provider_id, enabled, temperature, top_p, max_output_tokens, timeout_ms, retry_limit, concurrency_limit, automatic_analysis, priority, credential_configured, created_at, updated_at) VALUES ('p','owner','P','ollama',1,.2,1,1,30000,1,1,0,1,0,'2026-01-01','2026-01-01')"
    ).run();
    const breaker = new CircuitBreakerService(db, 'owner', 1);
    for (const code of ['CANCELLATION', 'PERMISSION', 'BUDGET_EXCEEDED', 'VALIDATION'])
      expect(breaker.record('p', code, false)).toBe('closed');
    db.close();
  });
  it('persists open state across service recreation and reopens after a failed half-open probe', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id, owner_id, name, provider_id, enabled, temperature, top_p, max_output_tokens, timeout_ms, retry_limit, concurrency_limit, automatic_analysis, priority, credential_configured, created_at, updated_at) VALUES ('p','owner','P','ollama',1,.2,1,1,30000,1,1,0,1,0,'2026-01-01','2026-01-01')"
    ).run();
    const started = new Date('2026-01-01T00:00:00.000Z');
    const first = new CircuitBreakerService(db, 'owner', 1, 10);
    expect(first.record('p', 'TIMEOUT', false, 'generation', started)).toBe('open');
    const restarted = new CircuitBreakerService(db, 'owner', 1, 10);
    expect(restarted.acquireProbe('p', 'generation', new Date(started.getTime() + 5)).state).toBe(
      'open'
    );
    expect(restarted.acquireProbe('p', 'generation', new Date(started.getTime() + 11)).state).toBe(
      'half_open'
    );
    expect(
      restarted.record('p', 'TIMEOUT', false, 'generation', new Date(started.getTime() + 12))
    ).toBe('open');
    db.close();
  });
});
