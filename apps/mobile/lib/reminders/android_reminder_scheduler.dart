import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:workmanager/workmanager.dart';

import 'reminder_scheduler.dart';
import '../data/database/app_database.dart';
import '../data/mobile_repository.dart';
import '../identity/device_identity.dart';
import '../sync/sync_worker.dart';

const _channelId = 'focuslog_reminders';
const _channelName = 'FocusLog reminders';

/// Uses standard Android notifications and WorkManager. It deliberately does
/// not attempt to defeat battery optimization, force-stop, or notification
/// permission controls; recovery occurs the next time Android permits work.
class AndroidReminderScheduler implements ReminderScheduler {
  AndroidReminderScheduler(this._notifications);
  final FlutterLocalNotificationsPlugin _notifications;
  final _notificationTaps = StreamController<String>.broadcast();

  @override
  Stream<String> get notificationTaps => _notificationTaps.stream;

  Future<void> initialize() async {
    const settings = InitializationSettings(
        android: AndroidInitializationSettings('@drawable/ic_notification'));
    await _notifications.initialize(
      settings,
      onDidReceiveNotificationResponse: (response) {
        final occurrenceId = response.payload;
        if (occurrenceId != null && occurrenceId.isNotEmpty) {
          _notificationTaps.add(occurrenceId);
        }
      },
    );
    final android = _notifications.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await android?.requestNotificationsPermission();
    await android?.requestFullScreenIntentPermission();
    await Workmanager()
        .initialize(backgroundCallbackDispatcher, isInDebugMode: false);
    await Workmanager().registerPeriodicTask(
      'focuslog-periodic-recovery',
      'focuslog-recovery',
      frequency: const Duration(minutes: 15),
      existingWorkPolicy: ExistingWorkPolicy.keep,
    );
  }

  @override
  Future<String?> launchedOccurrence() async {
    final details = await _notifications.getNotificationAppLaunchDetails();
    return details?.didNotificationLaunchApp == true
        ? details?.notificationResponse?.payload
        : null;
  }

  @override
  Future<void> schedule(String occurrenceId, DateTime dueAt) async {
    final id = occurrenceId.hashCode & 0x7fffffff;
    await _notifications.zonedSchedule(
      id,
      'FocusLog check-in',
      'Open FocusLog to record what you are doing.',
      tz.TZDateTime.from(dueAt, tz.local),
      const NotificationDetails(
          android: AndroidNotificationDetails(_channelId, _channelName,
              channelDescription: 'Focus session check-in reminders',
              importance: Importance.max,
              priority: Priority.max,
              category: AndroidNotificationCategory.reminder,
              visibility: NotificationVisibility.public,
              fullScreenIntent: true,
              ongoing: true,
              autoCancel: false)),
      // flutter_local_notifications delegates this durable alarm to Android's
      // AlarmManager. Inexact allow-while-idle avoids demanding restricted
      // exact-alarm privileges while WorkManager supplies reconciliation.
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      payload: occurrenceId,
    );
  }

  @override
  Future<void> cancel(String occurrenceId) =>
      _notifications.cancel(occurrenceId.hashCode & 0x7fffffff);

  @override
  Future<void> beginPresentation(String occurrenceId) async {
    final android = _notifications.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await android?.startForegroundService(
      occurrenceId.hashCode & 0x7fffffff,
      'FocusLog check-in is due',
      'Return to FocusLog and submit a response to complete this interval.',
      notificationDetails: const AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: 'Focus session check-in reminders',
        importance: Importance.max,
        priority: Priority.max,
        category: AndroidNotificationCategory.reminder,
        visibility: NotificationVisibility.public,
        ongoing: true,
        autoCancel: false,
      ),
      payload: occurrenceId,
      startType: AndroidServiceStartType.startSticky,
      foregroundServiceTypes: {
        AndroidServiceForegroundType.foregroundServiceTypeSpecialUse,
      },
    );
  }

  @override
  Future<void> endPresentation(String occurrenceId) async {
    final android = _notifications.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await android?.stopForegroundService();
    await cancel(occurrenceId);
  }

  @override
  Future<void> recoverAfterStartup() => Workmanager().registerOneOffTask(
        'focuslog-startup-recovery',
        'focuslog-recovery',
        existingWorkPolicy: ExistingWorkPolicy.replace,
      );

  @override
  Future<void> recoverAfterWake() => Workmanager().registerOneOffTask(
        'focuslog-wake-recovery',
        'focuslog-recovery',
        existingWorkPolicy: ExistingWorkPolicy.replace,
      );

  Future<void> dispose() async => _notificationTaps.close();
}

@pragma('vm:entry-point')
void backgroundCallbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    if (task != 'focuslog-recovery') return true;
    WidgetsFlutterBinding.ensureInitialized();
    final databaseKey = await DatabaseKeyService().loadOrCreate();
    final database = AppDatabase.encrypted(databaseKey);
    try {
      final identity = await DeviceIdentityService().loadOrCreate();
      final repository = FocusLogRepository(database, identity);
      await repository.ensureIdentity();
      await repository.recoverOverdueReminders(reason: 'workmanager');
      const address = String.fromEnvironment('FOCUSLOG_API_URL');
      if (address.isEmpty) return true;
      final worker = SyncWorker(
        database: database,
        endpoint: Uri.parse(address),
        identity: identity,
      );
      final result = await worker.synchronize();
      worker.dispose();
      final notifications = FlutterLocalNotificationsPlugin();
      for (final occurrenceId in await repository.resolvedReminderIds()) {
        await notifications.cancel(occurrenceId.hashCode & 0x7fffffff);
      }
      return result.status != 'retrying';
    } finally {
      await database.close();
    }
  });
}
