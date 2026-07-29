import 'package:flutter/services.dart';
import 'package:timezone/timezone.dart' as tz;

import '../data/mobile_repository.dart';

/// Platform-neutral, privacy-filtered data exported to the Android widget.
/// It deliberately excludes check-in history, credentials, prompts, and tokens.
class WidgetSnapshotPublisher {
  WidgetSnapshotPublisher(this._repository);

  static const _channel = MethodChannel('focuslog/widget');
  final FocusLogRepository _repository;

  Future<void> refresh({String reason = 'local-change'}) async {
    try {
      final timezoneId = await _repository.reportTimezoneId();
      final location = timezoneId == 'UTC' || timezoneId == 'Etc/UTC'
          ? tz.UTC
          : tz.getLocation(timezoneId);
      final local = tz.TZDateTime.from(DateTime.now().toUtc(), location);
      final day =
          '${local.year.toString().padLeft(4, '0')}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
      final report =
          await _repository.dailyReport(day: day, timezoneId: timezoneId);
      final session = await _repository.activeSession();
      final reminder = await _repository.nextScheduledReminder();
      final now = DateTime.now().toUtc();
      final currentActivity = report.mostCommonActivity;
      await _channel.invokeMethod<void>('writeSnapshot', <String, Object?>{
        'schemaVersion': 1,
        'profileId': _repository.identity.ownerId,
        'createdAt': now.toIso8601String(),
        'dataFreshnessAt': now.toIso8601String(),
        'localDate': day,
        'timezoneId': timezoneId,
        'dailyCompletionPercentage': report.completionPercentage,
        'logsToday': report.timeline.where((item) => item.kind == 'CHECK_IN').length,
        'focusDurationMinutes': report.totalTrackedMinutes,
        'focusScore': report.focusScore,
        'activeSessionName': session?.name,
        'activeSessionStatus': session?.status,
        'activeSessionStartedAt': session?.startedAt.toUtc().toIso8601String(),
        'nextReminderAt': reminder?.dueAt.toUtc().toIso8601String(),
        'timeUntilNextReminderMinutes': reminder == null
            ? null
            : reminder.dueAt
                .toUtc()
                .difference(now)
                .inMinutes
                .clamp(0, 1 << 30)
                .toInt(),
        'currentActivity': currentActivity,
        // Android has no persisted AI-memory store yet; no AI request is ever made here.
        'latestInsight': null,
        'offline': report.queuedOperations > 0,
        'pendingSync': report.queuedOperations > 0,
        'refreshReason': reason,
      });
    } catch (_) {
      // Widget refresh is best-effort; application writes remain authoritative.
    }
  }
}
