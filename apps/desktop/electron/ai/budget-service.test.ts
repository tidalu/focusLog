import { describe, expect, it } from 'vitest';
import { openDesktopDatabase } from '../database/database.js';
import { BudgetService, microsToUsd, usdToMicros } from './budget-service.js';

describe('exact budget reservations', () => {
  it('uses exact micro-units and atomically prevents overspending', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('a','owner','daily_analysis','a','{}','queued',1,1,0,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01'), ('b','owner','daily_analysis','b','{}','queued',1,1,0,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const budget = new BudgetService(db, 'owner');
    expect(usdToMicros('0.000001')).toBe(1);
    const reservation = budget.reserve('a', 'a:1', null, 10, '2026-07', 20);
    expect(budget.reserve('a', 'a:1', null, 10, '2026-07', 20)).toBe(reservation);
    expect(() => budget.reserve('b', 'b:1', null, 11, '2026-07', 20)).toThrow('budget');
    expect(budget.settle(reservation, 8)).toBe(true);
    expect(budget.settle(reservation, 8)).toBe(false);
    expect(microsToUsd(8)).toBe('0.000008');
    db.close();
  });
  it('enforces a request aggregate cap and releases abandoned reservations', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('a','owner','daily_analysis','a','{}','queued',1,1,0,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const budget = new BudgetService(db, 'owner');
    const first = budget.reserve('a', 'a:1', null, 5, '2026-07', 50, 10);
    expect(() => budget.reserve('a', 'a:2', null, 6, '2026-07', 50, 10)).toThrow(
      'request cost cap'
    );
    expect(budget.release(first)).toBe(true);
    expect(budget.recoverExpired('2027-01-01')).toBe(0);
    expect(budget.snapshot('2026-07', 50)).toMatchObject({
      settledMicros: 0,
      reservedMicros: 0,
      remainingMicros: 50
    });
    db.close();
  });
  it('projects exact budget values as strings without reservation internals', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('a','owner','daily_analysis','a','{}','queued',1,1,0,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const budget = new BudgetService(db, 'owner');
    budget.reserve('a', 'a:1', null, 7, '2026-07', 10);
    expect(budget.safeProjection('2026-07', 10, 'a')).toEqual({
      periodKey: '2026-07',
      currency: 'USD',
      limitMicros: '10',
      settledMicros: '0',
      reservedMicros: '7',
      remainingMicros: '3',
      jobSettledMicros: '0',
      jobReservedMicros: '7'
    });
    db.close();
  });
  it('rejects a stale worker at the reservation transaction boundary', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, lease_owner, lease_token, created_at, updated_at) VALUES ('a','owner','daily_analysis','a','{}','leased',1,1,1,3,'2026-01-01','2026-01-01','current','current-token','2026-01-01','2026-01-01')"
    ).run();
    const budget = new BudgetService(db, 'owner');
    expect(() =>
      budget.reserve('a', 'a:1', null, 1, '2026-07', 10, null, {
        workerId: 'stale',
        token: 'stale-token'
      })
    ).toThrow('lease');
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_budget_reservations').get()).toEqual({
      count: 0
    });
    const reservation = budget.reserve('a', 'a:1', null, 1, '2026-07', 10, null, {
      workerId: 'current',
      token: 'current-token'
    });
    db.prepare(
      "UPDATE ai_jobs SET lease_owner = 'new', lease_token = 'new-token' WHERE id = 'a'"
    ).run();
    expect(
      budget.settle(reservation, 1, 'reported', { workerId: 'current', token: 'current-token' })
    ).toBe(false);
    expect(budget.release(reservation, { workerId: 'current', token: 'current-token' })).toBe(
      false
    );
    expect(
      db.prepare('SELECT status FROM ai_budget_reservations WHERE id = ?').get(reservation)
    ).toEqual({ status: 'reserved' });
    db.close();
  });
  it('keeps the exact final monthly amount isolated by budget month', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('a','owner','daily_analysis','a','{}','queued',1,1,0,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01'), ('b','owner','daily_analysis','b','{}','queued',1,1,0,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const budget = new BudgetService(db, 'owner');
    budget.reserve('a', 'a:1', null, 10, '2026-07', 10);
    expect(() => budget.reserve('b', 'b:1', null, 1, '2026-07', 10)).toThrow('budget');
    expect(budget.reserve('b', 'b:2', null, 10, '2026-08', 10)).toBeTruthy();
    expect(budget.snapshot('2026-07', 10)).toMatchObject({
      reservedMicros: 10,
      remainingMicros: 0
    });
    expect(budget.snapshot('2026-08', 10)).toMatchObject({
      reservedMicros: 10,
      remainingMicros: 0
    });
    db.close();
  });
  it('allows exactly one terminal financial transition and never releases a settled reservation', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('a','owner','daily_analysis','a','{}','queued',1,1,0,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const budget = new BudgetService(db, 'owner');
    const settled = budget.reserve('a', 'a:1', null, 5, '2026-07', 10, 5);
    expect(budget.settle(settled, 5)).toBe(true);
    expect(budget.release(settled)).toBe(false);
    expect(budget.settle(settled, 5)).toBe(false);
    const released = budget.reserve('a', 'a:2', null, 5, '2026-07', 10, 10);
    expect(budget.release(released)).toBe(true);
    expect(budget.settle(released, 5)).toBe(false);
    expect(budget.snapshot('2026-07', 10)).toMatchObject({
      settledMicros: 5,
      reservedMicros: 0,
      remainingMicros: 5
    });
    db.close();
  });
  it('keeps a planned attempt idempotent after either terminal state', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('a','owner','daily_analysis','a','{}','queued',1,1,0,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const budget = new BudgetService(db, 'owner');
    const settled = budget.reserve('a', 'attempt:1', null, 1, '2026-07', 10);
    budget.settle(settled, 1);
    expect(budget.reserve('a', 'attempt:1', null, 1, '2026-07', 10)).toBe(settled);
    const released = budget.reserve('a', 'attempt:2', null, 1, '2026-07', 10);
    budget.release(released);
    expect(budget.reserve('a', 'attempt:2', null, 1, '2026-07', 10)).toBe(released);
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_budget_reservations').get()).toEqual({
      count: 2
    });
    db.close();
  });
  it('serializes a lossless renderer-safe financial projection without reservation internals', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('a','owner','daily_analysis','a','{}','queued',1,1,0,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const budget = new BudgetService(db, 'owner');
    budget.reserve('a', 'a:1', null, 1, '2026-07', 1);
    expect(
      budget.financialProjection('2026-07', 1, 'a', {
        requestCapMicros: 1,
        pricingKnown: true,
        pricingVersion: 'catalog-v1',
        blockReason: 'Bearer PROJECTION_SECRET'
      })
    ).toEqual({
      periodKey: '2026-07',
      currency: 'USD',
      limitMicros: '1',
      settledMicros: '0',
      reservedMicros: '1',
      remainingMicros: '0',
      jobSettledMicros: '0',
      jobReservedMicros: '1',
      requestCapMicros: '1',
      pricingKnown: true,
      pricingVersion: 'catalog-v1',
      blockReason: 'Bearer [redacted]',
      recoveryState: 'active_reservation'
    });
    db.close();
  });
  it('persists pricing metadata atomically and derives the safe pricing state without exposing its snapshot', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('a','owner','daily_analysis','a','{}','queued',1,1,0,3,'2026-01-01','2026-01-01','2026-01-01','2026-01-01')"
    ).run();
    const budget = new BudgetService(db, 'owner');
    budget.reserve('a', 'a:1', null, 7, '2026-07', 10, null, undefined, undefined, {
      version: 'catalog-v1',
      snapshot: {
        schemaVersion: 1,
        catalogueVersion: 'catalog-v1',
        estimatedReservationMicros: '7',
        rounding: 'ceil-per-component'
      }
    });
    expect(
      db
        .prepare(
          'SELECT pricing_version AS version, pricing_snapshot_json AS snapshot FROM ai_budget_reservations'
        )
        .get()
    ).toEqual({
      version: 'catalog-v1',
      snapshot:
        '{"schemaVersion":1,"catalogueVersion":"catalog-v1","estimatedReservationMicros":"7","rounding":"ceil-per-component"}'
    });
    expect(
      (
        db.prepare('PRAGMA table_info(ai_budget_reservations)').all() as Array<{ name: string }>
      ).map((column) => column.name)
    ).toEqual(expect.arrayContaining(['pricing_version', 'pricing_snapshot_json']));
    expect(budget.financialProjection('2026-07', 10, 'a')).toEqual({
      periodKey: '2026-07',
      currency: 'USD',
      limitMicros: '10',
      settledMicros: '0',
      reservedMicros: '7',
      remainingMicros: '3',
      jobSettledMicros: '0',
      jobReservedMicros: '7',
      requestCapMicros: null,
      pricingKnown: true,
      pricingVersion: 'catalog-v1',
      blockReason: null,
      recoveryState: 'active_reservation'
    });
    db.close();
  });
});
