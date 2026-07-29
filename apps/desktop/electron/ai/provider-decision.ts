import type { AIErrorCode, PrivacyMode } from './types.js';

export type ProviderDecisionAction =
  | 'attempt_primary'
  | 'retry_same_provider'
  | 'fallback_next_provider'
  | 'wait_for_circuit_breaker'
  | 'wait_for_capacity'
  | 'fail_terminal'
  | 'dead_letter'
  | 'cancel';

export interface ProviderDecisionInput {
  phase: 'before_attempt' | 'after_failure';
  errorCode?: AIErrorCode;
  cancelled: boolean;
  privacyMode: PrivacyMode;
  consentValid: boolean;
  killSwitchEnabled: boolean;
  capacityAvailable: boolean;
  circuitState: 'closed' | 'open' | 'half_open';
  sameProviderRetries: number;
  totalAttempts: number;
  maxSameProviderRetries: number;
  maxTotalAttempts: number;
  hasFallback: boolean;
  requestCostRemainingMicros: number;
  estimatedAttemptCostMicros: number;
  elapsedMs: number;
  maxElapsedMs: number;
  queueAttemptsRemaining: number;
  authenticationFallbackAllowed?: boolean;
}

const terminal = new Set<AIErrorCode>([
  'PERMISSION',
  'VALIDATION',
  'INVALID_CONFIGURATION',
  'UNSUPPORTED_CAPABILITY',
  'CANCELLATION',
  'BUDGET_EXCEEDED',
  'SAFETY_REFUSAL',
  'CONTEXT_TOO_LARGE'
]);
const retryable = new Set<AIErrorCode>([
  'NETWORK_UNAVAILABLE',
  'TIMEOUT',
  'RATE_LIMIT',
  'PROVIDER_UNAVAILABLE',
  'MODEL_UNAVAILABLE',
  'MALFORMED_RESPONSE'
]);

/** Pure bounded policy shared by every queue-backed provider operation. */
export function decideProviderAction(input: ProviderDecisionInput): ProviderDecisionAction {
  if (input.cancelled || input.errorCode === 'CANCELLATION') return 'cancel';
  if (
    !input.killSwitchEnabled ||
    input.elapsedMs >= input.maxElapsedMs ||
    input.queueAttemptsRemaining <= 0
  )
    return input.queueAttemptsRemaining <= 0 ? 'dead_letter' : 'fail_terminal';
  if (input.requestCostRemainingMicros < input.estimatedAttemptCostMicros) return 'fail_terminal';
  if (input.privacyMode === 'DISABLED' || (input.privacyMode !== 'LOCAL' && !input.consentValid))
    return 'fail_terminal';
  if (input.phase === 'before_attempt') {
    if (input.circuitState === 'open') return 'wait_for_circuit_breaker';
    if (!input.capacityAvailable) return 'wait_for_capacity';
    return 'attempt_primary';
  }
  if (!input.errorCode || terminal.has(input.errorCode)) return 'fail_terminal';
  if (input.totalAttempts >= input.maxTotalAttempts) return 'dead_letter';
  if (input.errorCode === 'AUTHENTICATION')
    return input.authenticationFallbackAllowed && input.hasFallback
      ? 'fallback_next_provider'
      : 'fail_terminal';
  if (input.circuitState === 'open')
    return input.hasFallback ? 'fallback_next_provider' : 'wait_for_circuit_breaker';
  if (retryable.has(input.errorCode) && input.sameProviderRetries < input.maxSameProviderRetries)
    return 'retry_same_provider';
  if (retryable.has(input.errorCode) && input.hasFallback) return 'fallback_next_provider';
  return 'fail_terminal';
}
