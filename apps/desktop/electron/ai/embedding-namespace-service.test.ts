import Database from 'better-sqlite3-multiple-ciphers';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { openDesktopDatabase, migrateDesktopDatabase } from '../database/database.js';
import { desktopMigrations } from '../database/migrations.js';
import { AIService } from './ai-service.js';
import { DesktopCredentialStore } from './credentials.js';
import { chunkEmbeddingSource, EMBEDDING_CHUNKING_POLICY_V1 } from './embedding-chunking.js';
import { EmbeddingNamespaceService } from './embedding-namespace-service.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function historical(version: number): Database.Database {
  const database = new Database(':memory:');
  database.exec(
    'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)'
  );
  for (const migration of desktopMigrations.filter((item) => item.version <= version)) {
    for (const statement of migration.statements) database.exec(statement);
    database
      .prepare('INSERT INTO schema_migrations VALUES (?, ?, ?)')
      .run(migration.version, migration.name, '2026-01-01T00:00:00.000Z');
  }
  return database;
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'focuslog-embeddings-'));
  roots.push(root);
  const database = openDesktopDatabase(':memory:');
  database
    .prepare(
      "INSERT INTO owners (id, created_at, updated_at) VALUES ('owner', '2026-01-01', '2026-01-01')"
    )
    .run();
  const ai = new AIService(
    database,
    'owner',
    new DesktopCredentialStore(root, {
      isAvailable: () => true,
      protect: (value) => Buffer.from(value),
      unprotect: (value) => value.toString()
    })
  );
  const local = ai.saveProfile({
    name: 'Local embeddings',
    providerId: 'ollama',
    endpoint: 'http://127.0.0.1:11434',
    embeddingModel: 'nomic-embed-text',
    enabled: true
  });
  const cloud = ai.saveProfile({
    name: 'Cloud embeddings',
    providerId: 'openai',
    endpoint: 'https://api.openai.com',
    embeddingModel: 'text-embedding-3-small',
    enabled: true,
    credential: 'PHASE3_SECRET_API_KEY'
  });
  ai.saveSettings({
    ...ai.getSettings(),
    mode: 'LOCAL',
    featureFlags: { ...ai.getSettings().featureFlags, embeddings: true }
  });
  const service = new EmbeddingNamespaceService(database, 'owner', ai);
  return { database, ai, local, cloud, service };
}

describe('embedding chunking and namespace lifecycle', () => {
  it('creates deterministic chunk IDs and hashes', () => {
    const source = {
      sourceType: 'check_in_revision' as const,
      sourceId: 'check',
      sourceRevisionId: 'rev',
      text: 'A'.repeat(4_000),
      metadata: { submittedAt: '2026-01-01' }
    };
    const first = chunkEmbeddingSource('namespace', source, EMBEDDING_CHUNKING_POLICY_V1);
    const second = chunkEmbeddingSource('namespace', source, EMBEDDING_CHUNKING_POLICY_V1);
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(1);
    expect(first[0]?.id).toMatch(/^chunk_/u);
    expect(first[0]?.contentHash).toHaveLength(64);
    expect(chunkEmbeddingSource('namespace', { ...source, text: 'short log' })).toHaveLength(1);
  });

  it('initializes embedding lifecycle tables on fresh and upgraded databases', () => {
    const fresh = openDesktopDatabase(':memory:');
    expect(
      fresh.prepare("SELECT name FROM sqlite_master WHERE name = 'ai_vector_namespaces'").get()
    ).toBeTruthy();
    fresh.close();
    const upgraded = historical(16);
    upgraded.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    migrateDesktopDatabase(upgraded);
    expect(
      upgraded.prepare("SELECT name FROM sqlite_master WHERE name = 'ai_vector_chunks'").get()
    ).toBeTruthy();
    expect(
      upgraded
        .prepare("SELECT name FROM sqlite_master WHERE name = 'ai_embedding_namespaces'")
        .get()
    ).toBeTruthy();
    upgraded.close();
  });

  it('rejects incompatible dimensions and keeps the old active namespace during incomplete rebuild', () => {
    const { database, local, service } = fixture();
    const active = service.create({
      name: 'journal-search',
      providerProfileId: local.id,
      dimensions: 3,
      sourceTypes: ['check_in_revision']
    });
    const chunks = service.upsertChunks(active.id, [
      {
        sourceType: 'check_in_revision',
        sourceId: 'check',
        sourceRevisionId: 'rev',
        text: 'Focused coding session.'
      }
    ]);
    expect(() =>
      service.storeVectors(active.id, [{ chunkId: chunks[0]!.id, vector: [0.1, 0.2] }])
    ).toThrow('dimensions');
    service.storeVectors(active.id, [{ chunkId: chunks[0]!.id, vector: [0.1, 0.2, 0.3] }]);
    expect(service.activate(active.id).status).toBe('active');
    const replacement = service.rebuild(active.id);
    service.upsertChunks(replacement.id, [
      {
        sourceType: 'check_in_revision',
        sourceId: 'check',
        sourceRevisionId: 'rev2',
        text: 'Replacement text.'
      }
    ]);
    expect(() => service.activate(replacement.id)).toThrow('coverage');
    expect(service.inspect(active.id).status).toBe('active');
    database.close();
  });

  it('valid coverage activates atomically and deprecates the prior active namespace', () => {
    const { database, local, service } = fixture();
    const first = service.create({
      name: 'journal-search',
      providerProfileId: local.id,
      dimensions: 2
    });
    let chunks = service.upsertChunks(first.id, [
      {
        sourceType: 'check_in_revision',
        sourceId: 'check-1',
        sourceRevisionId: 'rev-1',
        text: 'First namespace.'
      }
    ]);
    service.storeVectors(first.id, [{ chunkId: chunks[0]!.id, vector: [1, 0] }]);
    service.activate(first.id);
    const next = service.rebuild(first.id);
    chunks = service.upsertChunks(next.id, [
      {
        sourceType: 'check_in_revision',
        sourceId: 'check-1',
        sourceRevisionId: 'rev-2',
        text: 'Second namespace.'
      }
    ]);
    service.storeVectors(next.id, [{ chunkId: chunks[0]!.id, vector: [0, 1] }]);
    const activated = service.activate(next.id);
    expect(activated.status).toBe('active');
    expect(service.inspect(first.id)).toMatchObject({
      status: 'deprecated',
      replacementNamespaceId: next.id
    });
    expect(
      service.list().filter((item) => item.name === 'journal-search' && item.status === 'active')
    ).toHaveLength(1);
    database.close();
  });

  it('deletes only derived namespace data and preserves canonical logs', () => {
    const { database, local, service } = fixture();
    database
      .prepare(
        "INSERT INTO check_ins (id, owner_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES ('check', 'owner', '2026-01-01', 'UTC', 'v1', '2026-01-01', '2026-01-01')"
      )
      .run();
    const namespace = service.create({
      name: 'delete-me',
      providerProfileId: local.id,
      dimensions: 2
    });
    const chunks = service.upsertChunks(namespace.id, [
      {
        sourceType: 'check_in_revision',
        sourceId: 'check',
        sourceRevisionId: 'rev',
        text: 'Canonical log remains.'
      }
    ]);
    service.storeVectors(namespace.id, [{ chunkId: chunks[0]!.id, vector: [0.4, 0.6] }]);
    service.delete(namespace.id);
    expect(database.prepare("SELECT id FROM check_ins WHERE id = 'check'").get()).toEqual({
      id: 'check'
    });
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM ai_vector_chunks WHERE namespace_id = ?')
        .get(namespace.id)
    ).toEqual({ count: 0 });
    expect(() => service.inspect(namespace.id)).toThrow('unavailable');
    database.close();
  });

  it('enforces Local mode and cloud consent for embedding namespaces', () => {
    const { database, ai, cloud, service } = fixture();
    expect(() =>
      service.create({ name: 'cloud-blocked-local', providerProfileId: cloud.id, dimensions: 3 })
    ).toThrow('Local privacy');
    ai.saveSettings({ ...ai.getSettings(), mode: 'CLOUD' });
    expect(() =>
      service.create({ name: 'cloud-needs-consent', providerProfileId: cloud.id, dimensions: 3 })
    ).toThrow('Cloud consent');
    ai.grantCloudConsent(cloud.id);
    expect(
      service.create({ name: 'cloud-ok', providerProfileId: cloud.id, dimensions: 3 })
    ).toMatchObject({ privacyClass: 'cloud', modelId: 'text-embedding-3-small' });
    database.close();
  });

  it('returns safe projections without vectors, text, credentials, or ownership tokens', () => {
    const { database, local, service } = fixture();
    const namespace = service.create({
      name: 'safe-projection',
      providerProfileId: local.id,
      dimensions: 2
    });
    const chunks = service.upsertChunks(namespace.id, [
      {
        sourceType: 'check_in_revision',
        sourceId: 'check',
        sourceRevisionId: 'rev',
        text: 'PHASE3_RAW_TEXT_SHOULD_NOT_LEAK'
      }
    ]);
    service.storeVectors(namespace.id, [{ chunkId: chunks[0]!.id, vector: [0.1, 0.9] }]);
    const serialized = JSON.stringify(service.inspect(namespace.id));
    expect(serialized).toContain('"storageBytes"');
    expect(serialized).not.toContain('PHASE3_RAW_TEXT_SHOULD_NOT_LEAK');
    expect(serialized).not.toContain('PHASE3_SECRET_API_KEY');
    expect(serialized).not.toContain('vector_json');
    expect(serialized).not.toContain('lease_token');
    database.close();
  });
});
