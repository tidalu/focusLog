import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;
import 'package:workmanager/workmanager.dart';

import 'reminder_scheduler.dart';
import '../data/database/app_database.dart';
import '../data/mobile_repository.dart';
import '../identity/device_identity.dart';
import '../sync/sync_worker.dart';

const _channelId = 'focuslog_reminders';
const _channelName = 'FocusLog reminders';

const _initializationSettings = InitializationSettings(
  android: AndroidInitializationSettings('@drawable/ic_notification'),
);

const _reminderDetails = NotificationDetails(
  android: AndroidNotificationDetails(
    _channelId,
    _channelName,
    channelDescription: 'Focus session check-in reminders',
    importance: Importance.max,
    priority: Priority.max,
    category: AndroidNotificationCategory.reminder,
    visibility: NotificationVisibility.public,
    fullScreenIntent: true,
    ongoing: true,
    autoCancel: false,
  ),
);

/// Stable across Dart processes so reboot recovery updates and cancels the
/// original Android notification instead of creating a duplicate.
int reminderNotificationId(String occurrenceId) {
  var hash = 0x811c9dc5;
  for (final byte in occurrenceId.codeUnits) {
    hash ^= byte;
    hash = (hash * 0x01000193) & 0xffffffff;
  }
  return hash & 0x7fffffff;
}

Future<bool> _canScheduleExact(
    FlutterLocalNotificationsPlugin notifications) async {
  final android = notifications.resolvePlatformSpecificImplementation<
      AndroidFlutterLocalNotificationsPlugin>();
  return await android?.canScheduleExactNotifications() ?? false;
}

Future<void> _scheduleNotification(
  FlutterLocalNotificationsPlugin notifications,
  String occurrenceId,
  DateTime dueAt,
) async {
  final exact = await _canScheduleExact(notifications);
  final now = DateTime.now();
  final notificationTime =
      dueAt.isAfter(now) ? dueAt : now.add(const Duration(seconds: 1));
  await notifications.zonedSchedule(
    reminderNotificationId(occurrenceId),
    'FocusLog check-in',
    'Open FocusLog to record what you are doing.',
    tz.TZDateTime.from(notificationTime, tz.local),
    _reminderDetails,
    androidScheduleMode: exact
        ? AndroidScheduleMode.exactAllowWhileIdle
        : AndroidScheduleMode.inexactAllowWhileIdle,
    payload: occurrenceId,
  );
}

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
    await _notifications.initialize(
      _initializationSettings,
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
    if (await android?.canScheduleExactNotifications() == false) {
      await android?.requestExactAlarmsPermission();
    }
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
  Future<void> schedule(String occurrenceId, DateTime dueAt) =>
      _scheduleNotification(_notifications, occurrenceId, dueAt);

  @override
  Future<void> cancel(String occurrenceId) =>
      _notifications.cancel(reminderNotificationId(occurrenceId));

  @override
  Future<void> beginPresentation(String occurrenceId) async {
    final android = _notifications.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await android?.startForegroundService(
      reminderNotificationId(occurrenceId),
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
    tzdata.initializeTimeZones();
    final databaseKey = await DatabaseKeyService().loadOrCreate();
    final database = AppDatabase.encrypted(databaseKey);
    try {
      final identity = await DeviceIdentityService().loadOrCreate();
      final repository = FocusLogRepository(database, identity);
      await repository.ensureIdentity();
      await repository.recoverOverdueReminders(reason: 'workmanager');
      final notifications = FlutterLocalNotificationsPlugin();
      await notifications.initialize(_initializationSettings);
      for (final reminder in await repository.scheduledReminders()) {
        await _scheduleNotification(notifications, reminder.id, reminder.dueAt);
      }
      const address = String.fromEnvironment('FOCUSLOG_API_URL');
      if (address.isEmpty) return true;
      final worker = SyncWorker(
        database: database,
        endpoint: Uri.parse(address),
        identity: identity,
      );
      final result = await worker.synchronize();
      worker.dispose();
      for (final occurrenceId in await repository.resolvedReminderIds()) {
        await notifications.cancel(reminderNotificationId(occurrenceId));
      }
      return result.status != 'retrying';
    } finally {
      await database.close();
    }
  });
}
