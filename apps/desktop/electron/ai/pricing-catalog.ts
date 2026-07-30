import { AIError } from './errors.js';

export interface PricingRule {
  providerType: string;
  model: string;
  currency: 'USD';
  inputMicrosPerMillion: number;
  outputMicrosPerMillion: number;
  cachedMicrosPerMillion?: number;
  fixedMicros?: number;
  version: string;
}
export interface UsageForPricing {
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
}
export interface PricingSnapshot {
  schemaVersion: 1;
  catalogueVersion: string;
  providerType: string;
  model: string;
  currency: 'USD';
  inputMicrosPerMillion: string;
  outputMicrosPerMillion: string;
  cachedMicrosPerMillion: string | null;
  fixedMicros: string;
  rounding: 'ceil-per-component';
  localZeroCost: boolean;
  estimatedInputTokens: string;
  estimatedOutputTokens: string;
  estimatedCachedTokens: string;
  estimatedReservationMicros: string;
}
export interface PricingQuote {
  version: string;
  snapshot: PricingSnapshot;
  estimatedMicros: number;
}

const rules: PricingRule[] = [
  {
    providerType: 'ollama',
    model: '*',
    currency: 'USD',
    inputMicrosPerMillion: 0,
    outputMicrosPerMillion: 0,
    version: 'local-zero-v1'
  },
  {
    providerType: 'lm-studio',
    model: '*',
    currency: 'USD',
    inputMicrosPerMillion: 0,
    outputMicrosPerMillion: 0,
    version: 'local-zero-v1'
  }
];
function charge(tokens: number | undefined, microsPerMillion: number): bigint {
  if (!tokens) return 0n;
  if (!Number.isSafeInteger(tokens) || tokens < 0)
    throw new AIError('VALIDATION', 'Token usage must be a non-negative integer.');
  return (BigInt(tokens) * BigInt(microsPerMillion) + 999_999n) / 1_000_000n;
}
function integer(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new AIError('VALIDATION', 'Pricing rules must use non-negative integer micro-units.');
  return String(value);
}
function estimateRule(rule: PricingRule, usage: UsageForPricing): number {
  const total =
    charge(usage.inputTokens, rule.inputMicrosPerMillion) +
    charge(usage.outputTokens, rule.outputMicrosPerMillion) +
    charge(usage.cachedTokens, rule.cachedMicrosPerMillion ?? rule.inputMicrosPerMillion) +
    BigInt(rule.fixedMicros ?? 0);
  if (total > BigInt(Number.MAX_SAFE_INTEGER))
    throw new AIError('BUDGET_EXCEEDED', 'The estimated AI cost is too large.');
  return Number(total);
}
function snapshotInteger(value: string): number {
  if (!/^\d+$/u.test(value))
    throw new AIError('VALIDATION', 'The committed pricing snapshot is invalid.');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed))
    throw new AIError('BUDGET_EXCEEDED', 'The committed pricing snapshot is too large.');
  return parsed;
}

/** Versioned fixed-point pricing. Unknown cloud models intentionally return null. */
export class PricingCatalog {
  private readonly entries: PricingRule[];
  constructor(entries: PricingRule[] = rules) {
    this.entries = entries === rules ? [...rules] : [...entries, ...rules];
  }
  find(providerType: string, model: string): PricingRule | null {
    return (
      this.entries.find((entry) => entry.providerType === providerType && entry.model === model) ??
      this.entries.find((entry) => entry.providerType === providerType && entry.model === '*') ??
      null
    );
  }
  estimate(providerType: string, model: string, usage: UsageForPricing): number | null {
    return this.quote(providerType, model, usage)?.estimatedMicros ?? null;
  }
  quote(providerType: string, model: string, usage: UsageForPricing): PricingQuote | null {
    const rule = this.find(providerType, model);
    if (!rule) return null;
    const estimatedMicros = estimateRule(rule, usage);
    const localZeroCost =
      (providerType === 'ollama' || providerType === 'lm-studio') &&
      estimatedMicros === 0 &&
      rule.inputMicrosPerMillion === 0 &&
      rule.outputMicrosPerMillion === 0 &&
      (rule.cachedMicrosPerMillion ?? 0) === 0 &&
      (rule.fixedMicros ?? 0) === 0;
    return {
      version: rule.version,
      estimatedMicros,
      snapshot: {
        schemaVersion: 1,
        catalogueVersion: rule.version,
        providerType,
        model,
        currency: rule.currency,
        inputMicrosPerMillion: integer(rule.inputMicrosPerMillion),
        outputMicrosPerMillion: integer(rule.outputMicrosPerMillion),
        cachedMicrosPerMillion:
          rule.cachedMicrosPerMillion === undefined ? null : integer(rule.cachedMicrosPerMillion),
        fixedMicros: integer(rule.fixedMicros ?? 0),
        rounding: 'ceil-per-component',
        localZeroCost,
        estimatedInputTokens: integer(usage.inputTokens ?? 0),
        estimatedOutputTokens: integer(usage.outputTokens ?? 0),
        estimatedCachedTokens: integer(usage.cachedTokens ?? 0),
        estimatedReservationMicros: integer(estimatedMicros)
      }
    };
  }
  estimateFromSnapshot(snapshot: PricingSnapshot, usage: UsageForPricing): number {
    if (
      snapshot.schemaVersion !== 1 ||
      snapshot.currency !== 'USD' ||
      snapshot.rounding !== 'ceil-per-component'
    )
      throw new AIError('VALIDATION', 'The committed pricing snapshot is unsupported.');
    const rule: PricingRule = {
      providerType: snapshot.providerType,
      model: snapshot.model,
      currency: 'USD',
      version: snapshot.catalogueVersion,
      inputMicrosPerMillion: snapshotInteger(snapshot.inputMicrosPerMillion),
      outputMicrosPerMillion: snapshotInteger(snapshot.outputMicrosPerMillion),
      cachedMicrosPerMillion:
        snapshot.cachedMicrosPerMillion === null
          ? undefined
          : snapshotInteger(snapshot.cachedMicrosPerMillion),
      fixedMicros: snapshotInteger(snapshot.fixedMicros)
    };
    return estimateRule(rule, usage);
  }
}
