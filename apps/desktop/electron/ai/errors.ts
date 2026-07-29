import type { AIErrorCode } from './types.js';

export class AIError extends Error {
  constructor(
    readonly code: AIErrorCode,
    message: string,
    readonly retryable = false,
    readonly status?: number
  ) {
    super(message);
    this.name = 'AIError';
  }
}

/** Sanitized provider failure with an already-accounted integer micro-unit cost. */
export class AIUsageError extends AIError {
  constructor(
    code: AIErrorCode,
    message: string,
    retryable: boolean,
    readonly incurredMicros: number
  ) {
    super(code, message, retryable);
    if (!Number.isSafeInteger(incurredMicros) || incurredMicros < 0)
      throw new Error('Provider usage must use non-negative integer micro-units.');
    this.name = 'AIUsageError';
  }
}

/** Sanitized cancellation after a provider reported billable, integer usage. */
export class AIUsageCancellationError extends AIUsageError {
  constructor(
    message: string,
    incurredMicros: number,
    readonly usage?: { inputTokens?: number; outputTokens?: number; partial?: boolean }
  ) {
    super('CANCELLATION', message, false, incurredMicros);
    if (
      usage &&
      Object.values(usage).some(
        (value) => typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)
      )
    )
      throw new Error('Provider token usage must use non-negative integer values.');
    this.name = 'AIUsageCancellationError';
  }
}

/**
 * An internal lifecycle-test interruption.  Workers deliberately leave the
 * durable lease untouched so a subsequent runtime exercises normal recovery.
 * It is never constructed from IPC or provider data.
 */
export class AIProcessLossFault extends Error {
  constructor() {
    super('Injected process-loss interruption after durable persistence.');
    this.name = 'AIProcessLossFault';
  }
}

export function normalizeProviderError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  if (error instanceof DOMException && error.name === 'AbortError')
    return new AIError('CANCELLATION', 'The AI request was cancelled.', false);
  if (error instanceof Error && error.name === 'TimeoutError')
    return new AIError('TIMEOUT', 'The AI provider did not respond before the timeout.', true);
  if (error instanceof TypeError)
    return new AIError('NETWORK_UNAVAILABLE', 'Could not reach the AI provider.', true);
  return new AIError('UNKNOWN', 'The AI provider returned an unexpected error.', false);
}

export function errorForHttpStatus(status: number, message?: string): AIError {
  const safeMessage = message?.slice(0, 500) || `Provider request failed (${status}).`;
  if (status === 401) return new AIError('AUTHENTICATION', safeMessage, false, status);
  if (status === 403) return new AIError('PERMISSION', safeMessage, false, status);
  if (status === 404) return new AIError('MODEL_UNAVAILABLE', safeMessage, false, status);
  if (status === 408 || status === 504) return new AIError('TIMEOUT', safeMessage, true, status);
  if (status === 413) return new AIError('CONTEXT_TOO_LARGE', safeMessage, false, status);
  if (status === 429) return new AIError('RATE_LIMIT', safeMessage, true, status);
  if (status === 402) return new AIError('QUOTA_EXCEEDED', safeMessage, false, status);
  if (status >= 500) return new AIError('PROVIDER_UNAVAILABLE', safeMessage, true, status);
  return new AIError('UNKNOWN', safeMessage, false, status);
}
