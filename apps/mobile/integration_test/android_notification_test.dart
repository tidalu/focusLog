import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('posts and clears a real Android reminder notification',
      (tester) async {
    final notifications = FlutterLocalNotificationsPlugin();
    const initialization = InitializationSettings(
      android: AndroidInitializationSettings('@drawable/ic_notification'),
    );
    await notifications.initialize(initialization);
    final android = notifications.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await android?.requestNotificationsPermission();

    const notificationId = 9026;
    await notifications.show(
      notificationId,
      'FocusLog check-in',
      'Open FocusLog to record what you are doing.',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'focuslog_reminders',
          'FocusLog reminders',
          channelDescription: 'Focus session check-in reminders',
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
      payload: 'integration-reminder',
    );
    await tester.pump(const Duration(seconds: 2));

    final active = await notifications.getActiveNotifications();
    expect(active.map((notification) => notification.id),
        contains(notificationId));

    await notifications.cancel(notificationId);
    await tester.pump(const Duration(seconds: 1));
    final remaining = await notifications.getActiveNotifications();
    expect(
      remaining.map((notification) => notification.id),
      isNot(contains(notificationId)),
    );
  });
}
