import { resolve } from 'node:path';

import { runPhase5CProviderAndPerformanceCertification } from './phase5-provider-performance-certification.js';

const args = new Set(process.argv.slice(2));
const artifactPath = resolve(
  'artifacts',
  'phase5',
  'phase5c-provider-performance-certification.json'
);
const result = await runPhase5CProviderAndPerformanceCertification({
  live: process.env.FOCUSLOG_PHASE5C_LIVE === '1',
  includePerformance: args.has('--performance'),
  releaseLikePerformance: args.has('--release-like'),
  artifactPath
});

console.log(
  JSON.stringify(
    {
      artifactPath,
      date: result.date,
      summary: result.summary,
      providers: result.providers.map((provider) => ({
        providerId: provider.providerId,
        configured: provider.configured,
        status: provider.status,
        path: provider.path,
        generationModel: provider.generationModel,
        embeddingModel: provider.embeddingModel,
        checks: Object.fromEntries(
          Object.entries(provider.checks).map(([name, check]) => [name, check.status])
        ),
        limitations: provider.limitations,
        unsupportedBehavior: provider.unsupportedBehavior
      })),
      performance: result.performance
        ? {
            releaseLike: result.performance.releaseLike,
            logCount: result.performance.harness.logCount,
            thresholdsPassed: result.performance.thresholdsPassed,
            timingsMs: result.performance.harness.timingsMs,
            memory: result.performance.harness.memory,
            databaseBytes: result.performance.harness.database.bytes
          }
        : undefined,
      secretFree: result.secretFree
    },
    null,
    2
  )
);
