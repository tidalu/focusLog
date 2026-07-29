import { ulid } from 'ulid';
import type { DesktopDatabase } from '../database/database.js';

export type CircuitState = 'closed' | 'open' | 'half_open';
const qualifying = new Set([
  'NETWORK_UNAVAILABLE',
  'TIMEOUT',
  'RATE_LIMIT',
  'PROVIDER_UNAVAILABLE',
  'MALFORMED_RESPONSE'
]);

export class CircuitBreakerService {
  constructor(
    private readonly database: DesktopDatabase,
    private readonly ownerId: string,
    private readonly threshold = 3,
    private readonly cooldownMs = 30_000
  ) {}
  acquireProbe(
    profileId: string,
    operation = 'generation',
    at = new Date()
  ): { state: CircuitState; token?: string } {
    return this.database.transaction((): { state: CircuitState; token?: string } => {
      const row = this.database
        .prepare(
          'SELECT state, open_until AS openUntil, probe_expires_at AS probeExpiresAt FROM ai_circuit_breakers WHERE owner_id = ? AND provider_profile_id = ? AND operation_class = ?'
        )
        .get(this.ownerId, profileId, operation) as
        | { state: CircuitState; openUntil: string | null; probeExpiresAt: string | null }
        | undefined;
      if (!row) return { state: 'closed' };
      if (row.state === 'closed') return { state: 'closed' };
      if (row.state === 'half_open' && row.probeExpiresAt && new Date(row.probeExpiresAt) > at)
        return { state: 'open' };
      if (row.state === 'open' && row.openUntil && new Date(row.openUntil) > at)
        return { state: 'open' };
      const token = ulid();
      this.database
        .prepare(
          `UPDATE ai_circuit_breakers SET state = 'half_open', probe_token = ?, probe_expires_at = ?, updated_at = ?, version = version + 1 WHERE owner_id = ? AND provider_profile_id = ? AND operation_class = ?`
        )
        .run(
          token,
          new Date(at.getTime() + this.cooldownMs).toISOString(),
          at.toISOString(),
          this.ownerId,
          profileId,
          operation
        );
      return { state: 'half_open', token };
    })();
  }
  record(
    profileId: string,
    code: string | null,
    success: boolean,
    operation = 'generation',
    at = new Date()
  ): CircuitState {
    return this.database.transaction(() => {
      const existing = this.database
        .prepare(
          'SELECT consecutive_failures AS failures FROM ai_circuit_breakers WHERE owner_id = ? AND provider_profile_id = ? AND operation_class = ?'
        )
        .get(this.ownerId, profileId, operation) as { failures: number } | undefined;
      const failures =
        success || !code || !qualifying.has(code) ? 0 : (existing?.failures ?? 0) + 1;
      const state: CircuitState = failures >= this.threshold ? 'open' : 'closed';
      const now = at.toISOString();
      this.database
        .prepare(
          `INSERT INTO ai_circuit_breakers (owner_id, provider_profile_id, operation_class, state, consecutive_failures, window_failures, window_started_at, last_failure_at, last_success_at, open_until, reason, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, provider_profile_id, operation_class) DO UPDATE SET state=excluded.state, consecutive_failures=excluded.consecutive_failures, window_failures=excluded.window_failures, last_failure_at=excluded.last_failure_at, last_success_at=excluded.last_success_at, open_until=excluded.open_until, reason=excluded.reason, probe_token=NULL, probe_expires_at=NULL, updated_at=excluded.updated_at, version=ai_circuit_breakers.version+1`
        )
        .run(
          this.ownerId,
          profileId,
          operation,
          state,
          failures,
          failures,
          now,
          success ? null : now,
          success ? now : null,
          state === 'open' ? new Date(at.getTime() + this.cooldownMs).toISOString() : null,
          success ? null : code,
          now
        );
      return state;
    })();
  }
  safeStates(): Array<{
    profileId: string;
    operation: string;
    state: CircuitState;
    failures: number;
    openUntil: string | null;
    reason: string | null;
    probeActive: boolean;
  }> {
    return (
      this.database
        .prepare(
          `SELECT provider_profile_id AS profileId, operation_class AS operation, state, consecutive_failures AS failures, open_until AS openUntil, reason, probe_expires_at AS probeExpiresAt FROM ai_circuit_breakers WHERE owner_id = ? ORDER BY provider_profile_id, operation_class`
        )
        .all(this.ownerId) as Array<{
        profileId: string;
        operation: string;
        state: CircuitState;
        failures: number;
        openUntil: string | null;
        reason: string | null;
        probeExpiresAt: string | null;
      }>
    ).map((row) => ({
      profileId: row.profileId,
      operation: row.operation,
      state: row.state,
      failures: row.failures,
      openUntil: row.openUntil,
      reason: row.reason,
      probeActive: row.probeExpiresAt !== null
    }));
  }
  reset(profileId: string, operation = 'generation'): boolean {
    return (
      this.database
        .prepare(
          `UPDATE ai_circuit_breakers SET state = 'closed', consecutive_failures = 0, window_failures = 0, open_until = NULL, reason = NULL, probe_token = NULL, probe_expires_at = NULL, updated_at = ?, version = version + 1 WHERE owner_id = ? AND provider_profile_id = ? AND operation_class = ?`
        )
        .run(new Date().toISOString(), this.ownerId, profileId, operation).changes === 1
    );
  }
}
