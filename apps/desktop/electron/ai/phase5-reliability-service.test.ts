import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3-multiple-ciphers';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createEncryptedArchive,
  formatRecoveryKey,
  restoreEncryptedArchive
} from '../backup/encrypted-backup.js';
import {
  latestDesktopMigrationVersion,
  migrateDesktopDatabase,
  openDesktopDatabase
} from '../database/database.js';
import { searchCheckIns } from '../database/check-in-search.js';
import { seedDesktopDatabase } from '../database/seed.js';
import { AIService } from './ai-service.js';
import { BudgetService } from './budget-service.js';
import { DesktopCredentialStore } from './credentials.js';
import { AIJobQueue } from './job-queue.js';
import { Phase5ReliabilityService } from './phase5-reliability-service.js';
import { createProviderAdapter } from './providers.js';
import type { ProviderProfile, ResolvedProviderConfig } from './types.js';

const roots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'focuslog-phase5b-'));
  roots.push(root);
  return root;
}

function dbFile(name = 'focuslog.sqlite') {
  const root = temporaryRoot();
  return { root, filename: join(root, name), key: randomBytes(32) };
}

function addOwner(database: ReturnType<typeof openDesktopDatabase>, ownerId = 'owner') {
  database
    .prepare('INSERT OR IGNORE INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run(ownerId, '2026-07-29T00:00:00.000Z', '2026-07-29T00:00:00.000Z');
}

function addLog(
  database: ReturnType<typeof openDesktopDatabase>,
  id: string,
  body = 'Representative FocusLog entry for migration and FTS reliability.'
) {
  database
    .prepare(
      `INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at)
       VALUES (?, 'owner', ?, '2026-07-29T10:00:00.000Z', 'UTC', 'v1', '2026-07-29', '2026-07-29')`
    )
    .run(id, `${id}-rev`);
  database
    .prepare(
      'INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(`${id}-rev`, id, body, `${id}-op`, '2026-07-29');
}

function aiFixture(database: ReturnType<typeof openDesktopDatabase>, root = temporaryRoot()) {
  const ai = new AIService(
    database,
    'owner',
    new DesktopCredentialStore(root, {
      isAvailable: () => true,
      protect: (value) => Buffer.from(value),
      unprotect: (value) => value.toString()
    })
  );
  ai.saveSettings({
    mode: 'CLOUD',
    maxContextTokens: 12_000,
    maxOutputTokens: 2_048,
    monthlyCloudBudgetUsd: null,
    requestCostCapUsd: null,
    dataSharingPreview: false,
    automaticAnalysis: false,
    featureFlags: { analyses: true, facts: true, graph: true, embeddings: true, playground: true }
  });
  return ai;
}

function providerConfig(): ResolvedProviderConfig {
  const profile: ProviderProfile = {
    id: 'provider-openai',
    ownerId: 'owner',
    name: 'OpenAI-compatible',
    providerId: 'openai-compatible',
    enabled: true,
    endpoint: 'https://api.example.test/v1',
    generationModel: 'model-a',
    embeddingModel: 'embed-a',
    temperature: 0.2,
    topP: 1,
    maxOutputTokens: 128,
    timeoutMs: 30_000,
    retryLimit: 0,
    concurrencyLimit: 1,
    automaticAnalysis: false,
    priority: 100,
    monthlyBudgetUsd: null,
    credentialConfigured: true,
    createdAt: '2026-07-29',
    updatedAt: '2026-07-29'
  };
  return { profile, endpoint: 'https://api.example.test/v1', apiKey: 'sk-PHASE5B_SECRET' };
}

describe('Phase 5-B migration safety and reliability fault certification', () => {
  it('audits migrations, upgrades empty and large file-backed databases, preserves FTS, and rejects newer schema versions', () => {
    const empty = dbFile('empty.sqlite');
    const emptyDb = openDesktopDatabase(empty.filename, empty.key);
    const emptyAudit = new Phase5ReliabilityService(emptyDb, 'owner').auditMigrations();
    expect(emptyAudit).toMatchObject({
      latestVersion: latestDesktopMigrationVersion,
      migrationCount: latestDesktopMigrationVersion,
      sequential: true,
      uniqueVersions: true,
      deterministicStatements: true,
      canonicalTablesProtected: true,
      findings: []
    });
    expect(emptyAudit.aiBoundaryVersions).toContain(6);
    emptyDb.close();

    const large = dbFile('large.sqlite');
    const database = openDesktopDatabase(large.filename, large.key);
    try {
      addOwner(database);
      for (let index = 0; index < 250; index += 1)
        addLog(database, `log-${index}`, `Phase 5-B reliability searchable record ${index}`);
      expect(
        searchCheckIns(database, 'owner', { query: 'searchable record 42', limit: 5 }).length
      ).toBeGreaterThan(0);
      const before = database.prepare('SELECT COUNT(*) AS count FROM check_ins').get() as {
        count: number;
      };
      expect(new Phase5ReliabilityService(database, 'owner').certifyDatabase().ok).toBe(true);
      database.close();

      const reopened = openDesktopDatabase(large.filename, large.key);
      expect(reopened.prepare('SELECT COUNT(*) AS count FROM check_ins').get()).toEqual(before);
      expect(
        searchCheckIns(reopened, 'owner', { query: 'searchable record 42', limit: 5 }).length
      ).toBeGreaterThan(0);
      reopened
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(latestDesktopMigrationVersion + 1, 'future_schema', '2026-07-29');
      reopened.close();

      expect(() => openDesktopDatabase(large.filename, large.key)).toThrow(
        'newer than this application supports'
      );
    } finally {
      if (database.open) database.close();
    }
  });

  it('keeps interrupted migrations retryable without advancing schema version or losing canonical data', () => {
    const raw = new Database(':memory:');
    expect(() =>
      migrateDesktopDatabase(raw, {
        beforeMigration: (migration) => {
          if (migration.version === 17)
            throw new Error('simulated power loss during embedding migration');
        }
      })
    ).toThrow('simulated power loss');
    const row = raw.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as {
      version: number;
    };
    expect(row.version).toBe(16);
    expect(
      raw.prepare("SELECT name FROM sqlite_master WHERE name = 'ai_vector_namespaces'").get()
    ).toBeUndefined();
    expect(() => raw.prepare('SELECT COUNT(*) FROM owners').get()).not.toThrow();
    migrateDesktopDatabase(raw);
    expect(raw.prepare('SELECT MAX(version) AS version FROM schema_migrations').get()).toEqual({
      version: latestDesktopMigrationVersion
    });
    raw.close();
  });

  it('certifies encrypted backup restore, disk preflight, derived corruption repair, and canonical log preservation', () => {
    const database = openDesktopDatabase(':memory:');
    seedDesktopDatabase(database);
    const ownerId = (database.prepare('SELECT id FROM owners LIMIT 1').get() as { id: string }).id;
    database
      .prepare(
        'INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        'canonical-log',
        ownerId,
        'canonical-rev',
        '2026-07-29T11:00:00.000Z',
        'UTC',
        'v1',
        '2026-07-29',
        '2026-07-29'
      );
    database
      .prepare(
        'INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(
        'canonical-rev',
        'canonical-log',
        'Canonical source survives derived AI repair.',
        'canonical-op',
        '2026-07-29'
      );

    const recoveryKey = randomBytes(32);
    const archive = createEncryptedArchive(database, recoveryKey);
    const restored = openDesktopDatabase(':memory:');
    restoreEncryptedArchive(restored, archive, formatRecoveryKey(recoveryKey));
    expect(
      restored.prepare('SELECT COUNT(*) AS count FROM check_ins WHERE id = ?').get('canonical-log')
    ).toEqual({ count: 1 });
    restored.close();

    const service = new Phase5ReliabilityService(database, ownerId);
    expect(service.backupPreflight(10_000_000, 1_000)).toMatchObject({ ok: false });
    expect(service.backupPreflight(10_000, 20_000_000)).toMatchObject({ ok: true });

    database
      .prepare(
        "INSERT INTO ai_provider_profiles (id, owner_id, name, provider_id, enabled, endpoint, generation_model, embedding_model, created_at, updated_at) VALUES ('profile-local', ?, 'Local', 'ollama', 1, 'http://127.0.0.1:11434', 'llama', 'embed', '2026-07-29', '2026-07-29')"
      )
      .run(ownerId);
    database
      .prepare(
        "INSERT INTO ai_vector_namespaces (id, owner_id, name, provider_profile_id, provider_id, model_id, dimensions, distance_metric, privacy_mode, privacy_class, chunking_version, chunking_schema_version, source_types_json, status, coverage_status, coverage_expected_chunks, coverage_indexed_chunks, storage_bytes, active_at, created_at, updated_at) VALUES ('namespace1', ?, 'Memory', 'profile-local', 'ollama', 'embed', 3, 'cosine', 'LOCAL', 'local', 'v1', 1, '[\"check_in_revision\"]', 'active', 'verified', 1, 1, 16, '2026-07-29', '2026-07-29', '2026-07-29')"
      )
      .run(ownerId);
    database
      .prepare(
        "INSERT INTO ai_vector_chunks (id, namespace_id, owner_id, source_type, source_id, source_revision_id, chunk_index, chunking_version, content_hash, source_hash, text_length, token_estimate, char_start, char_end, metadata_json, status, created_at, updated_at) VALUES ('chunk1', 'namespace1', ?, 'check_in_revision', 'canonical-log', 'canonical-rev', 0, 'v1', 'hash', 'source', 10, 3, 0, 10, '{}', 'embedded', '2026-07-29', '2026-07-29')"
      )
      .run(ownerId);
    database
      .prepare(
        "INSERT INTO ai_vector_records (id, namespace_id, chunk_id, owner_id, dimensions, distance_metric, vector_json, vector_hash, status, created_at, updated_at) VALUES ('vector1', 'namespace1', 'chunk1', ?, 2, 'cosine', '[0,1]', 'hash', 'active', '2026-07-29', '2026-07-29')"
      )
      .run(ownerId);
    database
      .prepare(
        "INSERT INTO ai_fact_records (id, owner_id, subject, predicate, object_value, normalized_value_json, fact_type, status, confidence, origin, schema_version, extraction_version, created_at, updated_at) VALUES ('fact1', ?, 'FocusLog', 'supports', 'repair', '{}', 'project', 'active', 0.9, 'automated', 'v1', 'v1', '2026-07-29', '2026-07-29')"
      )
      .run(ownerId);
    database
      .prepare(
        "INSERT INTO ai_fact_record_evidence (fact_id, owner_id, source_type, source_id, revision_id, evidence_hash, excerpt_redacted, created_at) VALUES ('fact1', ?, 'check_in_revision', 'canonical-log', 'missing-rev', 'hash', 'safe', '2026-07-29')"
      )
      .run(ownerId);
    database
      .prepare(
        "INSERT INTO ai_graph_entities (id, owner_id, canonical_name, node_type, normalized_name, status, confidence, origin, extraction_version, created_at, updated_at) VALUES ('entity-a', ?, 'A', 'topic', 'a', 'active', 1, 'automated', 'v1', '2026-07-29', '2026-07-29'), ('entity-b', ?, 'B', 'topic', 'b', 'active', 1, 'automated', 'v1', '2026-07-29', '2026-07-29')"
      )
      .run(ownerId, ownerId);
    database
      .prepare(
        "INSERT INTO ai_graph_relations (id, owner_id, source_entity_id, predicate, target_entity_id, status, confidence, origin, extraction_version, source_fact_id, created_at, updated_at) VALUES ('relation1', ?, 'entity-a', 'related_to', 'entity-b', 'active', 0.8, 'automated', 'v1', 'fact1', '2026-07-29', '2026-07-29')"
      )
      .run(ownerId);
    database
      .prepare(
        "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('playground-job', ?, 'daily_analysis', 'playground-job', '{}', 'leased', 1, 1, 1, 3, '2026-07-29', '2026-07-29', '2026-07-29', '2026-07-29')"
      )
      .run(ownerId);
    database
      .prepare(
        "INSERT INTO ai_playground_sessions (id, owner_id, title, status, current_branch_id, created_at, updated_at) VALUES ('session1', ?, 'Session', 'active', 'branch1', '2026-07-29', '2026-07-29')"
      )
      .run(ownerId);
    database
      .prepare(
        "INSERT INTO ai_playground_branches (id, owner_id, session_id, name, created_at) VALUES ('branch1', ?, 'session1', 'main', '2026-07-29')"
      )
      .run(ownerId);
    database
      .prepare(
        "INSERT INTO ai_playground_messages (id, owner_id, session_id, branch_id, role, content, status, created_at, updated_at) VALUES ('request1', ?, 'session1', 'branch1', 'user', 'safe', 'active', '2026-07-29', '2026-07-29')"
      )
      .run(ownerId);
    database
      .prepare(
        "INSERT INTO ai_playground_runs (id, owner_id, session_id, request_message_id, job_id, status, provider_profile_id, provider_id, model_id, parameters_json, input_snapshot_json, created_at, updated_at) VALUES ('run1', ?, 'session1', 'request1', 'playground-job', 'streaming', 'profile-local', 'ollama', 'llama', '{}', '{}', '2026-07-29', '2026-07-29')"
      )
      .run(ownerId);

    const repair = service.repairDerivedData();
    expect(repair).toMatchObject({
      failedNamespaces: 1,
      staleFacts: 1,
      unsupportedGraphRelations: 1,
      interruptedPlaygroundRuns: 1
    });
    expect(
      database.prepare("SELECT status FROM ai_vector_namespaces WHERE id = 'namespace1'").get()
    ).toEqual({ status: 'failed' });
    expect(database.prepare("SELECT status FROM ai_fact_records WHERE id = 'fact1'").get()).toEqual(
      { status: 'stale' }
    );
    expect(
      database.prepare("SELECT status FROM ai_graph_relations WHERE id = 'relation1'").get()
    ).toEqual({ status: 'unsupported' });
    expect(
      database.prepare("SELECT status FROM ai_playground_runs WHERE id = 'run1'").get()
    ).toEqual({ status: 'interrupted' });
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM check_ins WHERE id = 'canonical-log'").get()
    ).toEqual({ count: 1 });
    expect(service.certifyDiagnosticsSafe(repair)).toBe(true);
    database.close();
  });

  it('certifies queue crash recovery, stale worker rejection, idempotency, and budget recovery without duplicate final records', () => {
    const database = openDesktopDatabase(':memory:');
    addOwner(database);
    const queue = new AIJobQueue(database, 'owner');
    const job = queue.enqueue({
      kind: 'daily_analysis',
      idempotencyKey: 'daily:2026-07-29',
      payload: { day: '2026-07-29' },
      runAfter: new Date('2026-07-29T00:00:00.000Z')
    });
    expect(
      queue.enqueue({
        kind: 'daily_analysis',
        idempotencyKey: 'daily:2026-07-29',
        payload: { duplicate: true }
      }).id
    ).toBe(job.id);
    const leaseA = queue.leaseNext('runtime-a', 1, new Date('2026-07-29T00:00:00.000Z'))!;
    expect(queue.reclaimExpiredLeases(new Date('2026-07-29T00:00:01.000Z'))).toBe(1);
    const leaseB = queue.leaseNext('runtime-b', 60_000, new Date('2026-07-29T00:00:02.000Z'))!;
    expect(queue.complete(leaseA.id, 'runtime-a', leaseA.leaseToken!, 'stale-result')).toBe(false);
    expect(queue.complete(leaseB.id, 'runtime-b', leaseB.leaseToken!, 'result-1')).toBe(true);
    expect(queue.complete(leaseB.id, 'runtime-b', leaseB.leaseToken!, 'duplicate')).toBe(false);
    expect(queue.get(job.id)).toMatchObject({ status: 'succeeded', resultReference: 'result-1' });

    const budget = new BudgetService(database, 'owner');
    database
      .prepare(
        "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, schema_version, priority, attempts, max_attempts, run_after, scheduled_at, created_at, updated_at) VALUES ('budget-job', 'owner', 'daily_analysis', 'budget-job', '{}', 'queued', 1, 1, 0, 3, '2026-07-29', '2026-07-29', '2026-07-29', '2026-07-29')"
      )
      .run();
    budget.reserve('budget-job', 'attempt-1', null, 5, '2026-07', 10);
    expect(() => budget.reserve('budget-job', 'attempt-2', null, 6, '2026-07', 10)).toThrow(
      'monthly AI budget'
    );
    database
      .prepare(
        "UPDATE ai_budget_reservations SET expires_at = '2026-07-28T00:00:00.000Z' WHERE job_id = 'budget-job'"
      )
      .run();
    expect(budget.recoverInterrupted('2026-07-29T00:00:00.000Z')).toEqual({
      released: 1,
      conservativelySettled: 0
    });
    expect(budget.recoverInterrupted('2026-07-29T00:00:00.000Z')).toEqual({
      released: 0,
      conservativelySettled: 0
    });
    database.close();
  });

  it('certifies provider, network, local-model, model-list, privacy, and sanitized user recovery faults', async () => {
    const adapter = createProviderAdapter(providerConfig());
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockRejectedValueOnce(new TypeError('getaddrinfo ENOTFOUND api.example.test'));
    await expect(adapter.listModels()).rejects.toThrow(/network|provider/i);
    fetchSpy.mockResolvedValueOnce(new Response('invalid key', { status: 401 }));
    await expect(adapter.listModels()).rejects.toThrow(/invalid key|credential|provider/i);
    fetchSpy.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    await expect(adapter.listModels()).rejects.toThrow(/rate|provider/i);
    fetchSpy.mockResolvedValueOnce(new Response('<html>not json</html>', { status: 200 }));
    await expect(adapter.listModels()).rejects.toThrow('invalid JSON');
    fetchSpy.mockResolvedValueOnce(new Response('{"data":[{"id":"model-a"}]}', { status: 200 }));
    expect(await adapter.listModels()).toHaveLength(1);
    fetchSpy.mockResolvedValueOnce(new Response('{"data":[]}', { status: 200 }));
    expect(await adapter.listModels()).toEqual([]);

    const database = openDesktopDatabase(':memory:');
    addOwner(database);
    const ai = aiFixture(database);
    const cloud = ai.saveProfile({
      name: 'Cloud',
      providerId: 'openai',
      endpoint: 'https://api.openai.com/v1',
      generationModel: 'gpt-test',
      enabled: true,
      credential: 'sk-PHASE5B_SECRET'
    });
    ai.grantCloudConsent(cloud.id);
    expect(ai.requireExecution(cloud.id, 'analyses').profile.id).toBe(cloud.id);
    database
      .prepare('DELETE FROM ai_cloud_consents WHERE owner_id = ? AND provider_profile_id = ?')
      .run('owner', cloud.id);
    expect(() => ai.requireExecution(cloud.id, 'analyses')).toThrow('Cloud consent');
    ai.saveSettings({ ...ai.getSettings(), mode: 'LOCAL' });
    expect(() => ai.requireExecution(cloud.id, 'analyses')).toThrow('Local privacy mode');

    const reliability = new Phase5ReliabilityService(database, 'owner');
    const message = reliability.recoveryMessage(
      'PROVIDER_FAULT',
      'Authorization: Bearer SECRET_TOKEN api_key=sk-PHASE5B_SECRET timeout after malformed stream'
    );
    expect(message).toMatchObject({ retryAppropriate: true });
    expect(JSON.stringify(message)).not.toMatch(/SECRET_TOKEN|PHASE5B_SECRET|api_key=sk-/u);
    expect(reliability.recoveryMessage('DB_LOCKED', 'database is locked')).toMatchObject({
      nextAction: expect.stringContaining('retry')
    });
    expect(reliability.recoveryMessage('DISK_FULL', 'disk full')).toMatchObject({
      title: 'Not enough disk space'
    });
    database.close();
  });
});
