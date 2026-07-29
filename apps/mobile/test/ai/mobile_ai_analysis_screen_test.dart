import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/ai/mobile_ai_analysis_screen.dart';
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

Future<MobileAIRepository> _repository() async {
  final database = AppDatabase.forTesting(NativeDatabase.memory());
  final repository = MobileAIRepository(database, _identity());
  await repository.applyRemoteEnvelope({
    'schemaVersion': 1,
    'ownerId': _identity().ownerId,
    'workspaceId': 'default',
    'kind': 'ai.settings.snapshot',
    'payload': {
      'values': {
        'executor': {
          'availability': 'executor_unavailable',
          'lastSeenAt': '2026-07-29T10:00:00.000Z',
        },
        'schedules': {
          'daily': {
            'enabled': true,
            'localTime': '20:00',
            'timezone': 'Europe/Warsaw',
            'providerProfileId': 'desktop-default',
            'model': 'automatic',
            'fallbackChainId': 'safe-chain',
            'privacyMode': 'LOCAL',
            'maxCostMicros': '250000',
            'killSwitch': false,
            'nextExpectedRun': '2026-07-30T18:00:00.000Z',
            'lastSuccessfulRun': '2026-07-28T18:00:00.000Z',
          },
        },
        'budget': {
          'month': '2026-07',
          'monthlyLimitMicros': '1000000',
          'settledMicros': '200000',
          'reservedMicros': '100000',
          'requestCapMicros': '250000',
          'unknownPricingBlocked': true,
        },
        'providerProfiles': [
          {
            'id': 'desktop-default',
            'displayName': 'Desktop default',
            'classification': 'cloud',
            'endpointHost': 'api.example.invalid',
            'capabilities': ['generation'],
            'modelAvailability': 'available',
            'validationStatus': 'valid',
            'credentialConfigured': true,
          }
        ],
        'killSwitches': {
          'provider_calls': false,
          'cloud_execution': true,
        },
      },
    },
  });
  addTearDown(database.close);
  return repository;
}

void main() {
  testWidgets('renders synchronized daily result with safe disclosure',
      (tester) async {
    final repository = await _repository();
    await repository.applyRemoteEnvelope({
      'schemaVersion': 1,
      'ownerId': _identity().ownerId,
      'workspaceId': 'default',
      'kind': 'ai.analysis.result',
      'payload': {
        'id': '0123456789ABCDEFGHJKMNPDA1',
        'level': 'daily',
        'periodKey': '2026-07-29',
        'resultVersion': 1,
        'summary': 'You protected the morning for deep work.',
        'structured': {
          'patterns': ['Deep work early'],
          'safe_next_steps': ['Keep the morning block'],
        },
        'provider': {
          'requestedProvider': 'desktop-default',
          'actualProvider': 'local',
          'actualModel': 'local-model',
          'promptVersion': 'daily-v1',
        },
        'fallback': {'used': false},
        'provenance': {
          'evidence': [
            {
              'kind': 'source_revision',
              'sourceId': '0123456789ABCDEFGHJKMNPS01',
              'timestamp': '2026-07-29T08:00:00.000Z',
              'excerpt': 'Morning planning session',
            }
          ],
        },
        'usage': {'inputTokens': 100, 'outputTokens': 50},
        'costMicros': '12345',
      },
    });

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: MobileAIAnalysisScreen(repository: repository)),
    ));
    await tester.pumpAndSettle();

    expect(find.text('AI analyses'), findsOneWidget);
    expect(find.textContaining('Desktop-owned execution'), findsOneWidget);
    expect(find.textContaining('You protected the morning'), findsOneWidget);
    expect(find.textContaining('12345 micro-usd'), findsOneWidget);

    await tester.tap(find.textContaining('You protected the morning'));
    await tester.pumpAndSettle();

    expect(find.text('Structured sections'), findsOneWidget);
    expect(find.textContaining('local-model'), findsOneWidget);
    expect(find.textContaining('Morning planning session'), findsOneWidget);
    expect(find.text('Regenerate this period'), findsOneWidget);
  });

  testWidgets('manual Analyze Now deduplicates active equivalent jobs',
      (tester) async {
    final repository = await _repository();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: MobileAIAnalysisScreen(repository: repository)),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Analyze Now').last);
    await tester.pumpAndSettle();
    final firstCount = await repository.safeCounts();

    await tester.tap(find.text('Analyze Now').last);
    await tester.pumpAndSettle();
    final secondCount = await repository.safeCounts();

    expect(firstCount['pendingOutboxActions'], 1);
    expect(secondCount['pendingOutboxActions'], 1);
    expect(find.text('Existing job active'), findsOneWidget);
  });

  testWidgets('shows empty and executor unavailable states', (tester) async {
    final repository = await _repository();

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: MobileAIAnalysisScreen(repository: repository)),
    ));
    await tester.pumpAndSettle();

    expect(find.textContaining('Waiting for the paired desktop executor'),
        findsOneWidget);
    expect(find.textContaining('No daily result yet'), findsOneWidget);
    expect(find.text('Schedule controls'), findsOneWidget);
  });

  testWidgets('shows privacy, provider, budget, and kill-switch controls',
      (tester) async {
    final repository = await _repository();

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: MobileAIAnalysisScreen(repository: repository)),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Privacy, consent, and budget'), findsOneWidget);
    expect(find.text('Local'), findsOneWidget);
    expect(find.text('Cloud consent'), findsOneWidget);
    expect(find.textContaining('Unknown pricing is blocked'), findsOneWidget);
    expect(find.textContaining('Desktop default'), findsOneWidget);
    expect(find.textContaining('credentials: configured on authority'),
        findsOneWidget);
    expect(find.text('Cloud Execution'), findsOneWidget);
    expect(find.textContaining('desktop_owned_no_mobile_secrets'),
        findsOneWidget);
  });
}
