import 'dart:convert';

import 'package:drift/native.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/data/database/app_database.dart';
import 'package:focuslog_mobile/identity/device_identity.dart';
import 'package:focuslog_mobile/security/encrypted_backup.dart';

Future<AppDatabase> seededDatabase({
  String ownerId = '01J00000000000000000000000',
}) async {
  final database = AppDatabase.forTesting(NativeDatabase.memory());
  final now = DateTime.utc(2026, 7, 20, 12);
  await database.customStatement(
    'INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)',
    [ownerId, now, now],
  );
  await database.customStatement(
    'INSERT INTO check_ins (id, owner_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      '01J00000000000000000000003',
      ownerId,
      now,
      'Europe/Warsaw',
      '01J00000000000000000000004',
      now,
      now,
    ],
  );
  await database.customStatement(
    'INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES (?, ?, ?, ?, ?)',
    [
      '01J00000000000000000000005',
      '01J00000000000000000000003',
      '<study><leetcode> Solved problem 904.',
      '01J00000000000000000000008',
      now,
    ],
  );
  await database.customStatement(
    'INSERT INTO categories (id, owner_id, name, path, depth, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      '01J00000000000000000000006',
      ownerId,
      'leetcode',
      'study/leetcode',
      1,
      '01J00000000000000000000004',
      now,
      now,
    ],
  );
  await database.customStatement(
    'INSERT INTO log_sections (id, owner_id, check_in_id, revision_id, category_id, position, body, metadata_json, occurred_at, timezone_id, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      '01J00000000000000000000007',
      ownerId,
      '01J00000000000000000000003',
      '01J00000000000000000000005',
      '01J00000000000000000000006',
      0,
      'Solved problem 904.',
      '{"difficulty":"Hard"}',
      now,
      'Europe/Warsaw',
      '01J00000000000000000000004',
      now,
    ],
  );
  return database;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('database key survives application recreation through secure storage',
      () async {
    FlutterSecureStorage.setMockInitialValues({});
    final first = await DatabaseKeyService().loadOrCreate();
    final afterReinstall = await DatabaseKeyService().loadOrCreate();
    expect(first, hasLength(32));
    expect(afterReinstall, first);
  });

  test('encrypted backup restores into a clean reinstall database', () async {
    final source = await seededDatabase();
    final key = List<int>.generate(32, (index) => index);
    final archive = await MobileBackupService(source).createArchive(key);
    await source.close();
    final reinstalled = AppDatabase.forTesting(NativeDatabase.memory());

    await MobileBackupService(reinstalled)
        .restoreArchive(archive, formatRecoveryKey(key));
    final count = await reinstalled
        .customSelect('SELECT count(*) AS count FROM check_ins')
        .getSingle();
    expect(count.read<int>('count'), 1);
    final section = await reinstalled.customSelect('''
      SELECT categories.path, log_sections.body, log_sections.metadata_json
      FROM log_sections
      JOIN categories ON categories.id = log_sections.category_id
    ''').getSingle();
    expect(section.read<String>('path'), 'study/leetcode');
    expect(section.read<String>('body'), 'Solved problem 904.');
    expect(section.read<String>('metadata_json'), '{"difficulty":"Hard"}');
    await reinstalled.close();
  });

  test('backup restores the signed device credential after reinstall',
      () async {
    FlutterSecureStorage.setMockInitialValues({});
    final identityService = DeviceIdentityService();
    final identity = await identityService.loadOrCreate();
    final source = await seededDatabase(ownerId: identity.ownerId);
    final key = List<int>.generate(32, (index) => index);
    final archive = await MobileBackupService(
      source,
      identity: identity,
    ).createArchive(key);
    await source.close();

    FlutterSecureStorage.setMockInitialValues({});
    final reinstalled = AppDatabase.forTesting(NativeDatabase.memory());
    final recoveredService = DeviceIdentityService();
    await MobileBackupService(reinstalled).restoreArchive(
      archive,
      formatRecoveryKey(key),
      identityService: recoveredService,
    );
    final recovered = await recoveredService.loadOrCreate();
    expect(recovered.ownerId, identity.ownerId);
    expect(recovered.deviceId, identity.deviceId);
    expect(recovered.publicKey, identity.publicKey);
    expect(recovered.privateKey, identity.privateKey);
    await reinstalled.close();
  });

  test('modified backup is rejected before live data changes', () async {
    final database = await seededDatabase();
    final key = List<int>.generate(32, (index) => index);
    final archive = await MobileBackupService(database).createArchive(key);
    final envelope = jsonDecode(utf8.decode(archive)) as Map<String, dynamic>;
    envelope['authenticationTag'] = 'AAAAAAAAAAAAAAAAAAAAAA';

    await expectLater(
      MobileBackupService(database).restoreArchive(
        utf8.encode(jsonEncode(envelope)),
        formatRecoveryKey(key),
      ),
      throwsA(isA<FormatException>()),
    );
    final count = await database
        .customSelect('SELECT count(*) AS count FROM owners')
        .getSingle();
    expect(count.read<int>('count'), 1);
    await database.close();
  });
}
