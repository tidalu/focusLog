import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'prettier';

const checkOnly = process.argv.includes('--check');
const srsPath = resolve('docs/FocusLog-SRS.md');
const outputPath = resolve('docs/REQUIREMENTS-TRACEABILITY.md');
const srs = readFileSync(srsPath, 'utf8');
const ids = [...srs.matchAll(/\*\*\[([A-Z]+-\d{3})\]/g)].map((match) => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) throw new Error(`Duplicate SRS IDs: ${[...new Set(duplicates)].join(', ')}`);

const rows = [
  ['FR-001', 'ACC-001', 'apps/backend/tests/device-flow.integration.test.ts', 'automated'],
  ['FR-002', 'ACC-002', 'apps/backend/tests/device-flow.integration.test.ts', 'automated'],
  [
    'FR-003',
    'ACC-003',
    'apps/backend/tests/device-flow.integration.test.ts; apps/backend/tests/websocket-gateway.integration.test.ts',
    'automated'
  ],
  ['FR-010', 'ACC-010', 'apps/backend/tests/device-flow.integration.test.ts', 'automated'],
  [
    'FR-011',
    'ACC-011',
    'apps/desktop/electron/reminders/scheduler.test.ts; apps/mobile/test/reminders/reminder_recovery_test.dart',
    'automated'
  ],
  [
    'FR-020',
    'ACC-020',
    'apps/desktop/electron/reminders/state.test.ts; apps/mobile/test/widget_test.dart; apps/backend/tests/sync-engine.integration.test.ts',
    'automated'
  ],
  ['FR-021', 'ACC-021', 'apps/backend/tests/sync-engine.integration.test.ts', 'automated'],
  [
    'FR-022',
    'ACC-022',
    'apps/desktop/electron/database/check-in-search.test.ts; apps/mobile/test/database/full_text_search_test.dart; apps/backend/tests/full-text-search.integration.test.ts',
    'automated'
  ],
  [
    'FR-023',
    'ACC-023',
    'apps/desktop/src/renderer/foundation.test.ts; apps/mobile/test/widget_test.dart',
    'automated'
  ],
  [
    'REM-001',
    'ACC-030',
    'apps/desktop/electron/reminders/state.test.ts; apps/mobile/test/reminders/reminder_recovery_test.dart',
    'automated'
  ],
  [
    'REM-002',
    'ACC-031',
    'apps/desktop/electron/reminders/scheduler.test.ts; apps/mobile/test/reminders/reminder_recovery_test.dart',
    'automated'
  ],
  [
    'REM-003',
    'ACC-032',
    'apps/desktop/electron/reminders/scheduler.test.ts; apps/desktop/src/renderer/foundation.test.ts; apps/mobile/test/reminders/reminder_recovery_test.dart; apps/mobile/test/reminders/notification_id_test.dart; apps/mobile/test/android_release_configuration_test.dart',
    'automated'
  ],
  [
    'REM-004',
    'ACC-033',
    'apps/desktop/src/renderer/foundation.test.ts; apps/mobile/test/android_release_configuration_test.dart; apps/mobile/integration_test/android_notification_test.dart; FINAL-AUDIT.md',
    'automated + audited manual'
  ],
  [
    'REM-005',
    'ACC-034',
    'apps/backend/tests/websocket-gateway.integration.test.ts; apps/backend/tests/sync-engine.integration.test.ts',
    'automated'
  ],
  [
    'SYNC-001',
    'ACC-040',
    'apps/desktop/electron/database/sync-worker.test.ts; apps/mobile/test/sync/sync_worker_test.dart',
    'automated'
  ],
  [
    'SYNC-002',
    'ACC-041',
    'apps/backend/tests/sync-engine.integration.test.ts; apps/mobile/test/sync/real_backend_sync_test.dart',
    'automated'
  ],
  [
    'SYNC-003',
    'ACC-042',
    'apps/backend/tests/sync-engine.integration.test.ts; apps/desktop/electron/database/sync-worker.test.ts',
    'automated'
  ],
  ['SYNC-004', 'ACC-043', 'apps/backend/tests/sync-engine.integration.test.ts', 'automated'],
  ['SYNC-005', 'ACC-044', 'apps/backend/tests/sync-engine.integration.test.ts', 'automated'],
  ['WS-001', 'ACC-050', 'apps/backend/tests/websocket-gateway.integration.test.ts', 'automated'],
  ['WS-002', 'ACC-051', 'apps/backend/tests/websocket-gateway.integration.test.ts', 'automated'],
  ['WS-003', 'ACC-052', 'apps/backend/tests/websocket-gateway.integration.test.ts', 'automated'],
  ['WS-004', 'ACC-053', 'apps/backend/tests/websocket-gateway.integration.test.ts', 'automated'],
  [
    'API-001',
    'ACC-060',
    'apps/backend/tests/app.test.ts; scripts/generate-contracts.mjs',
    'automated'
  ],
  [
    'API-002',
    'ACC-061',
    'apps/backend/tests/app.test.ts; apps/backend/tests/device-flow.integration.test.ts',
    'automated'
  ],
  ['DATA-001', 'ACC-062', 'apps/backend/tests/migration-contract.test.ts', 'automated'],
  [
    'DATA-002',
    'ACC-063',
    'apps/desktop/electron/database/database.test.ts; apps/mobile/test/database/database_test.dart',
    'automated'
  ],
  [
    'DATA-003',
    'ACC-064',
    'apps/desktop/electron/database/check-in-search.test.ts; apps/mobile/test/database/full_text_search_test.dart; apps/backend/tests/full-text-search.integration.test.ts',
    'automated benchmark'
  ],
  [
    'FR-030',
    'ACC-065',
    'apps/desktop/electron/reporting/reporting-service.test.ts; apps/mobile/test/reporting/reporting_test.dart; apps/backend/tests/device-flow.integration.test.ts',
    'automated'
  ],
  [
    'FR-031',
    'ACC-066',
    'apps/desktop/electron/reporting/reporting-service.test.ts; apps/mobile/test/reporting/reporting_test.dart; apps/backend/tests/device-flow.integration.test.ts',
    'automated'
  ],
  [
    'SEC-001',
    'ACC-070',
    'apps/desktop/electron/security/security.test.ts; apps/mobile/test/security/encrypted_backup_test.dart; apps/backend/tests/crypto.test.ts',
    'automated'
  ],
  [
    'SEC-002',
    'ACC-071',
    'apps/backend/tests/app.test.ts; apps/backend/tests/device-flow.integration.test.ts; apps/backend/tests/websocket-gateway.integration.test.ts',
    'automated'
  ],
  [
    'SEC-003',
    'ACC-072',
    'apps/desktop/electron/security/security.test.ts; apps/mobile/test/security/encrypted_backup_test.dart',
    'automated'
  ],
  [
    'SEC-004',
    'ACC-073',
    'apps/desktop/electron/security/security.test.ts; apps/mobile/test/security/encrypted_backup_test.dart; apps/backend/tests/device-flow.integration.test.ts',
    'automated'
  ],
  [
    'DESK-001',
    'ACC-074',
    'apps/desktop/src/renderer/foundation.test.ts; apps/desktop/electron/reminders/scheduler.test.ts; FINAL-AUDIT.md',
    'automated + audited manual'
  ],
  [
    'MOB-001',
    'ACC-075',
    'apps/mobile/test/widget_test.dart; apps/mobile/test/android_release_configuration_test.dart; apps/mobile/integration_test/android_notification_test.dart; FINAL-AUDIT.md',
    'automated + audited manual'
  ],
  [
    'NFR-001',
    'ACC-076',
    'apps/desktop/electron/database/sync-worker.test.ts; apps/mobile/test/sync/sync_worker_test.dart; apps/backend/tests/sync-engine.integration.test.ts',
    'automated'
  ],
  [
    'NFR-002',
    'ACC-077',
    'apps/desktop/src/renderer/foundation.test.ts; apps/mobile/test/widget_test.dart; apps/desktop/electron/database/check-in-search.test.ts; apps/mobile/test/database/full_text_search_test.dart',
    'automated'
  ],
  [
    'OPS-001',
    'ACC-078',
    'FINAL-AUDIT.md; apps/backend/tests/migration-contract.test.ts',
    'audited manual + automated'
  ],
  [
    'OPS-002',
    'ACC-079',
    '.github/workflows/ci.yml; apps/mobile/test/android_release_configuration_test.dart; scripts/generate-contracts.mjs',
    'CI + automated'
  ],
  ['TEST-001', 'ACC-080', 'scripts/generate-traceability.mjs', 'automated']
];

const mappedIds = new Set(rows.flatMap(([requirement, acceptance]) => [requirement, acceptance]));
const missing = ids.filter((id) => !mappedIds.has(id));
const stale = [...mappedIds].filter((id) => !ids.includes(id));
if (missing.length || stale.length)
  throw new Error(
    `Traceability drift. Unmapped SRS IDs: ${missing.join(', ') || 'none'}. Stale mappings: ${
      stale.join(', ') || 'none'
    }.`
  );
for (const row of rows) {
  for (const path of row[2].split(';').map((value) => value.trim()))
    if (!existsSync(resolve(path))) throw new Error(`Trace target does not exist: ${path}`);
}

const markdownSource = `# FocusLog requirement-to-test traceability

Generated from the canonical IDs in \`docs/FocusLog-SRS.md\` by
\`scripts/generate-traceability.mjs\`. Do not edit this file by hand.

| Requirement | Acceptance | Verification evidence | Mode |
| --- | --- | --- | --- |
${rows
  .map(
    ([requirement, acceptance, evidence, mode]) =>
      `| ${requirement} | ${acceptance} | ${evidence
        .split(';')
        .map((value) => `\`${value.trim()}\``)
        .join('<br>')} | ${mode} |`
  )
  .join('\n')}

Coverage: **${rows.length} requirements / ${rows.length} acceptance criteria mapped**.
`;
const markdown = await format(markdownSource, {
  parser: 'markdown',
  proseWrap: 'preserve',
  printWidth: 100
});

if (checkOnly) {
  if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== markdown)
    throw new Error('Generated traceability matrix is missing or stale.');
} else {
  writeFileSync(outputPath, markdown);
}
console.log(
  `Traceability ${checkOnly ? 'verification' : 'generation'} passed for ${rows.length} requirements.`
);
