import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:focuslog_mobile/data/database/app_database.dart';
import 'package:focuslog_mobile/data/mobile_repository.dart';
import 'package:focuslog_mobile/sync/sync_worker.dart';
import 'package:focuslog_mobile/identity/device_identity.dart';

class _AcceptedClient extends http.BaseClient {
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final body = request.url.path.endsWith('/pull')
        ? '{"changes":[],"nextCursor":"0"}'
        : request.url.path.endsWith('/push')
            ? jsonEncode({
                'results': [
                  {
                    'operationId': (jsonDecode((request as http.Request).body)
                            as Map<String, dynamic>)['operations'][0]
                        ['operationId'],
                    'status': 'accepted'
                  }
                ]
              })
            : '{}';
    return http.StreamedResponse(Stream.value(body.codeUnits), 200,
        headers: const {'content-type': 'application/json'});
  }
}

class _TestIdentityService extends DeviceIdentityService {
  @override
  Future<String> sign(DeviceIdentity identity, String message) async =>
      'test-signature';
}

class _UnavailableClient extends http.BaseClient {
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    throw http.ClientException('backend unavailable', request.url);
  }
}

void main() {
  test('retains local focus operation until synchronization acknowledges it',
      () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = FocusLogRepository(
        database,
        DeviceIdentity(
            ownerId: '0123456789ABCDEFGHJKMNPQRS',
            deviceId: '0123456789ABCDEFGHJKMNPQRT',
            publicKeyPem: 'test',
            privateKey: const [],
            publicKey: const []));
    await repository.createCheckIn('Offline Android check-in');
    final before = await repository.dailyReport();
    expect(before.queuedOperations, greaterThan(0));
    final worker = SyncWorker(
        database: database,
        identity: DeviceIdentity(
            ownerId: '0123456789ABCDEFGHJKMNPQRS',
            deviceId: '0123456789ABCDEFGHJKMNPQRT',
            publicKeyPem: 'test',
            privateKey: const [],
            publicKey: const []),
        identityService: _TestIdentityService(),
        endpoint: Uri.parse('https://focuslog.example'),
        client: _AcceptedClient(),
        connectivityCheck: () async => [ConnectivityResult.wifi]);
    final result = await worker.synchronize();
    expect(result.status, 'synced');
    expect((await repository.dailyReport()).queuedOperations, 0);
  });

  test('keeps operations durably queued while offline', () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = FocusLogRepository(
        database,
        DeviceIdentity(
            ownerId: '0123456789ABCDEFGHJKMNPQRS',
            deviceId: '0123456789ABCDEFGHJKMNPQRT',
            publicKeyPem: 'test',
            privateKey: const [],
            publicKey: const []));
    await repository.createCheckIn('Offline Android check-in');
    final worker = SyncWorker(
        database: database,
        identity: DeviceIdentity(
            ownerId: '0123456789ABCDEFGHJKMNPQRS',
            deviceId: '0123456789ABCDEFGHJKMNPQRT',
            publicKeyPem: 'test',
            privateKey: const [],
            publicKey: const []),
        identityService: _TestIdentityService(),
        endpoint: Uri.parse('https://focuslog.example'),
        client: _AcceptedClient(),
        connectivityCheck: () async => [ConnectivityResult.none]);
    expect((await worker.synchronize()).status, 'offline');
    expect((await repository.dailyReport()).queuedOperations, greaterThan(0));
  });

  test('retries after the backend returns without losing the check-in',
      () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final identity = DeviceIdentity(
        ownerId: '0123456789ABCDEFGHJKMNPQRS',
        deviceId: '0123456789ABCDEFGHJKMNPQRT',
        publicKeyPem: 'test',
        privateKey: const [],
        publicKey: const []);
    final repository = FocusLogRepository(database, identity);
    await repository.createCheckIn('Durable Android retry check-in');
    final start = DateTime.now().toUtc().add(const Duration(seconds: 1));
    final unavailable = SyncWorker(
        database: database,
        identity: identity,
        identityService: _TestIdentityService(),
        endpoint: Uri.parse('https://focuslog.example'),
        client: _UnavailableClient(),
        connectivityCheck: () async => [ConnectivityResult.wifi],
        clock: () => start);
    expect((await unavailable.synchronize()).status, 'retrying');
    expect(
        (await database
                .customSelect('SELECT attempts FROM outbox_operations')
                .getSingle())
            .read<int>('attempts'),
        1);
    final recovered = SyncWorker(
        database: database,
        identity: identity,
        identityService: _TestIdentityService(),
        endpoint: Uri.parse('https://focuslog.example'),
        client: _AcceptedClient(),
        connectivityCheck: () async => [ConnectivityResult.wifi],
        clock: () => start.add(const Duration(minutes: 5)));
    expect((await recovered.synchronize()).status, 'synced');
    expect((await repository.dailyReport()).queuedOperations, 0);
  });
}
