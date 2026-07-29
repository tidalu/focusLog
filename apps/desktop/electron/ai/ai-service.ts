import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import { DesktopCredentialStore } from './credentials.js';
import { AIError } from './errors.js';
import { createProviderAdapter, providerDescriptor, providerDescriptors } from './providers.js';
import type {
  AISettings,
  ConnectionTestResult,
  ModelDescriptor,
  PrivacyMode,
  ProviderId,
  ProviderProfile,
  ResolvedProviderConfig
} from './types.js';
import { validateProviderEndpoint } from './url-security.js';

const defaultFlags = {
  analyses: true,
  facts: true,
  graph: true,
  embeddings: true,
  playground: true
};
const defaultSettings: AISettings = {
  mode: 'DISABLED',
  maxContextTokens: 12_000,
  maxOutputTokens: 2_048,
  monthlyCloudBudgetUsd: null,
  requestCostCapUsd: null,
  dataSharingPreview: true,
  automaticAnalysis: false,
  featureFlags: defaultFlags
};

type ProfileRow = Omit<
  ProviderProfile,
  'enabled' | 'automaticAnalysis' | 'credentialConfigured'
> & {
  enabled: number;
  automaticAnalysis: number;
  credentialConfigured: number;
};

function now(): string {
  return new Date().toISOString();
}
function asBoolean(value: number): boolean {
  return value === 1;
}

function toProfile(row: ProfileRow): ProviderProfile {
  return {
    ...row,
    enabled: asBoolean(row.enabled),
    automaticAnalysis: asBoolean(row.automaticAnalysis),
    credentialConfigured: asBoolean(row.credentialConfigured)
  };
}

export class AIService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly credentials: DesktopCredentialStore
  ) {}

  descriptors() {
    return providerDescriptors;
  }

  getSettings(): AISettings {
    const row = this.database
      .prepare(
        `SELECT mode, max_context_tokens AS maxContextTokens, max_output_tokens AS maxOutputTokens,
              monthly_cloud_budget_usd AS monthlyCloudBudgetUsd, request_cost_cap_usd AS requestCostCapUsd,
              data_sharing_preview AS dataSharingPreview, automatic_analysis AS automaticAnalysis,
              analyses_enabled AS analyses, facts_enabled AS facts, graph_enabled AS graph,
              embeddings_enabled AS embeddings, playground_enabled AS playground
         FROM ai_settings WHERE owner_id = ?`
      )
      .get(this.ownerId) as
      | (Omit<AISettings, 'featureFlags' | 'dataSharingPreview' | 'automaticAnalysis'> & {
          dataSharingPreview: number;
          automaticAnalysis: number;
          analyses: number;
          facts: number;
          graph: number;
          embeddings: number;
          playground: number;
        })
      | undefined;
    if (!row) return { ...defaultSettings, featureFlags: { ...defaultFlags } };
    return {
      mode: row.mode,
      maxContextTokens: row.maxContextTokens,
      maxOutputTokens: row.maxOutputTokens,
      monthlyCloudBudgetUsd: row.monthlyCloudBudgetUsd,
      requestCostCapUsd: row.requestCostCapUsd,
      dataSharingPreview: asBoolean(row.dataSharingPreview),
      automaticAnalysis: asBoolean(row.automaticAnalysis),
      featureFlags: {
        analyses: asBoolean(row.analyses),
        facts: asBoolean(row.facts),
        graph: asBoolean(row.graph),
        embeddings: asBoolean(row.embeddings),
        playground: asBoolean(row.playground)
      }
    };
  }

  saveSettings(input: AISettings): AISettings {
    const timestamp = now();
    this.database
      .prepare(
        `INSERT INTO ai_settings (owner_id, mode, max_context_tokens, max_output_tokens, monthly_cloud_budget_usd, request_cost_cap_usd, data_sharing_preview, automatic_analysis, analyses_enabled, facts_enabled, graph_enabled, embeddings_enabled, playground_enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(owner_id) DO UPDATE SET mode=excluded.mode, max_context_tokens=excluded.max_context_tokens, max_output_tokens=excluded.max_output_tokens, monthly_cloud_budget_usd=excluded.monthly_cloud_budget_usd, request_cost_cap_usd=excluded.request_cost_cap_usd, data_sharing_preview=excluded.data_sharing_preview, automatic_analysis=excluded.automatic_analysis, analyses_enabled=excluded.analyses_enabled, facts_enabled=excluded.facts_enabled, graph_enabled=excluded.graph_enabled, embeddings_enabled=excluded.embeddings_enabled, playground_enabled=excluded.playground_enabled, updated_at=excluded.updated_at`
      )
      .run(
        this.ownerId,
        input.mode,
        input.maxContextTokens,
        input.maxOutputTokens,
        input.monthlyCloudBudgetUsd,
        input.requestCostCapUsd,
        Number(input.dataSharingPreview),
        Number(input.automaticAnalysis),
        Number(input.featureFlags.analyses),
        Number(input.featureFlags.facts),
        Number(input.featureFlags.graph),
        Number(input.featureFlags.embeddings),
        Number(input.featureFlags.playground),
        timestamp
      );
    return this.getSettings();
  }

  profiles(): ProviderProfile[] {
    const rows = this.database
      .prepare(
        `SELECT id, owner_id AS ownerId, name, provider_id AS providerId, enabled, endpoint,
              generation_model AS generationModel, embedding_model AS embeddingModel, temperature,
              top_p AS topP, max_output_tokens AS maxOutputTokens, timeout_ms AS timeoutMs,
              retry_limit AS retryLimit, concurrency_limit AS concurrencyLimit,
              automatic_analysis AS automaticAnalysis, priority, monthly_budget_usd AS monthlyBudgetUsd,
              credential_configured AS credentialConfigured, created_at AS createdAt, updated_at AS updatedAt
         FROM ai_provider_profiles WHERE owner_id = ? ORDER BY priority, name`
      )
      .all(this.ownerId) as ProfileRow[];
    return rows.map(toProfile);
  }

  profile(id: string): ProviderProfile {
    const result = this.profiles().find((profile) => profile.id === id);
    if (!result)
      throw new AIError(
        'INVALID_CONFIGURATION',
        'The selected AI provider profile no longer exists.'
      );
    return result;
  }

  saveProfile(
    input: Partial<ProviderProfile> & { name: string; providerId: ProviderId; credential?: string }
  ): ProviderProfile {
    const descriptor = providerDescriptor(input.providerId);
    const id = input.id ?? ulid();
    const existing = input.id ? this.profile(input.id) : undefined;
    const endpoint =
      input.endpoint === null
        ? null
        : validateProviderEndpoint(
            input.endpoint || existing?.endpoint || descriptor.defaultEndpoint || '',
            descriptor.kind === 'LOCAL'
          );
    const timestamp = now();
    const value = {
      name: input.name.trim(),
      enabled: input.enabled ?? existing?.enabled ?? false,
      generationModel: input.generationModel ?? existing?.generationModel ?? null,
      embeddingModel: input.embeddingModel ?? existing?.embeddingModel ?? null,
      temperature: input.temperature ?? existing?.temperature ?? 0.2,
      topP: input.topP ?? existing?.topP ?? 1,
      maxOutputTokens: input.maxOutputTokens ?? existing?.maxOutputTokens ?? 2_048,
      timeoutMs: input.timeoutMs ?? existing?.timeoutMs ?? 30_000,
      retryLimit: input.retryLimit ?? existing?.retryLimit ?? 2,
      concurrencyLimit: input.concurrencyLimit ?? existing?.concurrencyLimit ?? 1,
      automaticAnalysis: input.automaticAnalysis ?? existing?.automaticAnalysis ?? false,
      priority: input.priority ?? existing?.priority ?? 100,
      monthlyBudgetUsd: input.monthlyBudgetUsd ?? existing?.monthlyBudgetUsd ?? null
    };
    if (!value.name) throw new AIError('VALIDATION', 'A provider profile needs a name.');
    if (value.timeoutMs < 1_000 || value.timeoutMs > 120_000)
      throw new AIError('VALIDATION', 'Provider timeout must be between 1 and 120 seconds.');
    if (value.maxOutputTokens < 1 || value.maxOutputTokens > 32_000)
      throw new AIError('VALIDATION', 'Maximum output tokens must be between 1 and 32,000.');
    const credentialConfigured =
      input.credential === undefined
        ? (existing?.credentialConfigured ?? false)
        : Boolean(input.credential.trim());
    this.database
      .prepare(
        `INSERT INTO ai_provider_profiles (id, owner_id, name, provider_id, enabled, endpoint, generation_model, embedding_model, temperature, top_p, max_output_tokens, timeout_ms, retry_limit, concurrency_limit, automatic_analysis, priority, monthly_budget_usd, credential_configured, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, provider_id=excluded.provider_id, enabled=excluded.enabled, endpoint=excluded.endpoint, generation_model=excluded.generation_model, embedding_model=excluded.embedding_model, temperature=excluded.temperature, top_p=excluded.top_p, max_output_tokens=excluded.max_output_tokens, timeout_ms=excluded.timeout_ms, retry_limit=excluded.retry_limit, concurrency_limit=excluded.concurrency_limit, automatic_analysis=excluded.automatic_analysis, priority=excluded.priority, monthly_budget_usd=excluded.monthly_budget_usd, credential_configured=excluded.credential_configured, updated_at=excluded.updated_at`
      )
      .run(
        id,
        this.ownerId,
        value.name,
        input.providerId,
        Number(value.enabled),
        endpoint,
        value.generationModel,
        value.embeddingModel,
        value.temperature,
        value.topP,
        value.maxOutputTokens,
        value.timeoutMs,
        value.retryLimit,
        value.concurrencyLimit,
        Number(value.automaticAnalysis),
        value.priority,
        value.monthlyBudgetUsd,
        Number(credentialConfigured),
        existing?.createdAt ?? timestamp,
        timestamp
      );
    if (input.credential !== undefined) {
      if (input.credential.trim()) this.credentials.set(id, input.credential);
      else this.credentials.delete(id);
      this.database
        .prepare(
          'UPDATE ai_provider_profiles SET credential_configured = ?, updated_at = ? WHERE id = ?'
        )
        .run(Number(Boolean(input.credential.trim())), timestamp, id);
    }
    return this.profile(id);
  }

  removeProfile(id: string): void {
    this.profile(id);
    this.database.transaction(() => {
      this.database.prepare('DELETE FROM ai_provider_model_cache WHERE profile_id = ?').run(id);
      this.database
        .prepare('DELETE FROM ai_cloud_consents WHERE provider_profile_id = ? AND owner_id = ?')
        .run(id, this.ownerId);
      this.database
        .prepare('DELETE FROM ai_provider_profiles WHERE id = ? AND owner_id = ?')
        .run(id, this.ownerId);
    })();
    this.credentials.delete(id);
  }

  private resolvedProfile(profileId: string): ResolvedProviderConfig {
    const profile = this.profile(profileId);
    const descriptor = providerDescriptor(profile.providerId);
    const endpoint = profile.endpoint || descriptor.defaultEndpoint;
    if (!endpoint) throw new AIError('INVALID_CONFIGURATION', 'This provider needs an endpoint.');
    return { profile, endpoint, apiKey: this.credentials.get(profile.id) };
  }

  private storeModels(profileId: string, models: ModelDescriptor[]): void {
    const timestamp = now();
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    this.database.transaction(() => {
      this.database
        .prepare('DELETE FROM ai_provider_model_cache WHERE profile_id = ?')
        .run(profileId);
      const insert = this.database.prepare(
        'INSERT INTO ai_provider_model_cache (profile_id, model_id, display_name, context_window, cached_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const model of models)
        insert.run(
          profileId,
          model.id,
          model.displayName,
          model.contextWindow ?? null,
          timestamp,
          expiresAt
        );
    })();
  }

  cachedModels(profileId: string): { models: ModelDescriptor[]; stale: boolean } {
    const rows = this.database
      .prepare(
        'SELECT model_id AS id, display_name AS displayName, context_window AS contextWindow, expires_at AS expiresAt FROM ai_provider_model_cache WHERE profile_id = ? ORDER BY display_name'
      )
      .all(profileId) as Array<ModelDescriptor & { expiresAt: string }>;
    return {
      models: rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        contextWindow: row.contextWindow
      })),
      stale: rows.some((row) => row.expiresAt < now())
    };
  }

  async refreshModels(
    profileId: string,
    signal?: AbortSignal
  ): Promise<{ models: ModelDescriptor[]; stale: boolean }> {
    const adapter = createProviderAdapter(this.resolvedProfile(profileId));
    const models = await adapter.listModels(signal);
    this.storeModels(profileId, models);
    return { models, stale: false };
  }

  async testConnection(profileId: string, signal?: AbortSignal): Promise<ConnectionTestResult> {
    const config = this.resolvedProfile(profileId);
    const adapter = createProviderAdapter(config);
    const health = await adapter.healthCheck(signal);
    let cached = this.cachedModels(profileId);
    if (health.ok) {
      try {
        cached = await this.refreshModels(profileId, signal);
      } catch {
        /* health result remains useful; retain stale cache. */
      }
    }
    return {
      ...health,
      provider: adapter.descriptor,
      endpoint: config.endpoint,
      selectedModel: config.profile.generationModel,
      capabilities: adapter.descriptor.capabilities,
      models: cached.models,
      modelsStale: cached.stale
    };
  }

  requireExecution(
    profileId: string,
    purpose: keyof AISettings['featureFlags']
  ): ResolvedProviderConfig {
    const settings = this.getSettings();
    if (!settings.featureFlags[purpose])
      throw new AIError(
        'UNSUPPORTED_CAPABILITY',
        `${purpose} is disabled by its AI feature switch.`
      );
    if (settings.mode === 'DISABLED')
      throw new AIError('INVALID_CONFIGURATION', 'AI is disabled in FocusLog settings.');
    const config = this.resolvedProfile(profileId);
    const descriptor = providerDescriptor(config.profile.providerId);
    if (!config.profile.enabled)
      throw new AIError('INVALID_CONFIGURATION', 'This provider profile is disabled.');
    if (settings.mode === 'LOCAL' && descriptor.kind !== 'LOCAL')
      throw new AIError('PERMISSION', 'Local privacy mode never sends data to cloud providers.');
    if (descriptor.kind === 'CLOUD') {
      const consent = this.database
        .prepare(
          'SELECT 1 FROM ai_cloud_consents WHERE owner_id = ? AND provider_profile_id = ? AND mode = ?'
        )
        .get(this.ownerId, profileId, settings.mode);
      if (!consent)
        throw new AIError(
          'PERMISSION',
          'Cloud consent is required before FocusLog can send data to this provider.'
        );
    }
    return config;
  }

  grantCloudConsent(profileId: string): void {
    const profile = this.profile(profileId);
    if (providerDescriptor(profile.providerId).kind !== 'CLOUD') return;
    const mode: PrivacyMode = this.getSettings().mode;
    if (mode !== 'CLOUD' && mode !== 'HYBRID')
      throw new AIError(
        'VALIDATION',
        'Choose Cloud or Hybrid privacy mode before granting cloud consent.'
      );
    this.database
      .prepare(
        'INSERT OR IGNORE INTO ai_cloud_consents (id, owner_id, provider_profile_id, mode, consented_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(ulid(), this.ownerId, profileId, mode, now());
  }
}
