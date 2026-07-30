import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/ai/mobile_ai_repository.dart';
import 'package:focuslog_mobile/main.dart';
import 'package:focuslog_mobile/data/database/app_database.dart';
import 'package:focuslog_mobile/data/mobile_repository.dart';
import 'package:focuslog_mobile/reminders/reminder_scheduler.dart';
import 'package:focuslog_mobile/identity/device_identity.dart';
import 'package:focuslog_mobile/widgets/widget_snapshot.dart';
import 'package:drift/native.dart';

class _TestScheduler implements ReminderScheduler {
  @override
  Stream<String> get notificationTaps => const Stream<String>.empty();
  @override
  Future<String?> launchedOccurrence() async => null;
  @override
  Future<void> cancel(String occurrenceId) async {}
  @override
  Future<void> beginPresentation(String occurrenceId) async {}
  @override
  Future<void> endPresentation(String occurrenceId) async {}
  @override
  Future<void> recoverAfterStartup() async {}
  @override
  Future<void> recoverAfterWake() async {}
  @override
  Future<void> schedule(String occurrenceId, DateTime dueAt) async {}
}

void main() {
  testWidgets('shows the mobile application shell',
      (WidgetTester tester) async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    final identity = DeviceIdentity(
        ownerId: '0123456789ABCDEFGHJKMNPQRS',
        deviceId: '0123456789ABCDEFGHJKMNPQRT',
        publicKeyPem: 'test',
        privateKey: const [],
        publicKey: const []);
    await tester.pumpWidget(FocusLogApp(
        repository: FocusLogRepository(database, identity),
        aiRepository: MobileAIRepository(database, identity),
        scheduler: _TestScheduler(),
        widgetPublisher:
            WidgetSnapshotPublisher(FocusLogRepository(database, identity))));

    expect(find.text('FocusLog'), findsOneWidget);
    expect(find.text('Start focus session'), findsOneWidget);
  });
}
