import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
import 'package:sqlcipher_flutter_libs/sqlcipher_flutter_libs.dart';
import 'package:sqlite3/open.dart' as sqlite_open;
import 'package:sqlite3/sqlite3.dart' as sqlite;

part 'app_database.g.dart';

class Owners extends Table {
  TextColumn get id => text()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class Devices extends Table {
  TextColumn get id => text()();
  TextColumn get ownerId => text()();
  TextColumn get publicKey => text().unique()();
  TextColumn get fingerprint => text().unique()();
  TextColumn get platform => text()();
  TextColumn get displayName => text().nullable()();
  TextColumn get capabilitiesJson => text().nullable()();
  BoolColumn get isOwnerDevice =>
      boolean().withDefault(const Constant(false))();
  TextColumn get status => text().withDefault(const Constant('ACTIVE'))();
  DateTimeColumn get lastSeenAt => dateTime().nullable()();
  DateTimeColumn get revokedAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class DevicePairings extends Table {
  TextColumn get id => text()();
  TextColumn get ownerId => text()();
  TextColumn get candidatePublicKey => text()();
  TextColumn get candidateFingerprint => text()();
  TextColumn get candidatePlatform => text()();
  TextColumn get status => text().withDefault(const Constant('PENDING'))();
  TextColumn get approvedByDeviceId => text().nullable()();
  DateTimeColumn get expiresAt => dateTime()();
  DateTimeColumn get approvedAt => dateTime().nullable()();
  DateTimeColumn get consumedAt => dateTime().nullable()();
  DateTimeColumn get cancelledAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class FocusModes extends Table {
  TextColumn get id => text()();
  TextColumn get ownerId => text()();
  TextColumn get name => text()();
  IntColumn get intervalMinutes => integer()();
  TextColumn get policyJson => text()();
  TextColumn get version => text()();
  DateTimeColumn get deletedAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class FocusSessions extends Table {
  TextColumn get id => text()();
  TextColumn get ownerId => text()();
  TextColumn get focusModeId => text()();
  TextColumn get name => text().nullable()();
  TextColumn get status => text().withDefault(const Constant('ACTIVE'))();
  TextColumn get schedulePolicyJson => text()();
  TextColumn get timezoneId => text()();
  DateTimeColumn get startedAt => dateTime()();
  DateTimeColumn get endedAt => dateTime().nullable()();
  TextColumn get version => text()();
  DateTimeColumn get deletedAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class ReminderOccurrences extends Table {
  TextColumn get id => text()();
  TextColumn get ownerId => text()();
  TextColumn get focusSessionId => text()();
  TextColumn get state => text().withDefault(const Constant('SCHEDULED'))();
  DateTimeColumn get scheduledAt => dateTime()();
  DateTimeColumn get originalScheduledAt => dateTime()();
  DateTimeColumn get presentedAt => dateTime().nullable()();
  DateTimeColumn get resolvedAt => dateTime().nullable()();
  TextColumn get timezoneId => text()();
  TextColumn get policySnapshotJson => text()();
  TextColumn get version => text()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class ReminderTransitions extends Table {
  TextColumn get id => text()();
  TextColumn get ownerId => text()();
  TextColumn get reminderOccurrenceId => text()();
  TextColumn get actingDeviceId => text().nullable()();
  TextColumn get fromState => text()();
  TextColumn get toState => text()();
  TextColumn get reason => text().nullable()();
  DateTimeColumn get originalScheduledAt => dateTime()();
  DateTimeColumn get occurredAt => dateTime()();
  TextColumn get operationId => text().unique()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class Categories extends Table {
  TextColumn get id => text()();
  TextColumn get ownerId => text()();
  TextColumn get parentId => text().nullable()();
  TextColumn get name => text()();
  TextColumn get path => text().nullable()();
  IntColumn get depth => integer().withDefault(const Constant(1))();
  TextColumn get color => text().nullable()();
  TextColumn get version => text()();
  DateTimeColumn get deletedAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class LogSections extends Table {
  TextColumn get id => text()();
  TextColumn get ownerId => text()();
  TextColumn get checkInId => text()();
  TextColumn get revisionId => text()();
  TextColumn get categoryId => text().nullable()();
  IntColumn get position => integer()();
  TextColumn get body => text()();
  TextColumn get metadataJson => text().withDefault(const Constant('{}'))();
  DateTimeColumn get occurredAt => dateTime()();
  TextColumn get timezoneId => text()();
  TextColumn get version => text()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class CheckIns extends Table {
  TextColumn get id => text()();
  TextColumn get ownerId => text()();
  TextColumn get reminderOccurrenceId => text().nullable().unique()();
  TextColumn get focusSessionId => text().nullable()();
  TextColumn get categoryId => text().nullable()();
  TextColumn get currentRevisionId => text().nullable()();
  DateTimeColumn get submittedAt => dateTime()();
  TextColumn get timezoneId => text()();
  TextColumn get version => text()();
  DateTimeColumn get deletedAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class CheckInRevisions extends Table {
  TextColumn get id => text()();
  TextColumn get checkInId => text()();
  TextColumn get parentRevisionId => text().nullable()();
  TextColumn get body => text()();
  TextColumn get authorDeviceId => text().nullable()();
  TextColumn get operationId => text().unique()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get deletedAt => dateTime().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class Tags extends Table {
  TextColumn get id => text()();
  TextColumn get ownerId => text()();
  TextColumn get name => text()();
  TextColumn get color => text().nullable()();
  TextColumn get version => text()();
  DateTimeColumn get deletedAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class CheckInTags extends Table {
  TextColumn get checkInId => text()();
  TextColumn get tagId => text()();

  @override
  Set<Column<Object>> get primaryKey => {checkInId, tagId};
}

class SyncOperations extends Table {
  TextColumn get operationId => text()();
  TextColumn get ownerId => text()();
  TextColumn get deviceId => text()();
  IntColumn get deviceSequence => integer()();
  TextColumn get entityType => text()();
  TextColumn get entityId => text()();
  TextColumn get kind => text()();
  TextColumn get baseVersion => text().nullable()();
  TextColumn get payloadJson => text()();
  DateTimeColumn get occurredAt => dateTime()();
  DateTimeColumn get receivedAt => dateTime()();
  TextColumn get status => text()();
  TextColumn get resultJson => text().nullable()();
  IntColumn get sequence => integer().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {operationId};
}

class SyncCursors extends Table {
  TextColumn get ownerId => text()();
  TextColumn get deviceId => text()();
  IntColumn get lastAppliedSequence =>
      integer().withDefault(const Constant(0))();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {ownerId, deviceId};
}

class OutboxOperations extends Table {
  TextColumn get operationId => text()();
  TextColumn get ownerId => text()();
  TextColumn get deviceId => text()();
  IntColumn get deviceSequence => integer()();
  TextColumn get entityType => text()();
  TextColumn get entityId => text()();
  TextColumn get kind => text()();
  TextColumn get baseVersion => text().nullable()();
  TextColumn get payloadJson => text()();
  DateTimeColumn get occurredAt => dateTime()();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  DateTimeColumn get nextAttemptAt => dateTime()();
  DateTimeColumn get acknowledgedAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {operationId};
}

class SyncFailures extends Table {
  TextColumn get operationId => text()();
  TextColumn get code => text()();
  TextColumn get message => text()();
  DateTimeColumn get recordedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {operationId};
}

class Conflicts extends Table {
  TextColumn get id => text()();
  TextColumn get ownerId => text()();
  TextColumn get entityType => text()();
  TextColumn get entityId => text()();
  TextColumn get localOperationId => text().nullable()();
  TextColumn get remoteOperationId => text().nullable()();
  TextColumn get localPayloadJson => text().nullable()();
  TextColumn get remotePayloadJson => text().nullable()();
  TextColumn get status => text().withDefault(const Constant('OPEN'))();
  DateTimeColumn get resolvedAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class BackupManifests extends Table {
  TextColumn get id => text()();
  TextColumn get ownerId => text()();
  TextColumn get kind => text()();
  IntColumn get formatVersion => integer()();
  IntColumn get schemaVersion => integer()();
  TextColumn get storageLocation => text()();
  TextColumn get checksum => text()();
  TextColumn get encryptionJson => text()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get expiresAt => dateTime().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class AppSettings extends Table {
  TextColumn get ownerId => text()();
  TextColumn get valuesJson => text()();
  TextColumn get version => text()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  String get tableName => 'settings';
  @override
  Set<Column<Object>> get primaryKey => {ownerId};
}

class Tombstones extends Table {
  TextColumn get id => text()();
  TextColumn get ownerId => text()();
  TextColumn get entityType => text()();
  TextColumn get entityId => text()();
  TextColumn get version => text()();
  DateTimeColumn get deletedAt => dateTime()();
  DateTimeColumn get retentionUntil => dateTime()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

@DriftDatabase(tables: [
  Owners,
  Devices,
  DevicePairings,
  FocusModes,
  FocusSessions,
  ReminderOccurrences,
  ReminderTransitions,
  Categories,
  LogSections,
  CheckIns,
  CheckInRevisions,
  Tags,
  CheckInTags,
  SyncOperations,
  SyncCursors,
  OutboxOperations,
  SyncFailures,
  Conflicts,
  BackupManifests,
  AppSettings,
  Tombstones
])
class AppDatabase extends _$AppDatabase {
  AppDatabase.encrypted(List<int> key) : super(_openConnection(key));
  AppDatabase.forTesting(super.executor);

  @override
  Future<void> customStatement(String statement, [List<dynamic>? args]) {
    final encoded = args
        ?.map(
          (value) => value is DateTime
              ? value.toUtc().millisecondsSinceEpoch ~/ 1000
              : value,
        )
        .toList();
    return super.customStatement(statement, encoded);
  }

  @override
  int get schemaVersion => 6;

  Future<void> _ensureCheckInFts({required bool rebuild}) async {
    await customStatement(
        "CREATE VIRTUAL TABLE IF NOT EXISTS check_in_revisions_fts USING fts5(body, content='check_in_revisions', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2')");
    await customStatement(
        'CREATE TRIGGER IF NOT EXISTS check_in_revisions_fts_insert AFTER INSERT ON check_in_revisions BEGIN INSERT INTO check_in_revisions_fts(rowid, body) VALUES (new.rowid, new.body); END');
    await customStatement(
        "CREATE TRIGGER IF NOT EXISTS check_in_revisions_fts_delete AFTER DELETE ON check_in_revisions BEGIN INSERT INTO check_in_revisions_fts(check_in_revisions_fts, rowid, body) VALUES ('delete', old.rowid, old.body); END");
    await customStatement(
        "CREATE TRIGGER IF NOT EXISTS check_in_revisions_fts_update AFTER UPDATE OF body ON check_in_revisions BEGIN INSERT INTO check_in_revisions_fts(check_in_revisions_fts, rowid, body) VALUES ('delete', old.rowid, old.body); INSERT INTO check_in_revisions_fts(rowid, body) VALUES (new.rowid, new.body); END");
    await customStatement(
        'CREATE INDEX IF NOT EXISTS check_in_tags_tag_check_in_idx ON check_in_tags(tag_id, check_in_id)');
    await customStatement(
        'CREATE INDEX IF NOT EXISTS check_ins_owner_category_session_idx ON check_ins(owner_id, category_id, focus_session_id, submitted_at)');
    if (rebuild) {
      await customStatement(
          "INSERT INTO check_in_revisions_fts(check_in_revisions_fts) VALUES ('rebuild')");
    }
  }

  Future<void> _ensureLogSectionFts({required bool rebuild}) async {
    await customStatement(
        "CREATE VIRTUAL TABLE IF NOT EXISTS log_sections_fts USING fts5(body, content='log_sections', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2')");
    await customStatement(
        'CREATE TRIGGER IF NOT EXISTS log_sections_fts_insert AFTER INSERT ON log_sections BEGIN INSERT INTO log_sections_fts(rowid, body) VALUES (new.rowid, new.body); END');
    await customStatement(
        "CREATE TRIGGER IF NOT EXISTS log_sections_fts_delete AFTER DELETE ON log_sections BEGIN INSERT INTO log_sections_fts(log_sections_fts, rowid, body) VALUES ('delete', old.rowid, old.body); END");
    await customStatement(
        "CREATE TRIGGER IF NOT EXISTS log_sections_fts_update AFTER UPDATE OF body ON log_sections BEGIN INSERT INTO log_sections_fts(log_sections_fts, rowid, body) VALUES ('delete', old.rowid, old.body); INSERT INTO log_sections_fts(rowid, body) VALUES (new.rowid, new.body); END");
    if (rebuild) {
      await customStatement(
          "INSERT INTO log_sections_fts(log_sections_fts) VALUES ('rebuild')");
    }
  }

  @override
  MigrationStrategy get migration => MigrationStrategy(
      onCreate: (Migrator migrator) async => migrator.createAll(),
      onUpgrade: (Migrator migrator, int from, int to) async {
        if (from < 2) {
          await migrator.createTable(outboxOperations);
          await migrator.createTable(syncFailures);
        }
        if (from < 3) {
          await customStatement(
            'CREATE TABLE IF NOT EXISTS reminder_drafts (occurrence_id TEXT PRIMARY KEY, text TEXT NOT NULL, updated_at TEXT NOT NULL)',
          );
        }
        if (from < 4) {
          await customStatement(
              'CREATE INDEX IF NOT EXISTS reminder_occurrences_owner_resolved_idx ON reminder_occurrences (owner_id, resolved_at)');
          await customStatement(
              'CREATE INDEX IF NOT EXISTS reminder_transitions_owner_occurred_idx ON reminder_transitions (owner_id, occurred_at)');
          await customStatement(
              'CREATE INDEX IF NOT EXISTS focus_sessions_owner_started_ended_idx ON focus_sessions (owner_id, started_at, ended_at)');
        }
        if (from < 5) {
          await _ensureCheckInFts(rebuild: true);
        }
        if (from < 6) {
          await migrator.addColumn(categories, categories.parentId);
          await migrator.addColumn(categories, categories.path);
          await migrator.addColumn(categories, categories.depth);
          await customStatement(
              'UPDATE check_ins SET category_id = (SELECT canonical.id FROM categories AS current JOIN categories AS canonical ON canonical.owner_id = current.owner_id AND LOWER(TRIM(canonical.name)) = LOWER(TRIM(current.name)) WHERE current.id = check_ins.category_id ORDER BY canonical.created_at, canonical.id LIMIT 1) WHERE category_id IS NOT NULL');
          await customStatement(
              'DELETE FROM categories WHERE EXISTS (SELECT 1 FROM categories AS canonical WHERE canonical.owner_id = categories.owner_id AND LOWER(TRIM(canonical.name)) = LOWER(TRIM(categories.name)) AND (canonical.created_at < categories.created_at OR (canonical.created_at = categories.created_at AND canonical.id < categories.id)))');
          await customStatement(
              'UPDATE categories SET path = LOWER(TRIM(name)) WHERE path IS NULL');
          await customStatement(
              'CREATE UNIQUE INDEX IF NOT EXISTS categories_owner_path_idx ON categories(owner_id, path)');
          await customStatement(
              'CREATE INDEX IF NOT EXISTS categories_owner_parent_idx ON categories(owner_id, parent_id, deleted_at)');
          await migrator.createTable(logSections);
          await customStatement(
              "INSERT INTO log_sections (id, owner_id, check_in_id, revision_id, category_id, position, body, metadata_json, occurred_at, timezone_id, version, created_at) SELECT check_in_revisions.id, check_ins.owner_id, check_ins.id, check_in_revisions.id, check_ins.category_id, 0, check_in_revisions.body, '{}', check_ins.submitted_at, check_ins.timezone_id, check_in_revisions.id, check_in_revisions.created_at FROM check_in_revisions JOIN check_ins ON check_ins.id = check_in_revisions.check_in_id");
          await customStatement(
              'CREATE INDEX IF NOT EXISTS log_sections_check_in_revision_position_idx ON log_sections(check_in_id, revision_id, position)');
          await customStatement(
              'CREATE INDEX IF NOT EXISTS log_sections_owner_occurred_idx ON log_sections(owner_id, occurred_at)');
          await customStatement(
              'CREATE INDEX IF NOT EXISTS log_sections_category_occurred_idx ON log_sections(category_id, occurred_at)');
          await _ensureLogSectionFts(rebuild: true);
        }
      },
      beforeOpen: (OpeningDetails details) async {
        await customStatement('PRAGMA foreign_keys = ON');
        await customStatement('PRAGMA journal_mode = WAL');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS devices_owner_status_idx ON devices (owner_id, status)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS focus_sessions_owner_status_started_idx ON focus_sessions (owner_id, status, started_at)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS reminder_occurrences_owner_state_due_idx ON reminder_occurrences (owner_id, state, scheduled_at)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS reminder_occurrences_owner_resolved_idx ON reminder_occurrences (owner_id, resolved_at)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS reminder_transitions_owner_occurred_idx ON reminder_transitions (owner_id, occurred_at)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS focus_sessions_owner_started_ended_idx ON focus_sessions (owner_id, started_at, ended_at)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS check_ins_owner_submitted_idx ON check_ins (owner_id, submitted_at)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS sync_operations_owner_received_idx ON sync_operations (owner_id, received_at)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS outbox_operations_ready_idx ON outbox_operations (acknowledged_at, next_attempt_at)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS outbox_operations_owner_device_idx ON outbox_operations (owner_id, device_id, device_sequence)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS tombstones_owner_retention_idx ON tombstones (owner_id, retention_until)');
        await customStatement(
            'CREATE UNIQUE INDEX IF NOT EXISTS categories_owner_path_idx ON categories(owner_id, path)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS categories_owner_parent_idx ON categories(owner_id, parent_id, deleted_at)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS log_sections_check_in_revision_position_idx ON log_sections(check_in_id, revision_id, position)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS log_sections_owner_occurred_idx ON log_sections(owner_id, occurred_at)');
        await customStatement(
            'CREATE INDEX IF NOT EXISTS log_sections_category_occurred_idx ON log_sections(category_id, occurred_at)');
        await customStatement(
          'CREATE TABLE IF NOT EXISTS reminder_drafts (occurrence_id TEXT PRIMARY KEY, text TEXT NOT NULL, updated_at TEXT NOT NULL)',
        );
        await _ensureCheckInFts(rebuild: false);
        await _ensureLogSectionFts(rebuild: false);
      });
}

String _hex(List<int> bytes) =>
    bytes.map((value) => value.toRadixString(16).padLeft(2, '0')).join();

void _configureSqlCipher() {
  sqlite_open.open.overrideFor(
    sqlite_open.OperatingSystem.android,
    openCipherOnAndroid,
  );
}

Future<bool> _isPlaintextDatabase(File file) async {
  if (!await file.exists() || await file.length() < 16) return false;
  final header = await file.openRead(0, 16).fold<List<int>>(
    <int>[],
    (previous, element) => previous..addAll(element),
  );
  return String.fromCharCodes(header) == 'SQLite format 3\u0000';
}

String _sqliteString(String value) => value.replaceAll("'", "''");

Future<void> _encryptPlaintextDatabase(File source, List<int> key) async {
  final temporary = File('${source.path}.encrypting');
  if (await temporary.exists()) await temporary.delete();
  final database = sqlite.sqlite3.open(source.path);
  try {
    database.execute(
      "ATTACH DATABASE '${_sqliteString(temporary.path)}' AS encrypted "
      "KEY \"x'${_hex(key)}'\";",
    );
    database.execute("SELECT sqlcipher_export('encrypted');");
    database.execute('DETACH DATABASE encrypted;');
  } finally {
    database.dispose();
  }
  final validation = sqlite.sqlite3.open(temporary.path);
  try {
    validation.execute("PRAGMA key = \"x'${_hex(key)}'\";");
    validation.select('SELECT count(*) FROM sqlite_master;');
  } finally {
    validation.dispose();
  }
  await source.rename('${source.path}.plaintext-migration');
  try {
    await temporary.rename(source.path);
    await File('${source.path}.plaintext-migration').delete();
    for (final suffix in ['-wal', '-shm']) {
      final sidecar = File('${source.path}$suffix');
      if (await sidecar.exists()) await sidecar.delete();
    }
  } catch (_) {
    if (await source.exists()) await source.delete();
    await File('${source.path}.plaintext-migration').rename(source.path);
    rethrow;
  }
}

LazyDatabase _openConnection(List<int> key) {
  if (key.length != 32) {
    throw ArgumentError.value(key.length, 'key', 'must be 32 bytes');
  }
  return LazyDatabase(() async {
    _configureSqlCipher();
    await applyWorkaroundToOpenSqlCipherOnOldAndroidVersions();
    final Directory directory = await getApplicationDocumentsDirectory();
    final File file = File(path.join(directory.path, 'focuslog.sqlite'));
    if (await _isPlaintextDatabase(file)) {
      await _encryptPlaintextDatabase(file, key);
    }
    return NativeDatabase.createInBackground(
      file,
      isolateSetup: _configureSqlCipher,
      setup: (database) {
        database.execute("PRAGMA key = \"x'${_hex(key)}'\";");
        final version = database.select('PRAGMA cipher_version;');
        if (version.isEmpty) {
          throw StateError(
              'SQLCipher is unavailable; refusing plaintext storage.');
        }
        database.select('SELECT count(*) FROM sqlite_master;');
      },
    );
  });
}
