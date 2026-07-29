import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/ai/mobile_ai_execution_adapter.dart';
import 'package:focuslog_mobile/ai/mobile_ai_repository.dart';
import 'package:focuslog_mobile/data/database/app_database.dart';
import 'package:focuslog_mobile/identity/device_identity.dart';
import 'package:focuslog_mobile/sync/sync_worker.dart';

DeviceIdentity _identity({String ownerId = '0123456789ABCDEFGHJKMNPQRS'}) =>
    DeviceIdentity(
      ownerId: ownerId,
      deviceId: '0123456789ABCDEFGHJKMNPQRT',
      publicKeyPem: 'test',
      privateKey: const [],
      publicKey: const [],
    );

void main() {
  test('offline manual request reconnects once and does not duplicate',
      () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = MobileAIRepository(database, _identity());
    final adapter = MobileAIExecutionAdapter(
      repository: repository,
      synchronize: () async => const SyncResult.synced(1),
    );

    final first = await repository.queueManualAnalysisRequest(
      level: 'daily',
      periodKey: '2026-07-29',
    );
    final duplicate = await repository.queueManualAnalysisRequest(
      level: 'daily',
      periodKey: '2026-07-29',
    );
    await adapter.recordOffline();
    final result = await adapter.synchronizeAfterReconnect();

    expect(duplicate, first);
    expect(result.status, 'synced');
    final snapshot = await repository.lifecycleSnapshot();
    expect(snapshot.pendingActions, 1);
    expect(snapshot.lastDiagnostic?.normalizedState, 'synchronized');
  });

  test('offline cancellation survives restart and remains owner scoped',
      () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = MobileAIRepository(database, _identity());

    await repository.queueCancellation('job-123');
    final snapshot = await MobileAIExecutionAdapter(repository: repository)
        .recoverAfterColdStart(reason: 'process_restart');

    expect(snapshot.cancellationPending, 1);
    final rejected = await repository.validateDeepLink(
      ownerId: 'other-owner',
      workspaceId: 'default',
      targetKind: 'ai_job',
      targetId: 'job-123',
    );
    expect(rejected.allowed, isFalse);
  });

  test('notification intents are private and deep links validate ownership',
      () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = MobileAIRepository(database, _identity());
    await repository.applyRemoteEnvelope({
      'schemaVersion': 1,
      'ownerId': _identity().ownerId,
      'workspaceId': 'default',
      'kind': 'ai.job.projection',
      'payload': {
        'id': 'job-complete',
        'jobType': 'daily_analysis',
        'status': 'succeeded',
        'idempotencyKey': 'idem',
        'costMicros': '1200',
        'provider': {'displayName': 'Local model'},
      },
    });

    final intents =
        await MobileAIExecutionAdapter(repository: repository).notifications();
    expect(intents.any((intent) => intent.kind == 'ai_job_completed'), isTrue);
    expect(intents.map((intent) => intent.body).join('\n'),
        isNot(contains('raw prompt')));
    final deepLink = await repository.validateDeepLink(
      ownerId: _identity().ownerId,
      workspaceId: 'default',
      targetKind: 'ai_job',
      targetId: 'job-complete',
    );
    expect(deepLink.allowed, isTrue);
  });
}
