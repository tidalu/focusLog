import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { openDesktopDatabase, type DesktopDatabase } from '../database/database.js';
import { AIService } from './ai-service.js';
import { DesktopCredentialStore } from './credentials.js';
import { AIError } from './errors.js';
import {
  PlaygroundInspectionService,
  type PlaygroundEmbeddingInvoker,
  type PlaygroundGenerationInvoker
} from './playground-inspection-service.js';
import {
  PlaygroundContextService,
  PlaygroundPromptService
} from './playground-prompt-context-service.js';
import type { GenerationResult } from './types.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(generate?: PlaygroundGenerationInvoker, embed?: PlaygroundEmbeddingInvoker) {
  const root = mkdtempSync(join(tmpdir(), 'focuslog-playground-inspect-'));
  roots.push(root);
  const database = openDesktopDatabase(':memory:');
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
  const ollama = ai.saveProfile({
    name: 'Ollama',
    providerId: 'ollama',
    endpoint: 'http://127.0.0.1:11434',
    generationModel: 'llama-a',
    embeddingModel: 'embed-a',
    enabled: true,
    retryLimit: 0
  });
  const lmStudio = ai.saveProfile({
    name: 'LM Studio',
    providerId: 'lm-studio',
    endpoint: 'http://127.0.0.1:1234/v1',
    generationModel: 'llama-b',
    embeddingModel: 'embed-b',
    enabled: true,
    retryLimit: 0
  });
  const service = new PlaygroundInspectionService(
    database,
    'owner',
    ai,
    generate ?? successGeneration(),
    embed
  );
  return { database, ai, ollama, lmStudio, service, credentialReads };
}

function cloudFixture(generate?: PlaygroundGenerationInvoker) {
  const data = fixture(generate);
  data.ai.saveSettings({
    ...data.ai.getSettings(),
    mode: 'CLOUD',
    dataSharingPreview: true
  });
  const anthropic = data.ai.saveProfile({
    name: 'Anthropic',
    providerId: 'anthropic',
    endpoint: 'https://api.anthropic.com',
    generationModel: 'claude',
    enabled: true,
    credential: 'sk-PHASE4C_SECRET'
  });
  data.ai.grantCloudConsent(anthropic.id);
  return { ...data, anthropic };
}

function seedOwner(database: DesktopDatabase, ownerId: string): void {
  database
    .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run(ownerId, '2026-07-29T00:00:00.000Z', '2026-07-29T00:00:00.000Z');
}

function successGeneration(text = 'Comparison output.'): PlaygroundGenerationInvoker {
  return async (entry): Promise<GenerationResult> => ({
    text: `${text} ${entry.model}`,
    finishReason: 'STOP',
    usage: { inputTokens: 11, outputTokens: 5, totalTokens: 16, reported: true }
  });
}

function addContextSnapshot(database: DesktopDatabase): string {
  database
    .prepare(
      "INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES ('log-context', 'owner', 'log-context-rev', '2026-07-29T09:00:00.000Z', 'UTC', 'v1', '2026-07-29', '2026-07-29')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES ('log-context-rev', 'log-context', 'Frozen context with api_key PHASE4C_SECRET.', 'op-context', '2026-07-29')"
    )
    .run();
  const prompts = new PlaygroundPromptService(database, 'owner', undefined);
  const contexts = new PlaygroundContextService(database, 'owner', prompts);
  const prompt = prompts.create('Compare', {
    systemInstructions: 'Use frozen context.',
    userTemplate: 'Question: {{question}}',
    variables: ['question']
  });
  const snapshot = contexts.build({
    promptVersionId: prompts.latestVersion(prompt.id).id,
    variables: { question: 'Which model is clearer?' },
    privacyMode: 'LOCAL',
    maxContextTokens: 120,
    reservedOutputTokens: 20,
    items: [{ sourceType: 'selected_log', sourceId: 'log-context', retrievalScore: 10 }]
  });
  return snapshot.id;
}

function seedRetrievalSources(database: DesktopDatabase): void {
  database
    .prepare(
      "INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES ('log-ret', 'owner', 'log-ret-rev', '2026-07-29T10:00:00.000Z', 'UTC', 'v1', '2026-07-29', '2026-07-29')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES ('log-ret-rev', 'log-ret', 'Focused notes mention retrieval inspector transparency.', 'op-ret', '2026-07-29')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_fact_records (id, owner_id, subject, predicate, object_value, normalized_value_json, fact_type, status, confidence, origin, schema_version, extraction_version, created_at, updated_at) VALUES ('fact-ret', 'owner', 'FocusLog', 'supports', 'retrieval inspector transparency', '{}', 'project', 'active', 0.95, 'automated', 'fact.v1', 'extract.v1', '2026-07-29', '2026-07-29')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_graph_entities (id, owner_id, canonical_name, node_type, normalized_name, status, confidence, origin, extraction_version, created_at, updated_at) VALUES ('entity-a', 'owner', 'FocusLog', 'project', 'focuslog', 'active', 0.9, 'automated', 'graph.v1', '2026-07-29', '2026-07-29')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_graph_entities (id, owner_id, canonical_name, node_type, normalized_name, status, confidence, origin, extraction_version, created_at, updated_at) VALUES ('entity-b', 'owner', 'Retrieval Inspector', 'feature', 'retrieval inspector', 'active', 0.9, 'automated', 'graph.v1', '2026-07-29', '2026-07-29')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_graph_relations (id, owner_id, source_entity_id, predicate, target_entity_id, status, confidence, origin, extraction_version, source_fact_id, created_at, updated_at) VALUES ('rel-ret', 'owner', 'entity-a', 'supports', 'entity-b', 'active', 0.88, 'automated', 'graph.v1', 'fact-ret', '2026-07-29', '2026-07-29')"
    )
    .run();
}

describe('Playground comparison and inspector services', () => {
  it('persists multi-model comparisons with identical frozen inputs and per-run accounting', async () => {
    const seenPrompts: string[] = [];
    const { database, ollama, lmStudio, service } = fixture(async (entry, prompt) => {
      seenPrompts.push(prompt);
      return {
        text: `answer from ${entry.model}`,
        finishReason: 'STOP',
        usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16, reported: true }
      };
    });
    const contextSnapshotId = addContextSnapshot(database);
    const result = await service.compare({
      contextSnapshotId,
      prompt: 'Compare without declaring a universal winner.',
      targets: [
        { providerProfileId: ollama.id, modelId: 'llama-a' },
        { providerProfileId: lmStudio.id, modelId: 'llama-b' }
      ],
      evaluationMetadata: { deterministicChecks: ['json-valid'], userRating: null }
    });
    expect(result.status).toBe('completed');
    expect(new Set(seenPrompts).size).toBe(1);
    expect(seenPrompts[0]).toContain('api_key [redacted]');
    expect(result.runs.map((run) => run.status)).toEqual(['succeeded', 'succeeded']);
    expect(
      database.prepare('SELECT COUNT(*) AS count FROM ai_playground_comparison_groups').get()
    ).toEqual({ count: 1 });
    expect(
      database
        .prepare(
          'SELECT COUNT(*) AS count FROM ai_playground_comparison_runs WHERE total_tokens = 16 AND fallback_used = 0'
        )
        .get()
    ).toEqual({ count: 2 });
    const metadata = database
      .prepare(
        'SELECT evaluation_metadata_json AS value FROM ai_playground_comparison_groups WHERE id = ?'
      )
      .get(result.groupId) as { value: string };
    expect(JSON.parse(metadata.value)).toMatchObject({ broadModelSuperiorityClaim: false });
    expect(database.prepare('SELECT COUNT(*) AS count FROM ai_analysis_results').get()).toEqual({
      count: 0
    });
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM ai_fact_records WHERE id <> ?')
        .get('fact-ret')
    ).toEqual({ count: 0 });
    database.close();
  });

  it('records partial provider failure and comparison cancellation without unsafe disclosure', async () => {
    const { database, ollama, lmStudio, service } = fixture(async (entry) => {
      if (entry.model === 'llama-b')
        throw new AIError(
          'PROVIDER_UNAVAILABLE',
          'Provider failed with Authorization: Bearer SECRET_TOKEN'
        );
      return {
        text: 'primary ok',
        finishReason: 'STOP',
        usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5, reported: true }
      };
    });
    const partial = await service.compare({
      prompt: 'Compare safely.',
      targets: [{ providerProfileId: ollama.id }, { providerProfileId: lmStudio.id }]
    });
    expect(partial.status).toBe('completed');
    expect(partial.runs.map((run) => run.status)).toEqual(['succeeded', 'failed']);
    const failed = database
      .prepare(
        "SELECT error_code AS code, error_message AS message FROM ai_playground_comparison_runs WHERE status = 'failed'"
      )
      .get() as { code: string; message: string };
    expect(failed).toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(failed.message).not.toContain('SECRET_TOKEN');
    const cancelledFixture = fixture(async () => {
      throw new AIError('CANCELLATION', 'The comparison was cancelled.');
    });
    const cancelled = await cancelledFixture.service.compare({
      prompt: 'Stop.',
      targets: [
        { providerProfileId: cancelledFixture.ollama.id },
        { providerProfileId: cancelledFixture.lmStudio.id }
      ]
    });
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.runs.every((run) => run.status === 'cancelled')).toBe(true);
    database.close();
    cancelledFixture.database.close();
  });

  it('keeps embedding inspector namespaces Playground-only and computes sampled similarity', async () => {
    const embed: PlaygroundEmbeddingInvoker = async () => ({
      vectors: [
        Array.from({ length: 12 }, (_, index) => (index === 0 ? 1 : 0)),
        Array.from({ length: 12 }, (_, index) => (index === 0 || index === 1 ? 0.5 : 0))
      ],
      usage: { inputTokens: 6, outputTokens: 0, totalTokens: 6, reported: true }
    });
    const { database, ollama, service } = fixture(undefined, embed);
    const sessionId = database
      .prepare(
        "INSERT INTO ai_playground_sessions (id, owner_id, title, status, current_branch_id, created_at, updated_at) VALUES ('session-embed', 'owner', 'Inspect', 'active', 'branch', '2026-07-29', '2026-07-29') RETURNING id"
      )
      .get() as { id: string };
    const result = await service.inspectEmbeddings({
      sessionId: sessionId.id,
      providerProfileId: ollama.id,
      text: ['alpha', 'beta'],
      dimensions: 12
    });
    expect(result.vectorSample[0]).toHaveLength(8);
    expect(result.similarity[0]).toMatchObject({ left: 0, right: 1, cosine: 0.707107 });
    expect(
      database
        .prepare('SELECT status AS status FROM ai_vector_namespaces WHERE id = ?')
        .get(result.namespaceId)
    ).toEqual({ status: 'building' });
    expect(
      database
        .prepare(
          'SELECT purpose AS purpose FROM ai_playground_namespace_refs WHERE namespace_id = ?'
        )
        .get(result.namespaceId)
    ).toEqual({ purpose: 'embedding_inspector' });
    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM ai_vector_namespaces WHERE status = 'active'")
        .get()
    ).toEqual({ count: 0 });
    database.close();
  });

  it('captures retrieval stage transparency without production mutation', () => {
    const { database, service } = fixture();
    seedRetrievalSources(database);
    const result = service.inspectRetrieval({
      query: 'retrieval inspector transparency',
      mode: 'hybrid',
      tokenBudget: 120
    });
    expect(result.keywordCandidates.some((candidate) => candidate.sourceId === 'log-ret')).toBe(
      true
    );
    expect(
      result.semanticCandidates.some(
        (candidate) => candidate.sourceId === 'fact-ret' || candidate.sourceId === 'rel-ret'
      )
    ).toBe(true);
    const persisted = database
      .prepare(
        'SELECT mode, final_context_json AS context, token_truncation_json AS truncation FROM ai_playground_retrieval_inspections WHERE id = ?'
      )
      .get(result.id) as { mode: string; context: string; truncation: string };
    expect(persisted.mode).toBe('hybrid');
    expect(JSON.parse(persisted.context)).toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceId: 'fact-ret' })])
    );
    expect(JSON.parse(persisted.truncation)).toMatchObject({ tokenBudget: 120 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM ai_memory_qa_answers').get()).toEqual({
      count: 0
    });
    database.close();
  });

  it('accepts valid structured output, repairs invalid output once, and exports safe test cases', async () => {
    const responses = ['not json', '{"answer":"repaired","score":1}'];
    const { database, ollama, service } = fixture(async () => ({
      text: responses.shift() ?? '{"answer":"ok","score":1}',
      finishReason: 'STOP',
      usage: { inputTokens: 9, outputTokens: 4, totalTokens: 13, reported: true }
    }));
    const schema = {
      type: 'object',
      required: ['answer', 'score'],
      properties: { answer: { type: 'string' }, score: { type: 'number' } }
    };
    const repaired = await service.runStructuredWorkbench({
      providerProfileId: ollama.id,
      prompt: 'Return answer with api_key PHASE4C_SECRET',
      schema,
      mode: 'prompt_json_fallback',
      allowRepair: true
    });
    expect(repaired.status).toBe('accepted');
    expect(repaired.repaired).toBe(true);
    expect(repaired.repairAttempts).toBe(1);
    expect(JSON.stringify(repaired.exportCase)).not.toContain('PHASE4C_SECRET');
    const valid = await service.runStructuredWorkbench({
      providerProfileId: ollama.id,
      prompt: 'Return answer.',
      schema,
      mode: 'provider_native'
    });
    expect(valid.status).toBe('accepted');
    expect(
      database
        .prepare(
          "SELECT COUNT(*) AS count FROM ai_playground_structured_workbench_runs WHERE status = 'accepted'"
        )
        .get()
    ).toEqual({ count: 2 });
    database.close();
  });

  it('reports capability mismatch and failed bounded repair clearly', async () => {
    const { database, anthropic, service } = cloudFixture();
    const schema = {
      type: 'object',
      required: ['answer'],
      properties: { answer: { type: 'string' } }
    };
    await expect(
      service.runStructuredWorkbench({
        providerProfileId: anthropic.id,
        prompt: 'Native please.',
        schema,
        mode: 'provider_native'
      })
    ).rejects.toThrow('native structured output');
    database.close();

    const invalid = fixture(async () => ({
      text: '{"answer":5}',
      finishReason: 'STOP',
      usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4, reported: true }
    }));
    const failed = await invalid.service.runStructuredWorkbench({
      providerProfileId: invalid.ollama.id,
      prompt: 'Repair should fail.',
      schema,
      mode: 'prompt_json_fallback',
      allowRepair: true
    });
    expect(failed.status).toBe('invalid');
    expect(failed.validationErrors).toContain('Field answer must be a string.');
    expect(failed.repairAttempts).toBe(1);
    invalid.database.close();
  });
});
