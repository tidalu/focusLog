import { join } from 'node:path';

import {
  PHASE3_PERFORMANCE_LOG_COUNT,
  runPhase3PerformanceHarness
} from './phase3-performance-harness.js';

const artifactPath =
  process.argv[2] ??
  join(process.cwd(), '..', '..', 'artifacts', 'phase3', 'phase3-200k-benchmark.json');
const result = runPhase3PerformanceHarness({
  logCount: PHASE3_PERFORMANCE_LOG_COUNT,
  artifactPath,
  cleanupDatabase: true
});

console.log(
  JSON.stringify(
    {
      artifactPath,
      logCount: result.logCount,
      timingsMs: result.timingsMs,
      memory: result.memory,
      databaseBytes: result.database.bytes,
      counts: result.counts,
      security: result.security
    },
    null,
    2
  )
);
