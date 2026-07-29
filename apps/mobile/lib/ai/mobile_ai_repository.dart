import 'dart:convert';

import 'package:drift/drift.dart';

import '../data/database/app_database.dart';
import '../generated/contracts.dart';
import '../identity/device_identity.dart';

const _defaultWorkspaceId = 'default';
const _mobileAiOutboxPending = 'pending';
const _mobileAiOutboxAccepted = 'accepted';
const _mobileAiOutboxRejected = 'rejected';
const _mobileAiOutboxConflict = 'conflict';

const _analysisLevels = <String>{
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
};

const _supportedKillSwitches = <String>{
  'provider_calls',
  'scheduled_analyses',
  'provider_profile',
  'fallback_chain',
  'embeddings',
  'fact_extraction',
  'graph_update',
  'retrieval_qa',
  'playground',
  'cloud_execution',
  'background_queue',
};

const _forbiddenProjectionKeys = <String>{
  'credential',
  'credentials',
  'apiKey',
  'api_key',
  'authorization',
  'Authorization',
  'rawPrompt',
  'raw_prompt',
  'rawProviderResponse',
  'raw_provider_response',
  'leaseToken',
  'lease_token',
  'reservationOwnerToken',
  'reservation_owner_token',
};

const _mobileMaxCachedRecords = 500;
const _mobileMaxResponseBytes = 262144;
const _mobileMaxImportBytes = 262144;
const _mobileMaxContextPreviewBytes = 32768;
const _mobileMaxStreamingBufferBytes = 65536;
const _mobileMaxBackgroundRetries = 5;
const _mobileMaxOutboxActions = 500;
const _mobileMaxDiagnosticExportBytes = 131072;

class MobileAICompatibilityException implements Exception {
  const MobileAICompatibilityException(this.code, this.message);
  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}

class MobileAISecurityException implements Exception {
  const MobileAISecurityException(this.message);
  final String message;

  @override
  String toString() => 'MobileAISecurityException: $message';
}

class MobileAIAnalysisResult {
  const MobileAIAnalysisResult({
    required this.id,
    required this.level,
    required this.periodKey,
    required this.resultVersion,
    required this.status,
    required this.summary,
    required this.costMicros,
    required this.staleState,
  });

  final String id;
  final String level;
  final String periodKey;
  final int resultVersion;
  final String status;
  final String summary;
  final String costMicros;
  final String staleState;
}

class MobileAIAnalysisListItem {
  const MobileAIAnalysisListItem({
    required this.id,
    required this.level,
    required this.periodKey,
    required this.resultVersion,
    required this.status,
    required this.summary,
    required this.costMicros,
    required this.staleState,
    required this.createdAt,
  });

  final String id;
  final String level;
  final String periodKey;
  final int resultVersion;
  final String status;
  final String summary;
  final String costMicros;
  final String staleState;
  final DateTime createdAt;
}

class MobileAIAnalysisDetail {
  const MobileAIAnalysisDetail({
    required this.item,
    required this.structured,
    required this.provider,
    required this.fallback,
    required this.provenance,
    required this.usage,
  });

  final MobileAIAnalysisListItem item;
  final Map<String, dynamic> structured;
  final Map<String, dynamic> provider;
  final Map<String, dynamic> fallback;
  final Map<String, dynamic> provenance;
  final Map<String, dynamic> usage;
}

class MobileAIJobListItem {
  const MobileAIJobListItem({
    required this.id,
    required this.jobType,
    required this.status,
    required this.idempotencyKey,
    required this.costMicros,
    required this.provider,
    required this.error,
    required this.resultId,
    required this.updatedAt,
  });

  final String id;
  final String jobType;
  final String status;
  final String idempotencyKey;
  final String costMicros;
  final Map<String, dynamic> provider;
  final Map<String, dynamic>? error;
  final String? resultId;
  final DateTime updatedAt;
}

class MobileAIScheduleSettings {
  const MobileAIScheduleSettings({
    required this.level,
    required this.enabled,
    required this.localTime,
    required this.timezone,
    required this.providerProfileId,
    required this.model,
    required this.fallbackChainId,
    required this.privacyMode,
    required this.maxCostMicros,
    required this.killSwitch,
    required this.nextExpectedRun,
    required this.lastSuccessfulRun,
    required this.blockedReason,
  });

  final String level;
  final bool enabled;
  final String localTime;
  final String timezone;
  final String providerProfileId;
  final String model;
  final String fallbackChainId;
  final String privacyMode;
  final String maxCostMicros;
  final bool killSwitch;
  final String? nextExpectedRun;
  final String? lastSuccessfulRun;
  final String? blockedReason;

  Map<String, Object?> toJson() => {
        'level': level,
        'enabled': enabled,
        'localTime': localTime,
        'timezone': timezone,
        'providerProfileId': providerProfileId,
        'model': model,
        'fallbackChainId': fallbackChainId,
        'privacyMode': privacyMode,
        'maxCostMicros': maxCostMicros,
        'killSwitch': killSwitch,
        'nextExpectedRun': nextExpectedRun,
        'lastSuccessfulRun': lastSuccessfulRun,
        'blockedReason': blockedReason,
      };
}

class MobileAIExecutorStatus {
  const MobileAIExecutorStatus({
    required this.executionOwner,
    required this.availability,
    required this.lastSeenAt,
    required this.message,
  });

  final String executionOwner;
  final String availability;
  final String? lastSeenAt;
  final String message;
}

class MobileAIProviderProfile {
  const MobileAIProviderProfile({
    required this.id,
    required this.displayName,
    required this.classification,
    required this.endpointHost,
    required this.capabilities,
    required this.modelAvailability,
    required this.validationStatus,
    required this.credentialConfigured,
  });

  final String id;
  final String displayName;
  final String classification;
  final String endpointHost;
  final List<String> capabilities;
  final String modelAvailability;
  final String validationStatus;
  final bool credentialConfigured;
}

class MobileAIBudgetSnapshot {
  const MobileAIBudgetSnapshot({
    required this.month,
    required this.currency,
    required this.monthlyLimitMicros,
    required this.settledMicros,
    required this.reservedMicros,
    required this.remainingMicros,
    required this.requestCapMicros,
    required this.unknownPricingBlocked,
  });

  final String month;
  final String currency;
  final String monthlyLimitMicros;
  final String settledMicros;
  final String reservedMicros;
  final String remainingMicros;
  final String requestCapMicros;
  final bool unknownPricingBlocked;

  Map<String, Object?> toJson() => {
        'month': month,
        'currency': currency,
        'monthlyLimitMicros': monthlyLimitMicros,
        'settledMicros': settledMicros,
        'reservedMicros': reservedMicros,
        'remainingMicros': remainingMicros,
        'requestCapMicros': requestCapMicros,
        'unknownPricingBlocked': unknownPricingBlocked,
      };
}

class MobileAIPolicySnapshot {
  const MobileAIPolicySnapshot({
    required this.privacyMode,
    required this.cloudConsentActive,
    required this.cloudExecutionDisabled,
    required this.pendingOperationCount,
    required this.consentPurposes,
    required this.consentEvidence,
    required this.providerProfiles,
    required this.killSwitches,
    required this.budget,
    required this.mobileCredentialMode,
  });

  final String privacyMode;
  final bool cloudConsentActive;
  final bool cloudExecutionDisabled;
  final int pendingOperationCount;
  final List<String> consentPurposes;
  final Map<String, dynamic> consentEvidence;
  final List<MobileAIProviderProfile> providerProfiles;
  final Map<String, bool> killSwitches;
  final MobileAIBudgetSnapshot budget;
  final String mobileCredentialMode;
}

class MobileMemorySearchResult {
  const MobileMemorySearchResult({
    required this.id,
    required this.sourceId,
    required this.sourceType,
    required this.excerpt,
    required this.score,
    required this.timestamp,
    required this.namespace,
    required this.model,
    required this.mode,
    required this.staleState,
    required this.metadata,
  });

  final String id;
  final String sourceId;
  final String sourceType;
  final String excerpt;
  final double score;
  final String timestamp;
  final String namespace;
  final String model;
  final String mode;
  final String staleState;
  final Map<String, dynamic> metadata;
}

class MobileMemoryFact {
  const MobileMemoryFact({
    required this.id,
    required this.subject,
    required this.predicate,
    required this.value,
    required this.status,
    required this.confidence,
    required this.validFrom,
    required this.validTo,
    required this.provider,
    required this.model,
    required this.evidence,
    required this.staleState,
  });

  final String id;
  final String subject;
  final String predicate;
  final String value;
  final String status;
  final double confidence;
  final String? validFrom;
  final String? validTo;
  final String provider;
  final String model;
  final List<Map<String, dynamic>> evidence;
  final String staleState;
}

class MobileGraphNode {
  const MobileGraphNode({
    required this.id,
    required this.label,
    required this.type,
    required this.status,
    required this.confidence,
    required this.neighbors,
    required this.evidence,
  });

  final String id;
  final String label;
  final String type;
  final String status;
  final double confidence;
  final List<Map<String, dynamic>> neighbors;
  final List<Map<String, dynamic>> evidence;
}

class MobileMemoryAnswer {
  const MobileMemoryAnswer({
    required this.id,
    required this.question,
    required this.answer,
    required this.provider,
    required this.model,
    required this.fallbackUsed,
    required this.uncertainty,
    required this.staleDisclosure,
    required this.evidence,
    required this.createdAt,
  });

  final String id;
  final String question;
  final String answer;
  final String provider;
  final String model;
  final bool fallbackUsed;
  final String uncertainty;
  final String staleDisclosure;
  final List<Map<String, dynamic>> evidence;
  final DateTime createdAt;
}

class MobileMemoryStatus {
  const MobileMemoryStatus({
    required this.activeNamespace,
    required this.coverage,
    required this.pendingJobs,
    required this.failedJobs,
    required this.staleCount,
    required this.provider,
    required this.model,
    required this.storageBytes,
    required this.paused,
  });

  final String activeNamespace;
  final String coverage;
  final int pendingJobs;
  final int failedJobs;
  final int staleCount;
  final String provider;
  final String model;
  final int storageBytes;
  final bool paused;
}

class MobileAILifecycleDiagnostic {
  const MobileAILifecycleDiagnostic({
    required this.id,
    required this.normalizedState,
    required this.category,
    required this.jobId,
    required this.safeReason,
    required this.createdAt,
  });

  final String id;
  final String normalizedState;
  final String category;
  final String? jobId;
  final String safeReason;
  final DateTime createdAt;
}

class MobileAIRecoverySnapshot {
  const MobileAIRecoverySnapshot({
    required this.executionOwner,
    required this.executorAvailability,
    required this.pendingActions,
    required this.acceptedAwaitingResult,
    required this.queuedForDesktop,
    required this.cancellationPending,
    required this.lastDiagnostic,
  });

  final String executionOwner;
  final String executorAvailability;
  final int pendingActions;
  final int acceptedAwaitingResult;
  final int queuedForDesktop;
  final int cancellationPending;
  final MobileAILifecycleDiagnostic? lastDiagnostic;
}

class MobileAINotificationIntent {
  const MobileAINotificationIntent({
    required this.id,
    required this.kind,
    required this.targetKind,
    required this.targetId,
    required this.title,
    required this.body,
    required this.payload,
  });

  final String id;
  final String kind;
  final String targetKind;
  final String targetId;
  final String title;
  final String body;
  final Map<String, dynamic> payload;
}

class MobileAIDeepLinkTarget {
  const MobileAIDeepLinkTarget({
    required this.allowed,
    required this.reason,
    required this.targetKind,
    required this.targetId,
  });

  final bool allowed;
  final String reason;
  final String targetKind;
  final String? targetId;
}

class MobileAISecurityReview {
  const MobileAISecurityReview({
    required this.credentialStorage,
    required this.cloudTransport,
    required this.deepLinks,
    required this.notifications,
    required this.exports,
    required this.imports,
    required this.promptInjectionBoundary,
    required this.platformConfiguration,
    required this.screenshotAndClipboardPolicy,
    required this.safeDiagnostics,
    required this.findings,
  });

  final String credentialStorage;
  final String cloudTransport;
  final String deepLinks;
  final String notifications;
  final String exports;
  final String imports;
  final String promptInjectionBoundary;
  final String platformConfiguration;
  final String screenshotAndClipboardPolicy;
  final String safeDiagnostics;
  final List<String> findings;

  Map<String, Object?> toJson() => {
        'credentialStorage': credentialStorage,
        'cloudTransport': cloudTransport,
        'deepLinks': deepLinks,
        'notifications': notifications,
        'exports': exports,
        'imports': imports,
        'promptInjectionBoundary': promptInjectionBoundary,
        'platformConfiguration': platformConfiguration,
        'screenshotAndClipboardPolicy': screenshotAndClipboardPolicy,
        'safeDiagnostics': safeDiagnostics,
        'findings': findings,
      };
}

class MobileAIResourcePolicy {
  const MobileAIResourcePolicy({
    required this.maxCachedRecords,
    required this.maxResponseBytes,
    required this.maxImportBytes,
    required this.maxContextPreviewBytes,
    required this.maxStreamingBufferBytes,
    required this.maxBackgroundRetries,
    required this.maxOutboxActions,
    required this.maxDiagnosticExportBytes,
    required this.currentCachedRecords,
    required this.currentOutboxActions,
    required this.currentDiagnosticRows,
    required this.limitReached,
    required this.recovery,
  });

  final int maxCachedRecords;
  final int maxResponseBytes;
  final int maxImportBytes;
  final int maxContextPreviewBytes;
  final int maxStreamingBufferBytes;
  final int maxBackgroundRetries;
  final int maxOutboxActions;
  final int maxDiagnosticExportBytes;
  final int currentCachedRecords;
  final int currentOutboxActions;
  final int currentDiagnosticRows;
  final bool limitReached;
  final String recovery;

  Map<String, Object?> toJson() => {
        'maxCachedRecords': maxCachedRecords,
        'maxResponseBytes': maxResponseBytes,
        'maxImportBytes': maxImportBytes,
        'maxContextPreviewBytes': maxContextPreviewBytes,
        'maxStreamingBufferBytes': maxStreamingBufferBytes,
        'maxBackgroundRetries': maxBackgroundRetries,
        'maxOutboxActions': maxOutboxActions,
        'maxDiagnosticExportBytes': maxDiagnosticExportBytes,
        'currentCachedRecords': currentCachedRecords,
        'currentOutboxActions': currentOutboxActions,
        'currentDiagnosticRows': currentDiagnosticRows,
        'limitReached': limitReached,
        'recovery': recovery,
      };
}

class MobileAIPerformanceSnapshot {
  const MobileAIPerformanceSnapshot({
    required this.fixture,
    required this.syntheticDataOnly,
    required this.analysisRows,
    required this.memoryRows,
    required this.factRows,
    required this.graphRows,
    required this.pendingJobRows,
    required this.playgroundRows,
    required this.startupBudgetMs,
    required this.navigationBudgetMs,
    required this.searchRenderBudgetMs,
    required this.syncApplyBudgetMs,
    required this.exportBudgetMs,
    required this.deletionCleanupBudgetMs,
    required this.uiThreadPolicy,
    required this.backgroundPolicy,
  });

  final String fixture;
  final bool syntheticDataOnly;
  final int analysisRows;
  final int memoryRows;
  final int factRows;
  final int graphRows;
  final int pendingJobRows;
  final int playgroundRows;
  final int startupBudgetMs;
  final int navigationBudgetMs;
  final int searchRenderBudgetMs;
  final int syncApplyBudgetMs;
  final int exportBudgetMs;
  final int deletionCleanupBudgetMs;
  final String uiThreadPolicy;
  final String backgroundPolicy;

  Map<String, Object?> toJson() => {
        'fixture': fixture,
        'syntheticDataOnly': syntheticDataOnly,
        'analysisRows': analysisRows,
        'memoryRows': memoryRows,
        'factRows': factRows,
        'graphRows': graphRows,
        'pendingJobRows': pendingJobRows,
        'playgroundRows': playgroundRows,
        'startupBudgetMs': startupBudgetMs,
        'navigationBudgetMs': navigationBudgetMs,
        'searchRenderBudgetMs': searchRenderBudgetMs,
        'syncApplyBudgetMs': syncApplyBudgetMs,
        'exportBudgetMs': exportBudgetMs,
        'deletionCleanupBudgetMs': deletionCleanupBudgetMs,
        'uiThreadPolicy': uiThreadPolicy,
        'backgroundPolicy': backgroundPolicy,
      };
}

class MobileAIPackagingReadiness {
  const MobileAIPackagingReadiness({
    required this.androidTarget,
    required this.iosTarget,
    required this.nativeDependencies,
    required this.permissions,
    required this.releaseExclusions,
    required this.upgradeCompatibility,
    required this.installSmokePreparedFor,
  });

  final String androidTarget;
  final String iosTarget;
  final List<String> nativeDependencies;
  final List<String> permissions;
  final List<String> releaseExclusions;
  final String upgradeCompatibility;
  final String installSmokePreparedFor;

  Map<String, Object?> toJson() => {
        'androidTarget': androidTarget,
        'iosTarget': iosTarget,
        'nativeDependencies': nativeDependencies,
        'permissions': permissions,
        'releaseExclusions': releaseExclusions,
        'upgradeCompatibility': upgradeCompatibility,
        'installSmokePreparedFor': installSmokePreparedFor,
      };
}

class MobileAIReleaseGateSnapshot {
  const MobileAIReleaseGateSnapshot({
    required this.platform,
    required this.schemaVersion,
    required this.supported,
    required this.androidVerification,
    required this.iosVerification,
    required this.blockingGate,
    required this.acceptanceStatus,
    required this.releaseArtifact,
    required this.installSmoke,
    required this.upgradeSmoke,
    required this.securityReview,
    required this.resourcePolicy,
    required this.performanceSnapshot,
    required this.knownLimitations,
  });

  final String platform;
  final int schemaVersion;
  final bool supported;
  final String androidVerification;
  final String iosVerification;
  final String blockingGate;
  final String acceptanceStatus;
  final String releaseArtifact;
  final String installSmoke;
  final String upgradeSmoke;
  final MobileAISecurityReview securityReview;
  final MobileAIResourcePolicy resourcePolicy;
  final MobileAIPerformanceSnapshot performanceSnapshot;
  final List<String> knownLimitations;

  Map<String, Object?> toJson() => {
        'platform': platform,
        'schemaVersion': schemaVersion,
        'supported': supported,
        'androidVerification': androidVerification,
        'iosVerification': iosVerification,
        'blockingGate': blockingGate,
        'acceptanceStatus': acceptanceStatus,
        'releaseArtifact': releaseArtifact,
        'installSmoke': installSmoke,
        'upgradeSmoke': upgradeSmoke,
        'securityReview': securityReview.toJson(),
        'resourcePolicy': resourcePolicy.toJson(),
        'performanceSnapshot': performanceSnapshot.toJson(),
        'knownLimitations': knownLimitations,
      };
}

class MobileAIPlaygroundDecision {
  const MobileAIPlaygroundDecision({
    required this.scope,
    required this.mobileExecutionSupported,
    required this.readOnlySharedSessions,
    required this.reason,
    required this.unsupportedActions,
  });

  final String scope;
  final bool mobileExecutionSupported;
  final bool readOnlySharedSessions;
  final String reason;
  final List<String> unsupportedActions;
}

class MobileAIPlaygroundSession {
  const MobileAIPlaygroundSession({
    required this.id,
    required this.title,
    required this.status,
    required this.messageCount,
    required this.runCount,
    required this.branchCount,
    required this.provider,
    required this.model,
    required this.costMicros,
    required this.latestRunStatus,
    required this.updatedAt,
  });

  final String id;
  final String title;
  final String status;
  final int messageCount;
  final int runCount;
  final int branchCount;
  final String provider;
  final String model;
  final String costMicros;
  final String latestRunStatus;
  final DateTime updatedAt;
}

class MobileAIPlaygroundRun {
  const MobileAIPlaygroundRun({
    required this.id,
    required this.sessionId,
    required this.status,
    required this.provider,
    required this.model,
    required this.costMicros,
    required this.inputTokens,
    required this.outputTokens,
    required this.fallbackUsed,
    required this.structuredValid,
    required this.cancelled,
    required this.partial,
    required this.promptSnapshot,
    required this.contextSnapshot,
    required this.updatedAt,
  });

  final String id;
  final String sessionId;
  final String status;
  final String provider;
  final String model;
  final String costMicros;
  final int inputTokens;
  final int outputTokens;
  final bool fallbackUsed;
  final bool structuredValid;
  final bool cancelled;
  final bool partial;
  final Map<String, dynamic> promptSnapshot;
  final Map<String, dynamic> contextSnapshot;
  final DateTime updatedAt;
}

class MobileAIPlaygroundEvaluation {
  const MobileAIPlaygroundEvaluation({
    required this.id,
    required this.dataset,
    required this.status,
    required this.deterministicScore,
    required this.subjectiveLabel,
    required this.costMicros,
    required this.versionSummary,
    required this.updatedAt,
  });

  final String id;
  final String dataset;
  final String status;
  final double deterministicScore;
  final String subjectiveLabel;
  final String costMicros;
  final String versionSummary;
  final DateTime updatedAt;
}

class MobileAIArtifactValidation {
  const MobileAIArtifactValidation({
    required this.accepted,
    required this.reason,
    required this.warnings,
  });

  final bool accepted;
  final String reason;
  final List<String> warnings;
}

class MobileAIRepository {
  MobileAIRepository(
    this.database,
    this.identity, {
    this.workspaceId = _defaultWorkspaceId,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final AppDatabase database;
  final DeviceIdentity identity;
  final String workspaceId;
  final DateTime Function() _clock;

  String get _ownerId => identity.ownerId;
  String get _deviceId => identity.deviceId;

  Future<String> queueManualAnalysisRequest({
    required String level,
    required String periodKey,
    bool regeneration = false,
  }) {
    if (!_analysisLevels.contains(level)) {
      throw ArgumentError.value(level, 'level', 'Unsupported analysis level.');
    }
    final jobType = '${level}_analysis';
    _requireSupportedJobType(jobType);
    return _queueAiAction(
      actionKind: 'ai.analysis.request',
      entityType: 'ai_request',
      idempotencyKey:
          'ai:$workspaceId:manual_analysis:$jobType:$periodKey:${regeneration ? 'regenerate' : 'current'}',
      payload: {
        'schemaVersion': aiMobileContractVersion,
        'workspaceId': workspaceId,
        'jobType': jobType,
        'level': level,
        'periodKey': periodKey,
        'regeneration': regeneration,
        'executionOwnership': aiMobileExecutionOwnership[jobType],
      },
      jobProjection: {
        'jobType': jobType,
        'periodKey': periodKey,
      },
    );
  }

  Future<String> queueRegenerationRequest({
    required String level,
    required String periodKey,
  }) =>
      queueManualAnalysisRequest(
        level: level,
        periodKey: periodKey,
        regeneration: true,
      );

  Future<String> queueCancellation(String jobId) => _queueAiAction(
        actionKind: 'ai.job.cancel',
        entityType: 'ai_job',
        idempotencyKey: 'ai:$workspaceId:cancel:$jobId',
        entityId: jobId,
        payload: {
          'schemaVersion': aiMobileContractVersion,
          'workspaceId': workspaceId,
          'jobId': jobId,
        },
      );

  Future<String> queueRetry(String jobId) => _queueAiAction(
        actionKind: 'ai.job.retry',
        entityType: 'ai_job',
        idempotencyKey: 'ai:$workspaceId:retry:$jobId',
        entityId: jobId,
        payload: {
          'schemaVersion': aiMobileContractVersion,
          'workspaceId': workspaceId,
          'jobId': jobId,
        },
      );

  Future<String> queueSettingsUpdate(Map<String, Object?> values) {
    _assertSecretFreeJson(values);
    return _queueAiAction(
      actionKind: 'ai.settings.update',
      entityType: 'ai_settings',
      idempotencyKey:
          'ai:$workspaceId:settings:${_stableJson(values)}',
      payload: {
        'schemaVersion': aiMobileContractVersion,
        'workspaceId': workspaceId,
        'values': values,
      },
    );
  }

  Future<String> queuePrivacyModeUpdate(String privacyMode) async {
    if (!aiMobilePrivacyModeWireNames.contains(privacyMode)) {
      throw ArgumentError.value(
        privacyMode,
        'privacyMode',
        'Unsupported AI privacy mode.',
      );
    }
    final values = await _aiSettingsValues();
    values['privacyMode'] = privacyMode;
    values['cloudExecutionDisabled'] = privacyMode == 'LOCAL' ||
        privacyMode == 'DISABLED' ||
        values['cloudExecutionDisabled'] == true;
    await _applySettings({
      'values': values,
      'updatedAt': _clock().toUtc().toIso8601String(),
    });
    return _queueAiAction(
      actionKind: 'ai.policy.privacy.update',
      entityType: 'ai_policy',
      idempotencyKey: 'ai:$workspaceId:privacy:$privacyMode:${_clock().toUtc().toIso8601String()}',
      payload: {
        'schemaVersion': aiMobileContractVersion,
        'workspaceId': workspaceId,
        'privacyMode': privacyMode,
        'pendingAuthoritativeRecheck': true,
      },
    );
  }

  Future<String> queueCloudConsentUpdate({
    required bool granted,
    required List<String> purposes,
  }) async {
    final cleanedPurposes = purposes
        .map((purpose) => purpose.trim())
        .where((purpose) => purpose.isNotEmpty)
        .toList();
    final nowText = _clock().toUtc().toIso8601String();
    final values = await _aiSettingsValues();
    values['cloudConsentActive'] = granted;
    values['cloudConsentEvidence'] = {
      'granted': granted,
      'changedAt': nowText,
      'deviceId': _deviceId,
      'purposes': cleanedPurposes,
    };
    if (!granted) values['cloudExecutionDisabled'] = true;
    await _applySettings({'values': values, 'updatedAt': nowText});
    return _queueAiAction(
      actionKind: granted ? 'ai.consent.grant' : 'ai.consent.revoke',
      entityType: 'ai_policy',
      idempotencyKey: 'ai:$workspaceId:consent:${granted ? 'grant' : 'revoke'}:$nowText',
      payload: {
        'schemaVersion': aiMobileContractVersion,
        'workspaceId': workspaceId,
        'granted': granted,
        'purposes': cleanedPurposes,
        'pendingAuthoritativeRecheck': true,
      },
    );
  }

  Future<String> queueBudgetUpdate({
    required String monthlyLimitMicros,
    required String requestCapMicros,
  }) async {
    _requireMicroUnits(monthlyLimitMicros);
    _requireMicroUnits(requestCapMicros);
    final values = await _aiSettingsValues();
    final budget = _budgetFromSettings(values).toJson();
    budget['monthlyLimitMicros'] = monthlyLimitMicros;
    budget['requestCapMicros'] = requestCapMicros;
    values['budget'] = budget;
    await _applySettings({
      'values': values,
      'updatedAt': _clock().toUtc().toIso8601String(),
    });
    return _queueAiAction(
      actionKind: 'ai.budget.update',
      entityType: 'ai_budget',
      idempotencyKey: 'ai:$workspaceId:budget:$monthlyLimitMicros:$requestCapMicros',
      payload: {
        'schemaVersion': aiMobileContractVersion,
        'workspaceId': workspaceId,
        'monthlyLimitMicros': monthlyLimitMicros,
        'requestCapMicros': requestCapMicros,
        'currency': 'micro_usd',
      },
    );
  }

  Future<String> queueKillSwitchUpdate({
    required String switchName,
    required bool enabled,
  }) async {
    if (!_supportedKillSwitches.contains(switchName)) {
      throw ArgumentError.value(
        switchName,
        'switchName',
        'Unsupported AI kill switch.',
      );
    }
    final values = await _aiSettingsValues();
    final switches = values['killSwitches'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(values['killSwitches'] as Map<String, dynamic>)
        : <String, dynamic>{};
    switches[switchName] = enabled;
    values['killSwitches'] = switches;
    await _applySettings({
      'values': values,
      'updatedAt': _clock().toUtc().toIso8601String(),
    });
    return _queueAiAction(
      actionKind: 'ai.kill_switch.update',
      entityType: 'ai_policy',
      idempotencyKey: 'ai:$workspaceId:kill_switch:$switchName:$enabled',
      payload: {
        'schemaVersion': aiMobileContractVersion,
        'workspaceId': workspaceId,
        'switchName': switchName,
        'enabled': enabled,
      },
    );
  }

  Future<String> queueSafeExportRequest({
    required bool includeAnalyses,
    required bool includeDerivedMemory,
    required bool includePlayground,
  }) =>
      _queueAiAction(
        actionKind: 'ai.export.request',
        entityType: 'ai_export',
        idempotencyKey:
            'ai:$workspaceId:export:$includeAnalyses:$includeDerivedMemory:$includePlayground',
        payload: {
          'schemaVersion': aiMobileContractVersion,
          'workspaceId': workspaceId,
          'includeAnalyses': includeAnalyses,
          'includeDerivedMemory': includeDerivedMemory,
          'includePlayground': includePlayground,
          'excludeCredentials': true,
          'excludeDeletedContent': true,
        },
      );

  Future<String> queueProviderProfileDeletion(String providerProfileId) =>
      _queueAiAction(
        actionKind: 'ai.provider_profile.delete',
        entityType: 'ai_provider_profile',
        idempotencyKey: 'ai:$workspaceId:provider_delete:$providerProfileId',
        entityId: providerProfileId,
        payload: {
          'schemaVersion': aiMobileContractVersion,
          'workspaceId': workspaceId,
          'providerProfileId': providerProfileId,
          'deleteCredentialOnAuthority': true,
        },
      );

  Future<String> queueMemoryQuestion({
    required String question,
    String mode = 'hybrid',
    int limit = 8,
  }) {
    final trimmed = question.trim();
    if (trimmed.isEmpty) {
      throw ArgumentError.value(question, 'question', 'Question is required.');
    }
    return _queueAiAction(
      actionKind: 'ai.retrieval_qa.request',
      entityType: 'ai_memory_query',
      idempotencyKey:
          'ai:$workspaceId:retrieval_qa:${_stableJson({'question': trimmed, 'mode': mode, 'limit': limit})}',
      payload: {
        'schemaVersion': aiMobileContractVersion,
        'workspaceId': workspaceId,
        'question': trimmed,
        'mode': mode,
        'limit': limit,
        'executionOwnership': aiMobileExecutionOwnership['retrieval_qa'],
      },
    );
  }

  Future<String> queueFactReextract(String factId) => _queueAiAction(
        actionKind: 'ai.fact.reextract',
        entityType: 'ai_fact',
        idempotencyKey: 'ai:$workspaceId:fact_reextract:$factId',
        entityId: factId,
        payload: {
          'schemaVersion': aiMobileContractVersion,
          'workspaceId': workspaceId,
          'factId': factId,
        },
      );

  Future<String> queueFactReject(String factId) => _queueAiAction(
        actionKind: 'ai.fact.reject',
        entityType: 'ai_fact',
        idempotencyKey: 'ai:$workspaceId:fact_reject:$factId',
        entityId: factId,
        payload: {
          'schemaVersion': aiMobileContractVersion,
          'workspaceId': workspaceId,
          'factId': factId,
        },
      );

  Future<String> queueGraphAction({
    required String action,
    required String nodeOrEdgeId,
    String? targetId,
  }) {
    const actionKinds = {
      'merge': 'ai.graph.merge',
      'split': 'ai.graph.split',
      'remove': 'ai.graph.remove',
      'rebuild': 'ai.graph.rebuild',
    };
    final actionKind = actionKinds[action];
    if (actionKind == null) {
      throw ArgumentError.value(action, 'action', 'Unsupported graph action.');
    }
    return _queueAiAction(
      actionKind: actionKind,
      entityType: 'ai_graph',
      idempotencyKey: 'ai:$workspaceId:graph:$action:$nodeOrEdgeId:${targetId ?? ''}',
      entityId: nodeOrEdgeId,
      payload: {
        'schemaVersion': aiMobileContractVersion,
        'workspaceId': workspaceId,
        'action': action,
        'nodeOrEdgeId': nodeOrEdgeId,
        if (targetId != null) 'targetId': targetId,
      },
    );
  }

  Future<String> queueMemoryControl({
    required String action,
    String? namespaceId,
  }) {
    const actionKinds = {
      'pause': 'ai.memory.pause',
      'resume': 'ai.memory.resume',
      'rebuild': 'ai.memory.rebuild',
      'delete': 'ai.memory.delete',
    };
    final actionKind = actionKinds[action];
    if (actionKind == null) {
      throw ArgumentError.value(action, 'action', 'Unsupported memory action.');
    }
    return _queueAiAction(
      actionKind: actionKind,
      entityType: 'ai_memory',
      idempotencyKey: 'ai:$workspaceId:memory:$action:${namespaceId ?? 'active'}',
      payload: {
        'schemaVersion': aiMobileContractVersion,
        'workspaceId': workspaceId,
        'action': action,
        'namespaceId': namespaceId ?? 'active',
        'executionOwnership': 'desktop_owned_execution',
      },
    );
  }

  Future<MobileAILifecycleDiagnostic> recordLifecycleDiagnostic({
    required String normalizedState,
    required String category,
    String? jobId,
    String safeReason = 'none',
  }) async {
    final now = _clock().toUtc();
    final diagnostic = MobileAILifecycleDiagnostic(
      id: generateSyncId(),
      normalizedState: _safeToken(normalizedState, fallback: 'unknown'),
      category: _safeToken(category, fallback: 'lifecycle'),
      jobId: jobId == null ? null : _safeToken(jobId, fallback: 'job'),
      safeReason: _safeReason(safeReason),
      createdAt: now,
    );
    await database.transaction(() async {
      await database.customStatement(
        'INSERT INTO ai_mobile_lifecycle_diagnostics '
        '(id, owner_id, workspace_id, normalized_state, category, job_id, safe_reason, created_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          diagnostic.id,
          _ownerId,
          workspaceId,
          diagnostic.normalizedState,
          diagnostic.category,
          diagnostic.jobId,
          diagnostic.safeReason,
          now.toIso8601String(),
        ],
      );
      await database.customStatement(
        'DELETE FROM ai_mobile_lifecycle_diagnostics WHERE id NOT IN ('
        'SELECT id FROM ai_mobile_lifecycle_diagnostics WHERE owner_id = ? '
        'AND workspace_id = ? ORDER BY created_at DESC LIMIT 200)',
        [_ownerId, workspaceId],
      );
    });
    return diagnostic;
  }

  Future<MobileAIRecoverySnapshot> recoverLifecycleState({
    required String reason,
  }) async {
    final diagnostic = await recordLifecycleDiagnostic(
      normalizedState: 'recovered',
      category: 'startup_recovery',
      safeReason: reason,
    );
    final pendingActions = await _countAiOutboxStates({_mobileAiOutboxPending});
    final acceptedAwaitingResult =
        await _countAiOutboxStates({_mobileAiOutboxAccepted});
    final queuedForDesktop = await _countJobsWithStatuses({
      'queued',
      'leased',
      'retry_wait',
      'waiting_for_dependencies',
    });
    final cancellationPending = await _countAiActions('ai.job.cancel');
    final executor = await executorStatus();
    return MobileAIRecoverySnapshot(
      executionOwner: executor.executionOwner,
      executorAvailability: executor.availability,
      pendingActions: pendingActions,
      acceptedAwaitingResult: acceptedAwaitingResult,
      queuedForDesktop: queuedForDesktop,
      cancellationPending: cancellationPending,
      lastDiagnostic: diagnostic,
    );
  }

  Future<MobileAIRecoverySnapshot> lifecycleSnapshot() async {
    final row = await database.customSelect(
      'SELECT * FROM ai_mobile_lifecycle_diagnostics WHERE owner_id = ? '
      'AND workspace_id = ? ORDER BY created_at DESC LIMIT 1',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
      ],
    ).getSingleOrNull();
    final pendingActions = await _countAiOutboxStates({_mobileAiOutboxPending});
    final acceptedAwaitingResult =
        await _countAiOutboxStates({_mobileAiOutboxAccepted});
    final queuedForDesktop = await _countJobsWithStatuses({
      'queued',
      'leased',
      'retry_wait',
      'waiting_for_dependencies',
    });
    final cancellationPending = await _countAiActions('ai.job.cancel');
    final executor = await executorStatus();
    return MobileAIRecoverySnapshot(
      executionOwner: executor.executionOwner,
      executorAvailability: executor.availability,
      pendingActions: pendingActions,
      acceptedAwaitingResult: acceptedAwaitingResult,
      queuedForDesktop: queuedForDesktop,
      cancellationPending: cancellationPending,
      lastDiagnostic:
          row == null ? null : _lifecycleDiagnosticFromRow(row),
    );
  }

  Future<void> recordSyncLifecycleResult({
    required String status,
    int pushed = 0,
    String? message,
  }) async {
    await recordLifecycleDiagnostic(
        normalizedState: status == 'synced' ? 'synchronized' : status,
        category: 'sync',
        safeReason: message ?? 'pushed_$pushed',
      );
  }

  Future<List<MobileAINotificationIntent>> safeNotificationIntents({
    int limit = 20,
  }) async {
    await _refreshNotificationIntents();
    final rows = await database.customSelect(
      'SELECT * FROM ai_mobile_notification_events WHERE owner_id = ? '
      'AND workspace_id = ? ORDER BY created_at DESC LIMIT ?',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
        Variable.withInt(limit),
      ],
    ).get();
    return rows.map(_notificationIntentFromRow).toList();
  }

  Future<MobileAIDeepLinkTarget> validateDeepLink({
    required String ownerId,
    required String workspaceId,
    required String targetKind,
    required String targetId,
  }) async {
    if (ownerId != _ownerId || workspaceId != this.workspaceId) {
      await recordLifecycleDiagnostic(
        normalizedState: 'blocked',
        category: 'deep_link',
        jobId: targetId,
        safeReason: 'owner_or_workspace_mismatch',
      );
      return MobileAIDeepLinkTarget(
        allowed: false,
        reason: 'owner_or_workspace_mismatch',
        targetKind: _safeToken(targetKind, fallback: 'unknown'),
        targetId: null,
      );
    }
    if (!const {
      'ai_job',
      'ai_result',
      'ai_memory',
      'ai_fact',
      'ai_graph',
    }.contains(targetKind)) {
      return const MobileAIDeepLinkTarget(
        allowed: false,
        reason: 'unsupported_target',
        targetKind: 'unknown',
        targetId: null,
      );
    }
    return MobileAIDeepLinkTarget(
      allowed: true,
      reason: 'allowed',
      targetKind: targetKind,
      targetId: _safeToken(targetId, fallback: 'target'),
    );
  }

  Future<String> queueFactCorrection({
    required String factId,
    required Map<String, Object?> correction,
  }) {
    _assertSecretFreeJson(correction);
    return _queueAiAction(
      actionKind: 'ai.fact.correct',
      entityType: 'ai_fact',
      idempotencyKey: 'ai:$workspaceId:fact_correct:$factId:${_stableJson(correction)}',
      entityId: factId,
      payload: {
        'schemaVersion': aiMobileContractVersion,
        'workspaceId': workspaceId,
        'factId': factId,
        'correction': correction,
      },
    );
  }

  Future<String> queueDeletionRequest({
    required String recordKind,
    required String recordId,
  }) =>
      _queueAiAction(
        actionKind: 'ai.record.delete',
        entityType: 'ai_record',
        idempotencyKey: 'ai:$workspaceId:delete:$recordKind:$recordId',
        entityId: recordId,
        payload: {
          'schemaVersion': aiMobileContractVersion,
          'workspaceId': workspaceId,
          'recordKind': recordKind,
          'recordId': recordId,
        },
      );

  Future<String> _queueAiAction({
    required String actionKind,
    required String entityType,
    required String idempotencyKey,
    required Map<String, Object?> payload,
    String? entityId,
    Map<String, Object?>? jobProjection,
  }) async {
    _assertSecretFreeJson(payload);
    final existing = await database.customSelect(
      'SELECT operation_id FROM ai_mobile_outbox_actions '
      'WHERE owner_id = ? AND workspace_id = ? AND idempotency_key = ?',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
        Variable.withString(idempotencyKey),
      ],
    ).getSingleOrNull();
    if (existing != null) return existing.read<String>('operation_id');

    final operationId = generateSyncId();
    final targetEntityId = entityId ?? generateSyncId();
    final now = _clock().toUtc();
    final nowText = now.toIso8601String();
    final payloadJson = jsonEncode({
      ...payload,
      'ownerId': _ownerId,
      'deviceId': _deviceId,
      'idempotencyKey': idempotencyKey,
    });

    await database.transaction(() async {
      final deviceSequence = await _nextDeviceSequence();
      await database.customStatement(
        'INSERT INTO ai_mobile_outbox_actions '
        '(idempotency_key, operation_id, owner_id, workspace_id, action_kind, '
        'entity_id, payload_json, local_state, created_at, updated_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          idempotencyKey,
          operationId,
          _ownerId,
          workspaceId,
          actionKind,
          targetEntityId,
          payloadJson,
          _mobileAiOutboxPending,
          nowText,
          nowText,
        ],
      );
      await database.customStatement(
        'INSERT INTO outbox_operations '
        '(operation_id, owner_id, device_id, device_sequence, entity_type, '
        'entity_id, kind, payload_json, occurred_at, next_attempt_at, created_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          operationId,
          _ownerId,
          _deviceId,
          deviceSequence,
          entityType,
          targetEntityId,
          actionKind,
          payloadJson,
          now,
          now,
          now,
        ],
      );
      if (jobProjection != null) {
        final jobType = jobProjection['jobType'] as String;
        await database.customStatement(
          'INSERT INTO ai_mobile_job_projections '
          '(id, owner_id, workspace_id, job_type, status, idempotency_key, '
          'requested_by_device_id, provider_json, cost_micros, created_at, updated_at) '
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) '
          'ON CONFLICT(owner_id, workspace_id, idempotency_key) DO NOTHING',
          [
            targetEntityId,
            _ownerId,
            workspaceId,
            jobType,
            AiMobileJobStatus.queued.wireName,
            idempotencyKey,
            _deviceId,
            '{}',
            '0',
            nowText,
            nowText,
          ],
        );
      }
    });
    return operationId;
  }

  Future<void> markOutboxAccepted(
    String operationId, {
    String? conflictId,
  }) async {
    final nowText = _clock().toUtc().toIso8601String();
    await database.customStatement(
      'UPDATE ai_mobile_outbox_actions SET local_state = ?, transmitted_at = ?, '
      'accepted_at = ?, conflict_id = ?, updated_at = ? '
      'WHERE operation_id = ? AND owner_id = ?',
      [
        conflictId == null ? _mobileAiOutboxAccepted : _mobileAiOutboxConflict,
        nowText,
        nowText,
        conflictId,
        nowText,
        operationId,
        _ownerId,
      ],
    );
  }

  Future<void> markOutboxRejected(
    String operationId, {
    required String reason,
  }) async {
    final nowText = _clock().toUtc().toIso8601String();
    await database.customStatement(
      'UPDATE ai_mobile_outbox_actions SET local_state = ?, rejected_at = ?, '
      'conflict_id = ?, updated_at = ? WHERE operation_id = ? AND owner_id = ?',
      [
        _mobileAiOutboxRejected,
        nowText,
        reason,
        nowText,
        operationId,
        _ownerId,
      ],
    );
  }

  Future<void> applyRemoteEnvelope(Map<String, dynamic> envelope) async {
    final schemaVersion = _readSchemaVersion(envelope);
    final compatibilityError = aiMobileCompatibilityError(schemaVersion);
    if (compatibilityError != null) {
      throw MobileAICompatibilityException(
        compatibilityError,
        'AI mobile schema version is not supported by this app.',
      );
    }
    _requireOwner(envelope['ownerId'] as String? ?? _ownerId);
    final envelopeWorkspaceId =
        envelope['workspaceId'] as String? ?? workspaceId;
    if (envelopeWorkspaceId != workspaceId) {
      throw const MobileAICompatibilityException(
        'PERMISSION',
        'AI payload belongs to a different workspace.',
      );
    }
    final payload = (envelope['payload'] as Map<String, dynamic>? ?? envelope);
    _assertSecretFreeJson(payload);
    final kind = (envelope['kind'] ?? payload['kind']) as String?;
    if (kind == null) return;

    switch (kind) {
      case 'ai.analysis.result':
        await _applyAnalysisResult(payload);
        break;
      case 'ai.job.projection':
        await _applyJobProjection(payload);
        break;
      case 'ai.usage.summary':
        await _applyUsageSummary(payload);
        break;
      case 'ai.settings.snapshot':
        await _applySettings(payload);
        break;
      case 'ai.memory.cache':
      case 'ai.search.cache':
      case 'ai.fact.snapshot':
      case 'ai.graph.snapshot':
      case 'ai.qa.history':
        await _applyMemoryCache(kind, payload);
        break;
      case 'ai.playground.session':
      case 'ai.playground.message':
      case 'ai.playground.run':
      case 'ai.playground.evaluation':
      case 'ai.playground.dataset':
      case 'ai.playground.import':
      case 'ai.playground.export':
        await _applyPlaygroundProjection(kind, payload);
        break;
      case 'ai.tombstone':
      case 'ai.record.deleted':
        await _applyTombstone(payload);
        break;
    }
  }

  Future<MobileAIAnalysisResult?> currentAnalysisResult({
    required String level,
    required String periodKey,
  }) async {
    final row = await database.customSelect(
      'SELECT * FROM ai_mobile_analysis_results '
      'WHERE owner_id = ? AND workspace_id = ? AND level = ? '
      'AND period_key = ? AND deleted_at IS NULL '
      'ORDER BY result_version DESC LIMIT 1',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
        Variable.withString(level),
        Variable.withString(periodKey),
      ],
    ).getSingleOrNull();
    if (row == null) return null;
    return MobileAIAnalysisResult(
      id: row.read<String>('id'),
      level: row.read<String>('level'),
      periodKey: row.read<String>('period_key'),
      resultVersion: row.read<int>('result_version'),
      status: row.read<String>('status'),
      summary: row.read<String>('summary'),
      costMicros: row.read<String>('cost_micros'),
      staleState: row.read<String>('stale_state'),
    );
  }

  Future<Map<String, int>> safeCounts() async {
    final results = await _count('ai_mobile_analysis_results');
    final jobs = await _count('ai_mobile_job_projections');
    final pending = await database.customSelect(
      "SELECT COUNT(*) AS count FROM ai_mobile_outbox_actions "
      "WHERE owner_id = ? AND workspace_id = ? AND local_state = 'pending'",
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
      ],
    ).getSingle();
    return {
      'results': results,
      'jobs': jobs,
      'pendingOutboxActions': pending.read<int>('count'),
    };
  }

  Future<MobileAIPolicySnapshot> policySnapshot() async {
    final values = await _aiSettingsValues();
    final providerProfiles = values['providerProfiles'] is List
        ? (values['providerProfiles'] as List)
            .whereType<Map>()
            .map((item) => _providerProfileFromJson(
                  item.map((key, value) => MapEntry(key.toString(), value)),
                ))
            .toList()
        : const <MobileAIProviderProfile>[];
    final switches = values['killSwitches'] is Map<String, dynamic>
        ? (values['killSwitches'] as Map<String, dynamic>).map(
            (key, value) => MapEntry(key, value == true),
          )
        : <String, bool>{};
    for (final switchName in _supportedKillSwitches) {
      switches.putIfAbsent(switchName, () => false);
    }
    final consent = values['cloudConsentEvidence'] is Map<String, dynamic>
        ? values['cloudConsentEvidence'] as Map<String, dynamic>
        : <String, dynamic>{};
    final purposes = consent['purposes'] is List
        ? (consent['purposes'] as List).map((value) => value.toString()).toList()
        : const <String>[];
    final pending = await database.customSelect(
      "SELECT COUNT(*) AS count FROM ai_mobile_outbox_actions WHERE owner_id = ? "
      "AND workspace_id = ? AND local_state = 'pending'",
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
      ],
    ).getSingle();
    return MobileAIPolicySnapshot(
      privacyMode: values['privacyMode'] as String? ?? 'LOCAL',
      cloudConsentActive: values['cloudConsentActive'] == true,
      cloudExecutionDisabled: values['cloudExecutionDisabled'] == true,
      pendingOperationCount: pending.read<int>('count'),
      consentPurposes: purposes,
      consentEvidence: consent,
      providerProfiles: providerProfiles,
      killSwitches: switches,
      budget: _budgetFromSettings(values),
      mobileCredentialMode:
          values['mobileCredentialMode'] as String? ?? 'desktop_owned_no_mobile_secrets',
    );
  }

  Future<MobileMemoryStatus> memoryStatus() async {
    final values = await _aiSettingsValues();
    final memory = values['memory'] is Map<String, dynamic>
        ? values['memory'] as Map<String, dynamic>
        : <String, dynamic>{};
    return MobileMemoryStatus(
      activeNamespace: memory['activeNamespace'] as String? ?? 'not synchronized',
      coverage: memory['coverage'] as String? ?? 'unknown',
      pendingJobs: int.tryParse((memory['pendingJobs'] ?? '0').toString()) ?? 0,
      failedJobs: int.tryParse((memory['failedJobs'] ?? '0').toString()) ?? 0,
      staleCount: int.tryParse((memory['staleCount'] ?? '0').toString()) ?? 0,
      provider: memory['provider'] as String? ?? 'not synchronized',
      model: memory['model'] as String? ?? 'not synchronized',
      storageBytes:
          int.tryParse((memory['storageBytes'] ?? '0').toString()) ?? 0,
      paused: memory['paused'] == true,
    );
  }

  Future<List<MobileMemorySearchResult>> searchMemory({
    required String query,
    String mode = 'hybrid',
    String? sourceType,
    String? category,
    String? project,
    String? dateFrom,
    String? dateTo,
    int limit = 20,
    double relevanceThreshold = 0,
  }) async {
    final rows = await _memoryRows(kind: 'ai.search.cache', limit: 200);
    final normalizedQuery = query.trim().toLowerCase();
    final results = <MobileMemorySearchResult>[];
    for (final row in rows) {
      final payload = _readJsonObject(row.read<String>('payload_json'));
      if (!_memoryPayloadVisible(payload)) continue;
      final result = _searchResultFromRow(row, payload);
      if (result.score < relevanceThreshold) continue;
      if (mode != 'all' && result.mode != mode && result.mode != 'hybrid') {
        continue;
      }
      if (sourceType != null && sourceType.isNotEmpty && result.sourceType != sourceType) {
        continue;
      }
      if (category != null && category.isNotEmpty && result.metadata['category'] != category) {
        continue;
      }
      if (project != null && project.isNotEmpty && result.metadata['project'] != project) {
        continue;
      }
      if (dateFrom != null && dateFrom.isNotEmpty && result.timestamp.compareTo(dateFrom) < 0) {
        continue;
      }
      if (dateTo != null && dateTo.isNotEmpty && result.timestamp.compareTo(dateTo) > 0) {
        continue;
      }
      if (normalizedQuery.isNotEmpty &&
          !result.excerpt.toLowerCase().contains(normalizedQuery) &&
          !result.sourceId.toLowerCase().contains(normalizedQuery)) {
        continue;
      }
      results.add(result);
    }
    results.sort((a, b) => b.score.compareTo(a.score));
    return results.take(limit).toList();
  }

  Future<List<MobileMemoryFact>> listFacts({
    String query = '',
    String status = 'active',
    int limit = 50,
  }) async {
    final rows = await _memoryRows(kind: 'ai.fact.snapshot', limit: 200);
    final normalized = query.trim().toLowerCase();
    final facts = <MobileMemoryFact>[];
    for (final row in rows) {
      final payload = _readJsonObject(row.read<String>('payload_json'));
      if (!_memoryPayloadVisible(payload)) continue;
      final evidence = _evidenceList(payload['evidence']);
      if (evidence.isEmpty) continue;
      final fact = _factFromRow(row, payload, evidence);
      if (status != 'all' && fact.status != status) continue;
      if (normalized.isNotEmpty &&
          !('${fact.subject} ${fact.predicate} ${fact.value}'
              .toLowerCase()
              .contains(normalized))) {
        continue;
      }
      facts.add(fact);
    }
    return facts.take(limit).toList();
  }

  Future<List<MobileGraphNode>> listGraphNodes({
    String query = '',
    int limit = 50,
  }) async {
    final rows = await _memoryRows(kind: 'ai.graph.snapshot', limit: 200);
    final normalized = query.trim().toLowerCase();
    final nodes = <MobileGraphNode>[];
    for (final row in rows) {
      final payload = _readJsonObject(row.read<String>('payload_json'));
      if (!_memoryPayloadVisible(payload)) continue;
      if ((payload['recordKind'] ?? 'node') != 'node') continue;
      final label = payload['label'] as String? ?? payload['sourceId'] as String? ?? '';
      if (normalized.isNotEmpty && !label.toLowerCase().contains(normalized)) {
        continue;
      }
      nodes.add(_graphNodeFromRow(row, payload));
    }
    return nodes.take(limit).toList();
  }

  Future<List<MobileMemoryAnswer>> listMemoryAnswers({int limit = 20}) async {
    final rows = await _memoryRows(kind: 'ai.qa.history', limit: limit);
    final answers = <MobileMemoryAnswer>[];
    for (final row in rows) {
      final payload = _readJsonObject(row.read<String>('payload_json'));
      if (!_memoryPayloadVisible(payload)) continue;
      answers.add(_answerFromRow(row, payload));
    }
    return answers;
  }

  MobileAIPlaygroundDecision playgroundDecision() =>
      const MobileAIPlaygroundDecision(
        scope: 'desktop_only_power_user_tool',
        mobileExecutionSupported: false,
        readOnlySharedSessions: true,
        reason:
            'Playground execution, prompt editing, comparison, and evaluation remain desktop-only so Android cannot bypass provider policy, budgets, isolation, or prompt safety.',
        unsupportedActions: [
          'new_session',
          'edit_prompt',
          'run_prompt',
          'stream_response',
          'retry_with_model',
          'model_comparison',
          'dataset_mutation',
          'production_prompt_promotion',
        ],
      );

  Future<List<MobileAIPlaygroundSession>> listPlaygroundSessions({
    int limit = 30,
  }) async {
    final rows = await _playgroundRows(kind: 'ai.playground.session', limit: limit);
    return rows
        .map((row) => _playgroundSessionFromRow(
              row,
              _readJsonObject(row.read<String>('payload_json')),
            ))
        .toList();
  }

  Future<List<MobileAIPlaygroundRun>> listPlaygroundRuns(
    String sessionId, {
    int limit = 30,
  }) async {
    final rows = await _playgroundRows(
      kind: 'ai.playground.run',
      parentId: sessionId,
      limit: limit,
    );
    return rows
        .map((row) => _playgroundRunFromRow(
              row,
              _readJsonObject(row.read<String>('payload_json')),
            ))
        .toList();
  }

  Future<List<MobileAIPlaygroundEvaluation>> listPlaygroundEvaluations({
    int limit = 30,
  }) async {
    final rows =
        await _playgroundRows(kind: 'ai.playground.evaluation', limit: limit);
    return rows
        .map((row) => _playgroundEvaluationFromRow(
              row,
              _readJsonObject(row.read<String>('payload_json')),
            ))
        .toList();
  }

  Future<String> queuePlaygroundExecutionSwitch(bool enabled) =>
      queueKillSwitchUpdate(switchName: 'playground', enabled: enabled);

  Future<String> queuePlaygroundProjectionDeletion(String playgroundId) =>
      _queueAiAction(
        actionKind: 'ai.playground.delete',
        entityType: 'ai_playground',
        idempotencyKey: 'ai:$workspaceId:playground_delete:$playgroundId',
        entityId: playgroundId,
        payload: {
          'schemaVersion': aiMobileContractVersion,
          'workspaceId': workspaceId,
          'playgroundId': playgroundId,
          'deleteScope': 'playground_only',
          'deleteProductionData': false,
        },
      );

  MobileAIArtifactValidation validatePlaygroundImport(
    Map<String, Object?> artifact, {
    int maxBytes = 262144,
  }) {
    try {
      _assertSecretFreeJson(artifact);
    } on MobileAISecurityException {
      return const MobileAIArtifactValidation(
        accepted: false,
        reason: 'credential_or_secret_field',
        warnings: [],
      );
    }
    final warnings = <String>[];
    final encoded = jsonEncode(artifact);
    if (encoded.length > maxBytes) {
      return const MobileAIArtifactValidation(
        accepted: false,
        reason: 'oversized_artifact',
        warnings: [],
      );
    }
    final schema = artifact['schemaVersion']?.toString();
    if (schema != 'focuslog.playground.exchange.v1' &&
        schema != aiMobileContractVersion.toString()) {
      return const MobileAIArtifactValidation(
        accepted: false,
        reason: 'unsupported_schema',
        warnings: [],
      );
    }
    final artifactType = artifact['artifactType']?.toString() ?? '';
    if (!const {
      'session',
      'prompt_template',
      'evaluation_dataset',
      'retrieval_config',
      'structured_schema',
      'diagnostic_bundle',
    }.contains(artifactType)) {
      return const MobileAIArtifactValidation(
        accepted: false,
        reason: 'unsupported_artifact_type',
        warnings: [],
      );
    }
    final name = artifact['name']?.toString() ?? artifactType;
    if (name.contains('..') ||
        name.contains('/') ||
        name.contains('\\') ||
        RegExp(r'\.(exe|bat|cmd|ps1|sh|js|mjs)$', caseSensitive: false)
            .hasMatch(name)) {
      return const MobileAIArtifactValidation(
        accepted: false,
        reason: 'unsafe_name_or_path',
        warnings: [],
      );
    }
    final cases = artifact['cases'];
    if (cases is List) {
      final ids = <String>{};
      for (final item in cases.whereType<Map>()) {
        final id = item['id']?.toString() ?? '';
        if (id.isNotEmpty && !ids.add(id)) {
          return const MobileAIArtifactValidation(
            accepted: false,
            reason: 'duplicate_case_id',
            warnings: [],
          );
        }
      }
    }
    if (encoded.contains('ignore previous instructions') ||
        encoded.contains('BEGIN PRIVATE KEY')) {
      warnings.add('embedded_instructions_treated_as_untrusted_data');
    }
    return MobileAIArtifactValidation(
      accepted: true,
      reason: 'accepted_for_authoritative_review',
      warnings: warnings,
    );
  }

  Future<Map<String, Object?>> safePlaygroundExportPreview({
    bool includeSessions = true,
    bool includePromptTemplates = false,
    bool includeEvaluations = false,
    bool includeDiagnostics = false,
  }) async {
    final sessionCount = includeSessions
        ? await _countPlaygroundKind('ai.playground.session')
        : 0;
    final evaluationCount = includeEvaluations
        ? await _countPlaygroundKind('ai.playground.evaluation')
        : 0;
    final diagnostics = includeDiagnostics ? await mobileDiagnosticsBundle() : null;
    return {
      'schemaVersion': aiMobileContractVersion,
      'format': 'focuslog.mobile.playground.preview.v1',
      'includeSessions': includeSessions,
      'includePromptTemplates': includePromptTemplates,
      'includeEvaluations': includeEvaluations,
      'includeDiagnostics': includeDiagnostics,
      'sessionCount': sessionCount,
      'evaluationCount': evaluationCount,
      if (diagnostics != null) 'diagnostics': diagnostics,
      'excludeCredentials': true,
      'excludeRawPrompts': true,
      'excludeRawProviderResponses': true,
      'excludeProductionDataByDefault': true,
    };
  }

  Future<Map<String, Object?>> mobileDiagnosticsBundle({
    bool includePrivateContent = false,
  }) async {
    final counts = await safeCounts();
    final lifecycle = await lifecycleSnapshot();
    final policy = await policySnapshot();
    final resources = await mobileResourcePolicy();
    final usage = await _count('ai_mobile_usage_summaries');
    final cursors = await _countInboxCursors();
    return {
      'schemaVersion': aiMobileContractVersion,
      'mobileSchemaVersion': 8,
      'workspaceId': workspaceId,
      'pendingOutboxActions': counts['pendingOutboxActions'] ?? 0,
      'resultCount': counts['results'] ?? 0,
      'jobCount': counts['jobs'] ?? 0,
      'usageSummaryCount': usage,
      'syncCursorCount': cursors,
      'executorAvailability': lifecycle.executorAvailability,
      'executionOwner': lifecycle.executionOwner,
      'resourceLimitReached': resources.limitReached,
      'resourceRecovery': resources.recovery,
      'playgroundDecision': playgroundDecision().scope,
      'playgroundSwitchEnabled':
          policy.killSwitches['playground'] == true,
      'includePrivateContent': false,
      'privateContentRequest':
          includePrivateContent ? 'requires_explicit_desktop_export' : 'none',
      'excludesCredentials': true,
      'excludesRawPrompts': true,
      'excludesRawProviderResponses': true,
    };
  }

  Future<MobileAISecurityReview> mobileSecurityReview() async {
    final lifecycle = await lifecycleSnapshot();
    final policy = await policySnapshot();
    final resources = await mobileResourcePolicy();
    final findings = <String>[
      if (lifecycle.executorAvailability != 'available')
        'desktop_executor_unavailable',
      if (policy.cloudExecutionDisabled) 'cloud_execution_disabled',
      if (resources.limitReached) 'resource_limit_recovery_visible',
    ];
    return MobileAISecurityReview(
      credentialStorage: policy.mobileCredentialMode,
      cloudTransport:
          'https_required_with_documented_localhost_exception_only',
      deepLinks:
          'owner_workspace_target_allowlist_validated_without_lease_tokens',
      notifications:
          'safe_target_references_only_no_private_prompt_or_provider_response',
      exports:
          'credentials_authorization_deleted_content_and_raw_private_content_excluded_by_default',
      imports:
          'schema_size_path_duplicate_secret_and_embedded_instruction_validation',
      promptInjectionBoundary:
          'source_content_is_untrusted_and_cannot_change_privacy_provider_deletion_or_authorization',
      platformConfiguration:
          'android_allowBackup_false_usesCleartextTraffic_false_exported_components_minimized',
      screenshotAndClipboardPolicy:
          'no_ai_clipboard_copy_or_screenshot_export_path_is_exposed_by_mobile_ai_surfaces',
      safeDiagnostics:
          'bounded_normalized_secret_free_diagnostics_without_raw_content',
      findings: findings,
    );
  }

  Future<MobileAIResourcePolicy> mobileResourcePolicy() async {
    final cached = await _count('ai_mobile_memory_cache');
    final outbox = await _count('ai_mobile_outbox_actions');
    final diagnostics = await _count('ai_mobile_lifecycle_diagnostics');
    final limitReached = cached >= _mobileMaxCachedRecords ||
        outbox >= _mobileMaxOutboxActions ||
        diagnostics >= 200;
    return MobileAIResourcePolicy(
      maxCachedRecords: _mobileMaxCachedRecords,
      maxResponseBytes: _mobileMaxResponseBytes,
      maxImportBytes: _mobileMaxImportBytes,
      maxContextPreviewBytes: _mobileMaxContextPreviewBytes,
      maxStreamingBufferBytes: _mobileMaxStreamingBufferBytes,
      maxBackgroundRetries: _mobileMaxBackgroundRetries,
      maxOutboxActions: _mobileMaxOutboxActions,
      maxDiagnosticExportBytes: _mobileMaxDiagnosticExportBytes,
      currentCachedRecords: cached,
      currentOutboxActions: outbox,
      currentDiagnosticRows: diagnostics,
      limitReached: limitReached,
      recovery: limitReached
          ? 'Pause new mobile AI actions, synchronize with the paired desktop, then retry.'
          : 'Within mobile AI resource limits.',
    );
  }

  Future<MobileAIPerformanceSnapshot> mobilePerformanceSnapshot({
    String fixture = 'synthetic_mobile_ai_mh_v1',
  }) async {
    final analysisRows = await _count('ai_mobile_analysis_results');
    final memoryRows = await _count('ai_mobile_memory_cache');
    final pendingRows = await _countAiOutboxStates({_mobileAiOutboxPending});
    final playgroundRows = await _count('ai_mobile_playground_projections');
    final factRows = await _countMemoryKind('ai.fact.snapshot');
    final graphRows = await _countMemoryKind('ai.graph.snapshot');
    return MobileAIPerformanceSnapshot(
      fixture: fixture,
      syntheticDataOnly: true,
      analysisRows: analysisRows,
      memoryRows: memoryRows,
      factRows: factRows,
      graphRows: graphRows,
      pendingJobRows: pendingRows,
      playgroundRows: playgroundRows,
      startupBudgetMs: 1500,
      navigationBudgetMs: 300,
      searchRenderBudgetMs: 500,
      syncApplyBudgetMs: 1000,
      exportBudgetMs: 1500,
      deletionCleanupBudgetMs: 1000,
      uiThreadPolicy:
          'queries_are_bounded_and_lists_are_paginated_with_refreshable_safe_projections',
      backgroundPolicy:
          'mobile_sync_applies_remote_projections_and_never_runs_provider_or_embedding_work',
    );
  }

  MobileAIPackagingReadiness mobilePackagingReadiness() =>
      const MobileAIPackagingReadiness(
        androidTarget: 'present_flutter_android',
        iosTarget: 'not_applicable_platform_absent',
        nativeDependencies: [
          'flutter_secure_storage',
          'sqlcipher_flutter_libs',
          'sqlite3',
          'workmanager',
          'flutter_local_notifications',
        ],
        permissions: [
          'INTERNET',
          'POST_NOTIFICATIONS',
          'RECEIVE_BOOT_COMPLETED',
          'SCHEDULE_EXACT_ALARM',
          'FOREGROUND_SERVICE_SPECIAL_USE',
        ],
        releaseExclusions: [
          'test_credentials',
          'raw_fixtures',
          'debug_logs',
          'temporary_exports',
          'unnecessary_source_maps',
        ],
        upgradeCompatibility:
            'current_mobile_schema_version_8_initializes_without_destructive_repeat_migrations',
        installSmokePreparedFor:
            'M-I clean_install_upgrade_uninstall_reinstall_packaged_launch',
      );

  Future<MobileAIReleaseGateSnapshot> mobileReleaseGateSnapshot() async {
    final security = await mobileSecurityReview();
    final resources = await mobileResourcePolicy();
    final performance = await mobilePerformanceSnapshot();
    return MobileAIReleaseGateSnapshot(
      platform: 'android',
      schemaVersion: 8,
      supported: true,
      androidVerification:
          'requires_flutter_analyze_test_build_release_install_launch_upgrade_smoke',
      iosVerification: 'not_applicable_platform_absent',
      blockingGate: 'flutter_toolchain_unavailable_in_current_environment',
      acceptanceStatus:
          'implemented_source_contracts_verified_android_runtime_gates_blocked',
      releaseArtifact: 'not_built_in_current_environment',
      installSmoke: 'not_executed_flutter_and_android_sdk_required',
      upgradeSmoke: 'not_executed_flutter_and_android_sdk_required',
      securityReview: security,
      resourcePolicy: resources,
      performanceSnapshot: performance,
      knownLimitations: const [
        'Android release artifact must be built and launched before certification.',
        'Flutter unit/widget/integration tests must pass before Android rows can close.',
        'iOS is not applicable because no iOS target exists in this repository.',
      ],
    );
  }

  Future<Map<String, Object?>> safeExportPreview({
    required bool includeAnalyses,
    required bool includeDerivedMemory,
    required bool includePlayground,
  }) async {
    final counts = await safeCounts();
    final policy = await policySnapshot();
    final preview = <String, Object?>{
      'schemaVersion': aiMobileContractVersion,
      'ownerId': _ownerId,
      'workspaceId': workspaceId,
      'includeAnalyses': includeAnalyses,
      'includeDerivedMemory': includeDerivedMemory,
      'includePlayground': includePlayground,
      'analysisResultCount': includeAnalyses ? counts['results'] : 0,
      'jobProjectionCount': counts['jobs'],
      'derivedMemoryIncluded': includeDerivedMemory,
      'playgroundIncluded': includePlayground,
      'credentialIncluded': false,
      'authorizationIncluded': false,
      'deletedContentIncluded': false,
      'privacyMode': policy.privacyMode,
    };
    _assertSecretFreeJson(preview);
    return preview;
  }

  Future<List<String>> eligiblePeriods(String level, {int limit = 12}) async {
    if (!_analysisLevels.contains(level)) {
      throw ArgumentError.value(level, 'level', 'Unsupported analysis level.');
    }
    final now = _clock().toUtc();
    return List<String>.generate(limit, (index) {
      final date = DateTime.utc(now.year, now.month, now.day)
          .subtract(Duration(days: index));
      switch (level) {
        case 'weekly':
          final weekStart = date.subtract(Duration(days: date.weekday - 1));
          return '${weekStart.year.toString().padLeft(4, '0')}-W${_weekNumber(weekStart).toString().padLeft(2, '0')}';
        case 'monthly':
          final month = DateTime.utc(now.year, now.month - index, 1);
          return '${month.year.toString().padLeft(4, '0')}-${month.month.toString().padLeft(2, '0')}';
        case 'quarterly':
          final quarterIndex = (now.month - 1) ~/ 3 - index;
          final year = now.year + quarterIndex ~/ 4;
          final quarter = quarterIndex % 4 + 1;
          return '${year.toString().padLeft(4, '0')}-Q$quarter';
        case 'yearly':
          return (now.year - index).toString();
        case 'daily':
        default:
          return '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
      }
    });
  }

  Future<List<MobileAIAnalysisListItem>> listAnalysisResults(
    String level, {
    int limit = 50,
  }) async {
    final rows = await database.customSelect(
      'SELECT * FROM ai_mobile_analysis_results '
      'WHERE owner_id = ? AND workspace_id = ? AND level = ? '
      'AND deleted_at IS NULL ORDER BY period_key DESC, result_version DESC '
      'LIMIT ?',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
        Variable.withString(level),
        Variable.withInt(limit),
      ],
    ).get();
    return rows.map(_analysisListItemFromRow).toList();
  }

  Future<MobileAIAnalysisDetail?> analysisDetail(String resultId) async {
    final row = await database.customSelect(
      'SELECT * FROM ai_mobile_analysis_results '
      'WHERE owner_id = ? AND workspace_id = ? AND id = ? AND deleted_at IS NULL',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
        Variable.withString(resultId),
      ],
    ).getSingleOrNull();
    if (row == null) return null;
    return MobileAIAnalysisDetail(
      item: _analysisListItemFromRow(row),
      structured: _readJsonObject(row.read<String>('structured_json')),
      provider: _readJsonObject(row.read<String>('provider_json')),
      fallback: _readJsonObject(row.read<String>('fallback_json')),
      provenance: _readJsonObject(row.read<String>('provenance_json')),
      usage: _readJsonObject(row.read<String>('usage_json')),
    );
  }

  Future<List<MobileAIJobListItem>> listJobs({int limit = 30}) async {
    final rows = await database.customSelect(
      'SELECT * FROM ai_mobile_job_projections WHERE owner_id = ? '
      'AND workspace_id = ? ORDER BY updated_at DESC LIMIT ?',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
        Variable.withInt(limit),
      ],
    ).get();
    return rows
        .map(
          (row) => MobileAIJobListItem(
            id: row.read<String>('id'),
            jobType: row.read<String>('job_type'),
            status: row.read<String>('status'),
            idempotencyKey: row.read<String>('idempotency_key'),
            costMicros: row.read<String>('cost_micros'),
            provider: _readJsonObject(row.read<String>('provider_json')),
            error: row.readNullable<String>('error_json') == null
                ? null
                : _readJsonObject(row.read<String>('error_json')),
            resultId: row.readNullable<String>('result_id'),
            updatedAt: _readDate(row.read<Object>('updated_at')),
          ),
        )
        .toList();
  }

  Future<MobileAIScheduleSettings> scheduleSettings(String level) async {
    final all = await _aiSettingsValues();
    final schedules = all['schedules'] is Map<String, dynamic>
        ? all['schedules'] as Map<String, dynamic>
        : <String, dynamic>{};
    final value = schedules[level] is Map<String, dynamic>
        ? schedules[level] as Map<String, dynamic>
        : <String, dynamic>{};
    final maxCostMicros = (value['maxCostMicros'] ?? '0').toString();
    if (!isAiMobileMicroUnitAmount(maxCostMicros)) {
      throw const MobileAICompatibilityException(
        'VALIDATION',
        'AI schedule cost cap must be an integer micro-unit string.',
      );
    }
    return MobileAIScheduleSettings(
      level: level,
      enabled: value['enabled'] == true,
      localTime: value['localTime'] as String? ?? '20:00',
      timezone: value['timezone'] as String? ?? 'UTC',
      providerProfileId: value['providerProfileId'] as String? ?? 'automatic',
      model: value['model'] as String? ?? 'automatic',
      fallbackChainId: value['fallbackChainId'] as String? ?? 'automatic',
      privacyMode: value['privacyMode'] as String? ?? 'LOCAL',
      maxCostMicros: maxCostMicros,
      killSwitch: value['killSwitch'] == true,
      nextExpectedRun: value['nextExpectedRun'] as String?,
      lastSuccessfulRun: value['lastSuccessfulRun'] as String?,
      blockedReason: value['blockedReason'] as String?,
    );
  }

  Future<String> saveScheduleSettings(MobileAIScheduleSettings settings) async {
    if (!_analysisLevels.contains(settings.level)) {
      throw ArgumentError.value(
        settings.level,
        'level',
        'Unsupported analysis level.',
      );
    }
    _requireMicroUnits(settings.maxCostMicros);
    final all = await _aiSettingsValues();
    final schedules = all['schedules'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(all['schedules'] as Map<String, dynamic>)
        : <String, dynamic>{};
    schedules[settings.level] = settings.toJson();
    all['schedules'] = schedules;
    await _applySettings({
      'values': all,
      'updatedAt': _clock().toUtc().toIso8601String(),
    });
    return queueSettingsUpdate(all);
  }

  Future<MobileAIExecutorStatus> executorStatus() async {
    final values = await _aiSettingsValues();
    final executor = values['executor'] is Map<String, dynamic>
        ? values['executor'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final availability =
        executor['availability'] as String? ?? 'executor_unavailable';
    final lastSeenAt = executor['lastSeenAt'] as String?;
    return MobileAIExecutorStatus(
      executionOwner: 'desktop_owned_execution',
      availability: availability,
      lastSeenAt: lastSeenAt,
      message: availability == 'available'
          ? 'Desktop executor is available.'
          : 'Waiting for the paired desktop executor to synchronize AI work.',
    );
  }

  Future<List<Map<String, dynamic>>> provenanceForResult(String resultId) async {
    final detail = await analysisDetail(resultId);
    if (detail == null) return const [];
    final evidence = detail.provenance['evidence'];
    if (evidence is List) {
      return evidence.whereType<Map>().map((item) {
        return item.map((key, value) => MapEntry(key.toString(), value));
      }).toList();
    }
    return const [];
  }

  Future<void> assertSecretFreeLocalAiProjection() async {
    for (final table in const [
      'ai_mobile_analysis_results',
      'ai_mobile_job_projections',
      'ai_mobile_usage_summaries',
      'ai_mobile_settings',
      'ai_mobile_memory_cache',
      'ai_mobile_outbox_actions',
      'ai_mobile_tombstones',
      'ai_mobile_lifecycle_diagnostics',
      'ai_mobile_notification_events',
      'ai_mobile_playground_projections',
      'ai_mobile_diagnostic_exports',
    ]) {
      final rows = await database.customSelect(
        'SELECT * FROM $table WHERE owner_id = ?',
        variables: [Variable.withString(_ownerId)],
      ).get();
      for (final row in rows) {
        _assertSecretFreeJson(row.data);
      }
    }
  }

  Future<Map<String, dynamic>> _aiSettingsValues() async {
    final row = await database.customSelect(
      'SELECT values_json FROM ai_mobile_settings '
      'WHERE owner_id = ? AND workspace_id = ?',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
      ],
    ).getSingleOrNull();
    if (row == null) return <String, dynamic>{};
    return _readJsonObject(row.read<String>('values_json'));
  }

  Future<int> _nextDeviceSequence() async {
    final row = await database.customSelect(
      'SELECT COALESCE(MAX(device_sequence), 0) + 1 AS next_sequence '
      'FROM outbox_operations WHERE owner_id = ? AND device_id = ?',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(_deviceId),
      ],
    ).getSingle();
    return row.read<int>('next_sequence');
  }

  Future<int> _count(String table) async {
    final row = await database.customSelect(
      'SELECT COUNT(*) AS count FROM $table WHERE owner_id = ? AND workspace_id = ?',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
      ],
    ).getSingle();
    return row.read<int>('count');
  }

  Future<int> _countMemoryKind(String kind) async {
    final row = await database.customSelect(
      'SELECT COUNT(*) AS count FROM ai_mobile_memory_cache '
      'WHERE owner_id = ? AND workspace_id = ? AND kind = ? '
      'AND deleted_at IS NULL',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
        Variable.withString(kind),
      ],
    ).getSingle();
    return row.read<int>('count');
  }

  Future<int> _countAiOutboxStates(Set<String> states) async {
    if (states.isEmpty) return 0;
    final placeholders = List.filled(states.length, '?').join(', ');
    final row = await database.customSelect(
      'SELECT COUNT(*) AS count FROM ai_mobile_outbox_actions '
      'WHERE owner_id = ? AND workspace_id = ? '
      'AND local_state IN ($placeholders)',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
        ...states.map(Variable.withString),
      ],
    ).getSingle();
    return row.read<int>('count');
  }

  Future<int> _countJobsWithStatuses(Set<String> statuses) async {
    if (statuses.isEmpty) return 0;
    final placeholders = List.filled(statuses.length, '?').join(', ');
    final row = await database.customSelect(
      'SELECT COUNT(*) AS count FROM ai_mobile_job_projections '
      'WHERE owner_id = ? AND workspace_id = ? '
      'AND status IN ($placeholders)',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
        ...statuses.map(Variable.withString),
      ],
    ).getSingle();
    return row.read<int>('count');
  }

  Future<int> _countAiActions(String actionKind) async {
    final row = await database.customSelect(
      'SELECT COUNT(*) AS count FROM ai_mobile_outbox_actions '
      'WHERE owner_id = ? AND workspace_id = ? AND action_kind = ? '
      'AND local_state IN (?, ?)',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
        Variable.withString(actionKind),
        Variable.withString(_mobileAiOutboxPending),
        Variable.withString(_mobileAiOutboxAccepted),
      ],
    ).getSingle();
    return row.read<int>('count');
  }

  Future<void> _refreshNotificationIntents() async {
    final nowText = _clock().toUtc().toIso8601String();
    final executor = await executorStatus();
    if (executor.availability != 'available') {
      await _storeNotificationIntent(
        kind: 'executor_unavailable',
        targetKind: 'ai_executor',
        targetId: 'desktop',
        title: 'AI executor unavailable',
        body: 'AI work is queued until the paired desktop executor returns.',
        payload: {
          'targetKind': 'ai_executor',
          'targetId': 'desktop',
          'ownerId': _ownerId,
          'workspaceId': workspaceId,
        },
        createdAt: nowText,
      );
    }

    final jobs = await listJobs(limit: 30);
    for (final job in jobs) {
      if (const {'succeeded', 'failed', 'dead_lettered', 'cancelled'}
          .contains(job.status)) {
        final failed = const {'failed', 'dead_lettered'}.contains(job.status);
        await _storeNotificationIntent(
          kind: failed ? 'ai_job_failed' : 'ai_job_completed',
          targetKind: 'ai_job',
          targetId: job.id,
          title: failed ? 'AI job needs attention' : 'AI result is ready',
          body: failed
              ? 'Open FocusLog to review the safe failure reason.'
              : 'Open FocusLog to view the synchronized AI result.',
          payload: {
            'targetKind': 'ai_job',
            'targetId': job.id,
            'ownerId': _ownerId,
            'workspaceId': workspaceId,
          },
          createdAt: nowText,
        );
      }
    }

    final blocked = await policySnapshot();
    if (blocked.cloudExecutionDisabled || !blocked.cloudConsentActive) {
      await _storeNotificationIntent(
        kind: blocked.cloudConsentActive
            ? 'cloud_execution_blocked'
            : 'consent_required',
        targetKind: 'ai_policy',
        targetId: 'default',
        title: blocked.cloudConsentActive
            ? 'Cloud AI is disabled'
            : 'AI consent required',
        body: 'Open FocusLog to review privacy and consent settings.',
        payload: {
          'targetKind': 'ai_policy',
          'targetId': 'default',
          'ownerId': _ownerId,
          'workspaceId': workspaceId,
        },
        createdAt: nowText,
      );
    }
    if (blocked.budget.remainingMicros == '0' ||
        blocked.budget.unknownPricingBlocked) {
      await _storeNotificationIntent(
        kind: 'budget_blocked',
        targetKind: 'ai_budget',
        targetId: blocked.budget.month,
        title: 'AI budget needs attention',
        body: 'Open FocusLog to review exact budget status.',
        payload: {
          'targetKind': 'ai_budget',
          'targetId': blocked.budget.month,
          'ownerId': _ownerId,
          'workspaceId': workspaceId,
        },
        createdAt: nowText,
      );
    }

    final staleRows = await database.customSelect(
      'SELECT id, level, period_key FROM ai_mobile_analysis_results '
      'WHERE owner_id = ? AND workspace_id = ? AND deleted_at IS NULL '
      "AND stale_state NOT IN ('current', 'none') LIMIT 10",
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
      ],
    ).get();
    for (final row in staleRows) {
      await _storeNotificationIntent(
        kind: 'ai_result_stale',
        targetKind: 'ai_result',
        targetId: row.read<String>('id'),
        title: 'AI result was marked stale',
        body: 'Open FocusLog to view recomputation status.',
        payload: {
          'targetKind': 'ai_result',
          'targetId': row.read<String>('id'),
          'ownerId': _ownerId,
          'workspaceId': workspaceId,
        },
        createdAt: nowText,
      );
    }
  }

  Future<void> _storeNotificationIntent({
    required String kind,
    required String targetKind,
    required String targetId,
    required String title,
    required String body,
    required Map<String, Object?> payload,
    required String createdAt,
  }) async {
    _assertSecretFreeJson(payload);
    await database.customStatement(
      'INSERT INTO ai_mobile_notification_events '
      '(id, owner_id, workspace_id, notification_kind, target_kind, target_id, '
      'title, body, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) '
      'ON CONFLICT(owner_id, workspace_id, notification_kind, target_kind, target_id) '
      'DO UPDATE SET title = excluded.title, body = excluded.body, '
      'payload_json = excluded.payload_json, created_at = excluded.created_at',
      [
        generateSyncId(),
        _ownerId,
        workspaceId,
        _safeToken(kind, fallback: 'notification'),
        _safeToken(targetKind, fallback: 'ai'),
        _safeToken(targetId, fallback: 'target'),
        _safeNotificationText(title),
        _safeNotificationText(body),
        jsonEncode(payload),
        createdAt,
      ],
    );
  }

  Future<void> _applyAnalysisResult(Map<String, dynamic> payload) async {
    final resultId = payload['id'] as String;
    final level = payload['level'] as String;
    final periodKey = payload['periodKey'] as String;
    final resultVersion = int.parse(payload['resultVersion'].toString());
    final costMicros = (payload['costMicros'] ?? '0').toString();
    _requireMicroUnits(costMicros);
    if (await _isTombstoned('analysis_result', resultId)) return;
    final nowText = _clock().toUtc().toIso8601String();
    await database.customStatement(
      'INSERT INTO ai_mobile_analysis_results '
      '(id, owner_id, workspace_id, level, period_key, result_version, status, '
      'summary, structured_json, provider_json, fallback_json, provenance_json, '
      'stale_state, supersedes_result_id, cost_micros, usage_json, deleted_at, '
      'created_at, updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) '
      'ON CONFLICT(id) DO UPDATE SET status = excluded.status, '
      'summary = excluded.summary, structured_json = excluded.structured_json, '
      'provider_json = excluded.provider_json, fallback_json = excluded.fallback_json, '
      'provenance_json = excluded.provenance_json, stale_state = excluded.stale_state, '
      'supersedes_result_id = excluded.supersedes_result_id, '
      'cost_micros = excluded.cost_micros, usage_json = excluded.usage_json, '
      'deleted_at = excluded.deleted_at, updated_at = excluded.updated_at',
      [
        resultId,
        _ownerId,
        workspaceId,
        level,
        periodKey,
        resultVersion,
        payload['status'] as String? ?? 'current',
        payload['summary'] as String? ?? '',
        jsonEncode(payload['structured'] ?? const <String, Object?>{}),
        jsonEncode(payload['provider'] ?? const <String, Object?>{}),
        jsonEncode(payload['fallback'] ?? const <String, Object?>{}),
        jsonEncode(payload['provenance'] ?? const <String, Object?>{}),
        payload['staleState'] as String? ?? 'current',
        payload['supersedesResultId'],
        costMicros,
        jsonEncode(payload['usage'] ?? const <String, Object?>{}),
        payload['deletedAt'],
        payload['createdAt'] as String? ?? nowText,
        payload['updatedAt'] as String? ?? nowText,
      ],
    );
  }

  Future<void> _applyJobProjection(Map<String, dynamic> payload) async {
    final id = payload['id'] as String;
    final costMicros = (payload['costMicros'] ?? '0').toString();
    _requireMicroUnits(costMicros);
    await database.customStatement(
      'INSERT INTO ai_mobile_job_projections '
      '(id, owner_id, workspace_id, job_type, status, idempotency_key, '
      'requested_by_device_id, provider_json, error_json, result_id, cost_micros, '
      'created_at, updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) '
      'ON CONFLICT(id) DO UPDATE SET status = excluded.status, '
      'provider_json = excluded.provider_json, error_json = excluded.error_json, '
      'result_id = excluded.result_id, cost_micros = excluded.cost_micros, '
      'updated_at = excluded.updated_at',
      [
        id,
        _ownerId,
        workspaceId,
        payload['jobType'] as String,
        payload['status'] as String,
        payload['idempotencyKey'] as String? ?? id,
        payload['requestedByDeviceId'],
        jsonEncode(payload['provider'] ?? const <String, Object?>{}),
        payload['error'] == null ? null : jsonEncode(payload['error']),
        payload['resultId'],
        costMicros,
        payload['createdAt'] as String? ?? _clock().toUtc().toIso8601String(),
        payload['updatedAt'] as String? ?? _clock().toUtc().toIso8601String(),
      ],
    );
  }

  Future<void> _applyUsageSummary(Map<String, dynamic> payload) async {
    final reservedMicros = (payload['reservedMicros'] ?? '0').toString();
    final settledMicros = (payload['settledMicros'] ?? '0').toString();
    _requireMicroUnits(reservedMicros);
    _requireMicroUnits(settledMicros);
    await database.customStatement(
      'INSERT INTO ai_mobile_usage_summaries '
      '(id, owner_id, workspace_id, period_key, purpose, reserved_micros, '
      'settled_micros, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) '
      'ON CONFLICT(owner_id, workspace_id, period_key, purpose) DO UPDATE SET '
      'reserved_micros = excluded.reserved_micros, '
      'settled_micros = excluded.settled_micros, updated_at = excluded.updated_at',
      [
        payload['id'] as String? ?? generateSyncId(),
        _ownerId,
        workspaceId,
        payload['periodKey'] as String,
        payload['purpose'] as String,
        reservedMicros,
        settledMicros,
        payload['updatedAt'] as String? ?? _clock().toUtc().toIso8601String(),
      ],
    );
  }

  Future<void> _applySettings(Map<String, dynamic> payload) async {
    final values = payload['values'] as Map<String, dynamic>? ?? payload;
    await database.customStatement(
      'INSERT INTO ai_mobile_settings '
      '(owner_id, workspace_id, values_json, schema_version, updated_at) '
      'VALUES (?, ?, ?, ?, ?) '
      'ON CONFLICT(owner_id, workspace_id) DO UPDATE SET '
      'values_json = excluded.values_json, schema_version = excluded.schema_version, '
      'updated_at = excluded.updated_at',
      [
        _ownerId,
        workspaceId,
        jsonEncode(values),
        aiMobileContractVersion,
        payload['updatedAt'] as String? ?? _clock().toUtc().toIso8601String(),
      ],
    );
  }

  Future<void> _applyMemoryCache(
    String kind,
    Map<String, dynamic> payload,
  ) async {
    final sourceId = payload['sourceId'] as String;
    final sourceRevisionId = payload['sourceRevisionId'] as String?;
    if (await _isTombstoned(kind, sourceId)) return;
    await database.customStatement(
      'INSERT INTO ai_mobile_memory_cache '
      '(id, owner_id, workspace_id, kind, source_id, source_revision_id, '
      'payload_json, stale_state, deleted_at, updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) '
      'ON CONFLICT(owner_id, workspace_id, kind, source_id, COALESCE(source_revision_id, \'\')) '
      'DO UPDATE SET payload_json = excluded.payload_json, '
      'stale_state = excluded.stale_state, deleted_at = excluded.deleted_at, '
      'updated_at = excluded.updated_at',
      [
        payload['id'] as String? ?? generateSyncId(),
        _ownerId,
        workspaceId,
        kind,
        sourceId,
        sourceRevisionId,
        jsonEncode(payload['data'] ?? payload),
        payload['staleState'] as String? ?? 'current',
        payload['deletedAt'],
        payload['updatedAt'] as String? ?? _clock().toUtc().toIso8601String(),
      ],
    );
  }

  Future<List<QueryRow>> _memoryRows({
    required String kind,
    required int limit,
  }) =>
      database.customSelect(
        'SELECT * FROM ai_mobile_memory_cache WHERE owner_id = ? '
        'AND workspace_id = ? AND kind = ? AND deleted_at IS NULL '
        'ORDER BY updated_at DESC LIMIT ?',
        variables: [
          Variable.withString(_ownerId),
          Variable.withString(workspaceId),
          Variable.withString(kind),
          Variable.withInt(limit),
        ],
      ).get();

  Future<List<QueryRow>> _playgroundRows({
    required String kind,
    String? parentId,
    required int limit,
  }) {
    final whereParent =
        parentId == null ? '' : 'AND parent_id = ? ';
    return database.customSelect(
      'SELECT * FROM ai_mobile_playground_projections WHERE owner_id = ? '
      'AND workspace_id = ? AND projection_kind = ? AND deleted_at IS NULL '
      '$whereParent'
      'ORDER BY updated_at DESC LIMIT ?',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
        Variable.withString(kind),
        if (parentId != null) Variable.withString(parentId),
        Variable.withInt(limit),
      ],
    ).get();
  }

  Future<int> _countPlaygroundKind(String kind) async {
    final row = await database.customSelect(
      'SELECT COUNT(*) AS count FROM ai_mobile_playground_projections '
      'WHERE owner_id = ? AND workspace_id = ? AND projection_kind = ? '
      'AND deleted_at IS NULL',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
        Variable.withString(kind),
      ],
    ).getSingle();
    return row.read<int>('count');
  }

  Future<int> _countInboxCursors() async {
    final row = await database.customSelect(
      'SELECT COUNT(*) AS count FROM ai_mobile_inbox_cursors '
      'WHERE owner_id = ? AND workspace_id = ?',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
      ],
    ).getSingle();
    return row.read<int>('count');
  }

  Future<void> _applyPlaygroundProjection(
    String kind,
    Map<String, dynamic> payload,
  ) async {
    final rawPlaygroundId = payload['id'] ??
        payload['playgroundId'] ??
        payload['sessionId'] ??
        payload['runId'] ??
        payload['messageId'] ??
        generateSyncId();
    final playgroundId = rawPlaygroundId.toString();
    final rawParentId = payload['sessionId'] ?? payload['parentId'];
    final parentId = rawParentId?.toString();
    final data = payload['data'] is Map<String, dynamic>
        ? payload['data'] as Map<String, dynamic>
        : payload;
    final safeState = payload['safeState'] as String? ??
        data['status'] as String? ??
        'synchronized';
    final updatedAt = payload['updatedAt'] as String? ??
        data['updatedAt'] as String? ??
        _clock().toUtc().toIso8601String();
    if (data['productionPromotion'] == true ||
        data['productionNamespaceActivation'] == true) {
      throw const MobileAISecurityException(
        'Mobile Playground projections cannot promote production AI state.',
      );
    }
    await database.customStatement(
      'INSERT INTO ai_mobile_playground_projections '
      '(id, owner_id, workspace_id, projection_kind, playground_id, parent_id, '
      'payload_json, safe_state, deleted_at, updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) '
      'ON CONFLICT(owner_id, workspace_id, projection_kind, playground_id) '
      'DO UPDATE SET parent_id = excluded.parent_id, '
      'payload_json = excluded.payload_json, safe_state = excluded.safe_state, '
      'deleted_at = excluded.deleted_at, updated_at = excluded.updated_at',
      [
        (payload['id'] ?? generateSyncId()).toString(),
        _ownerId,
        workspaceId,
        kind,
        playgroundId,
        parentId,
        jsonEncode(data),
        safeState,
        payload['deletedAt'] ?? data['deletedAt'],
        updatedAt,
      ],
    );
  }

  Future<void> _applyTombstone(Map<String, dynamic> payload) async {
    final recordKind = payload['recordKind'] as String;
    final recordId = payload['recordId'] as String;
    final deletedAt =
        payload['deletedAt'] as String? ?? _clock().toUtc().toIso8601String();
    final retentionUntil =
        payload['retentionUntil'] as String? ?? deletedAt;
    await database.transaction(() async {
      await database.customStatement(
        'INSERT INTO ai_mobile_tombstones '
        '(id, owner_id, workspace_id, record_kind, record_id, '
        'source_revision_id, deleted_at, retention_until) '
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?) '
        'ON CONFLICT(owner_id, workspace_id, record_kind, record_id) '
        'DO UPDATE SET deleted_at = excluded.deleted_at, '
        'retention_until = excluded.retention_until',
        [
          payload['id'] as String? ?? generateSyncId(),
          _ownerId,
          workspaceId,
          recordKind,
          recordId,
          payload['sourceRevisionId'],
          deletedAt,
          retentionUntil,
        ],
      );
      if (recordKind == 'analysis_result') {
        await database.customStatement(
          'UPDATE ai_mobile_analysis_results SET deleted_at = ?, '
          'updated_at = ? WHERE owner_id = ? AND workspace_id = ? AND id = ?',
          [deletedAt, deletedAt, _ownerId, workspaceId, recordId],
        );
      }
      await database.customStatement(
        'UPDATE ai_mobile_memory_cache SET deleted_at = ?, stale_state = ?, '
        'updated_at = ? WHERE owner_id = ? AND workspace_id = ? '
        'AND (source_id = ? OR id = ?)',
        [
          deletedAt,
          'deleted',
          deletedAt,
          _ownerId,
          workspaceId,
          recordId,
          recordId,
        ],
      );
    });
  }

  Future<bool> _isTombstoned(String recordKind, String recordId) async {
    final row = await database.customSelect(
      'SELECT 1 FROM ai_mobile_tombstones '
      'WHERE owner_id = ? AND workspace_id = ? AND record_kind = ? AND record_id = ?',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(workspaceId),
        Variable.withString(recordKind),
        Variable.withString(recordId),
      ],
    ).getSingleOrNull();
    return row != null;
  }

  void _requireOwner(String ownerId) {
    if (ownerId != _ownerId) {
      throw const MobileAICompatibilityException(
        'PERMISSION',
        'AI payload belongs to a different owner.',
      );
    }
  }
}

MobileAIAnalysisListItem _analysisListItemFromRow(QueryRow row) =>
    MobileAIAnalysisListItem(
      id: row.read<String>('id'),
      level: row.read<String>('level'),
      periodKey: row.read<String>('period_key'),
      resultVersion: row.read<int>('result_version'),
      status: row.read<String>('status'),
      summary: row.read<String>('summary'),
      costMicros: row.read<String>('cost_micros'),
      staleState: row.read<String>('stale_state'),
      createdAt: _readDate(row.read<Object>('created_at')),
    );

MobileAILifecycleDiagnostic _lifecycleDiagnosticFromRow(QueryRow row) =>
    MobileAILifecycleDiagnostic(
      id: row.read<String>('id'),
      normalizedState: row.read<String>('normalized_state'),
      category: row.read<String>('category'),
      jobId: row.readNullable<String>('job_id'),
      safeReason: row.read<String>('safe_reason'),
      createdAt: _readDate(row.read<Object>('created_at')),
    );

MobileAINotificationIntent _notificationIntentFromRow(QueryRow row) =>
    MobileAINotificationIntent(
      id: row.read<String>('id'),
      kind: row.read<String>('notification_kind'),
      targetKind: row.read<String>('target_kind'),
      targetId: row.read<String>('target_id'),
      title: row.read<String>('title'),
      body: row.read<String>('body'),
      payload: _readJsonObject(row.read<String>('payload_json')),
    );

MobileAIPlaygroundSession _playgroundSessionFromRow(
  QueryRow row,
  Map<String, dynamic> payload,
) {
  final costMicros = (payload['costMicros'] ?? '0').toString();
  _requireMicroUnits(costMicros);
  return MobileAIPlaygroundSession(
    id: row.read<String>('playground_id'),
    title: payload['title'] as String? ?? 'Untitled Playground session',
    status: payload['status'] as String? ?? row.read<String>('safe_state'),
    messageCount:
        int.tryParse((payload['messageCount'] ?? '0').toString()) ?? 0,
    runCount: int.tryParse((payload['runCount'] ?? '0').toString()) ?? 0,
    branchCount:
        int.tryParse((payload['branchCount'] ?? '0').toString()) ?? 0,
    provider: payload['provider'] as String? ?? 'not disclosed',
    model: payload['model'] as String? ?? 'not disclosed',
    costMicros: costMicros,
    latestRunStatus: payload['latestRunStatus'] as String? ?? 'none',
    updatedAt: _readDate(row.read<Object>('updated_at')),
  );
}

MobileAIPlaygroundRun _playgroundRunFromRow(
  QueryRow row,
  Map<String, dynamic> payload,
) {
  final costMicros = (payload['costMicros'] ?? '0').toString();
  _requireMicroUnits(costMicros);
  final payloadSessionId = payload['sessionId'];
  final sessionId = row.readNullable<String>('parent_id') ??
      (payloadSessionId is String ? payloadSessionId : '');
  return MobileAIPlaygroundRun(
    id: row.read<String>('playground_id'),
    sessionId: sessionId,
    status: payload['status'] as String? ?? row.read<String>('safe_state'),
    provider: payload['provider'] as String? ?? 'not disclosed',
    model: payload['model'] as String? ?? 'not disclosed',
    costMicros: costMicros,
    inputTokens:
        int.tryParse((payload['inputTokens'] ?? '0').toString()) ?? 0,
    outputTokens:
        int.tryParse((payload['outputTokens'] ?? '0').toString()) ?? 0,
    fallbackUsed: payload['fallbackUsed'] == true,
    structuredValid: payload['structuredValid'] == true,
    cancelled: payload['cancelled'] == true,
    partial: payload['partial'] == true,
    promptSnapshot: payload['promptSnapshot'] is Map<String, dynamic>
        ? payload['promptSnapshot'] as Map<String, dynamic>
        : <String, dynamic>{},
    contextSnapshot: payload['contextSnapshot'] is Map<String, dynamic>
        ? payload['contextSnapshot'] as Map<String, dynamic>
        : <String, dynamic>{},
    updatedAt: _readDate(row.read<Object>('updated_at')),
  );
}

MobileAIPlaygroundEvaluation _playgroundEvaluationFromRow(
  QueryRow row,
  Map<String, dynamic> payload,
) {
  final costMicros = (payload['costMicros'] ?? '0').toString();
  _requireMicroUnits(costMicros);
  return MobileAIPlaygroundEvaluation(
    id: row.read<String>('playground_id'),
    dataset: payload['dataset'] as String? ?? 'not disclosed',
    status: payload['status'] as String? ?? row.read<String>('safe_state'),
    deterministicScore:
        double.tryParse((payload['deterministicScore'] ?? '0').toString()) ??
            0,
    subjectiveLabel: payload['subjectiveLabel'] as String? ?? 'none',
    costMicros: costMicros,
    versionSummary: payload['versionSummary'] as String? ?? 'frozen',
    updatedAt: _readDate(row.read<Object>('updated_at')),
  );
}

Map<String, dynamic> _readJsonObject(String value) {
  try {
    final decoded = jsonDecode(value);
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) {
      return decoded.map((key, value) => MapEntry(key.toString(), value));
    }
  } catch (_) {
    // Malformed synchronized projections are rendered as empty safe metadata.
  }
  return <String, dynamic>{};
}

DateTime _readDate(Object value) {
  if (value is DateTime) return value.toUtc();
  return DateTime.tryParse(value.toString())?.toUtc() ??
      DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
}

int _weekNumber(DateTime date) {
  final firstDayOfYear = DateTime.utc(date.year, 1, 1);
  final daysOffset = firstDayOfYear.weekday - DateTime.monday;
  final firstMonday = firstDayOfYear.subtract(Duration(days: daysOffset));
  return date.difference(firstMonday).inDays ~/ 7 + 1;
}

MobileAIProviderProfile _providerProfileFromJson(Map<String, dynamic> value) {
  final endpoint = value['endpointHost'] ??
      value['endpointDisplay'] ??
      value['endpoint'] ??
      'not disclosed';
  final capabilities = value['capabilities'] is List
      ? (value['capabilities'] as List)
          .map((capability) => capability.toString())
          .toList()
      : const <String>[];
  return MobileAIProviderProfile(
    id: value['id'] as String? ?? 'unknown',
    displayName: value['displayName'] as String? ??
        value['name'] as String? ??
        'Unknown provider',
    classification: value['classification'] as String? ??
        value['privacyClass'] as String? ??
        'local',
    endpointHost: endpoint.toString(),
    capabilities: capabilities,
    modelAvailability:
        value['modelAvailability'] as String? ?? value['modelStatus'] as String? ?? 'unknown',
    validationStatus:
        value['validationStatus'] as String? ?? value['status'] as String? ?? 'unknown',
    credentialConfigured: value['credentialConfigured'] == true,
  );
}

MobileAIBudgetSnapshot _budgetFromSettings(Map<String, dynamic> values) {
  final raw = values['budget'] is Map<String, dynamic>
      ? values['budget'] as Map<String, dynamic>
      : <String, dynamic>{};
  String amount(String key) => (raw[key] ?? '0').toString();
  final monthlyLimit = amount('monthlyLimitMicros');
  final settled = amount('settledMicros');
  final reserved = amount('reservedMicros');
  final requestCap = amount('requestCapMicros');
  for (final value in [monthlyLimit, settled, reserved, requestCap]) {
    _requireMicroUnits(value);
  }
  final remaining = raw['remainingMicros']?.toString() ??
      _subtractMicros(monthlyLimit, settled, reserved);
  _requireMicroUnits(remaining);
  return MobileAIBudgetSnapshot(
    month: raw['month'] as String? ?? 'unsynchronized',
    currency: raw['currency'] as String? ?? 'micro_usd',
    monthlyLimitMicros: monthlyLimit,
    settledMicros: settled,
    reservedMicros: reserved,
    remainingMicros: remaining,
    requestCapMicros: requestCap,
    unknownPricingBlocked: raw['unknownPricingBlocked'] == true,
  );
}

String _subtractMicros(String limit, String settled, String reserved) {
  final remaining =
      BigInt.parse(limit) - BigInt.parse(settled) - BigInt.parse(reserved);
  return remaining < BigInt.zero ? '0' : remaining.toString();
}

String _safeToken(String value, {required String fallback}) {
  final sanitized = value.replaceAll(RegExp(r'[^A-Za-z0-9_.:-]'), '_');
  if (sanitized.isEmpty) return fallback;
  return sanitized.length > 96 ? sanitized.substring(0, 96) : sanitized;
}

String _safeReason(String value) {
  var sanitized = value
      .replaceAll(RegExp(r'Bearer\s+[A-Za-z0-9._~+/=-]+', caseSensitive: false),
          'Bearer [redacted]')
      .replaceAll(RegExp(r'(api[_-]?key|authorization|token|secret)[^,\s;]*',
              caseSensitive: false),
          '[redacted]');
  sanitized = sanitized.replaceAll(RegExp(r'[\r\n\t]+'), ' ').trim();
  if (sanitized.isEmpty) return 'none';
  return sanitized.length > 160 ? sanitized.substring(0, 160) : sanitized;
}

String _safeNotificationText(String value) {
  final sanitized = _safeReason(value);
  return sanitized.length > 96 ? sanitized.substring(0, 96) : sanitized;
}

bool _memoryPayloadVisible(Map<String, dynamic> payload) =>
    payload['deletedAt'] == null &&
    payload['deleted'] != true &&
    payload['privacyBlocked'] != true &&
    payload['playground'] != true &&
    payload['playgroundOnly'] != true &&
    payload['unavailable'] != true;

MobileMemorySearchResult _searchResultFromRow(
  QueryRow row,
  Map<String, dynamic> payload,
) {
  final metadata = payload['metadata'] is Map<String, dynamic>
      ? payload['metadata'] as Map<String, dynamic>
      : <String, dynamic>{};
  final timestamp = payload['timestamp'] as String? ??
      payload['createdAt'] as String? ??
      row.read<Object>('updated_at').toString();
  return MobileMemorySearchResult(
    id: row.read<String>('id'),
    sourceId: payload['sourceId'] as String? ?? row.read<String>('source_id'),
    sourceType: payload['sourceType'] as String? ?? 'source_revision',
    excerpt: payload['excerpt'] as String? ?? '',
    score: double.tryParse((payload['score'] ?? '0').toString()) ?? 0,
    timestamp: timestamp,
    namespace: payload['namespace'] as String? ?? 'not disclosed',
    model: payload['model'] as String? ?? 'not disclosed',
    mode: payload['mode'] as String? ?? 'hybrid',
    staleState: row.read<String>('stale_state'),
    metadata: metadata,
  );
}

MobileMemoryFact _factFromRow(
  QueryRow row,
  Map<String, dynamic> payload,
  List<Map<String, dynamic>> evidence,
) =>
    MobileMemoryFact(
      id: row.read<String>('id'),
      subject: payload['subject'] as String? ?? 'Unknown subject',
      predicate: payload['predicate'] as String? ?? 'related_to',
      value: payload['value']?.toString() ?? '',
      status: payload['status'] as String? ?? 'active',
      confidence: double.tryParse((payload['confidence'] ?? '0').toString()) ?? 0,
      validFrom: payload['validFrom'] as String?,
      validTo: payload['validTo'] as String?,
      provider: payload['provider'] as String? ?? 'not disclosed',
      model: payload['model'] as String? ?? 'not disclosed',
      evidence: evidence,
      staleState: row.read<String>('stale_state'),
    );

MobileGraphNode _graphNodeFromRow(QueryRow row, Map<String, dynamic> payload) {
  final neighbors = payload['neighbors'] is List
      ? (payload['neighbors'] as List)
          .whereType<Map>()
          .map((item) => item.map((key, value) => MapEntry(key.toString(), value)))
          .toList()
      : const <Map<String, dynamic>>[];
  return MobileGraphNode(
    id: row.read<String>('id'),
    label: payload['label'] as String? ?? row.read<String>('source_id'),
    type: payload['type'] as String? ?? 'entity',
    status: payload['status'] as String? ?? 'active',
    confidence: double.tryParse((payload['confidence'] ?? '0').toString()) ?? 0,
    neighbors: neighbors,
    evidence: _evidenceList(payload['evidence']),
  );
}

MobileMemoryAnswer _answerFromRow(QueryRow row, Map<String, dynamic> payload) =>
    MobileMemoryAnswer(
      id: row.read<String>('id'),
      question: payload['question'] as String? ?? '',
      answer: payload['answer'] as String? ?? '',
      provider: payload['provider'] as String? ?? 'not disclosed',
      model: payload['model'] as String? ?? 'not disclosed',
      fallbackUsed: payload['fallbackUsed'] == true,
      uncertainty: payload['uncertainty'] as String? ?? 'not disclosed',
      staleDisclosure: payload['staleDisclosure'] as String? ?? 'none',
      evidence: _evidenceList(payload['evidence']),
      createdAt: _readDate(row.read<Object>('updated_at')),
    );

List<Map<String, dynamic>> _evidenceList(Object? value) {
  if (value is! List) return const <Map<String, dynamic>>[];
  return value
      .whereType<Map>()
      .map((item) => item.map((key, value) => MapEntry(key.toString(), value)))
      .where((item) => item['sourceId'] != null || item['id'] != null)
      .toList();
}

int _readSchemaVersion(Map<String, dynamic> envelope) {
  final value = envelope['schemaVersion'] ??
      (envelope['payload'] is Map<String, dynamic>
          ? (envelope['payload'] as Map<String, dynamic>)['schemaVersion']
          : null);
  return int.parse((value ?? aiMobileContractVersion).toString());
}

void _requireSupportedJobType(String jobType) {
  if (!aiMobileJobTypeWireNames.contains(jobType)) {
    throw ArgumentError.value(jobType, 'jobType', 'Unsupported AI job type.');
  }
  if (aiMobileExecutionOwnership[jobType] != 'desktop_owned_execution') {
    throw ArgumentError.value(
      jobType,
      'jobType',
      'This AI job is not executable from mobile.',
    );
  }
}

void _requireMicroUnits(String value) {
  if (!isAiMobileMicroUnitAmount(value)) {
    throw const MobileAICompatibilityException(
      'VALIDATION',
      'AI monetary values must be integer micro-units.',
    );
  }
}

void _assertSecretFreeJson(Object? value) {
  if (value is Map) {
    for (final entry in value.entries) {
      final key = entry.key.toString();
      if (_forbiddenProjectionKeys.contains(key)) {
        throw const MobileAISecurityException(
          'AI mobile projections cannot include private provider material.',
        );
      }
      _assertSecretFreeJson(entry.value);
    }
    return;
  }
  if (value is Iterable) {
    for (final item in value) {
      _assertSecretFreeJson(item);
    }
  }
}

String _stableJson(Map<String, Object?> value) {
  final sorted = Map<String, Object?>.fromEntries(
    value.entries.toList()..sort((a, b) => a.key.compareTo(b.key)),
  );
  return jsonEncode(sorted);
}
