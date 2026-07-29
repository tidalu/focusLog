import { describe, expect, it } from 'vitest';
import { decideProviderAction, type ProviderDecisionInput } from './provider-decision.js';

const base: ProviderDecisionInput = {
  phase: 'before_attempt',
  cancelled: false,
  privacyMode: 'LOCAL',
  consentValid: true,
  killSwitchEnabled: true,
  capacityAvailable: true,
  circuitState: 'closed',
  sameProviderRetries: 0,
  totalAttempts: 0,
  maxSameProviderRetries: 1,
  maxTotalAttempts: 8,
  hasFallback: true,
  requestCostRemainingMicros: 100,
  estimatedAttemptCostMicros: 10,
  elapsedMs: 0,
  maxElapsedMs: 600_000,
  queueAttemptsRemaining: 2
};

describe('provider decision engine', () => {
  it('returns preflight attempt, capacity, breaker, cancellation and budget actions', () => {
    expect(decideProviderAction(base)).toBe('attempt_primary');
    expect(decideProviderAction({ ...base, capacityAvailable: false })).toBe('wait_for_capacity');
    expect(decideProviderAction({ ...base, circuitState: 'open' })).toBe(
      'wait_for_circuit_breaker'
    );
    expect(decideProviderAction({ ...base, cancelled: true })).toBe('cancel');
    expect(decideProviderAction({ ...base, requestCostRemainingMicros: 9 })).toBe('fail_terminal');
  });

  it('bounds retry and fallback decisions without authentication bypass', () => {
    const failure = { ...base, phase: 'after_failure' as const, errorCode: 'TIMEOUT' as const };
    expect(decideProviderAction(failure)).toBe('retry_same_provider');
    expect(decideProviderAction({ ...failure, sameProviderRetries: 1 })).toBe(
      'fallback_next_provider'
    );
    expect(decideProviderAction({ ...failure, totalAttempts: 8 })).toBe('dead_letter');
    expect(decideProviderAction({ ...failure, errorCode: 'AUTHENTICATION' })).toBe('fail_terminal');
    expect(
      decideProviderAction({
        ...failure,
        errorCode: 'AUTHENTICATION',
        authenticationFallbackAllowed: true
      })
    ).toBe('fallback_next_provider');
  });
});
