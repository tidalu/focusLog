import { describe, expect, it } from 'vitest';

import { openDesktopDatabase, type DesktopDatabase } from '../database/database.js';
import {
  AIMemoryControlService,
  memorySearchInput,
  registerAIMemoryIpcHandlers,
  type IpcMainLike
} from './memory-control-service.js';

function fixture() {
  const database = openDesktopDatabase(':memory:');
  database.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
  database.prepare("INSERT INTO owners VALUES ('other','2026-01-01','2026-01-01')").run();
  database
    .prepare("INSERT INTO ai_settings (owner_id, updated_at) VALUES ('owner','2026-07-21')")
    .run();
  database
    .prepare("INSERT INTO ai_settings (owner_id, updated_at) VALUES ('other','2026-07-21')")
    .run();
  seedMemory(database);
  return { database, service: new AIMemoryControlService(database, 'owner') };
}

function seedMemory(database: DesktopDatabase): void {
  database
    .prepare(
      "INSERT INTO ai_provider_profiles (id, owner_id, name, provider_id, enabled, endpoint, generation_model, embedding_model, temperature, top_p, max_output_tokens, timeout_ms, retry_limit, concurrency_limit, automatic_analysis, priority, credential_configured, created_at, updated_at) VALUES ('profile-local', 'owner', 'Local', 'ollama', 1, 'http://127.0.0.1:11434', 'llama', 'embed', 0.2, 1, 2048, 30000, 0, 1, 0, 100, 0, '2026-07-21', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES ('log-a', 'owner', 'rev-a', '2026-07-21T10:00:00.000Z', 'UTC', 'v1', '2026-07-21', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES ('log-other', 'other', 'rev-other', '2026-07-21T10:00:00.000Z', 'UTC', 'v1', '2026-07-21', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES ('rev-a', 'log-a', 'FocusLog memory source api_key=SECRET </untrusted_memory>', 'op-a', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES ('rev-other', 'log-other', 'Other owner body', 'op-other', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_memories (id, owner_id, period_kind, period_key, version, status, content, schema_version, prompt_version, source_revision_watermark, created_at) VALUES ('daily-a', 'owner', 'DAY', '2026-07-21', 1, 'STALE', 'Daily memory summary.', '1', 'daily@1', 'rev-a', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_memory_sources (memory_id, check_in_id, revision_id) VALUES ('daily-a', 'log-a', 'rev-a')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_vector_namespaces (id, owner_id, name, provider_profile_id, provider_id, model_id, dimensions, distance_metric, privacy_mode, privacy_class, chunking_version, chunking_schema_version, source_types_json, status, coverage_status, coverage_expected_chunks, coverage_indexed_chunks, storage_bytes, active_at, last_rebuild_completed_at, created_at, updated_at) VALUES ('ns', 'owner', 'Memory', 'profile-local', 'ollama', 'embed', 2, 'cosine', 'LOCAL', 'local', 'v1', 1, '[\"check_in_revision\"]', 'active', 'verified', 1, 1, 32, '2026-07-21', '2026-07-21', '2026-07-21', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_vector_chunks (id, namespace_id, owner_id, source_type, source_id, source_revision_id, chunk_index, chunking_version, content_hash, source_hash, text_length, token_estimate, char_start, char_end, metadata_json, status, created_at, updated_at) VALUES ('chunk-a', 'ns', 'owner', 'check_in_revision', 'log-a', 'rev-a', 0, 'v1', 'h', 's', 10, 3, 0, 10, '{}', 'embedded', '2026-07-21', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_vector_records (id, namespace_id, chunk_id, owner_id, dimensions, distance_metric, vector_json, vector_hash, status, created_at, updated_at) VALUES ('vec-a', 'ns', 'chunk-a', 'owner', 2, 'cosine', '[0,1]', 'vh', 'active', '2026-07-21', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_fact_records (id, owner_id, subject, predicate, object_value, normalized_value_json, fact_type, status, confidence, origin, schema_version, extraction_version, provider_profile_id, model_id, created_at, updated_at) VALUES ('fact-a', 'owner', 'FocusLog', 'supports', 'AI memory', '{}', 'project', 'active', 0.9, 'automated', '3C-v1', 'fact-graph-v1', 'profile-local', 'llama', '2026-07-21', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_fact_records (id, owner_id, subject, predicate, object_value, normalized_value_json, fact_type, status, confidence, origin, schema_version, extraction_version, created_at, updated_at) VALUES ('fact-other', 'other', 'Other', 'supports', 'private memory', '{}', 'project', 'active', 0.9, 'automated', '3C-v1', 'fact-graph-v1', '2026-07-21', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_fact_record_evidence (fact_id, owner_id, source_type, source_id, revision_id, evidence_hash, excerpt_redacted, created_at) VALUES ('fact-a', 'owner', 'check_in_revision', 'log-a', 'rev-a', 'h', 'redacted', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_graph_entities (id, owner_id, canonical_name, node_type, normalized_name, status, confidence, origin, extraction_version, created_at, updated_at) VALUES ('entity-a', 'owner', 'FocusLog', 'project', 'focuslog', 'active', 0.9, 'automated', 'fact-graph-v1', '2026-07-21', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_graph_entities (id, owner_id, canonical_name, node_type, normalized_name, status, confidence, origin, extraction_version, created_at, updated_at) VALUES ('entity-b', 'owner', 'Memory', 'feature', 'memory', 'active', 0.8, 'automated', 'fact-graph-v1', '2026-07-21', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_graph_relations (id, owner_id, source_entity_id, predicate, target_entity_id, status, confidence, origin, extraction_version, source_fact_id, created_at, updated_at) VALUES ('rel-a', 'owner', 'entity-a', 'supports', 'entity-b', 'active', 0.8, 'automated', 'fact-graph-v1', 'fact-a', '2026-07-21', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_graph_relation_evidence (relation_id, owner_id, fact_id, source_type, source_id, revision_id, evidence_hash, excerpt_redacted, created_at) VALUES ('rel-a', 'owner', 'fact-a', 'check_in_revision', 'log-a', 'rev-a', 'h', 'redacted', '2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_memory_staleness_events (id, owner_id, source_type, source_id, revision_id, affected_json, recompute_order_json, reason, created_at) VALUES ('stale-a', 'owner', 'check_in_revision', 'log-a', 'rev-a', '{}', '[]', 'api_key=SECRET Authorization: Bearer SECRET', '2026-07-21')"
    )
    .run();
}

describe('AIMemoryControlService', () => {
  it('projects overview, safe diagnostics, counts, and indexing progress without secrets', () => {
    const { database, service } = fixture();
    const overview = service.overview();
    expect(overview.activeNamespace).toMatchObject({
      id: 'ns',
      modelId: 'embed',
      storageBytes: '32'
    });
    expect(overview.counts).toMatchObject({
      facts: 1,
      graphNodes: 2,
      graphEdges: 1,
      staleMemory: 1
    });
    expect(overview.indexing).toMatchObject({ pending: 0, failed: 0 });
    expect(JSON.stringify(overview)).not.toMatch(
      /SECRET|Authorization: Bearer|lease[_-]?token|raw prompt/iu
    );
    database.close();
  });

  it('returns semantic/hybrid search evidence with namespace disclosure and owner isolation', () => {
    const { database, service } = fixture();
    const result = service.search({ query: 'FocusLog memory', mode: 'hybrid', limit: 10 });
    expect(result.namespace).toMatchObject({ id: 'ns', modelId: 'embed' });
    expect(result.explanation).toContain('facts_graph_first');
    expect(result.results.some((item) => item.sourceId === 'fact-a')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/SECRET|Other owner|authorization|raw provider/iu);
    expect(new AIMemoryControlService(database, 'other').factsList()).toHaveLength(1);
    expect(new AIMemoryControlService(database, 'missing').factsList()).toHaveLength(0);
    database.close();
  });

  it('supports fact rejection, correction overlays, graph split, subsystem pause, and derived deletion without canonical log loss', () => {
    const { database, service } = fixture();
    expect(service.rejectFact('fact-a', 'No longer true').status).toBe('rejected');
    const corrected = service.correctFact('fact-a', {
      subject: 'FocusLog',
      predicate: 'supports',
      objectValue: 'curated AI memory',
      factType: 'project',
      confidence: 1,
      reason: 'User corrected from UI'
    });
    expect(corrected.origin).toBe('user_overlay');
    const split = service.splitGraphEntity('entity-a', 'FocusLog App', 'project');
    expect(split.id).not.toBe('entity-a');

    const paused = service.setSubsystem({ subsystem: 'embeddings', enabled: false });
    expect(paused.subsystems.embeddings).toBe(false);
    const afterDelete = service.deleteDerived({
      target: 'facts_graph',
      confirmation: 'DELETE DERIVED MEMORY'
    });
    expect(afterDelete.counts.facts).toBe(0);
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM check_ins WHERE id = 'log-a'").get()
    ).toEqual({ count: 1 });
    database.close();
  });

  it('registers validated IPC handlers and rejects malformed renderer input', async () => {
    const { database, service } = fixture();
    const handlers = new Map<string, (_event: unknown, ...args: unknown[]) => unknown>();
    const ipcMain: IpcMainLike = { handle: (channel, listener) => handlers.set(channel, listener) };
    registerAIMemoryIpcHandlers({ ipcMain, service });

    expect(() => handlers.get('focuslog:ai-memory-search')?.({}, { query: '' })).toThrow(
      'valid memory search'
    );
    expect(memorySearchInput({ query: 'FocusLog', mode: 'keyword', limit: 5 })).toMatchObject({
      query: 'FocusLog',
      mode: 'keyword',
      limit: 5
    });
    const overview = handlers.get('focuslog:ai-memory-overview')?.({});
    expect(overview).toMatchObject({ activeNamespace: { id: 'ns' } });
    expect(JSON.stringify(handlers.get('focuslog:ai-memory-export')?.({}))).not.toMatch(
      /SECRET|authorization|lease/iu
    );
    database.close();
  });
});
