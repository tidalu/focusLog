import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/ai/mobile_ai_repository.dart';
import 'package:focuslog_mobile/ai/mobile_ai_security_screen.dart';
import 'package:focuslog_mobile/data/database/app_database.dart';
import 'package:focuslog_mobile/identity/device_identity.dart';
import 'package:focuslog_mobile/identity/focuslog_api_client.dart';
import 'package:focuslog_mobile/security/endpoint_policy.dart';
import 'package:focuslog_mobile/sync/sync_worker.dart';

DeviceIdentity _identity() => DeviceIdentity(
      ownerId: '0123456789ABCDEFGHJKMNPQRS',
      deviceId: '0123456789ABCDEFGHJKMNPQRT',
      publicKeyPem: 'test-public-key',
      privateKey: const [],
      publicKey: const [],
    );

Future<MobileAIRepository> _repository() async {
  final database = AppDatabase.forTesting(NativeDatabase.memory());
  addTearDown(database.close);
  final repository = MobileAIRepository(database, _identity());
  await repository.applyRemoteEnvelope({
    'schemaVersion': 1,
    'ownerId': _identity().ownerId,
    'workspaceId': 'default',
    'kind': 'ai.settings.snapshot',
    'payload': {
      'privacyMode': 'LOCAL',
      'cloudExecutionDisabled': true,
      'mobileCredentialMode': 'desktop_owned_no_mobile_secrets',
      'killSwitches': {'cloud_execution': true},
    },
  });
  return repository;
}

void main() {
  test('mobile endpoint policy requires HTTPS except trusted localhost', () async {
    expect(
      requireFocusLogSafeEndpoint(Uri.parse('https://api.focuslog.example')),
      Uri.parse('https://api.focuslog.example'),
    );
    expect(
      requireFocusLogSafeEndpoint(Uri.parse('http://127.0.0.1:3000')),
      Uri.parse('http://127.0.0.1:3000'),
    );
    expect(
      () => requireFocusLogSafeEndpoint(Uri.parse('http://evil.example')),
      throwsArgumentError,
    );

    final identity = _identity();
    expect(
      () => FocusLogApiClient(
        endpoint: Uri.parse('http://evil.example'),
        identity: identity,
        identityService: DeviceIdentityService(),
      ),
      throwsArgumentError,
    );
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    expect(
      () => SyncWorker(
        database: database,
        endpoint: Uri.parse('http://evil.example'),
        identity: identity,
      ),
      throwsArgumentError,
    );
  });

  test('security review and diagnostics are bounded and secret-free', () async {
    final repository = await _repository();
    await repository.recordLifecycleDiagnostic(
      normalizedState: 'retrying',
      category: 'network',
      safeReason: 'Authorization: Bearer top-secret-token raw prompt ignored',
    );

    final review = await repository.mobileSecurityReview();
    final diagnostics = await repository.mobileDiagnosticsBundle(
      includePrivateContent: true,
    );
    await repository.assertSecretFreeLocalAiProjection();

    expect(review.credentialStorage, 'desktop_owned_no_mobile_secrets');
    expect(review.cloudTransport, contains('https_required'));
    expect(review.promptInjectionBoundary, contains('untrusted'));
    expect(diagnostics['includePrivateContent'], isFalse);
    expect(
      diagnostics['privateContentRequest'],
      'requires_explicit_desktop_export',
    );
    expect(diagnostics.toString(), isNot(contains('top-secret-token')));
  });

  test('resource and performance snapshots expose stable thresholds', () async {
    final repository = await _repository();
    final resources = await repository.mobileResourcePolicy();
    final performance = await repository.mobilePerformanceSnapshot();
    final packaging = repository.mobilePackagingReadiness();
    final releaseGate = await repository.mobileReleaseGateSnapshot();

    expect(resources.maxCachedRecords, 500);
    expect(resources.maxOutboxActions, 500);
    expect(resources.maxImportBytes, 262144);
    expect(resources.limitReached, isFalse);
    expect(performance.syntheticDataOnly, isTrue);
    expect(performance.uiThreadPolicy, contains('bounded'));
    expect(performance.backgroundPolicy, contains('never_runs_provider'));
    expect(packaging.iosTarget, 'not_applicable_platform_absent');
    expect(packaging.releaseExclusions, contains('test_credentials'));
    expect(releaseGate.platform, 'android');
    expect(releaseGate.schemaVersion, 8);
    expect(
      releaseGate.blockingGate,
      'flutter_toolchain_unavailable_in_current_environment',
    );
    expect(releaseGate.releaseArtifact, 'not_built_in_current_environment');
  });

  testWidgets('AI safety screen discloses security resources and diagnostics',
      (tester) async {
    final repository = await _repository();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: MobileAISecurityScreen(repository: repository)),
    ));
    await tester.pumpAndSettle();

    expect(find.text('AI safety'), findsOneWidget);
    expect(find.text('Security and privacy review'), findsOneWidget);
    expect(find.text('Resource controls'), findsOneWidget);
    expect(find.text('Synthetic performance snapshot'), findsOneWidget);
    expect(find.text('Packaging readiness'), findsOneWidget);
    expect(find.text('Mobile release gate'), findsOneWidget);
    expect(find.textContaining('Diagnostics exclude credentials'), findsOneWidget);
  });
}
