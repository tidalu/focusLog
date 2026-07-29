import { createHash } from 'node:crypto';
import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import { AIService } from './ai-service.js';
import { AIError, normalizeProviderError } from './errors.js';
import { EmbeddingNamespaceService } from './embedding-namespace-service.js';
import { MemoryRetrievalService, type RetrievalPlan } from './memory-retrieval-service.js';
import {
  ProviderExecutionCoordinator,
  type CoordinatorEntry
} from './provider-execution-coordinator.js';
import { providerDescriptor } from './providers.js';
import type { GenerationResult, ProviderCapabilities, TokenUsage } from './types.js';

export type PlaygroundGenerationInvoker = (
  entry: CoordinatorEntry,
  prompt: string,
  signal?: AbortSignal
) => Promise<GenerationResult>;
export type PlaygroundEmbeddingInvoker = (input: {
  providerProfileId: string;
  modelId: string;
  text: string[];
  signal?: AbortSignal;
}) => Promise<{ vectors: number[][]; usage: TokenUsage }>;

export interface ComparisonInput {
  promptSnapshotId?: string | null;
  contextSnapshotId?: string | null;
  prompt: string;
  targets: Array<{ providerProfileId: string; modelId?: string | null }>;
  parameters?: Record<string, unknown>;
  evaluationMetadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface ComparisonResult {
  groupId: string;
  status: 'completed' | 'cancelled' | 'failed';
  inputHash: string;
  runs: Array<{
    id: string;
    status: 'succeeded' | 'failed' | 'cancelled';
    providerProfileId: string;
    providerId: string;
    modelId: string;
    outputText: string | null;
    fallbackUsed: boolean;
    capability: ProviderCapabilities;
    errorCode: string | null;
  }>;
}

export interface EmbeddingInspectionResult {
  id: string;
  namespaceId: string;
  providerProfileId: string;
  modelId: string;
  dimensions: number;
  vectorSample: number[][];
  similarity: Array<{ left: number; right: number; cosine: number }>;
}

export interface RetrievalInspectionResult {
  id: string;
  plan: RetrievalPlan;
  keywordCandidates: Array<{ sourceId: string; score: number; reason: string }>;
  semanticCandidates: Array<{ sourceId: string; score: number; reason: string }>;
  exclusions: string[];
}

export interface StructuredWorkbenchInput {
  providerProfileId: string;
  modelId?: string | null;
  prompt: string;
  schema: Record<string, unknown>;
  mode: 'provider_native' | 'prompt_json_fallback';
  allowRepair?: boolean;
  signal?: AbortSignal;
}

export interface StructuredWorkbenchResult {
  id: string;
  status: 'accepted' | 'invalid' | 'failed' | 'cancelled';
  parsed: Record<string, unknown> | null;
  validationErrors: string[];
  repaired: boolean;
  repairAttempts: number;
  exportCase: Record<string, unknown>;
}

function now(): string {
  return new Date().toISOString();
}
function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function redact(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{6,}/gu, 'sk-[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/giu, 'Bearer [redacted]')
    .replace(/(authorization|api[_-]?key|x-api-key)\s*[:=]?\s*[^\s,;]+/giu, '$1 [redacted]')
    .slice(0, 4_000);
}
function total(usage: TokenUsage): number | null {
  return usage.totalTokens ?? ((usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) || null);
}
function cosine(left: number[], right: number[]): number {
  const dot = left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
  const l = Math.sqrt(left.reduce((sum, value) => sum + value * value, 0));
  const r = Math.sqrt(right.reduce((sum, value) => sum + value * value, 0));
  return l === 0 || r === 0 ? 0 : Number((dot / (l * r)).toFixed(6));
}
function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
function validateSchema(
  value: Record<string, unknown> | null,
  schema: Record<string, unknown>
): string[] {
  const errors: string[] = [];
  if (!value) return ['Response is not a JSON object.'];
  if (schema.type !== 'object') return ['Workbench schema must be a JSON object schema.'];
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === 'string')
    : [];
  for (const key of required) if (!(key in value)) errors.push(`Missing required field: ${key}.`);
  const properties =
    schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
      ? (schema.properties as Record<string, unknown>)
      : {};
  for (const [key, rule] of Object.entries(properties)) {
    if (!(key in value) || !rule || typeof rule !== 'object') continue;
    const type = (rule as { type?: unknown }).type;
    if (type === 'string' && typeof value[key] !== 'string')
      errors.push(`Field ${key} must be a string.`);
    if (type === 'number' && typeof value[key] !== 'number')
      errors.push(`Field ${key} must be a number.`);
    if (type === 'boolean' && typeof value[key] !== 'boolean')
      errors.push(`Field ${key} must be a boolean.`);
    if (type === 'array' && !Array.isArray(value[key]))
      errors.push(`Field ${key} must be an array.`);
  }
  return errors;
}

export class PlaygroundInspectionService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly ai: AIService,
    private readonly generate: PlaygroundGenerationInvoker,
    private readonly embed?: PlaygroundEmbeddingInvoker
  ) {}

  async compare(input: ComparisonInput): Promise<ComparisonResult> {
    if (input.targets.length < 2)
      throw new AIError('VALIDATION', 'Choose at least two models to compare.');
    const prompt = this.frozenPrompt(input.prompt, input.contextSnapshotId);
    const inputHash = hash(
      JSON.stringify({
        prompt,
        contextSnapshotId: input.contextSnapshotId ?? null,
        parameters: input.parameters ?? {}
      })
    );
    const timestamp = now();
    const groupId = ulid();
    this.database
      .prepare(
        'INSERT INTO ai_playground_comparison_groups (id, owner_id, prompt_snapshot_id, context_snapshot_id, input_hash, parameters_json, status, evaluation_metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        groupId,
        this.ownerId,
        input.promptSnapshotId ?? null,
        input.contextSnapshotId ?? null,
        inputHash,
        JSON.stringify(input.parameters ?? {}),
        'running',
        JSON.stringify({ ...(input.evaluationMetadata ?? {}), broadModelSuperiorityClaim: false }),
        timestamp,
        timestamp
      );
    const runs = [];
    for (let position = 0; position < input.targets.length; position += 1) {
      const target = input.targets[position]!;
      runs.push(
        await this.runComparisonTarget(
          groupId,
          position,
          target.providerProfileId,
          target.modelId ?? null,
          prompt,
          input.signal
        )
      );
    }
    const status = runs.some((run) => run.status === 'cancelled')
      ? 'cancelled'
      : runs.every((run) => run.status === 'failed')
        ? 'failed'
        : 'completed';
    this.database
      .prepare(
        'UPDATE ai_playground_comparison_groups SET status = ?, updated_at = ? WHERE owner_id = ? AND id = ?'
      )
      .run(status, now(), this.ownerId, groupId);
    return { groupId, status, inputHash, runs };
  }

  async inspectEmbeddings(input: {
    sessionId?: string | null;
    providerProfileId: string;
    modelId?: string | null;
    text: string[];
    dimensions: number;
  }): Promise<EmbeddingInspectionResult> {
    if (input.text.length < 1 || input.text.length > 20)
      throw new AIError('VALIDATION', 'Choose one to twenty embedding inspection inputs.');
    if (!this.embed)
      throw new AIError(
        'UNSUPPORTED_CAPABILITY',
        'Embedding inspection requires an embedding provider.'
      );
    const profile = this.ai.requireExecution(input.providerProfileId, 'embeddings').profile;
    const modelId = input.modelId ?? profile.embeddingModel;
    if (!modelId)
      throw new AIError('INVALID_CONFIGURATION', 'Select an embedding model for inspection.');
    const namespace = new EmbeddingNamespaceService(this.database, this.ownerId, this.ai).create({
      name: `playground-${ulid()}`,
      providerProfileId: input.providerProfileId,
      modelId,
      dimensions: input.dimensions,
      sourceTypes: ['check_in_revision']
    });
    const result = await this.embed({
      providerProfileId: input.providerProfileId,
      modelId,
      text: input.text
    });
    if (!result.vectors.every((vector) => vector.length === input.dimensions))
      throw new AIError('VALIDATION', 'Embedding provider returned unexpected dimensions.');
    const sample = result.vectors.map((vector) => vector.slice(0, Math.min(8, vector.length)));
    const similarity: EmbeddingInspectionResult['similarity'] = [];
    for (let left = 0; left < result.vectors.length; left += 1)
      for (let right = left + 1; right < result.vectors.length; right += 1)
        similarity.push({
          left,
          right,
          cosine: cosine(result.vectors[left]!, result.vectors[right]!)
        });
    const id = ulid();
    this.database.transaction(() => {
      this.database
        .prepare(
          'INSERT INTO ai_playground_embedding_inspections (id, owner_id, session_id, namespace_id, provider_profile_id, provider_id, model_id, dimensions, input_count, vector_sample_json, similarity_json, usage_json, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          id,
          this.ownerId,
          input.sessionId ?? null,
          namespace.id,
          input.providerProfileId,
          profile.providerId,
          modelId,
          input.dimensions,
          input.text.length,
          JSON.stringify(sample),
          JSON.stringify(similarity),
          JSON.stringify(result.usage),
          JSON.stringify({ sampledDimensions: sample[0]?.length ?? 0 }),
          now()
        );
      if (input.sessionId)
        this.database
          .prepare(
            "INSERT OR IGNORE INTO ai_playground_namespace_refs (id, owner_id, session_id, namespace_id, purpose, status, created_at) VALUES (?, ?, ?, ?, 'embedding_inspector', 'active', ?)"
          )
          .run(ulid(), this.ownerId, input.sessionId, namespace.id, now());
    })();
    return {
      id,
      namespaceId: namespace.id,
      providerProfileId: input.providerProfileId,
      modelId,
      dimensions: input.dimensions,
      vectorSample: sample,
      similarity
    };
  }

  inspectRetrieval(input: {
    query: string;
    mode: 'keyword' | 'semantic' | 'hybrid';
    filters?: Record<string, unknown>;
    tokenBudget: number;
  }): RetrievalInspectionResult {
    const plan = new MemoryRetrievalService(this.database, this.ownerId).plan({
      query: input.query,
      queryType: input.mode === 'keyword' ? 'focused' : 'broad',
      evidenceRequired: input.mode !== 'semantic',
      tokenBudget: input.tokenBudget,
      privacyMode: 'LOCAL'
    });
    const keywordCandidates = plan.items
      .filter((item) => item.sourceType === 'raw_log' || item.sourceType === 'summary')
      .map((item) => ({
        sourceId: item.sourceId,
        score: item.score,
        reason: 'keyword/summary candidate'
      }));
    const semanticCandidates = plan.items
      .filter((item) => item.sourceType === 'fact' || item.sourceType === 'graph_relation')
      .map((item) => ({
        sourceId: item.sourceId,
        score: item.score,
        reason: 'semantic memory candidate'
      }));
    const id = ulid();
    this.database
      .prepare(
        'INSERT INTO ai_playground_retrieval_inspections (id, owner_id, plan_id, query_normalized, mode, filters_json, keyword_candidates_json, semantic_candidates_json, exclusions_json, final_context_json, token_truncation_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        id,
        this.ownerId,
        plan.id,
        plan.query,
        input.mode,
        JSON.stringify(input.filters ?? {}),
        JSON.stringify(keywordCandidates),
        JSON.stringify(semanticCandidates),
        JSON.stringify(plan.exclusionReasons),
        JSON.stringify(plan.items),
        JSON.stringify({
          tokenBudget: plan.tokenBudget,
          totalTokens: plan.items.reduce((sum, item) => sum + item.tokenEstimate, 0)
        }),
        now()
      );
    return { id, plan, keywordCandidates, semanticCandidates, exclusions: plan.exclusionReasons };
  }

  async runStructuredWorkbench(
    input: StructuredWorkbenchInput
  ): Promise<StructuredWorkbenchResult> {
    if (input.schema.type !== 'object')
      throw new AIError('VALIDATION', 'Structured workbench schema must be a JSON object schema.');
    const profile = this.ai.requireExecution(input.providerProfileId, 'playground').profile;
    const descriptor = providerDescriptor(profile.providerId);
    if (!descriptor.capabilities.structuredOutput)
      throw new AIError('UNSUPPORTED_CAPABILITY', 'This provider cannot run structured output.');
    const modelId = input.modelId ?? profile.generationModel;
    if (!modelId)
      throw new AIError('INVALID_CONFIGURATION', 'Select a generation model for the workbench.');
    if (
      input.mode === 'provider_native' &&
      !descriptor.capabilities.nativeStructuredOutput &&
      !descriptor.capabilities.jsonMode
    )
      throw new AIError(
        'UNSUPPORTED_CAPABILITY',
        'This provider does not support native structured output.'
      );
    const jobId = ulid();
    const timestamp = now();
    this.database
      .prepare(
        `INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, attempts, run_after, created_at, updated_at, schema_version, priority, max_attempts, started_at, requested_profile_id, requested_model_id, privacy_mode, parameters_json) VALUES (?, ?, 'playground_structured_workbench', ?, ?, 'leased', 1, ?, ?, ?, 1, 100, 1, ?, ?, ?, ?, '{}')`
      )
      .run(
        jobId,
        this.ownerId,
        `structured:${jobId}`,
        JSON.stringify({ workbench: true }),
        timestamp,
        timestamp,
        timestamp,
        timestamp,
        input.providerProfileId,
        modelId,
        this.ai.getSettings().mode
      );
    const entry: CoordinatorEntry = {
      providerProfileId: input.providerProfileId,
      providerType: profile.providerId,
      model: modelId,
      maxSameProviderRetries: 0,
      allowFallback: false,
      concurrencyLimit: profile.concurrencyLimit
    };
    const initial = await new ProviderExecutionCoordinator(this.database, this.ownerId).execute({
      jobId,
      queueAttempt: 1,
      entries: [entry],
      signal: input.signal,
      enforceCurrentPolicy: true,
      budget: { requestCapMicros: 0, monthlyLimitMicros: null, estimateMicros: () => 0 },
      invoke: (candidate, signal) =>
        this.generate(
          candidate,
          `${input.prompt}\nReturn only JSON matching schema: ${JSON.stringify(input.schema)}`,
          signal
        )
    });
    let parsed = parseJsonObject(initial.value.text);
    let errors = validateSchema(parsed, input.schema);
    let repairAttempts = 0;
    if (errors.length && input.allowRepair && descriptor.capabilities.promptJsonFallback) {
      repairAttempts = 1;
      const repaired = await new ProviderExecutionCoordinator(this.database, this.ownerId).execute({
        jobId,
        queueAttempt: 1,
        operationType: 'structured_repair',
        repairIndex: 1,
        entries: [entry],
        signal: input.signal,
        enforceCurrentPolicy: true,
        invoke: (candidate, signal) =>
          this.generate(
            candidate,
            `Repair this JSON for schema ${JSON.stringify(input.schema)}. Invalid response: ${initial.value.text}. Errors: ${errors.join(' ')}`,
            signal
          )
      });
      parsed = parseJsonObject(repaired.value.text);
      errors = validateSchema(parsed, input.schema);
    }
    const status = errors.length ? 'invalid' : 'accepted';
    const id = ulid();
    const exportCase = {
      schema: input.schema,
      prompt: redact(input.prompt),
      accepted: status === 'accepted',
      deterministicChecks: errors
    };
    this.database
      .prepare(
        'INSERT INTO ai_playground_structured_workbench_runs (id, owner_id, job_id, provider_profile_id, provider_id, model_id, schema_json, mode, prompt, raw_response_redacted, parsed_json, validation_errors_json, repaired, repair_attempts, accepted_output_json, status, usage_json, latency_ms, export_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        id,
        this.ownerId,
        jobId,
        input.providerProfileId,
        profile.providerId,
        modelId,
        JSON.stringify(input.schema),
        input.mode,
        redact(input.prompt),
        redact(initial.value.text),
        parsed ? JSON.stringify(parsed) : null,
        JSON.stringify(errors),
        Number(repairAttempts > 0 && errors.length === 0),
        repairAttempts,
        errors.length ? null : JSON.stringify(parsed),
        status,
        JSON.stringify(initial.value.usage),
        0,
        JSON.stringify(exportCase),
        now(),
        now()
      );
    return {
      id,
      status,
      parsed,
      validationErrors: errors,
      repaired: repairAttempts > 0 && errors.length === 0,
      repairAttempts,
      exportCase
    };
  }

  private async runComparisonTarget(
    groupId: string,
    position: number,
    providerProfileId: string,
    modelOverride: string | null,
    prompt: string,
    signal?: AbortSignal
  ): Promise<ComparisonResult['runs'][number]> {
    const profile = this.ai.requireExecution(providerProfileId, 'playground').profile;
    const model = modelOverride ?? profile.generationModel;
    if (!model)
      throw new AIError('INVALID_CONFIGURATION', 'Select a generation model for comparison.');
    const jobId = ulid();
    const runId = ulid();
    const timestamp = now();
    const descriptor = providerDescriptor(profile.providerId);
    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, attempts, run_after, created_at, updated_at, schema_version, priority, max_attempts, started_at, requested_profile_id, requested_model_id, privacy_mode, parameters_json) VALUES (?, ?, 'playground_comparison', ?, ?, 'leased', 1, ?, ?, ?, 1, 100, 1, ?, ?, ?, ?, '{}')`
        )
        .run(
          jobId,
          this.ownerId,
          `comparison:${runId}`,
          JSON.stringify({ comparisonGroupId: groupId, runId }),
          timestamp,
          timestamp,
          timestamp,
          timestamp,
          providerProfileId,
          model,
          this.ai.getSettings().mode
        );
      this.database
        .prepare(
          'INSERT INTO ai_playground_comparison_runs (id, owner_id, group_id, job_id, position, provider_profile_id, provider_id, model_id, status, capability_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          runId,
          this.ownerId,
          groupId,
          jobId,
          position,
          providerProfileId,
          profile.providerId,
          model,
          'running',
          JSON.stringify(descriptor.capabilities),
          timestamp,
          timestamp
        );
    })();
    try {
      const entry: CoordinatorEntry = {
        providerProfileId,
        providerType: profile.providerId,
        model,
        maxSameProviderRetries: profile.retryLimit,
        allowFallback: false,
        concurrencyLimit: profile.concurrencyLimit
      };
      const result = await new ProviderExecutionCoordinator(this.database, this.ownerId).execute({
        jobId,
        queueAttempt: 1,
        entries: [entry],
        signal,
        enforceCurrentPolicy: true,
        budget: { requestCapMicros: 0, monthlyLimitMicros: null, estimateMicros: () => 0 },
        invoke: (candidate, currentSignal) => this.generate(candidate, prompt, currentSignal)
      });
      const usage = result.value.usage;
      this.database
        .prepare(
          "UPDATE ai_playground_comparison_runs SET status = 'succeeded', output_text = ?, latency_ms = 0, input_tokens = ?, output_tokens = ?, total_tokens = ?, stop_reason = ?, fallback_used = ?, updated_at = ? WHERE owner_id = ? AND id = ?"
        )
        .run(
          redact(result.value.text),
          usage.inputTokens ?? null,
          usage.outputTokens ?? null,
          total(usage),
          result.value.finishReason,
          Number(result.fallbackUsed),
          now(),
          this.ownerId,
          runId
        );
      return {
        id: runId,
        status: 'succeeded',
        providerProfileId,
        providerId: profile.providerId,
        modelId: model,
        outputText: redact(result.value.text),
        fallbackUsed: result.fallbackUsed,
        capability: descriptor.capabilities,
        errorCode: null
      };
    } catch (error) {
      const normalized = normalizeProviderError(error);
      const status = normalized.code === 'CANCELLATION' ? 'cancelled' : 'failed';
      this.database
        .prepare(
          'UPDATE ai_playground_comparison_runs SET status = ?, error_code = ?, error_message = ?, updated_at = ? WHERE owner_id = ? AND id = ?'
        )
        .run(status, normalized.code, redact(normalized.message), now(), this.ownerId, runId);
      return {
        id: runId,
        status,
        providerProfileId,
        providerId: profile.providerId,
        modelId: model,
        outputText: null,
        fallbackUsed: false,
        capability: descriptor.capabilities,
        errorCode: normalized.code
      };
    }
  }

  private frozenPrompt(prompt: string, contextSnapshotId?: string | null): string {
    if (!contextSnapshotId) return prompt;
    const snapshot = this.database
      .prepare(
        'SELECT final_prompt_redacted AS value FROM ai_playground_context_snapshots WHERE owner_id = ? AND id = ?'
      )
      .get(this.ownerId, contextSnapshotId) as { value: string } | undefined;
    if (!snapshot) throw new AIError('VALIDATION', 'The context snapshot is unavailable.');
    return `${snapshot.value}\n${prompt}`;
  }
}
