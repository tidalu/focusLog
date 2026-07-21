import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/data/database/app_database.dart';
import 'package:focuslog_mobile/data/mobile_repository.dart';
import 'package:focuslog_mobile/identity/device_identity.dart';
import 'package:timezone/data/latest.dart' as tzdata;

void main() {
  setUpAll(tzdata.initializeTimeZones);

  Future<(AppDatabase, FocusLogRepository)> fixture() async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    final repository = FocusLogRepository(
      database,
      DeviceIdentity(
        ownerId: 'owner',
        deviceId: 'device',
        publicKeyPem: 'public-key',
        privateKey: const [1],
        publicKey: const [2],
      ),
    );
    await repository.ensureIdentity();
    final created = DateTime.utc(2024);
    await database.customStatement(
      'INSERT INTO focus_modes '
      '(id, owner_id, name, interval_minutes, policy_json, version, created_at, updated_at) '
      "VALUES ('mode', 'owner', 'Deep work', 30, '{}', 'v1', ?, ?)",
      [created, created],
    );
    return (database, repository);
  }

  Future<void> insertSession(
    AppDatabase database,
    String id,
    DateTime start,
    DateTime end,
  ) async {
    await database.customStatement(
      'INSERT INTO focus_sessions '
      '(id, owner_id, focus_mode_id, name, status, schedule_policy_json, '
      'timezone_id, started_at, ended_at, version, created_at, updated_at) '
      "VALUES (?, 'owner', 'mode', 'Deep work', 'COMPLETED', '{}', "
      "'Europe/Warsaw', ?, ?, 'v1', ?, ?)",
      [id, start, end, start, start],
    );
  }

  Future<void> insertCheckIn(
    AppDatabase database,
    String id,
    DateTime submittedAt,
  ) async {
    final revision = '$id-revision';
    await database.customStatement(
      'INSERT INTO check_ins '
      '(id, owner_id, current_revision_id, submitted_at, timezone_id, version, '
      'created_at, updated_at) '
      "VALUES (?, 'owner', ?, ?, 'Europe/Warsaw', ?, ?, ?)",
      [id, revision, submittedAt, revision, submittedAt, submittedAt],
    );
    await database.customStatement(
      'INSERT INTO check_in_revisions '
      '(id, check_in_id, body, author_device_id, operation_id, created_at) '
      "VALUES (?, ?, 'A detailed completed focus check-in', 'device', ?, ?)",
      [revision, id, '$id-operation', submittedAt],
    );
    await database.customStatement(
      "INSERT INTO log_sections (id, owner_id, check_in_id, revision_id, position, body, metadata_json, occurred_at, timezone_id, version, created_at) VALUES (?, 'owner', ?, ?, 0, 'A detailed completed focus check-in', '{}', ?, 'Europe/Warsaw', ?, ?)",
      ['$revision-section', id, revision, submittedAt, revision, submittedAt],
    );
  }

  test('daily report follows DST boundaries and clips tracked time', () async {
    final (database, repository) = await fixture();
    addTearDown(database.close);
    await insertSession(
      database,
      'session',
      DateTime.parse('2026-03-28T22:30:00Z'),
      DateTime.parse('2026-03-29T22:30:00Z'),
    );
    await insertCheckIn(
        database, 'inside', DateTime.parse('2026-03-28T23:15:00Z'));
    await insertCheckIn(
        database, 'outside', DateTime.parse('2026-03-29T22:15:00Z'));

    final report = await repository.dailyReport(
      day: '2026-03-29',
      timezoneId: 'Europe/Warsaw',
    );

    expect(report.dayDurationMinutes, 23 * 60);
    expect(report.totalTrackedMinutes, 23 * 60);
    expect(
      report.timeline.where((entry) => entry.kind == 'CHECK_IN').length,
      1,
    );
  });

  test('historical leap-year heatmap returns every calendar day', () async {
    final (database, repository) = await fixture();
    addTearDown(database.close);
    await insertCheckIn(
        database, 'leap-day', DateTime.parse('2024-02-29T12:00:00Z'));

    final heatmap = await repository.heatmap(2024, timezoneId: 'Europe/Warsaw');

    expect(heatmap.days, hasLength(366));
    expect(heatmap.days.first.day, '2024-01-01');
    expect(heatmap.days.last.day, '2024-12-31');
    final leap = heatmap.days.singleWhere((day) => day.day == '2024-02-29');
    expect(leap.value, 1);
    expect(leap.intensity, 1);
  });

  test('report timezone setting persists and rejects unknown zones', () async {
    final (database, repository) = await fixture();
    addTearDown(database.close);

    await repository.setReportTimezoneId('Europe/Warsaw');
    expect(await repository.reportTimezoneId(), 'Europe/Warsaw');
    await expectLater(
      repository.setReportTimezoneId('Not/A_Timezone'),
      throwsA(isA<ArgumentError>()),
    );
  });
}
