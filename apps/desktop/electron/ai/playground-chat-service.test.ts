import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { openDesktopDatabase, type DesktopDatabase } from '../database/database.js';
import { AIService } from './ai-service.js';
import { DesktopCredentialStore } from './credentials.js';
import { AIError } from './errors.js';
import { ExecutionPolicyService } from './execution-policy-service.js';
import {
  PlaygroundChatService,
  type PlaygroundProviderInvoker
} from './playground-chat-service.js';
import type { GenerationResult } from './types.js';

const roots: string[] = [];
const DATABASE_KEY = Buffer.alloc(32, 7);

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(invoke?: PlaygroundProviderInvoker, fileBacked = false) {
  const root = mkdtempSync(join(tmpdir(), 'focuslog-playground-chat-'));
  roots.push(root);
  const databasePath = fileBacked ? join(root, 'focuslog.sqlite') : ':memory:';
  const database = openDesktopDatabase(databasePath, fileBacked ? DATABASE_KEY : undefined);
  seedOwner(database, 'owner');
  seedOwner(database, 'other');
  const credentialReads: string[] = [];
  const ai = new AIService(
    database,
    'owner',
    new DesktopCredentialStore(root, {
      isAvailable: () => true,
      protect: (value) => Buffer.from(value),
      unprotect: (value) => {
        credentialReads.push(value.toString());
        return value.toString();
      }
    })
  );
  ai.saveSettings({
    mode: 'LOCAL',
    maxContextTokens: 12_000,
    maxOutputTokens: 2_048,
    monthlyCloudBudgetUsd: null,
    requestCostCapUsd: null,
    dataSharingPreview: false,
    automaticAnalysis: false,
    featureFlags: { analyses: true, facts: true, graph: true, embeddings: true, playground: true }
  });
  const profile = ai.saveProfile({
    name: 'Local Playground',
    providerId: 'ollama',
    endpoint: 'http://127.0.0.1:11434',
    generationModel: 'llama3.1',
    enabled: true
  });
  const service = new PlaygroundChatService(database, 'owner', ai, invoke ?? successInvoker());
  return { root, databasePath, database, ai, profile, service, credentialReads };
}

function seedOwner(database: DesktopDatabase, ownerId: string): void {
  database
    .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run(ownerId, '2026-07-29T00:00:00.000Z', '2026-07-29T00:00:00.000Z');
}

function successInvoker(text = 'Playground answer.'): PlaygroundProviderInvoker {
  return async (_entry, _signal, context): Promise<GenerationResult> => {
    context.onChunk('Playground ');
    context.onChunk('answer.');
    return {
      text,
      finishReason: 'STOP',
      usage: { inputTokens: 7, outputTokens: 3, totalTokens: 10, reported: true }
    };
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

describe('Playground persistent chat service', () => {
  it('persists chat runs through the coordinator without entering production memory tables', async () => {
    const { database, profile, service } = fixture();
    const run = await service.sendMessage({
      content: 'Keep this Playground-only.',
      providerProfileId: profile.id,
      stream: true
    });
    expect(run).toMatchObject({
      status: 'succeeded',
      outputText: 'Playground answer.',
      inputTokens: 7,
      outputTokens: 3,
      totalTokens: 10
    });
    const session = service.getSession(run.sessionId);
    expect(session.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(database.prepare('SELECT COUNT(*) AS count FROM ai_analysis_results').get()).toEqual({
      count: 0
    });
    expect(database.prepare('SELECT COUNT(*) AS count FROM ai_fact_records').get()).toEqual({
      count: 0
    });
    expect(database.prepare('SELECT COUNT(*) AS count FROM ai_graph_entities').get()).toEqual({
      count: 0
    });
    expect(
      database
        .prepare(
          "SELECT COUNT(*) AS count FROM ai_vector_chunks WHERE source_type <> 'check_in_revision'"
        )
        .get()
    ).toEqual({ count: 0 });
    expect(
      database
        .prepare(
          "SELECT COUNT(*) AS count FROM ai_usage_records WHERE purpose = 'playground_chat' AND outcome = 'SUCCESS'"
        )
        .get()
    ).toEqual({ count: 1 });
    database.close();
  });

  it('supports session rename archive duplicate branch regenerate edit-resend retry and safe export metadata', async () => {
    const { database, profile, service } = fixture();
    const first = await service.sendMessage({ content: 'Original', providerProfileId: profile.id });
    const renamed = service.renameSession(first.sessionId, 'Exploration');
    expect(renamed.title).toBe('Exploration');
    const branched = service.branchFromMessage(first.sessionId, renamed.messages[0]!.id, 'What if');
    expect(branched.currentBranchId).not.toBe(renamed.currentBranchId);
    const edited = await service.editAndResend({
      sessionId: first.sessionId,
      messageId: renamed.messages[0]!.id,
      content: 'Edited',
      providerProfileId: profile.id
    });
    expect(edited.status).toBe('succeeded');
    const regenerated = await service.regenerate(first.id);
    expect(regenerated.status).toBe('succeeded');
    const retry = await service.retryWithModel(first.id, profile.id, 'llama3.2');
    expect(retry.modelId).toBe('llama3.2');
    const duplicate = service.duplicateSession(first.sessionId, 'Exploration copy');
    expect(duplicate.messages.length).toBeGreaterThan(0);
    expect(service.archiveSession(duplicate.id).status).toBe('archived');
    const exported = service.safeExportSession(first.sessionId);
    expect(JSON.stringify(exported)).toContain('focuslog.playground.session.v1');
    expect(JSON.stringify(exported)).not.toContain('sk-');
    database.close();
  });

  it('records coordinator fallback disclosure without treating policy-free fallback as production memory', async () => {
    const { database, ai, profile, service } = fixture(async (entry) => {
      if (entry.providerProfileId === profile.id)
        throw new AIError('PROVIDER_UNAVAILABLE', 'Primary unavailable.', true);
      return {
        text: 'Fallback answer.',
        finishReason: 'STOP',
        usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9, reported: true }
      };
    });
    ai.saveProfile({
      id: profile.id,
      name: profile.name,
      providerId: profile.providerId,
      endpoint: profile.endpoint,
      generationModel: profile.generationModel,
      enabled: true,
      retryLimit: 0
    });
    const fallback = ai.saveProfile({
      name: 'Local fallback',
      providerId: 'lm-studio',
      endpoint: 'http://127.0.0.1:1234/v1',
      generationModel: 'local-fallback',
      enabled: true,
      retryLimit: 0
    });
    const run = await service.sendMessage({
      content: 'Try fallback.',
      providerProfileId: profile.id,
      fallbackEntries: [{ providerProfileId: fallback.id }]
    });
    expect(run).toMatchObject({
      status: 'succeeded',
      providerProfileId: fallback.id,
      modelId: 'local-fallback',
      fallbackUsed: true,
      outputText: 'Fallback answer.'
    });
    expect(
      database
        .prepare(
          'SELECT COUNT(*) AS count FROM ai_provider_attempts WHERE job_id = (SELECT job_id FROM ai_playground_runs WHERE id = ?)'
        )
        .get(run.id)
    ).toEqual({ count: 2 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM ai_fact_records').get()).toEqual({
      count: 0
    });
    database.close();
  });

  it('cancels streaming runs, preserves partial state, and rejects late completion', async () => {
    const release = deferred<GenerationResult>();
    const started = deferred<void>();
    let observedAbort = false;
    const invoke: PlaygroundProviderInvoker = async (_entry, signal, context) => {
      context.onChunk('partial ');
      started.resolve();
      signal?.addEventListener('abort', () => {
        observedAbort = true;
      });
      return release.promise;
    };
    const { database, profile, service } = fixture(invoke);
    const running = service.sendMessage({
      content: 'Stream then stop',
      providerProfileId: profile.id,
      stream: true
    });
    await started.promise;
    const activeRun = database
      .prepare("SELECT id FROM ai_playground_runs WHERE status = 'streaming'")
      .get() as { id: string };
    const cancelled = service.stopRun(activeRun.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.partialOutputText).toBe('partial ');
    expect(observedAbort).toBe(true);
    release.resolve({
      text: 'late success',
      finishReason: 'STOP',
      usage: { reported: true, inputTokens: 1, outputTokens: 1, totalTokens: 2 }
    });
    const completed = await running;
    expect(completed.status).toBe('cancelled');
    expect(service.inspectRun(activeRun.id).outputText).toBeNull();
    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM ai_usage_records WHERE purpose = 'playground_chat'")
        .get()
    ).toEqual({ count: 0 });
    database.close();
  });

  it('reconciles interrupted file-backed runs on startup without replaying the provider', async () => {
    const first = fixture(successInvoker(), true);
    const session = first.service.createSession('Interrupted');
    const timestamp = new Date().toISOString();
    const requestId = 'request-interrupted';
    const assistantId = 'assistant-interrupted';
    const runId = 'run-interrupted';
    const jobId = 'job-interrupted';
    first.database.transaction(() => {
      first.database
        .prepare(
          `INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, attempts, run_after, created_at, updated_at, schema_version, priority, max_attempts, started_at, requested_profile_id, requested_model_id, privacy_mode, parameters_json) VALUES (?, 'owner', 'playground_chat', ?, ?, 'leased', 1, ?, ?, ?, 1, 100, 1, ?, ?, ?, 'LOCAL', '{}')`
        )
        .run(
          jobId,
          `playground:${runId}`,
          JSON.stringify({ playgroundRunId: runId }),
          timestamp,
          timestamp,
          timestamp,
          timestamp,
          first.profile.id,
          first.profile.generationModel
        );
      first.database
        .prepare(
          "INSERT INTO ai_playground_messages (id, owner_id, session_id, branch_id, role, content, status, created_at, updated_at) VALUES (?, 'owner', ?, ?, 'user', 'Crash boundary', 'active', ?, ?)"
        )
        .run(requestId, session.id, session.currentBranchId, timestamp, timestamp);
      first.database
        .prepare(
          "INSERT INTO ai_playground_messages (id, owner_id, session_id, branch_id, parent_message_id, role, content, status, run_id, created_at, updated_at) VALUES (?, 'owner', ?, ?, ?, 'assistant', '', 'active', ?, ?, ?)"
        )
        .run(
          assistantId,
          session.id,
          session.currentBranchId,
          requestId,
          runId,
          timestamp,
          timestamp
        );
      first.database
        .prepare(
          `INSERT INTO ai_playground_runs (id, owner_id, session_id, request_message_id, assistant_message_id, job_id, status, provider_profile_id, provider_id, model_id, parameters_json, input_snapshot_json, partial_output_text, started_at, created_at, updated_at) VALUES (?, 'owner', ?, ?, ?, ?, 'streaming', ?, ?, ?, '{}', '{}', 'persisted partial', ?, ?, ?)`
        )
        .run(
          runId,
          session.id,
          requestId,
          assistantId,
          jobId,
          first.profile.id,
          first.profile.providerId,
          first.profile.generationModel,
          timestamp,
          timestamp,
          timestamp
        );
    })();
    first.database.close();
    const reopened = openDesktopDatabase(first.databasePath, DATABASE_KEY);
    const ai = new AIService(
      reopened,
      'owner',
      new DesktopCredentialStore(first.root, {
        isAvailable: () => true,
        protect: (value) => Buffer.from(value),
        unprotect: (value) => value.toString()
      })
    );
    const recovered = new PlaygroundChatService(
      reopened,
      'owner',
      ai,
      successInvoker('should not replay')
    );
    expect(recovered.reconcileStartup()).toBe(1);
    expect(recovered.inspectRun(runId)).toMatchObject({
      status: 'interrupted',
      partialOutputText: 'persisted partial',
      stopReason: 'process_restarted'
    });
    expect(
      reopened
        .prepare("SELECT COUNT(*) AS count FROM ai_usage_records WHERE purpose = 'playground_chat'")
        .get()
    ).toEqual({ count: 0 });
    reopened.close();
  });

  it('enforces Playground kill switch and provider policy before credential/provider access', async () => {
    const { database, ai, credentialReads } = fixture(async () => {
      throw new Error('provider should not run');
    });
    ai.saveSettings({
      ...ai.getSettings(),
      mode: 'CLOUD',
      featureFlags: { ...ai.getSettings().featureFlags, playground: true }
    });
    const cloud = ai.saveProfile({
      name: 'Cloud',
      providerId: 'openai',
      endpoint: 'https://api.openai.com/v1',
      generationModel: 'gpt-5-mini',
      enabled: true,
      credential: 'sk-PHASE4A_SECRET'
    });
    new ExecutionPolicyService(database, 'owner').set(
      'provider',
      cloud.id,
      true,
      'maintenance sk-PHASE4A_SECRET'
    );
    const service = new PlaygroundChatService(database, 'owner', ai, async () => {
      throw new Error('provider should not run');
    });
    await expect(
      service.sendMessage({ content: 'Blocked', providerProfileId: cloud.id })
    ).rejects.toThrow('disabled by policy');
    expect(credentialReads).toEqual([]);
    ai.saveSettings({
      ...ai.getSettings(),
      featureFlags: { ...ai.getSettings().featureFlags, playground: false }
    });
    await expect(
      service.sendMessage({ content: 'Blocked by playground switch', providerProfileId: cloud.id })
    ).rejects.toThrow('Playground execution is disabled');
    expect(JSON.stringify(service.listSessions())).not.toContain('sk-PHASE4A_SECRET');
    database.close();
  });

  it('rejects cross-owner reads and deletes only Playground records', async () => {
    const { database, profile, service } = fixture();
    const run = await service.sendMessage({
      content: 'Owner-only chat',
      providerProfileId: profile.id
    });
    database
      .prepare(
        `INSERT INTO ai_analysis_results
      (id, owner_id, level, period_id, timezone_id, local_start, local_end, period_start_utc, period_end_utc, boundary_policy_version, version, status, source_revision_hash, statistics_json, structured_result_json, readable_summary, prompt_id, prompt_version, schema_version, generation_metadata_json, created_at, updated_at)
      VALUES ('analysis', 'owner', 'daily', '2026-07-29', 'UTC', '2026-07-29', '2026-07-30', '2026-07-29T00:00:00.000Z', '2026-07-30T00:00:00.000Z', 'v1', 1, 'current', 'hash', '{}', '{}', 'Production stays.', 'daily', '1', '1', '{}', '2026-07-29', '2026-07-29')`
      )
      .run();
    const other = new PlaygroundChatService(
      database,
      'other',
      new AIService(
        database,
        'other',
        new DesktopCredentialStore(roots[0]!, {
          isAvailable: () => true,
          protect: (value) => Buffer.from(value),
          unprotect: (value) => value.toString()
        })
      )
    );
    expect(() => other.getSession(run.sessionId)).toThrow('unavailable');
    expect(() => other.inspectRun(run.id)).toThrow('unavailable');
    service.deleteSession(run.sessionId);
    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM ai_playground_sessions WHERE status = 'deleted'")
        .get()
    ).toEqual({ count: 1 });
    expect(
      database
        .prepare("SELECT readable_summary FROM ai_analysis_results WHERE id = 'analysis'")
        .get()
    ).toEqual({ readable_summary: 'Production stays.' });
    database.close();
  });
});
