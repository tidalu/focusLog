import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:timezone/timezone.dart' as tz;
import 'database/app_database.dart';
import '../identity/device_identity.dart';

const defaultReminderPolicy = <String, Object>{
  'cadence': 'FIXED_FROM_SESSION_START',
  'intervalMinutes': 30,
  'responseWindowMinutes': 60,
  'snoozeMinutes': <int>[5, 10, 15],
  'maxSnoozes': 3,
  'allowLateCompletion': true,
};

class _ReportDayBounds {
  const _ReportDayBounds(this.day, this.civilDate, this.start, this.end);
  final String day;
  final DateTime civilDate;
  final DateTime start;
  final DateTime end;
}

String _civilDay(DateTime date) => '${date.year.toString().padLeft(4, '0')}-'
    '${date.month.toString().padLeft(2, '0')}-'
    '${date.day.toString().padLeft(2, '0')}';

tz.Location _reportLocation(String timezoneId) {
  if (timezoneId == 'UTC' || timezoneId == 'Etc/UTC') return tz.UTC;
  try {
    return tz.getLocation(timezoneId);
  } catch (_) {
    throw ArgumentError('Invalid IANA report timezone.');
  }
}

_ReportDayBounds _reportDayBounds(String day, String timezoneId) {
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(day);
  if (match == null || timezoneId.trim().isEmpty) {
    throw ArgumentError('Invalid report day or timezone.');
  }
  final civil = DateTime.utc(
    int.parse(match.group(1)!),
    int.parse(match.group(2)!),
    int.parse(match.group(3)!),
  );
  if (_civilDay(civil) != day || civil.year < 1970 || civil.year > 9999) {
    throw ArgumentError('Invalid report day.');
  }
  final location = _reportLocation(timezoneId);
  final nextCivil = civil.add(const Duration(days: 1));
  final start = tz.TZDateTime(
    location,
    civil.year,
    civil.month,
    civil.day,
  ).toUtc();
  final end = tz.TZDateTime(
    location,
    nextCivil.year,
    nextCivil.month,
    nextCivil.day,
  ).toUtc();
  return _ReportDayBounds(day, civil, start, end);
}

String _localDay(DateTime instant, String timezoneId) {
  final local =
      tz.TZDateTime.from(instant.toUtc(), _reportLocation(timezoneId));
  return _civilDay(DateTime.utc(local.year, local.month, local.day));
}

class FocusSessionSummary {
  const FocusSessionSummary(this.id, this.name, this.startedAt);
  final String id;
  final String name;
  final DateTime startedAt;
}

class CheckInSummary {
  const CheckInSummary(this.id, this.body, this.submittedAt);
  final String id;
  final String body;
  final DateTime submittedAt;
}

class SearchFilterChoice {
  const SearchFilterChoice(this.id, this.name);
  final String id;
  final String name;
}

class SearchFilterOptions {
  const SearchFilterOptions(
      {required this.tags, required this.categories, required this.sessions});
  final List<SearchFilterChoice> tags;
  final List<SearchFilterChoice> categories;
  final List<SearchFilterChoice> sessions;
}

class ReportTimelineItem {
  const ReportTimelineItem({
    required this.id,
    required this.kind,
    required this.occurredAt,
    required this.title,
    required this.detail,
    this.originalTimezoneId,
  });
  final String id;
  final String kind;
  final DateTime occurredAt;
  final String title;
  final String detail;
  final String? originalTimezoneId;
}

class ReminderSummary {
  const ReminderSummary(this.id, this.dueAt, this.state);
  final String id;
  final DateTime dueAt;
  final String state;
}

class DailyReport {
  const DailyReport(
      {required this.day,
      required this.timezoneId,
      required this.dayDurationMinutes,
      required this.completedIntervals,
      required this.missedIntervals,
      required this.totalTrackedMinutes,
      required this.focusScore,
      required this.categories,
      required this.occurrenceStates,
      required this.timeline,
      required this.weekly,
      required this.monthly,
      required this.yearly,
      required this.queuedOperations});
  final String day;
  final String timezoneId;
  final int dayDurationMinutes;
  final int completedIntervals;
  final int missedIntervals;
  final int totalTrackedMinutes;
  final int focusScore;
  final Map<String, int> categories;
  final Map<String, int> occurrenceStates;
  final List<ReportTimelineItem> timeline;
  final int weekly;
  final int monthly;
  final int yearly;
  final int queuedOperations;
}

class HeatmapDay {
  const HeatmapDay(this.day, this.value, this.intensity);
  final String day;
  final int value;
  final int intensity;
}

class YearHeatmap {
  const YearHeatmap({
    required this.year,
    required this.timezoneId,
    required this.thresholds,
    required this.days,
  });
  final int year;
  final String timezoneId;
  final List<int> thresholds;
  final List<HeatmapDay> days;
  String get metricDescription =>
      'Activity is completed check-ins. Levels 1–4 use quartiles across active days in this year.';
}

class FocusLogRepository {
  FocusLogRepository(this.database, this.identity);
  final AppDatabase database;
  final DeviceIdentity identity;
  String get _ownerId => identity.ownerId;
  String get _deviceId => identity.deviceId;

  Future<void> ensureIdentity() async {
    final now = DateTime.now().toUtc();
    await database.customStatement(
      'INSERT OR IGNORE INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)',
      [_ownerId, now, now],
    );
    await database.customStatement(
      "INSERT OR IGNORE INTO devices (id, owner_id, public_key, fingerprint, platform, display_name, is_owner_device, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'ANDROID', 'This Android device', 0, 'ACTIVE', ?, ?)",
      [
        _deviceId,
        _ownerId,
        identity.publicKeyPem,
        identity.fingerprint,
        now,
        now
      ],
    );
    await database.customStatement(
      'INSERT OR IGNORE INTO settings '
      '(owner_id, values_json, version, created_at, updated_at) '
      "VALUES (?, '{\"reportTimezoneId\":\"UTC\"}', ?, ?, ?)",
      [_ownerId, generateSyncId(), now, now],
    );
  }

  Future<String> reportTimezoneId() async {
    final row = await database.customSelect(
      'SELECT values_json FROM settings WHERE owner_id = ?',
      variables: [Variable.withString(_ownerId)],
    ).getSingleOrNull();
    if (row == null) return 'UTC';
    try {
      final values =
          jsonDecode(row.read<String>('values_json')) as Map<String, dynamic>;
      final value = values['reportTimezoneId'] as String? ?? 'UTC';
      _reportLocation(value);
      return value;
    } catch (_) {
      return 'UTC';
    }
  }

  Future<void> setReportTimezoneId(String timezoneId) async {
    _reportLocation(timezoneId);
    final row = await database.customSelect(
      'SELECT values_json FROM settings WHERE owner_id = ?',
      variables: [Variable.withString(_ownerId)],
    ).getSingleOrNull();
    final values = <String, dynamic>{};
    if (row != null) {
      try {
        values.addAll(jsonDecode(row.read<String>('values_json'))
            as Map<String, dynamic>);
      } catch (_) {
        // Replace malformed local settings without affecting user content.
      }
    }
    values['reportTimezoneId'] = timezoneId;
    final now = DateTime.now().toUtc();
    await database.customStatement(
      'INSERT INTO settings '
      '(owner_id, values_json, version, created_at, updated_at) '
      'VALUES (?, ?, ?, ?, ?) '
      'ON CONFLICT(owner_id) DO UPDATE SET values_json = excluded.values_json, '
      'version = excluded.version, updated_at = excluded.updated_at',
      [_ownerId, jsonEncode(values), generateSyncId(), now, now],
    );
  }

  /// A paired device adopts the single owner's identifier only before it has
  /// created local user content. This prevents an accidental owner change from
  /// silently relabelling offline work.
  Future<void> adoptPairedOwner(
      String pairedOwnerId, DeviceIdentityService identityService) async {
    if (pairedOwnerId == _ownerId) return;
    final content = await database.customSelect(
      'SELECT (SELECT COUNT(*) FROM check_ins WHERE owner_id = ?) + (SELECT COUNT(*) FROM focus_sessions WHERE owner_id = ?) + (SELECT COUNT(*) FROM outbox_operations WHERE owner_id = ?) AS count',
      variables: [
        Variable.withString(_ownerId),
        Variable.withString(_ownerId),
        Variable.withString(_ownerId)
      ],
    ).getSingle();
    if (content.read<int>('count') > 0) {
      throw StateError(
          'This device has offline work. Synchronize or export it before pairing to another owner.');
    }
    final previousOwnerId = _ownerId;
    final now = DateTime.now().toUtc();
    const ownerTables = [
      'devices',
      'device_pairings',
      'focus_modes',
      'focus_sessions',
      'reminder_occurrences',
      'reminder_transitions',
      'categories',
      'check_ins',
      'tags',
      'sync_operations',
      'sync_cursors',
      'outbox_operations',
      'conflicts',
      'backup_manifests',
      'settings',
      'tombstones'
    ];
    await database.transaction(() async {
      await database.customStatement(
          'INSERT OR IGNORE INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)',
          [pairedOwnerId, now, now]);
      for (final table in ownerTables) {
        await database.customStatement(
            'UPDATE $table SET owner_id = ? WHERE owner_id = ?',
            [pairedOwnerId, previousOwnerId]);
      }
      await database.customStatement(
          'DELETE FROM owners WHERE id = ?', [previousOwnerId]);
    });
    identity.ownerId = pairedOwnerId;
    await identityService.save(identity);
  }

  Future<FocusSessionSummary?> activeSession() async {
    final row = await database.customSelect(
      "SELECT id, name, started_at FROM focus_sessions WHERE owner_id = ? AND status = 'ACTIVE' ORDER BY started_at DESC LIMIT 1",
      variables: [Variable.withString(_ownerId)],
    ).getSingleOrNull();
    if (row == null) return null;
    return FocusSessionSummary(
        row.read<String>('id'),
        row.readNullable<String>('name') ?? 'Focus session',
        row.read<DateTime>('started_at'));
  }

  Future<FocusSessionSummary> startFocusSession(
      {int intervalMinutes = 30}) async {
    await ensureIdentity();
    final now = DateTime.now().toUtc();
    final existingMode = await database.customSelect(
      "SELECT id FROM focus_modes WHERE owner_id = ? AND name = 'Default focus'",
      variables: [Variable.withString(_ownerId)],
    ).getSingleOrNull();
    final modeId = existingMode?.read<String>('id') ?? generateSyncId();
    final sessionId = generateSyncId();
    final dueAt = now.add(Duration(minutes: intervalMinutes));
    final policy = <String, Object>{
      ...defaultReminderPolicy,
      'intervalMinutes': intervalMinutes
    };
    final policyJson = jsonEncode(policy);
    final reminderId = generateSyncId();
    await database.transaction(() async {
      await database.customStatement(
        "INSERT OR IGNORE INTO focus_modes (id, owner_id, name, interval_minutes, policy_json, version, created_at, updated_at) VALUES (?, ?, 'Default focus', ?, ?, ?, ?, ?)",
        [
          modeId,
          _ownerId,
          intervalMinutes,
          policyJson,
          generateSyncId(),
          now,
          now
        ],
      );
      await database.customStatement(
        "INSERT INTO focus_sessions (id, owner_id, focus_mode_id, name, status, schedule_policy_json, timezone_id, started_at, version, created_at, updated_at) VALUES (?, ?, ?, 'Focus session', 'ACTIVE', ?, 'UTC', ?, ?, ?, ?)",
        [
          sessionId,
          _ownerId,
          modeId,
          policyJson,
          now,
          generateSyncId(),
          now,
          now
        ],
      );
      await database.customStatement(
        "INSERT INTO reminder_occurrences (id, owner_id, focus_session_id, state, scheduled_at, original_scheduled_at, timezone_id, policy_snapshot_json, version, created_at, updated_at) VALUES (?, ?, ?, 'SCHEDULED', ?, ?, 'UTC', ?, ?, ?, ?)",
        [
          reminderId,
          _ownerId,
          sessionId,
          dueAt,
          dueAt,
          policyJson,
          generateSyncId(),
          now,
          now
        ],
      );
      await _queueReminderSchedule(reminderId, now);
    });
    return FocusSessionSummary(sessionId, 'Focus session', now);
  }

  Future<ReminderSummary?> nextScheduledReminder() async {
    final row = await database.customSelect(
        "SELECT id, scheduled_at, state FROM reminder_occurrences WHERE owner_id = ? AND state IN ('SCHEDULED', 'DUE', 'PRESENTED', 'SNOOZED') ORDER BY scheduled_at LIMIT 1",
        variables: [Variable.withString(_ownerId)]).getSingleOrNull();
    if (row == null) return null;
    return ReminderSummary(row.read<String>('id'),
        row.read<DateTime>('scheduled_at'), row.read<String>('state'));
  }

  Future<List<ReminderSummary>> scheduledReminders() async {
    final rows = await database.customSelect(
      "SELECT id, scheduled_at, state FROM reminder_occurrences WHERE owner_id = ? AND state IN ('SCHEDULED','SNOOZED') ORDER BY scheduled_at",
      variables: [Variable.withString(_ownerId)],
    ).get();
    return rows
        .map((row) => ReminderSummary(
              row.read<String>('id'),
              row.read<DateTime>('scheduled_at'),
              row.read<String>('state'),
            ))
        .toList();
  }

  Future<List<String>> resolvedReminderIds() async {
    final rows = await database.customSelect(
      "SELECT id FROM reminder_occurrences WHERE owner_id = ? AND state IN ('COMPLETED','MISSED','SKIPPED','EMERGENCY_DISMISSED','SUPERSEDED')",
      variables: [Variable.withString(_ownerId)],
    ).get();
    return rows.map((row) => row.read<String>('id')).toList();
  }

  Future<void> recoverOverdueReminders({String reason = 'startup'}) async {
    final now = DateTime.now().toUtc();
    final rows = await database.customSelect(
      "SELECT id, state, scheduled_at, policy_snapshot_json FROM reminder_occurrences WHERE owner_id = ? AND ((state IN ('SCHEDULED','SNOOZED') AND scheduled_at <= ?) OR state IN ('DUE','PRESENTED')) ORDER BY scheduled_at",
      variables: [Variable.withString(_ownerId), Variable.withDateTime(now)],
    ).get();
    for (final row in rows) {
      final state = row.read<String>('state');
      final dueAt = row.read<DateTime>('scheduled_at');
      final policy = _policy(row.read<String>('policy_snapshot_json'));
      final responseWindow = policy['responseWindowMinutes'] as int;
      final allowLate = policy['allowLateCompletion'] as bool;
      if (now.isAfter(dueAt.add(Duration(minutes: responseWindow))) &&
          (state == 'SCHEDULED' || state == 'SNOOZED' || !allowLate)) {
        if (state == 'SCHEDULED' || state == 'SNOOZED') {
          await _transitionReminder(
            row.read<String>('id'),
            'DUE',
            reason: 'recovery:$reason:overdue',
            occurredAt: now,
          );
        }
        await _transitionReminder(
          row.read<String>('id'),
          'MISSED',
          reason: 'recovery:$reason:response-window-expired',
          occurredAt: now,
        );
        await _ensureNextOccurrence(row.read<String>('id'), now);
      } else if (state == 'SCHEDULED' || state == 'SNOOZED') {
        await _transitionReminder(
          row.read<String>('id'),
          'DUE',
          reason: 'recovery:$reason',
          occurredAt: now,
        );
      }
    }
  }

  Future<void> stopFocusSession() async {
    final active = await activeSession();
    if (active == null) return;
    final now = DateTime.now().toUtc();
    await database.transaction(() async {
      await database.customStatement(
          "UPDATE focus_sessions SET status = 'COMPLETED', ended_at = ?, updated_at = ? WHERE id = ?",
          [now, now, active.id]);
    });
  }

  Future<List<CheckInSummary>> history(
    String search, {
    String? tagId,
    String? categoryId,
    String? sessionId,
  }) async {
    final terms = search
        .trim()
        .split(RegExp(r'\s+'))
        .where((term) => term.isNotEmpty)
        .map((term) => '"${term.replaceAll('"', '""')}"*')
        .join(' AND ');
    final clauses = <String>[
      'check_ins.owner_id = ?',
      'check_ins.deleted_at IS NULL',
      'check_in_revisions.deleted_at IS NULL',
    ];
    final variables = <Variable<Object>>[Variable.withString(_ownerId)];
    if (categoryId != null) {
      clauses.add('check_ins.category_id = ?');
      variables.add(Variable.withString(categoryId));
    }
    if (sessionId != null) {
      clauses.add('check_ins.focus_session_id = ?');
      variables.add(Variable.withString(sessionId));
    }
    if (tagId != null) {
      clauses.add(
          'EXISTS (SELECT 1 FROM check_in_tags WHERE check_in_tags.check_in_id = check_ins.id AND check_in_tags.tag_id = ?)');
      variables.add(Variable.withString(tagId));
    }
    if (terms.isNotEmpty) {
      clauses.add('check_in_revisions_fts MATCH ?');
      variables.add(Variable.withString(terms));
    }
    final rank = terms.isEmpty ? '0.0' : '-bm25(check_in_revisions_fts, 10.0)';
    final ftsJoin = terms.isEmpty
        ? ''
        : 'JOIN check_in_revisions_fts ON check_in_revisions_fts.rowid = check_in_revisions.rowid';
    final rows = await database
        .customSelect(
          'SELECT check_ins.id, check_in_revisions.body, check_ins.submitted_at, $rank AS rank '
          'FROM check_ins '
          'JOIN check_in_revisions ON check_in_revisions.id = check_ins.current_revision_id '
          '$ftsJoin WHERE ${clauses.join(' AND ')} '
          'ORDER BY rank DESC, check_ins.submitted_at DESC, check_ins.id LIMIT 100',
          variables: variables,
        )
        .get();
    return rows
        .map((row) => CheckInSummary(row.read<String>('id'),
            row.read<String>('body'), row.read<DateTime>('submitted_at')))
        .toList();
  }

  Future<SearchFilterOptions> searchFilterOptions() async {
    Future<List<SearchFilterChoice>> load(String sql) async {
      final rows = await database.customSelect(
        sql,
        variables: [Variable.withString(_ownerId)],
      ).get();
      return rows
          .map((row) => SearchFilterChoice(
              row.read<String>('id'), row.read<String>('name')))
          .toList();
    }

    return SearchFilterOptions(
      tags: await load(
          'SELECT id, name FROM tags WHERE owner_id = ? AND deleted_at IS NULL ORDER BY name, id'),
      categories: await load(
          'SELECT id, name FROM categories WHERE owner_id = ? AND deleted_at IS NULL ORDER BY name, id'),
      sessions: await load(
          "SELECT id, COALESCE(name, 'Focus session') AS name FROM focus_sessions WHERE owner_id = ? AND deleted_at IS NULL ORDER BY started_at DESC, id"),
    );
  }

  Future<DailyReport> dailyReport({
    String? day,
    String timezoneId = 'UTC',
  }) async {
    final bounds = _reportDayBounds(
      day ?? _localDay(DateTime.now().toUtc(), timezoneId),
      timezoneId,
    );
    final occurrences = await database.customSelect(
        'SELECT id, state, scheduled_at, resolved_at, timezone_id '
        'FROM reminder_occurrences WHERE owner_id = ? '
        'AND COALESCE(resolved_at, scheduled_at) >= ? '
        'AND COALESCE(resolved_at, scheduled_at) < ? '
        'ORDER BY COALESCE(resolved_at, scheduled_at), id',
        variables: [
          Variable.withString(_ownerId),
          Variable.withDateTime(bounds.start),
          Variable.withDateTime(bounds.end),
        ]).get();
    final completedCount = occurrences
        .where((row) => row.read<String>('state') == 'COMPLETED')
        .length;
    final missedCount = occurrences
        .where((row) => row.read<String>('state') == 'MISSED')
        .length;
    final sessions = await database.customSelect(
        'SELECT id, name, started_at, ended_at, timezone_id '
        'FROM focus_sessions WHERE owner_id = ? AND deleted_at IS NULL '
        'AND started_at < ? AND (ended_at IS NULL OR ended_at > ?) '
        'ORDER BY started_at',
        variables: [
          Variable.withString(_ownerId),
          Variable.withDateTime(bounds.end),
          Variable.withDateTime(bounds.start),
        ]).get();
    final now = DateTime.now().toUtc();
    var trackedMinutes = 0.0;
    for (final session in sessions) {
      final startedAt = session.read<DateTime>('started_at').toUtc();
      final endedAt =
          session.readNullable<DateTime>('ended_at')?.toUtc() ?? now;
      final clippedStart =
          startedAt.isAfter(bounds.start) ? startedAt : bounds.start;
      var clippedEnd = endedAt.isBefore(bounds.end) ? endedAt : bounds.end;
      if (clippedEnd.isAfter(now)) clippedEnd = now;
      if (clippedEnd.isAfter(clippedStart)) {
        trackedMinutes +=
            clippedEnd.difference(clippedStart).inMilliseconds / 60000;
      }
    }
    final categoryRows = await database.customSelect(
        "SELECT COALESCE(categories.name, 'Uncategorized') AS name, COUNT(*) AS count FROM check_ins LEFT JOIN categories ON categories.id = check_ins.category_id WHERE check_ins.owner_id = ? AND check_ins.submitted_at >= ? AND check_ins.submitted_at < ? GROUP BY COALESCE(categories.name, 'Uncategorized')",
        variables: [
          Variable.withString(_ownerId),
          Variable.withDateTime(bounds.start),
          Variable.withDateTime(bounds.end)
        ]).get();
    Future<int> trend(int days) async {
      final startCivil = DateTime.utc(
        bounds.civilDate.year,
        bounds.civilDate.month,
        bounds.civilDate.day,
      ).subtract(Duration(days: days - 1));
      final start = _reportDayBounds(_civilDay(startCivil), timezoneId).start;
      return (await database.customSelect(
              'SELECT COUNT(*) AS count FROM check_ins '
              'WHERE owner_id = ? AND deleted_at IS NULL '
              'AND submitted_at >= ? AND submitted_at < ?',
              variables: [
            Variable.withString(_ownerId),
            Variable.withDateTime(start),
            Variable.withDateTime(bounds.end),
          ]).getSingle())
          .read<int>('count');
    }

    final total = completedCount + missedCount;
    final queued = (await database
            .customSelect(
                'SELECT COUNT(*) AS count FROM outbox_operations WHERE acknowledged_at IS NULL')
            .getSingle())
        .read<int>('count');
    final timeline = await _completeDayLog(bounds);
    final occurrenceStates = <String, int>{};
    for (final row in occurrences) {
      final state = row.read<String>('state');
      occurrenceStates[state] = (occurrenceStates[state] ?? 0) + 1;
    }
    return DailyReport(
        day: bounds.day,
        timezoneId: timezoneId,
        dayDurationMinutes: bounds.end.difference(bounds.start).inMinutes,
        completedIntervals: completedCount,
        missedIntervals: missedCount,
        totalTrackedMinutes: trackedMinutes.round(),
        focusScore: total == 0 ? 0 : (completedCount * 100 / total).round(),
        categories: {
          for (final row in categoryRows)
            row.read<String>('name'): row.read<int>('count')
        },
        occurrenceStates: occurrenceStates,
        timeline: timeline,
        weekly: await trend(7),
        monthly: await trend(30),
        yearly: await trend(365),
        queuedOperations: queued);
  }

  Future<List<ReportTimelineItem>> dayLog(
    String day, {
    String timezoneId = 'UTC',
  }) {
    return _completeDayLog(_reportDayBounds(day, timezoneId));
  }

  Future<YearHeatmap> heatmap(
    int year, {
    String timezoneId = 'UTC',
  }) async {
    if (year < 1970 || year > 9998) {
      throw ArgumentError('Calendar year must be between 1970 and 9998.');
    }
    final first = _reportDayBounds(
        '${year.toString().padLeft(4, '0')}-01-01', timezoneId);
    final last = _reportDayBounds(
        '${year.toString().padLeft(4, '0')}-12-31', timezoneId);
    final rows = await database.customSelect(
        'SELECT submitted_at FROM check_ins WHERE owner_id = ? '
        'AND deleted_at IS NULL AND submitted_at >= ? AND submitted_at < ? '
        'ORDER BY submitted_at',
        variables: [
          Variable.withString(_ownerId),
          Variable.withDateTime(first.start),
          Variable.withDateTime(last.end),
        ]).get();
    final values = <String, int>{};
    for (final row in rows) {
      final day =
          _localDay(row.read<DateTime>('submitted_at').toUtc(), timezoneId);
      values[day] = (values[day] ?? 0) + 1;
    }
    final civilFirst = DateTime.utc(year, 1, 1);
    final dayCount = DateTime.utc(year + 1, 1, 1).difference(civilFirst).inDays;
    final allDays = List.generate(
      dayCount,
      (index) => _civilDay(civilFirst.add(Duration(days: index))),
    );
    final positive = allDays
        .map((day) => values[day] ?? 0)
        .where((value) => value > 0)
        .toList()
      ..sort();
    int percentile(double fraction) => positive.isEmpty
        ? 0
        : positive[((positive.length * fraction).ceil() - 1)
            .clamp(0, positive.length - 1)];
    final thresholds = [
      percentile(0.25),
      percentile(0.50),
      percentile(0.75),
    ];
    int intensity(int value) {
      if (value == 0) return 0;
      if (value <= thresholds[0]) return 1;
      if (value <= thresholds[1]) return 2;
      if (value <= thresholds[2]) return 3;
      return 4;
    }

    return YearHeatmap(
      year: year,
      timezoneId: timezoneId,
      thresholds: thresholds,
      days: [
        for (final day in allDays)
          HeatmapDay(day, values[day] ?? 0, intensity(values[day] ?? 0)),
      ],
    );
  }

  Future<List<ReportTimelineItem>> _completeDayLog(
      _ReportDayBounds bounds) async {
    final variables = [
      Variable.withString(_ownerId),
      Variable.withDateTime(bounds.start),
      Variable.withDateTime(bounds.end),
    ];
    final checkIns = await database
        .customSelect(
            "SELECT check_ins.id, check_in_revisions.body, check_ins.submitted_at, "
            "check_ins.timezone_id, COALESCE(categories.name, 'Uncategorized') AS category "
            'FROM check_ins '
            'JOIN check_in_revisions ON check_in_revisions.id = check_ins.current_revision_id '
            'LEFT JOIN categories ON categories.id = check_ins.category_id '
            'WHERE check_ins.owner_id = ? AND check_ins.deleted_at IS NULL '
            'AND check_ins.submitted_at >= ? AND check_ins.submitted_at < ?',
            variables: variables)
        .get();
    final occurrences = await database
        .customSelect(
            'SELECT id, state, scheduled_at, resolved_at, timezone_id '
            'FROM reminder_occurrences WHERE owner_id = ? '
            'AND COALESCE(resolved_at, scheduled_at) >= ? '
            'AND COALESCE(resolved_at, scheduled_at) < ?',
            variables: variables)
        .get();
    final transitions = await database
        .customSelect(
            'SELECT reminder_transitions.id, reminder_transitions.from_state, '
            'reminder_transitions.to_state, reminder_transitions.reason, '
            'reminder_transitions.occurred_at, reminder_occurrences.timezone_id '
            'FROM reminder_transitions '
            'JOIN reminder_occurrences ON reminder_occurrences.id = '
            'reminder_transitions.reminder_occurrence_id '
            'WHERE reminder_transitions.owner_id = ? '
            'AND reminder_transitions.occurred_at >= ? '
            'AND reminder_transitions.occurred_at < ?',
            variables: variables)
        .get();
    final sessions = await database.customSelect(
        'SELECT id, name, started_at, ended_at, timezone_id '
        'FROM focus_sessions WHERE owner_id = ? AND deleted_at IS NULL '
        'AND (started_at >= ? AND started_at < ? '
        'OR ended_at >= ? AND ended_at < ?)',
        variables: [
          Variable.withString(_ownerId),
          Variable.withDateTime(bounds.start),
          Variable.withDateTime(bounds.end),
          Variable.withDateTime(bounds.start),
          Variable.withDateTime(bounds.end),
        ]).get();
    final conflicts = await database
        .customSelect(
            'SELECT id, entity_type, entity_id, status, created_at '
            'FROM conflicts WHERE owner_id = ? AND created_at >= ? AND created_at < ?',
            variables: variables)
        .get();
    final timeline = <ReportTimelineItem>[
      for (final row in checkIns)
        ReportTimelineItem(
          id: row.read<String>('id'),
          kind: 'CHECK_IN',
          occurredAt: row.read<DateTime>('submitted_at').toUtc(),
          title: 'Check-in · ${row.read<String>('category')}',
          detail: row.read<String>('body'),
          originalTimezoneId: row.read<String>('timezone_id'),
        ),
      for (final row in occurrences)
        ReportTimelineItem(
          id: row.read<String>('id'),
          kind: 'REMINDER',
          occurredAt: (row.readNullable<DateTime>('resolved_at') ??
                  row.read<DateTime>('scheduled_at'))
              .toUtc(),
          title:
              'Reminder ${row.read<String>('state').toLowerCase().replaceAll('_', ' ')}',
          detail:
              'Scheduled ${row.read<DateTime>('scheduled_at').toUtc().toIso8601String()}',
          originalTimezoneId: row.read<String>('timezone_id'),
        ),
      for (final row in transitions)
        ReportTimelineItem(
          id: row.read<String>('id'),
          kind: 'REMINDER_TRANSITION',
          occurredAt: row.read<DateTime>('occurred_at').toUtc(),
          title:
              '${row.read<String>('from_state').toLowerCase()} → ${row.read<String>('to_state').toLowerCase()}',
          detail:
              row.readNullable<String>('reason') ?? 'Reminder state transition',
          originalTimezoneId: row.read<String>('timezone_id'),
        ),
      for (final row in conflicts)
        ReportTimelineItem(
          id: row.read<String>('id'),
          kind: 'CONFLICT',
          occurredAt: row.read<DateTime>('created_at').toUtc(),
          title:
              'Synchronization conflict · ${row.read<String>('status').toLowerCase()}',
          detail:
              '${row.read<String>('entity_type')} ${row.read<String>('entity_id')}',
        ),
    ];
    for (final row in sessions) {
      final startedAt = row.read<DateTime>('started_at').toUtc();
      final endedAt = row.readNullable<DateTime>('ended_at')?.toUtc();
      final detail = row.readNullable<String>('name') ?? 'Focus session';
      final zone = row.read<String>('timezone_id');
      if (!startedAt.isBefore(bounds.start) && startedAt.isBefore(bounds.end)) {
        timeline.add(ReportTimelineItem(
          id: '${row.read<String>('id')}:start',
          kind: 'SESSION_START',
          occurredAt: startedAt,
          title: 'Focus session started',
          detail: detail,
          originalTimezoneId: zone,
        ));
      }
      if (endedAt != null &&
          !endedAt.isBefore(bounds.start) &&
          endedAt.isBefore(bounds.end)) {
        timeline.add(ReportTimelineItem(
          id: '${row.read<String>('id')}:end',
          kind: 'SESSION_END',
          occurredAt: endedAt,
          title: 'Focus session ended',
          detail: detail,
          originalTimezoneId: zone,
        ));
      }
    }
    timeline.sort((left, right) {
      final time = left.occurredAt.compareTo(right.occurredAt);
      return time != 0 ? time : left.id.compareTo(right.id);
    });
    return timeline;
  }

  Future<void> completeReminder(String occurrenceId, String text) async {
    if (text.trim().runes.length < 20) {
      throw ArgumentError(
          'Reminder completion requires at least 20 characters.');
    }
    final occurrence = await database.customSelect(
        'SELECT state, focus_session_id, version FROM reminder_occurrences WHERE id = ?',
        variables: [Variable.withString(occurrenceId)]).getSingleOrNull();
    if (occurrence == null) throw StateError('Reminder was not found.');
    final state = occurrence.read<String>('state');
    if (state != 'DUE' && state != 'PRESENTED') {
      throw StateError('Reminder is not ready for completion.');
    }
    final now = DateTime.now().toUtc();
    final checkInId = generateSyncId();
    final revisionId = generateSyncId();
    final operationId = generateSyncId();
    final transitionId = generateSyncId();
    await database.transaction(() async {
      await database.customStatement(
          'INSERT INTO reminder_transitions (id, owner_id, reminder_occurrence_id, acting_device_id, from_state, to_state, original_scheduled_at, occurred_at, operation_id, created_at) SELECT ?, owner_id, id, ?, state, \'COMPLETED\', original_scheduled_at, ?, ?, ? FROM reminder_occurrences WHERE id = ?',
          [transitionId, _deviceId, now, operationId, now, occurrenceId]);
      await database.customStatement(
          "UPDATE reminder_occurrences SET state = 'COMPLETED', resolved_at = ?, version = ?, updated_at = ? WHERE id = ?",
          [now, operationId, now, occurrenceId]);
      await database.customStatement(
          'INSERT INTO check_ins (id, owner_id, reminder_occurrence_id, focus_session_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, \'UTC\', ?, ?, ?)',
          [
            checkInId,
            _ownerId,
            occurrenceId,
            occurrence.read<String>('focus_session_id'),
            revisionId,
            now,
            revisionId,
            now,
            now
          ]);
      await database.customStatement(
          'INSERT INTO check_in_revisions (id, check_in_id, body, author_device_id, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [revisionId, checkInId, text.trim(), _deviceId, operationId, now]);
      await _queue(
          'reminder_occurrence',
          occurrenceId,
          'reminder.complete',
          {
            'transitionId': transitionId,
            'checkInId': checkInId,
            'revisionId': revisionId,
            'body': text.trim(),
            'completedAt': now.toIso8601String(),
          },
          baseVersion: occurrence.read<String>('version'),
          operationId: operationId);
    });
    await _ensureNextOccurrence(occurrenceId, now);
  }

  Future<void> presentReminder(String occurrenceId) async {
    final row = await database.customSelect(
      'SELECT state FROM reminder_occurrences WHERE id = ? AND owner_id = ?',
      variables: [
        Variable.withString(occurrenceId),
        Variable.withString(_ownerId)
      ],
    ).getSingleOrNull();
    if (row?.read<String>('state') == 'DUE') {
      await _transitionReminder(occurrenceId, 'PRESENTED',
          reason: 'android-prompt');
    }
  }

  Future<void> snoozeReminder(String occurrenceId, int minutes) async {
    final row = await database.customSelect(
      'SELECT policy_snapshot_json FROM reminder_occurrences WHERE id = ? AND owner_id = ?',
      variables: [
        Variable.withString(occurrenceId),
        Variable.withString(_ownerId)
      ],
    ).getSingleOrNull();
    if (row == null) throw StateError('Reminder was not found.');
    final policy = _policy(row.read<String>('policy_snapshot_json'));
    if (!(policy['snoozeMinutes'] as List<int>).contains(minutes)) {
      throw ArgumentError('That snooze duration is not allowed.');
    }
    final count = await database.customSelect(
      "SELECT COUNT(*) AS count FROM reminder_transitions WHERE reminder_occurrence_id = ? AND to_state = 'SNOOZED'",
      variables: [Variable.withString(occurrenceId)],
    ).getSingle();
    if (count.read<int>('count') >= (policy['maxSnoozes'] as int)) {
      throw StateError('The snooze limit has been reached.');
    }
    await _transitionReminder(
      occurrenceId,
      'SNOOZED',
      reason: 'snoozed:${minutes}m',
      effectiveDueAt: DateTime.now().toUtc().add(Duration(minutes: minutes)),
    );
  }

  Future<void> emergencyDismissReminder(String occurrenceId) async {
    final now = DateTime.now().toUtc();
    await _transitionReminder(
      occurrenceId,
      'EMERGENCY_DISMISSED',
      reason: 'explicit-emergency-dismissal',
      occurredAt: now,
    );
    await _ensureNextOccurrence(occurrenceId, now);
  }

  Future<String> reminderDraft(String occurrenceId) async {
    final row = await database.customSelect(
      'SELECT text FROM reminder_drafts WHERE occurrence_id = ?',
      variables: [Variable.withString(occurrenceId)],
    ).getSingleOrNull();
    return row?.read<String>('text') ?? '';
  }

  Future<void> preserveReminderDraft(String occurrenceId, String text) =>
      database.customStatement(
        'INSERT OR REPLACE INTO reminder_drafts (occurrence_id, text, updated_at) VALUES (?, ?, ?)',
        [occurrenceId, text, DateTime.now().toUtc()],
      );

  Future<void> deleteReminderDraft(String occurrenceId) =>
      database.customStatement(
        'DELETE FROM reminder_drafts WHERE occurrence_id = ?',
        [occurrenceId],
      );

  Future<String> createCheckIn(String text) async {
    if (text.trim().isEmpty) {
      throw ArgumentError('Check-in text cannot be empty.');
    }
    await ensureIdentity();
    final checkInId = generateSyncId();
    final revisionId = generateSyncId();
    final operationId = generateSyncId();
    final now = DateTime.now().toUtc();
    await database.transaction(() async {
      await database.customStatement(
        "INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, 'UTC', ?, ?, ?)",
        [checkInId, _ownerId, revisionId, now, revisionId, now, now],
      );
      await database.customStatement(
        'INSERT INTO check_in_revisions (id, check_in_id, body, author_device_id, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [revisionId, checkInId, text.trim(), _deviceId, operationId, now],
      );
      await _queue(
        'check_in',
        checkInId,
        'check_in.create',
        {
          'revisionId': revisionId,
          'body': text.trim(),
          'submittedAt': now.toIso8601String(),
          'timezoneId': 'UTC',
          'reminderCompletion': false
        },
        operationId: operationId,
      );
    });
    return checkInId;
  }

  Future<void> reviseCheckIn(String checkInId, String text) async {
    if (text.trim().isEmpty) {
      throw ArgumentError('Check-in text cannot be empty.');
    }
    final current = await database.customSelect(
        'SELECT current_revision_id FROM check_ins WHERE id = ? AND owner_id = ? AND deleted_at IS NULL',
        variables: [
          Variable.withString(checkInId),
          Variable.withString(_ownerId)
        ]).getSingleOrNull();
    if (current == null) throw StateError('Check-in was not found.');
    final baseVersion = current.read<String>('current_revision_id');
    final revisionId = generateSyncId();
    final operationId = generateSyncId();
    final now = DateTime.now().toUtc();
    await database.transaction(() async {
      await database.customStatement(
          'INSERT INTO check_in_revisions (id, check_in_id, parent_revision_id, body, author_device_id, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            revisionId,
            checkInId,
            baseVersion,
            text.trim(),
            _deviceId,
            operationId,
            now
          ]);
      await database.customStatement(
          'UPDATE check_ins SET current_revision_id = ?, version = ?, updated_at = ? WHERE id = ?',
          [revisionId, revisionId, now, checkInId]);
      await _queue(
          'check_in',
          checkInId,
          'check_in.revise',
          {
            'revisionId': revisionId,
            'body': text.trim(),
            'createdAt': now.toIso8601String()
          },
          baseVersion: baseVersion,
          operationId: operationId);
    });
  }

  Future<void> deleteCheckIn(String checkInId) async {
    final current = await database.customSelect(
        'SELECT current_revision_id FROM check_ins WHERE id = ? AND owner_id = ? AND deleted_at IS NULL',
        variables: [
          Variable.withString(checkInId),
          Variable.withString(_ownerId)
        ]).getSingleOrNull();
    if (current == null) throw StateError('Check-in was not found.');
    final baseVersion = current.read<String>('current_revision_id');
    final operationId = generateSyncId();
    final tombstoneId = generateSyncId();
    final now = DateTime.now().toUtc();
    await database.transaction(() async {
      await database.customStatement(
          'UPDATE check_ins SET deleted_at = ?, version = ?, updated_at = ? WHERE id = ?',
          [now, operationId, now, checkInId]);
      await database.customStatement(
          'INSERT OR REPLACE INTO tombstones (id, owner_id, entity_type, entity_id, version, deleted_at, retention_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            tombstoneId,
            _ownerId,
            'check_in',
            checkInId,
            operationId,
            now,
            now.add(const Duration(days: 180)),
            now
          ]);
      await _queue('check_in', checkInId, 'check_in.delete',
          {'deletedAt': now.toIso8601String()},
          baseVersion: baseVersion, operationId: operationId);
    });
  }

  Map<String, Object> _policy(String json) {
    try {
      final parsed = jsonDecode(json);
      if (parsed is Map<String, dynamic>) {
        final rawSnoozes = parsed['snoozeMinutes'];
        return {
          ...defaultReminderPolicy,
          'intervalMinutes':
              (parsed['intervalMinutes'] as num?)?.toInt().clamp(1, 1440) ?? 30,
          'responseWindowMinutes': (parsed['responseWindowMinutes'] as num?)
                  ?.toInt()
                  .clamp(5, 1440) ??
              60,
          'snoozeMinutes': rawSnoozes is List
              ? rawSnoozes
                  .whereType<num>()
                  .map((value) => value.toInt().clamp(1, 120))
                  .toList()
              : const <int>[5, 10, 15],
          'maxSnoozes':
              (parsed['maxSnoozes'] as num?)?.toInt().clamp(0, 10) ?? 3,
          'allowLateCompletion': parsed['allowLateCompletion'] is bool
              ? parsed['allowLateCompletion'] as bool
              : true,
        };
      }
    } catch (_) {
      // Invalid legacy policy values are recovered with production defaults.
    }
    return {...defaultReminderPolicy};
  }

  Future<void> _transitionReminder(
    String occurrenceId,
    String toState, {
    required String reason,
    DateTime? occurredAt,
    DateTime? effectiveDueAt,
  }) async {
    final row = await database.customSelect(
      'SELECT state, version, original_scheduled_at FROM reminder_occurrences WHERE id = ? AND owner_id = ?',
      variables: [
        Variable.withString(occurrenceId),
        Variable.withString(_ownerId)
      ],
    ).getSingleOrNull();
    if (row == null) throw StateError('Reminder was not found.');
    final fromState = row.read<String>('state');
    const allowed = <String, Set<String>>{
      'SCHEDULED': {'DUE', 'SUPERSEDED'},
      'DUE': {
        'PRESENTED',
        'SNOOZED',
        'COMPLETED',
        'MISSED',
        'SKIPPED',
        'EMERGENCY_DISMISSED'
      },
      'PRESENTED': {
        'SNOOZED',
        'COMPLETED',
        'MISSED',
        'SKIPPED',
        'EMERGENCY_DISMISSED'
      },
      'SNOOZED': {'DUE', 'SUPERSEDED'},
    };
    if (!(allowed[fromState]?.contains(toState) ?? false)) {
      if (fromState == toState) return;
      throw StateError('Invalid reminder transition $fromState -> $toState.');
    }
    final at = (occurredAt ?? DateTime.now()).toUtc();
    final operationId = generateSyncId();
    final transitionId = generateSyncId();
    await database.transaction(() async {
      await database.customStatement(
        "UPDATE reminder_occurrences SET state = ?, scheduled_at = COALESCE(?, scheduled_at), presented_at = CASE WHEN ? = 'PRESENTED' THEN ? ELSE presented_at END, resolved_at = CASE WHEN ? IN ('COMPLETED','MISSED','SKIPPED','EMERGENCY_DISMISSED','SUPERSEDED') THEN ? ELSE resolved_at END, version = ?, updated_at = ? WHERE id = ?",
        [
          toState,
          effectiveDueAt,
          toState,
          at,
          toState,
          at,
          operationId,
          at,
          occurrenceId
        ],
      );
      await database.customStatement(
        'INSERT INTO reminder_transitions (id, owner_id, reminder_occurrence_id, acting_device_id, from_state, to_state, reason, original_scheduled_at, occurred_at, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transitionId,
          _ownerId,
          occurrenceId,
          _deviceId,
          fromState,
          toState,
          reason,
          row.read<DateTime>('original_scheduled_at'),
          at,
          operationId,
          at
        ],
      );
      await _queue(
        'reminder_occurrence',
        occurrenceId,
        'reminder.transition',
        {
          'transitionId': transitionId,
          'fromState': fromState,
          'toState': toState,
          'occurredAt': at.toIso8601String(),
          'reason': reason,
          if (effectiveDueAt != null)
            'effectiveDueAt': effectiveDueAt.toUtc().toIso8601String(),
        },
        baseVersion: row.read<String>('version'),
        operationId: operationId,
      );
    });
  }

  Future<void> _queueReminderSchedule(
      String occurrenceId, DateTime occurredAt) async {
    final row = await database.customSelect(
      'SELECT ro.*, fs.focus_mode_id, fs.name AS session_name, fs.started_at, fs.schedule_policy_json, fs.version AS session_version, fm.name AS mode_name, fm.interval_minutes, fm.policy_json, fm.version AS mode_version FROM reminder_occurrences ro JOIN focus_sessions fs ON fs.id = ro.focus_session_id JOIN focus_modes fm ON fm.id = fs.focus_mode_id WHERE ro.id = ?',
      variables: [Variable.withString(occurrenceId)],
    ).getSingle();
    await _queue(
      'reminder_occurrence',
      occurrenceId,
      'reminder.schedule',
      {
        'mode': {
          'id': row.read<String>('focus_mode_id'),
          'name': row.read<String>('mode_name'),
          'intervalMinutes': row.read<int>('interval_minutes'),
          'policy': jsonDecode(row.read<String>('policy_json')),
          'version': row.read<String>('mode_version'),
        },
        'session': {
          'id': row.read<String>('focus_session_id'),
          'name': row.readNullable<String>('session_name'),
          'startedAt':
              row.read<DateTime>('started_at').toUtc().toIso8601String(),
          'timezoneId': row.read<String>('timezone_id'),
          'schedulePolicy':
              jsonDecode(row.read<String>('schedule_policy_json')),
          'version': row.read<String>('session_version'),
        },
        'occurrence': {
          'scheduledAt':
              row.read<DateTime>('scheduled_at').toUtc().toIso8601String(),
          'originalScheduledAt': row
              .read<DateTime>('original_scheduled_at')
              .toUtc()
              .toIso8601String(),
          'timezoneId': row.read<String>('timezone_id'),
          'policySnapshot':
              jsonDecode(row.read<String>('policy_snapshot_json')),
          'version': row.read<String>('version'),
        },
      },
      operationId: generateSyncId(),
      occurredAt: occurredAt,
    );
  }

  Future<ReminderSummary?> _ensureNextOccurrence(
      String resolvedId, DateTime now) async {
    final source = await database.customSelect(
      "SELECT ro.*, fs.status AS session_status, fs.started_at FROM reminder_occurrences ro JOIN focus_sessions fs ON fs.id = ro.focus_session_id WHERE ro.id = ? AND ro.owner_id = ?",
      variables: [
        Variable.withString(resolvedId),
        Variable.withString(_ownerId)
      ],
    ).getSingleOrNull();
    if (source == null || source.read<String>('session_status') != 'ACTIVE') {
      return null;
    }
    final existing = await database.customSelect(
      "SELECT id FROM reminder_occurrences WHERE focus_session_id = ? AND state IN ('SCHEDULED','DUE','PRESENTED','SNOOZED') LIMIT 1",
      variables: [Variable.withString(source.read<String>('focus_session_id'))],
    ).getSingleOrNull();
    if (existing != null) return null;
    final policy = _policy(source.read<String>('policy_snapshot_json'));
    final interval = Duration(minutes: policy['intervalMinutes'] as int);
    final startedAt = source.read<DateTime>('started_at').toUtc();
    final elapsed = now.toUtc().difference(startedAt).inMilliseconds;
    final index = (elapsed ~/ interval.inMilliseconds) + 1;
    final dueAt =
        startedAt.add(Duration(milliseconds: interval.inMilliseconds * index));
    final occurrenceId = generateSyncId();
    final version = generateSyncId();
    await database.transaction(() async {
      await database.customStatement(
        "INSERT INTO reminder_occurrences (id, owner_id, focus_session_id, state, scheduled_at, original_scheduled_at, timezone_id, policy_snapshot_json, version, created_at, updated_at) VALUES (?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?, ?, ?)",
        [
          occurrenceId,
          _ownerId,
          source.read<String>('focus_session_id'),
          dueAt,
          dueAt,
          source.read<String>('timezone_id'),
          source.read<String>('policy_snapshot_json'),
          version,
          now,
          now
        ],
      );
      await _queueReminderSchedule(occurrenceId, now);
    });
    return ReminderSummary(occurrenceId, dueAt, 'SCHEDULED');
  }

  Future<void> _queue(String entityType, String entityId, String kind,
      Map<String, Object> payload,
      {String? baseVersion, String? operationId, DateTime? occurredAt}) async {
    final now = (occurredAt ?? DateTime.now()).toUtc();
    final sequence = await database.customSelect(
        'SELECT COALESCE(MAX(device_sequence), 0) + 1 AS next FROM outbox_operations WHERE owner_id = ? AND device_id = ?',
        variables: [
          Variable.withString(_ownerId),
          Variable.withString(_deviceId)
        ]).getSingle();
    await database.customStatement(
        'INSERT INTO outbox_operations (operation_id, owner_id, device_id, device_sequence, entity_type, entity_id, kind, base_version, payload_json, occurred_at, next_attempt_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          operationId ?? generateSyncId(),
          _ownerId,
          _deviceId,
          sequence.read<int>('next'),
          entityType,
          entityId,
          kind,
          baseVersion,
          jsonEncode(payload),
          now,
          now,
          now
        ]);
  }
}
