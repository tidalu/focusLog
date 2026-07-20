import 'package:drift/drift.dart' hide isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/data/database/app_database.dart';
import 'package:focuslog_mobile/data/mobile_repository.dart';
import 'package:focuslog_mobile/identity/device_identity.dart';

void main() {
  Future<(AppDatabase, FocusLogRepository)> fixture() async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    final repository = FocusLogRepository(
      database,
      DeviceIdentity(
        ownerId: 'owner',
        deviceId: 'device',
        publicKeyPem: 'public-key',
        privateKey: const [1],
        publicKey: const [2],
      ),
    );
    await repository.ensureIdentity();
    return (database, repository);
  }

  test('defaults to 15 minutes and validates the supported custom range',
      () async {
    final (database, repository) = await fixture();
    addTearDown(database.close);

    expect(await repository.reminderIntervalMinutes(), 15);
    await expectLater(
        repository.setReminderInterval(4), throwsA(isA<ArgumentError>()));
    await expectLater(
        repository.setReminderInterval(241), throwsA(isA<ArgumentError>()));
    expect(await repository.setReminderInterval(45), 45);
    expect(await repository.reminderIntervalMinutes(), 45);
  });

  test('changing the interval reschedules an active future reminder', () async {
    final (database, repository) = await fixture();
    addTearDown(database.close);
    await repository.startFocusSession();
    final original = await repository.nextScheduledReminder();

    await repository.setReminderInterval(25);

    final replacement = await repository.nextScheduledReminder();
    expect(replacement, isNotNull);
    expect(replacement!.id, isNot(original!.id));
    expect(
      replacement.dueAt.difference(DateTime.now().toUtc()).inMinutes,
      inInclusiveRange(24, 25),
    );
    final superseded = await database.customSelect(
      'SELECT state FROM reminder_occurrences WHERE id = ?',
      variables: [Variable.withString(original.id)],
    ).getSingle();
    expect(superseded.read<String>('state'), 'SUPERSEDED');
  });
}
