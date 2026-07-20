import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:cryptography/cryptography.dart';
import 'package:drift/drift.dart' hide isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/data/database/app_database.dart';
import 'package:focuslog_mobile/data/mobile_repository.dart';
import 'package:focuslog_mobile/identity/device_identity.dart';
import 'package:focuslog_mobile/identity/focuslog_api_client.dart';
import 'package:focuslog_mobile/sync/sync_worker.dart';

String _pem(String label, List<int> der) {
  final encoded = base64Encode(der);
  final lines = RegExp('.{1,64}')
      .allMatches(encoded)
      .map((match) => match.group(0))
      .join('\n');
  return '-----BEGIN $label-----\n$lines\n-----END $label-----\n';
}

Future<DeviceIdentity> _identity() async {
  final pair = await Ed25519().newKeyPair();
  final publicKey = (await pair.extractPublicKey()).bytes;
  final privateKey = await pair.extractPrivateKeyBytes();
  final publicDer = [
    0x30,
    0x2a,
    0x30,
    0x05,
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70,
    0x03,
    0x21,
    0x00,
    ...publicKey
  ];
  return DeviceIdentity(
    ownerId: generateSyncId(),
    deviceId: generateSyncId(),
    publicKeyPem: _pem('PUBLIC KEY', publicDer),
    privateKey: privateKey,
    publicKey: publicKey,
  );
}

void main() {
  const address = String.fromEnvironment('FOCUSLOG_INTEGRATION_API_URL');
  test(
    'Drift outbox survives a real outage and synchronizes through Fastify',
    () async {
      final endpoint = Uri.parse(address);
      final identity = await _identity();
      final identityService = DeviceIdentityService();
      final api = FocusLogApiClient(
        endpoint: endpoint,
        identity: identity,
        identityService: identityService,
      );
      await api.bootstrap(displayName: 'Flutter integration device');
      api.dispose();

      final database = AppDatabase.forTesting(NativeDatabase.memory());
      addTearDown(database.close);
      final repository = FocusLogRepository(database, identity);
      final checkInId = await repository
          .createCheckIn('Android Drift check-in sent to the real backend');
      final start = DateTime.now().toUtc().add(const Duration(seconds: 1));

      final unavailable = SyncWorker(
        database: database,
        endpoint: Uri.parse('http://127.0.0.1:1'),
        identity: identity,
        identityService: identityService,
        connectivityCheck: () async => [ConnectivityResult.wifi],
        clock: () => start,
      );
      expect((await unavailable.synchronize()).status, 'retrying');
      unavailable.dispose();

      final recovered = SyncWorker(
        database: database,
        endpoint: endpoint,
        identity: identity,
        identityService: identityService,
        connectivityCheck: () async => [ConnectivityResult.wifi],
        clock: () => start.add(const Duration(minutes: 5)),
      );
      expect((await recovered.synchronize()).status, 'synced');
      recovered.dispose();

      final outbox = await database.customSelect(
        'SELECT acknowledged_at FROM outbox_operations WHERE entity_id = ?',
        variables: [Variable.withString(checkInId)],
      ).getSingle();
      expect(outbox.readNullable<DateTime>('acknowledged_at'), isNotNull);
      final journal = await database.customSelect(
        'SELECT operation_id FROM sync_operations WHERE entity_id = ?',
        variables: [Variable.withString(checkInId)],
      ).getSingle();
      expect(journal.read<String>('operation_id'), hasLength(26));

      await repository.startFocusSession(intervalMinutes: 1);
      final dueAt = DateTime.now().toUtc().subtract(const Duration(minutes: 1));
      await database.customStatement(
        'UPDATE reminder_occurrences SET scheduled_at = ?, original_scheduled_at = ?',
        [dueAt, dueAt],
      );
      await repository.recoverOverdueReminders(reason: 'integration-test');
      final reminder = await repository.nextScheduledReminder();
      expect(reminder?.state, 'DUE');
      await repository.completeReminder(
        reminder!.id,
        'Android completed a real synchronized reminder',
      );
      final reminderWorker = SyncWorker(
        database: database,
        endpoint: endpoint,
        identity: identity,
        identityService: identityService,
        connectivityCheck: () async => [ConnectivityResult.wifi],
        clock: () => DateTime.now().toUtc().add(const Duration(minutes: 5)),
      );
      expect((await reminderWorker.synchronize()).status, 'synced');
      reminderWorker.dispose();
      expect(
        (await database
                .customSelect(
                  "SELECT COUNT(*) AS count FROM outbox_operations WHERE kind = 'reminder.complete' AND acknowledged_at IS NOT NULL",
                )
                .getSingle())
            .read<int>('count'),
        1,
      );
    },
    skip: address.isEmpty
        ? 'FOCUSLOG_INTEGRATION_API_URL is not configured.'
        : false,
  );
}
