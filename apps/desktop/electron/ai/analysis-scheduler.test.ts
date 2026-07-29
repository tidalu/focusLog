import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { openDesktopDatabase } from '../database/database.js';
import type { DesktopDatabase } from '../database/database.js';
import { AIService } from './ai-service.js';
import { DesktopCredentialStore } from './credentials.js';
import { AnalysisService } from './analysis-service.js';
import { AnalysisSchedulerRuntime, AnalysisSchedulerService } from './analysis-scheduler.js';
import { AIJobQueue } from './job-queue.js';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture(filename = ':memory:') {
  const root = mkdtempSync(join(tmpdir(), 'focuslog-scheduler-'));
  directories.push(root);
  const database = openDesktopDatabase(
    filename,
    filename === ':memory:' ? undefined : Buffer.alloc(32, 7)
  );
  database
    .prepare('INSERT OR IGNORE INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run('owner', '2026-01-01', '2026-01-01');
  const ai = new AIService(
    database,
    'owner',
    new DesktopCredentialStore(root, {
      isAvailable: () => true,
      protect: (text) => Buffer.from(text),
      unprotect: (ciphertext) => ciphertext.toString()
    })
  );
  const existing = database
    .prepare("SELECT id FROM ai_provider_profiles WHERE owner_id = 'owner' AND name = 'Local'")
    .get() as { id: string } | undefined;
  const profile = existing
    ? ai.profile(existing.id)
    : ai.saveProfile({
        name: 'Local',
        providerId: 'ollama',
        endpoint: 'http://127.0.0.1:11434',
        generationModel: 'qwen3:8b',
        enabled: true
      });
  ai.saveSettings({ ...ai.getSettings(), mode: 'LOCAL' });
  const daily = new AnalysisService(database, 'owner', ai);
  const queue = new AIJobQueue(database, 'owner');
  const scheduler = new AnalysisSchedulerService(database, 'owner', ai, daily, undefined, queue);
  return { database, ai, profile, queue, scheduler };
}

function addCheckIn(database: DesktopDatabase, day: string) {
  const id = `check-${day}`;
  const revision = `rev-${day}`;
  const at = `${day}T10:00:00.000Z`;
  database
    .prepare(
      `INSERT OR IGNORE INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at)
       VALUES (?, 'owner', ?, ?, 'UTC', 'v1', ?, ?)`
    )
    .run(id, revision, at, at, at);
  database
    .prepare(
      'INSERT OR IGNORE INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(revision, id, `Log for ${day}`, `op-${revision}`, at);
}

function seedDaily(database: DesktopDatabase, day: string) {
  addCheckIn(database, day);
  database
    .prepare(
      `INSERT OR IGNORE INTO ai_memories (id, owner_id, period_kind, period_key, version, status, content, schema_version,
        prompt_version, provider_profile_id, source_revision_watermark, created_at, structured_result_json, structured_schema_version, validation_status)
       VALUES (?, 'owner', 'DAY', ?, 1, 'ACTIVE', ?, '1', '1.0.0', 'profile', ?, ?, '{}', 1, 'valid')`
    )
    .run(`daily-${day}`, day, `Daily ${day}`, `hash-${day}`, `${day}T12:00:00.000Z`);
}

function saveSchedule(
  scheduler: AnalysisSchedulerService,
  profileId: string,
  level: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  patch: Partial<Parameters<AnalysisSchedulerService['save']>[0]> = {}
) {
  return scheduler.save({
    level,
    enabled: true,
    localTime: '03:00',
    timezone: 'UTC',
    providerProfileId: profileId,
    privacyMode: 'LOCAL',
    catchUpLimit: 3,
    ...patch
  });
}

describe('analysis scheduler and manual execution', () => {
  it('persists schedule settings with safe micro-unit cost projections', () => {
    const { database, profile, scheduler } = fixture();
    const schedule = saveSchedule(scheduler, profile.id, 'daily', {
      maxCostMicros: '12345',
      modelMode: 'fixed',
      modelId: 'fixed-model'
    });
    expect(schedule).toMatchObject({
      level: 'daily',
      maxCostMicros: '12345',
      modelMode: 'fixed',
      modelId: 'fixed-model'
    });
    expect(() => saveSchedule(scheduler, profile.id, 'daily', { maxCostMicros: '12.3' })).toThrow(
      'integer micro-units'
    );
    database.close();
  });

  it('normal scheduled enqueue works for each representative level without provider execution', () => {
    const { database, profile, scheduler } = fixture();
    for (const level of ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const)
      saveSchedule(scheduler, profile.id, level);
    const result = scheduler.evaluate(new Date('2026-07-23T04:00:00.000Z'));
    expect(result.evaluated).toBe(5);
    const counts = new Map(
      (
        database
          .prepare('SELECT kind, COUNT(*) AS count FROM ai_jobs GROUP BY kind')
          .all() as Array<{ kind: string; count: number }>
      ).map((row) => [row.kind, row.count])
    );
    for (const kind of [
      'daily_analysis',
      'weekly_analysis',
      'monthly_analysis',
      'quarterly_analysis',
      'yearly_analysis'
    ])
      expect(counts.get(kind)).toBeGreaterThan(0);
    expect(database.prepare('SELECT COUNT(*) AS count FROM ai_provider_attempts').get()).toEqual({
      count: 0
    });
    database.close();
  });

  it('missed daily and weekly runs survive restart and repeated evaluation deduplicates', () => {
    const directory = mkdtempSync(join(tmpdir(), 'focuslog-scheduler-file-'));
    directories.push(directory);
    const filename = join(directory, 'focuslog.db');
    const first = fixture(filename);
    saveSchedule(first.scheduler, first.profile.id, 'daily');
    saveSchedule(first.scheduler, first.profile.id, 'weekly');
    first.scheduler.evaluate(new Date('2026-07-23T04:00:00.000Z'));
    const countAfterFirst = (
      first.database.prepare('SELECT COUNT(*) AS count FROM ai_jobs').get() as { count: number }
    ).count;
    first.database.close();
    const second = fixture(filename);
    second.scheduler.evaluate(new Date('2026-07-23T05:00:00.000Z'));
    expect(second.database.prepare('SELECT COUNT(*) AS count FROM ai_jobs').get()).toEqual({
      count: countAfterFirst
    });
    expect(second.scheduler.get('daily')?.lastEligiblePeriodId).toBe('2026-07-22');
    expect(second.scheduler.get('weekly')?.lastEligiblePeriodId).toBe('2026-W29');
    second.database.close();
  });

  it('catch-up orders weekly children before parents and obeys the limit', () => {
    const { database, profile, scheduler } = fixture();
    saveSchedule(scheduler, profile.id, 'weekly', { catchUpLimit: 1 });
    database
      .prepare(
        "UPDATE ai_analysis_schedules SET last_eligible_period_id = '2026-W27' WHERE owner_id = 'owner' AND level = 'weekly'"
      )
      .run();
    const result = scheduler.evaluate(new Date('2026-07-28T04:00:00.000Z'));
    expect(result.limited).toBeGreaterThan(0);
    const jobs = database
      .prepare('SELECT kind FROM ai_jobs ORDER BY created_at, id')
      .all() as Array<{ kind: string }>;
    expect(jobs.slice(0, 7).every((job) => job.kind === 'daily_analysis')).toBe(true);
    expect(jobs[7]).toEqual({ kind: 'weekly_analysis' });
    database.close();
  });

  it('handles representative DST timezone schedule boundaries', () => {
    const { database, profile, scheduler } = fixture();
    saveSchedule(scheduler, profile.id, 'daily', { timezone: 'Europe/Warsaw', localTime: '03:00' });
    scheduler.evaluate(new Date('2026-03-29T01:30:00.000Z'));
    expect(scheduler.get('daily')?.lastEligiblePeriodId).toBe('2026-03-28');
    scheduler.evaluate(new Date('2026-03-30T02:30:00.000Z'));
    expect(scheduler.get('daily')?.lastEligiblePeriodId).toBe('2026-03-29');
    database.close();
  });

  it('disabled schedules and schedule kill switches do not enqueue', () => {
    const { database, profile, scheduler } = fixture();
    saveSchedule(scheduler, profile.id, 'daily', { enabled: false });
    saveSchedule(scheduler, profile.id, 'weekly', { killSwitchEnabled: true });
    scheduler.evaluate(new Date('2026-07-23T04:00:00.000Z'));
    expect(database.prepare('SELECT COUNT(*) AS count FROM ai_jobs').get()).toEqual({ count: 0 });
    expect(scheduler.get('weekly')?.diagnostic?.code).toBe('SCHEDULE_DISABLED');
    database.close();
  });

  it('manual Analyze Now supports all five levels, existing active jobs, missing dependencies, cancellation, and regeneration', () => {
    const { database, profile, queue, scheduler } = fixture();
    seedDaily(database, '2026-07-20');
    const firstDaily = scheduler.analyzeNow({
      level: 'daily',
      localAnchor: '2026-07-22',
      timezone: 'UTC',
      providerProfileId: profile.id,
      privacyMode: 'LOCAL'
    });
    const duplicateDaily = scheduler.analyzeNow({
      level: 'daily',
      localAnchor: '2026-07-22',
      timezone: 'UTC',
      providerProfileId: profile.id,
      privacyMode: 'LOCAL'
    });
    expect(duplicateDaily.job.id).toBe(firstDaily.job.id);
    expect(queue.requestCancellation(firstDaily.job.id)?.status).toBe('cancelled');
    const regenerated = scheduler.analyzeNow({
      level: 'daily',
      localAnchor: '2026-07-22',
      timezone: 'UTC',
      providerProfileId: profile.id,
      privacyMode: 'LOCAL',
      regenerate: true
    });
    expect(regenerated.job.id).not.toBe(firstDaily.job.id);
    const levels = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
    for (const level of levels) {
      const result = scheduler.analyzeNow({
        level,
        localAnchor: '2026-07-21',
        timezone: 'UTC',
        providerProfileId: profile.id,
        privacyMode: 'LOCAL'
      });
      expect(result.job.kind).toBe(`${level}_analysis`);
    }
    const weekly = scheduler.analyzeNow({
      level: 'weekly',
      localAnchor: '2026-07-21',
      timezone: 'UTC',
      providerProfileId: profile.id,
      privacyMode: 'LOCAL'
    });
    expect(weekly.missingDependencies.length).toBeGreaterThan(0);
    database.close();
  });

  it('scheduler runtime starts once, wakes on enqueue, and cleans up timers', () => {
    const { database, profile, scheduler } = fixture();
    saveSchedule(scheduler, profile.id, 'daily');
    let wakes = 0;
    const runtime = new AnalysisSchedulerRuntime(
      scheduler,
      () => {
        wakes += 1;
      },
      10,
      () => new Date('2026-07-23T04:00:00.000Z')
    );
    runtime.start();
    runtime.start();
    expect(runtime.isRunning()).toBe(true);
    expect(wakes).toBe(1);
    runtime.stop();
    runtime.stop();
    expect(runtime.isRunning()).toBe(false);
    database.close();
  });
});
