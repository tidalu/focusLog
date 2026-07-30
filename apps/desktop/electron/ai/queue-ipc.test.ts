import { describe, expect, it } from 'vitest';
import { openDesktopDatabase } from '../database/database.js';
import { AIJobQueue } from './job-queue.js';
import { AIJobWorker } from './job-worker.js';
import { QueueReadService } from './queue-read-service.js';
import { registerAIQueueIpcHandlers } from './queue-ipc.js';
import { AICapacityController } from './capacity-controller.js';
import { AnalysisSchedulerService } from './analysis-scheduler.js';
import { AnalysisReadService } from './analysis-read-service.js';
import { AIService } from './ai-service.js';
import { AnalysisService } from './analysis-service.js';
import { DesktopCredentialStore } from './credentials.js';

describe('production queue IPC registration', () => {
  it('registers and invokes the production-safe queue handlers', async () => {
    const database = openDesktopDatabase(':memory:');
    database
      .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('owner', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    database
      .prepare(
        "INSERT INTO ai_provider_profiles (id, owner_id, name, provider_id, enabled, generation_model, created_at, updated_at) VALUES ('profile','owner','Local','ollama',1,'qwen','2026-01-01','2026-01-01')"
      )
      .run();
    database
      .prepare(
        "INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES ('check','owner','rev','2026-07-21T10:00:00.000Z','UTC','v1','2026-07-21','2026-07-21')"
      )
      .run();
    database
      .prepare(
        "INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES ('rev','check','SECRET_RAW_PROVIDER_RESPONSE should not leave payloads','op','2026-07-21')"
      )
      .run();
    const ai = new AIService(
      database,
      'owner',
      new DesktopCredentialStore(process.cwd(), {
        isAvailable: () => true,
        protect: (text) => Buffer.from(text),
        unprotect: (value) => value.toString()
      })
    );
    ai.saveSettings({ ...ai.getSettings(), mode: 'LOCAL' });
    const analysis = new AnalysisService(database, 'owner', ai);
    const queue = new AIJobQueue(database, 'owner');
    const worker = new AIJobWorker(queue, {}, { pollIntervalMs: 1000 });
    const read = new QueueReadService(database, 'owner');
    const scheduler = new AnalysisSchedulerService(
      database,
      'owner',
      ai,
      analysis,
      undefined,
      queue
    );
    const analysisRead = new AnalysisReadService(database, 'owner');
    const handlers = new Map<string, (_event: unknown, ...args: unknown[]) => unknown>();
    registerAIQueueIpcHandlers({
      ipcMain: {
        handle: (name, handler) => {
          if (handlers.has(name)) throw new Error('duplicate');
          handlers.set(name, handler);
        }
      },
      ai,
      analysis,
      queue,
      worker,
      read,
      database,
      ownerId: 'owner',
      capacity: new AICapacityController(2),
      scheduler,
      analysisRead
    });
    const job = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'ipc-secret-FOCUSLOG_TEST_API_KEY_DO_NOT_EXPOSE',
      payload: { raw: 'SECRET_RAW_PROMPT_VALUE' }
    });
    expect(await handlers.get('focuslog:ai-queue-counts')!(null)).toMatchObject({ queued: 1 });
    const jobs = (await handlers.get('focuslog:ai-queue-jobs')!(null, { limit: 10 })) as unknown;
    expect(JSON.stringify(jobs)).not.toContain('SECRET_RAW_PROMPT_VALUE');
    expect(JSON.stringify(jobs)).not.toContain('FOCUSLOG_TEST_API_KEY_DO_NOT_EXPOSE');
    expect(() => handlers.get('focuslog:ai-queue-job')!(null, 'bad')).toThrow('valid AI job');
    expect(await handlers.get('focuslog:cancel-ai-job')!(null, job.id)).toMatchObject({
      status: 'cancelled'
    });
    expect(await handlers.get('focuslog:ai-budget-summary')!(null, '2026-07')).toMatchObject({
      currency: 'USD',
      settledMicros: '0',
      reservedMicros: '0'
    });
    expect(await handlers.get('focuslog:ai-concurrency')!(null)).toMatchObject({
      globalLimit: 2,
      active: 0
    });
    expect(
      await handlers.get('focuslog:set-ai-kill-switch')!(null, {
        scope: 'global',
        targetId: '',
        enabled: true
      })
    ).toEqual([{ scope: 'global', targetId: '', enabled: true, reason: null }]);
    expect(() =>
      handlers.get('focuslog:set-ai-kill-switch')!(null, {
        scope: 'provider',
        targetId: 'other-owner',
        enabled: true
      })
    ).toThrow('target');
    const schedule = (await handlers.get('focuslog:save-ai-analysis-schedule')!(null, {
      level: 'daily',
      enabled: true,
      localTime: '03:00',
      timezone: 'UTC',
      providerProfileId: 'profile',
      privacyMode: 'LOCAL',
      maxCostMicros: '42',
      killSwitchEnabled: true
    })) as unknown;
    expect(schedule).toMatchObject({
      level: 'daily',
      maxCostMicros: '42',
      killSwitchEnabled: true
    });
    expect(await handlers.get('focuslog:ai-analysis-schedules')!(null)).toEqual([
      expect.objectContaining({ level: 'daily', maxCostMicros: '42' })
    ]);
    const manual = (await handlers.get('focuslog:analyze-now')!(null, {
      level: 'daily',
      localAnchor: '2026-07-21',
      timezone: 'UTC',
      providerProfileId: 'profile',
      privacyMode: 'LOCAL',
      maxCostMicros: '42'
    })) as { job: { id: string; kind: string } };
    expect(manual.job).toMatchObject({ kind: 'daily_analysis' });
    expect(() => handlers.get('focuslog:analyze-now')!(null, { level: 'bad' })).toThrow(
      'valid analysis level'
    );
    expect(await handlers.get('focuslog:ai-scheduler-status')!(null)).toMatchObject({
      schedules: 1
    });
    expect(() => handlers.get('focuslog:ai-analysis-result')!(null, 'bad')).toThrow(
      'valid analysis result'
    );
    expect(
      JSON.stringify(await handlers.get('focuslog:ai-analysis-versions')!(null, { level: 'daily' }))
    ).not.toContain('SECRET_RAW_PROVIDER_RESPONSE');
    database.close();
  });
});
