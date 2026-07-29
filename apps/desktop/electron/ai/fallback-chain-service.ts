import { ulid } from 'ulid';

import type { DesktopDatabase } from '../database/database.js';
import { AIError } from './errors.js';
import { providerDescriptor } from './providers.js';
import type { PrivacyMode, ProviderProfile } from './types.js';

export interface FallbackEntryInput {
  providerProfileId: string;
  modelOverride?: string | null;
  enabled?: boolean;
  maxSameProviderRetries?: number;
  allowFallback?: boolean;
}
export interface FallbackChainInput {
  name: string;
  enabled?: boolean;
  scope?: string;
  purpose?: string | null;
  entries: FallbackEntryInput[];
}
export interface FallbackSnapshot {
  schemaVersion: 1;
  chainId: string;
  chainVersion: number;
  privacyMode: PrivacyMode;
  createdAt: string;
  entries: Array<{
    position: number;
    providerProfileId: string;
    providerType: string;
    model: string;
    maxSameProviderRetries: number;
    allowFallback: boolean;
  }>;
}

const stamp = () => new Date().toISOString();
type ProfileDbRow = Omit<
  ProviderProfile,
  'enabled' | 'automaticAnalysis' | 'credentialConfigured'
> & { enabled: number; automaticAnalysis: number; credentialConfigured: number };
type EntryRow = {
  position: number;
  providerProfileId: string;
  modelOverride: string | null;
  classification: 'LOCAL' | 'CLOUD';
  errorPolicy: string;
};

/** Durable fallback configuration; credentials are intentionally never part of this model. */
export class FallbackChainService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string
  ) {}

  private profiles(): ProviderProfile[] {
    return (
      this.database
        .prepare(
          `SELECT id, owner_id AS ownerId, name, provider_id AS providerId, enabled, endpoint, generation_model AS generationModel, embedding_model AS embeddingModel, temperature, top_p AS topP, max_output_tokens AS maxOutputTokens, timeout_ms AS timeoutMs, retry_limit AS retryLimit, concurrency_limit AS concurrencyLimit, automatic_analysis AS automaticAnalysis, priority, monthly_budget_usd AS monthlyBudgetUsd, credential_configured AS credentialConfigured, created_at AS createdAt, updated_at AS updatedAt FROM ai_provider_profiles WHERE owner_id = ?`
        )
        .all(this.ownerId) as ProfileDbRow[]
    ).map((row) => ({
      ...row,
      enabled: row.enabled === 1,
      automaticAnalysis: row.automaticAnalysis === 1,
      credentialConfigured: row.credentialConfigured === 1
    }));
  }

  validate(input: FallbackChainInput, privacyMode: PrivacyMode): void {
    if (!input.name.trim()) throw new AIError('VALIDATION', 'A fallback chain needs a name.');
    const enabled = input.entries.filter((entry) => entry.enabled !== false);
    if (input.enabled !== false && enabled.length === 0)
      throw new AIError('VALIDATION', 'An enabled fallback chain needs an enabled entry.');
    const profiles = new Map(this.profiles().map((profile) => [profile.id, profile]));
    const duplicate = new Set<string>();
    for (const entry of input.entries) {
      const profile = profiles.get(entry.providerProfileId);
      if (!profile)
        throw new AIError('INVALID_CONFIGURATION', 'A fallback entry profile no longer exists.');
      if (!profile.enabled)
        throw new AIError('INVALID_CONFIGURATION', 'A fallback entry profile is disabled.');
      if (
        entry.modelOverride !== undefined &&
        entry.modelOverride !== null &&
        !entry.modelOverride.trim()
      )
        throw new AIError('VALIDATION', 'A fallback model override cannot be empty.');
      if ((entry.maxSameProviderRetries ?? 1) < 0 || (entry.maxSameProviderRetries ?? 1) > 3)
        throw new AIError('VALIDATION', 'Fallback retries must be between zero and three.');
      const key = `${profile.id}\u001f${entry.modelOverride ?? profile.generationModel ?? ''}`;
      if (duplicate.has(key))
        throw new AIError(
          'VALIDATION',
          'Fallback entries cannot duplicate the same provider and model.'
        );
      duplicate.add(key);
      if (privacyMode === 'LOCAL' && providerDescriptor(profile.providerId).kind !== 'LOCAL')
        throw new AIError('PERMISSION', 'Local privacy mode cannot configure cloud fallback.');
    }
  }

  list(): Array<{
    id: string;
    name: string;
    version: number;
    enabled: boolean;
    scope: string;
    purpose: string | null;
  }> {
    return (
      this.database
        .prepare(
          'SELECT id, name, version, enabled, scope, purpose FROM ai_fallback_chains WHERE owner_id = ? ORDER BY name, id'
        )
        .all(this.ownerId) as Array<{
        id: string;
        name: string;
        version: number;
        enabled: number;
        scope: string;
        purpose: string | null;
      }>
    ).map((row) => ({ ...row, enabled: Boolean(row.enabled) }));
  }
  read(id: string): (FallbackChainInput & { id: string; version: number }) | null {
    const chain = this.database
      .prepare(
        'SELECT id, name, version, enabled, scope, purpose FROM ai_fallback_chains WHERE id = ? AND owner_id = ?'
      )
      .get(id, this.ownerId) as
      | {
          id: string;
          name: string;
          version: number;
          enabled: number;
          scope: string;
          purpose: string | null;
        }
      | undefined;
    if (!chain) return null;
    const entries = this.database
      .prepare(
        `SELECT provider_profile_id AS providerProfileId, model_override AS modelOverride, enabled, error_policy_json AS errorPolicy FROM ai_fallback_chain_entries WHERE chain_id = ? ORDER BY position`
      )
      .all(id) as Array<{
      providerProfileId: string;
      modelOverride: string | null;
      enabled: number;
      errorPolicy: string;
    }>;
    return {
      id: chain.id,
      name: chain.name,
      version: chain.version,
      enabled: Boolean(chain.enabled),
      scope: chain.scope,
      purpose: chain.purpose,
      entries: entries.map((entry) => {
        const policy = JSON.parse(entry.errorPolicy) as {
          maxSameProviderRetries: number;
          allowFallback: boolean;
        };
        return {
          providerProfileId: entry.providerProfileId,
          modelOverride: entry.modelOverride,
          enabled: Boolean(entry.enabled),
          maxSameProviderRetries: policy.maxSameProviderRetries,
          allowFallback: policy.allowFallback
        };
      })
    };
  }
  deleteUnused(id: string): boolean {
    return this.database.transaction(() => {
      const used = this.database
        .prepare(
          'SELECT 1 FROM ai_job_fallback_snapshots WHERE owner_id = ? AND chain_id = ? LIMIT 1'
        )
        .get(this.ownerId, id);
      if (used)
        throw new AIError(
          'VALIDATION',
          'A fallback chain referenced by queued work cannot be deleted.'
        );
      return (
        this.database
          .prepare('DELETE FROM ai_fallback_chains WHERE id = ? AND owner_id = ?')
          .run(id, this.ownerId).changes === 1
      );
    })();
  }

  save(input: FallbackChainInput, privacyMode: PrivacyMode, id = ulid()): string {
    this.validate(input, privacyMode);
    const timestamp = stamp();
    this.database.transaction(() => {
      const previous = this.database
        .prepare('SELECT version FROM ai_fallback_chains WHERE id = ? AND owner_id = ?')
        .get(id, this.ownerId) as { version: number } | undefined;
      this.database
        .prepare(
          `INSERT INTO ai_fallback_chains (id, owner_id, name, version, scope, purpose, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, version=excluded.version, scope=excluded.scope, purpose=excluded.purpose, enabled=excluded.enabled, updated_at=excluded.updated_at`
        )
        .run(
          id,
          this.ownerId,
          input.name.trim(),
          (previous?.version ?? 0) + 1,
          input.scope ?? 'analysis',
          input.purpose ?? null,
          Number(input.enabled !== false),
          timestamp,
          timestamp
        );
      this.database.prepare('DELETE FROM ai_fallback_chain_entries WHERE chain_id = ?').run(id);
      const insert = this.database.prepare(
        `INSERT INTO ai_fallback_chain_entries (id, chain_id, position, provider_profile_id, model_override, required_capabilities_json, enabled, classification, error_policy_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`
      );
      const profiles = new Map(this.profiles().map((profile) => [profile.id, profile]));
      input.entries.forEach((entry, position) => {
        const profile = profiles.get(entry.providerProfileId)!;
        insert.run(
          ulid(),
          id,
          position,
          profile.id,
          entry.modelOverride ?? null,
          Number(entry.enabled !== false),
          providerDescriptor(profile.providerId).kind,
          JSON.stringify({
            maxSameProviderRetries: entry.maxSameProviderRetries ?? 1,
            allowFallback: entry.allowFallback !== false
          }),
          timestamp,
          timestamp
        );
      });
    })();
    return id;
  }

  snapshot(chainId: string, privacyMode: PrivacyMode): FallbackSnapshot {
    const chain = this.database
      .prepare(
        'SELECT version FROM ai_fallback_chains WHERE id = ? AND owner_id = ? AND enabled = 1'
      )
      .get(chainId, this.ownerId) as { version: number } | undefined;
    if (!chain) throw new AIError('INVALID_CONFIGURATION', 'The fallback chain is unavailable.');
    const profiles = new Map(this.profiles().map((profile) => [profile.id, profile]));
    const entries = this.database
      .prepare(
        `SELECT position, provider_profile_id AS providerProfileId, model_override AS modelOverride, classification, error_policy_json AS errorPolicy FROM ai_fallback_chain_entries WHERE chain_id = ? AND enabled = 1 ORDER BY position`
      )
      .all(chainId) as EntryRow[];
    const snapshot = {
      schemaVersion: 1 as const,
      chainId,
      chainVersion: chain.version,
      privacyMode,
      createdAt: stamp(),
      entries: entries.map((entry) => {
        const profile = profiles.get(entry.providerProfileId);
        if (!profile) throw new AIError('INVALID_CONFIGURATION', 'A fallback profile was removed.');
        if (!profile.enabled)
          throw new AIError('INVALID_CONFIGURATION', 'A fallback profile was disabled.');
        if (privacyMode === 'LOCAL' && entry.classification !== 'LOCAL')
          throw new AIError('PERMISSION', 'Local privacy mode cannot execute cloud fallback.');
        const policy = JSON.parse(entry.errorPolicy) as {
          maxSameProviderRetries: number;
          allowFallback: boolean;
        };
        return {
          position: entry.position,
          providerProfileId: profile.id,
          providerType: profile.providerId,
          model: entry.modelOverride ?? profile.generationModel ?? '',
          maxSameProviderRetries: policy.maxSameProviderRetries,
          allowFallback: policy.allowFallback
        };
      })
    };
    if (!snapshot.entries.length)
      throw new AIError('INVALID_CONFIGURATION', 'The fallback chain has no eligible entries.');
    return snapshot;
  }
}
