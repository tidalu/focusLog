import type { DesktopDatabase } from '../database/database.js';
import { AIError } from './errors.js';
import { providerDescriptor } from './providers.js';
import type { PrivacyMode, ProviderId } from './types.js';

export class ExecutionPolicyService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string
  ) {}
  set(
    scope: 'global' | 'provider' | 'chain',
    targetId: string,
    enabled: boolean,
    reason?: string
  ): void {
    this.database
      .prepare(
        `INSERT INTO ai_execution_kill_switches (owner_id, scope, target_id, enabled, reason, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, scope, target_id) DO UPDATE SET enabled=excluded.enabled, reason=excluded.reason, updated_at=excluded.updated_at`
      )
      .run(
        this.ownerId,
        scope,
        targetId,
        Number(enabled),
        reason?.slice(0, 200) ?? null,
        new Date().toISOString()
      );
  }
  assertAllowed(input: {
    providerId: ProviderId;
    profileId: string;
    chainId?: string;
    privacyMode: PrivacyMode;
    consented: boolean;
  }): void {
    const blocked = (scope: string, target = '') =>
      Boolean(
        (
          this.database
            .prepare(
              'SELECT enabled FROM ai_execution_kill_switches WHERE owner_id = ? AND scope = ? AND target_id = ?'
            )
            .get(this.ownerId, scope, target) as { enabled: number } | undefined
        )?.enabled
      );
    if (
      blocked('global') ||
      blocked('provider', input.profileId) ||
      (input.chainId && blocked('chain', input.chainId))
    )
      throw new AIError('PERMISSION', 'AI execution is currently disabled by policy.');
    if (input.privacyMode === 'LOCAL' && providerDescriptor(input.providerId).kind !== 'LOCAL')
      throw new AIError('PERMISSION', 'Local privacy mode blocks cloud execution.');
    if (providerDescriptor(input.providerId).kind === 'CLOUD' && !input.consented)
      throw new AIError('PERMISSION', 'Cloud consent is required before this provider attempt.');
  }
  /** Reads current persisted state; a queue snapshot can never override this gate. */
  assertCurrentAttempt(
    profileId: string,
    chainId?: string
  ): { providerId: ProviderId; privacyMode: PrivacyMode } {
    const profile = this.database
      .prepare(
        'SELECT provider_id AS providerId, enabled, generation_model AS model FROM ai_provider_profiles WHERE id = ? AND owner_id = ?'
      )
      .get(profileId, this.ownerId) as
      { providerId: ProviderId; enabled: number; model: string | null } | undefined;
    if (!profile || !profile.enabled || !profile.model)
      throw new AIError(
        'INVALID_CONFIGURATION',
        'The provider profile is no longer enabled with a generation model.'
      );
    const settings = this.database
      .prepare('SELECT mode FROM ai_settings WHERE owner_id = ?')
      .get(this.ownerId) as { mode: PrivacyMode } | undefined;
    const privacyMode = settings?.mode ?? 'DISABLED';
    const consented =
      providerDescriptor(profile.providerId).kind === 'LOCAL' ||
      Boolean(
        this.database
          .prepare(
            'SELECT 1 FROM ai_cloud_consents WHERE owner_id = ? AND provider_profile_id = ? AND mode = ?'
          )
          .get(this.ownerId, profileId, privacyMode)
      );
    this.assertAllowed({
      providerId: profile.providerId,
      profileId,
      chainId,
      privacyMode,
      consented
    });
    if (privacyMode === 'DISABLED')
      throw new AIError('PERMISSION', 'AI is disabled in FocusLog settings.');
    return { providerId: profile.providerId, privacyMode };
  }
  read(): Array<{
    scope: 'global' | 'provider' | 'chain';
    targetId: string;
    enabled: boolean;
    reason: string | null;
  }> {
    return (
      this.database
        .prepare(
          'SELECT scope, target_id AS targetId, enabled, reason FROM ai_execution_kill_switches WHERE owner_id = ? ORDER BY scope, target_id'
        )
        .all(this.ownerId) as Array<{
        scope: 'global' | 'provider' | 'chain';
        targetId: string;
        enabled: number;
        reason: string | null;
      }>
    ).map((row) => ({ ...row, enabled: Boolean(row.enabled) }));
  }
}
