import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/reminders/reminder_scheduler.dart';

void main() {
  test('requires 20 Unicode characters for completion', () {
    expect(ReminderDraft('occurrence', 'short').canComplete, isFalse);
    expect(ReminderDraft('occurrence', 'Writing the release notes').canComplete,
        isTrue);
  });
}
