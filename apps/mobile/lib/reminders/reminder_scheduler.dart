import 'dart:async';

/// Platform boundary for Android alarms, notification channels, and permitted
/// foreground-service execution. Implementations must use Android-approved APIs.
abstract class ReminderScheduler {
  Stream<String> get notificationTaps;
  Future<String?> launchedOccurrence();
  Future<void> schedule(String occurrenceId, DateTime dueAt);
  Future<void> cancel(String occurrenceId);
  Future<void> recoverAfterStartup();
  Future<void> recoverAfterWake();
}

class ReminderDraft {
  const ReminderDraft(this.occurrenceId, this.text);
  final String occurrenceId;
  final String text;

  bool get canComplete => text.trim().runes.length >= 20;
}
