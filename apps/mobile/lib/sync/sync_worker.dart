import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:cryptography/cryptography.dart';
import 'package:drift/drift.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

import '../data/database/app_database.dart';
import '../identity/device_identity.dart';

class SyncWorker {
  SyncWorker({
    required this.database,
    required this.endpoint,
    required this.identity,
    DeviceIdentityService? identityService,
    http.Client? client,
    Future<List<ConnectivityResult>> Function()? connectivityCheck,
    DateTime Function()? clock,
  })  : _identityService = identityService ?? DeviceIdentityService(),
        _client = client ?? http.Client(),
        _connectivityCheck =
            connectivityCheck ?? Connectivity().checkConnectivity,
        _clock = clock ?? DateTime.now;

  final AppDatabase database;
  final Uri endpoint;
  final DeviceIdentity identity;
  final DeviceIdentityService _identityService;
  final http.Client _client;
  final Future<List<ConnectivityResult>> Function() _connectivityCheck;
  final DateTime Function() _clock;

  Future<SyncResult> synchronize() async {
    final connection = await _connectivityCheck();
    if (connection.contains(ConnectivityResult.none)) {
      return const SyncResult.offline();
    }
    final now = _clock().toUtc();
    final rows = await database.customSelect(
      'SELECT * FROM outbox_operations WHERE acknowledged_at IS NULL AND next_attempt_at <= ? ORDER BY device_sequence LIMIT 100',
      variables: [Variable.withDateTime(now)],
    ).get();
    var pushed = 0;

    if (rows.isNotEmpty) {
      try {
        final operations = rows
            .map((row) => {
                  'operationId': row.read<String>('operation_id'),
                  'deviceSequence': row.read<int>('device_sequence'),
                  'entityType': row.read<String>('entity_type'),
                  'entityId': row.read<String>('entity_id'),
                  'kind': row.read<String>('kind'),
                  if (row.readNullable<String>('base_version') != null)
                    'baseVersion': row.read<String>('base_version'),
                  'payload': jsonDecode(row.read<String>('payload_json')),
                  'occurredAt':
                      row.read<DateTime>('occurred_at').toIso8601String(),
                })
            .toList();
        final response = await _signedRequest(
            'POST', '/api/v1/sync/push', {'operations': operations});
        _ensureSuccess(response);
        final results = (jsonDecode(response.body)
            as Map<String, dynamic>)['results'] as List<dynamic>;
        await database.transaction(() async {
          for (final raw in results.whereType<Map<String, dynamic>>()) {
            final status = raw['status'] as String;
            if (status == 'accepted' ||
                status == 'duplicate' ||
                status == 'conflict') {
              await database.customStatement(
                'UPDATE outbox_operations SET acknowledged_at = ? WHERE operation_id = ?',
                [now, raw['operationId']],
              );
              if (status == 'conflict' || raw['conflictId'] != null) {
                await _storePushConflict(raw, rows, now);
              }
              pushed++;
            }
          }
        });
      } catch (error) {
        await _scheduleRetry(rows, now, error);
        return SyncResult.failed(error.toString());
      }
    }

    try {
      await _pullRemoteChanges();
    } catch (error) {
      return SyncResult.failed(error.toString(), pushed: pushed);
    }
    return SyncResult.synced(pushed);
  }

  Future<void> _scheduleRetry(
    List<QueryRow> rows,
    DateTime now,
    Object error,
  ) async {
    await database.transaction(() async {
      for (final row in rows) {
        final attempts = row.read<int>('attempts') + 1;
        final exponent = attempts.clamp(0, 8);
        final seconds = (1 << exponent).clamp(2, 300);
        final operationId = row.read<String>('operation_id');
        await database.customStatement(
          'UPDATE outbox_operations SET attempts = ?, next_attempt_at = ? WHERE operation_id = ? AND acknowledged_at IS NULL',
          [attempts, now.add(Duration(seconds: seconds)), operationId],
        );
        await database.customStatement(
          'INSERT OR REPLACE INTO sync_failures (operation_id, code, message, recorded_at) VALUES (?, ?, ?, ?)',
          [operationId, 'NETWORK_FAILURE', error.toString(), now],
        );
      }
    });
  }

  Future<void> _pullRemoteChanges() async {
    final cursorRow = await database.customSelect(
      'SELECT last_applied_sequence FROM sync_cursors WHERE owner_id = ? AND device_id = ?',
      variables: [
        Variable.withString(identity.ownerId),
        Variable.withString(identity.deviceId)
      ],
    ).getSingleOrNull();
    var cursor = cursorRow?.read<int>('last_applied_sequence') ?? 0;

    while (true) {
      final response =
          await _signedRequest('GET', '/api/v1/sync/pull?cursor=$cursor', {});
      _ensureSuccess(response);
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final changes = (body['changes'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (changes.isEmpty) break;
      final nextCursor = int.parse(body['nextCursor'].toString());
      await database.transaction(() async {
        for (final change in changes) {
          await _applyRemoteChange(change);
        }
        await database.customStatement(
          'INSERT OR REPLACE INTO sync_cursors (owner_id, device_id, last_applied_sequence, updated_at) VALUES (?, ?, ?, ?)',
          [
            identity.ownerId,
            identity.deviceId,
            nextCursor,
            DateTime.now().toUtc()
          ],
        );
      });
      cursor = nextCursor;
      final ack = await _signedRequest(
          'POST', '/api/v1/sync/ack', {'cursor': '$cursor'});
      _ensureSuccess(ack);
      if (changes.length < 100) break;
    }
  }

  Future<void> _applyRemoteChange(Map<String, dynamic> change) async {
    final operationId = change['operationId'] as String;
    final exists = await database.customSelect(
      'SELECT 1 FROM sync_operations WHERE operation_id = ?',
      variables: [Variable.withString(operationId)],
    ).getSingleOrNull();
    if (exists != null) return;

    final source = change['sourceDevice'] as Map<String, dynamic>;
    await database.customStatement(
      'INSERT INTO devices (id, owner_id, public_key, fingerprint, platform, display_name, is_owner_device, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at',
      [
        source['id'],
        identity.ownerId,
        source['publicKey'],
        source['fingerprint'],
        source['platform'],
        source['displayName'],
        source['isOwnerDevice'] == true ? 1 : 0,
        source['status'],
        DateTime.parse(source['createdAt'] as String),
        DateTime.parse(source['updatedAt'] as String)
      ],
    );

    final payload = change['payload'] as Map<String, dynamic>;
    if (change['status'] == 'CONFLICT') {
      await _storePulledConflict(change, payload);
    } else if (change['deviceId'] == identity.deviceId) {
      // The originating local transaction already applied this operation.
    } else {
      switch (change['kind']) {
        case 'check_in.create':
          await _applyCreate(change, payload);
          break;
        case 'check_in.revise':
          await _applyRevision(change, payload);
          break;
        case 'check_in.delete':
          await _applyDeletion(change, payload);
          break;
        case 'reminder.schedule':
          await _applyReminderSchedule(change, payload);
          break;
        case 'reminder.transition':
          await _applyReminderTransition(change, payload);
          break;
        case 'reminder.complete':
          await _applyReminderCompletion(change, payload);
          break;
      }
    }
    await database.customStatement(
      'INSERT INTO sync_operations (operation_id, owner_id, device_id, device_sequence, entity_type, entity_id, kind, base_version, payload_json, occurred_at, received_at, status, result_json, sequence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        operationId,
        identity.ownerId,
        change['deviceId'],
        int.parse(change['deviceSequence'].toString()),
        change['entityType'],
        change['entityId'],
        change['kind'],
        change['baseVersion'],
        jsonEncode(payload),
        DateTime.parse(change['occurredAt'] as String),
        DateTime.now().toUtc(),
        change['status'],
        change['result'] == null ? null : jsonEncode(change['result']),
        int.parse(change['sequence'].toString())
      ],
    );
  }

  Future<void> _applyReminderSchedule(
    Map<String, dynamic> change,
    Map<String, dynamic> payload,
  ) async {
    final occurrenceId = change['entityId'] as String;
    final existing = await database.customSelect(
      'SELECT 1 FROM reminder_occurrences WHERE id = ? AND owner_id = ?',
      variables: [
        Variable.withString(occurrenceId),
        Variable.withString(identity.ownerId),
      ],
    ).getSingleOrNull();
    if (existing != null) return;
    final mode = payload['mode'] as Map<String, dynamic>;
    final session = payload['session'] as Map<String, dynamic>;
    final occurrence = payload['occurrence'] as Map<String, dynamic>;
    final existingMode = await database.customSelect(
      'SELECT id FROM focus_modes WHERE owner_id = ? AND name = ?',
      variables: [
        Variable.withString(identity.ownerId),
        Variable.withString(mode['name'] as String),
      ],
    ).getSingleOrNull();
    final modeId = existingMode?.read<String>('id') ?? mode['id'] as String;
    if (existingMode == null) {
      await database.customStatement(
        'INSERT INTO focus_modes (id, owner_id, name, interval_minutes, policy_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          modeId,
          identity.ownerId,
          mode['name'],
          mode['intervalMinutes'],
          jsonEncode(mode['policy']),
          mode['version'],
          DateTime.parse(session['startedAt'] as String),
          DateTime.now().toUtc(),
        ],
      );
    }
    await database.customStatement(
      "INSERT OR IGNORE INTO focus_sessions (id, owner_id, focus_mode_id, name, status, schedule_policy_json, timezone_id, started_at, version, created_at, updated_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?)",
      [
        session['id'],
        identity.ownerId,
        modeId,
        session['name'],
        jsonEncode(session['schedulePolicy']),
        session['timezoneId'],
        DateTime.parse(session['startedAt'] as String),
        session['version'],
        DateTime.parse(session['startedAt'] as String),
        DateTime.now().toUtc(),
      ],
    );
    await database.customStatement(
      "INSERT INTO reminder_occurrences (id, owner_id, focus_session_id, state, scheduled_at, original_scheduled_at, timezone_id, policy_snapshot_json, version, created_at, updated_at) VALUES (?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?, ?, ?)",
      [
        occurrenceId,
        identity.ownerId,
        session['id'],
        DateTime.parse(occurrence['scheduledAt'] as String),
        DateTime.parse(occurrence['originalScheduledAt'] as String),
        occurrence['timezoneId'],
        jsonEncode(occurrence['policySnapshot']),
        occurrence['version'],
        DateTime.parse(change['occurredAt'] as String),
        DateTime.now().toUtc(),
      ],
    );
  }

  Future<void> _applyReminderTransition(
    Map<String, dynamic> change,
    Map<String, dynamic> payload,
  ) async {
    final occurrenceId = change['entityId'] as String;
    final current = await database.customSelect(
      'SELECT state, original_scheduled_at FROM reminder_occurrences WHERE id = ? AND owner_id = ?',
      variables: [
        Variable.withString(occurrenceId),
        Variable.withString(identity.ownerId),
      ],
    ).getSingleOrNull();
    if (current == null) {
      await _storePulledConflict(change, payload);
      return;
    }
    final currentState = current.read<String>('state');
    final targetState = payload['toState'] as String;
    if (currentState == targetState) return;
    const terminal = {
      'COMPLETED',
      'MISSED',
      'SKIPPED',
      'EMERGENCY_DISMISSED',
      'SUPERSEDED',
    };
    if (terminal.contains(currentState)) {
      await _storePulledConflict(change, payload);
      return;
    }
    final occurredAt = DateTime.parse(payload['occurredAt'] as String);
    final effectiveDueAt = payload['effectiveDueAt'] == null
        ? null
        : DateTime.parse(payload['effectiveDueAt'] as String);
    await database.customStatement(
      "UPDATE reminder_occurrences SET state = ?, scheduled_at = COALESCE(?, scheduled_at), presented_at = CASE WHEN ? = 'PRESENTED' THEN ? ELSE presented_at END, resolved_at = CASE WHEN ? IN ('COMPLETED','MISSED','SKIPPED','EMERGENCY_DISMISSED','SUPERSEDED') THEN ? ELSE resolved_at END, version = ?, updated_at = ? WHERE id = ?",
      [
        targetState,
        effectiveDueAt,
        targetState,
        occurredAt,
        targetState,
        occurredAt,
        change['operationId'],
        DateTime.now().toUtc(),
        occurrenceId,
      ],
    );
    await database.customStatement(
      'INSERT OR IGNORE INTO reminder_transitions (id, owner_id, reminder_occurrence_id, acting_device_id, from_state, to_state, reason, original_scheduled_at, occurred_at, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        payload['transitionId'],
        identity.ownerId,
        occurrenceId,
        change['deviceId'],
        currentState,
        targetState,
        payload['reason'],
        current.read<DateTime>('original_scheduled_at'),
        occurredAt,
        change['operationId'],
        DateTime.now().toUtc(),
      ],
    );
  }

  Future<void> _applyReminderCompletion(
    Map<String, dynamic> change,
    Map<String, dynamic> payload,
  ) async {
    await _applyReminderTransition(change, {
      'transitionId': payload['transitionId'],
      'toState': 'COMPLETED',
      'occurredAt': payload['completedAt'],
    });
    final occurrenceId = change['entityId'] as String;
    final existing = await database.customSelect(
      'SELECT id FROM check_ins WHERE reminder_occurrence_id = ?',
      variables: [Variable.withString(occurrenceId)],
    ).getSingleOrNull();
    if (existing != null) {
      if (existing.read<String>('id') != payload['checkInId']) {
        await _storePulledConflict(change, payload);
      }
      return;
    }
    final occurrence = await database.customSelect(
      'SELECT focus_session_id, timezone_id, state FROM reminder_occurrences WHERE id = ?',
      variables: [Variable.withString(occurrenceId)],
    ).getSingleOrNull();
    if (occurrence == null) return;
    final completedAt = DateTime.parse(payload['completedAt'] as String);
    if (occurrence.read<String>('state') != 'COMPLETED') {
      await database.customStatement(
        "UPDATE reminder_occurrences SET state = 'COMPLETED', resolved_at = ?, version = ?, updated_at = ? WHERE id = ?",
        [
          completedAt,
          change['operationId'],
          DateTime.now().toUtc(),
          occurrenceId
        ],
      );
    }
    await database.customStatement(
      'INSERT INTO check_ins (id, owner_id, reminder_occurrence_id, focus_session_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        payload['checkInId'],
        identity.ownerId,
        occurrenceId,
        occurrence.read<String>('focus_session_id'),
        payload['revisionId'],
        completedAt,
        occurrence.read<String>('timezone_id'),
        payload['revisionId'],
        completedAt,
        DateTime.now().toUtc(),
      ],
    );
    await database.customStatement(
      'INSERT OR IGNORE INTO check_in_revisions (id, check_in_id, body, author_device_id, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        payload['revisionId'],
        payload['checkInId'],
        payload['body'],
        change['deviceId'],
        change['operationId'],
        completedAt,
      ],
    );
  }

  Future<void> _applyCreate(
    Map<String, dynamic> change,
    Map<String, dynamic> payload,
  ) async {
    final entityId = change['entityId'] as String;
    final tombstone = await database.customSelect(
      "SELECT 1 FROM tombstones WHERE owner_id = ? AND entity_type = 'check_in' AND entity_id = ?",
      variables: [
        Variable.withString(identity.ownerId),
        Variable.withString(entityId)
      ],
    ).getSingleOrNull();
    if (tombstone != null) return;
    final current = await _current(entityId);
    if (current != null) {
      if (current['revisionId'] != payload['revisionId']) {
        await _storePulledConflict(change, payload);
      }
      return;
    }
    final submittedAt = DateTime.parse(payload['submittedAt'] as String);
    await database.customStatement(
      'INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        entityId,
        identity.ownerId,
        payload['revisionId'],
        submittedAt,
        payload['timezoneId'],
        payload['revisionId'],
        submittedAt,
        DateTime.now().toUtc()
      ],
    );
    await database.customStatement(
      'INSERT OR IGNORE INTO check_in_revisions (id, check_in_id, body, author_device_id, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        payload['revisionId'],
        entityId,
        payload['body'],
        change['deviceId'],
        change['operationId'],
        submittedAt
      ],
    );
  }

  Future<void> _applyRevision(
    Map<String, dynamic> change,
    Map<String, dynamic> payload,
  ) async {
    final entityId = change['entityId'] as String;
    final current = await _current(entityId);
    if (current == null || current['deletedAt'] != null) {
      await _storePulledConflict(change, payload);
      return;
    }
    if (current['revisionId'] == payload['revisionId']) return;
    if (current['revisionId'] != change['baseVersion']) {
      await _storePulledConflict(change, payload);
      return;
    }
    final createdAt = DateTime.parse(payload['createdAt'] as String);
    await database.customStatement(
      'INSERT OR IGNORE INTO check_in_revisions (id, check_in_id, parent_revision_id, body, author_device_id, operation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        payload['revisionId'],
        entityId,
        change['baseVersion'],
        payload['body'],
        change['deviceId'],
        change['operationId'],
        createdAt
      ],
    );
    await database.customStatement(
      'UPDATE check_ins SET current_revision_id = ?, version = ?, updated_at = ? WHERE id = ?',
      [
        payload['revisionId'],
        payload['revisionId'],
        DateTime.now().toUtc(),
        entityId
      ],
    );
  }

  Future<void> _applyDeletion(
    Map<String, dynamic> change,
    Map<String, dynamic> payload,
  ) async {
    final entityId = change['entityId'] as String;
    final current = await _current(entityId);
    if (current == null ||
        (current['deletedAt'] == null &&
            current['revisionId'] != change['baseVersion'])) {
      await _storePulledConflict(change, payload);
      return;
    }
    final deletedAt = DateTime.parse(payload['deletedAt'] as String);
    await database.customStatement(
      'UPDATE check_ins SET deleted_at = ?, version = ?, updated_at = ? WHERE id = ?',
      [deletedAt, change['operationId'], DateTime.now().toUtc(), entityId],
    );
    await database.customStatement(
      'INSERT OR REPLACE INTO tombstones (id, owner_id, entity_type, entity_id, version, deleted_at, retention_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        generateSyncId(),
        identity.ownerId,
        'check_in',
        entityId,
        change['operationId'],
        deletedAt,
        deletedAt.add(const Duration(days: 180)),
        DateTime.now().toUtc()
      ],
    );
  }

  Future<Map<String, dynamic>?> _current(String checkInId) async {
    final row = await database.customSelect(
      'SELECT check_ins.current_revision_id AS revision_id, check_ins.deleted_at, check_in_revisions.body, check_in_revisions.created_at FROM check_ins LEFT JOIN check_in_revisions ON check_in_revisions.id = check_ins.current_revision_id WHERE check_ins.id = ?',
      variables: [Variable.withString(checkInId)],
    ).getSingleOrNull();
    if (row == null) return null;
    return {
      'revisionId': row.readNullable<String>('revision_id'),
      'body': row.readNullable<String>('body'),
      'createdAt': row.readNullable<DateTime>('created_at')?.toIso8601String(),
      'deletedAt': row.readNullable<DateTime>('deleted_at')?.toIso8601String()
    };
  }

  Future<void> _storePushConflict(
    Map<String, dynamic> result,
    List<QueryRow> rows,
    DateTime now,
  ) async {
    QueryRow? operation;
    for (final row in rows) {
      if (row.read<String>('operation_id') == result['operationId']) {
        operation = row;
        break;
      }
    }
    if (operation == null) return;
    final entityId = operation.read<String>('entity_id');
    await database.customStatement(
      'INSERT OR IGNORE INTO conflicts (id, owner_id, entity_type, entity_id, local_operation_id, remote_operation_id, local_payload_json, remote_payload_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        result['conflictId'] ?? result['operationId'],
        identity.ownerId,
        operation.read<String>('entity_type'),
        entityId,
        operation.readNullable<String>('base_version'),
        operation.read<String>('operation_id'),
        jsonEncode(await _current(entityId)),
        operation.read<String>('payload_json'),
        'OPEN',
        now
      ],
    );
  }

  Future<void> _storePulledConflict(
    Map<String, dynamic> change,
    Map<String, dynamic> remotePayload,
  ) async {
    final result = change['result'] as Map<String, dynamic>?;
    await database.customStatement(
      'INSERT OR IGNORE INTO conflicts (id, owner_id, entity_type, entity_id, local_operation_id, remote_operation_id, local_payload_json, remote_payload_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        result?['conflictId'] ?? change['operationId'],
        identity.ownerId,
        change['entityType'],
        change['entityId'],
        change['baseVersion'],
        change['operationId'],
        jsonEncode(await _current(change['entityId'] as String)),
        jsonEncode(remotePayload),
        'OPEN',
        DateTime.now().toUtc()
      ],
    );
  }

  Future<http.Response> _signedRequest(
      String method, String path, Object body) async {
    final timestamp = DateTime.now().toUtc().toIso8601String();
    final nonce = const Uuid().v4();
    final bodyJson = jsonEncode(body);
    final bodyHash =
        base64UrlEncode((await Sha256().hash(utf8.encode(bodyJson))).bytes)
            .replaceAll('=', '');
    final canonical =
        '${method.toUpperCase()}\n$path\n$timestamp\n$nonce\n$bodyHash';
    final signature = await _identityService.sign(identity, canonical);
    return _client
        .send(http.Request(method, endpoint.resolve(path))
          ..headers.addAll({
            'content-type': 'application/json',
            'x-focuslog-device-id': identity.deviceId,
            'x-focuslog-timestamp': timestamp,
            'x-focuslog-nonce': nonce,
            'x-focuslog-signature': signature
          })
          ..body = bodyJson)
        .then(http.Response.fromStream);
  }

  void _ensureSuccess(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw http.ClientException(
          'Sync server returned ${response.statusCode}.', endpoint);
    }
  }

  void dispose() => _client.close();
}

class SyncResult {
  const SyncResult._(this.status, this.pushed, this.message);
  const SyncResult.offline()
      : this._('offline', 0, 'No usable network connection.');
  const SyncResult.synced(int pushed) : this._('synced', pushed, null);
  const SyncResult.failed(String message, {int pushed = 0})
      : this._('retrying', pushed, message);
  final String status;
  final int pushed;
  final String? message;
}
