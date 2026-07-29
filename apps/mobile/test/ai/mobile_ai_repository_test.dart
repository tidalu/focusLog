import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/ai/mobile_ai_repository.dart';
import 'package:focuslog_mobile/data/database/app_database.dart';
import 'package:focuslog_mobile/identity/device_identity.dart';

DeviceIdentity _identity({
  String ownerId = '0123456789ABCDEFGHJKMNPQRS',
  String deviceId = '0123456789ABCDEFGHJKMNPQRT',
}) =>
    DeviceIdentity(
      ownerId: ownerId,
      deviceId: deviceId,
      publicKeyPem: 'test-public-key',
      privateKey: const [],
      publicKey: const [],
    );

void main() {
  test('creates mobile AI schema tables and indexes', () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);

    final table = await database
        .customSelect(
          "SELECT name FROM sqlite_master WHERE type = 'table' "
          "AND name = 'ai_mobile_outbox_actions'",
        )
        .getSingle();
    final index = await database
        .customSelect(
          "SELECT name FROM sqlite_master WHERE type = 'index' "
          "AND name = 'ai_mobile_memory_cache_identity_idx'",
        )
        .getSingle();

    expect(table.read<String>('name'), 'ai_mobile_outbox_actions');
    expect(index.read<String>('name'), 'ai_mobile_memory_cache_identity_idx');
  });

  test('manual analysis outbox uses stable idempotency and no provider call',
      () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = MobileAIRepository(database, _identity());

    final first = await repository.queueManualAnalysisRequest(
      level: 'daily',
      periodKey: '2026-07-29',
    );
    final duplicate = await repository.queueManualAnalysisRequest(
      level: 'daily',
      periodKey: '2026-07-29',
    );

    expect(duplicate, first);
    final outboxCount = await database
        .customSelect('SELECT COUNT(*) AS count FROM outbox_operations')
        .getSingle();
    final aiOutboxCount = await database
        .customSelect('SELECT COUNT(*) AS count FROM ai_mobile_outbox_actions')
        .getSingle();
    final jobCount = await database
        .customSelect('SELECT COUNT(*) AS count FROM ai_mobile_job_projections')
        .getSingle();

    expect(outboxCount.read<int>('count'), 1);
    expect(aiOutboxCount.read<int>('count'), 1);
    expect(jobCount.read<int>('count'), 1);
    await repository.assertSecretFreeLocalAiProjection();
  });

  test('inbox merge keeps latest result version for out-of-order deltas',
      () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = MobileAIRepository(database, _identity());

    await repository.applyRemoteEnvelope({
      'schemaVersion': 1,
      'ownerId': _identity().ownerId,
      'workspaceId': 'default',
      'kind': 'ai.analysis.result',
      'payload': {
        'id': '0123456789ABCDEFGHJKMNPA01',
        'level': 'daily',
        'periodKey': '2026-07-29',
        'resultVersion': 2,
        'summary': 'newer summary',
        'costMicros': '123',
        'usage': {'inputTokens': 10, 'outputTokens': 5},
      },
    });
    await repository.applyRemoteEnvelope({
      'schemaVersion': 1,
      'ownerId': _identity().ownerId,
      'workspaceId': 'default',
      'kind': 'ai.analysis.result',
      'payload': {
        'id': '0123456789ABCDEFGHJKMNPA00',
        'level': 'daily',
        'periodKey': '2026-07-29',
        'resultVersion': 1,
        'summary': 'older summary',
        'costMicros': '50',
      },
    });

    final current = await repository.currentAnalysisResult(
      level: 'daily',
      periodKey: '2026-07-29',
    );

    expect(current?.resultVersion, 2);
    expect(current?.summary, 'newer summary');
    expect(current?.costMicros, '123');
  });

  test('tombstones hide deleted AI result and related memory cache', () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = MobileAIRepository(database, _identity());

    await repository.applyRemoteEnvelope({
      'schemaVersion': 1,
      'ownerId': _identity().ownerId,
      'workspaceId': 'default',
      'kind': 'ai.analysis.result',
      'payload': {
        'id': '0123456789ABCDEFGHJKMNPD01',
        'level': 'weekly',
        'periodKey': '2026-W31',
        'resultVersion': 1,
        'summary': 'weekly summary',
        'costMicros': '10',
      },
    });
    await repository.applyRemoteEnvelope({
      'schemaVersion': 1,
      'ownerId': _identity().ownerId,
      'workspaceId': 'default',
      'kind': 'ai.memory.cache',
      'payload': {
        'id': '0123456789ABCDEFGHJKMNPC01',
        'sourceId': '0123456789ABCDEFGHJKMNPD01',
        'sourceRevisionId': '0123456789ABCDEFGHJKMNPR01',
        'data': {'excerpt': 'weekly summary'},
      },
    });
    await repository.applyRemoteEnvelope({
      'schemaVersion': 1,
      'ownerId': _identity().ownerId,
      'workspaceId': 'default',
      'kind': 'ai.tombstone',
      'payload': {
        'recordKind': 'analysis_result',
        'recordId': '0123456789ABCDEFGHJKMNPD01',
        'deletedAt': '2026-07-29T12:00:00.000Z',
      },
    });

    final current = await repository.currentAnalysisResult(
      level: 'weekly',
      periodKey: '2026-W31',
    );
    final staleCache = await database
        .customSelect(
          "SELECT stale_state FROM ai_mobile_memory_cache "
          "WHERE source_id = '0123456789ABCDEFGHJKMNPD01'",
        )
        .getSingle();

    expect(current, isNull);
    expect(staleCache.read<String>('stale_state'), 'deleted');
  });

  test('rejects cross-profile AI payloads and secret-bearing projections',
      () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = MobileAIRepository(database, _identity());

    expect(
      repository.applyRemoteEnvelope({
        'schemaVersion': 1,
        'ownerId': '9999999999ABCDEFGHJKMNPQR',
        'workspaceId': 'default',
        'kind': 'ai.analysis.result',
        'payload': {'id': 'blocked'},
      }),
      throwsA(isA<MobileAICompatibilityException>()),
    );
    expect(
      repository.applyRemoteEnvelope({
        'schemaVersion': 1,
        'ownerId': _identity().ownerId,
        'workspaceId': 'default',
        'kind': 'ai.analysis.result',
        'payload': {
          'id': '0123456789ABCDEFGHJKMNPSEC',
          'apiKey': 'sk-test-secret',
        },
      }),
      throwsA(isA<MobileAISecurityException>()),
    );
  });

  test('policy updates queue through outbox and keep provider secrets absent',
      () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = MobileAIRepository(database, _identity());

    await repository.applyRemoteEnvelope({
      'schemaVersion': 1,
      'ownerId': _identity().ownerId,
      'workspaceId': 'default',
      'kind': 'ai.settings.snapshot',
      'payload': {
        'values': {
          'privacyMode': 'LOCAL',
          'providerProfiles': [
            {
              'id': 'desktop-default',
              'displayName': 'Desktop default',
              'classification': 'cloud',
              'endpointHost': 'api.example.invalid',
              'capabilities': ['generation', 'structured_output'],
              'modelAvailability': 'available',
              'validationStatus': 'valid',
              'credentialConfigured': true,
            }
          ],
          'budget': {
            'month': '2026-07',
            'monthlyLimitMicros': '1000000',
            'settledMicros': '200000',
            'reservedMicros': '100000',
            'requestCapMicros': '250000',
          },
        },
      },
    });

    await repository.queueCloudConsentUpdate(
      granted: false,
      purposes: const ['manual_analysis'],
    );
    await repository.queueBudgetUpdate(
      monthlyLimitMicros: '1500000',
      requestCapMicros: '300000',
    );
    await repository.queueKillSwitchUpdate(
      switchName: 'cloud_execution',
      enabled: true,
    );

    final policy = await repository.policySnapshot();
    final outbox = await database
        .customSelect(
          "SELECT COUNT(*) AS count FROM ai_mobile_outbox_actions "
          "WHERE action_kind IN ('ai.consent.revoke','ai.budget.update','ai.kill_switch.update')",
        )
        .getSingle();

    expect(policy.cloudConsentActive, isFalse);
    expect(policy.cloudExecutionDisabled, isTrue);
    expect(policy.budget.monthlyLimitMicros, '1500000');
    expect(policy.killSwitches['cloud_execution'], isTrue);
    expect(policy.mobileCredentialMode, 'desktop_owned_no_mobile_secrets');
    expect(outbox.read<int>('count'), 3);
    await repository.assertSecretFreeLocalAiProjection();
  });

  test('budget validation rejects non micro-unit strings', () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = MobileAIRepository(database, _identity());

    expect(
      repository.queueBudgetUpdate(
        monthlyLimitMicros: '1.25',
        requestCapMicros: '100',
      ),
      throwsA(isA<MobileAICompatibilityException>()),
    );
  });

  test('safe export preview excludes credentials and deleted content', () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = MobileAIRepository(database, _identity());

    await repository.queueSafeExportRequest(
      includeAnalyses: true,
      includeDerivedMemory: true,
      includePlayground: false,
    );
    final preview = await repository.safeExportPreview(
      includeAnalyses: true,
      includeDerivedMemory: true,
      includePlayground: false,
    );

    expect(preview['credentialIncluded'], isFalse);
    expect(preview['authorizationIncluded'], isFalse);
    expect(preview['deletedContentIncluded'], isFalse);
    expect(preview['includePlayground'], isFalse);
  });
}
