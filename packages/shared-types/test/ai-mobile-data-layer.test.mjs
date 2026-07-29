import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const databaseSource = readFileSync(
  new URL('../../../apps/mobile/lib/data/database/app_database.dart', import.meta.url),
  'utf8'
);
const repositorySource = readFileSync(
  new URL('../../../apps/mobile/lib/ai/mobile_ai_repository.dart', import.meta.url),
  'utf8'
);
const syncWorkerSource = readFileSync(
  new URL('../../../apps/mobile/lib/sync/sync_worker.dart', import.meta.url),
  'utf8'
);
const analysisScreenSource = readFileSync(
  new URL('../../../apps/mobile/lib/ai/mobile_ai_analysis_screen.dart', import.meta.url),
  'utf8'
);
const memoryScreenSource = readFileSync(
  new URL('../../../apps/mobile/lib/ai/mobile_ai_memory_screen.dart', import.meta.url),
  'utf8'
);
const executionAdapterSource = readFileSync(
  new URL('../../../apps/mobile/lib/ai/mobile_ai_execution_adapter.dart', import.meta.url),
  'utf8'
);
const playgroundScreenSource = readFileSync(
  new URL('../../../apps/mobile/lib/ai/mobile_ai_playground_screen.dart', import.meta.url),
  'utf8'
);
const safetyScreenSource = readFileSync(
  new URL('../../../apps/mobile/lib/ai/mobile_ai_security_screen.dart', import.meta.url),
  'utf8'
);
const endpointPolicySource = readFileSync(
  new URL('../../../apps/mobile/lib/security/endpoint_policy.dart', import.meta.url),
  'utf8'
);
const apiClientSource = readFileSync(
  new URL('../../../apps/mobile/lib/identity/focuslog_api_client.dart', import.meta.url),
  'utf8'
);
const syncWorkerSourceSecurity = readFileSync(
  new URL('../../../apps/mobile/lib/sync/sync_worker.dart', import.meta.url),
  'utf8'
);
const androidManifestSource = readFileSync(
  new URL('../../../apps/mobile/android/app/src/main/AndroidManifest.xml', import.meta.url),
  'utf8'
);
const mobileAiGatesWorkflowSource = readFileSync(
  new URL('../../../.github/workflows/mobile-ai-gates.yml', import.meta.url),
  'utf8'
);
const ciWorkflowSource = readFileSync(
  new URL('../../../.github/workflows/ci.yml', import.meta.url),
  'utf8'
);
const mobileAcceptanceSource = readFileSync(
  new URL('../../../docs/AI_MOBILE_ACCEPTANCE.md', import.meta.url),
  'utf8'
);
const mobileReleaseReportSource = readFileSync(
  new URL('../../../docs/AI_MOBILE_RELEASE_REPORT.md', import.meta.url),
  'utf8'
);
const aiArchitectureSource = readFileSync(
  new URL('../../../docs/AI_ARCHITECTURE.md', import.meta.url),
  'utf8'
);
const aiTroubleshootingSource = readFileSync(
  new URL('../../../docs/AI_TROUBLESHOOTING.md', import.meta.url),
  'utf8'
);
const crossPlatformReleaseSource = readFileSync(
  new URL('../src/cross-platform-release.ts', import.meta.url),
  'utf8'
);
const sharedTypesIndexSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const crossPlatformArchitectureSource = readFileSync(
  new URL('../../../docs/AI_CROSS_PLATFORM_ARCHITECTURE.md', import.meta.url),
  'utf8'
);
const crossPlatformAcceptanceSource = readFileSync(
  new URL('../../../docs/AI_CROSS_PLATFORM_ACCEPTANCE.md', import.meta.url),
  'utf8'
);
const crossPlatformHardeningSource = readFileSync(
  new URL('../../../docs/AI_CROSS_PLATFORM_HARDENING_BACKLOG.md', import.meta.url),
  'utf8'
);

const methodSource = (source, methodName) => {
  const start = source.indexOf(methodName);
  assert.notEqual(start, -1, `${methodName} should exist`);
  const nextMethod = source.indexOf('\n  Future<', start + methodName.length);
  const nextSyncMethod = source.indexOf('\n  MobileAI', start + methodName.length);
  const candidates = [nextMethod, nextSyncMethod].filter((index) => index > start);
  const end = candidates.length > 0 ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
};

test('mobile AI data layer migrates durable projection and sync tables', () => {
  assert.match(databaseSource, /int get schemaVersion => 8;/);
  for (const table of [
    'ai_mobile_analysis_results',
    'ai_mobile_job_projections',
    'ai_mobile_usage_summaries',
    'ai_mobile_settings',
    'ai_mobile_memory_cache',
    'ai_mobile_outbox_actions',
    'ai_mobile_inbox_cursors',
    'ai_mobile_tombstones',
    'ai_mobile_lifecycle_diagnostics',
    'ai_mobile_notification_events',
    'ai_mobile_playground_projections',
    'ai_mobile_diagnostic_exports'
  ]) {
    assert.match(databaseSource, new RegExp(table));
  }
  assert.match(databaseSource, /ai_mobile_memory_cache_identity_idx/);
  assert.match(databaseSource, /ai_mobile_lifecycle_recent_idx/);
  assert.match(databaseSource, /ai_mobile_playground_kind_idx/);
});

test('mobile AI repository uses generated contracts and desktop-owned execution', () => {
  assert.match(repositorySource, /aiMobileContractVersion/);
  assert.match(repositorySource, /aiMobileExecutionOwnership\[jobType\]/);
  assert.match(repositorySource, /desktop_owned_execution/);
  assert.match(repositorySource, /isAiMobileMicroUnitAmount/);
  assert.doesNotMatch(repositorySource, /mobile_direct_provider_execution/);
});

test('mobile AI outbox and inbox are wired through shared sync worker', () => {
  assert.match(syncWorkerSource, /MobileAIRepository/);
  assert.match(syncWorkerSource, /markOutboxAccepted/);
  assert.match(syncWorkerSource, /applyRemoteEnvelope/);
  assert.match(syncWorkerSource, /startsWith\('ai\.'\)/);
});

test('mobile AI projections reject secret-bearing fields by name', () => {
  for (const forbidden of [
    'apiKey',
    'authorization',
    'rawPrompt',
    'rawProviderResponse',
    'leaseToken',
    'reservationOwnerToken'
  ]) {
    assert.match(repositorySource, new RegExp(forbidden));
  }
  assert.match(repositorySource, /MobileAISecurityException/);
});

test('mobile AI analysis experience preserves desktop-owned queue execution', () => {
  for (const action of [
    'queueManualAnalysisRequest',
    'queueRegenerationRequest',
    'queueCancellation',
    'queueRetry',
    'saveScheduleSettings'
  ]) {
    assert.match(repositorySource, new RegExp(action));
    assert.match(analysisScreenSource, new RegExp(action));
  }
  assert.match(analysisScreenSource, /Desktop-owned execution/);
  assert.match(analysisScreenSource, /desktop-owned queue/);
  assert.doesNotMatch(analysisScreenSource, /generateContent|streamText|provider\\.invoke/);
});

test('mobile AI analysis screen exposes safe result and provenance disclosures', () => {
  for (const disclosure of [
    'Provider:',
    'Fallback:',
    'Input tokens:',
    'Output tokens:',
    'micro-usd',
    'Provenance and evidence',
    'Structured sections',
    'Deleted or unavailable evidence'
  ]) {
    assert.match(analysisScreenSource, new RegExp(disclosure));
  }
  assert.doesNotMatch(analysisScreenSource, /rawProviderResponse|leaseToken|reservationOwnerToken/);
});

test('mobile AI privacy and budget controls synchronize through durable outbox', () => {
  for (const action of [
    'queuePrivacyModeUpdate',
    'queueCloudConsentUpdate',
    'queueBudgetUpdate',
    'queueKillSwitchUpdate',
    'queueSafeExportRequest',
    'queueProviderProfileDeletion'
  ]) {
    assert.match(repositorySource, new RegExp(action));
  }
  for (const actionKind of [
    'ai.policy.privacy.update',
    'ai.consent.revoke',
    'ai.budget.update',
    'ai.kill_switch.update',
    'ai.export.request',
    'ai.provider_profile.delete'
  ]) {
    assert.match(repositorySource, new RegExp(actionKind.replaceAll('.', '\\.')));
  }
  assert.match(repositorySource, /isAiMobileMicroUnitAmount/);
  assert.match(repositorySource, /desktop_owned_no_mobile_secrets/);
});

test('mobile AI policy UI renders consent, provider, budget, switch, and export-safe disclosures', () => {
  for (const disclosure of [
    'Privacy, consent, and budget',
    'Cloud consent',
    'Provider profiles',
    'Subsystem switches',
    'Unknown pricing is blocked',
    'Provider secrets are not synchronized to mobile'
  ]) {
    assert.match(analysisScreenSource, new RegExp(disclosure));
  }
  assert.doesNotMatch(analysisScreenSource, /encryptedCredential|credentialBlob|privateKey/);
});

test('mobile AI memory reads synchronized projections and queues authoritative actions', () => {
  for (const method of [
    'searchMemory',
    'listFacts',
    'listGraphNodes',
    'listMemoryAnswers',
    'queueMemoryQuestion',
    'queueFactReject',
    'queueFactReextract',
    'queueGraphAction',
    'queueMemoryControl'
  ]) {
    assert.match(repositorySource, new RegExp(method));
  }
  for (const actionKind of [
    'ai.retrieval_qa.request',
    'ai.fact.reject',
    'ai.graph.merge',
    'ai.memory.rebuild'
  ]) {
    assert.match(repositorySource, new RegExp(actionKind.replaceAll('.', '\\.')));
  }
  assert.match(repositorySource, /playgroundOnly/);
  assert.match(repositorySource, /privacyBlocked/);
});

test('mobile AI memory UI discloses cache, provenance, uncertainty, and remote execution', () => {
  for (const disclosure of [
    'AI memory',
    'Semantic and hybrid search',
    'Facts',
    'Knowledge graph',
    'Evidence-backed Q&A',
    'Heavy embedding, fact, graph, and retrieval work runs on the authoritative desktop/backend executor'
  ]) {
    assert.match(memoryScreenSource, new RegExp(disclosure));
  }
  assert.doesNotMatch(
    memoryScreenSource,
    /generateContent|streamText|provider\\.invoke|rawProviderResponse/
  );
});

test('mobile AI execution adapter preserves desktop-owned lifecycle semantics', () => {
  for (const method of [
    'recoverAfterColdStart',
    'recoverAfterResume',
    'recordBackgrounded',
    'recordSuspended',
    'synchronizeAfterReconnect',
    'recordOffline',
    'recordTokenRefreshRequired',
    'recordProfileSwitch',
    'validateDeepLink'
  ]) {
    assert.match(executionAdapterSource, new RegExp(method));
  }
  assert.match(executionAdapterSource, /desktop-owned execution/);
  assert.match(executionAdapterSource, /queued_for_desktop/);
  assert.doesNotMatch(
    executionAdapterSource,
    /generateContent|streamText|provider\\.invoke|mobile_direct_provider_execution/
  );
});

test('mobile AI lifecycle recovery and notifications are bounded and secret-free', () => {
  for (const method of [
    'recordLifecycleDiagnostic',
    'recoverLifecycleState',
    'lifecycleSnapshot',
    'recordSyncLifecycleResult',
    'safeNotificationIntents',
    'validateDeepLink'
  ]) {
    assert.match(repositorySource, new RegExp(method));
  }
  assert.match(repositorySource, /LIMIT 200/);
  assert.match(repositorySource, /owner_or_workspace_mismatch/);
  assert.match(repositorySource, /executor_unavailable/);
  assert.match(repositorySource, /consent_required/);
  assert.match(repositorySource, /budget_blocked/);
  assert.match(syncWorkerSource, /recordSyncLifecycleResult/);
  assert.match(syncWorkerSource, /connectivity_none/);
  assert.doesNotMatch(repositorySource, /authorization header|raw private logs|secret endpoint/);
});

test('mobile Playground decision is desktop-only, read-only, and isolated', () => {
  for (const method of [
    'playgroundDecision',
    'listPlaygroundSessions',
    'listPlaygroundRuns',
    'listPlaygroundEvaluations',
    'validatePlaygroundImport',
    'safePlaygroundExportPreview',
    'mobileDiagnosticsBundle',
    'queuePlaygroundExecutionSwitch',
    'queuePlaygroundProjectionDeletion'
  ]) {
    assert.match(repositorySource, new RegExp(method));
  }
  assert.match(repositorySource, /desktop_only_power_user_tool/);
  assert.match(repositorySource, /readOnlySharedSessions: true/);
  assert.match(repositorySource, /productionPromotion/);
  assert.match(repositorySource, /deleteProductionData': false/);
  const manualAnalysisSource = methodSource(repositorySource, 'queueManualAnalysisRequest');
  assert.match(manualAnalysisSource, /manual_analysis/);
  assert.doesNotMatch(manualAnalysisSource, /ai_mobile_playground_projections|ai\\.playground/);
  assert.match(playgroundScreenSource, /Execution requires desktop/);
  assert.match(playgroundScreenSource, /Read-only shared sessions/);
  assert.doesNotMatch(
    playgroundScreenSource,
    /runPrompt|streamText|generateContent|provider\\.invoke/
  );
});

test('mobile Playground import export diagnostics reject unsafe exchange', () => {
  for (const rejection of [
    'oversized_artifact',
    'unsupported_schema',
    'unsupported_artifact_type',
    'unsafe_name_or_path',
    'duplicate_case_id',
    'credential_or_secret_field',
    'embedded_instructions_treated_as_untrusted_data'
  ]) {
    assert.match(repositorySource, new RegExp(rejection));
  }
  for (const safeField of [
    'excludeCredentials',
    'excludeRawPrompts',
    'excludeRawProviderResponses',
    'excludeProductionDataByDefault',
    'requires_explicit_desktop_export'
  ]) {
    assert.match(repositorySource, new RegExp(safeField));
  }
  assert.match(playgroundScreenSource, /one run is not model superiority/);
  assert.match(playgroundScreenSource, /production data by default/);
});

test('mobile AI hardening enforces security, resource, accessibility, and packaging gates', () => {
  for (const method of [
    'mobileSecurityReview',
    'mobileResourcePolicy',
    'mobilePerformanceSnapshot',
    'mobilePackagingReadiness',
    'mobileReleaseGateSnapshot',
    'assertSecretFreeLocalAiProjection'
  ]) {
    assert.match(repositorySource, new RegExp(method));
  }
  for (const token of [
    'maxCachedRecords',
    'maxResponseBytes',
    'maxImportBytes',
    'maxContextPreviewBytes',
    'maxStreamingBufferBytes',
    'maxBackgroundRetries',
    'maxOutboxActions',
    'maxDiagnosticExportBytes',
    'synthetic_mobile_ai_mh_v1',
    'desktop_owned_no_mobile_secrets',
    'flutter_toolchain_unavailable_in_current_environment',
    'not_built_in_current_environment',
    'requires_flutter_analyze_test_build_release_install_launch_upgrade_smoke'
  ]) {
    assert.match(repositorySource, new RegExp(token));
  }
  assert.match(endpointPolicySource, /https/);
  assert.match(endpointPolicySource, /localhost/);
  assert.match(apiClientSource, /requireFocusLogSafeEndpoint/);
  assert.match(apiClientSource, /_focusLogMaxApiResponseBytes/);
  assert.match(syncWorkerSourceSecurity, /requireFocusLogSafeEndpoint/);
  assert.match(syncWorkerSourceSecurity, /_focusLogMaxSyncResponseBytes/);
  assert.match(safetyScreenSource, /Semantics/);
  assert.match(safetyScreenSource, /liveRegion: true/);
  assert.match(safetyScreenSource, /Resource controls/);
  assert.match(safetyScreenSource, /Packaging readiness/);
  assert.match(safetyScreenSource, /Mobile release gate/);
  assert.match(androidManifestSource, /android:allowBackup="false"/);
  assert.match(androidManifestSource, /android:usesCleartextTraffic="false"/);
  assert.doesNotMatch(androidManifestSource, /REQUEST_IGNORE_BATTERY_OPTIMIZATIONS/);
  assert.match(mobileAiGatesWorkflowSource, /fast-pr/);
  assert.match(mobileAiGatesWorkflowSource, /nightly/);
  assert.match(mobileAiGatesWorkflowSource, /release-candidate/);
  assert.match(mobileAiGatesWorkflowSource, /flutter analyze/);
  assert.match(mobileAiGatesWorkflowSource, /flutter test test\/ai/);
  assert.match(ciWorkflowSource, /if: github\.event_name == 'push'/);
});

test('mobile release gate records Android certification blockers without claiming parity', () => {
  assert.match(repositorySource, /mobileReleaseGateSnapshot/);
  assert.match(repositorySource, /flutter_toolchain_unavailable_in_current_environment/);
  assert.match(repositorySource, /not_built_in_current_environment/);
  assert.match(safetyScreenSource, /Mobile release gate/);
  assert.match(mobileReleaseReportSource, /Android gates are blocked locally/);
  assert.match(mobileReleaseReportSource, /Release artifact: not built in this environment/);
  assert.match(mobileReleaseReportSource, /Do not describe FocusLog mobile AI as complete/);
  assert.match(aiArchitectureSource, /Android synchronizes mobile-safe AI projections/);
  assert.match(aiArchitectureSource, /does not execute providers/);
  assert.match(aiTroubleshootingSource, /Mobile AI release gate/);
  assert.match(aiTroubleshootingSource, /flutter is not recognized/);
  for (const row of ['M-I-1', 'M-I-2', 'M-I-3', 'M-I-4', 'M-I-5']) {
    assert.match(mobileAcceptanceSource, new RegExp(`\\| ${row} \\|`));
  }
  assert.match(mobileReleaseReportSource, /Do not describe FocusLog mobile AI as complete/);
  assert.doesNotMatch(mobileReleaseReportSource, /Android is certified|production-ready Android/i);
});

test('cross-platform final gate records architecture and blocks false Android certification', () => {
  assert.match(sharedTypesIndexSource, /cross-platform-release/);
  assert.match(crossPlatformReleaseSource, /crossPlatformReleaseSnapshot/);
  assert.match(crossPlatformReleaseSource, /desktop_owned_authoritative_execution/);
  assert.match(crossPlatformReleaseSource, /blocked_flutter_unavailable/);
  assert.match(crossPlatformReleaseSource, /completionDeclarationPermitted: false/);
  assert.match(crossPlatformReleaseSource, /X-FINAL-ANDROID-RUNTIME/);
  assert.match(crossPlatformReleaseSource, /blocked_by_concrete_release_defect/);
  assert.match(crossPlatformReleaseSource, /not_applicable_platform_absent/);

  for (const ownership of [
    'Desktop is the authoritative AI executor',
    'Android reads mobile-safe projections',
    'does not execute providers',
    'iOS is not applicable'
  ]) {
    assert.match(crossPlatformArchitectureSource, new RegExp(ownership));
  }

  for (const row of [
    'X-FINAL-ARCH',
    'X-FINAL-CONTRACTS',
    'X-FINAL-ANALYSIS-FLOWS',
    'X-FINAL-POLICY-BUDGET',
    'X-FINAL-MEMORY',
    'X-FINAL-PLAYGROUND',
    'X-FINAL-OFFLINE-LIFECYCLE',
    'X-FINAL-DELETION-EXPORT-DIAGNOSTICS',
    'X-FINAL-SECURITY',
    'X-FINAL-DESKTOP-BUILD',
    'X-FINAL-BACKEND-BUILD',
    'X-FINAL-ANDROID-BUILD',
    'X-FINAL-IOS-BUILD'
  ]) {
    assert.match(crossPlatformAcceptanceSource, new RegExp(`\\| ${row} \\|`));
  }

  assert.match(crossPlatformAcceptanceSource, /flutter.*unavailable on PATH/i);
  assert.match(crossPlatformAcceptanceSource, /Not applicable - platform absent/);
  assert.match(
    crossPlatformAcceptanceSource,
    /final phrase `FocusLog AI integration complete and verified across supported desktop and mobile platforms` is not permitted/
  );
  assert.match(
    crossPlatformHardeningSource,
    /Core Android analyze\/test\/build\/install verification is not listed here/
  );
  assert.doesNotMatch(
    crossPlatformHardeningSource,
    /Android Flutter analyze, tests, build, install\/launch/
  );
});
