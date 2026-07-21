import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/reminders/android_reminder_scheduler.dart';

void main() {
  test('notification IDs are deterministic across process recovery', () {
    expect(
      reminderNotificationId('01HZY7F9Q4A2B3C4D5E6F7G8H9'),
      1518008164,
    );
    expect(reminderNotificationId('occurrence-alpha'), 368808241);
    expect(reminderNotificationId('occurrence-beta'), 1300906885);
  });
}
