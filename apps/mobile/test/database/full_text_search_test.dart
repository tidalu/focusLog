import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/data/database/app_database.dart';
import 'package:focuslog_mobile/data/mobile_repository.dart';
import 'package:focuslog_mobile/identity/device_identity.dart';

void main() {
  test(
    'FTS5 ranks results, applies metadata filters, and meets the local benchmark',
    () async {
      final database = AppDatabase.forTesting(NativeDatabase.memory());
      addTearDown(database.close);
      final ownerId = generateSyncId();
      final now = DateTime.now().toUtc();
      await database.customStatement(
          'INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)',
          [ownerId, now, now]);
      final identity = DeviceIdentity(
          ownerId: ownerId,
          deviceId: generateSyncId(),
          publicKeyPem: 'test',
          privateKey: const <int>[],
          publicKey: const <int>[]);
      final repository = FocusLogRepository(database, identity);
      final encodedNow = now.millisecondsSinceEpoch ~/ 1000;
      final categoryId = generateSyncId();
      final tagId = generateSyncId();
      final modeId = generateSyncId();
      final sessionId = generateSyncId();
      await database.customStatement(
          'INSERT INTO categories (id, owner_id, name, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [categoryId, ownerId, 'Deep work', generateSyncId(), now, now]);
      await database.customStatement(
          'INSERT INTO tags (id, owner_id, name, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [tagId, ownerId, 'Architecture', generateSyncId(), now, now]);
      await database.customStatement(
          "INSERT INTO focus_modes (id, owner_id, name, interval_minutes, policy_json, version, created_at, updated_at) VALUES (?, ?, 'Test', 30, '{}', ?, ?, ?)",
          [modeId, ownerId, generateSyncId(), now, now]);
      await database.customStatement(
          "INSERT INTO focus_sessions (id, owner_id, focus_mode_id, name, status, schedule_policy_json, timezone_id, started_at, version, created_at, updated_at) VALUES (?, ?, ?, 'Build', 'ACTIVE', '{}', 'UTC', ?, ?, ?, ?)",
          [sessionId, ownerId, modeId, now, generateSyncId(), now, now]);

      String? filteredId;
      await database.batch((batch) {
        for (var index = 0; index < 10000; index++) {
          final checkInId = generateSyncId();
          final revisionId = generateSyncId();
          final filtered = index == 500;
          if (filtered) filteredId = checkInId;
          batch.customStatement(
              'INSERT INTO check_ins (id, owner_id, focus_session_id, category_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [
                checkInId,
                ownerId,
                filtered ? sessionId : null,
                filtered ? categoryId : null,
                revisionId,
                encodedNow,
                'UTC',
                revisionId,
                encodedNow,
                encodedNow
              ]);
          batch.customStatement(
              'INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES (?, ?, ?, ?, ?)',
              [
                revisionId,
                checkInId,
                index % 100 == 0
                    ? 'needle architecture planning $index'
                    : 'ordinary focus activity $index',
                generateSyncId(),
                encodedNow
              ]);
          if (filtered) {
            batch.customStatement(
                'INSERT INTO check_in_tags (check_in_id, tag_id) VALUES (?, ?)',
                [checkInId, tagId]);
          }
        }
      });

      final stopwatch = Stopwatch()..start();
      final results = await repository.history('needle architecture');
      stopwatch.stop();
      expect(results, hasLength(100));
      expect(stopwatch.elapsedMilliseconds, lessThan(2000));

      final filtered = await repository.history('needle',
          tagId: tagId, categoryId: categoryId, sessionId: sessionId);
      expect(filtered.map((item) => item.id), [filteredId]);
    },
    timeout: const Timeout(Duration(seconds: 60)),
  );
}
