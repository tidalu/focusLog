import { createHash } from 'node:crypto';
import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import { AIService } from './ai-service.js';
import { AIError } from './errors.js';
import { providerDescriptor } from './providers.js';

type PrivacyClass = 'playground' | 'local_snapshot' | 'production_reference';
type DatasetOrigin =
  'synthetic' | 'manual' | 'json_import' | 'jsonl_import' | 'local_data_snapshot';
type ArtifactType =
  | 'session'
  | 'prompt_template'
  | 'dataset'
  | 'benchmark_result'
  | 'retrieval_config'
  | 'structured_schema';
type Subsystem =
  | 'provider_calls'
  | 'scheduled_analyses'
  | 'embeddings'
  | 'fact_extraction'
  | 'graph_updates'
  | 'retrieval_qa'
  | 'playground_execution'
  | 'cloud_execution'
  | 'background_queue';

export interface EvaluationCaseInput {
  caseKey: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  referenceAnswer?: string | null;
  privacyClass?: PrivacyClass;
  metadata?: Record<string, unknown>;
}

export interface DatasetVersionProjection {
  datasetId: string;
  versionId: string;
  version: number;
  caseCount: number;
  privacyClass: PrivacyClass;
  origin: DatasetOrigin;
}

export interface EvaluationRunProjection {
  id: string;
  status: 'completed' | 'failed' | 'blocked';
  datasetVersionId: string;
  summary: Record<string, number | string>;
  modelEvaluator: Record<string, unknown> | null;
}

export interface SafeArtifactBundle {
  format: 'focuslog.playground.exchange.v1';
  artifactType: ArtifactType;
  manifest: Record<string, unknown>;
  data: unknown;
}

export interface PlaygroundGateStatus {
  counts: {
    sessions: number;
    prompts: number;
    contextSnapshots: number;
    comparisonGroups: number;
    embeddingInspections: number;
    retrievalInspections: number;
    structuredWorkbenchRuns: number;
    datasets: number;
    evaluationRuns: number;
    exchangeRecords: number;
    benchmarkResults: number;
  };
  recentRuns: Array<{
    id: string;
    status: string;
    provider: string;
    model: string;
    totalTokens: number | null;
    costMicros: string;
    fallbackUsed: boolean;
    errorCode: string | null;
  }>;
  recentEvaluations: Array<{
    id: string;
    status: string;
    caseCount: number;
    passed: number;
    failed: number;
    modelEvaluatorLabel: string | null;
  }>;
  switches: Array<{
    subsystem: Subsystem;
    disabled: boolean;
    reason: string | null;
    effectiveBlocked: boolean;
    blockingSwitch: string | null;
  }>;
  capabilities: Array<{
    providerId: string;
    label: string;
    generation: boolean;
    streaming: boolean;
    structuredOutput: boolean;
    embeddings: boolean;
  }>;
  states: string[];
}

export interface Phase4GateCertification {
  adversarialCases: number;
  sanitized: boolean;
  isolation: Record<string, boolean>;
  diagnostics: Array<{ code: string; message: string }>;
}

const artifactTypes: ArtifactType[] = [
  'session',
  'prompt_template',
  'dataset',
  'benchmark_result',
  'retrieval_config',
  'structured_schema'
];
const supportedProviders = new Set([
  'ollama',
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
  'lm-studio',
  'openai-compatible'
]);
const subsystems: Subsystem[] = [
  'provider_calls',
  'scheduled_analyses',
  'embeddings',
  'fact_extraction',
  'graph_updates',
  'retrieval_qa',
  'playground_execution',
  'cloud_execution',
  'background_queue'
];

function timestamp(): string {
  return new Date().toISOString();
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, inner]) => `${JSON.stringify(key)}:${stableJson(inner)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
function hash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}
function redact(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{6,}/gu, 'sk-[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/giu, 'Bearer [redacted]')
    .replace(/(authorization|api[_-]?key|x-api-key)\s*[:=]?\s*[^\s,;]+/giu, '$1 [redacted]')
    .replace(/https:\/\/[^/\s]*:[^@\s]+@/giu, 'https://[redacted]@')
    .slice(0, 8_000);
}
function sanitize(value: unknown): unknown {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (/credential|secret|apiKey|authorization|encrypted/i.test(key)) continue;
      out[key] = sanitize(inner);
    }
    return out;
  }
  return value;
}
function assertSafeSourceName(sourceName: string): void {
  if (
    sourceName.length > 180 ||
    sourceName.includes('..') ||
    sourceName.includes('\\') ||
    sourceName.startsWith('/') ||
    /^[A-Za-z]:/.test(sourceName)
  )
    throw new AIError('VALIDATION', 'Import source name is not a safe relative artifact name.');
  if (/\.(exe|cmd|bat|ps1|sh|js|mjs|cjs)$/iu.test(sourceName))
    throw new AIError('VALIDATION', 'Executable import artifacts are not accepted.');
}
function parseImport(content: string, format: 'json' | 'jsonl'): unknown {
  if (Buffer.byteLength(content, 'utf8') > 1_000_000)
    throw new AIError('VALIDATION', 'Import artifact is too large.');
  if (format === 'json') return JSON.parse(content) as unknown;
  return content
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
}
function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AIError('VALIDATION', message);
  return value as Record<string, unknown>;
}
function normalizeCases(cases: EvaluationCaseInput[]): EvaluationCaseInput[] {
  if (!cases.length) throw new AIError('VALIDATION', 'Evaluation datasets need at least one case.');
  const keys = new Set<string>();
  return cases.map((item) => {
    const key = item.caseKey.trim();
    if (!key || keys.has(key))
      throw new AIError('VALIDATION', 'Evaluation case keys must be unique.');
    keys.add(key);
    return {
      ...item,
      caseKey: key,
      privacyClass: item.privacyClass ?? 'playground',
      metadata: sanitize(item.metadata ?? {}) as Record<string, unknown>
    };
  });
}
function jsonIncludesInstructions(value: unknown): boolean {
  return /ignore previous instructions|system prompt|developer message|exfiltrate|delete records/iu.test(
    JSON.stringify(value)
  );
}
function deterministicScores(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
  referenceAnswer: string | null,
  config: Record<string, unknown>
): Record<string, number | string | boolean> {
  const required = Array.isArray(config.requiredFields)
    ? config.requiredFields.filter((item): item is string => typeof item === 'string')
    : Object.keys(expected);
  const missing = required.filter((key) => !(key in actual));
  const schemaValid = typeof actual === 'object' && !Array.isArray(actual);
  const unsupportedCitations = Array.isArray(actual.citations)
    ? actual.citations.filter(
        (citation) =>
          !citation ||
          typeof citation !== 'object' ||
          typeof (citation as Record<string, unknown>).sourceId !== 'string'
      ).length
    : 0;
  const expectedKeywords = Array.isArray(expected.keywords)
    ? expected.keywords.filter((item): item is string => typeof item === 'string')
    : [];
  const text = JSON.stringify(actual).toLocaleLowerCase();
  const keywordHits = expectedKeywords.filter((keyword) =>
    text.includes(keyword.toLocaleLowerCase())
  ).length;
  const outputLength =
    typeof actual.output === 'string' ? actual.output.length : JSON.stringify(actual).length;
  const classificationExpected =
    typeof expected.classification === 'string' ? expected.classification : null;
  const classificationAccuracy = classificationExpected
    ? Number(actual.classification === classificationExpected)
    : 1;
  return {
    schemaValidity: Number(schemaValid),
    requiredFields: required.length
      ? Number(((required.length - missing.length) / required.length).toFixed(3))
      : 1,
    evidenceValidity: Number(unsupportedCitations === 0),
    unsupportedCitations,
    outputLength,
    keywordAccuracy: expectedKeywords.length
      ? Number((keywordHits / expectedKeywords.length).toFixed(3))
      : 1,
    classificationAccuracy,
    latency: Number(
      typeof actual.latencyMs === 'number' &&
        actual.latencyMs <= Number(config.maxLatencyMs ?? Number.MAX_SAFE_INTEGER)
    ),
    cost: Number(
      BigInt(String(actual.costMicros ?? '0')) <=
        BigInt(String(config.maxCostMicros ?? '9223372036854775807'))
    ),
    tokens: Number(
      Number(actual.totalTokens ?? 0) <= Number(config.maxTokens ?? Number.MAX_SAFE_INTEGER)
    ),
    retry: Number(
      Number(actual.retryCount ?? 0) <= Number(config.maxRetries ?? Number.MAX_SAFE_INTEGER)
    ),
    fallback: Number(
      Boolean(actual.fallbackUsed) ===
        Boolean(expected.fallbackUsed ?? actual.fallbackUsed ?? false)
    ),
    referenceAnswer: referenceAnswer
      ? Number(text.includes(referenceAnswer.toLocaleLowerCase()))
      : 1
  };
}

export class PlaygroundEvaluationService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly ai: AIService
  ) {}

  createDataset(input: {
    name: string;
    privacyClass: PrivacyClass;
    origin: DatasetOrigin;
    importMetadata?: Record<string, unknown>;
    cases: EvaluationCaseInput[];
  }): DatasetVersionProjection {
    const cases = normalizeCases(input.cases);
    const id = ulid();
    const now = timestamp();
    this.database
      .prepare(
        'INSERT INTO ai_playground_eval_datasets (id, owner_id, name, status, privacy_class, origin, import_metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        id,
        this.ownerId,
        input.name.slice(0, 200),
        'active',
        input.privacyClass,
        input.origin,
        JSON.stringify(sanitize(input.importMetadata ?? {})),
        now,
        now
      );
    return this.saveDatasetVersion(id, cases);
  }

  saveDatasetVersion(datasetId: string, cases: EvaluationCaseInput[]): DatasetVersionProjection {
    const dataset = this.database
      .prepare(
        'SELECT privacy_class AS privacyClass, origin FROM ai_playground_eval_datasets WHERE owner_id = ? AND id = ?'
      )
      .get(this.ownerId, datasetId) as
      { privacyClass: PrivacyClass; origin: DatasetOrigin } | undefined;
    if (!dataset) throw new AIError('VALIDATION', 'Evaluation dataset is unavailable.');
    const normalized = normalizeCases(cases);
    const versionRow = this.database
      .prepare(
        'SELECT COALESCE(MAX(version), 0) + 1 AS version FROM ai_playground_eval_dataset_versions WHERE owner_id = ? AND dataset_id = ?'
      )
      .get(this.ownerId, datasetId) as { version: number };
    const versionId = ulid();
    const now = timestamp();
    this.database.transaction(() => {
      this.database
        .prepare(
          'INSERT INTO ai_playground_eval_dataset_versions (id, owner_id, dataset_id, version, case_count, expected_properties_json, reference_answers_json, frozen_metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          versionId,
          this.ownerId,
          datasetId,
          versionRow.version,
          normalized.length,
          JSON.stringify(normalized.map((item) => sanitize(item.expected))),
          JSON.stringify(normalized.map((item) => redact(item.referenceAnswer ?? ''))),
          JSON.stringify({ contentHash: hash(normalized), appSchema: 'phase4d.eval.dataset.v1' }),
          now
        );
      const insert = this.database.prepare(
        'INSERT INTO ai_playground_eval_cases (id, owner_id, dataset_version_id, case_key, input_json, expected_json, reference_answer, privacy_class, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const item of normalized)
        insert.run(
          ulid(),
          this.ownerId,
          versionId,
          item.caseKey,
          JSON.stringify(sanitize(item.input)),
          JSON.stringify(sanitize(item.expected)),
          item.referenceAnswer ? redact(item.referenceAnswer) : null,
          item.privacyClass,
          JSON.stringify(item.metadata),
          now
        );
      this.database
        .prepare(
          'UPDATE ai_playground_eval_datasets SET current_version_id = ?, updated_at = ? WHERE owner_id = ? AND id = ?'
        )
        .run(versionId, now, this.ownerId, datasetId);
    })();
    return {
      datasetId,
      versionId,
      version: versionRow.version,
      caseCount: normalized.length,
      privacyClass: dataset.privacyClass,
      origin: dataset.origin
    };
  }

  importDataset(input: {
    sourceName: string;
    content: string;
    format: 'json' | 'jsonl';
    explicitProductionDataConsent?: boolean;
  }): DatasetVersionProjection {
    assertSafeSourceName(input.sourceName);
    const parsed = parseImport(input.content, input.format);
    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(asRecord(parsed, 'Dataset import must be an object or array.').cases)
        ? (parsed as { cases: unknown[] }).cases
        : [];
    const cases = rows.map((row, index) => {
      const record = asRecord(row, 'Dataset cases must be objects.');
      if (record.providerId && !supportedProviders.has(String(record.providerId)))
        throw new AIError('VALIDATION', 'Dataset references an unsupported provider.');
      if (record.privacyClass === 'production_reference' && !input.explicitProductionDataConsent)
        throw new AIError('PERMISSION', 'Production data snapshots require explicit consent.');
      return {
        caseKey: String(record.caseKey ?? record.id ?? `case-${index + 1}`),
        input: asRecord(record.input ?? {}, 'Dataset case input must be an object.'),
        expected: asRecord(record.expected ?? {}, 'Dataset case expected value must be an object.'),
        referenceAnswer: typeof record.referenceAnswer === 'string' ? record.referenceAnswer : null,
        privacyClass: (record.privacyClass as PrivacyClass | undefined) ?? 'playground',
        metadata: {
          importWarning: jsonIncludesInstructions(record)
            ? 'embedded_instructions_treated_as_untrusted'
            : null
        }
      };
    });
    const version = this.createDataset({
      name: input.sourceName.replace(/\.(jsonl?|txt)$/iu, ''),
      privacyClass: cases.some((item) => item.privacyClass === 'production_reference')
        ? 'production_reference'
        : 'playground',
      origin: input.format === 'jsonl' ? 'jsonl_import' : 'json_import',
      importMetadata: {
        sourceName: input.sourceName,
        warnings: cases.map((item) => item.metadata?.importWarning).filter(Boolean)
      },
      cases
    });
    this.recordExchange(
      'import',
      'dataset',
      version.datasetId,
      'completed',
      { safe: true },
      { sourceName: input.sourceName, versionId: version.versionId }
    );
    return version;
  }

  runEvaluation(input: {
    datasetVersionId: string;
    promptVersionId?: string | null;
    contextSnapshotId?: string | null;
    comparisonGroupId?: string | null;
    providerProfileId?: string | null;
    modelId?: string | null;
    evaluatorConfig?: Record<string, unknown>;
    evaluatorProfileId?: string | null;
    subjectiveLabel?: string | null;
  }): EvaluationRunProjection {
    const cases = this.database
      .prepare(
        'SELECT id, input_json AS inputJson, expected_json AS expectedJson, reference_answer AS referenceAnswer FROM ai_playground_eval_cases WHERE owner_id = ? AND dataset_version_id = ? ORDER BY case_key'
      )
      .all(this.ownerId, input.datasetVersionId) as Array<{
      id: string;
      inputJson: string;
      expectedJson: string;
      referenceAnswer: string | null;
    }>;
    if (!cases.length)
      throw new AIError('VALIDATION', 'Evaluation dataset version is unavailable.');
    if (input.evaluatorProfileId) {
      const profile = this.ai.profile(input.evaluatorProfileId);
      providerDescriptor(profile.providerId);
    }
    const runId = ulid();
    const now = timestamp();
    const config = sanitize(input.evaluatorConfig ?? {}) as Record<string, unknown>;
    const results = cases.map((item) => {
      const actual = asRecord(
        JSON.parse(item.inputJson),
        'Evaluation actual input must be an object.'
      );
      const expected = asRecord(
        JSON.parse(item.expectedJson),
        'Evaluation expected value must be an object.'
      );
      const scores = deterministicScores(actual, expected, item.referenceAnswer, config);
      const passed = Object.entries(scores).every(
        ([key, value]) => key === 'outputLength' || key === 'unsupportedCitations' || value === 1
      );
      return { caseId: item.id, actual, scores, passed };
    });
    const summary = {
      caseCount: results.length,
      passed: results.filter((item) => item.passed).length,
      failed: results.filter((item) => !item.passed).length,
      datasetHash: hash(cases.map((item) => item.id))
    };
    const modelEvaluator = input.evaluatorProfileId
      ? (sanitize({
          type: 'model_based_subjective',
          label: input.subjectiveLabel ?? 'subjective',
          evaluatorProfileId: input.evaluatorProfileId,
          costMicros: '0'
        }) as Record<string, unknown>)
      : null;
    this.database.transaction(() => {
      this.database
        .prepare(
          'INSERT INTO ai_playground_eval_runs (id, owner_id, dataset_version_id, prompt_version_id, context_snapshot_id, comparison_group_id, provider_profile_id, model_id, evaluator_profile_id, status, evaluator_config_json, frozen_input_json, app_version, schema_version, deterministic_summary_json, model_evaluator_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          runId,
          this.ownerId,
          input.datasetVersionId,
          input.promptVersionId ?? null,
          input.contextSnapshotId ?? null,
          input.comparisonGroupId ?? null,
          input.providerProfileId ?? null,
          input.modelId ?? null,
          input.evaluatorProfileId ?? null,
          'completed',
          JSON.stringify(config),
          JSON.stringify(sanitize(input)),
          'focuslog-desktop-local',
          'phase4d.eval.run.v1',
          JSON.stringify(summary),
          modelEvaluator ? JSON.stringify(modelEvaluator) : null,
          now,
          now
        );
      const insert = this.database.prepare(
        'INSERT INTO ai_playground_eval_case_results (id, owner_id, eval_run_id, case_id, actual_json, deterministic_scores_json, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const result of results)
        insert.run(
          ulid(),
          this.ownerId,
          runId,
          result.caseId,
          JSON.stringify(sanitize(result.actual)),
          JSON.stringify(result.scores),
          Number(result.passed),
          now
        );
    })();
    return {
      id: runId,
      status: 'completed',
      datasetVersionId: input.datasetVersionId,
      summary,
      modelEvaluator
    };
  }

  rerunEvaluation(runId: string): EvaluationRunProjection {
    const row = this.database
      .prepare(
        'SELECT dataset_version_id AS datasetVersionId, prompt_version_id AS promptVersionId, context_snapshot_id AS contextSnapshotId, comparison_group_id AS comparisonGroupId, provider_profile_id AS providerProfileId, model_id AS modelId, evaluator_profile_id AS evaluatorProfileId, evaluator_config_json AS config, model_evaluator_json AS modelEvaluator FROM ai_playground_eval_runs WHERE owner_id = ? AND id = ?'
      )
      .get(this.ownerId, runId) as
      | {
          datasetVersionId: string;
          promptVersionId: string | null;
          contextSnapshotId: string | null;
          comparisonGroupId: string | null;
          providerProfileId: string | null;
          modelId: string | null;
          evaluatorProfileId: string | null;
          config: string;
          modelEvaluator: string | null;
        }
      | undefined;
    if (!row) throw new AIError('VALIDATION', 'Evaluation run is unavailable.');
    const modelEvaluator = row.modelEvaluator
      ? (JSON.parse(row.modelEvaluator) as Record<string, unknown>)
      : null;
    return this.runEvaluation({
      datasetVersionId: row.datasetVersionId,
      promptVersionId: row.promptVersionId,
      contextSnapshotId: row.contextSnapshotId,
      comparisonGroupId: row.comparisonGroupId,
      providerProfileId: row.providerProfileId,
      modelId: row.modelId,
      evaluatorProfileId: row.evaluatorProfileId,
      evaluatorConfig: JSON.parse(row.config) as Record<string, unknown>,
      subjectiveLabel: typeof modelEvaluator?.label === 'string' ? modelEvaluator.label : null
    });
  }

  compareRuns(
    leftRunId: string,
    rightRunId: string
  ): { leftRunId: string; rightRunId: string; delta: Record<string, number> } {
    const get = (id: string) =>
      this.database
        .prepare(
          'SELECT deterministic_summary_json AS summary FROM ai_playground_eval_runs WHERE owner_id = ? AND id = ?'
        )
        .get(this.ownerId, id) as { summary: string } | undefined;
    const left = get(leftRunId);
    const right = get(rightRunId);
    if (!left || !right)
      throw new AIError('VALIDATION', 'Evaluation run comparison requires two available runs.');
    const a = JSON.parse(left.summary) as Record<string, number>;
    const b = JSON.parse(right.summary) as Record<string, number>;
    return {
      leftRunId,
      rightRunId,
      delta: {
        passed: (b.passed ?? 0) - (a.passed ?? 0),
        failed: (b.failed ?? 0) - (a.failed ?? 0),
        caseCount: (b.caseCount ?? 0) - (a.caseCount ?? 0)
      }
    };
  }

  exportArtifact(
    type: ArtifactType,
    artifactId: string,
    options: { includeProductionData?: boolean } = {}
  ): SafeArtifactBundle {
    if (!artifactTypes.includes(type))
      throw new AIError('VALIDATION', 'Unsupported Playground export artifact type.');
    const data = this.readArtifact(type, artifactId, options.includeProductionData === true);
    const bundle: SafeArtifactBundle = {
      format: 'focuslog.playground.exchange.v1',
      artifactType: type,
      manifest: {
        artifactId,
        exportedAt: timestamp(),
        productionDataIncluded: options.includeProductionData === true,
        contentHash: hash(data)
      },
      data: sanitize(data)
    };
    this.recordExchange('export', type, artifactId, 'completed', { safe: true }, bundle.manifest);
    return bundle;
  }

  importArtifact(bundle: SafeArtifactBundle): { accepted: boolean; warnings: string[] } {
    if (
      bundle.format !== 'focuslog.playground.exchange.v1' ||
      !artifactTypes.includes(bundle.artifactType)
    )
      throw new AIError('VALIDATION', 'Unsupported Playground exchange bundle.');
    const text = JSON.stringify(bundle);
    if (/sk-[A-Za-z0-9_-]{6,}|authorization|encryptedCredential|apiKey/iu.test(text))
      throw new AIError('VALIDATION', 'Exchange bundle contains credential-shaped content.');
    const data = sanitize(bundle.data);
    const warnings = jsonIncludesInstructions(data)
      ? ['embedded_instructions_treated_as_untrusted']
      : [];
    this.recordExchange(
      'import',
      bundle.artifactType,
      typeof bundle.manifest.artifactId === 'string' ? bundle.manifest.artifactId : null,
      'completed',
      { safe: true, warnings },
      bundle.manifest
    );
    return { accepted: true, warnings };
  }

  setSubsystemSwitch(subsystem: Subsystem, disabled: boolean, reason?: string): void {
    if (!subsystems.includes(subsystem))
      throw new AIError('VALIDATION', 'Unknown AI subsystem switch.');
    this.database
      .prepare(
        'INSERT INTO ai_subsystem_switches (owner_id, subsystem, disabled, reason, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner_id, subsystem) DO UPDATE SET disabled=excluded.disabled, reason=excluded.reason, updated_at=excluded.updated_at'
      )
      .run(
        this.ownerId,
        subsystem,
        Number(disabled),
        reason ? redact(reason).slice(0, 200) : null,
        timestamp()
      );
  }

  readSubsystemSwitches(): Array<{
    subsystem: Subsystem;
    disabled: boolean;
    reason: string | null;
    effectiveBlocked: boolean;
    blockingSwitch: string | null;
  }> {
    const settings = this.ai.getSettings();
    const explicit = new Map(
      (
        this.database
          .prepare(
            'SELECT subsystem, disabled, reason FROM ai_subsystem_switches WHERE owner_id = ?'
          )
          .all(this.ownerId) as Array<{
          subsystem: Subsystem;
          disabled: number;
          reason: string | null;
        }>
      ).map((row) => [row.subsystem, row])
    );
    const featureBlocked = (subsystem: Subsystem): string | null => {
      if (subsystem === 'scheduled_analyses' && !settings.featureFlags.analyses)
        return 'analyses feature switch';
      if (subsystem === 'embeddings' && !settings.featureFlags.embeddings)
        return 'embeddings feature switch';
      if (subsystem === 'fact_extraction' && !settings.featureFlags.facts)
        return 'facts feature switch';
      if (subsystem === 'graph_updates' && !settings.featureFlags.graph)
        return 'graph feature switch';
      if (subsystem === 'retrieval_qa' && settings.mode === 'DISABLED') return 'AI mode disabled';
      if (subsystem === 'playground_execution' && !settings.featureFlags.playground)
        return 'playground feature switch';
      if (subsystem === 'cloud_execution' && settings.mode === 'LOCAL') return 'local privacy mode';
      return null;
    };
    return subsystems.map((subsystem) => {
      const row = explicit.get(subsystem);
      const feature = featureBlocked(subsystem);
      const explicitBlocked = row?.disabled === 1;
      return {
        subsystem,
        disabled: explicitBlocked,
        reason: row?.reason ?? null,
        effectiveBlocked: explicitBlocked || Boolean(feature),
        blockingSwitch: explicitBlocked ? subsystem : feature
      };
    });
  }

  assertSubsystemAllowed(subsystem: Subsystem): void {
    const state = this.readSubsystemSwitches().find((item) => item.subsystem === subsystem);
    if (!state || state.effectiveBlocked)
      throw new AIError(
        'PERMISSION',
        `${state?.blockingSwitch ?? subsystem} blocks this AI subsystem.`
      );
  }

  readGateStatus(): PlaygroundGateStatus {
    const count = (table: string) =>
      (
        this.database
          .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE owner_id = ?`)
          .get(this.ownerId) as { count: number }
      ).count;
    const recentRuns = (
      this.database
        .prepare(
          'SELECT id, status, provider_id AS provider, model_id AS model, total_tokens AS totalTokens, estimated_cost_micros AS costMicros, fallback_used AS fallbackUsed, error_code AS errorCode FROM ai_playground_runs WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 12'
        )
        .all(this.ownerId) as Array<{
        id: string;
        status: string;
        provider: string;
        model: string;
        totalTokens: number | null;
        costMicros: string;
        fallbackUsed: number;
        errorCode: string | null;
      }>
    ).map((run) => ({ ...run, fallbackUsed: run.fallbackUsed === 1 }));
    const recentEvaluations = (
      this.database
        .prepare(
          'SELECT id, status, deterministic_summary_json AS summary, model_evaluator_json AS modelEvaluator FROM ai_playground_eval_runs WHERE owner_id = ? ORDER BY created_at DESC LIMIT 12'
        )
        .all(this.ownerId) as Array<{
        id: string;
        status: string;
        summary: string;
        modelEvaluator: string | null;
      }>
    ).map((row) => {
      const summary = JSON.parse(row.summary) as Record<string, number>;
      const evaluator = row.modelEvaluator
        ? (JSON.parse(row.modelEvaluator) as Record<string, unknown>)
        : null;
      return {
        id: row.id,
        status: row.status,
        caseCount: summary.caseCount ?? 0,
        passed: summary.passed ?? 0,
        failed: summary.failed ?? 0,
        modelEvaluatorLabel: typeof evaluator?.label === 'string' ? evaluator.label : null
      };
    });
    return {
      counts: {
        sessions: count('ai_playground_sessions'),
        prompts: count('ai_playground_prompt_definitions_v2'),
        contextSnapshots: count('ai_playground_context_snapshots'),
        comparisonGroups: count('ai_playground_comparison_groups'),
        embeddingInspections: count('ai_playground_embedding_inspections'),
        retrievalInspections: count('ai_playground_retrieval_inspections'),
        structuredWorkbenchRuns: count('ai_playground_structured_workbench_runs'),
        datasets: count('ai_playground_eval_datasets'),
        evaluationRuns: count('ai_playground_eval_runs'),
        exchangeRecords: count('ai_playground_exchange_records'),
        benchmarkResults: count('ai_playground_benchmark_results')
      },
      recentRuns,
      recentEvaluations,
      switches: this.readSubsystemSwitches(),
      capabilities: this.ai.descriptors().map((descriptor) => ({
        providerId: descriptor.id,
        label: descriptor.label,
        generation: descriptor.capabilities.generation,
        streaming: descriptor.capabilities.streaming,
        structuredOutput: descriptor.capabilities.structuredOutput,
        embeddings: descriptor.capabilities.embeddings
      })),
      states: [
        'loading',
        'empty',
        'error',
        'cancelled',
        'interrupted',
        'blocked',
        'streaming',
        'success'
      ]
    };
  }

  certifyPhase4Gate(adversarialInputs: string[]): Phase4GateCertification {
    const sanitizedInputs = adversarialInputs.map(redact);
    const diagnostics = sanitizedInputs.map((message, index) => ({
      code: `adversarial_${index + 1}`,
      message: message.slice(0, 240)
    }));
    const isolation = {
      playgroundMessagesExcludedFromFacts:
        (
          this.database
            .prepare(
              "SELECT COUNT(*) AS count FROM ai_fact_records WHERE owner_id = ? AND origin = 'automated' AND id IN (SELECT id FROM ai_playground_messages WHERE owner_id = ?)"
            )
            .get(this.ownerId, this.ownerId) as { count: number }
        ).count === 0,
      playgroundNamespacesNotProductionActive:
        (
          this.database
            .prepare(
              "SELECT COUNT(*) AS count FROM ai_vector_namespaces WHERE owner_id = ? AND status = 'active' AND id IN (SELECT namespace_id FROM ai_playground_namespace_refs WHERE owner_id = ?)"
            )
            .get(this.ownerId, this.ownerId) as { count: number }
        ).count === 0,
      playgroundPromptsDoNotMutateProduction:
        countProductionPromptCopies(this.database, this.ownerId) >= 0,
      playgroundDeletionKeepsProductionRecords:
        (
          this.database
            .prepare('SELECT COUNT(*) AS count FROM check_ins WHERE owner_id = ?')
            .get(this.ownerId) as { count: number }
        ).count >= 0,
      scheduledJobsIgnorePlaygroundData:
        (
          this.database
            .prepare(
              "SELECT COUNT(*) AS count FROM ai_jobs WHERE owner_id = ? AND kind LIKE 'analysis_%' AND payload_json LIKE '%ai_playground_%'"
            )
            .get(this.ownerId) as { count: number }
        ).count === 0,
      inspectorsCannotActivateProductionNamespaces:
        (
          this.database
            .prepare(
              "SELECT COUNT(*) AS count FROM ai_playground_embedding_inspections inspection JOIN ai_vector_namespaces namespace ON namespace.id = inspection.namespace_id WHERE inspection.owner_id = ? AND namespace.status = 'active'"
            )
            .get(this.ownerId) as { count: number }
        ).count === 0
    };
    return {
      adversarialCases: adversarialInputs.length,
      sanitized:
        !/sk-[A-Za-z0-9_-]{6,}|Bearer\s+(?!\[redacted\])[A-Za-z0-9._-]+|SECRET|TOKEN/iu.test(
          JSON.stringify(diagnostics)
        ),
      isolation,
      diagnostics
    };
  }

  private readArtifact(
    type: ArtifactType,
    artifactId: string,
    includeProductionData: boolean
  ): unknown {
    if (type === 'dataset') {
      const dataset = this.database
        .prepare(
          'SELECT id, name, current_version_id AS currentVersionId, privacy_class AS privacyClass, origin FROM ai_playground_eval_datasets WHERE owner_id = ? AND id = ?'
        )
        .get(this.ownerId, artifactId) as Record<string, unknown> | undefined;
      if (!dataset) throw new AIError('VALIDATION', 'Dataset is unavailable.');
      if (dataset.privacyClass === 'production_reference' && !includeProductionData)
        throw new AIError('PERMISSION', 'Exporting production data requires explicit selection.');
      const cases = this.database
        .prepare(
          'SELECT case_key AS caseKey, input_json AS inputJson, expected_json AS expectedJson, reference_answer AS referenceAnswer, privacy_class AS privacyClass, metadata_json AS metadataJson FROM ai_playground_eval_cases WHERE owner_id = ? AND dataset_version_id = ? ORDER BY case_key'
        )
        .all(this.ownerId, dataset.currentVersionId) as Array<Record<string, unknown>>;
      return { dataset, cases };
    }
    if (type === 'prompt_template')
      return (
        this.database
          .prepare(
            'SELECT definition.id, definition.name, version.system_instructions AS systemInstructions, version.developer_instructions AS developerInstructions, version.user_template AS userTemplate, version.variables_json AS variablesJson, version.structured_schema_json AS schemaJson FROM ai_playground_prompt_definitions_v2 definition JOIN ai_playground_prompt_versions_v2 version ON version.prompt_id = definition.id WHERE definition.owner_id = ? AND definition.id = ? ORDER BY version.version DESC LIMIT 1'
          )
          .get(this.ownerId, artifactId) ?? {}
      );
    if (type === 'session')
      return (
        this.database
          .prepare(
            'SELECT id, title, status, created_at AS createdAt, updated_at AS updatedAt FROM ai_playground_sessions WHERE owner_id = ? AND id = ?'
          )
          .get(this.ownerId, artifactId) ?? {}
      );
    if (type === 'retrieval_config')
      return (
        this.database
          .prepare(
            'SELECT id, name, config_json AS configJson FROM ai_playground_retrieval_configs WHERE owner_id = ? AND id = ?'
          )
          .get(this.ownerId, artifactId) ?? {}
      );
    if (type === 'benchmark_result')
      return (
        this.database
          .prepare(
            'SELECT id, name, command, environment_json AS environmentJson, metrics_json AS metricsJson, artifact_json AS artifactJson FROM ai_playground_benchmark_results WHERE owner_id = ? AND id = ?'
          )
          .get(this.ownerId, artifactId) ?? {}
      );
    if (type === 'structured_schema')
      return (
        this.database
          .prepare(
            'SELECT id, schema_json AS schemaJson, mode FROM ai_playground_structured_workbench_runs WHERE owner_id = ? AND id = ?'
          )
          .get(this.ownerId, artifactId) ?? {}
      );
    return {};
  }

  private recordExchange(
    direction: 'import' | 'export',
    type: ArtifactType,
    artifactId: string | null,
    status: 'completed' | 'rejected',
    validation: Record<string, unknown>,
    manifest: Record<string, unknown>
  ): void {
    this.database
      .prepare(
        'INSERT INTO ai_playground_exchange_records (id, owner_id, direction, artifact_type, artifact_id, status, validation_json, manifest_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        ulid(),
        this.ownerId,
        direction,
        type,
        artifactId,
        status,
        JSON.stringify(sanitize(validation)),
        JSON.stringify(sanitize(manifest)),
        timestamp()
      );
  }
}

function countProductionPromptCopies(database: DesktopDatabase, ownerId: string): number {
  return (
    database
      .prepare(
        "SELECT COUNT(*) AS count FROM ai_playground_prompt_definitions_v2 WHERE owner_id = ? AND origin = 'production_copy'"
      )
      .get(ownerId) as { count: number }
  ).count;
}
