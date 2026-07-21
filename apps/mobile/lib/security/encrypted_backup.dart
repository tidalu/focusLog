import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart' as crypto;
import 'package:cryptography/cryptography.dart';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../data/database/app_database.dart';
import '../identity/device_identity.dart';

const _magic = 'FOCUSLOG-ENCRYPTED-BACKUP';
const _formatVersion = 1;
const _schemaVersion = 4;
final _hkdfInfo = utf8.encode('FocusLog portable backup v1');

const portableTables = <String>[
  'owners',
  'devices',
  'device_pairings',
  'focus_modes',
  'focus_sessions',
  'reminder_occurrences',
  'reminder_transitions',
  'categories',
  'check_ins',
  'check_in_revisions',
  'log_sections',
  'tags',
  'check_in_tags',
  'sync_operations',
  'sync_cursors',
  'outbox_operations',
  'sync_failures',
  'conflicts',
  'backup_manifests',
  'settings',
  'tombstones',
  'reminder_drafts',
];

String _unpaddedBase64(List<int> bytes) =>
    base64UrlEncode(bytes).replaceAll('=', '');

List<int> _decodeBase64(String value) {
  final padding = '=' * ((4 - value.length % 4) % 4);
  return base64Url.decode('$value$padding');
}

class BackupRecoveryKeyService {
  BackupRecoveryKeyService({FlutterSecureStorage? storage})
      : _storage = storage ?? secureCredentialStorage;

  final FlutterSecureStorage _storage;
  static const _key = 'focuslog.backupRecoveryKey.v1';

  Future<List<int>> loadOrCreate() async {
    final stored = await _storage.read(key: _key);
    if (stored != null) return _decodeRecoveryKey(stored);
    final random = Random.secure();
    final key = List<int>.generate(32, (_) => random.nextInt(256));
    await _storage.write(key: _key, value: formatRecoveryKey(key));
    return key;
  }

  Future<void> delete() => _storage.delete(key: _key);
}

String formatRecoveryKey(List<int> key) {
  if (key.length != 32) throw ArgumentError('Recovery key must be 32 bytes.');
  return 'FLRK1-${_unpaddedBase64(key)}';
}

List<int> _decodeRecoveryKey(String encoded) {
  final normalized = encoded.trim().replaceFirst(RegExp(r'^FLRK1-'), '');
  final key = _decodeBase64(normalized);
  if (key.length != 32) {
    throw const FormatException(
      'Recovery key is invalid; expected a FocusLog 256-bit recovery key.',
    );
  }
  return key;
}

Future<SecretKey> _deriveKey(List<int> recoveryKey, List<int> salt) =>
    Hkdf(hmac: Hmac.sha256(), outputLength: 32).deriveKey(
      secretKey: SecretKey(recoveryKey),
      nonce: salt,
      info: _hkdfInfo,
    );

class MobileBackupService {
  MobileBackupService(this.database, {this.identity});
  final AppDatabase database;
  final DeviceIdentity? identity;

  Future<Map<String, dynamic>> _snapshot(String kind) async {
    final owner = await database
        .customSelect('SELECT id FROM owners ORDER BY created_at LIMIT 1')
        .getSingleOrNull();
    if (owner == null) {
      throw StateError('Cannot back up before the local owner exists.');
    }
    final tables = <String, dynamic>{};
    for (final table in portableTables) {
      final columnRows =
          await database.customSelect('PRAGMA table_info("$table")').get();
      final columns = columnRows
          .map((row) => row.read<String>('name'))
          .toList(growable: false);
      if (columns.isEmpty) {
        throw StateError('Required backup table $table is missing.');
      }
      final rows = await database.customSelect('SELECT * FROM "$table"').get();
      tables[table] = {
        'columns': columns,
        'rows': rows
            .map(
              (row) => columns
                  .map((column) => _portableValue(column, row.data[column]))
                  .toList(),
            )
            .toList(),
      };
    }
    return {
      'kind': kind,
      'schemaVersion': _schemaVersion,
      'createdAt': DateTime.now().toUtc().toIso8601String(),
      'sourceOwnerId': owner.read<String>('id'),
      'tables': tables,
      if (kind == 'BACKUP' && identity != null)
        'recoveryIdentity': DeviceIdentityService().recoveryPayload(identity!),
    };
  }

  Object? _portableValue(String column, Object? value) {
    if (!column.endsWith('_at') || value == null) return value;
    if (value is DateTime) return value.toUtc().toIso8601String();
    if (value is int) {
      return DateTime.fromMillisecondsSinceEpoch(
        value * 1000,
        isUtc: true,
      ).toIso8601String();
    }
    return value;
  }

  Future<List<int>> createArchive(
    List<int> recoveryKey, {
    String kind = 'BACKUP',
  }) async {
    if (recoveryKey.length != 32) {
      throw ArgumentError('Recovery key must be 32 bytes.');
    }
    if (kind != 'BACKUP' && kind != 'EXPORT') {
      throw ArgumentError.value(kind, 'kind');
    }
    final payload = utf8.encode(jsonEncode(await _snapshot(kind)));
    final random = Random.secure();
    final salt = List<int>.generate(32, (_) => random.nextInt(256));
    final nonce = List<int>.generate(12, (_) => random.nextInt(256));
    final box = await AesGcm.with256bits().encrypt(
      payload,
      secretKey: await _deriveKey(recoveryKey, salt),
      nonce: nonce,
      aad: utf8.encode('$_magic:$_formatVersion'),
    );
    return utf8.encode(jsonEncode({
      'magic': _magic,
      'formatVersion': _formatVersion,
      'cipher': 'AES-256-GCM',
      'kdf': 'HKDF-SHA-256',
      'salt': _unpaddedBase64(salt),
      'nonce': _unpaddedBase64(nonce),
      'ciphertext': _unpaddedBase64(box.cipherText),
      'authenticationTag': _unpaddedBase64(box.mac.bytes),
      'payloadSha256': _unpaddedBase64(crypto.sha256.convert(payload).bytes),
    }));
  }

  Future<Map<String, dynamic>> _decrypt(
    List<int> archive,
    String recoveryKey,
  ) async {
    try {
      final envelope = jsonDecode(utf8.decode(archive)) as Map<String, dynamic>;
      if (envelope['magic'] != _magic ||
          envelope['formatVersion'] != _formatVersion ||
          envelope['cipher'] != 'AES-256-GCM' ||
          envelope['kdf'] != 'HKDF-SHA-256') {
        throw const FormatException('Unsupported backup format.');
      }
      final salt = _decodeBase64(envelope['salt'] as String);
      final nonce = _decodeBase64(envelope['nonce'] as String);
      final payload = await AesGcm.with256bits().decrypt(
        SecretBox(
          _decodeBase64(envelope['ciphertext'] as String),
          nonce: nonce,
          mac: Mac(_decodeBase64(envelope['authenticationTag'] as String)),
        ),
        secretKey: await _deriveKey(_decodeRecoveryKey(recoveryKey), salt),
        aad: utf8.encode('$_magic:$_formatVersion'),
      );
      if (_unpaddedBase64(crypto.sha256.convert(payload).bytes) !=
          envelope['payloadSha256']) {
        throw const FormatException('Backup digest mismatch.');
      }
      final decoded = jsonDecode(utf8.decode(payload)) as Map<String, dynamic>;
      _validatePayload(decoded);
      return decoded;
    } catch (error) {
      throw FormatException(
        'Backup authentication failed. The key is wrong or the file was modified.',
        error,
      );
    }
  }

  void _validatePayload(Map<String, dynamic> payload) {
    final version = payload['schemaVersion'];
    if ((payload['kind'] != 'BACKUP' && payload['kind'] != 'EXPORT') ||
        version is! int ||
        version < 1 ||
        version > _schemaVersion ||
        payload['sourceOwnerId'] is! String) {
      throw const FormatException('Backup payload metadata is invalid.');
    }
    final tables = payload['tables'];
    if (tables is! Map<String, dynamic>) {
      throw const FormatException('Backup tables are missing.');
    }
    for (final table in portableTables) {
      final snapshot = tables[table];
      if (table == 'log_sections' && version < 4 && snapshot == null) {
        continue;
      }
      if (snapshot is! Map<String, dynamic> ||
          snapshot['columns'] is! List ||
          snapshot['rows'] is! List) {
        throw FormatException('Backup table $table is invalid.');
      }
      final columns = (snapshot['columns'] as List).cast<String>();
      if (columns.any((column) => !RegExp(r'^[a-z_]+$').hasMatch(column))) {
        throw FormatException(
            'Backup table $table contains an invalid column.');
      }
      for (final row in snapshot['rows'] as List) {
        if (row is! List || row.length != columns.length) {
          throw FormatException('Backup table $table contains an invalid row.');
        }
      }
    }
    final recoveryIdentity = payload['recoveryIdentity'];
    if (recoveryIdentity != null &&
        (recoveryIdentity is! Map<String, dynamic> ||
            recoveryIdentity['ownerId'] != payload['sourceOwnerId'] ||
            recoveryIdentity['deviceId'] is! String ||
            recoveryIdentity['privateKey'] is! String ||
            recoveryIdentity['publicKey'] is! String)) {
      throw const FormatException('Backup recovery identity is invalid.');
    }
  }

  Future<void> _import(AppDatabase target, Map<String, dynamic> payload) async {
    final tables = payload['tables'] as Map<String, dynamic>;
    await target.customStatement('PRAGMA foreign_keys = OFF');
    try {
      await target.transaction(() async {
        for (final table in portableTables.reversed) {
          await target.customStatement('DELETE FROM "$table"');
        }
        for (final table in portableTables) {
          final snapshot = tables[table];
          if (snapshot == null &&
              table == 'log_sections' &&
              (payload['schemaVersion'] as int) < 4) {
            continue;
          }
          if (snapshot is! Map<String, dynamic>) {
            throw FormatException('Backup table $table is missing.');
          }
          final columns = (snapshot['columns'] as List).cast<String>();
          final rows = snapshot['rows'] as List;
          if (rows.isEmpty) continue;
          final names = columns.map((column) => '"$column"').join(', ');
          final placeholders = List.filled(columns.length, '?').join(', ');
          for (final row in rows.cast<List>()) {
            final values = List<Object?>.generate(columns.length, (index) {
              final value = row[index];
              if (columns[index].endsWith('_at') && value is String) {
                return DateTime.parse(value).toUtc();
              }
              return value;
            });
            await target.customStatement(
              'INSERT INTO "$table" ($names) VALUES ($placeholders)',
              values,
            );
          }
        }
        if ((payload['schemaVersion'] as int) < 4) {
          await target.customStatement('''
            INSERT INTO log_sections (
              id, owner_id, check_in_id, revision_id, category_id, position,
              body, metadata_json, occurred_at, timezone_id, version, created_at
            )
            SELECT
              check_in_revisions.id, check_ins.owner_id, check_ins.id,
              check_in_revisions.id, check_ins.category_id, 0,
              check_in_revisions.body, '{}', check_ins.submitted_at,
              check_ins.timezone_id, check_in_revisions.id,
              check_in_revisions.created_at
            FROM check_in_revisions
            JOIN check_ins ON check_ins.id = check_in_revisions.check_in_id
          ''');
        }
      });
    } finally {
      await target.customStatement('PRAGMA foreign_keys = ON');
    }
    final problems =
        await target.customSelect('PRAGMA foreign_key_check').get();
    if (problems.isNotEmpty) {
      throw const FormatException(
          'Restored data violates referential integrity.');
    }
  }

  Future<Map<String, dynamic>> restoreArchive(
      List<int> archive, String recoveryKey,
      {DeviceIdentityService? identityService,
      DeviceIdentity? fallbackIdentity}) async {
    final payload = await _decrypt(archive, recoveryKey);
    final previousWarningSetting =
        driftRuntimeOptions.dontWarnAboutMultipleDatabases;
    driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
    final staging = AppDatabase.forTesting(NativeDatabase.memory());
    try {
      await _import(staging, payload);
      final owner = await staging.customSelect(
        'SELECT id FROM owners WHERE id = ?',
        variables: [
          Variable.withString(payload['sourceOwnerId'] as String),
        ],
      ).getSingleOrNull();
      if (owner == null) {
        throw const FormatException('Backup owner is missing.');
      }
      final integrity =
          await staging.customSelect('PRAGMA integrity_check').get();
      if (integrity.isEmpty || integrity.first.data.values.first != 'ok') {
        throw const FormatException(
            'Backup staging database failed integrity validation.');
      }
    } finally {
      await staging.close();
      driftRuntimeOptions.dontWarnAboutMultipleDatabases =
          previousWarningSetting;
    }
    await _import(database, payload);
    final recoveryIdentity = payload['recoveryIdentity'];
    if (recoveryIdentity is Map<String, dynamic> &&
        recoveryIdentity['platform'] == 'ANDROID' &&
        identityService != null) {
      await identityService.restoreFromBackup(recoveryIdentity);
    } else if (identityService != null && fallbackIdentity != null) {
      fallbackIdentity.ownerId = payload['sourceOwnerId'] as String;
      await identityService.save(fallbackIdentity);
    }
    return {
      'ownerId': payload['sourceOwnerId'],
      'createdAt': payload['createdAt'],
      'kind': payload['kind'],
    };
  }

  Future<File> writeArchiveAtomically(
    File destination,
    List<int> archive,
  ) async {
    final temporary = File('${destination.path}.tmp');
    await temporary.writeAsBytes(archive, flush: true);
    jsonDecode(await temporary.readAsString());
    if (await destination.exists()) await destination.delete();
    return temporary.rename(destination.path);
  }
}
