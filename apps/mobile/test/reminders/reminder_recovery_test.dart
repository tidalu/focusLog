import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/data/database/app_database.dart';
import 'package:focuslog_mobile/data/mobile_repository.dart';
import 'package:focuslog_mobile/identity/device_identity.dart';

void main() {
  DeviceIdentity identity() => DeviceIdentity(
        ownerId: '0123456789ABCDEFGHJKMNPQRS',
        deviceId: '0123456789ABCDEFGHJKMNPQRT',
        publicKeyPem: 'test-key',
        privateKey: const [],
        publicKey: const [],
      );

  test('restart recovery creates one durable due transition', () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = FocusLogRepository(database, identity());
    await repository.startFocusSession();
    final dueAt = DateTime.now().toUtc().subtract(const Duration(minutes: 1));
    await database.customStatement(
      'UPDATE reminder_occurrences SET scheduled_at = ?, original_scheduled_at = ?',
      [dueAt, dueAt],
    );

    await repository.recoverOverdueReminders(reason: 'process-start');
    final restartedRepository = FocusLogRepository(database, identity());
    await restartedRepository.recoverOverdueReminders(reason: 'process-restart');

    expect(
      (await database.customSelect('SELECT state FROM reminder_occurrences').getSingle())
          .read<String>('state'),
      'DUE',
    );
    expect(
      (await database.customSelect(
        "SELECT COUNT(*) AS count FROM reminder_transitions WHERE to_state = 'DUE'",
      ).getSingle()).read<int>('count'),
      1,
    );
  });

  test('offline completion enforces 20 characters and queues reminder.complete', () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = FocusLogRepository(database, identity());
    await repository.startFocusSession();
    final dueAt = DateTime.now().toUtc().subtract(const Duration(minutes: 1));
    await database.customStatement(
      'UPDATE reminder_occurrences SET scheduled_at = ?, original_scheduled_at = ?',
      [dueAt, dueAt],
    );
    await repository.recoverOverdueReminders(reason: 'test');
    final reminder = await repository.nextScheduledReminder();

    await expectLater(
      repository.completeReminder(reminder!.id, 'too short'),
      throwsArgumentError,
    );
    await repository.completeReminder(
      reminder.id,
      'Android offline reminder completion text',
    );
    expect(
      (await database.customSelect(
        "SELECT COUNT(*) AS count FROM outbox_operations WHERE kind = 'reminder.complete' AND acknowledged_at IS NULL",
      ).getSingle()).read<int>('count'),
      1,
    );
    expect(
      (await database.customSelect(
        'SELECT COUNT(*) AS count FROM check_ins',
      ).getSingle()).read<int>('count'),
      1,
    );
  });

  test('expired scheduled reminders are marked missed and recurring scheduling recovers', () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final repository = FocusLogRepository(database, identity());
    await repository.startFocusSession();
    final dueAt = DateTime.now().toUtc().subtract(const Duration(hours: 2));
    await database.customStatement(
      'UPDATE reminder_occurrences SET scheduled_at = ?, original_scheduled_at = ?',
      [dueAt, dueAt],
    );
    await repository.recoverOverdueReminders(reason: 'reboot');
    expect(
      (await database.customSelect(
        "SELECT COUNT(*) AS count FROM reminder_occurrences WHERE state = 'MISSED'",
      ).getSingle()).read<int>('count'),
      1,
    );
    expect((await repository.scheduledReminders()).length, 1);
  });
}
