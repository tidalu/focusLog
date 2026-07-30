import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/ai/mobile_ai_playground_screen.dart';
import 'package:focuslog_mobile/ai/mobile_ai_repository.dart';
import 'package:focuslog_mobile/data/database/app_database.dart';
import 'package:focuslog_mobile/identity/device_identity.dart';

DeviceIdentity _identity() => DeviceIdentity(
      ownerId: '0123456789ABCDEFGHJKMNPQRS',
      deviceId: '0123456789ABCDEFGHJKMNPQRT',
      publicKeyPem: 'test',
      privateKey: const [],
      publicKey: const [],
    );

Future<MobileAIRepository> _seedPlayground() async {
  final database = AppDatabase.forTesting(NativeDatabase.memory());
  addTearDown(database.close);
  final repository = MobileAIRepository(database, _identity());
  await repository.applyRemoteEnvelope({
    'schemaVersion': 1,
    'ownerId': _identity().ownerId,
    'workspaceId': 'default',
    'kind': 'ai.playground.session',
    'payload': {
      'id': 'pg-session-1',
      'data': {
        'title': 'Prompt experiment',
        'status': 'archived',
        'messageCount': 3,
        'runCount': 1,
        'branchCount': 1,
        'provider': 'local',
        'model': 'test-model',
        'costMicros': '1200',
        'latestRunStatus': 'cancelled_partial',
      },
    },
  });
  await repository.applyRemoteEnvelope({
    'schemaVersion': 1,
    'ownerId': _identity().ownerId,
    'workspaceId': 'default',
    'kind': 'ai.playground.evaluation',
    'payload': {
      'id': 'pg-eval-1',
      'data': {
        'dataset': 'retrieval fixture',
        'status': 'complete',
        'deterministicScore': 0.75,
        'subjectiveLabel': 'none',
        'costMicros': '0',
        'versionSummary': 'dataset v1 / prompt v2',
      },
    },
  });
  return repository;
}

void main() {
  test('Playground decision is desktop-only and import validation is safe',
      () async {
    final repository = await _seedPlayground();
    final decision = repository.playgroundDecision();
    expect(decision.scope, 'desktop_only_power_user_tool');
    expect(decision.mobileExecutionSupported, isFalse);

    final unsafe = repository.validatePlaygroundImport({
      'schemaVersion': 'focuslog.playground.exchange.v1',
      'artifactType': 'evaluation_dataset',
      'name': '../evil.json',
    });
    expect(unsafe.accepted, isFalse);

    final duplicate = repository.validatePlaygroundImport({
      'schemaVersion': 'focuslog.playground.exchange.v1',
      'artifactType': 'evaluation_dataset',
      'name': 'safe.json',
      'cases': [
        {'id': 'case-1'},
        {'id': 'case-1'},
      ],
    });
    expect(duplicate.reason, 'duplicate_case_id');
  });

  test('Playground projections stay isolated from production memory', () async {
    final repository = await _seedPlayground();
    final sessions = await repository.listPlaygroundSessions();
    final search = await repository.searchMemory(query: 'Prompt experiment');
    final preview = await repository.safePlaygroundExportPreview(
      includeSessions: true,
      includeEvaluations: true,
    );

    expect(sessions, hasLength(1));
    expect(search, isEmpty);
    expect(preview['excludeProductionDataByDefault'], isTrue);
  });

  testWidgets('renders truthful mobile Playground unsupported state',
      (tester) async {
    final repository = await _seedPlayground();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: MobileAIPlaygroundScreen(repository: repository)),
    ));
    await tester.pumpAndSettle();

    expect(find.text('AI Playground'), findsOneWidget);
    expect(find.text('Execution requires desktop'), findsOneWidget);
    expect(find.text('Read-only shared sessions'), findsOneWidget);
    expect(find.text('Prompt experiment'), findsOneWidget);
    expect(find.textContaining('one run is not model superiority'), findsOneWidget);
  });
}
