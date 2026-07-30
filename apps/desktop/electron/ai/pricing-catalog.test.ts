import { describe, expect, it } from 'vitest';
import { PricingCatalog } from './pricing-catalog.js';

describe('versioned fixed-point pricing catalogue', () => {
  it('uses integer micro-units, rounded upward, and never treats unknown cloud prices as zero', () => {
    const catalog = new PricingCatalog([
      {
        providerType: 'openai',
        model: 'x',
        currency: 'USD',
        inputMicrosPerMillion: 1_500_000,
        outputMicrosPerMillion: 2_500_000,
        cachedMicrosPerMillion: 500_000,
        fixedMicros: 2,
        version: 'test-v1'
      }
    ]);
    expect(
      catalog.estimate('openai', 'x', { inputTokens: 1, outputTokens: 1, cachedTokens: 1 })
    ).toBe(8);
    expect(catalog.estimate('openai', 'unknown', { inputTokens: 1 })).toBeNull();
    expect(catalog.estimate('ollama', 'any', { inputTokens: 999_999, outputTokens: 999_999 })).toBe(
      0
    );
  });
});
