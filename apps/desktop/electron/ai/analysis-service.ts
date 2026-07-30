import { createHash } from 'node:crypto';
import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import { createProviderAdapter } from './providers.js';
import { loadBuiltinPrompt, renderPrompt } from './prompts.js';
import { ProviderExecutionCoordinator } from './provider-execution-coordinator.js';
import { usdToMicros } from './budget-service.js';
import type { CoordinatorEntry } from './provider-execution-coordinator.js';
import { PricingCatalog } from './pricing-catalog.js';
import type { AIService } from './ai-service.js';
import { AIError, AIProcessLossFault } from './errors.js';
import { dailyPeriodBounds, validateTimeZone } from './daily-analysis-job.js';
import type { GenerationResult, PrivacyMode } from './types.js';
import { dailyAnalysisSchema, type DailyAnalysisResultV1 } from './daily-analysis-schema.js';
import { HierarchicalAnalysisService } from './hierarchical-analysis-service.js';

interface SourceRecord {
  checkInId: string;
  revisionId: string;
  body: string;
  submittedAt: string;
}

function now(): string {
  return new Date().toISOString();
}

export class AnalysisService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly ai: AIService
  ) {}

  private dailySources(day: string, timezone: string, contextTokens: number): SourceRecord[] {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(day))
      throw new AIError('VALIDATION', 'Choose a valid analysis day.');
    const bounds = dailyPeriodBounds(day, timezone);
    const candidates = this.database
      .prepare(
        `SELECT check_ins.id AS checkInId, check_in_revisions.id AS revisionId,
              check_in_revisions.body AS body, check_ins.submitted_at AS submittedAt
         FROM check_ins JOIN check_in_revisions ON check_in_revisions.id = check_ins.current_revision_id
        WHERE check_ins.owner_id = ? AND check_ins.deleted_at IS NULL
          AND check_ins.submitted_at >= ? AND check_ins.submitted_at < ?
        ORDER BY check_ins.submitted_at ASC LIMIT 1000`
      )
      .all(this.ownerId, bounds.periodStartUtc, bounds.periodEndUtc) as SourceRecord[];
    const maxCharacters = contextTokens * 4;
    const included: SourceRecord[] = [];
    let size = 0;
    for (const record of candidates) {
      const cost = record.body.length + 96;
      if (included.length > 0 && size + cost > maxCharacters) break;
      included.push(record);
      size += cost;
    }
    return included;
  }

  dailySourceRevisionHash(day: string, timezone = 'UTC'): string {
    const settings = this.ai.getSettings();
    const sources = this.dailySources(day, validateTimeZone(timezone), settings.maxContextTokens);
    return createHash('sha256')
      .update(sources.map((source) => source.revisionId).join(','))
      .digest('hex');
  }

  async analyzeDaily(
    profileId: string,
    day: string,
    options: {
      signal?: AbortSignal;
      jobId?: string;
      timezone?: string;
      expectedModel?: string;
      expectedPrivacyMode?: PrivacyMode;
      fault?: 'after_validation_before_persistence' | 'after_persistence_before_acknowledgement';
      lease?: { workerId: string; token: string };
      coordinatorHooks?: {
        afterPolicyValidation?(): void | Promise<void>;
        afterReservation?(): void | Promise<void>;
        beforeFallback?(entry: CoordinatorEntry): void | Promise<void>;
      };
    } = {}
  ): Promise<{ id: string; content: string; sourceCount: number }> {
    if (options.signal?.aborted)
      throw new AIError('CANCELLATION', 'The daily analysis was cancelled.', false);
    const settings = this.ai.getSettings();
    const config = this.ai.requireExecution(profileId, 'analyses');
    if (options.expectedPrivacyMode && settings.mode !== options.expectedPrivacyMode)
      throw new AIError(
        'PERMISSION',
        'AI privacy settings changed after this daily analysis was queued. Enqueue it again to use the new policy.'
      );
    if (!config.profile.generationModel)
      throw new AIError(
        'INVALID_CONFIGURATION',
        'Select a generation model for this provider profile.'
      );
    if (options.expectedModel && config.profile.generationModel !== options.expectedModel)
      throw new AIError(
        'INVALID_CONFIGURATION',
        'The selected provider model changed after this daily analysis was queued. Enqueue it again.'
      );
    const timezone = validateTimeZone(options.timezone ?? 'UTC');
    const sources = this.dailySources(day, timezone, settings.maxContextTokens);
    if (sources.length === 0)
      throw new AIError('VALIDATION', 'There are no recorded check-ins for that day.');
    if (options.jobId) {
      const existing = this.database
        .prepare('SELECT id, content FROM ai_memories WHERE owner_id = ? AND job_id = ? LIMIT 1')
        .get(this.ownerId, options.jobId) as { id: string; content: string } | undefined;
      if (existing) return { ...existing, sourceCount: sources.length };
    }
    const renderedSources = sources
      .map(
        (source) =>
          `[${source.submittedAt}] (${source.checkInId}/${source.revisionId})\n${source.body}`
      )
      .join('\n\n');
    const prompt = loadBuiltinPrompt('daily');
    const rendered = renderPrompt(prompt.content, {
      selected_day: day,
      selected_logs: renderedSources
    });
    const structuredSchema = dailyAnalysisSchema(
      day,
      new Set(sources.map((source) => source.checkInId))
    );
    const started = performance.now();
    const selectedModel = config.profile.generationModel;
    if (!selectedModel)
      throw new AIError(
        'INVALID_CONFIGURATION',
        'Select a generation model for this provider profile.'
      );
    const generationRequest = {
      model: selectedModel,
      prompt: rendered,
      maxOutputTokens: Math.min(settings.maxOutputTokens, config.profile.maxOutputTokens),
      temperature: config.profile.temperature,
      topP: config.profile.topP,
      signal: options.signal
    };
    // Jobs must use the single production coordinator.  Direct/manual analysis retains
    // the same adapter call because it has no durable queue job to reserve against.
    const durableJobRecord = options.jobId
      ? (this.database
          .prepare('SELECT attempts FROM ai_jobs WHERE id = ? AND owner_id = ?')
          .get(options.jobId, this.ownerId) as { attempts: number } | undefined)
      : undefined;
    const durableJob = Boolean(durableJobRecord);
    const snapshot =
      durableJob && options.jobId
        ? (this.database
            .prepare(
              'SELECT snapshot_json AS snapshot FROM ai_job_fallback_snapshots WHERE job_id = ? AND owner_id = ?'
            )
            .get(options.jobId, this.ownerId) as { snapshot: string } | undefined)
        : undefined;
    const parsedSnapshot = snapshot
      ? (() => {
          const parsed = JSON.parse(snapshot.snapshot) as {
            schemaVersion?: number;
            entries?: CoordinatorEntry[];
            requestCapMicros?: number | null;
          };
          if (
            parsed.schemaVersion !== 1 ||
            !Array.isArray(parsed.entries) ||
            !parsed.entries.length
          )
            throw new AIError('VALIDATION', 'The queued fallback snapshot is unsupported.');
          return parsed;
        })()
      : undefined;
    const entries: CoordinatorEntry[] = snapshot
      ? parsedSnapshot!.entries!
      : [
          {
            providerProfileId: config.profile.id,
            providerType: config.profile.providerId,
            model: selectedModel,
            maxSameProviderRetries: config.profile.retryLimit,
            allowFallback: false
          }
        ];
    const pricing = new PricingCatalog();
    const settingsRequestCap =
      settings.requestCostCapUsd === null
        ? null
        : usdToMicros(settings.requestCostCapUsd.toFixed(6));
    const queuedRequestCap = parsedSnapshot?.requestCapMicros ?? null;
    const effectiveRequestCap =
      settingsRequestCap === null
        ? queuedRequestCap
        : queuedRequestCap === null
          ? settingsRequestCap
          : Math.min(settingsRequestCap, queuedRequestCap);
    let actualProfileId = config.profile.id;
    let actualModel = selectedModel;
    const result = durableJob
      ? (() => undefined)()
      : await createProviderAdapter(config).generate(generationRequest);
    const coordinated = durableJob
      ? await new ProviderExecutionCoordinator(
          this.database,
          this.ownerId
        ).execute<GenerationResult>({
          jobId: options.jobId!,
          queueAttempt: durableJobRecord!.attempts,
          signal: options.signal,
          lease: options.lease,
          hooks: options.coordinatorHooks,
          enforceCurrentPolicy: true,
          entries,
          budget: {
            requestCapMicros: effectiveRequestCap,
            monthlyLimitMicros:
              settings.monthlyCloudBudgetUsd === null
                ? null
                : usdToMicros(settings.monthlyCloudBudgetUsd.toFixed(6)),
            pricingQuote: (entry) =>
              pricing.quote(entry.providerType, entry.model, {
                inputTokens: Math.ceil(rendered.length / 4),
                outputTokens: generationRequest.maxOutputTokens
              }),
            actualMicros: (value, _entry, snapshot) =>
              pricing.estimateFromSnapshot(snapshot, {
                inputTokens: value.usage.inputTokens ?? Math.ceil(rendered.length / 4),
                outputTokens: value.usage.outputTokens ?? generationRequest.maxOutputTokens
              })
          },
          invoke: async (entry, signal) => {
            const current =
              entry.providerProfileId === config.profile.id
                ? config
                : this.ai.requireExecution(entry.providerProfileId, 'analyses');
            return createProviderAdapter(current).generate({
              ...generationRequest,
              model: entry.model,
              signal
            });
          }
        })
      : undefined;
    if (coordinated) {
      actualProfileId = coordinated.providerProfileId;
      actualModel = coordinated.model;
    }
    let generated = coordinated?.value ?? result!;
    let structured: DailyAnalysisResultV1;
    try {
      structured = structuredSchema.parse(JSON.parse(generated.text));
    } catch (error) {
      if (!durableJob) throw error;
      const validationMessage =
        error instanceof AIError ? error.message : 'The response was not valid JSON.';
      const repairPrompt = `Return only corrected daily structured JSON. Schema version: 1. Allowed period: ${day}. Allowed evidence IDs: ${sources.map((source) => source.checkInId).join(', ') || '(none)'}. Validation error: ${validationMessage}. <untrusted_invalid_output>${generated.text.slice(0, 4_000)}</untrusted_invalid_output>`;
      const repaired = await new ProviderExecutionCoordinator(
        this.database,
        this.ownerId
      ).execute<GenerationResult>({
        jobId: options.jobId!,
        queueAttempt: durableJobRecord!.attempts,
        signal: options.signal,
        lease: options.lease,
        enforceCurrentPolicy: true,
        operationType: 'structured_repair',
        repairIndex: 1,
        entries,
        budget: {
          requestCapMicros: effectiveRequestCap,
          monthlyLimitMicros:
            settings.monthlyCloudBudgetUsd === null
              ? null
              : usdToMicros(settings.monthlyCloudBudgetUsd.toFixed(6)),
          pricingQuote: (entry) =>
            pricing.quote(entry.providerType, entry.model, {
              inputTokens: Math.ceil(repairPrompt.length / 4),
              outputTokens: generationRequest.maxOutputTokens
            }),
          actualMicros: (value, _entry, snapshot) =>
            pricing.estimateFromSnapshot(snapshot, {
              inputTokens: value.usage.inputTokens ?? Math.ceil(repairPrompt.length / 4),
              outputTokens: value.usage.outputTokens ?? generationRequest.maxOutputTokens
            })
        },
        invoke: async (entry, signal) => {
          const current =
            entry.providerProfileId === config.profile.id
              ? config
              : this.ai.requireExecution(entry.providerProfileId, 'analyses');
          return createProviderAdapter(current).generate({
            ...generationRequest,
            model: entry.model,
            prompt: repairPrompt,
            signal
          });
        }
      });
      actualProfileId = repaired.providerProfileId;
      actualModel = repaired.model;
      generated = repaired.value;
      try {
        structured = structuredSchema.parse(JSON.parse(generated.text));
      } catch {
        throw new AIError(
          'VALIDATION',
          'The provider did not return a valid repaired daily result.'
        );
      }
    }
    if (options.signal?.aborted)
      throw new AIError('CANCELLATION', 'The daily analysis was cancelled.', false);
    const timestamp = now();
    if (options.fault === 'after_validation_before_persistence')
      throw new AIError('PROVIDER_UNAVAILABLE', 'Injected daily-analysis interruption.', true);
    const id = ulid();
    let persistedId = id;
    let persistedContent = structured.summary;
    const version =
      (
        this.database
          .prepare(
            'SELECT COALESCE(MAX(version), 0) AS version FROM ai_memories WHERE owner_id = ? AND period_kind = ? AND period_key = ?'
          )
          .get(this.ownerId, 'DAY', day) as { version: number }
      ).version + 1;
    const previousDaily = this.database
      .prepare(
        "SELECT id FROM ai_memories WHERE owner_id = ? AND period_kind = 'DAY' AND period_key = ? AND status = 'ACTIVE'"
      )
      .all(this.ownerId, day) as Array<{ id: string }>;
    this.database.transaction(() => {
      if (options.signal?.aborted)
        throw new AIError('CANCELLATION', 'The daily analysis was cancelled.', false);
      if (options.jobId) {
        const existing = this.database
          .prepare('SELECT id, content FROM ai_memories WHERE owner_id = ? AND job_id = ? LIMIT 1')
          .get(this.ownerId, options.jobId) as { id: string; content: string } | undefined;
        if (existing) {
          persistedId = existing.id;
          persistedContent = existing.content;
          return;
        }
      }
      this.database
        .prepare(
          'UPDATE ai_memories SET status = ?, superseded_at = ? WHERE owner_id = ? AND period_kind = ? AND period_key = ? AND status = ?'
        )
        .run('SUPERSEDED', timestamp, this.ownerId, 'DAY', day, 'ACTIVE');
      this.database
        .prepare(
          'INSERT INTO ai_memories (id, owner_id, period_kind, period_key, version, status, content, schema_version, prompt_version, provider_profile_id, source_revision_watermark, job_id, created_at, structured_result_json, structured_schema_version, validation_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          id,
          this.ownerId,
          'DAY',
          day,
          version,
          'ACTIVE',
          structured.summary,
          '1',
          prompt.version,
          actualProfileId,
          createHash('sha256')
            .update(sources.map((source) => source.revisionId).join(','))
            .digest('hex'),
          options.jobId ?? null,
          timestamp,
          JSON.stringify(structured),
          1,
          'valid'
        );
      const evidence = this.database.prepare(
        'INSERT INTO ai_memory_sources (memory_id, check_in_id, revision_id) VALUES (?, ?, ?)'
      );
      for (const source of sources) evidence.run(id, source.checkInId, source.revisionId);
      this.database
        .prepare(
          'INSERT INTO ai_usage_records (id, owner_id, job_id, purpose, provider_profile_id, model_id, prompt_version, duration_ms, input_tokens, output_tokens, total_tokens, usage_reported, estimated_cost_usd, pricing_version, outcome, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          ulid(),
          this.ownerId,
          options.jobId ?? null,
          'daily-analysis',
          actualProfileId,
          actualModel,
          prompt.version,
          Math.round(performance.now() - started),
          generated.usage.inputTokens ?? null,
          generated.usage.outputTokens ?? null,
          generated.usage.totalTokens ?? null,
          Number(generated.usage.reported),
          null,
          null,
          'SUCCESS',
          timestamp
        );
      if (options.jobId && durableJob)
        this.database
          .prepare(
            'UPDATE ai_jobs SET actual_profile_id = ?, actual_model_id = ?, updated_at = ? WHERE id = ? AND owner_id = ?'
          )
          .run(actualProfileId, actualModel, timestamp, options.jobId, this.ownerId);
    })();
    if (previousDaily.length)
      new HierarchicalAnalysisService(this.database, this.ownerId, this.ai).markDependentsStale(
        previousDaily.map((item) => item.id),
        'Daily analysis was regenerated.'
      );
    if (options.fault === 'after_persistence_before_acknowledgement')
      throw new AIProcessLossFault();
    return { id: persistedId, content: persistedContent, sourceCount: sources.length };
  }

  latestDaily(
    day: string
  ): { id: string; content: string; createdAt: string; sourceCount: number } | null {
    const memory = this.database
      .prepare(
        `SELECT id, content, created_at AS createdAt FROM ai_memories WHERE owner_id = ? AND period_kind = 'DAY' AND period_key = ? AND status = 'ACTIVE' ORDER BY version DESC LIMIT 1`
      )
      .get(this.ownerId, day) as { id: string; content: string; createdAt: string } | undefined;
    if (!memory) return null;
    const sourceCount = (
      this.database
        .prepare('SELECT COUNT(*) AS count FROM ai_memory_sources WHERE memory_id = ?')
        .get(memory.id) as { count: number }
    ).count;
    return { ...memory, sourceCount };
  }
}
