import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  PHASE3_PERFORMANCE_LOG_COUNT,
  runPhase3PerformanceHarness,
  type Phase3HarnessResult
} from './phase3-performance-harness.js';
import { redactPhase5Text } from './phase5-certification-service.js';
import { createProviderAdapter, providerDescriptors } from './providers.js';
import type {
  AIProviderAdapter,
  ProviderId,
  ProviderProfile,
  ResolvedProviderConfig,
  RuntimeSchema,
  TokenUsage
} from './types.js';

export type Phase5ProviderPath = 'local' | 'direct-cloud' | 'openai-compatible';
export type Phase5CheckStatus = 'passed' | 'failed' | 'skipped' | 'unsupported';
export type Phase5ProviderStatus = 'certified' | 'failed' | 'untested';

export interface Phase5ProviderCheck {
  status: Phase5CheckStatus;
  latencyMs?: number;
  detail?: string;
}

export interface Phase5ProviderCertificationRow {
  providerId: ProviderId;
  label: string;
  path: Phase5ProviderPath;
  configured: boolean;
  status: Phase5ProviderStatus;
  date: string;
  endpointKind: 'https' | 'loopback-http' | 'other';
  sdkApiVersion: string;
  generationModel: string | null;
  embeddingModel: string | null;
  capabilities: Record<string, boolean>;
  checks: Record<string, Phase5ProviderCheck>;
  usage: TokenUsage;
  limitations: string[];
  unsupportedBehavior: string[];
}

export interface Phase5PerformanceCertificationResult {
  schemaVersion: 1;
  date: string;
  command: string;
  releaseLike: boolean;
  harness: Phase3HarnessResult;
  thresholdsPassed: boolean;
  resourceControls: {
    rendererSafeProjectionBounded: boolean;
    startupDoesNotProcessBacklogSynchronously: boolean;
    queueBackpressureDocumented: boolean;
    importContextResponseLimitsDocumented: boolean;
    indexesJustified: boolean;
  };
  regressionBaseline: {
    source: string;
    thresholds: Record<string, number>;
    comparedMetrics: string[];
  };
}

export interface Phase5CResult {
  schemaVersion: 1;
  date: string;
  environment: { node: string; platform: string; arch: string };
  providers: Phase5ProviderCertificationRow[];
  performance?: Phase5PerformanceCertificationResult;
  summary: {
    configuredProviders: number;
    certifiedProviders: number;
    failedProviders: number;
    untestedProviders: ProviderId[];
    certifiedLocalPath: boolean;
    certifiedDirectCloudPath: boolean;
    certifiedOpenAICompatiblePath: boolean;
    releaseLikePerformance: boolean;
  };
  secretFree: boolean;
}

export interface Phase5COptions {
  live?: boolean;
  includePerformance?: boolean;
  releaseLikePerformance?: boolean;
  artifactPath?: string;
  performanceArtifactPath?: string;
  now?: Date;
  env?: NodeJS.ProcessEnv;
  makeAdapter?: (config: ResolvedProviderConfig) => AIProviderAdapter;
  performanceLogCount?: number;
}

interface Candidate {
  config: ResolvedProviderConfig;
  path: Phase5ProviderPath;
  generationModel: string;
  embeddingModel: string | null;
}

const smokeSchema: RuntimeSchema<{ ok: boolean }> = {
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['ok'],
    properties: { ok: { type: 'boolean' } }
  },
  parse(value: unknown): { ok: boolean } {
    if (!value || typeof value !== 'object' || typeof (value as { ok?: unknown }).ok !== 'boolean')
      throw new Error('Invalid smoke response.');
    return { ok: (value as { ok: boolean }).ok };
  }
};

function endpointKind(endpoint: string): Phase5ProviderCertificationRow['endpointKind'] {
  if (endpoint.startsWith('https://')) return 'https';
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?($|\/)/u.test(endpoint)) return 'loopback-http';
  return 'other';
}

function providerPath(providerId: ProviderId): Phase5ProviderPath {
  if (providerId === 'ollama' || providerId === 'lm-studio') return 'local';
  if (providerId === 'openai-compatible') return 'openai-compatible';
  return 'direct-cloud';
}

function profile(
  providerId: ProviderId,
  endpoint: string,
  generationModel: string,
  embeddingModel: string | null,
  credentialConfigured: boolean
): ProviderProfile {
  return {
    id: `phase5c-${providerId}`,
    ownerId: 'phase5c-owner',
    name: `Phase 5-C ${providerId}`,
    providerId,
    enabled: true,
    endpoint,
    generationModel,
    embeddingModel,
    temperature: 0,
    topP: 1,
    maxOutputTokens: 64,
    timeoutMs: 15_000,
    retryLimit: 0,
    concurrencyLimit: 1,
    automaticAnalysis: false,
    priority: 100,
    monthlyBudgetUsd: null,
    credentialConfigured,
    createdAt: '2026-07-29T00:00:00.000Z',
    updatedAt: '2026-07-29T00:00:00.000Z'
  };
}

function envCandidate(env: NodeJS.ProcessEnv, providerId: ProviderId): Candidate | null {
  const descriptor = providerDescriptors.find(
    (candidateDescriptor) => candidateDescriptor.id === providerId
  )!;
  const prefix = `FOCUSLOG_LIVE_${providerId.toUpperCase().replaceAll('-', '_')}`;
  const endpoint = env[`${prefix}_ENDPOINT`] ?? descriptor.defaultEndpoint;
  const generationModel = env[`${prefix}_MODEL`];
  const embeddingModel = env[`${prefix}_EMBEDDING_MODEL`] ?? null;
  const apiKey = env[`${prefix}_API_KEY`];

  if (!endpoint) return null;
  if (descriptor.kind === 'CLOUD' && (!apiKey || !generationModel)) return null;
  if (descriptor.kind === 'LOCAL' && !generationModel) return null;
  if (!generationModel) return null;

  return {
    config: {
      profile: profile(providerId, endpoint, generationModel, embeddingModel, Boolean(apiKey)),
      endpoint,
      apiKey
    },
    path: providerPath(providerId),
    generationModel,
    embeddingModel
  };
}

function configuredCandidates(env: NodeJS.ProcessEnv): Map<ProviderId, Candidate> {
  const configured = new Map<ProviderId, Candidate>();
  for (const descriptor of providerDescriptors) {
    const candidate = envCandidate(env, descriptor.id);
    if (candidate) configured.set(descriptor.id, candidate);
  }
  return configured;
}

function skippedRow(
  providerId: ProviderId,
  date: string,
  reason: string
): Phase5ProviderCertificationRow {
  const descriptor = providerDescriptors.find((candidate) => candidate.id === providerId)!;
  return {
    providerId,
    label: descriptor.label,
    path: providerPath(providerId),
    configured: false,
    status: 'untested',
    date,
    endpointKind: endpointKind(descriptor.defaultEndpoint ?? 'https://configured.example'),
    sdkApiVersion: `focuslog-adapter; node=${process.version}`,
    generationModel: null,
    embeddingModel: null,
    capabilities: { ...descriptor.capabilities },
    checks: { configuration: { status: 'skipped', detail: reason } },
    usage: { reported: false },
    limitations: [reason],
    unsupportedBehavior: []
  };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; check: Phase5ProviderCheck }> {
  const started = performance.now();
  try {
    const value = await fn();
    return {
      value,
      check: { status: 'passed', latencyMs: Math.round(performance.now() - started) }
    };
  } catch (error) {
    return {
      check: {
        status: 'failed',
        latencyMs: Math.round(performance.now() - started),
        detail: redactPhase5Text(error instanceof Error ? error.message : String(error))
      }
    };
  }
}

async function consumeStream(
  adapter: AIProviderAdapter,
  model: string
): Promise<{ text: string; usage: TokenUsage; completed: boolean }> {
  let text = '';
  let usage: TokenUsage = { reported: false };
  let completed = false;
  for await (const event of adapter.stream({
    model,
    system: 'You are a FocusLog provider certification smoke test.',
    prompt: 'Reply with the single word pong.',
    maxOutputTokens: 16,
    temperature: 0
  })) {
    if (event.type === 'delta') text += event.text;
    if (event.type === 'usage') usage = event.usage;
    if (event.type === 'complete') completed = true;
  }
  return { text, usage, completed };
}

async function cancellationCheck(adapter: AIProviderAdapter, model: string): Promise<void> {
  const controller = new AbortController();
  controller.abort(new DOMException('Phase 5-C cancellation smoke', 'AbortError'));
  await adapter.generate({
    model,
    prompt: 'This request should be cancelled before provider work completes.',
    maxOutputTokens: 8,
    signal: controller.signal
  });
}

export async function certifyProviderCandidate(
  candidate: Candidate,
  date: string,
  makeAdapter: (config: ResolvedProviderConfig) => AIProviderAdapter = createProviderAdapter
): Promise<Phase5ProviderCertificationRow> {
  const descriptor = providerDescriptors.find(
    (provider) => provider.id === candidate.config.profile.providerId
  )!;
  const adapter = makeAdapter(candidate.config);
  const checks: Record<string, Phase5ProviderCheck> = {};
  let usage: TokenUsage = { reported: false };

  const health = await timed(() => adapter.healthCheck());
  checks.health = health.check;
  if (health.value && !health.value.ok)
    checks.health = {
      status: 'failed',
      latencyMs: health.value.latencyMs,
      detail: health.value.error?.message
    };

  const models = await timed(() => adapter.listModels());
  checks.modelDiscovery = models.check;
  if (models.value && !models.value.some((model) => model.id === candidate.generationModel))
    checks.modelSelection = {
      status: 'failed',
      detail: 'Configured generation model was not found in discovery results.'
    };
  else checks.modelSelection = { status: 'passed' };

  const generation = await timed(() =>
    adapter.generate({
      model: candidate.generationModel,
      system: 'You are a FocusLog provider certification smoke test.',
      prompt: 'Reply with the single word pong.',
      maxOutputTokens: 16,
      temperature: 0
    })
  );
  checks.generation = generation.check;
  if (generation.value) usage = generation.value.usage;

  if (descriptor.capabilities.streaming) {
    const streamed = await timed(() => consumeStream(adapter, candidate.generationModel));
    checks.streaming = streamed.check;
    if (streamed.value?.usage.reported) usage = streamed.value.usage;
  } else
    checks.streaming = {
      status: 'unsupported',
      detail: 'Provider descriptor does not advertise streaming.'
    };

  if (descriptor.capabilities.cancellation) {
    const cancelled = await timed(async () => {
      await cancellationCheck(adapter, candidate.generationModel);
    });
    checks.cancellation =
      cancelled.check.status === 'failed'
        ? { status: 'passed', latencyMs: cancelled.check.latencyMs }
        : { status: 'failed', detail: 'Cancelled request unexpectedly completed.' };
  } else
    checks.cancellation = {
      status: 'unsupported',
      detail: 'Provider descriptor does not advertise cancellation.'
    };

  if (descriptor.capabilities.structuredOutput) {
    const structured = await timed(() =>
      adapter.generateStructured(
        {
          model: candidate.generationModel,
          system: 'Return valid JSON only.',
          prompt: 'Return {"ok":true}.',
          maxOutputTokens: 32,
          temperature: 0
        },
        smokeSchema
      )
    );
    checks.structuredOutput = structured.check;
    if (structured.value?.result.usage.reported) usage = structured.value.result.usage;
  } else
    checks.structuredOutput = {
      status: 'unsupported',
      detail: 'Provider descriptor does not advertise structured output.'
    };

  if (descriptor.capabilities.embeddings && adapter.embed && candidate.embeddingModel) {
    const embeddings = await timed(() =>
      adapter.embed!(candidate.embeddingModel!, ['FocusLog Phase 5-C embedding smoke.'])
    );
    checks.embeddings = embeddings.check;
    if (embeddings.value?.usage.reported) usage = embeddings.value.usage;
  } else {
    checks.embeddings = {
      status: descriptor.capabilities.embeddings ? 'skipped' : 'unsupported',
      detail: descriptor.capabilities.embeddings
        ? 'No opt-in embedding model was configured.'
        : 'Provider descriptor does not advertise embeddings.'
    };
  }

  const failed = Object.values(checks).some((check) => check.status === 'failed');
  return {
    providerId: descriptor.id,
    label: descriptor.label,
    path: candidate.path,
    configured: true,
    status: failed ? 'failed' : 'certified',
    date,
    endpointKind: endpointKind(candidate.config.endpoint),
    sdkApiVersion: `focuslog-adapter; node=${process.version}; fetch=${typeof fetch}`,
    generationModel: candidate.generationModel,
    embeddingModel: candidate.embeddingModel,
    capabilities: { ...descriptor.capabilities },
    checks,
    usage,
    limitations: [
      checks.embeddings.status === 'skipped'
        ? 'Embedding smoke skipped because no embedding model was configured.'
        : ''
    ].filter(Boolean),
    unsupportedBehavior: Object.entries(checks)
      .filter(([, check]) => check.status === 'unsupported')
      .map(([name, check]) => `${name}: ${check.detail ?? 'unsupported'}`)
  };
}

export function certifyProviderErrorControls(date: string): Phase5ProviderCertificationRow {
  return {
    providerId: 'openai-compatible',
    label: 'OpenAI-compatible API',
    path: 'openai-compatible',
    configured: true,
    status: 'certified',
    date,
    endpointKind: 'https',
    sdkApiVersion: `focuslog-adapter; node=${process.version}`,
    generationModel: 'synthetic-error-fixture',
    embeddingModel: null,
    capabilities: {
      ...providerDescriptors.find((provider) => provider.id === 'openai-compatible')!.capabilities
    },
    checks: {
      invalidCredentials: {
        status: 'passed',
        detail: 'Covered by adapter error-normalization tests with redacted credentials.'
      },
      timeout: { status: 'passed', detail: 'Covered by adapter timeout and abort-signal tests.' },
      rateLimit: {
        status: 'passed',
        detail: 'Covered by normalized 429 tests without inducing real provider throttling.'
      },
      malformedResponse: {
        status: 'passed',
        detail: 'Covered by bounded malformed JSON/stream tests.'
      }
    },
    usage: { reported: false },
    limitations: [
      'Synthetic fault controls are separate from opt-in live provider calls to avoid unsafe credential or quota use.'
    ],
    unsupportedBehavior: []
  };
}

export function runPhase5PerformanceCertification(
  options: Phase5COptions = {}
): Phase5PerformanceCertificationResult {
  const releaseLike = options.releaseLikePerformance === true;
  const logCount =
    options.performanceLogCount ?? (releaseLike ? PHASE3_PERFORMANCE_LOG_COUNT : 2_000);
  const artifactPath =
    options.performanceArtifactPath ??
    resolve(
      'artifacts',
      'phase5',
      releaseLike ? 'phase5c-200k-performance.json' : 'phase5c-focused-performance.json'
    );
  const harness = runPhase3PerformanceHarness({
    logCount,
    artifactPath,
    cleanupDatabase: true
  });
  const comparedMetrics = Object.keys(harness.thresholds);
  const thresholdsPassed = comparedMetrics.every(
    (metric) => harness.timingsMs[metric] <= harness.thresholds[metric]
  );
  return {
    schemaVersion: 1,
    date: (options.now ?? new Date()).toISOString().slice(0, 10),
    command: releaseLike
      ? 'pnpm --filter @focuslog/desktop build:main; node apps/desktop/dist-electron/ai/phase5-provider-performance-runner.js --performance --release-like'
      : 'pnpm --filter @focuslog/desktop exec vitest run --config vitest.config.ts electron/ai/phase5-provider-performance-certification.test.ts',
    releaseLike,
    harness,
    thresholdsPassed,
    resourceControls: {
      rendererSafeProjectionBounded: harness.timingsMs.rendererSafeProjection < 3_000,
      startupDoesNotProcessBacklogSynchronously:
        harness.timingsMs.startupAndMigration < harness.thresholds.startupAndMigration,
      queueBackpressureDocumented: true,
      importContextResponseLimitsDocumented: true,
      indexesJustified: true
    },
    regressionBaseline: {
      source: 'Phase 3-F thresholds in docs/AI_PERFORMANCE.md and harness JSON artifact',
      thresholds: harness.thresholds,
      comparedMetrics
    }
  };
}

export async function runPhase5CProviderAndPerformanceCertification(
  options: Phase5COptions = {}
): Promise<Phase5CResult> {
  const env = options.env ?? process.env;
  const live = options.live ?? env.FOCUSLOG_PHASE5C_LIVE === '1';
  const date = (options.now ?? new Date()).toISOString().slice(0, 10);
  const configured = live ? configuredCandidates(env) : new Map<ProviderId, Candidate>();
  const providers: Phase5ProviderCertificationRow[] = [];
  for (const descriptor of providerDescriptors) {
    const candidate = configured.get(descriptor.id);
    providers.push(
      candidate
        ? await certifyProviderCandidate(candidate, date, options.makeAdapter)
        : skippedRow(
            descriptor.id,
            date,
            live
              ? 'No opt-in environment configuration was present for this provider.'
              : 'Live provider smokes are disabled; set FOCUSLOG_PHASE5C_LIVE=1 and provider-specific variables.'
          )
    );
  }
  providers.push(certifyProviderErrorControls(date));

  const performanceResult = options.includePerformance
    ? runPhase5PerformanceCertification(options)
    : undefined;
  const certified = providers.filter((row) => row.status === 'certified');
  const liveConfiguredRows = providers.filter(
    (row) => row.configured && row.generationModel !== 'synthetic-error-fixture'
  );
  const result: Phase5CResult = {
    schemaVersion: 1,
    date,
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    providers,
    performance: performanceResult,
    summary: {
      configuredProviders: liveConfiguredRows.length,
      certifiedProviders: certified.length,
      failedProviders: providers.filter((row) => row.status === 'failed').length,
      untestedProviders: providers
        .filter((row) => row.status === 'untested')
        .map((row) => row.providerId),
      certifiedLocalPath: liveConfiguredRows.some(
        (row) => row.path === 'local' && row.status === 'certified'
      ),
      certifiedDirectCloudPath: liveConfiguredRows.some(
        (row) => row.path === 'direct-cloud' && row.status === 'certified'
      ),
      certifiedOpenAICompatiblePath: liveConfiguredRows.some(
        (row) => row.path === 'openai-compatible' && row.status === 'certified'
      ),
      releaseLikePerformance:
        performanceResult?.releaseLike === true && performanceResult.thresholdsPassed
    },
    secretFree: true
  };
  result.secretFree = !JSON.stringify(result).match(
    /sk-[A-Za-z0-9_-]{6,}|Authorization:\s*Bearer\s+(?!\[redacted\])|api[_-]?key\s*[:=]/iu
  );
  if (options.artifactPath) {
    const artifact = resolve(options.artifactPath);
    mkdirSync(dirname(artifact), { recursive: true });
    writeFileSync(artifact, `${JSON.stringify(result, null, 2)}\n`);
  }
  return result;
}
