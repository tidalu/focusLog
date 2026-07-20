// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $OwnersTable extends Owners with TableInfo<$OwnersTable, Owner> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OwnersTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [id, createdAt, updatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'owners';
  @override
  VerificationContext validateIntegrity(Insertable<Owner> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Owner map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Owner(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
    );
  }

  @override
  $OwnersTable createAlias(String alias) {
    return $OwnersTable(attachedDatabase, alias);
  }
}

class Owner extends DataClass implements Insertable<Owner> {
  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  const Owner(
      {required this.id, required this.createdAt, required this.updatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  OwnersCompanion toCompanion(bool nullToAbsent) {
    return OwnersCompanion(
      id: Value(id),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory Owner.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Owner(
      id: serializer.fromJson<String>(json['id']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  Owner copyWith({String? id, DateTime? createdAt, DateTime? updatedAt}) =>
      Owner(
        id: id ?? this.id,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );
  Owner copyWithCompanion(OwnersCompanion data) {
    return Owner(
      id: data.id.present ? data.id.value : this.id,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Owner(')
          ..write('id: $id, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, createdAt, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Owner &&
          other.id == this.id &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class OwnersCompanion extends UpdateCompanion<Owner> {
  final Value<String> id;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const OwnersCompanion({
    this.id = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  OwnersCompanion.insert({
    required String id,
    required DateTime createdAt,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        createdAt = Value(createdAt),
        updatedAt = Value(updatedAt);
  static Insertable<Owner> custom({
    Expression<String>? id,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  OwnersCompanion copyWith(
      {Value<String>? id,
      Value<DateTime>? createdAt,
      Value<DateTime>? updatedAt,
      Value<int>? rowid}) {
    return OwnersCompanion(
      id: id ?? this.id,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OwnersCompanion(')
          ..write('id: $id, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DevicesTable extends Devices with TableInfo<$DevicesTable, Device> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DevicesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _publicKeyMeta =
      const VerificationMeta('publicKey');
  @override
  late final GeneratedColumn<String> publicKey = GeneratedColumn<String>(
      'public_key', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: true,
      defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'));
  static const VerificationMeta _fingerprintMeta =
      const VerificationMeta('fingerprint');
  @override
  late final GeneratedColumn<String> fingerprint = GeneratedColumn<String>(
      'fingerprint', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: true,
      defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'));
  static const VerificationMeta _platformMeta =
      const VerificationMeta('platform');
  @override
  late final GeneratedColumn<String> platform = GeneratedColumn<String>(
      'platform', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _displayNameMeta =
      const VerificationMeta('displayName');
  @override
  late final GeneratedColumn<String> displayName = GeneratedColumn<String>(
      'display_name', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _capabilitiesJsonMeta =
      const VerificationMeta('capabilitiesJson');
  @override
  late final GeneratedColumn<String> capabilitiesJson = GeneratedColumn<String>(
      'capabilities_json', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _isOwnerDeviceMeta =
      const VerificationMeta('isOwnerDevice');
  @override
  late final GeneratedColumn<bool> isOwnerDevice = GeneratedColumn<bool>(
      'is_owner_device', aliasedName, false,
      type: DriftSqlType.bool,
      requiredDuringInsert: false,
      defaultConstraints: GeneratedColumn.constraintIsAlways(
          'CHECK ("is_owner_device" IN (0, 1))'),
      defaultValue: const Constant(false));
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('ACTIVE'));
  static const VerificationMeta _lastSeenAtMeta =
      const VerificationMeta('lastSeenAt');
  @override
  late final GeneratedColumn<DateTime> lastSeenAt = GeneratedColumn<DateTime>(
      'last_seen_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _revokedAtMeta =
      const VerificationMeta('revokedAt');
  @override
  late final GeneratedColumn<DateTime> revokedAt = GeneratedColumn<DateTime>(
      'revoked_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        ownerId,
        publicKey,
        fingerprint,
        platform,
        displayName,
        capabilitiesJson,
        isOwnerDevice,
        status,
        lastSeenAt,
        revokedAt,
        createdAt,
        updatedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'devices';
  @override
  VerificationContext validateIntegrity(Insertable<Device> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('public_key')) {
      context.handle(_publicKeyMeta,
          publicKey.isAcceptableOrUnknown(data['public_key']!, _publicKeyMeta));
    } else if (isInserting) {
      context.missing(_publicKeyMeta);
    }
    if (data.containsKey('fingerprint')) {
      context.handle(
          _fingerprintMeta,
          fingerprint.isAcceptableOrUnknown(
              data['fingerprint']!, _fingerprintMeta));
    } else if (isInserting) {
      context.missing(_fingerprintMeta);
    }
    if (data.containsKey('platform')) {
      context.handle(_platformMeta,
          platform.isAcceptableOrUnknown(data['platform']!, _platformMeta));
    } else if (isInserting) {
      context.missing(_platformMeta);
    }
    if (data.containsKey('display_name')) {
      context.handle(
          _displayNameMeta,
          displayName.isAcceptableOrUnknown(
              data['display_name']!, _displayNameMeta));
    }
    if (data.containsKey('capabilities_json')) {
      context.handle(
          _capabilitiesJsonMeta,
          capabilitiesJson.isAcceptableOrUnknown(
              data['capabilities_json']!, _capabilitiesJsonMeta));
    }
    if (data.containsKey('is_owner_device')) {
      context.handle(
          _isOwnerDeviceMeta,
          isOwnerDevice.isAcceptableOrUnknown(
              data['is_owner_device']!, _isOwnerDeviceMeta));
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('last_seen_at')) {
      context.handle(
          _lastSeenAtMeta,
          lastSeenAt.isAcceptableOrUnknown(
              data['last_seen_at']!, _lastSeenAtMeta));
    }
    if (data.containsKey('revoked_at')) {
      context.handle(_revokedAtMeta,
          revokedAt.isAcceptableOrUnknown(data['revoked_at']!, _revokedAtMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Device map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Device(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      publicKey: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}public_key'])!,
      fingerprint: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}fingerprint'])!,
      platform: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}platform'])!,
      displayName: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}display_name']),
      capabilitiesJson: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}capabilities_json']),
      isOwnerDevice: attachedDatabase.typeMapping
          .read(DriftSqlType.bool, data['${effectivePrefix}is_owner_device'])!,
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      lastSeenAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}last_seen_at']),
      revokedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}revoked_at']),
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
    );
  }

  @override
  $DevicesTable createAlias(String alias) {
    return $DevicesTable(attachedDatabase, alias);
  }
}

class Device extends DataClass implements Insertable<Device> {
  final String id;
  final String ownerId;
  final String publicKey;
  final String fingerprint;
  final String platform;
  final String? displayName;
  final String? capabilitiesJson;
  final bool isOwnerDevice;
  final String status;
  final DateTime? lastSeenAt;
  final DateTime? revokedAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  const Device(
      {required this.id,
      required this.ownerId,
      required this.publicKey,
      required this.fingerprint,
      required this.platform,
      this.displayName,
      this.capabilitiesJson,
      required this.isOwnerDevice,
      required this.status,
      this.lastSeenAt,
      this.revokedAt,
      required this.createdAt,
      required this.updatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_id'] = Variable<String>(ownerId);
    map['public_key'] = Variable<String>(publicKey);
    map['fingerprint'] = Variable<String>(fingerprint);
    map['platform'] = Variable<String>(platform);
    if (!nullToAbsent || displayName != null) {
      map['display_name'] = Variable<String>(displayName);
    }
    if (!nullToAbsent || capabilitiesJson != null) {
      map['capabilities_json'] = Variable<String>(capabilitiesJson);
    }
    map['is_owner_device'] = Variable<bool>(isOwnerDevice);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || lastSeenAt != null) {
      map['last_seen_at'] = Variable<DateTime>(lastSeenAt);
    }
    if (!nullToAbsent || revokedAt != null) {
      map['revoked_at'] = Variable<DateTime>(revokedAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  DevicesCompanion toCompanion(bool nullToAbsent) {
    return DevicesCompanion(
      id: Value(id),
      ownerId: Value(ownerId),
      publicKey: Value(publicKey),
      fingerprint: Value(fingerprint),
      platform: Value(platform),
      displayName: displayName == null && nullToAbsent
          ? const Value.absent()
          : Value(displayName),
      capabilitiesJson: capabilitiesJson == null && nullToAbsent
          ? const Value.absent()
          : Value(capabilitiesJson),
      isOwnerDevice: Value(isOwnerDevice),
      status: Value(status),
      lastSeenAt: lastSeenAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSeenAt),
      revokedAt: revokedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(revokedAt),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory Device.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Device(
      id: serializer.fromJson<String>(json['id']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      publicKey: serializer.fromJson<String>(json['publicKey']),
      fingerprint: serializer.fromJson<String>(json['fingerprint']),
      platform: serializer.fromJson<String>(json['platform']),
      displayName: serializer.fromJson<String?>(json['displayName']),
      capabilitiesJson: serializer.fromJson<String?>(json['capabilitiesJson']),
      isOwnerDevice: serializer.fromJson<bool>(json['isOwnerDevice']),
      status: serializer.fromJson<String>(json['status']),
      lastSeenAt: serializer.fromJson<DateTime?>(json['lastSeenAt']),
      revokedAt: serializer.fromJson<DateTime?>(json['revokedAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerId': serializer.toJson<String>(ownerId),
      'publicKey': serializer.toJson<String>(publicKey),
      'fingerprint': serializer.toJson<String>(fingerprint),
      'platform': serializer.toJson<String>(platform),
      'displayName': serializer.toJson<String?>(displayName),
      'capabilitiesJson': serializer.toJson<String?>(capabilitiesJson),
      'isOwnerDevice': serializer.toJson<bool>(isOwnerDevice),
      'status': serializer.toJson<String>(status),
      'lastSeenAt': serializer.toJson<DateTime?>(lastSeenAt),
      'revokedAt': serializer.toJson<DateTime?>(revokedAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  Device copyWith(
          {String? id,
          String? ownerId,
          String? publicKey,
          String? fingerprint,
          String? platform,
          Value<String?> displayName = const Value.absent(),
          Value<String?> capabilitiesJson = const Value.absent(),
          bool? isOwnerDevice,
          String? status,
          Value<DateTime?> lastSeenAt = const Value.absent(),
          Value<DateTime?> revokedAt = const Value.absent(),
          DateTime? createdAt,
          DateTime? updatedAt}) =>
      Device(
        id: id ?? this.id,
        ownerId: ownerId ?? this.ownerId,
        publicKey: publicKey ?? this.publicKey,
        fingerprint: fingerprint ?? this.fingerprint,
        platform: platform ?? this.platform,
        displayName: displayName.present ? displayName.value : this.displayName,
        capabilitiesJson: capabilitiesJson.present
            ? capabilitiesJson.value
            : this.capabilitiesJson,
        isOwnerDevice: isOwnerDevice ?? this.isOwnerDevice,
        status: status ?? this.status,
        lastSeenAt: lastSeenAt.present ? lastSeenAt.value : this.lastSeenAt,
        revokedAt: revokedAt.present ? revokedAt.value : this.revokedAt,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );
  Device copyWithCompanion(DevicesCompanion data) {
    return Device(
      id: data.id.present ? data.id.value : this.id,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      publicKey: data.publicKey.present ? data.publicKey.value : this.publicKey,
      fingerprint:
          data.fingerprint.present ? data.fingerprint.value : this.fingerprint,
      platform: data.platform.present ? data.platform.value : this.platform,
      displayName:
          data.displayName.present ? data.displayName.value : this.displayName,
      capabilitiesJson: data.capabilitiesJson.present
          ? data.capabilitiesJson.value
          : this.capabilitiesJson,
      isOwnerDevice: data.isOwnerDevice.present
          ? data.isOwnerDevice.value
          : this.isOwnerDevice,
      status: data.status.present ? data.status.value : this.status,
      lastSeenAt:
          data.lastSeenAt.present ? data.lastSeenAt.value : this.lastSeenAt,
      revokedAt: data.revokedAt.present ? data.revokedAt.value : this.revokedAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Device(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('publicKey: $publicKey, ')
          ..write('fingerprint: $fingerprint, ')
          ..write('platform: $platform, ')
          ..write('displayName: $displayName, ')
          ..write('capabilitiesJson: $capabilitiesJson, ')
          ..write('isOwnerDevice: $isOwnerDevice, ')
          ..write('status: $status, ')
          ..write('lastSeenAt: $lastSeenAt, ')
          ..write('revokedAt: $revokedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      ownerId,
      publicKey,
      fingerprint,
      platform,
      displayName,
      capabilitiesJson,
      isOwnerDevice,
      status,
      lastSeenAt,
      revokedAt,
      createdAt,
      updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Device &&
          other.id == this.id &&
          other.ownerId == this.ownerId &&
          other.publicKey == this.publicKey &&
          other.fingerprint == this.fingerprint &&
          other.platform == this.platform &&
          other.displayName == this.displayName &&
          other.capabilitiesJson == this.capabilitiesJson &&
          other.isOwnerDevice == this.isOwnerDevice &&
          other.status == this.status &&
          other.lastSeenAt == this.lastSeenAt &&
          other.revokedAt == this.revokedAt &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class DevicesCompanion extends UpdateCompanion<Device> {
  final Value<String> id;
  final Value<String> ownerId;
  final Value<String> publicKey;
  final Value<String> fingerprint;
  final Value<String> platform;
  final Value<String?> displayName;
  final Value<String?> capabilitiesJson;
  final Value<bool> isOwnerDevice;
  final Value<String> status;
  final Value<DateTime?> lastSeenAt;
  final Value<DateTime?> revokedAt;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const DevicesCompanion({
    this.id = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.publicKey = const Value.absent(),
    this.fingerprint = const Value.absent(),
    this.platform = const Value.absent(),
    this.displayName = const Value.absent(),
    this.capabilitiesJson = const Value.absent(),
    this.isOwnerDevice = const Value.absent(),
    this.status = const Value.absent(),
    this.lastSeenAt = const Value.absent(),
    this.revokedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DevicesCompanion.insert({
    required String id,
    required String ownerId,
    required String publicKey,
    required String fingerprint,
    required String platform,
    this.displayName = const Value.absent(),
    this.capabilitiesJson = const Value.absent(),
    this.isOwnerDevice = const Value.absent(),
    this.status = const Value.absent(),
    this.lastSeenAt = const Value.absent(),
    this.revokedAt = const Value.absent(),
    required DateTime createdAt,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerId = Value(ownerId),
        publicKey = Value(publicKey),
        fingerprint = Value(fingerprint),
        platform = Value(platform),
        createdAt = Value(createdAt),
        updatedAt = Value(updatedAt);
  static Insertable<Device> custom({
    Expression<String>? id,
    Expression<String>? ownerId,
    Expression<String>? publicKey,
    Expression<String>? fingerprint,
    Expression<String>? platform,
    Expression<String>? displayName,
    Expression<String>? capabilitiesJson,
    Expression<bool>? isOwnerDevice,
    Expression<String>? status,
    Expression<DateTime>? lastSeenAt,
    Expression<DateTime>? revokedAt,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerId != null) 'owner_id': ownerId,
      if (publicKey != null) 'public_key': publicKey,
      if (fingerprint != null) 'fingerprint': fingerprint,
      if (platform != null) 'platform': platform,
      if (displayName != null) 'display_name': displayName,
      if (capabilitiesJson != null) 'capabilities_json': capabilitiesJson,
      if (isOwnerDevice != null) 'is_owner_device': isOwnerDevice,
      if (status != null) 'status': status,
      if (lastSeenAt != null) 'last_seen_at': lastSeenAt,
      if (revokedAt != null) 'revoked_at': revokedAt,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DevicesCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerId,
      Value<String>? publicKey,
      Value<String>? fingerprint,
      Value<String>? platform,
      Value<String?>? displayName,
      Value<String?>? capabilitiesJson,
      Value<bool>? isOwnerDevice,
      Value<String>? status,
      Value<DateTime?>? lastSeenAt,
      Value<DateTime?>? revokedAt,
      Value<DateTime>? createdAt,
      Value<DateTime>? updatedAt,
      Value<int>? rowid}) {
    return DevicesCompanion(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      publicKey: publicKey ?? this.publicKey,
      fingerprint: fingerprint ?? this.fingerprint,
      platform: platform ?? this.platform,
      displayName: displayName ?? this.displayName,
      capabilitiesJson: capabilitiesJson ?? this.capabilitiesJson,
      isOwnerDevice: isOwnerDevice ?? this.isOwnerDevice,
      status: status ?? this.status,
      lastSeenAt: lastSeenAt ?? this.lastSeenAt,
      revokedAt: revokedAt ?? this.revokedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (publicKey.present) {
      map['public_key'] = Variable<String>(publicKey.value);
    }
    if (fingerprint.present) {
      map['fingerprint'] = Variable<String>(fingerprint.value);
    }
    if (platform.present) {
      map['platform'] = Variable<String>(platform.value);
    }
    if (displayName.present) {
      map['display_name'] = Variable<String>(displayName.value);
    }
    if (capabilitiesJson.present) {
      map['capabilities_json'] = Variable<String>(capabilitiesJson.value);
    }
    if (isOwnerDevice.present) {
      map['is_owner_device'] = Variable<bool>(isOwnerDevice.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (lastSeenAt.present) {
      map['last_seen_at'] = Variable<DateTime>(lastSeenAt.value);
    }
    if (revokedAt.present) {
      map['revoked_at'] = Variable<DateTime>(revokedAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DevicesCompanion(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('publicKey: $publicKey, ')
          ..write('fingerprint: $fingerprint, ')
          ..write('platform: $platform, ')
          ..write('displayName: $displayName, ')
          ..write('capabilitiesJson: $capabilitiesJson, ')
          ..write('isOwnerDevice: $isOwnerDevice, ')
          ..write('status: $status, ')
          ..write('lastSeenAt: $lastSeenAt, ')
          ..write('revokedAt: $revokedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DevicePairingsTable extends DevicePairings
    with TableInfo<$DevicePairingsTable, DevicePairing> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DevicePairingsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _candidatePublicKeyMeta =
      const VerificationMeta('candidatePublicKey');
  @override
  late final GeneratedColumn<String> candidatePublicKey =
      GeneratedColumn<String>('candidate_public_key', aliasedName, false,
          type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _candidateFingerprintMeta =
      const VerificationMeta('candidateFingerprint');
  @override
  late final GeneratedColumn<String> candidateFingerprint =
      GeneratedColumn<String>('candidate_fingerprint', aliasedName, false,
          type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _candidatePlatformMeta =
      const VerificationMeta('candidatePlatform');
  @override
  late final GeneratedColumn<String> candidatePlatform =
      GeneratedColumn<String>('candidate_platform', aliasedName, false,
          type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('PENDING'));
  static const VerificationMeta _approvedByDeviceIdMeta =
      const VerificationMeta('approvedByDeviceId');
  @override
  late final GeneratedColumn<String> approvedByDeviceId =
      GeneratedColumn<String>('approved_by_device_id', aliasedName, true,
          type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _expiresAtMeta =
      const VerificationMeta('expiresAt');
  @override
  late final GeneratedColumn<DateTime> expiresAt = GeneratedColumn<DateTime>(
      'expires_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _approvedAtMeta =
      const VerificationMeta('approvedAt');
  @override
  late final GeneratedColumn<DateTime> approvedAt = GeneratedColumn<DateTime>(
      'approved_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _consumedAtMeta =
      const VerificationMeta('consumedAt');
  @override
  late final GeneratedColumn<DateTime> consumedAt = GeneratedColumn<DateTime>(
      'consumed_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _cancelledAtMeta =
      const VerificationMeta('cancelledAt');
  @override
  late final GeneratedColumn<DateTime> cancelledAt = GeneratedColumn<DateTime>(
      'cancelled_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        ownerId,
        candidatePublicKey,
        candidateFingerprint,
        candidatePlatform,
        status,
        approvedByDeviceId,
        expiresAt,
        approvedAt,
        consumedAt,
        cancelledAt,
        createdAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'device_pairings';
  @override
  VerificationContext validateIntegrity(Insertable<DevicePairing> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('candidate_public_key')) {
      context.handle(
          _candidatePublicKeyMeta,
          candidatePublicKey.isAcceptableOrUnknown(
              data['candidate_public_key']!, _candidatePublicKeyMeta));
    } else if (isInserting) {
      context.missing(_candidatePublicKeyMeta);
    }
    if (data.containsKey('candidate_fingerprint')) {
      context.handle(
          _candidateFingerprintMeta,
          candidateFingerprint.isAcceptableOrUnknown(
              data['candidate_fingerprint']!, _candidateFingerprintMeta));
    } else if (isInserting) {
      context.missing(_candidateFingerprintMeta);
    }
    if (data.containsKey('candidate_platform')) {
      context.handle(
          _candidatePlatformMeta,
          candidatePlatform.isAcceptableOrUnknown(
              data['candidate_platform']!, _candidatePlatformMeta));
    } else if (isInserting) {
      context.missing(_candidatePlatformMeta);
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('approved_by_device_id')) {
      context.handle(
          _approvedByDeviceIdMeta,
          approvedByDeviceId.isAcceptableOrUnknown(
              data['approved_by_device_id']!, _approvedByDeviceIdMeta));
    }
    if (data.containsKey('expires_at')) {
      context.handle(_expiresAtMeta,
          expiresAt.isAcceptableOrUnknown(data['expires_at']!, _expiresAtMeta));
    } else if (isInserting) {
      context.missing(_expiresAtMeta);
    }
    if (data.containsKey('approved_at')) {
      context.handle(
          _approvedAtMeta,
          approvedAt.isAcceptableOrUnknown(
              data['approved_at']!, _approvedAtMeta));
    }
    if (data.containsKey('consumed_at')) {
      context.handle(
          _consumedAtMeta,
          consumedAt.isAcceptableOrUnknown(
              data['consumed_at']!, _consumedAtMeta));
    }
    if (data.containsKey('cancelled_at')) {
      context.handle(
          _cancelledAtMeta,
          cancelledAt.isAcceptableOrUnknown(
              data['cancelled_at']!, _cancelledAtMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  DevicePairing map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DevicePairing(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      candidatePublicKey: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}candidate_public_key'])!,
      candidateFingerprint: attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}candidate_fingerprint'])!,
      candidatePlatform: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}candidate_platform'])!,
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      approvedByDeviceId: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}approved_by_device_id']),
      expiresAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}expires_at'])!,
      approvedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}approved_at']),
      consumedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}consumed_at']),
      cancelledAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cancelled_at']),
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
    );
  }

  @override
  $DevicePairingsTable createAlias(String alias) {
    return $DevicePairingsTable(attachedDatabase, alias);
  }
}

class DevicePairing extends DataClass implements Insertable<DevicePairing> {
  final String id;
  final String ownerId;
  final String candidatePublicKey;
  final String candidateFingerprint;
  final String candidatePlatform;
  final String status;
  final String? approvedByDeviceId;
  final DateTime expiresAt;
  final DateTime? approvedAt;
  final DateTime? consumedAt;
  final DateTime? cancelledAt;
  final DateTime createdAt;
  const DevicePairing(
      {required this.id,
      required this.ownerId,
      required this.candidatePublicKey,
      required this.candidateFingerprint,
      required this.candidatePlatform,
      required this.status,
      this.approvedByDeviceId,
      required this.expiresAt,
      this.approvedAt,
      this.consumedAt,
      this.cancelledAt,
      required this.createdAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_id'] = Variable<String>(ownerId);
    map['candidate_public_key'] = Variable<String>(candidatePublicKey);
    map['candidate_fingerprint'] = Variable<String>(candidateFingerprint);
    map['candidate_platform'] = Variable<String>(candidatePlatform);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || approvedByDeviceId != null) {
      map['approved_by_device_id'] = Variable<String>(approvedByDeviceId);
    }
    map['expires_at'] = Variable<DateTime>(expiresAt);
    if (!nullToAbsent || approvedAt != null) {
      map['approved_at'] = Variable<DateTime>(approvedAt);
    }
    if (!nullToAbsent || consumedAt != null) {
      map['consumed_at'] = Variable<DateTime>(consumedAt);
    }
    if (!nullToAbsent || cancelledAt != null) {
      map['cancelled_at'] = Variable<DateTime>(cancelledAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  DevicePairingsCompanion toCompanion(bool nullToAbsent) {
    return DevicePairingsCompanion(
      id: Value(id),
      ownerId: Value(ownerId),
      candidatePublicKey: Value(candidatePublicKey),
      candidateFingerprint: Value(candidateFingerprint),
      candidatePlatform: Value(candidatePlatform),
      status: Value(status),
      approvedByDeviceId: approvedByDeviceId == null && nullToAbsent
          ? const Value.absent()
          : Value(approvedByDeviceId),
      expiresAt: Value(expiresAt),
      approvedAt: approvedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(approvedAt),
      consumedAt: consumedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(consumedAt),
      cancelledAt: cancelledAt == null && nullToAbsent
          ? const Value.absent()
          : Value(cancelledAt),
      createdAt: Value(createdAt),
    );
  }

  factory DevicePairing.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DevicePairing(
      id: serializer.fromJson<String>(json['id']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      candidatePublicKey:
          serializer.fromJson<String>(json['candidatePublicKey']),
      candidateFingerprint:
          serializer.fromJson<String>(json['candidateFingerprint']),
      candidatePlatform: serializer.fromJson<String>(json['candidatePlatform']),
      status: serializer.fromJson<String>(json['status']),
      approvedByDeviceId:
          serializer.fromJson<String?>(json['approvedByDeviceId']),
      expiresAt: serializer.fromJson<DateTime>(json['expiresAt']),
      approvedAt: serializer.fromJson<DateTime?>(json['approvedAt']),
      consumedAt: serializer.fromJson<DateTime?>(json['consumedAt']),
      cancelledAt: serializer.fromJson<DateTime?>(json['cancelledAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerId': serializer.toJson<String>(ownerId),
      'candidatePublicKey': serializer.toJson<String>(candidatePublicKey),
      'candidateFingerprint': serializer.toJson<String>(candidateFingerprint),
      'candidatePlatform': serializer.toJson<String>(candidatePlatform),
      'status': serializer.toJson<String>(status),
      'approvedByDeviceId': serializer.toJson<String?>(approvedByDeviceId),
      'expiresAt': serializer.toJson<DateTime>(expiresAt),
      'approvedAt': serializer.toJson<DateTime?>(approvedAt),
      'consumedAt': serializer.toJson<DateTime?>(consumedAt),
      'cancelledAt': serializer.toJson<DateTime?>(cancelledAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  DevicePairing copyWith(
          {String? id,
          String? ownerId,
          String? candidatePublicKey,
          String? candidateFingerprint,
          String? candidatePlatform,
          String? status,
          Value<String?> approvedByDeviceId = const Value.absent(),
          DateTime? expiresAt,
          Value<DateTime?> approvedAt = const Value.absent(),
          Value<DateTime?> consumedAt = const Value.absent(),
          Value<DateTime?> cancelledAt = const Value.absent(),
          DateTime? createdAt}) =>
      DevicePairing(
        id: id ?? this.id,
        ownerId: ownerId ?? this.ownerId,
        candidatePublicKey: candidatePublicKey ?? this.candidatePublicKey,
        candidateFingerprint: candidateFingerprint ?? this.candidateFingerprint,
        candidatePlatform: candidatePlatform ?? this.candidatePlatform,
        status: status ?? this.status,
        approvedByDeviceId: approvedByDeviceId.present
            ? approvedByDeviceId.value
            : this.approvedByDeviceId,
        expiresAt: expiresAt ?? this.expiresAt,
        approvedAt: approvedAt.present ? approvedAt.value : this.approvedAt,
        consumedAt: consumedAt.present ? consumedAt.value : this.consumedAt,
        cancelledAt: cancelledAt.present ? cancelledAt.value : this.cancelledAt,
        createdAt: createdAt ?? this.createdAt,
      );
  DevicePairing copyWithCompanion(DevicePairingsCompanion data) {
    return DevicePairing(
      id: data.id.present ? data.id.value : this.id,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      candidatePublicKey: data.candidatePublicKey.present
          ? data.candidatePublicKey.value
          : this.candidatePublicKey,
      candidateFingerprint: data.candidateFingerprint.present
          ? data.candidateFingerprint.value
          : this.candidateFingerprint,
      candidatePlatform: data.candidatePlatform.present
          ? data.candidatePlatform.value
          : this.candidatePlatform,
      status: data.status.present ? data.status.value : this.status,
      approvedByDeviceId: data.approvedByDeviceId.present
          ? data.approvedByDeviceId.value
          : this.approvedByDeviceId,
      expiresAt: data.expiresAt.present ? data.expiresAt.value : this.expiresAt,
      approvedAt:
          data.approvedAt.present ? data.approvedAt.value : this.approvedAt,
      consumedAt:
          data.consumedAt.present ? data.consumedAt.value : this.consumedAt,
      cancelledAt:
          data.cancelledAt.present ? data.cancelledAt.value : this.cancelledAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DevicePairing(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('candidatePublicKey: $candidatePublicKey, ')
          ..write('candidateFingerprint: $candidateFingerprint, ')
          ..write('candidatePlatform: $candidatePlatform, ')
          ..write('status: $status, ')
          ..write('approvedByDeviceId: $approvedByDeviceId, ')
          ..write('expiresAt: $expiresAt, ')
          ..write('approvedAt: $approvedAt, ')
          ..write('consumedAt: $consumedAt, ')
          ..write('cancelledAt: $cancelledAt, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      ownerId,
      candidatePublicKey,
      candidateFingerprint,
      candidatePlatform,
      status,
      approvedByDeviceId,
      expiresAt,
      approvedAt,
      consumedAt,
      cancelledAt,
      createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DevicePairing &&
          other.id == this.id &&
          other.ownerId == this.ownerId &&
          other.candidatePublicKey == this.candidatePublicKey &&
          other.candidateFingerprint == this.candidateFingerprint &&
          other.candidatePlatform == this.candidatePlatform &&
          other.status == this.status &&
          other.approvedByDeviceId == this.approvedByDeviceId &&
          other.expiresAt == this.expiresAt &&
          other.approvedAt == this.approvedAt &&
          other.consumedAt == this.consumedAt &&
          other.cancelledAt == this.cancelledAt &&
          other.createdAt == this.createdAt);
}

class DevicePairingsCompanion extends UpdateCompanion<DevicePairing> {
  final Value<String> id;
  final Value<String> ownerId;
  final Value<String> candidatePublicKey;
  final Value<String> candidateFingerprint;
  final Value<String> candidatePlatform;
  final Value<String> status;
  final Value<String?> approvedByDeviceId;
  final Value<DateTime> expiresAt;
  final Value<DateTime?> approvedAt;
  final Value<DateTime?> consumedAt;
  final Value<DateTime?> cancelledAt;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const DevicePairingsCompanion({
    this.id = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.candidatePublicKey = const Value.absent(),
    this.candidateFingerprint = const Value.absent(),
    this.candidatePlatform = const Value.absent(),
    this.status = const Value.absent(),
    this.approvedByDeviceId = const Value.absent(),
    this.expiresAt = const Value.absent(),
    this.approvedAt = const Value.absent(),
    this.consumedAt = const Value.absent(),
    this.cancelledAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DevicePairingsCompanion.insert({
    required String id,
    required String ownerId,
    required String candidatePublicKey,
    required String candidateFingerprint,
    required String candidatePlatform,
    this.status = const Value.absent(),
    this.approvedByDeviceId = const Value.absent(),
    required DateTime expiresAt,
    this.approvedAt = const Value.absent(),
    this.consumedAt = const Value.absent(),
    this.cancelledAt = const Value.absent(),
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerId = Value(ownerId),
        candidatePublicKey = Value(candidatePublicKey),
        candidateFingerprint = Value(candidateFingerprint),
        candidatePlatform = Value(candidatePlatform),
        expiresAt = Value(expiresAt),
        createdAt = Value(createdAt);
  static Insertable<DevicePairing> custom({
    Expression<String>? id,
    Expression<String>? ownerId,
    Expression<String>? candidatePublicKey,
    Expression<String>? candidateFingerprint,
    Expression<String>? candidatePlatform,
    Expression<String>? status,
    Expression<String>? approvedByDeviceId,
    Expression<DateTime>? expiresAt,
    Expression<DateTime>? approvedAt,
    Expression<DateTime>? consumedAt,
    Expression<DateTime>? cancelledAt,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerId != null) 'owner_id': ownerId,
      if (candidatePublicKey != null)
        'candidate_public_key': candidatePublicKey,
      if (candidateFingerprint != null)
        'candidate_fingerprint': candidateFingerprint,
      if (candidatePlatform != null) 'candidate_platform': candidatePlatform,
      if (status != null) 'status': status,
      if (approvedByDeviceId != null)
        'approved_by_device_id': approvedByDeviceId,
      if (expiresAt != null) 'expires_at': expiresAt,
      if (approvedAt != null) 'approved_at': approvedAt,
      if (consumedAt != null) 'consumed_at': consumedAt,
      if (cancelledAt != null) 'cancelled_at': cancelledAt,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DevicePairingsCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerId,
      Value<String>? candidatePublicKey,
      Value<String>? candidateFingerprint,
      Value<String>? candidatePlatform,
      Value<String>? status,
      Value<String?>? approvedByDeviceId,
      Value<DateTime>? expiresAt,
      Value<DateTime?>? approvedAt,
      Value<DateTime?>? consumedAt,
      Value<DateTime?>? cancelledAt,
      Value<DateTime>? createdAt,
      Value<int>? rowid}) {
    return DevicePairingsCompanion(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      candidatePublicKey: candidatePublicKey ?? this.candidatePublicKey,
      candidateFingerprint: candidateFingerprint ?? this.candidateFingerprint,
      candidatePlatform: candidatePlatform ?? this.candidatePlatform,
      status: status ?? this.status,
      approvedByDeviceId: approvedByDeviceId ?? this.approvedByDeviceId,
      expiresAt: expiresAt ?? this.expiresAt,
      approvedAt: approvedAt ?? this.approvedAt,
      consumedAt: consumedAt ?? this.consumedAt,
      cancelledAt: cancelledAt ?? this.cancelledAt,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (candidatePublicKey.present) {
      map['candidate_public_key'] = Variable<String>(candidatePublicKey.value);
    }
    if (candidateFingerprint.present) {
      map['candidate_fingerprint'] =
          Variable<String>(candidateFingerprint.value);
    }
    if (candidatePlatform.present) {
      map['candidate_platform'] = Variable<String>(candidatePlatform.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (approvedByDeviceId.present) {
      map['approved_by_device_id'] = Variable<String>(approvedByDeviceId.value);
    }
    if (expiresAt.present) {
      map['expires_at'] = Variable<DateTime>(expiresAt.value);
    }
    if (approvedAt.present) {
      map['approved_at'] = Variable<DateTime>(approvedAt.value);
    }
    if (consumedAt.present) {
      map['consumed_at'] = Variable<DateTime>(consumedAt.value);
    }
    if (cancelledAt.present) {
      map['cancelled_at'] = Variable<DateTime>(cancelledAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DevicePairingsCompanion(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('candidatePublicKey: $candidatePublicKey, ')
          ..write('candidateFingerprint: $candidateFingerprint, ')
          ..write('candidatePlatform: $candidatePlatform, ')
          ..write('status: $status, ')
          ..write('approvedByDeviceId: $approvedByDeviceId, ')
          ..write('expiresAt: $expiresAt, ')
          ..write('approvedAt: $approvedAt, ')
          ..write('consumedAt: $consumedAt, ')
          ..write('cancelledAt: $cancelledAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $FocusModesTable extends FocusModes
    with TableInfo<$FocusModesTable, FocusMode> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $FocusModesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _intervalMinutesMeta =
      const VerificationMeta('intervalMinutes');
  @override
  late final GeneratedColumn<int> intervalMinutes = GeneratedColumn<int>(
      'interval_minutes', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _policyJsonMeta =
      const VerificationMeta('policyJson');
  @override
  late final GeneratedColumn<String> policyJson = GeneratedColumn<String>(
      'policy_json', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _versionMeta =
      const VerificationMeta('version');
  @override
  late final GeneratedColumn<String> version = GeneratedColumn<String>(
      'version', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _deletedAtMeta =
      const VerificationMeta('deletedAt');
  @override
  late final GeneratedColumn<DateTime> deletedAt = GeneratedColumn<DateTime>(
      'deleted_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        ownerId,
        name,
        intervalMinutes,
        policyJson,
        version,
        deletedAt,
        createdAt,
        updatedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'focus_modes';
  @override
  VerificationContext validateIntegrity(Insertable<FocusMode> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('interval_minutes')) {
      context.handle(
          _intervalMinutesMeta,
          intervalMinutes.isAcceptableOrUnknown(
              data['interval_minutes']!, _intervalMinutesMeta));
    } else if (isInserting) {
      context.missing(_intervalMinutesMeta);
    }
    if (data.containsKey('policy_json')) {
      context.handle(
          _policyJsonMeta,
          policyJson.isAcceptableOrUnknown(
              data['policy_json']!, _policyJsonMeta));
    } else if (isInserting) {
      context.missing(_policyJsonMeta);
    }
    if (data.containsKey('version')) {
      context.handle(_versionMeta,
          version.isAcceptableOrUnknown(data['version']!, _versionMeta));
    } else if (isInserting) {
      context.missing(_versionMeta);
    }
    if (data.containsKey('deleted_at')) {
      context.handle(_deletedAtMeta,
          deletedAt.isAcceptableOrUnknown(data['deleted_at']!, _deletedAtMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  FocusMode map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return FocusMode(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      intervalMinutes: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}interval_minutes'])!,
      policyJson: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}policy_json'])!,
      version: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}version'])!,
      deletedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}deleted_at']),
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
    );
  }

  @override
  $FocusModesTable createAlias(String alias) {
    return $FocusModesTable(attachedDatabase, alias);
  }
}

class FocusMode extends DataClass implements Insertable<FocusMode> {
  final String id;
  final String ownerId;
  final String name;
  final int intervalMinutes;
  final String policyJson;
  final String version;
  final DateTime? deletedAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  const FocusMode(
      {required this.id,
      required this.ownerId,
      required this.name,
      required this.intervalMinutes,
      required this.policyJson,
      required this.version,
      this.deletedAt,
      required this.createdAt,
      required this.updatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_id'] = Variable<String>(ownerId);
    map['name'] = Variable<String>(name);
    map['interval_minutes'] = Variable<int>(intervalMinutes);
    map['policy_json'] = Variable<String>(policyJson);
    map['version'] = Variable<String>(version);
    if (!nullToAbsent || deletedAt != null) {
      map['deleted_at'] = Variable<DateTime>(deletedAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  FocusModesCompanion toCompanion(bool nullToAbsent) {
    return FocusModesCompanion(
      id: Value(id),
      ownerId: Value(ownerId),
      name: Value(name),
      intervalMinutes: Value(intervalMinutes),
      policyJson: Value(policyJson),
      version: Value(version),
      deletedAt: deletedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(deletedAt),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory FocusMode.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return FocusMode(
      id: serializer.fromJson<String>(json['id']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      name: serializer.fromJson<String>(json['name']),
      intervalMinutes: serializer.fromJson<int>(json['intervalMinutes']),
      policyJson: serializer.fromJson<String>(json['policyJson']),
      version: serializer.fromJson<String>(json['version']),
      deletedAt: serializer.fromJson<DateTime?>(json['deletedAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerId': serializer.toJson<String>(ownerId),
      'name': serializer.toJson<String>(name),
      'intervalMinutes': serializer.toJson<int>(intervalMinutes),
      'policyJson': serializer.toJson<String>(policyJson),
      'version': serializer.toJson<String>(version),
      'deletedAt': serializer.toJson<DateTime?>(deletedAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  FocusMode copyWith(
          {String? id,
          String? ownerId,
          String? name,
          int? intervalMinutes,
          String? policyJson,
          String? version,
          Value<DateTime?> deletedAt = const Value.absent(),
          DateTime? createdAt,
          DateTime? updatedAt}) =>
      FocusMode(
        id: id ?? this.id,
        ownerId: ownerId ?? this.ownerId,
        name: name ?? this.name,
        intervalMinutes: intervalMinutes ?? this.intervalMinutes,
        policyJson: policyJson ?? this.policyJson,
        version: version ?? this.version,
        deletedAt: deletedAt.present ? deletedAt.value : this.deletedAt,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );
  FocusMode copyWithCompanion(FocusModesCompanion data) {
    return FocusMode(
      id: data.id.present ? data.id.value : this.id,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      name: data.name.present ? data.name.value : this.name,
      intervalMinutes: data.intervalMinutes.present
          ? data.intervalMinutes.value
          : this.intervalMinutes,
      policyJson:
          data.policyJson.present ? data.policyJson.value : this.policyJson,
      version: data.version.present ? data.version.value : this.version,
      deletedAt: data.deletedAt.present ? data.deletedAt.value : this.deletedAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('FocusMode(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('name: $name, ')
          ..write('intervalMinutes: $intervalMinutes, ')
          ..write('policyJson: $policyJson, ')
          ..write('version: $version, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, ownerId, name, intervalMinutes,
      policyJson, version, deletedAt, createdAt, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is FocusMode &&
          other.id == this.id &&
          other.ownerId == this.ownerId &&
          other.name == this.name &&
          other.intervalMinutes == this.intervalMinutes &&
          other.policyJson == this.policyJson &&
          other.version == this.version &&
          other.deletedAt == this.deletedAt &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class FocusModesCompanion extends UpdateCompanion<FocusMode> {
  final Value<String> id;
  final Value<String> ownerId;
  final Value<String> name;
  final Value<int> intervalMinutes;
  final Value<String> policyJson;
  final Value<String> version;
  final Value<DateTime?> deletedAt;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const FocusModesCompanion({
    this.id = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.name = const Value.absent(),
    this.intervalMinutes = const Value.absent(),
    this.policyJson = const Value.absent(),
    this.version = const Value.absent(),
    this.deletedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  FocusModesCompanion.insert({
    required String id,
    required String ownerId,
    required String name,
    required int intervalMinutes,
    required String policyJson,
    required String version,
    this.deletedAt = const Value.absent(),
    required DateTime createdAt,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerId = Value(ownerId),
        name = Value(name),
        intervalMinutes = Value(intervalMinutes),
        policyJson = Value(policyJson),
        version = Value(version),
        createdAt = Value(createdAt),
        updatedAt = Value(updatedAt);
  static Insertable<FocusMode> custom({
    Expression<String>? id,
    Expression<String>? ownerId,
    Expression<String>? name,
    Expression<int>? intervalMinutes,
    Expression<String>? policyJson,
    Expression<String>? version,
    Expression<DateTime>? deletedAt,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerId != null) 'owner_id': ownerId,
      if (name != null) 'name': name,
      if (intervalMinutes != null) 'interval_minutes': intervalMinutes,
      if (policyJson != null) 'policy_json': policyJson,
      if (version != null) 'version': version,
      if (deletedAt != null) 'deleted_at': deletedAt,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  FocusModesCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerId,
      Value<String>? name,
      Value<int>? intervalMinutes,
      Value<String>? policyJson,
      Value<String>? version,
      Value<DateTime?>? deletedAt,
      Value<DateTime>? createdAt,
      Value<DateTime>? updatedAt,
      Value<int>? rowid}) {
    return FocusModesCompanion(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      name: name ?? this.name,
      intervalMinutes: intervalMinutes ?? this.intervalMinutes,
      policyJson: policyJson ?? this.policyJson,
      version: version ?? this.version,
      deletedAt: deletedAt ?? this.deletedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (intervalMinutes.present) {
      map['interval_minutes'] = Variable<int>(intervalMinutes.value);
    }
    if (policyJson.present) {
      map['policy_json'] = Variable<String>(policyJson.value);
    }
    if (version.present) {
      map['version'] = Variable<String>(version.value);
    }
    if (deletedAt.present) {
      map['deleted_at'] = Variable<DateTime>(deletedAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('FocusModesCompanion(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('name: $name, ')
          ..write('intervalMinutes: $intervalMinutes, ')
          ..write('policyJson: $policyJson, ')
          ..write('version: $version, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $FocusSessionsTable extends FocusSessions
    with TableInfo<$FocusSessionsTable, FocusSession> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $FocusSessionsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _focusModeIdMeta =
      const VerificationMeta('focusModeId');
  @override
  late final GeneratedColumn<String> focusModeId = GeneratedColumn<String>(
      'focus_mode_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('ACTIVE'));
  static const VerificationMeta _schedulePolicyJsonMeta =
      const VerificationMeta('schedulePolicyJson');
  @override
  late final GeneratedColumn<String> schedulePolicyJson =
      GeneratedColumn<String>('schedule_policy_json', aliasedName, false,
          type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _timezoneIdMeta =
      const VerificationMeta('timezoneId');
  @override
  late final GeneratedColumn<String> timezoneId = GeneratedColumn<String>(
      'timezone_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _startedAtMeta =
      const VerificationMeta('startedAt');
  @override
  late final GeneratedColumn<DateTime> startedAt = GeneratedColumn<DateTime>(
      'started_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _endedAtMeta =
      const VerificationMeta('endedAt');
  @override
  late final GeneratedColumn<DateTime> endedAt = GeneratedColumn<DateTime>(
      'ended_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _versionMeta =
      const VerificationMeta('version');
  @override
  late final GeneratedColumn<String> version = GeneratedColumn<String>(
      'version', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _deletedAtMeta =
      const VerificationMeta('deletedAt');
  @override
  late final GeneratedColumn<DateTime> deletedAt = GeneratedColumn<DateTime>(
      'deleted_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        ownerId,
        focusModeId,
        name,
        status,
        schedulePolicyJson,
        timezoneId,
        startedAt,
        endedAt,
        version,
        deletedAt,
        createdAt,
        updatedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'focus_sessions';
  @override
  VerificationContext validateIntegrity(Insertable<FocusSession> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('focus_mode_id')) {
      context.handle(
          _focusModeIdMeta,
          focusModeId.isAcceptableOrUnknown(
              data['focus_mode_id']!, _focusModeIdMeta));
    } else if (isInserting) {
      context.missing(_focusModeIdMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('schedule_policy_json')) {
      context.handle(
          _schedulePolicyJsonMeta,
          schedulePolicyJson.isAcceptableOrUnknown(
              data['schedule_policy_json']!, _schedulePolicyJsonMeta));
    } else if (isInserting) {
      context.missing(_schedulePolicyJsonMeta);
    }
    if (data.containsKey('timezone_id')) {
      context.handle(
          _timezoneIdMeta,
          timezoneId.isAcceptableOrUnknown(
              data['timezone_id']!, _timezoneIdMeta));
    } else if (isInserting) {
      context.missing(_timezoneIdMeta);
    }
    if (data.containsKey('started_at')) {
      context.handle(_startedAtMeta,
          startedAt.isAcceptableOrUnknown(data['started_at']!, _startedAtMeta));
    } else if (isInserting) {
      context.missing(_startedAtMeta);
    }
    if (data.containsKey('ended_at')) {
      context.handle(_endedAtMeta,
          endedAt.isAcceptableOrUnknown(data['ended_at']!, _endedAtMeta));
    }
    if (data.containsKey('version')) {
      context.handle(_versionMeta,
          version.isAcceptableOrUnknown(data['version']!, _versionMeta));
    } else if (isInserting) {
      context.missing(_versionMeta);
    }
    if (data.containsKey('deleted_at')) {
      context.handle(_deletedAtMeta,
          deletedAt.isAcceptableOrUnknown(data['deleted_at']!, _deletedAtMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  FocusSession map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return FocusSession(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      focusModeId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}focus_mode_id'])!,
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name']),
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      schedulePolicyJson: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}schedule_policy_json'])!,
      timezoneId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}timezone_id'])!,
      startedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}started_at'])!,
      endedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}ended_at']),
      version: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}version'])!,
      deletedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}deleted_at']),
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
    );
  }

  @override
  $FocusSessionsTable createAlias(String alias) {
    return $FocusSessionsTable(attachedDatabase, alias);
  }
}

class FocusSession extends DataClass implements Insertable<FocusSession> {
  final String id;
  final String ownerId;
  final String focusModeId;
  final String? name;
  final String status;
  final String schedulePolicyJson;
  final String timezoneId;
  final DateTime startedAt;
  final DateTime? endedAt;
  final String version;
  final DateTime? deletedAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  const FocusSession(
      {required this.id,
      required this.ownerId,
      required this.focusModeId,
      this.name,
      required this.status,
      required this.schedulePolicyJson,
      required this.timezoneId,
      required this.startedAt,
      this.endedAt,
      required this.version,
      this.deletedAt,
      required this.createdAt,
      required this.updatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_id'] = Variable<String>(ownerId);
    map['focus_mode_id'] = Variable<String>(focusModeId);
    if (!nullToAbsent || name != null) {
      map['name'] = Variable<String>(name);
    }
    map['status'] = Variable<String>(status);
    map['schedule_policy_json'] = Variable<String>(schedulePolicyJson);
    map['timezone_id'] = Variable<String>(timezoneId);
    map['started_at'] = Variable<DateTime>(startedAt);
    if (!nullToAbsent || endedAt != null) {
      map['ended_at'] = Variable<DateTime>(endedAt);
    }
    map['version'] = Variable<String>(version);
    if (!nullToAbsent || deletedAt != null) {
      map['deleted_at'] = Variable<DateTime>(deletedAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  FocusSessionsCompanion toCompanion(bool nullToAbsent) {
    return FocusSessionsCompanion(
      id: Value(id),
      ownerId: Value(ownerId),
      focusModeId: Value(focusModeId),
      name: name == null && nullToAbsent ? const Value.absent() : Value(name),
      status: Value(status),
      schedulePolicyJson: Value(schedulePolicyJson),
      timezoneId: Value(timezoneId),
      startedAt: Value(startedAt),
      endedAt: endedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(endedAt),
      version: Value(version),
      deletedAt: deletedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(deletedAt),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory FocusSession.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return FocusSession(
      id: serializer.fromJson<String>(json['id']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      focusModeId: serializer.fromJson<String>(json['focusModeId']),
      name: serializer.fromJson<String?>(json['name']),
      status: serializer.fromJson<String>(json['status']),
      schedulePolicyJson:
          serializer.fromJson<String>(json['schedulePolicyJson']),
      timezoneId: serializer.fromJson<String>(json['timezoneId']),
      startedAt: serializer.fromJson<DateTime>(json['startedAt']),
      endedAt: serializer.fromJson<DateTime?>(json['endedAt']),
      version: serializer.fromJson<String>(json['version']),
      deletedAt: serializer.fromJson<DateTime?>(json['deletedAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerId': serializer.toJson<String>(ownerId),
      'focusModeId': serializer.toJson<String>(focusModeId),
      'name': serializer.toJson<String?>(name),
      'status': serializer.toJson<String>(status),
      'schedulePolicyJson': serializer.toJson<String>(schedulePolicyJson),
      'timezoneId': serializer.toJson<String>(timezoneId),
      'startedAt': serializer.toJson<DateTime>(startedAt),
      'endedAt': serializer.toJson<DateTime?>(endedAt),
      'version': serializer.toJson<String>(version),
      'deletedAt': serializer.toJson<DateTime?>(deletedAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  FocusSession copyWith(
          {String? id,
          String? ownerId,
          String? focusModeId,
          Value<String?> name = const Value.absent(),
          String? status,
          String? schedulePolicyJson,
          String? timezoneId,
          DateTime? startedAt,
          Value<DateTime?> endedAt = const Value.absent(),
          String? version,
          Value<DateTime?> deletedAt = const Value.absent(),
          DateTime? createdAt,
          DateTime? updatedAt}) =>
      FocusSession(
        id: id ?? this.id,
        ownerId: ownerId ?? this.ownerId,
        focusModeId: focusModeId ?? this.focusModeId,
        name: name.present ? name.value : this.name,
        status: status ?? this.status,
        schedulePolicyJson: schedulePolicyJson ?? this.schedulePolicyJson,
        timezoneId: timezoneId ?? this.timezoneId,
        startedAt: startedAt ?? this.startedAt,
        endedAt: endedAt.present ? endedAt.value : this.endedAt,
        version: version ?? this.version,
        deletedAt: deletedAt.present ? deletedAt.value : this.deletedAt,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );
  FocusSession copyWithCompanion(FocusSessionsCompanion data) {
    return FocusSession(
      id: data.id.present ? data.id.value : this.id,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      focusModeId:
          data.focusModeId.present ? data.focusModeId.value : this.focusModeId,
      name: data.name.present ? data.name.value : this.name,
      status: data.status.present ? data.status.value : this.status,
      schedulePolicyJson: data.schedulePolicyJson.present
          ? data.schedulePolicyJson.value
          : this.schedulePolicyJson,
      timezoneId:
          data.timezoneId.present ? data.timezoneId.value : this.timezoneId,
      startedAt: data.startedAt.present ? data.startedAt.value : this.startedAt,
      endedAt: data.endedAt.present ? data.endedAt.value : this.endedAt,
      version: data.version.present ? data.version.value : this.version,
      deletedAt: data.deletedAt.present ? data.deletedAt.value : this.deletedAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('FocusSession(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('focusModeId: $focusModeId, ')
          ..write('name: $name, ')
          ..write('status: $status, ')
          ..write('schedulePolicyJson: $schedulePolicyJson, ')
          ..write('timezoneId: $timezoneId, ')
          ..write('startedAt: $startedAt, ')
          ..write('endedAt: $endedAt, ')
          ..write('version: $version, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      ownerId,
      focusModeId,
      name,
      status,
      schedulePolicyJson,
      timezoneId,
      startedAt,
      endedAt,
      version,
      deletedAt,
      createdAt,
      updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is FocusSession &&
          other.id == this.id &&
          other.ownerId == this.ownerId &&
          other.focusModeId == this.focusModeId &&
          other.name == this.name &&
          other.status == this.status &&
          other.schedulePolicyJson == this.schedulePolicyJson &&
          other.timezoneId == this.timezoneId &&
          other.startedAt == this.startedAt &&
          other.endedAt == this.endedAt &&
          other.version == this.version &&
          other.deletedAt == this.deletedAt &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class FocusSessionsCompanion extends UpdateCompanion<FocusSession> {
  final Value<String> id;
  final Value<String> ownerId;
  final Value<String> focusModeId;
  final Value<String?> name;
  final Value<String> status;
  final Value<String> schedulePolicyJson;
  final Value<String> timezoneId;
  final Value<DateTime> startedAt;
  final Value<DateTime?> endedAt;
  final Value<String> version;
  final Value<DateTime?> deletedAt;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const FocusSessionsCompanion({
    this.id = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.focusModeId = const Value.absent(),
    this.name = const Value.absent(),
    this.status = const Value.absent(),
    this.schedulePolicyJson = const Value.absent(),
    this.timezoneId = const Value.absent(),
    this.startedAt = const Value.absent(),
    this.endedAt = const Value.absent(),
    this.version = const Value.absent(),
    this.deletedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  FocusSessionsCompanion.insert({
    required String id,
    required String ownerId,
    required String focusModeId,
    this.name = const Value.absent(),
    this.status = const Value.absent(),
    required String schedulePolicyJson,
    required String timezoneId,
    required DateTime startedAt,
    this.endedAt = const Value.absent(),
    required String version,
    this.deletedAt = const Value.absent(),
    required DateTime createdAt,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerId = Value(ownerId),
        focusModeId = Value(focusModeId),
        schedulePolicyJson = Value(schedulePolicyJson),
        timezoneId = Value(timezoneId),
        startedAt = Value(startedAt),
        version = Value(version),
        createdAt = Value(createdAt),
        updatedAt = Value(updatedAt);
  static Insertable<FocusSession> custom({
    Expression<String>? id,
    Expression<String>? ownerId,
    Expression<String>? focusModeId,
    Expression<String>? name,
    Expression<String>? status,
    Expression<String>? schedulePolicyJson,
    Expression<String>? timezoneId,
    Expression<DateTime>? startedAt,
    Expression<DateTime>? endedAt,
    Expression<String>? version,
    Expression<DateTime>? deletedAt,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerId != null) 'owner_id': ownerId,
      if (focusModeId != null) 'focus_mode_id': focusModeId,
      if (name != null) 'name': name,
      if (status != null) 'status': status,
      if (schedulePolicyJson != null)
        'schedule_policy_json': schedulePolicyJson,
      if (timezoneId != null) 'timezone_id': timezoneId,
      if (startedAt != null) 'started_at': startedAt,
      if (endedAt != null) 'ended_at': endedAt,
      if (version != null) 'version': version,
      if (deletedAt != null) 'deleted_at': deletedAt,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  FocusSessionsCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerId,
      Value<String>? focusModeId,
      Value<String?>? name,
      Value<String>? status,
      Value<String>? schedulePolicyJson,
      Value<String>? timezoneId,
      Value<DateTime>? startedAt,
      Value<DateTime?>? endedAt,
      Value<String>? version,
      Value<DateTime?>? deletedAt,
      Value<DateTime>? createdAt,
      Value<DateTime>? updatedAt,
      Value<int>? rowid}) {
    return FocusSessionsCompanion(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      focusModeId: focusModeId ?? this.focusModeId,
      name: name ?? this.name,
      status: status ?? this.status,
      schedulePolicyJson: schedulePolicyJson ?? this.schedulePolicyJson,
      timezoneId: timezoneId ?? this.timezoneId,
      startedAt: startedAt ?? this.startedAt,
      endedAt: endedAt ?? this.endedAt,
      version: version ?? this.version,
      deletedAt: deletedAt ?? this.deletedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (focusModeId.present) {
      map['focus_mode_id'] = Variable<String>(focusModeId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (schedulePolicyJson.present) {
      map['schedule_policy_json'] = Variable<String>(schedulePolicyJson.value);
    }
    if (timezoneId.present) {
      map['timezone_id'] = Variable<String>(timezoneId.value);
    }
    if (startedAt.present) {
      map['started_at'] = Variable<DateTime>(startedAt.value);
    }
    if (endedAt.present) {
      map['ended_at'] = Variable<DateTime>(endedAt.value);
    }
    if (version.present) {
      map['version'] = Variable<String>(version.value);
    }
    if (deletedAt.present) {
      map['deleted_at'] = Variable<DateTime>(deletedAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('FocusSessionsCompanion(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('focusModeId: $focusModeId, ')
          ..write('name: $name, ')
          ..write('status: $status, ')
          ..write('schedulePolicyJson: $schedulePolicyJson, ')
          ..write('timezoneId: $timezoneId, ')
          ..write('startedAt: $startedAt, ')
          ..write('endedAt: $endedAt, ')
          ..write('version: $version, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ReminderOccurrencesTable extends ReminderOccurrences
    with TableInfo<$ReminderOccurrencesTable, ReminderOccurrence> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ReminderOccurrencesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _focusSessionIdMeta =
      const VerificationMeta('focusSessionId');
  @override
  late final GeneratedColumn<String> focusSessionId = GeneratedColumn<String>(
      'focus_session_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _stateMeta = const VerificationMeta('state');
  @override
  late final GeneratedColumn<String> state = GeneratedColumn<String>(
      'state', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('SCHEDULED'));
  static const VerificationMeta _scheduledAtMeta =
      const VerificationMeta('scheduledAt');
  @override
  late final GeneratedColumn<DateTime> scheduledAt = GeneratedColumn<DateTime>(
      'scheduled_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _originalScheduledAtMeta =
      const VerificationMeta('originalScheduledAt');
  @override
  late final GeneratedColumn<DateTime> originalScheduledAt =
      GeneratedColumn<DateTime>('original_scheduled_at', aliasedName, false,
          type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _presentedAtMeta =
      const VerificationMeta('presentedAt');
  @override
  late final GeneratedColumn<DateTime> presentedAt = GeneratedColumn<DateTime>(
      'presented_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _resolvedAtMeta =
      const VerificationMeta('resolvedAt');
  @override
  late final GeneratedColumn<DateTime> resolvedAt = GeneratedColumn<DateTime>(
      'resolved_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _timezoneIdMeta =
      const VerificationMeta('timezoneId');
  @override
  late final GeneratedColumn<String> timezoneId = GeneratedColumn<String>(
      'timezone_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _policySnapshotJsonMeta =
      const VerificationMeta('policySnapshotJson');
  @override
  late final GeneratedColumn<String> policySnapshotJson =
      GeneratedColumn<String>('policy_snapshot_json', aliasedName, false,
          type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _versionMeta =
      const VerificationMeta('version');
  @override
  late final GeneratedColumn<String> version = GeneratedColumn<String>(
      'version', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        ownerId,
        focusSessionId,
        state,
        scheduledAt,
        originalScheduledAt,
        presentedAt,
        resolvedAt,
        timezoneId,
        policySnapshotJson,
        version,
        createdAt,
        updatedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'reminder_occurrences';
  @override
  VerificationContext validateIntegrity(Insertable<ReminderOccurrence> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('focus_session_id')) {
      context.handle(
          _focusSessionIdMeta,
          focusSessionId.isAcceptableOrUnknown(
              data['focus_session_id']!, _focusSessionIdMeta));
    } else if (isInserting) {
      context.missing(_focusSessionIdMeta);
    }
    if (data.containsKey('state')) {
      context.handle(
          _stateMeta, state.isAcceptableOrUnknown(data['state']!, _stateMeta));
    }
    if (data.containsKey('scheduled_at')) {
      context.handle(
          _scheduledAtMeta,
          scheduledAt.isAcceptableOrUnknown(
              data['scheduled_at']!, _scheduledAtMeta));
    } else if (isInserting) {
      context.missing(_scheduledAtMeta);
    }
    if (data.containsKey('original_scheduled_at')) {
      context.handle(
          _originalScheduledAtMeta,
          originalScheduledAt.isAcceptableOrUnknown(
              data['original_scheduled_at']!, _originalScheduledAtMeta));
    } else if (isInserting) {
      context.missing(_originalScheduledAtMeta);
    }
    if (data.containsKey('presented_at')) {
      context.handle(
          _presentedAtMeta,
          presentedAt.isAcceptableOrUnknown(
              data['presented_at']!, _presentedAtMeta));
    }
    if (data.containsKey('resolved_at')) {
      context.handle(
          _resolvedAtMeta,
          resolvedAt.isAcceptableOrUnknown(
              data['resolved_at']!, _resolvedAtMeta));
    }
    if (data.containsKey('timezone_id')) {
      context.handle(
          _timezoneIdMeta,
          timezoneId.isAcceptableOrUnknown(
              data['timezone_id']!, _timezoneIdMeta));
    } else if (isInserting) {
      context.missing(_timezoneIdMeta);
    }
    if (data.containsKey('policy_snapshot_json')) {
      context.handle(
          _policySnapshotJsonMeta,
          policySnapshotJson.isAcceptableOrUnknown(
              data['policy_snapshot_json']!, _policySnapshotJsonMeta));
    } else if (isInserting) {
      context.missing(_policySnapshotJsonMeta);
    }
    if (data.containsKey('version')) {
      context.handle(_versionMeta,
          version.isAcceptableOrUnknown(data['version']!, _versionMeta));
    } else if (isInserting) {
      context.missing(_versionMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ReminderOccurrence map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ReminderOccurrence(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      focusSessionId: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}focus_session_id'])!,
      state: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}state'])!,
      scheduledAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}scheduled_at'])!,
      originalScheduledAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime,
          data['${effectivePrefix}original_scheduled_at'])!,
      presentedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}presented_at']),
      resolvedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}resolved_at']),
      timezoneId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}timezone_id'])!,
      policySnapshotJson: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}policy_snapshot_json'])!,
      version: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}version'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
    );
  }

  @override
  $ReminderOccurrencesTable createAlias(String alias) {
    return $ReminderOccurrencesTable(attachedDatabase, alias);
  }
}

class ReminderOccurrence extends DataClass
    implements Insertable<ReminderOccurrence> {
  final String id;
  final String ownerId;
  final String focusSessionId;
  final String state;
  final DateTime scheduledAt;
  final DateTime originalScheduledAt;
  final DateTime? presentedAt;
  final DateTime? resolvedAt;
  final String timezoneId;
  final String policySnapshotJson;
  final String version;
  final DateTime createdAt;
  final DateTime updatedAt;
  const ReminderOccurrence(
      {required this.id,
      required this.ownerId,
      required this.focusSessionId,
      required this.state,
      required this.scheduledAt,
      required this.originalScheduledAt,
      this.presentedAt,
      this.resolvedAt,
      required this.timezoneId,
      required this.policySnapshotJson,
      required this.version,
      required this.createdAt,
      required this.updatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_id'] = Variable<String>(ownerId);
    map['focus_session_id'] = Variable<String>(focusSessionId);
    map['state'] = Variable<String>(state);
    map['scheduled_at'] = Variable<DateTime>(scheduledAt);
    map['original_scheduled_at'] = Variable<DateTime>(originalScheduledAt);
    if (!nullToAbsent || presentedAt != null) {
      map['presented_at'] = Variable<DateTime>(presentedAt);
    }
    if (!nullToAbsent || resolvedAt != null) {
      map['resolved_at'] = Variable<DateTime>(resolvedAt);
    }
    map['timezone_id'] = Variable<String>(timezoneId);
    map['policy_snapshot_json'] = Variable<String>(policySnapshotJson);
    map['version'] = Variable<String>(version);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  ReminderOccurrencesCompanion toCompanion(bool nullToAbsent) {
    return ReminderOccurrencesCompanion(
      id: Value(id),
      ownerId: Value(ownerId),
      focusSessionId: Value(focusSessionId),
      state: Value(state),
      scheduledAt: Value(scheduledAt),
      originalScheduledAt: Value(originalScheduledAt),
      presentedAt: presentedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(presentedAt),
      resolvedAt: resolvedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(resolvedAt),
      timezoneId: Value(timezoneId),
      policySnapshotJson: Value(policySnapshotJson),
      version: Value(version),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory ReminderOccurrence.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ReminderOccurrence(
      id: serializer.fromJson<String>(json['id']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      focusSessionId: serializer.fromJson<String>(json['focusSessionId']),
      state: serializer.fromJson<String>(json['state']),
      scheduledAt: serializer.fromJson<DateTime>(json['scheduledAt']),
      originalScheduledAt:
          serializer.fromJson<DateTime>(json['originalScheduledAt']),
      presentedAt: serializer.fromJson<DateTime?>(json['presentedAt']),
      resolvedAt: serializer.fromJson<DateTime?>(json['resolvedAt']),
      timezoneId: serializer.fromJson<String>(json['timezoneId']),
      policySnapshotJson:
          serializer.fromJson<String>(json['policySnapshotJson']),
      version: serializer.fromJson<String>(json['version']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerId': serializer.toJson<String>(ownerId),
      'focusSessionId': serializer.toJson<String>(focusSessionId),
      'state': serializer.toJson<String>(state),
      'scheduledAt': serializer.toJson<DateTime>(scheduledAt),
      'originalScheduledAt': serializer.toJson<DateTime>(originalScheduledAt),
      'presentedAt': serializer.toJson<DateTime?>(presentedAt),
      'resolvedAt': serializer.toJson<DateTime?>(resolvedAt),
      'timezoneId': serializer.toJson<String>(timezoneId),
      'policySnapshotJson': serializer.toJson<String>(policySnapshotJson),
      'version': serializer.toJson<String>(version),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  ReminderOccurrence copyWith(
          {String? id,
          String? ownerId,
          String? focusSessionId,
          String? state,
          DateTime? scheduledAt,
          DateTime? originalScheduledAt,
          Value<DateTime?> presentedAt = const Value.absent(),
          Value<DateTime?> resolvedAt = const Value.absent(),
          String? timezoneId,
          String? policySnapshotJson,
          String? version,
          DateTime? createdAt,
          DateTime? updatedAt}) =>
      ReminderOccurrence(
        id: id ?? this.id,
        ownerId: ownerId ?? this.ownerId,
        focusSessionId: focusSessionId ?? this.focusSessionId,
        state: state ?? this.state,
        scheduledAt: scheduledAt ?? this.scheduledAt,
        originalScheduledAt: originalScheduledAt ?? this.originalScheduledAt,
        presentedAt: presentedAt.present ? presentedAt.value : this.presentedAt,
        resolvedAt: resolvedAt.present ? resolvedAt.value : this.resolvedAt,
        timezoneId: timezoneId ?? this.timezoneId,
        policySnapshotJson: policySnapshotJson ?? this.policySnapshotJson,
        version: version ?? this.version,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );
  ReminderOccurrence copyWithCompanion(ReminderOccurrencesCompanion data) {
    return ReminderOccurrence(
      id: data.id.present ? data.id.value : this.id,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      focusSessionId: data.focusSessionId.present
          ? data.focusSessionId.value
          : this.focusSessionId,
      state: data.state.present ? data.state.value : this.state,
      scheduledAt:
          data.scheduledAt.present ? data.scheduledAt.value : this.scheduledAt,
      originalScheduledAt: data.originalScheduledAt.present
          ? data.originalScheduledAt.value
          : this.originalScheduledAt,
      presentedAt:
          data.presentedAt.present ? data.presentedAt.value : this.presentedAt,
      resolvedAt:
          data.resolvedAt.present ? data.resolvedAt.value : this.resolvedAt,
      timezoneId:
          data.timezoneId.present ? data.timezoneId.value : this.timezoneId,
      policySnapshotJson: data.policySnapshotJson.present
          ? data.policySnapshotJson.value
          : this.policySnapshotJson,
      version: data.version.present ? data.version.value : this.version,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ReminderOccurrence(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('focusSessionId: $focusSessionId, ')
          ..write('state: $state, ')
          ..write('scheduledAt: $scheduledAt, ')
          ..write('originalScheduledAt: $originalScheduledAt, ')
          ..write('presentedAt: $presentedAt, ')
          ..write('resolvedAt: $resolvedAt, ')
          ..write('timezoneId: $timezoneId, ')
          ..write('policySnapshotJson: $policySnapshotJson, ')
          ..write('version: $version, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      ownerId,
      focusSessionId,
      state,
      scheduledAt,
      originalScheduledAt,
      presentedAt,
      resolvedAt,
      timezoneId,
      policySnapshotJson,
      version,
      createdAt,
      updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ReminderOccurrence &&
          other.id == this.id &&
          other.ownerId == this.ownerId &&
          other.focusSessionId == this.focusSessionId &&
          other.state == this.state &&
          other.scheduledAt == this.scheduledAt &&
          other.originalScheduledAt == this.originalScheduledAt &&
          other.presentedAt == this.presentedAt &&
          other.resolvedAt == this.resolvedAt &&
          other.timezoneId == this.timezoneId &&
          other.policySnapshotJson == this.policySnapshotJson &&
          other.version == this.version &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class ReminderOccurrencesCompanion extends UpdateCompanion<ReminderOccurrence> {
  final Value<String> id;
  final Value<String> ownerId;
  final Value<String> focusSessionId;
  final Value<String> state;
  final Value<DateTime> scheduledAt;
  final Value<DateTime> originalScheduledAt;
  final Value<DateTime?> presentedAt;
  final Value<DateTime?> resolvedAt;
  final Value<String> timezoneId;
  final Value<String> policySnapshotJson;
  final Value<String> version;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const ReminderOccurrencesCompanion({
    this.id = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.focusSessionId = const Value.absent(),
    this.state = const Value.absent(),
    this.scheduledAt = const Value.absent(),
    this.originalScheduledAt = const Value.absent(),
    this.presentedAt = const Value.absent(),
    this.resolvedAt = const Value.absent(),
    this.timezoneId = const Value.absent(),
    this.policySnapshotJson = const Value.absent(),
    this.version = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ReminderOccurrencesCompanion.insert({
    required String id,
    required String ownerId,
    required String focusSessionId,
    this.state = const Value.absent(),
    required DateTime scheduledAt,
    required DateTime originalScheduledAt,
    this.presentedAt = const Value.absent(),
    this.resolvedAt = const Value.absent(),
    required String timezoneId,
    required String policySnapshotJson,
    required String version,
    required DateTime createdAt,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerId = Value(ownerId),
        focusSessionId = Value(focusSessionId),
        scheduledAt = Value(scheduledAt),
        originalScheduledAt = Value(originalScheduledAt),
        timezoneId = Value(timezoneId),
        policySnapshotJson = Value(policySnapshotJson),
        version = Value(version),
        createdAt = Value(createdAt),
        updatedAt = Value(updatedAt);
  static Insertable<ReminderOccurrence> custom({
    Expression<String>? id,
    Expression<String>? ownerId,
    Expression<String>? focusSessionId,
    Expression<String>? state,
    Expression<DateTime>? scheduledAt,
    Expression<DateTime>? originalScheduledAt,
    Expression<DateTime>? presentedAt,
    Expression<DateTime>? resolvedAt,
    Expression<String>? timezoneId,
    Expression<String>? policySnapshotJson,
    Expression<String>? version,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerId != null) 'owner_id': ownerId,
      if (focusSessionId != null) 'focus_session_id': focusSessionId,
      if (state != null) 'state': state,
      if (scheduledAt != null) 'scheduled_at': scheduledAt,
      if (originalScheduledAt != null)
        'original_scheduled_at': originalScheduledAt,
      if (presentedAt != null) 'presented_at': presentedAt,
      if (resolvedAt != null) 'resolved_at': resolvedAt,
      if (timezoneId != null) 'timezone_id': timezoneId,
      if (policySnapshotJson != null)
        'policy_snapshot_json': policySnapshotJson,
      if (version != null) 'version': version,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ReminderOccurrencesCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerId,
      Value<String>? focusSessionId,
      Value<String>? state,
      Value<DateTime>? scheduledAt,
      Value<DateTime>? originalScheduledAt,
      Value<DateTime?>? presentedAt,
      Value<DateTime?>? resolvedAt,
      Value<String>? timezoneId,
      Value<String>? policySnapshotJson,
      Value<String>? version,
      Value<DateTime>? createdAt,
      Value<DateTime>? updatedAt,
      Value<int>? rowid}) {
    return ReminderOccurrencesCompanion(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      focusSessionId: focusSessionId ?? this.focusSessionId,
      state: state ?? this.state,
      scheduledAt: scheduledAt ?? this.scheduledAt,
      originalScheduledAt: originalScheduledAt ?? this.originalScheduledAt,
      presentedAt: presentedAt ?? this.presentedAt,
      resolvedAt: resolvedAt ?? this.resolvedAt,
      timezoneId: timezoneId ?? this.timezoneId,
      policySnapshotJson: policySnapshotJson ?? this.policySnapshotJson,
      version: version ?? this.version,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (focusSessionId.present) {
      map['focus_session_id'] = Variable<String>(focusSessionId.value);
    }
    if (state.present) {
      map['state'] = Variable<String>(state.value);
    }
    if (scheduledAt.present) {
      map['scheduled_at'] = Variable<DateTime>(scheduledAt.value);
    }
    if (originalScheduledAt.present) {
      map['original_scheduled_at'] =
          Variable<DateTime>(originalScheduledAt.value);
    }
    if (presentedAt.present) {
      map['presented_at'] = Variable<DateTime>(presentedAt.value);
    }
    if (resolvedAt.present) {
      map['resolved_at'] = Variable<DateTime>(resolvedAt.value);
    }
    if (timezoneId.present) {
      map['timezone_id'] = Variable<String>(timezoneId.value);
    }
    if (policySnapshotJson.present) {
      map['policy_snapshot_json'] = Variable<String>(policySnapshotJson.value);
    }
    if (version.present) {
      map['version'] = Variable<String>(version.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ReminderOccurrencesCompanion(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('focusSessionId: $focusSessionId, ')
          ..write('state: $state, ')
          ..write('scheduledAt: $scheduledAt, ')
          ..write('originalScheduledAt: $originalScheduledAt, ')
          ..write('presentedAt: $presentedAt, ')
          ..write('resolvedAt: $resolvedAt, ')
          ..write('timezoneId: $timezoneId, ')
          ..write('policySnapshotJson: $policySnapshotJson, ')
          ..write('version: $version, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ReminderTransitionsTable extends ReminderTransitions
    with TableInfo<$ReminderTransitionsTable, ReminderTransition> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ReminderTransitionsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _reminderOccurrenceIdMeta =
      const VerificationMeta('reminderOccurrenceId');
  @override
  late final GeneratedColumn<String> reminderOccurrenceId =
      GeneratedColumn<String>('reminder_occurrence_id', aliasedName, false,
          type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _actingDeviceIdMeta =
      const VerificationMeta('actingDeviceId');
  @override
  late final GeneratedColumn<String> actingDeviceId = GeneratedColumn<String>(
      'acting_device_id', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _fromStateMeta =
      const VerificationMeta('fromState');
  @override
  late final GeneratedColumn<String> fromState = GeneratedColumn<String>(
      'from_state', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _toStateMeta =
      const VerificationMeta('toState');
  @override
  late final GeneratedColumn<String> toState = GeneratedColumn<String>(
      'to_state', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _reasonMeta = const VerificationMeta('reason');
  @override
  late final GeneratedColumn<String> reason = GeneratedColumn<String>(
      'reason', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _originalScheduledAtMeta =
      const VerificationMeta('originalScheduledAt');
  @override
  late final GeneratedColumn<DateTime> originalScheduledAt =
      GeneratedColumn<DateTime>('original_scheduled_at', aliasedName, false,
          type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _occurredAtMeta =
      const VerificationMeta('occurredAt');
  @override
  late final GeneratedColumn<DateTime> occurredAt = GeneratedColumn<DateTime>(
      'occurred_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _operationIdMeta =
      const VerificationMeta('operationId');
  @override
  late final GeneratedColumn<String> operationId = GeneratedColumn<String>(
      'operation_id', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: true,
      defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'));
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        ownerId,
        reminderOccurrenceId,
        actingDeviceId,
        fromState,
        toState,
        reason,
        originalScheduledAt,
        occurredAt,
        operationId,
        createdAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'reminder_transitions';
  @override
  VerificationContext validateIntegrity(Insertable<ReminderTransition> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('reminder_occurrence_id')) {
      context.handle(
          _reminderOccurrenceIdMeta,
          reminderOccurrenceId.isAcceptableOrUnknown(
              data['reminder_occurrence_id']!, _reminderOccurrenceIdMeta));
    } else if (isInserting) {
      context.missing(_reminderOccurrenceIdMeta);
    }
    if (data.containsKey('acting_device_id')) {
      context.handle(
          _actingDeviceIdMeta,
          actingDeviceId.isAcceptableOrUnknown(
              data['acting_device_id']!, _actingDeviceIdMeta));
    }
    if (data.containsKey('from_state')) {
      context.handle(_fromStateMeta,
          fromState.isAcceptableOrUnknown(data['from_state']!, _fromStateMeta));
    } else if (isInserting) {
      context.missing(_fromStateMeta);
    }
    if (data.containsKey('to_state')) {
      context.handle(_toStateMeta,
          toState.isAcceptableOrUnknown(data['to_state']!, _toStateMeta));
    } else if (isInserting) {
      context.missing(_toStateMeta);
    }
    if (data.containsKey('reason')) {
      context.handle(_reasonMeta,
          reason.isAcceptableOrUnknown(data['reason']!, _reasonMeta));
    }
    if (data.containsKey('original_scheduled_at')) {
      context.handle(
          _originalScheduledAtMeta,
          originalScheduledAt.isAcceptableOrUnknown(
              data['original_scheduled_at']!, _originalScheduledAtMeta));
    } else if (isInserting) {
      context.missing(_originalScheduledAtMeta);
    }
    if (data.containsKey('occurred_at')) {
      context.handle(
          _occurredAtMeta,
          occurredAt.isAcceptableOrUnknown(
              data['occurred_at']!, _occurredAtMeta));
    } else if (isInserting) {
      context.missing(_occurredAtMeta);
    }
    if (data.containsKey('operation_id')) {
      context.handle(
          _operationIdMeta,
          operationId.isAcceptableOrUnknown(
              data['operation_id']!, _operationIdMeta));
    } else if (isInserting) {
      context.missing(_operationIdMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ReminderTransition map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ReminderTransition(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      reminderOccurrenceId: attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}reminder_occurrence_id'])!,
      actingDeviceId: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}acting_device_id']),
      fromState: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}from_state'])!,
      toState: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}to_state'])!,
      reason: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}reason']),
      originalScheduledAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime,
          data['${effectivePrefix}original_scheduled_at'])!,
      occurredAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}occurred_at'])!,
      operationId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}operation_id'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
    );
  }

  @override
  $ReminderTransitionsTable createAlias(String alias) {
    return $ReminderTransitionsTable(attachedDatabase, alias);
  }
}

class ReminderTransition extends DataClass
    implements Insertable<ReminderTransition> {
  final String id;
  final String ownerId;
  final String reminderOccurrenceId;
  final String? actingDeviceId;
  final String fromState;
  final String toState;
  final String? reason;
  final DateTime originalScheduledAt;
  final DateTime occurredAt;
  final String operationId;
  final DateTime createdAt;
  const ReminderTransition(
      {required this.id,
      required this.ownerId,
      required this.reminderOccurrenceId,
      this.actingDeviceId,
      required this.fromState,
      required this.toState,
      this.reason,
      required this.originalScheduledAt,
      required this.occurredAt,
      required this.operationId,
      required this.createdAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_id'] = Variable<String>(ownerId);
    map['reminder_occurrence_id'] = Variable<String>(reminderOccurrenceId);
    if (!nullToAbsent || actingDeviceId != null) {
      map['acting_device_id'] = Variable<String>(actingDeviceId);
    }
    map['from_state'] = Variable<String>(fromState);
    map['to_state'] = Variable<String>(toState);
    if (!nullToAbsent || reason != null) {
      map['reason'] = Variable<String>(reason);
    }
    map['original_scheduled_at'] = Variable<DateTime>(originalScheduledAt);
    map['occurred_at'] = Variable<DateTime>(occurredAt);
    map['operation_id'] = Variable<String>(operationId);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  ReminderTransitionsCompanion toCompanion(bool nullToAbsent) {
    return ReminderTransitionsCompanion(
      id: Value(id),
      ownerId: Value(ownerId),
      reminderOccurrenceId: Value(reminderOccurrenceId),
      actingDeviceId: actingDeviceId == null && nullToAbsent
          ? const Value.absent()
          : Value(actingDeviceId),
      fromState: Value(fromState),
      toState: Value(toState),
      reason:
          reason == null && nullToAbsent ? const Value.absent() : Value(reason),
      originalScheduledAt: Value(originalScheduledAt),
      occurredAt: Value(occurredAt),
      operationId: Value(operationId),
      createdAt: Value(createdAt),
    );
  }

  factory ReminderTransition.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ReminderTransition(
      id: serializer.fromJson<String>(json['id']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      reminderOccurrenceId:
          serializer.fromJson<String>(json['reminderOccurrenceId']),
      actingDeviceId: serializer.fromJson<String?>(json['actingDeviceId']),
      fromState: serializer.fromJson<String>(json['fromState']),
      toState: serializer.fromJson<String>(json['toState']),
      reason: serializer.fromJson<String?>(json['reason']),
      originalScheduledAt:
          serializer.fromJson<DateTime>(json['originalScheduledAt']),
      occurredAt: serializer.fromJson<DateTime>(json['occurredAt']),
      operationId: serializer.fromJson<String>(json['operationId']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerId': serializer.toJson<String>(ownerId),
      'reminderOccurrenceId': serializer.toJson<String>(reminderOccurrenceId),
      'actingDeviceId': serializer.toJson<String?>(actingDeviceId),
      'fromState': serializer.toJson<String>(fromState),
      'toState': serializer.toJson<String>(toState),
      'reason': serializer.toJson<String?>(reason),
      'originalScheduledAt': serializer.toJson<DateTime>(originalScheduledAt),
      'occurredAt': serializer.toJson<DateTime>(occurredAt),
      'operationId': serializer.toJson<String>(operationId),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  ReminderTransition copyWith(
          {String? id,
          String? ownerId,
          String? reminderOccurrenceId,
          Value<String?> actingDeviceId = const Value.absent(),
          String? fromState,
          String? toState,
          Value<String?> reason = const Value.absent(),
          DateTime? originalScheduledAt,
          DateTime? occurredAt,
          String? operationId,
          DateTime? createdAt}) =>
      ReminderTransition(
        id: id ?? this.id,
        ownerId: ownerId ?? this.ownerId,
        reminderOccurrenceId: reminderOccurrenceId ?? this.reminderOccurrenceId,
        actingDeviceId:
            actingDeviceId.present ? actingDeviceId.value : this.actingDeviceId,
        fromState: fromState ?? this.fromState,
        toState: toState ?? this.toState,
        reason: reason.present ? reason.value : this.reason,
        originalScheduledAt: originalScheduledAt ?? this.originalScheduledAt,
        occurredAt: occurredAt ?? this.occurredAt,
        operationId: operationId ?? this.operationId,
        createdAt: createdAt ?? this.createdAt,
      );
  ReminderTransition copyWithCompanion(ReminderTransitionsCompanion data) {
    return ReminderTransition(
      id: data.id.present ? data.id.value : this.id,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      reminderOccurrenceId: data.reminderOccurrenceId.present
          ? data.reminderOccurrenceId.value
          : this.reminderOccurrenceId,
      actingDeviceId: data.actingDeviceId.present
          ? data.actingDeviceId.value
          : this.actingDeviceId,
      fromState: data.fromState.present ? data.fromState.value : this.fromState,
      toState: data.toState.present ? data.toState.value : this.toState,
      reason: data.reason.present ? data.reason.value : this.reason,
      originalScheduledAt: data.originalScheduledAt.present
          ? data.originalScheduledAt.value
          : this.originalScheduledAt,
      occurredAt:
          data.occurredAt.present ? data.occurredAt.value : this.occurredAt,
      operationId:
          data.operationId.present ? data.operationId.value : this.operationId,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ReminderTransition(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('reminderOccurrenceId: $reminderOccurrenceId, ')
          ..write('actingDeviceId: $actingDeviceId, ')
          ..write('fromState: $fromState, ')
          ..write('toState: $toState, ')
          ..write('reason: $reason, ')
          ..write('originalScheduledAt: $originalScheduledAt, ')
          ..write('occurredAt: $occurredAt, ')
          ..write('operationId: $operationId, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      ownerId,
      reminderOccurrenceId,
      actingDeviceId,
      fromState,
      toState,
      reason,
      originalScheduledAt,
      occurredAt,
      operationId,
      createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ReminderTransition &&
          other.id == this.id &&
          other.ownerId == this.ownerId &&
          other.reminderOccurrenceId == this.reminderOccurrenceId &&
          other.actingDeviceId == this.actingDeviceId &&
          other.fromState == this.fromState &&
          other.toState == this.toState &&
          other.reason == this.reason &&
          other.originalScheduledAt == this.originalScheduledAt &&
          other.occurredAt == this.occurredAt &&
          other.operationId == this.operationId &&
          other.createdAt == this.createdAt);
}

class ReminderTransitionsCompanion extends UpdateCompanion<ReminderTransition> {
  final Value<String> id;
  final Value<String> ownerId;
  final Value<String> reminderOccurrenceId;
  final Value<String?> actingDeviceId;
  final Value<String> fromState;
  final Value<String> toState;
  final Value<String?> reason;
  final Value<DateTime> originalScheduledAt;
  final Value<DateTime> occurredAt;
  final Value<String> operationId;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const ReminderTransitionsCompanion({
    this.id = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.reminderOccurrenceId = const Value.absent(),
    this.actingDeviceId = const Value.absent(),
    this.fromState = const Value.absent(),
    this.toState = const Value.absent(),
    this.reason = const Value.absent(),
    this.originalScheduledAt = const Value.absent(),
    this.occurredAt = const Value.absent(),
    this.operationId = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ReminderTransitionsCompanion.insert({
    required String id,
    required String ownerId,
    required String reminderOccurrenceId,
    this.actingDeviceId = const Value.absent(),
    required String fromState,
    required String toState,
    this.reason = const Value.absent(),
    required DateTime originalScheduledAt,
    required DateTime occurredAt,
    required String operationId,
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerId = Value(ownerId),
        reminderOccurrenceId = Value(reminderOccurrenceId),
        fromState = Value(fromState),
        toState = Value(toState),
        originalScheduledAt = Value(originalScheduledAt),
        occurredAt = Value(occurredAt),
        operationId = Value(operationId),
        createdAt = Value(createdAt);
  static Insertable<ReminderTransition> custom({
    Expression<String>? id,
    Expression<String>? ownerId,
    Expression<String>? reminderOccurrenceId,
    Expression<String>? actingDeviceId,
    Expression<String>? fromState,
    Expression<String>? toState,
    Expression<String>? reason,
    Expression<DateTime>? originalScheduledAt,
    Expression<DateTime>? occurredAt,
    Expression<String>? operationId,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerId != null) 'owner_id': ownerId,
      if (reminderOccurrenceId != null)
        'reminder_occurrence_id': reminderOccurrenceId,
      if (actingDeviceId != null) 'acting_device_id': actingDeviceId,
      if (fromState != null) 'from_state': fromState,
      if (toState != null) 'to_state': toState,
      if (reason != null) 'reason': reason,
      if (originalScheduledAt != null)
        'original_scheduled_at': originalScheduledAt,
      if (occurredAt != null) 'occurred_at': occurredAt,
      if (operationId != null) 'operation_id': operationId,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ReminderTransitionsCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerId,
      Value<String>? reminderOccurrenceId,
      Value<String?>? actingDeviceId,
      Value<String>? fromState,
      Value<String>? toState,
      Value<String?>? reason,
      Value<DateTime>? originalScheduledAt,
      Value<DateTime>? occurredAt,
      Value<String>? operationId,
      Value<DateTime>? createdAt,
      Value<int>? rowid}) {
    return ReminderTransitionsCompanion(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      reminderOccurrenceId: reminderOccurrenceId ?? this.reminderOccurrenceId,
      actingDeviceId: actingDeviceId ?? this.actingDeviceId,
      fromState: fromState ?? this.fromState,
      toState: toState ?? this.toState,
      reason: reason ?? this.reason,
      originalScheduledAt: originalScheduledAt ?? this.originalScheduledAt,
      occurredAt: occurredAt ?? this.occurredAt,
      operationId: operationId ?? this.operationId,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (reminderOccurrenceId.present) {
      map['reminder_occurrence_id'] =
          Variable<String>(reminderOccurrenceId.value);
    }
    if (actingDeviceId.present) {
      map['acting_device_id'] = Variable<String>(actingDeviceId.value);
    }
    if (fromState.present) {
      map['from_state'] = Variable<String>(fromState.value);
    }
    if (toState.present) {
      map['to_state'] = Variable<String>(toState.value);
    }
    if (reason.present) {
      map['reason'] = Variable<String>(reason.value);
    }
    if (originalScheduledAt.present) {
      map['original_scheduled_at'] =
          Variable<DateTime>(originalScheduledAt.value);
    }
    if (occurredAt.present) {
      map['occurred_at'] = Variable<DateTime>(occurredAt.value);
    }
    if (operationId.present) {
      map['operation_id'] = Variable<String>(operationId.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ReminderTransitionsCompanion(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('reminderOccurrenceId: $reminderOccurrenceId, ')
          ..write('actingDeviceId: $actingDeviceId, ')
          ..write('fromState: $fromState, ')
          ..write('toState: $toState, ')
          ..write('reason: $reason, ')
          ..write('originalScheduledAt: $originalScheduledAt, ')
          ..write('occurredAt: $occurredAt, ')
          ..write('operationId: $operationId, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CategoriesTable extends Categories
    with TableInfo<$CategoriesTable, Category> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CategoriesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _colorMeta = const VerificationMeta('color');
  @override
  late final GeneratedColumn<String> color = GeneratedColumn<String>(
      'color', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _versionMeta =
      const VerificationMeta('version');
  @override
  late final GeneratedColumn<String> version = GeneratedColumn<String>(
      'version', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _deletedAtMeta =
      const VerificationMeta('deletedAt');
  @override
  late final GeneratedColumn<DateTime> deletedAt = GeneratedColumn<DateTime>(
      'deleted_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [id, ownerId, name, color, version, deletedAt, createdAt, updatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'categories';
  @override
  VerificationContext validateIntegrity(Insertable<Category> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('color')) {
      context.handle(
          _colorMeta, color.isAcceptableOrUnknown(data['color']!, _colorMeta));
    }
    if (data.containsKey('version')) {
      context.handle(_versionMeta,
          version.isAcceptableOrUnknown(data['version']!, _versionMeta));
    } else if (isInserting) {
      context.missing(_versionMeta);
    }
    if (data.containsKey('deleted_at')) {
      context.handle(_deletedAtMeta,
          deletedAt.isAcceptableOrUnknown(data['deleted_at']!, _deletedAtMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Category map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Category(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      color: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}color']),
      version: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}version'])!,
      deletedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}deleted_at']),
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
    );
  }

  @override
  $CategoriesTable createAlias(String alias) {
    return $CategoriesTable(attachedDatabase, alias);
  }
}

class Category extends DataClass implements Insertable<Category> {
  final String id;
  final String ownerId;
  final String name;
  final String? color;
  final String version;
  final DateTime? deletedAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  const Category(
      {required this.id,
      required this.ownerId,
      required this.name,
      this.color,
      required this.version,
      this.deletedAt,
      required this.createdAt,
      required this.updatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_id'] = Variable<String>(ownerId);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || color != null) {
      map['color'] = Variable<String>(color);
    }
    map['version'] = Variable<String>(version);
    if (!nullToAbsent || deletedAt != null) {
      map['deleted_at'] = Variable<DateTime>(deletedAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  CategoriesCompanion toCompanion(bool nullToAbsent) {
    return CategoriesCompanion(
      id: Value(id),
      ownerId: Value(ownerId),
      name: Value(name),
      color:
          color == null && nullToAbsent ? const Value.absent() : Value(color),
      version: Value(version),
      deletedAt: deletedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(deletedAt),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory Category.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Category(
      id: serializer.fromJson<String>(json['id']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      name: serializer.fromJson<String>(json['name']),
      color: serializer.fromJson<String?>(json['color']),
      version: serializer.fromJson<String>(json['version']),
      deletedAt: serializer.fromJson<DateTime?>(json['deletedAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerId': serializer.toJson<String>(ownerId),
      'name': serializer.toJson<String>(name),
      'color': serializer.toJson<String?>(color),
      'version': serializer.toJson<String>(version),
      'deletedAt': serializer.toJson<DateTime?>(deletedAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  Category copyWith(
          {String? id,
          String? ownerId,
          String? name,
          Value<String?> color = const Value.absent(),
          String? version,
          Value<DateTime?> deletedAt = const Value.absent(),
          DateTime? createdAt,
          DateTime? updatedAt}) =>
      Category(
        id: id ?? this.id,
        ownerId: ownerId ?? this.ownerId,
        name: name ?? this.name,
        color: color.present ? color.value : this.color,
        version: version ?? this.version,
        deletedAt: deletedAt.present ? deletedAt.value : this.deletedAt,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );
  Category copyWithCompanion(CategoriesCompanion data) {
    return Category(
      id: data.id.present ? data.id.value : this.id,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      name: data.name.present ? data.name.value : this.name,
      color: data.color.present ? data.color.value : this.color,
      version: data.version.present ? data.version.value : this.version,
      deletedAt: data.deletedAt.present ? data.deletedAt.value : this.deletedAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Category(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('name: $name, ')
          ..write('color: $color, ')
          ..write('version: $version, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id, ownerId, name, color, version, deletedAt, createdAt, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Category &&
          other.id == this.id &&
          other.ownerId == this.ownerId &&
          other.name == this.name &&
          other.color == this.color &&
          other.version == this.version &&
          other.deletedAt == this.deletedAt &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class CategoriesCompanion extends UpdateCompanion<Category> {
  final Value<String> id;
  final Value<String> ownerId;
  final Value<String> name;
  final Value<String?> color;
  final Value<String> version;
  final Value<DateTime?> deletedAt;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const CategoriesCompanion({
    this.id = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.name = const Value.absent(),
    this.color = const Value.absent(),
    this.version = const Value.absent(),
    this.deletedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CategoriesCompanion.insert({
    required String id,
    required String ownerId,
    required String name,
    this.color = const Value.absent(),
    required String version,
    this.deletedAt = const Value.absent(),
    required DateTime createdAt,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerId = Value(ownerId),
        name = Value(name),
        version = Value(version),
        createdAt = Value(createdAt),
        updatedAt = Value(updatedAt);
  static Insertable<Category> custom({
    Expression<String>? id,
    Expression<String>? ownerId,
    Expression<String>? name,
    Expression<String>? color,
    Expression<String>? version,
    Expression<DateTime>? deletedAt,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerId != null) 'owner_id': ownerId,
      if (name != null) 'name': name,
      if (color != null) 'color': color,
      if (version != null) 'version': version,
      if (deletedAt != null) 'deleted_at': deletedAt,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CategoriesCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerId,
      Value<String>? name,
      Value<String?>? color,
      Value<String>? version,
      Value<DateTime?>? deletedAt,
      Value<DateTime>? createdAt,
      Value<DateTime>? updatedAt,
      Value<int>? rowid}) {
    return CategoriesCompanion(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      name: name ?? this.name,
      color: color ?? this.color,
      version: version ?? this.version,
      deletedAt: deletedAt ?? this.deletedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (color.present) {
      map['color'] = Variable<String>(color.value);
    }
    if (version.present) {
      map['version'] = Variable<String>(version.value);
    }
    if (deletedAt.present) {
      map['deleted_at'] = Variable<DateTime>(deletedAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CategoriesCompanion(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('name: $name, ')
          ..write('color: $color, ')
          ..write('version: $version, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CheckInsTable extends CheckIns with TableInfo<$CheckInsTable, CheckIn> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CheckInsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _reminderOccurrenceIdMeta =
      const VerificationMeta('reminderOccurrenceId');
  @override
  late final GeneratedColumn<String> reminderOccurrenceId =
      GeneratedColumn<String>('reminder_occurrence_id', aliasedName, true,
          type: DriftSqlType.string,
          requiredDuringInsert: false,
          defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'));
  static const VerificationMeta _focusSessionIdMeta =
      const VerificationMeta('focusSessionId');
  @override
  late final GeneratedColumn<String> focusSessionId = GeneratedColumn<String>(
      'focus_session_id', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _categoryIdMeta =
      const VerificationMeta('categoryId');
  @override
  late final GeneratedColumn<String> categoryId = GeneratedColumn<String>(
      'category_id', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _currentRevisionIdMeta =
      const VerificationMeta('currentRevisionId');
  @override
  late final GeneratedColumn<String> currentRevisionId =
      GeneratedColumn<String>('current_revision_id', aliasedName, true,
          type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _submittedAtMeta =
      const VerificationMeta('submittedAt');
  @override
  late final GeneratedColumn<DateTime> submittedAt = GeneratedColumn<DateTime>(
      'submitted_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _timezoneIdMeta =
      const VerificationMeta('timezoneId');
  @override
  late final GeneratedColumn<String> timezoneId = GeneratedColumn<String>(
      'timezone_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _versionMeta =
      const VerificationMeta('version');
  @override
  late final GeneratedColumn<String> version = GeneratedColumn<String>(
      'version', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _deletedAtMeta =
      const VerificationMeta('deletedAt');
  @override
  late final GeneratedColumn<DateTime> deletedAt = GeneratedColumn<DateTime>(
      'deleted_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        ownerId,
        reminderOccurrenceId,
        focusSessionId,
        categoryId,
        currentRevisionId,
        submittedAt,
        timezoneId,
        version,
        deletedAt,
        createdAt,
        updatedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'check_ins';
  @override
  VerificationContext validateIntegrity(Insertable<CheckIn> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('reminder_occurrence_id')) {
      context.handle(
          _reminderOccurrenceIdMeta,
          reminderOccurrenceId.isAcceptableOrUnknown(
              data['reminder_occurrence_id']!, _reminderOccurrenceIdMeta));
    }
    if (data.containsKey('focus_session_id')) {
      context.handle(
          _focusSessionIdMeta,
          focusSessionId.isAcceptableOrUnknown(
              data['focus_session_id']!, _focusSessionIdMeta));
    }
    if (data.containsKey('category_id')) {
      context.handle(
          _categoryIdMeta,
          categoryId.isAcceptableOrUnknown(
              data['category_id']!, _categoryIdMeta));
    }
    if (data.containsKey('current_revision_id')) {
      context.handle(
          _currentRevisionIdMeta,
          currentRevisionId.isAcceptableOrUnknown(
              data['current_revision_id']!, _currentRevisionIdMeta));
    }
    if (data.containsKey('submitted_at')) {
      context.handle(
          _submittedAtMeta,
          submittedAt.isAcceptableOrUnknown(
              data['submitted_at']!, _submittedAtMeta));
    } else if (isInserting) {
      context.missing(_submittedAtMeta);
    }
    if (data.containsKey('timezone_id')) {
      context.handle(
          _timezoneIdMeta,
          timezoneId.isAcceptableOrUnknown(
              data['timezone_id']!, _timezoneIdMeta));
    } else if (isInserting) {
      context.missing(_timezoneIdMeta);
    }
    if (data.containsKey('version')) {
      context.handle(_versionMeta,
          version.isAcceptableOrUnknown(data['version']!, _versionMeta));
    } else if (isInserting) {
      context.missing(_versionMeta);
    }
    if (data.containsKey('deleted_at')) {
      context.handle(_deletedAtMeta,
          deletedAt.isAcceptableOrUnknown(data['deleted_at']!, _deletedAtMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CheckIn map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CheckIn(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      reminderOccurrenceId: attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}reminder_occurrence_id']),
      focusSessionId: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}focus_session_id']),
      categoryId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}category_id']),
      currentRevisionId: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}current_revision_id']),
      submittedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}submitted_at'])!,
      timezoneId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}timezone_id'])!,
      version: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}version'])!,
      deletedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}deleted_at']),
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
    );
  }

  @override
  $CheckInsTable createAlias(String alias) {
    return $CheckInsTable(attachedDatabase, alias);
  }
}

class CheckIn extends DataClass implements Insertable<CheckIn> {
  final String id;
  final String ownerId;
  final String? reminderOccurrenceId;
  final String? focusSessionId;
  final String? categoryId;
  final String? currentRevisionId;
  final DateTime submittedAt;
  final String timezoneId;
  final String version;
  final DateTime? deletedAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  const CheckIn(
      {required this.id,
      required this.ownerId,
      this.reminderOccurrenceId,
      this.focusSessionId,
      this.categoryId,
      this.currentRevisionId,
      required this.submittedAt,
      required this.timezoneId,
      required this.version,
      this.deletedAt,
      required this.createdAt,
      required this.updatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_id'] = Variable<String>(ownerId);
    if (!nullToAbsent || reminderOccurrenceId != null) {
      map['reminder_occurrence_id'] = Variable<String>(reminderOccurrenceId);
    }
    if (!nullToAbsent || focusSessionId != null) {
      map['focus_session_id'] = Variable<String>(focusSessionId);
    }
    if (!nullToAbsent || categoryId != null) {
      map['category_id'] = Variable<String>(categoryId);
    }
    if (!nullToAbsent || currentRevisionId != null) {
      map['current_revision_id'] = Variable<String>(currentRevisionId);
    }
    map['submitted_at'] = Variable<DateTime>(submittedAt);
    map['timezone_id'] = Variable<String>(timezoneId);
    map['version'] = Variable<String>(version);
    if (!nullToAbsent || deletedAt != null) {
      map['deleted_at'] = Variable<DateTime>(deletedAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  CheckInsCompanion toCompanion(bool nullToAbsent) {
    return CheckInsCompanion(
      id: Value(id),
      ownerId: Value(ownerId),
      reminderOccurrenceId: reminderOccurrenceId == null && nullToAbsent
          ? const Value.absent()
          : Value(reminderOccurrenceId),
      focusSessionId: focusSessionId == null && nullToAbsent
          ? const Value.absent()
          : Value(focusSessionId),
      categoryId: categoryId == null && nullToAbsent
          ? const Value.absent()
          : Value(categoryId),
      currentRevisionId: currentRevisionId == null && nullToAbsent
          ? const Value.absent()
          : Value(currentRevisionId),
      submittedAt: Value(submittedAt),
      timezoneId: Value(timezoneId),
      version: Value(version),
      deletedAt: deletedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(deletedAt),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory CheckIn.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CheckIn(
      id: serializer.fromJson<String>(json['id']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      reminderOccurrenceId:
          serializer.fromJson<String?>(json['reminderOccurrenceId']),
      focusSessionId: serializer.fromJson<String?>(json['focusSessionId']),
      categoryId: serializer.fromJson<String?>(json['categoryId']),
      currentRevisionId:
          serializer.fromJson<String?>(json['currentRevisionId']),
      submittedAt: serializer.fromJson<DateTime>(json['submittedAt']),
      timezoneId: serializer.fromJson<String>(json['timezoneId']),
      version: serializer.fromJson<String>(json['version']),
      deletedAt: serializer.fromJson<DateTime?>(json['deletedAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerId': serializer.toJson<String>(ownerId),
      'reminderOccurrenceId': serializer.toJson<String?>(reminderOccurrenceId),
      'focusSessionId': serializer.toJson<String?>(focusSessionId),
      'categoryId': serializer.toJson<String?>(categoryId),
      'currentRevisionId': serializer.toJson<String?>(currentRevisionId),
      'submittedAt': serializer.toJson<DateTime>(submittedAt),
      'timezoneId': serializer.toJson<String>(timezoneId),
      'version': serializer.toJson<String>(version),
      'deletedAt': serializer.toJson<DateTime?>(deletedAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  CheckIn copyWith(
          {String? id,
          String? ownerId,
          Value<String?> reminderOccurrenceId = const Value.absent(),
          Value<String?> focusSessionId = const Value.absent(),
          Value<String?> categoryId = const Value.absent(),
          Value<String?> currentRevisionId = const Value.absent(),
          DateTime? submittedAt,
          String? timezoneId,
          String? version,
          Value<DateTime?> deletedAt = const Value.absent(),
          DateTime? createdAt,
          DateTime? updatedAt}) =>
      CheckIn(
        id: id ?? this.id,
        ownerId: ownerId ?? this.ownerId,
        reminderOccurrenceId: reminderOccurrenceId.present
            ? reminderOccurrenceId.value
            : this.reminderOccurrenceId,
        focusSessionId:
            focusSessionId.present ? focusSessionId.value : this.focusSessionId,
        categoryId: categoryId.present ? categoryId.value : this.categoryId,
        currentRevisionId: currentRevisionId.present
            ? currentRevisionId.value
            : this.currentRevisionId,
        submittedAt: submittedAt ?? this.submittedAt,
        timezoneId: timezoneId ?? this.timezoneId,
        version: version ?? this.version,
        deletedAt: deletedAt.present ? deletedAt.value : this.deletedAt,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );
  CheckIn copyWithCompanion(CheckInsCompanion data) {
    return CheckIn(
      id: data.id.present ? data.id.value : this.id,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      reminderOccurrenceId: data.reminderOccurrenceId.present
          ? data.reminderOccurrenceId.value
          : this.reminderOccurrenceId,
      focusSessionId: data.focusSessionId.present
          ? data.focusSessionId.value
          : this.focusSessionId,
      categoryId:
          data.categoryId.present ? data.categoryId.value : this.categoryId,
      currentRevisionId: data.currentRevisionId.present
          ? data.currentRevisionId.value
          : this.currentRevisionId,
      submittedAt:
          data.submittedAt.present ? data.submittedAt.value : this.submittedAt,
      timezoneId:
          data.timezoneId.present ? data.timezoneId.value : this.timezoneId,
      version: data.version.present ? data.version.value : this.version,
      deletedAt: data.deletedAt.present ? data.deletedAt.value : this.deletedAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CheckIn(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('reminderOccurrenceId: $reminderOccurrenceId, ')
          ..write('focusSessionId: $focusSessionId, ')
          ..write('categoryId: $categoryId, ')
          ..write('currentRevisionId: $currentRevisionId, ')
          ..write('submittedAt: $submittedAt, ')
          ..write('timezoneId: $timezoneId, ')
          ..write('version: $version, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      ownerId,
      reminderOccurrenceId,
      focusSessionId,
      categoryId,
      currentRevisionId,
      submittedAt,
      timezoneId,
      version,
      deletedAt,
      createdAt,
      updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CheckIn &&
          other.id == this.id &&
          other.ownerId == this.ownerId &&
          other.reminderOccurrenceId == this.reminderOccurrenceId &&
          other.focusSessionId == this.focusSessionId &&
          other.categoryId == this.categoryId &&
          other.currentRevisionId == this.currentRevisionId &&
          other.submittedAt == this.submittedAt &&
          other.timezoneId == this.timezoneId &&
          other.version == this.version &&
          other.deletedAt == this.deletedAt &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class CheckInsCompanion extends UpdateCompanion<CheckIn> {
  final Value<String> id;
  final Value<String> ownerId;
  final Value<String?> reminderOccurrenceId;
  final Value<String?> focusSessionId;
  final Value<String?> categoryId;
  final Value<String?> currentRevisionId;
  final Value<DateTime> submittedAt;
  final Value<String> timezoneId;
  final Value<String> version;
  final Value<DateTime?> deletedAt;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const CheckInsCompanion({
    this.id = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.reminderOccurrenceId = const Value.absent(),
    this.focusSessionId = const Value.absent(),
    this.categoryId = const Value.absent(),
    this.currentRevisionId = const Value.absent(),
    this.submittedAt = const Value.absent(),
    this.timezoneId = const Value.absent(),
    this.version = const Value.absent(),
    this.deletedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CheckInsCompanion.insert({
    required String id,
    required String ownerId,
    this.reminderOccurrenceId = const Value.absent(),
    this.focusSessionId = const Value.absent(),
    this.categoryId = const Value.absent(),
    this.currentRevisionId = const Value.absent(),
    required DateTime submittedAt,
    required String timezoneId,
    required String version,
    this.deletedAt = const Value.absent(),
    required DateTime createdAt,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerId = Value(ownerId),
        submittedAt = Value(submittedAt),
        timezoneId = Value(timezoneId),
        version = Value(version),
        createdAt = Value(createdAt),
        updatedAt = Value(updatedAt);
  static Insertable<CheckIn> custom({
    Expression<String>? id,
    Expression<String>? ownerId,
    Expression<String>? reminderOccurrenceId,
    Expression<String>? focusSessionId,
    Expression<String>? categoryId,
    Expression<String>? currentRevisionId,
    Expression<DateTime>? submittedAt,
    Expression<String>? timezoneId,
    Expression<String>? version,
    Expression<DateTime>? deletedAt,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerId != null) 'owner_id': ownerId,
      if (reminderOccurrenceId != null)
        'reminder_occurrence_id': reminderOccurrenceId,
      if (focusSessionId != null) 'focus_session_id': focusSessionId,
      if (categoryId != null) 'category_id': categoryId,
      if (currentRevisionId != null) 'current_revision_id': currentRevisionId,
      if (submittedAt != null) 'submitted_at': submittedAt,
      if (timezoneId != null) 'timezone_id': timezoneId,
      if (version != null) 'version': version,
      if (deletedAt != null) 'deleted_at': deletedAt,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CheckInsCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerId,
      Value<String?>? reminderOccurrenceId,
      Value<String?>? focusSessionId,
      Value<String?>? categoryId,
      Value<String?>? currentRevisionId,
      Value<DateTime>? submittedAt,
      Value<String>? timezoneId,
      Value<String>? version,
      Value<DateTime?>? deletedAt,
      Value<DateTime>? createdAt,
      Value<DateTime>? updatedAt,
      Value<int>? rowid}) {
    return CheckInsCompanion(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      reminderOccurrenceId: reminderOccurrenceId ?? this.reminderOccurrenceId,
      focusSessionId: focusSessionId ?? this.focusSessionId,
      categoryId: categoryId ?? this.categoryId,
      currentRevisionId: currentRevisionId ?? this.currentRevisionId,
      submittedAt: submittedAt ?? this.submittedAt,
      timezoneId: timezoneId ?? this.timezoneId,
      version: version ?? this.version,
      deletedAt: deletedAt ?? this.deletedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (reminderOccurrenceId.present) {
      map['reminder_occurrence_id'] =
          Variable<String>(reminderOccurrenceId.value);
    }
    if (focusSessionId.present) {
      map['focus_session_id'] = Variable<String>(focusSessionId.value);
    }
    if (categoryId.present) {
      map['category_id'] = Variable<String>(categoryId.value);
    }
    if (currentRevisionId.present) {
      map['current_revision_id'] = Variable<String>(currentRevisionId.value);
    }
    if (submittedAt.present) {
      map['submitted_at'] = Variable<DateTime>(submittedAt.value);
    }
    if (timezoneId.present) {
      map['timezone_id'] = Variable<String>(timezoneId.value);
    }
    if (version.present) {
      map['version'] = Variable<String>(version.value);
    }
    if (deletedAt.present) {
      map['deleted_at'] = Variable<DateTime>(deletedAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CheckInsCompanion(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('reminderOccurrenceId: $reminderOccurrenceId, ')
          ..write('focusSessionId: $focusSessionId, ')
          ..write('categoryId: $categoryId, ')
          ..write('currentRevisionId: $currentRevisionId, ')
          ..write('submittedAt: $submittedAt, ')
          ..write('timezoneId: $timezoneId, ')
          ..write('version: $version, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CheckInRevisionsTable extends CheckInRevisions
    with TableInfo<$CheckInRevisionsTable, CheckInRevision> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CheckInRevisionsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _checkInIdMeta =
      const VerificationMeta('checkInId');
  @override
  late final GeneratedColumn<String> checkInId = GeneratedColumn<String>(
      'check_in_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _parentRevisionIdMeta =
      const VerificationMeta('parentRevisionId');
  @override
  late final GeneratedColumn<String> parentRevisionId = GeneratedColumn<String>(
      'parent_revision_id', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _bodyMeta = const VerificationMeta('body');
  @override
  late final GeneratedColumn<String> body = GeneratedColumn<String>(
      'body', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _authorDeviceIdMeta =
      const VerificationMeta('authorDeviceId');
  @override
  late final GeneratedColumn<String> authorDeviceId = GeneratedColumn<String>(
      'author_device_id', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _operationIdMeta =
      const VerificationMeta('operationId');
  @override
  late final GeneratedColumn<String> operationId = GeneratedColumn<String>(
      'operation_id', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: true,
      defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'));
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _deletedAtMeta =
      const VerificationMeta('deletedAt');
  @override
  late final GeneratedColumn<DateTime> deletedAt = GeneratedColumn<DateTime>(
      'deleted_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        checkInId,
        parentRevisionId,
        body,
        authorDeviceId,
        operationId,
        createdAt,
        deletedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'check_in_revisions';
  @override
  VerificationContext validateIntegrity(Insertable<CheckInRevision> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('check_in_id')) {
      context.handle(
          _checkInIdMeta,
          checkInId.isAcceptableOrUnknown(
              data['check_in_id']!, _checkInIdMeta));
    } else if (isInserting) {
      context.missing(_checkInIdMeta);
    }
    if (data.containsKey('parent_revision_id')) {
      context.handle(
          _parentRevisionIdMeta,
          parentRevisionId.isAcceptableOrUnknown(
              data['parent_revision_id']!, _parentRevisionIdMeta));
    }
    if (data.containsKey('body')) {
      context.handle(
          _bodyMeta, body.isAcceptableOrUnknown(data['body']!, _bodyMeta));
    } else if (isInserting) {
      context.missing(_bodyMeta);
    }
    if (data.containsKey('author_device_id')) {
      context.handle(
          _authorDeviceIdMeta,
          authorDeviceId.isAcceptableOrUnknown(
              data['author_device_id']!, _authorDeviceIdMeta));
    }
    if (data.containsKey('operation_id')) {
      context.handle(
          _operationIdMeta,
          operationId.isAcceptableOrUnknown(
              data['operation_id']!, _operationIdMeta));
    } else if (isInserting) {
      context.missing(_operationIdMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('deleted_at')) {
      context.handle(_deletedAtMeta,
          deletedAt.isAcceptableOrUnknown(data['deleted_at']!, _deletedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CheckInRevision map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CheckInRevision(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      checkInId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}check_in_id'])!,
      parentRevisionId: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}parent_revision_id']),
      body: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}body'])!,
      authorDeviceId: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}author_device_id']),
      operationId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}operation_id'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      deletedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}deleted_at']),
    );
  }

  @override
  $CheckInRevisionsTable createAlias(String alias) {
    return $CheckInRevisionsTable(attachedDatabase, alias);
  }
}

class CheckInRevision extends DataClass implements Insertable<CheckInRevision> {
  final String id;
  final String checkInId;
  final String? parentRevisionId;
  final String body;
  final String? authorDeviceId;
  final String operationId;
  final DateTime createdAt;
  final DateTime? deletedAt;
  const CheckInRevision(
      {required this.id,
      required this.checkInId,
      this.parentRevisionId,
      required this.body,
      this.authorDeviceId,
      required this.operationId,
      required this.createdAt,
      this.deletedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['check_in_id'] = Variable<String>(checkInId);
    if (!nullToAbsent || parentRevisionId != null) {
      map['parent_revision_id'] = Variable<String>(parentRevisionId);
    }
    map['body'] = Variable<String>(body);
    if (!nullToAbsent || authorDeviceId != null) {
      map['author_device_id'] = Variable<String>(authorDeviceId);
    }
    map['operation_id'] = Variable<String>(operationId);
    map['created_at'] = Variable<DateTime>(createdAt);
    if (!nullToAbsent || deletedAt != null) {
      map['deleted_at'] = Variable<DateTime>(deletedAt);
    }
    return map;
  }

  CheckInRevisionsCompanion toCompanion(bool nullToAbsent) {
    return CheckInRevisionsCompanion(
      id: Value(id),
      checkInId: Value(checkInId),
      parentRevisionId: parentRevisionId == null && nullToAbsent
          ? const Value.absent()
          : Value(parentRevisionId),
      body: Value(body),
      authorDeviceId: authorDeviceId == null && nullToAbsent
          ? const Value.absent()
          : Value(authorDeviceId),
      operationId: Value(operationId),
      createdAt: Value(createdAt),
      deletedAt: deletedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(deletedAt),
    );
  }

  factory CheckInRevision.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CheckInRevision(
      id: serializer.fromJson<String>(json['id']),
      checkInId: serializer.fromJson<String>(json['checkInId']),
      parentRevisionId: serializer.fromJson<String?>(json['parentRevisionId']),
      body: serializer.fromJson<String>(json['body']),
      authorDeviceId: serializer.fromJson<String?>(json['authorDeviceId']),
      operationId: serializer.fromJson<String>(json['operationId']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      deletedAt: serializer.fromJson<DateTime?>(json['deletedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'checkInId': serializer.toJson<String>(checkInId),
      'parentRevisionId': serializer.toJson<String?>(parentRevisionId),
      'body': serializer.toJson<String>(body),
      'authorDeviceId': serializer.toJson<String?>(authorDeviceId),
      'operationId': serializer.toJson<String>(operationId),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'deletedAt': serializer.toJson<DateTime?>(deletedAt),
    };
  }

  CheckInRevision copyWith(
          {String? id,
          String? checkInId,
          Value<String?> parentRevisionId = const Value.absent(),
          String? body,
          Value<String?> authorDeviceId = const Value.absent(),
          String? operationId,
          DateTime? createdAt,
          Value<DateTime?> deletedAt = const Value.absent()}) =>
      CheckInRevision(
        id: id ?? this.id,
        checkInId: checkInId ?? this.checkInId,
        parentRevisionId: parentRevisionId.present
            ? parentRevisionId.value
            : this.parentRevisionId,
        body: body ?? this.body,
        authorDeviceId:
            authorDeviceId.present ? authorDeviceId.value : this.authorDeviceId,
        operationId: operationId ?? this.operationId,
        createdAt: createdAt ?? this.createdAt,
        deletedAt: deletedAt.present ? deletedAt.value : this.deletedAt,
      );
  CheckInRevision copyWithCompanion(CheckInRevisionsCompanion data) {
    return CheckInRevision(
      id: data.id.present ? data.id.value : this.id,
      checkInId: data.checkInId.present ? data.checkInId.value : this.checkInId,
      parentRevisionId: data.parentRevisionId.present
          ? data.parentRevisionId.value
          : this.parentRevisionId,
      body: data.body.present ? data.body.value : this.body,
      authorDeviceId: data.authorDeviceId.present
          ? data.authorDeviceId.value
          : this.authorDeviceId,
      operationId:
          data.operationId.present ? data.operationId.value : this.operationId,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      deletedAt: data.deletedAt.present ? data.deletedAt.value : this.deletedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CheckInRevision(')
          ..write('id: $id, ')
          ..write('checkInId: $checkInId, ')
          ..write('parentRevisionId: $parentRevisionId, ')
          ..write('body: $body, ')
          ..write('authorDeviceId: $authorDeviceId, ')
          ..write('operationId: $operationId, ')
          ..write('createdAt: $createdAt, ')
          ..write('deletedAt: $deletedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, checkInId, parentRevisionId, body,
      authorDeviceId, operationId, createdAt, deletedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CheckInRevision &&
          other.id == this.id &&
          other.checkInId == this.checkInId &&
          other.parentRevisionId == this.parentRevisionId &&
          other.body == this.body &&
          other.authorDeviceId == this.authorDeviceId &&
          other.operationId == this.operationId &&
          other.createdAt == this.createdAt &&
          other.deletedAt == this.deletedAt);
}

class CheckInRevisionsCompanion extends UpdateCompanion<CheckInRevision> {
  final Value<String> id;
  final Value<String> checkInId;
  final Value<String?> parentRevisionId;
  final Value<String> body;
  final Value<String?> authorDeviceId;
  final Value<String> operationId;
  final Value<DateTime> createdAt;
  final Value<DateTime?> deletedAt;
  final Value<int> rowid;
  const CheckInRevisionsCompanion({
    this.id = const Value.absent(),
    this.checkInId = const Value.absent(),
    this.parentRevisionId = const Value.absent(),
    this.body = const Value.absent(),
    this.authorDeviceId = const Value.absent(),
    this.operationId = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.deletedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CheckInRevisionsCompanion.insert({
    required String id,
    required String checkInId,
    this.parentRevisionId = const Value.absent(),
    required String body,
    this.authorDeviceId = const Value.absent(),
    required String operationId,
    required DateTime createdAt,
    this.deletedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        checkInId = Value(checkInId),
        body = Value(body),
        operationId = Value(operationId),
        createdAt = Value(createdAt);
  static Insertable<CheckInRevision> custom({
    Expression<String>? id,
    Expression<String>? checkInId,
    Expression<String>? parentRevisionId,
    Expression<String>? body,
    Expression<String>? authorDeviceId,
    Expression<String>? operationId,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? deletedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (checkInId != null) 'check_in_id': checkInId,
      if (parentRevisionId != null) 'parent_revision_id': parentRevisionId,
      if (body != null) 'body': body,
      if (authorDeviceId != null) 'author_device_id': authorDeviceId,
      if (operationId != null) 'operation_id': operationId,
      if (createdAt != null) 'created_at': createdAt,
      if (deletedAt != null) 'deleted_at': deletedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CheckInRevisionsCompanion copyWith(
      {Value<String>? id,
      Value<String>? checkInId,
      Value<String?>? parentRevisionId,
      Value<String>? body,
      Value<String?>? authorDeviceId,
      Value<String>? operationId,
      Value<DateTime>? createdAt,
      Value<DateTime?>? deletedAt,
      Value<int>? rowid}) {
    return CheckInRevisionsCompanion(
      id: id ?? this.id,
      checkInId: checkInId ?? this.checkInId,
      parentRevisionId: parentRevisionId ?? this.parentRevisionId,
      body: body ?? this.body,
      authorDeviceId: authorDeviceId ?? this.authorDeviceId,
      operationId: operationId ?? this.operationId,
      createdAt: createdAt ?? this.createdAt,
      deletedAt: deletedAt ?? this.deletedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (checkInId.present) {
      map['check_in_id'] = Variable<String>(checkInId.value);
    }
    if (parentRevisionId.present) {
      map['parent_revision_id'] = Variable<String>(parentRevisionId.value);
    }
    if (body.present) {
      map['body'] = Variable<String>(body.value);
    }
    if (authorDeviceId.present) {
      map['author_device_id'] = Variable<String>(authorDeviceId.value);
    }
    if (operationId.present) {
      map['operation_id'] = Variable<String>(operationId.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (deletedAt.present) {
      map['deleted_at'] = Variable<DateTime>(deletedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CheckInRevisionsCompanion(')
          ..write('id: $id, ')
          ..write('checkInId: $checkInId, ')
          ..write('parentRevisionId: $parentRevisionId, ')
          ..write('body: $body, ')
          ..write('authorDeviceId: $authorDeviceId, ')
          ..write('operationId: $operationId, ')
          ..write('createdAt: $createdAt, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $TagsTable extends Tags with TableInfo<$TagsTable, Tag> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $TagsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _colorMeta = const VerificationMeta('color');
  @override
  late final GeneratedColumn<String> color = GeneratedColumn<String>(
      'color', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _versionMeta =
      const VerificationMeta('version');
  @override
  late final GeneratedColumn<String> version = GeneratedColumn<String>(
      'version', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _deletedAtMeta =
      const VerificationMeta('deletedAt');
  @override
  late final GeneratedColumn<DateTime> deletedAt = GeneratedColumn<DateTime>(
      'deleted_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [id, ownerId, name, color, version, deletedAt, createdAt, updatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'tags';
  @override
  VerificationContext validateIntegrity(Insertable<Tag> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('color')) {
      context.handle(
          _colorMeta, color.isAcceptableOrUnknown(data['color']!, _colorMeta));
    }
    if (data.containsKey('version')) {
      context.handle(_versionMeta,
          version.isAcceptableOrUnknown(data['version']!, _versionMeta));
    } else if (isInserting) {
      context.missing(_versionMeta);
    }
    if (data.containsKey('deleted_at')) {
      context.handle(_deletedAtMeta,
          deletedAt.isAcceptableOrUnknown(data['deleted_at']!, _deletedAtMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Tag map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Tag(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      color: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}color']),
      version: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}version'])!,
      deletedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}deleted_at']),
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
    );
  }

  @override
  $TagsTable createAlias(String alias) {
    return $TagsTable(attachedDatabase, alias);
  }
}

class Tag extends DataClass implements Insertable<Tag> {
  final String id;
  final String ownerId;
  final String name;
  final String? color;
  final String version;
  final DateTime? deletedAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  const Tag(
      {required this.id,
      required this.ownerId,
      required this.name,
      this.color,
      required this.version,
      this.deletedAt,
      required this.createdAt,
      required this.updatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_id'] = Variable<String>(ownerId);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || color != null) {
      map['color'] = Variable<String>(color);
    }
    map['version'] = Variable<String>(version);
    if (!nullToAbsent || deletedAt != null) {
      map['deleted_at'] = Variable<DateTime>(deletedAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  TagsCompanion toCompanion(bool nullToAbsent) {
    return TagsCompanion(
      id: Value(id),
      ownerId: Value(ownerId),
      name: Value(name),
      color:
          color == null && nullToAbsent ? const Value.absent() : Value(color),
      version: Value(version),
      deletedAt: deletedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(deletedAt),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory Tag.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Tag(
      id: serializer.fromJson<String>(json['id']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      name: serializer.fromJson<String>(json['name']),
      color: serializer.fromJson<String?>(json['color']),
      version: serializer.fromJson<String>(json['version']),
      deletedAt: serializer.fromJson<DateTime?>(json['deletedAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerId': serializer.toJson<String>(ownerId),
      'name': serializer.toJson<String>(name),
      'color': serializer.toJson<String?>(color),
      'version': serializer.toJson<String>(version),
      'deletedAt': serializer.toJson<DateTime?>(deletedAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  Tag copyWith(
          {String? id,
          String? ownerId,
          String? name,
          Value<String?> color = const Value.absent(),
          String? version,
          Value<DateTime?> deletedAt = const Value.absent(),
          DateTime? createdAt,
          DateTime? updatedAt}) =>
      Tag(
        id: id ?? this.id,
        ownerId: ownerId ?? this.ownerId,
        name: name ?? this.name,
        color: color.present ? color.value : this.color,
        version: version ?? this.version,
        deletedAt: deletedAt.present ? deletedAt.value : this.deletedAt,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );
  Tag copyWithCompanion(TagsCompanion data) {
    return Tag(
      id: data.id.present ? data.id.value : this.id,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      name: data.name.present ? data.name.value : this.name,
      color: data.color.present ? data.color.value : this.color,
      version: data.version.present ? data.version.value : this.version,
      deletedAt: data.deletedAt.present ? data.deletedAt.value : this.deletedAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Tag(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('name: $name, ')
          ..write('color: $color, ')
          ..write('version: $version, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id, ownerId, name, color, version, deletedAt, createdAt, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Tag &&
          other.id == this.id &&
          other.ownerId == this.ownerId &&
          other.name == this.name &&
          other.color == this.color &&
          other.version == this.version &&
          other.deletedAt == this.deletedAt &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class TagsCompanion extends UpdateCompanion<Tag> {
  final Value<String> id;
  final Value<String> ownerId;
  final Value<String> name;
  final Value<String?> color;
  final Value<String> version;
  final Value<DateTime?> deletedAt;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const TagsCompanion({
    this.id = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.name = const Value.absent(),
    this.color = const Value.absent(),
    this.version = const Value.absent(),
    this.deletedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  TagsCompanion.insert({
    required String id,
    required String ownerId,
    required String name,
    this.color = const Value.absent(),
    required String version,
    this.deletedAt = const Value.absent(),
    required DateTime createdAt,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerId = Value(ownerId),
        name = Value(name),
        version = Value(version),
        createdAt = Value(createdAt),
        updatedAt = Value(updatedAt);
  static Insertable<Tag> custom({
    Expression<String>? id,
    Expression<String>? ownerId,
    Expression<String>? name,
    Expression<String>? color,
    Expression<String>? version,
    Expression<DateTime>? deletedAt,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerId != null) 'owner_id': ownerId,
      if (name != null) 'name': name,
      if (color != null) 'color': color,
      if (version != null) 'version': version,
      if (deletedAt != null) 'deleted_at': deletedAt,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  TagsCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerId,
      Value<String>? name,
      Value<String?>? color,
      Value<String>? version,
      Value<DateTime?>? deletedAt,
      Value<DateTime>? createdAt,
      Value<DateTime>? updatedAt,
      Value<int>? rowid}) {
    return TagsCompanion(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      name: name ?? this.name,
      color: color ?? this.color,
      version: version ?? this.version,
      deletedAt: deletedAt ?? this.deletedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (color.present) {
      map['color'] = Variable<String>(color.value);
    }
    if (version.present) {
      map['version'] = Variable<String>(version.value);
    }
    if (deletedAt.present) {
      map['deleted_at'] = Variable<DateTime>(deletedAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('TagsCompanion(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('name: $name, ')
          ..write('color: $color, ')
          ..write('version: $version, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CheckInTagsTable extends CheckInTags
    with TableInfo<$CheckInTagsTable, CheckInTag> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CheckInTagsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _checkInIdMeta =
      const VerificationMeta('checkInId');
  @override
  late final GeneratedColumn<String> checkInId = GeneratedColumn<String>(
      'check_in_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _tagIdMeta = const VerificationMeta('tagId');
  @override
  late final GeneratedColumn<String> tagId = GeneratedColumn<String>(
      'tag_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [checkInId, tagId];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'check_in_tags';
  @override
  VerificationContext validateIntegrity(Insertable<CheckInTag> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('check_in_id')) {
      context.handle(
          _checkInIdMeta,
          checkInId.isAcceptableOrUnknown(
              data['check_in_id']!, _checkInIdMeta));
    } else if (isInserting) {
      context.missing(_checkInIdMeta);
    }
    if (data.containsKey('tag_id')) {
      context.handle(
          _tagIdMeta, tagId.isAcceptableOrUnknown(data['tag_id']!, _tagIdMeta));
    } else if (isInserting) {
      context.missing(_tagIdMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {checkInId, tagId};
  @override
  CheckInTag map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CheckInTag(
      checkInId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}check_in_id'])!,
      tagId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}tag_id'])!,
    );
  }

  @override
  $CheckInTagsTable createAlias(String alias) {
    return $CheckInTagsTable(attachedDatabase, alias);
  }
}

class CheckInTag extends DataClass implements Insertable<CheckInTag> {
  final String checkInId;
  final String tagId;
  const CheckInTag({required this.checkInId, required this.tagId});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['check_in_id'] = Variable<String>(checkInId);
    map['tag_id'] = Variable<String>(tagId);
    return map;
  }

  CheckInTagsCompanion toCompanion(bool nullToAbsent) {
    return CheckInTagsCompanion(
      checkInId: Value(checkInId),
      tagId: Value(tagId),
    );
  }

  factory CheckInTag.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CheckInTag(
      checkInId: serializer.fromJson<String>(json['checkInId']),
      tagId: serializer.fromJson<String>(json['tagId']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'checkInId': serializer.toJson<String>(checkInId),
      'tagId': serializer.toJson<String>(tagId),
    };
  }

  CheckInTag copyWith({String? checkInId, String? tagId}) => CheckInTag(
        checkInId: checkInId ?? this.checkInId,
        tagId: tagId ?? this.tagId,
      );
  CheckInTag copyWithCompanion(CheckInTagsCompanion data) {
    return CheckInTag(
      checkInId: data.checkInId.present ? data.checkInId.value : this.checkInId,
      tagId: data.tagId.present ? data.tagId.value : this.tagId,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CheckInTag(')
          ..write('checkInId: $checkInId, ')
          ..write('tagId: $tagId')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(checkInId, tagId);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CheckInTag &&
          other.checkInId == this.checkInId &&
          other.tagId == this.tagId);
}

class CheckInTagsCompanion extends UpdateCompanion<CheckInTag> {
  final Value<String> checkInId;
  final Value<String> tagId;
  final Value<int> rowid;
  const CheckInTagsCompanion({
    this.checkInId = const Value.absent(),
    this.tagId = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CheckInTagsCompanion.insert({
    required String checkInId,
    required String tagId,
    this.rowid = const Value.absent(),
  })  : checkInId = Value(checkInId),
        tagId = Value(tagId);
  static Insertable<CheckInTag> custom({
    Expression<String>? checkInId,
    Expression<String>? tagId,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (checkInId != null) 'check_in_id': checkInId,
      if (tagId != null) 'tag_id': tagId,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CheckInTagsCompanion copyWith(
      {Value<String>? checkInId, Value<String>? tagId, Value<int>? rowid}) {
    return CheckInTagsCompanion(
      checkInId: checkInId ?? this.checkInId,
      tagId: tagId ?? this.tagId,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (checkInId.present) {
      map['check_in_id'] = Variable<String>(checkInId.value);
    }
    if (tagId.present) {
      map['tag_id'] = Variable<String>(tagId.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CheckInTagsCompanion(')
          ..write('checkInId: $checkInId, ')
          ..write('tagId: $tagId, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SyncOperationsTable extends SyncOperations
    with TableInfo<$SyncOperationsTable, SyncOperation> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncOperationsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _operationIdMeta =
      const VerificationMeta('operationId');
  @override
  late final GeneratedColumn<String> operationId = GeneratedColumn<String>(
      'operation_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _deviceIdMeta =
      const VerificationMeta('deviceId');
  @override
  late final GeneratedColumn<String> deviceId = GeneratedColumn<String>(
      'device_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _deviceSequenceMeta =
      const VerificationMeta('deviceSequence');
  @override
  late final GeneratedColumn<int> deviceSequence = GeneratedColumn<int>(
      'device_sequence', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _entityTypeMeta =
      const VerificationMeta('entityType');
  @override
  late final GeneratedColumn<String> entityType = GeneratedColumn<String>(
      'entity_type', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _entityIdMeta =
      const VerificationMeta('entityId');
  @override
  late final GeneratedColumn<String> entityId = GeneratedColumn<String>(
      'entity_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _kindMeta = const VerificationMeta('kind');
  @override
  late final GeneratedColumn<String> kind = GeneratedColumn<String>(
      'kind', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _baseVersionMeta =
      const VerificationMeta('baseVersion');
  @override
  late final GeneratedColumn<String> baseVersion = GeneratedColumn<String>(
      'base_version', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _payloadJsonMeta =
      const VerificationMeta('payloadJson');
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
      'payload_json', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _occurredAtMeta =
      const VerificationMeta('occurredAt');
  @override
  late final GeneratedColumn<DateTime> occurredAt = GeneratedColumn<DateTime>(
      'occurred_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _receivedAtMeta =
      const VerificationMeta('receivedAt');
  @override
  late final GeneratedColumn<DateTime> receivedAt = GeneratedColumn<DateTime>(
      'received_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _resultJsonMeta =
      const VerificationMeta('resultJson');
  @override
  late final GeneratedColumn<String> resultJson = GeneratedColumn<String>(
      'result_json', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _sequenceMeta =
      const VerificationMeta('sequence');
  @override
  late final GeneratedColumn<int> sequence = GeneratedColumn<int>(
      'sequence', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  @override
  List<GeneratedColumn> get $columns => [
        operationId,
        ownerId,
        deviceId,
        deviceSequence,
        entityType,
        entityId,
        kind,
        baseVersion,
        payloadJson,
        occurredAt,
        receivedAt,
        status,
        resultJson,
        sequence
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_operations';
  @override
  VerificationContext validateIntegrity(Insertable<SyncOperation> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('operation_id')) {
      context.handle(
          _operationIdMeta,
          operationId.isAcceptableOrUnknown(
              data['operation_id']!, _operationIdMeta));
    } else if (isInserting) {
      context.missing(_operationIdMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('device_id')) {
      context.handle(_deviceIdMeta,
          deviceId.isAcceptableOrUnknown(data['device_id']!, _deviceIdMeta));
    } else if (isInserting) {
      context.missing(_deviceIdMeta);
    }
    if (data.containsKey('device_sequence')) {
      context.handle(
          _deviceSequenceMeta,
          deviceSequence.isAcceptableOrUnknown(
              data['device_sequence']!, _deviceSequenceMeta));
    } else if (isInserting) {
      context.missing(_deviceSequenceMeta);
    }
    if (data.containsKey('entity_type')) {
      context.handle(
          _entityTypeMeta,
          entityType.isAcceptableOrUnknown(
              data['entity_type']!, _entityTypeMeta));
    } else if (isInserting) {
      context.missing(_entityTypeMeta);
    }
    if (data.containsKey('entity_id')) {
      context.handle(_entityIdMeta,
          entityId.isAcceptableOrUnknown(data['entity_id']!, _entityIdMeta));
    } else if (isInserting) {
      context.missing(_entityIdMeta);
    }
    if (data.containsKey('kind')) {
      context.handle(
          _kindMeta, kind.isAcceptableOrUnknown(data['kind']!, _kindMeta));
    } else if (isInserting) {
      context.missing(_kindMeta);
    }
    if (data.containsKey('base_version')) {
      context.handle(
          _baseVersionMeta,
          baseVersion.isAcceptableOrUnknown(
              data['base_version']!, _baseVersionMeta));
    }
    if (data.containsKey('payload_json')) {
      context.handle(
          _payloadJsonMeta,
          payloadJson.isAcceptableOrUnknown(
              data['payload_json']!, _payloadJsonMeta));
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('occurred_at')) {
      context.handle(
          _occurredAtMeta,
          occurredAt.isAcceptableOrUnknown(
              data['occurred_at']!, _occurredAtMeta));
    } else if (isInserting) {
      context.missing(_occurredAtMeta);
    }
    if (data.containsKey('received_at')) {
      context.handle(
          _receivedAtMeta,
          receivedAt.isAcceptableOrUnknown(
              data['received_at']!, _receivedAtMeta));
    } else if (isInserting) {
      context.missing(_receivedAtMeta);
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('result_json')) {
      context.handle(
          _resultJsonMeta,
          resultJson.isAcceptableOrUnknown(
              data['result_json']!, _resultJsonMeta));
    }
    if (data.containsKey('sequence')) {
      context.handle(_sequenceMeta,
          sequence.isAcceptableOrUnknown(data['sequence']!, _sequenceMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {operationId};
  @override
  SyncOperation map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncOperation(
      operationId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}operation_id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      deviceId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}device_id'])!,
      deviceSequence: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}device_sequence'])!,
      entityType: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}entity_type'])!,
      entityId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}entity_id'])!,
      kind: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}kind'])!,
      baseVersion: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}base_version']),
      payloadJson: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload_json'])!,
      occurredAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}occurred_at'])!,
      receivedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}received_at'])!,
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      resultJson: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}result_json']),
      sequence: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}sequence']),
    );
  }

  @override
  $SyncOperationsTable createAlias(String alias) {
    return $SyncOperationsTable(attachedDatabase, alias);
  }
}

class SyncOperation extends DataClass implements Insertable<SyncOperation> {
  final String operationId;
  final String ownerId;
  final String deviceId;
  final int deviceSequence;
  final String entityType;
  final String entityId;
  final String kind;
  final String? baseVersion;
  final String payloadJson;
  final DateTime occurredAt;
  final DateTime receivedAt;
  final String status;
  final String? resultJson;
  final int? sequence;
  const SyncOperation(
      {required this.operationId,
      required this.ownerId,
      required this.deviceId,
      required this.deviceSequence,
      required this.entityType,
      required this.entityId,
      required this.kind,
      this.baseVersion,
      required this.payloadJson,
      required this.occurredAt,
      required this.receivedAt,
      required this.status,
      this.resultJson,
      this.sequence});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['operation_id'] = Variable<String>(operationId);
    map['owner_id'] = Variable<String>(ownerId);
    map['device_id'] = Variable<String>(deviceId);
    map['device_sequence'] = Variable<int>(deviceSequence);
    map['entity_type'] = Variable<String>(entityType);
    map['entity_id'] = Variable<String>(entityId);
    map['kind'] = Variable<String>(kind);
    if (!nullToAbsent || baseVersion != null) {
      map['base_version'] = Variable<String>(baseVersion);
    }
    map['payload_json'] = Variable<String>(payloadJson);
    map['occurred_at'] = Variable<DateTime>(occurredAt);
    map['received_at'] = Variable<DateTime>(receivedAt);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || resultJson != null) {
      map['result_json'] = Variable<String>(resultJson);
    }
    if (!nullToAbsent || sequence != null) {
      map['sequence'] = Variable<int>(sequence);
    }
    return map;
  }

  SyncOperationsCompanion toCompanion(bool nullToAbsent) {
    return SyncOperationsCompanion(
      operationId: Value(operationId),
      ownerId: Value(ownerId),
      deviceId: Value(deviceId),
      deviceSequence: Value(deviceSequence),
      entityType: Value(entityType),
      entityId: Value(entityId),
      kind: Value(kind),
      baseVersion: baseVersion == null && nullToAbsent
          ? const Value.absent()
          : Value(baseVersion),
      payloadJson: Value(payloadJson),
      occurredAt: Value(occurredAt),
      receivedAt: Value(receivedAt),
      status: Value(status),
      resultJson: resultJson == null && nullToAbsent
          ? const Value.absent()
          : Value(resultJson),
      sequence: sequence == null && nullToAbsent
          ? const Value.absent()
          : Value(sequence),
    );
  }

  factory SyncOperation.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncOperation(
      operationId: serializer.fromJson<String>(json['operationId']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      deviceId: serializer.fromJson<String>(json['deviceId']),
      deviceSequence: serializer.fromJson<int>(json['deviceSequence']),
      entityType: serializer.fromJson<String>(json['entityType']),
      entityId: serializer.fromJson<String>(json['entityId']),
      kind: serializer.fromJson<String>(json['kind']),
      baseVersion: serializer.fromJson<String?>(json['baseVersion']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      occurredAt: serializer.fromJson<DateTime>(json['occurredAt']),
      receivedAt: serializer.fromJson<DateTime>(json['receivedAt']),
      status: serializer.fromJson<String>(json['status']),
      resultJson: serializer.fromJson<String?>(json['resultJson']),
      sequence: serializer.fromJson<int?>(json['sequence']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'operationId': serializer.toJson<String>(operationId),
      'ownerId': serializer.toJson<String>(ownerId),
      'deviceId': serializer.toJson<String>(deviceId),
      'deviceSequence': serializer.toJson<int>(deviceSequence),
      'entityType': serializer.toJson<String>(entityType),
      'entityId': serializer.toJson<String>(entityId),
      'kind': serializer.toJson<String>(kind),
      'baseVersion': serializer.toJson<String?>(baseVersion),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'occurredAt': serializer.toJson<DateTime>(occurredAt),
      'receivedAt': serializer.toJson<DateTime>(receivedAt),
      'status': serializer.toJson<String>(status),
      'resultJson': serializer.toJson<String?>(resultJson),
      'sequence': serializer.toJson<int?>(sequence),
    };
  }

  SyncOperation copyWith(
          {String? operationId,
          String? ownerId,
          String? deviceId,
          int? deviceSequence,
          String? entityType,
          String? entityId,
          String? kind,
          Value<String?> baseVersion = const Value.absent(),
          String? payloadJson,
          DateTime? occurredAt,
          DateTime? receivedAt,
          String? status,
          Value<String?> resultJson = const Value.absent(),
          Value<int?> sequence = const Value.absent()}) =>
      SyncOperation(
        operationId: operationId ?? this.operationId,
        ownerId: ownerId ?? this.ownerId,
        deviceId: deviceId ?? this.deviceId,
        deviceSequence: deviceSequence ?? this.deviceSequence,
        entityType: entityType ?? this.entityType,
        entityId: entityId ?? this.entityId,
        kind: kind ?? this.kind,
        baseVersion: baseVersion.present ? baseVersion.value : this.baseVersion,
        payloadJson: payloadJson ?? this.payloadJson,
        occurredAt: occurredAt ?? this.occurredAt,
        receivedAt: receivedAt ?? this.receivedAt,
        status: status ?? this.status,
        resultJson: resultJson.present ? resultJson.value : this.resultJson,
        sequence: sequence.present ? sequence.value : this.sequence,
      );
  SyncOperation copyWithCompanion(SyncOperationsCompanion data) {
    return SyncOperation(
      operationId:
          data.operationId.present ? data.operationId.value : this.operationId,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      deviceId: data.deviceId.present ? data.deviceId.value : this.deviceId,
      deviceSequence: data.deviceSequence.present
          ? data.deviceSequence.value
          : this.deviceSequence,
      entityType:
          data.entityType.present ? data.entityType.value : this.entityType,
      entityId: data.entityId.present ? data.entityId.value : this.entityId,
      kind: data.kind.present ? data.kind.value : this.kind,
      baseVersion:
          data.baseVersion.present ? data.baseVersion.value : this.baseVersion,
      payloadJson:
          data.payloadJson.present ? data.payloadJson.value : this.payloadJson,
      occurredAt:
          data.occurredAt.present ? data.occurredAt.value : this.occurredAt,
      receivedAt:
          data.receivedAt.present ? data.receivedAt.value : this.receivedAt,
      status: data.status.present ? data.status.value : this.status,
      resultJson:
          data.resultJson.present ? data.resultJson.value : this.resultJson,
      sequence: data.sequence.present ? data.sequence.value : this.sequence,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncOperation(')
          ..write('operationId: $operationId, ')
          ..write('ownerId: $ownerId, ')
          ..write('deviceId: $deviceId, ')
          ..write('deviceSequence: $deviceSequence, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('kind: $kind, ')
          ..write('baseVersion: $baseVersion, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('occurredAt: $occurredAt, ')
          ..write('receivedAt: $receivedAt, ')
          ..write('status: $status, ')
          ..write('resultJson: $resultJson, ')
          ..write('sequence: $sequence')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      operationId,
      ownerId,
      deviceId,
      deviceSequence,
      entityType,
      entityId,
      kind,
      baseVersion,
      payloadJson,
      occurredAt,
      receivedAt,
      status,
      resultJson,
      sequence);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncOperation &&
          other.operationId == this.operationId &&
          other.ownerId == this.ownerId &&
          other.deviceId == this.deviceId &&
          other.deviceSequence == this.deviceSequence &&
          other.entityType == this.entityType &&
          other.entityId == this.entityId &&
          other.kind == this.kind &&
          other.baseVersion == this.baseVersion &&
          other.payloadJson == this.payloadJson &&
          other.occurredAt == this.occurredAt &&
          other.receivedAt == this.receivedAt &&
          other.status == this.status &&
          other.resultJson == this.resultJson &&
          other.sequence == this.sequence);
}

class SyncOperationsCompanion extends UpdateCompanion<SyncOperation> {
  final Value<String> operationId;
  final Value<String> ownerId;
  final Value<String> deviceId;
  final Value<int> deviceSequence;
  final Value<String> entityType;
  final Value<String> entityId;
  final Value<String> kind;
  final Value<String?> baseVersion;
  final Value<String> payloadJson;
  final Value<DateTime> occurredAt;
  final Value<DateTime> receivedAt;
  final Value<String> status;
  final Value<String?> resultJson;
  final Value<int?> sequence;
  final Value<int> rowid;
  const SyncOperationsCompanion({
    this.operationId = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.deviceId = const Value.absent(),
    this.deviceSequence = const Value.absent(),
    this.entityType = const Value.absent(),
    this.entityId = const Value.absent(),
    this.kind = const Value.absent(),
    this.baseVersion = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.occurredAt = const Value.absent(),
    this.receivedAt = const Value.absent(),
    this.status = const Value.absent(),
    this.resultJson = const Value.absent(),
    this.sequence = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SyncOperationsCompanion.insert({
    required String operationId,
    required String ownerId,
    required String deviceId,
    required int deviceSequence,
    required String entityType,
    required String entityId,
    required String kind,
    this.baseVersion = const Value.absent(),
    required String payloadJson,
    required DateTime occurredAt,
    required DateTime receivedAt,
    required String status,
    this.resultJson = const Value.absent(),
    this.sequence = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : operationId = Value(operationId),
        ownerId = Value(ownerId),
        deviceId = Value(deviceId),
        deviceSequence = Value(deviceSequence),
        entityType = Value(entityType),
        entityId = Value(entityId),
        kind = Value(kind),
        payloadJson = Value(payloadJson),
        occurredAt = Value(occurredAt),
        receivedAt = Value(receivedAt),
        status = Value(status);
  static Insertable<SyncOperation> custom({
    Expression<String>? operationId,
    Expression<String>? ownerId,
    Expression<String>? deviceId,
    Expression<int>? deviceSequence,
    Expression<String>? entityType,
    Expression<String>? entityId,
    Expression<String>? kind,
    Expression<String>? baseVersion,
    Expression<String>? payloadJson,
    Expression<DateTime>? occurredAt,
    Expression<DateTime>? receivedAt,
    Expression<String>? status,
    Expression<String>? resultJson,
    Expression<int>? sequence,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (operationId != null) 'operation_id': operationId,
      if (ownerId != null) 'owner_id': ownerId,
      if (deviceId != null) 'device_id': deviceId,
      if (deviceSequence != null) 'device_sequence': deviceSequence,
      if (entityType != null) 'entity_type': entityType,
      if (entityId != null) 'entity_id': entityId,
      if (kind != null) 'kind': kind,
      if (baseVersion != null) 'base_version': baseVersion,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (occurredAt != null) 'occurred_at': occurredAt,
      if (receivedAt != null) 'received_at': receivedAt,
      if (status != null) 'status': status,
      if (resultJson != null) 'result_json': resultJson,
      if (sequence != null) 'sequence': sequence,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SyncOperationsCompanion copyWith(
      {Value<String>? operationId,
      Value<String>? ownerId,
      Value<String>? deviceId,
      Value<int>? deviceSequence,
      Value<String>? entityType,
      Value<String>? entityId,
      Value<String>? kind,
      Value<String?>? baseVersion,
      Value<String>? payloadJson,
      Value<DateTime>? occurredAt,
      Value<DateTime>? receivedAt,
      Value<String>? status,
      Value<String?>? resultJson,
      Value<int?>? sequence,
      Value<int>? rowid}) {
    return SyncOperationsCompanion(
      operationId: operationId ?? this.operationId,
      ownerId: ownerId ?? this.ownerId,
      deviceId: deviceId ?? this.deviceId,
      deviceSequence: deviceSequence ?? this.deviceSequence,
      entityType: entityType ?? this.entityType,
      entityId: entityId ?? this.entityId,
      kind: kind ?? this.kind,
      baseVersion: baseVersion ?? this.baseVersion,
      payloadJson: payloadJson ?? this.payloadJson,
      occurredAt: occurredAt ?? this.occurredAt,
      receivedAt: receivedAt ?? this.receivedAt,
      status: status ?? this.status,
      resultJson: resultJson ?? this.resultJson,
      sequence: sequence ?? this.sequence,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (operationId.present) {
      map['operation_id'] = Variable<String>(operationId.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (deviceId.present) {
      map['device_id'] = Variable<String>(deviceId.value);
    }
    if (deviceSequence.present) {
      map['device_sequence'] = Variable<int>(deviceSequence.value);
    }
    if (entityType.present) {
      map['entity_type'] = Variable<String>(entityType.value);
    }
    if (entityId.present) {
      map['entity_id'] = Variable<String>(entityId.value);
    }
    if (kind.present) {
      map['kind'] = Variable<String>(kind.value);
    }
    if (baseVersion.present) {
      map['base_version'] = Variable<String>(baseVersion.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (occurredAt.present) {
      map['occurred_at'] = Variable<DateTime>(occurredAt.value);
    }
    if (receivedAt.present) {
      map['received_at'] = Variable<DateTime>(receivedAt.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (resultJson.present) {
      map['result_json'] = Variable<String>(resultJson.value);
    }
    if (sequence.present) {
      map['sequence'] = Variable<int>(sequence.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncOperationsCompanion(')
          ..write('operationId: $operationId, ')
          ..write('ownerId: $ownerId, ')
          ..write('deviceId: $deviceId, ')
          ..write('deviceSequence: $deviceSequence, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('kind: $kind, ')
          ..write('baseVersion: $baseVersion, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('occurredAt: $occurredAt, ')
          ..write('receivedAt: $receivedAt, ')
          ..write('status: $status, ')
          ..write('resultJson: $resultJson, ')
          ..write('sequence: $sequence, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SyncCursorsTable extends SyncCursors
    with TableInfo<$SyncCursorsTable, SyncCursor> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncCursorsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _deviceIdMeta =
      const VerificationMeta('deviceId');
  @override
  late final GeneratedColumn<String> deviceId = GeneratedColumn<String>(
      'device_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _lastAppliedSequenceMeta =
      const VerificationMeta('lastAppliedSequence');
  @override
  late final GeneratedColumn<int> lastAppliedSequence = GeneratedColumn<int>(
      'last_applied_sequence', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [ownerId, deviceId, lastAppliedSequence, updatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_cursors';
  @override
  VerificationContext validateIntegrity(Insertable<SyncCursor> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('device_id')) {
      context.handle(_deviceIdMeta,
          deviceId.isAcceptableOrUnknown(data['device_id']!, _deviceIdMeta));
    } else if (isInserting) {
      context.missing(_deviceIdMeta);
    }
    if (data.containsKey('last_applied_sequence')) {
      context.handle(
          _lastAppliedSequenceMeta,
          lastAppliedSequence.isAcceptableOrUnknown(
              data['last_applied_sequence']!, _lastAppliedSequenceMeta));
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {ownerId, deviceId};
  @override
  SyncCursor map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncCursor(
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      deviceId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}device_id'])!,
      lastAppliedSequence: attachedDatabase.typeMapping.read(
          DriftSqlType.int, data['${effectivePrefix}last_applied_sequence'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
    );
  }

  @override
  $SyncCursorsTable createAlias(String alias) {
    return $SyncCursorsTable(attachedDatabase, alias);
  }
}

class SyncCursor extends DataClass implements Insertable<SyncCursor> {
  final String ownerId;
  final String deviceId;
  final int lastAppliedSequence;
  final DateTime updatedAt;
  const SyncCursor(
      {required this.ownerId,
      required this.deviceId,
      required this.lastAppliedSequence,
      required this.updatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['owner_id'] = Variable<String>(ownerId);
    map['device_id'] = Variable<String>(deviceId);
    map['last_applied_sequence'] = Variable<int>(lastAppliedSequence);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  SyncCursorsCompanion toCompanion(bool nullToAbsent) {
    return SyncCursorsCompanion(
      ownerId: Value(ownerId),
      deviceId: Value(deviceId),
      lastAppliedSequence: Value(lastAppliedSequence),
      updatedAt: Value(updatedAt),
    );
  }

  factory SyncCursor.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncCursor(
      ownerId: serializer.fromJson<String>(json['ownerId']),
      deviceId: serializer.fromJson<String>(json['deviceId']),
      lastAppliedSequence:
          serializer.fromJson<int>(json['lastAppliedSequence']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'ownerId': serializer.toJson<String>(ownerId),
      'deviceId': serializer.toJson<String>(deviceId),
      'lastAppliedSequence': serializer.toJson<int>(lastAppliedSequence),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  SyncCursor copyWith(
          {String? ownerId,
          String? deviceId,
          int? lastAppliedSequence,
          DateTime? updatedAt}) =>
      SyncCursor(
        ownerId: ownerId ?? this.ownerId,
        deviceId: deviceId ?? this.deviceId,
        lastAppliedSequence: lastAppliedSequence ?? this.lastAppliedSequence,
        updatedAt: updatedAt ?? this.updatedAt,
      );
  SyncCursor copyWithCompanion(SyncCursorsCompanion data) {
    return SyncCursor(
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      deviceId: data.deviceId.present ? data.deviceId.value : this.deviceId,
      lastAppliedSequence: data.lastAppliedSequence.present
          ? data.lastAppliedSequence.value
          : this.lastAppliedSequence,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncCursor(')
          ..write('ownerId: $ownerId, ')
          ..write('deviceId: $deviceId, ')
          ..write('lastAppliedSequence: $lastAppliedSequence, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(ownerId, deviceId, lastAppliedSequence, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncCursor &&
          other.ownerId == this.ownerId &&
          other.deviceId == this.deviceId &&
          other.lastAppliedSequence == this.lastAppliedSequence &&
          other.updatedAt == this.updatedAt);
}

class SyncCursorsCompanion extends UpdateCompanion<SyncCursor> {
  final Value<String> ownerId;
  final Value<String> deviceId;
  final Value<int> lastAppliedSequence;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const SyncCursorsCompanion({
    this.ownerId = const Value.absent(),
    this.deviceId = const Value.absent(),
    this.lastAppliedSequence = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SyncCursorsCompanion.insert({
    required String ownerId,
    required String deviceId,
    this.lastAppliedSequence = const Value.absent(),
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  })  : ownerId = Value(ownerId),
        deviceId = Value(deviceId),
        updatedAt = Value(updatedAt);
  static Insertable<SyncCursor> custom({
    Expression<String>? ownerId,
    Expression<String>? deviceId,
    Expression<int>? lastAppliedSequence,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (ownerId != null) 'owner_id': ownerId,
      if (deviceId != null) 'device_id': deviceId,
      if (lastAppliedSequence != null)
        'last_applied_sequence': lastAppliedSequence,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SyncCursorsCompanion copyWith(
      {Value<String>? ownerId,
      Value<String>? deviceId,
      Value<int>? lastAppliedSequence,
      Value<DateTime>? updatedAt,
      Value<int>? rowid}) {
    return SyncCursorsCompanion(
      ownerId: ownerId ?? this.ownerId,
      deviceId: deviceId ?? this.deviceId,
      lastAppliedSequence: lastAppliedSequence ?? this.lastAppliedSequence,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (deviceId.present) {
      map['device_id'] = Variable<String>(deviceId.value);
    }
    if (lastAppliedSequence.present) {
      map['last_applied_sequence'] = Variable<int>(lastAppliedSequence.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncCursorsCompanion(')
          ..write('ownerId: $ownerId, ')
          ..write('deviceId: $deviceId, ')
          ..write('lastAppliedSequence: $lastAppliedSequence, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $OutboxOperationsTable extends OutboxOperations
    with TableInfo<$OutboxOperationsTable, OutboxOperation> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OutboxOperationsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _operationIdMeta =
      const VerificationMeta('operationId');
  @override
  late final GeneratedColumn<String> operationId = GeneratedColumn<String>(
      'operation_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _deviceIdMeta =
      const VerificationMeta('deviceId');
  @override
  late final GeneratedColumn<String> deviceId = GeneratedColumn<String>(
      'device_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _deviceSequenceMeta =
      const VerificationMeta('deviceSequence');
  @override
  late final GeneratedColumn<int> deviceSequence = GeneratedColumn<int>(
      'device_sequence', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _entityTypeMeta =
      const VerificationMeta('entityType');
  @override
  late final GeneratedColumn<String> entityType = GeneratedColumn<String>(
      'entity_type', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _entityIdMeta =
      const VerificationMeta('entityId');
  @override
  late final GeneratedColumn<String> entityId = GeneratedColumn<String>(
      'entity_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _kindMeta = const VerificationMeta('kind');
  @override
  late final GeneratedColumn<String> kind = GeneratedColumn<String>(
      'kind', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _baseVersionMeta =
      const VerificationMeta('baseVersion');
  @override
  late final GeneratedColumn<String> baseVersion = GeneratedColumn<String>(
      'base_version', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _payloadJsonMeta =
      const VerificationMeta('payloadJson');
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
      'payload_json', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _occurredAtMeta =
      const VerificationMeta('occurredAt');
  @override
  late final GeneratedColumn<DateTime> occurredAt = GeneratedColumn<DateTime>(
      'occurred_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _attemptsMeta =
      const VerificationMeta('attempts');
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
      'attempts', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _nextAttemptAtMeta =
      const VerificationMeta('nextAttemptAt');
  @override
  late final GeneratedColumn<DateTime> nextAttemptAt =
      GeneratedColumn<DateTime>('next_attempt_at', aliasedName, false,
          type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _acknowledgedAtMeta =
      const VerificationMeta('acknowledgedAt');
  @override
  late final GeneratedColumn<DateTime> acknowledgedAt =
      GeneratedColumn<DateTime>('acknowledged_at', aliasedName, true,
          type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [
        operationId,
        ownerId,
        deviceId,
        deviceSequence,
        entityType,
        entityId,
        kind,
        baseVersion,
        payloadJson,
        occurredAt,
        attempts,
        nextAttemptAt,
        acknowledgedAt,
        createdAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'outbox_operations';
  @override
  VerificationContext validateIntegrity(Insertable<OutboxOperation> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('operation_id')) {
      context.handle(
          _operationIdMeta,
          operationId.isAcceptableOrUnknown(
              data['operation_id']!, _operationIdMeta));
    } else if (isInserting) {
      context.missing(_operationIdMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('device_id')) {
      context.handle(_deviceIdMeta,
          deviceId.isAcceptableOrUnknown(data['device_id']!, _deviceIdMeta));
    } else if (isInserting) {
      context.missing(_deviceIdMeta);
    }
    if (data.containsKey('device_sequence')) {
      context.handle(
          _deviceSequenceMeta,
          deviceSequence.isAcceptableOrUnknown(
              data['device_sequence']!, _deviceSequenceMeta));
    } else if (isInserting) {
      context.missing(_deviceSequenceMeta);
    }
    if (data.containsKey('entity_type')) {
      context.handle(
          _entityTypeMeta,
          entityType.isAcceptableOrUnknown(
              data['entity_type']!, _entityTypeMeta));
    } else if (isInserting) {
      context.missing(_entityTypeMeta);
    }
    if (data.containsKey('entity_id')) {
      context.handle(_entityIdMeta,
          entityId.isAcceptableOrUnknown(data['entity_id']!, _entityIdMeta));
    } else if (isInserting) {
      context.missing(_entityIdMeta);
    }
    if (data.containsKey('kind')) {
      context.handle(
          _kindMeta, kind.isAcceptableOrUnknown(data['kind']!, _kindMeta));
    } else if (isInserting) {
      context.missing(_kindMeta);
    }
    if (data.containsKey('base_version')) {
      context.handle(
          _baseVersionMeta,
          baseVersion.isAcceptableOrUnknown(
              data['base_version']!, _baseVersionMeta));
    }
    if (data.containsKey('payload_json')) {
      context.handle(
          _payloadJsonMeta,
          payloadJson.isAcceptableOrUnknown(
              data['payload_json']!, _payloadJsonMeta));
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('occurred_at')) {
      context.handle(
          _occurredAtMeta,
          occurredAt.isAcceptableOrUnknown(
              data['occurred_at']!, _occurredAtMeta));
    } else if (isInserting) {
      context.missing(_occurredAtMeta);
    }
    if (data.containsKey('attempts')) {
      context.handle(_attemptsMeta,
          attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta));
    }
    if (data.containsKey('next_attempt_at')) {
      context.handle(
          _nextAttemptAtMeta,
          nextAttemptAt.isAcceptableOrUnknown(
              data['next_attempt_at']!, _nextAttemptAtMeta));
    } else if (isInserting) {
      context.missing(_nextAttemptAtMeta);
    }
    if (data.containsKey('acknowledged_at')) {
      context.handle(
          _acknowledgedAtMeta,
          acknowledgedAt.isAcceptableOrUnknown(
              data['acknowledged_at']!, _acknowledgedAtMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {operationId};
  @override
  OutboxOperation map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OutboxOperation(
      operationId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}operation_id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      deviceId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}device_id'])!,
      deviceSequence: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}device_sequence'])!,
      entityType: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}entity_type'])!,
      entityId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}entity_id'])!,
      kind: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}kind'])!,
      baseVersion: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}base_version']),
      payloadJson: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload_json'])!,
      occurredAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}occurred_at'])!,
      attempts: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}attempts'])!,
      nextAttemptAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime, data['${effectivePrefix}next_attempt_at'])!,
      acknowledgedAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime, data['${effectivePrefix}acknowledged_at']),
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
    );
  }

  @override
  $OutboxOperationsTable createAlias(String alias) {
    return $OutboxOperationsTable(attachedDatabase, alias);
  }
}

class OutboxOperation extends DataClass implements Insertable<OutboxOperation> {
  final String operationId;
  final String ownerId;
  final String deviceId;
  final int deviceSequence;
  final String entityType;
  final String entityId;
  final String kind;
  final String? baseVersion;
  final String payloadJson;
  final DateTime occurredAt;
  final int attempts;
  final DateTime nextAttemptAt;
  final DateTime? acknowledgedAt;
  final DateTime createdAt;
  const OutboxOperation(
      {required this.operationId,
      required this.ownerId,
      required this.deviceId,
      required this.deviceSequence,
      required this.entityType,
      required this.entityId,
      required this.kind,
      this.baseVersion,
      required this.payloadJson,
      required this.occurredAt,
      required this.attempts,
      required this.nextAttemptAt,
      this.acknowledgedAt,
      required this.createdAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['operation_id'] = Variable<String>(operationId);
    map['owner_id'] = Variable<String>(ownerId);
    map['device_id'] = Variable<String>(deviceId);
    map['device_sequence'] = Variable<int>(deviceSequence);
    map['entity_type'] = Variable<String>(entityType);
    map['entity_id'] = Variable<String>(entityId);
    map['kind'] = Variable<String>(kind);
    if (!nullToAbsent || baseVersion != null) {
      map['base_version'] = Variable<String>(baseVersion);
    }
    map['payload_json'] = Variable<String>(payloadJson);
    map['occurred_at'] = Variable<DateTime>(occurredAt);
    map['attempts'] = Variable<int>(attempts);
    map['next_attempt_at'] = Variable<DateTime>(nextAttemptAt);
    if (!nullToAbsent || acknowledgedAt != null) {
      map['acknowledged_at'] = Variable<DateTime>(acknowledgedAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  OutboxOperationsCompanion toCompanion(bool nullToAbsent) {
    return OutboxOperationsCompanion(
      operationId: Value(operationId),
      ownerId: Value(ownerId),
      deviceId: Value(deviceId),
      deviceSequence: Value(deviceSequence),
      entityType: Value(entityType),
      entityId: Value(entityId),
      kind: Value(kind),
      baseVersion: baseVersion == null && nullToAbsent
          ? const Value.absent()
          : Value(baseVersion),
      payloadJson: Value(payloadJson),
      occurredAt: Value(occurredAt),
      attempts: Value(attempts),
      nextAttemptAt: Value(nextAttemptAt),
      acknowledgedAt: acknowledgedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(acknowledgedAt),
      createdAt: Value(createdAt),
    );
  }

  factory OutboxOperation.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OutboxOperation(
      operationId: serializer.fromJson<String>(json['operationId']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      deviceId: serializer.fromJson<String>(json['deviceId']),
      deviceSequence: serializer.fromJson<int>(json['deviceSequence']),
      entityType: serializer.fromJson<String>(json['entityType']),
      entityId: serializer.fromJson<String>(json['entityId']),
      kind: serializer.fromJson<String>(json['kind']),
      baseVersion: serializer.fromJson<String?>(json['baseVersion']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      occurredAt: serializer.fromJson<DateTime>(json['occurredAt']),
      attempts: serializer.fromJson<int>(json['attempts']),
      nextAttemptAt: serializer.fromJson<DateTime>(json['nextAttemptAt']),
      acknowledgedAt: serializer.fromJson<DateTime?>(json['acknowledgedAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'operationId': serializer.toJson<String>(operationId),
      'ownerId': serializer.toJson<String>(ownerId),
      'deviceId': serializer.toJson<String>(deviceId),
      'deviceSequence': serializer.toJson<int>(deviceSequence),
      'entityType': serializer.toJson<String>(entityType),
      'entityId': serializer.toJson<String>(entityId),
      'kind': serializer.toJson<String>(kind),
      'baseVersion': serializer.toJson<String?>(baseVersion),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'occurredAt': serializer.toJson<DateTime>(occurredAt),
      'attempts': serializer.toJson<int>(attempts),
      'nextAttemptAt': serializer.toJson<DateTime>(nextAttemptAt),
      'acknowledgedAt': serializer.toJson<DateTime?>(acknowledgedAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  OutboxOperation copyWith(
          {String? operationId,
          String? ownerId,
          String? deviceId,
          int? deviceSequence,
          String? entityType,
          String? entityId,
          String? kind,
          Value<String?> baseVersion = const Value.absent(),
          String? payloadJson,
          DateTime? occurredAt,
          int? attempts,
          DateTime? nextAttemptAt,
          Value<DateTime?> acknowledgedAt = const Value.absent(),
          DateTime? createdAt}) =>
      OutboxOperation(
        operationId: operationId ?? this.operationId,
        ownerId: ownerId ?? this.ownerId,
        deviceId: deviceId ?? this.deviceId,
        deviceSequence: deviceSequence ?? this.deviceSequence,
        entityType: entityType ?? this.entityType,
        entityId: entityId ?? this.entityId,
        kind: kind ?? this.kind,
        baseVersion: baseVersion.present ? baseVersion.value : this.baseVersion,
        payloadJson: payloadJson ?? this.payloadJson,
        occurredAt: occurredAt ?? this.occurredAt,
        attempts: attempts ?? this.attempts,
        nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
        acknowledgedAt:
            acknowledgedAt.present ? acknowledgedAt.value : this.acknowledgedAt,
        createdAt: createdAt ?? this.createdAt,
      );
  OutboxOperation copyWithCompanion(OutboxOperationsCompanion data) {
    return OutboxOperation(
      operationId:
          data.operationId.present ? data.operationId.value : this.operationId,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      deviceId: data.deviceId.present ? data.deviceId.value : this.deviceId,
      deviceSequence: data.deviceSequence.present
          ? data.deviceSequence.value
          : this.deviceSequence,
      entityType:
          data.entityType.present ? data.entityType.value : this.entityType,
      entityId: data.entityId.present ? data.entityId.value : this.entityId,
      kind: data.kind.present ? data.kind.value : this.kind,
      baseVersion:
          data.baseVersion.present ? data.baseVersion.value : this.baseVersion,
      payloadJson:
          data.payloadJson.present ? data.payloadJson.value : this.payloadJson,
      occurredAt:
          data.occurredAt.present ? data.occurredAt.value : this.occurredAt,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
      nextAttemptAt: data.nextAttemptAt.present
          ? data.nextAttemptAt.value
          : this.nextAttemptAt,
      acknowledgedAt: data.acknowledgedAt.present
          ? data.acknowledgedAt.value
          : this.acknowledgedAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OutboxOperation(')
          ..write('operationId: $operationId, ')
          ..write('ownerId: $ownerId, ')
          ..write('deviceId: $deviceId, ')
          ..write('deviceSequence: $deviceSequence, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('kind: $kind, ')
          ..write('baseVersion: $baseVersion, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('occurredAt: $occurredAt, ')
          ..write('attempts: $attempts, ')
          ..write('nextAttemptAt: $nextAttemptAt, ')
          ..write('acknowledgedAt: $acknowledgedAt, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      operationId,
      ownerId,
      deviceId,
      deviceSequence,
      entityType,
      entityId,
      kind,
      baseVersion,
      payloadJson,
      occurredAt,
      attempts,
      nextAttemptAt,
      acknowledgedAt,
      createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OutboxOperation &&
          other.operationId == this.operationId &&
          other.ownerId == this.ownerId &&
          other.deviceId == this.deviceId &&
          other.deviceSequence == this.deviceSequence &&
          other.entityType == this.entityType &&
          other.entityId == this.entityId &&
          other.kind == this.kind &&
          other.baseVersion == this.baseVersion &&
          other.payloadJson == this.payloadJson &&
          other.occurredAt == this.occurredAt &&
          other.attempts == this.attempts &&
          other.nextAttemptAt == this.nextAttemptAt &&
          other.acknowledgedAt == this.acknowledgedAt &&
          other.createdAt == this.createdAt);
}

class OutboxOperationsCompanion extends UpdateCompanion<OutboxOperation> {
  final Value<String> operationId;
  final Value<String> ownerId;
  final Value<String> deviceId;
  final Value<int> deviceSequence;
  final Value<String> entityType;
  final Value<String> entityId;
  final Value<String> kind;
  final Value<String?> baseVersion;
  final Value<String> payloadJson;
  final Value<DateTime> occurredAt;
  final Value<int> attempts;
  final Value<DateTime> nextAttemptAt;
  final Value<DateTime?> acknowledgedAt;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const OutboxOperationsCompanion({
    this.operationId = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.deviceId = const Value.absent(),
    this.deviceSequence = const Value.absent(),
    this.entityType = const Value.absent(),
    this.entityId = const Value.absent(),
    this.kind = const Value.absent(),
    this.baseVersion = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.occurredAt = const Value.absent(),
    this.attempts = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
    this.acknowledgedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  OutboxOperationsCompanion.insert({
    required String operationId,
    required String ownerId,
    required String deviceId,
    required int deviceSequence,
    required String entityType,
    required String entityId,
    required String kind,
    this.baseVersion = const Value.absent(),
    required String payloadJson,
    required DateTime occurredAt,
    this.attempts = const Value.absent(),
    required DateTime nextAttemptAt,
    this.acknowledgedAt = const Value.absent(),
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  })  : operationId = Value(operationId),
        ownerId = Value(ownerId),
        deviceId = Value(deviceId),
        deviceSequence = Value(deviceSequence),
        entityType = Value(entityType),
        entityId = Value(entityId),
        kind = Value(kind),
        payloadJson = Value(payloadJson),
        occurredAt = Value(occurredAt),
        nextAttemptAt = Value(nextAttemptAt),
        createdAt = Value(createdAt);
  static Insertable<OutboxOperation> custom({
    Expression<String>? operationId,
    Expression<String>? ownerId,
    Expression<String>? deviceId,
    Expression<int>? deviceSequence,
    Expression<String>? entityType,
    Expression<String>? entityId,
    Expression<String>? kind,
    Expression<String>? baseVersion,
    Expression<String>? payloadJson,
    Expression<DateTime>? occurredAt,
    Expression<int>? attempts,
    Expression<DateTime>? nextAttemptAt,
    Expression<DateTime>? acknowledgedAt,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (operationId != null) 'operation_id': operationId,
      if (ownerId != null) 'owner_id': ownerId,
      if (deviceId != null) 'device_id': deviceId,
      if (deviceSequence != null) 'device_sequence': deviceSequence,
      if (entityType != null) 'entity_type': entityType,
      if (entityId != null) 'entity_id': entityId,
      if (kind != null) 'kind': kind,
      if (baseVersion != null) 'base_version': baseVersion,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (occurredAt != null) 'occurred_at': occurredAt,
      if (attempts != null) 'attempts': attempts,
      if (nextAttemptAt != null) 'next_attempt_at': nextAttemptAt,
      if (acknowledgedAt != null) 'acknowledged_at': acknowledgedAt,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  OutboxOperationsCompanion copyWith(
      {Value<String>? operationId,
      Value<String>? ownerId,
      Value<String>? deviceId,
      Value<int>? deviceSequence,
      Value<String>? entityType,
      Value<String>? entityId,
      Value<String>? kind,
      Value<String?>? baseVersion,
      Value<String>? payloadJson,
      Value<DateTime>? occurredAt,
      Value<int>? attempts,
      Value<DateTime>? nextAttemptAt,
      Value<DateTime?>? acknowledgedAt,
      Value<DateTime>? createdAt,
      Value<int>? rowid}) {
    return OutboxOperationsCompanion(
      operationId: operationId ?? this.operationId,
      ownerId: ownerId ?? this.ownerId,
      deviceId: deviceId ?? this.deviceId,
      deviceSequence: deviceSequence ?? this.deviceSequence,
      entityType: entityType ?? this.entityType,
      entityId: entityId ?? this.entityId,
      kind: kind ?? this.kind,
      baseVersion: baseVersion ?? this.baseVersion,
      payloadJson: payloadJson ?? this.payloadJson,
      occurredAt: occurredAt ?? this.occurredAt,
      attempts: attempts ?? this.attempts,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      acknowledgedAt: acknowledgedAt ?? this.acknowledgedAt,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (operationId.present) {
      map['operation_id'] = Variable<String>(operationId.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (deviceId.present) {
      map['device_id'] = Variable<String>(deviceId.value);
    }
    if (deviceSequence.present) {
      map['device_sequence'] = Variable<int>(deviceSequence.value);
    }
    if (entityType.present) {
      map['entity_type'] = Variable<String>(entityType.value);
    }
    if (entityId.present) {
      map['entity_id'] = Variable<String>(entityId.value);
    }
    if (kind.present) {
      map['kind'] = Variable<String>(kind.value);
    }
    if (baseVersion.present) {
      map['base_version'] = Variable<String>(baseVersion.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (occurredAt.present) {
      map['occurred_at'] = Variable<DateTime>(occurredAt.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    if (nextAttemptAt.present) {
      map['next_attempt_at'] = Variable<DateTime>(nextAttemptAt.value);
    }
    if (acknowledgedAt.present) {
      map['acknowledged_at'] = Variable<DateTime>(acknowledgedAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OutboxOperationsCompanion(')
          ..write('operationId: $operationId, ')
          ..write('ownerId: $ownerId, ')
          ..write('deviceId: $deviceId, ')
          ..write('deviceSequence: $deviceSequence, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('kind: $kind, ')
          ..write('baseVersion: $baseVersion, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('occurredAt: $occurredAt, ')
          ..write('attempts: $attempts, ')
          ..write('nextAttemptAt: $nextAttemptAt, ')
          ..write('acknowledgedAt: $acknowledgedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SyncFailuresTable extends SyncFailures
    with TableInfo<$SyncFailuresTable, SyncFailure> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncFailuresTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _operationIdMeta =
      const VerificationMeta('operationId');
  @override
  late final GeneratedColumn<String> operationId = GeneratedColumn<String>(
      'operation_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _codeMeta = const VerificationMeta('code');
  @override
  late final GeneratedColumn<String> code = GeneratedColumn<String>(
      'code', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _messageMeta =
      const VerificationMeta('message');
  @override
  late final GeneratedColumn<String> message = GeneratedColumn<String>(
      'message', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _recordedAtMeta =
      const VerificationMeta('recordedAt');
  @override
  late final GeneratedColumn<DateTime> recordedAt = GeneratedColumn<DateTime>(
      'recorded_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [operationId, code, message, recordedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_failures';
  @override
  VerificationContext validateIntegrity(Insertable<SyncFailure> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('operation_id')) {
      context.handle(
          _operationIdMeta,
          operationId.isAcceptableOrUnknown(
              data['operation_id']!, _operationIdMeta));
    } else if (isInserting) {
      context.missing(_operationIdMeta);
    }
    if (data.containsKey('code')) {
      context.handle(
          _codeMeta, code.isAcceptableOrUnknown(data['code']!, _codeMeta));
    } else if (isInserting) {
      context.missing(_codeMeta);
    }
    if (data.containsKey('message')) {
      context.handle(_messageMeta,
          message.isAcceptableOrUnknown(data['message']!, _messageMeta));
    } else if (isInserting) {
      context.missing(_messageMeta);
    }
    if (data.containsKey('recorded_at')) {
      context.handle(
          _recordedAtMeta,
          recordedAt.isAcceptableOrUnknown(
              data['recorded_at']!, _recordedAtMeta));
    } else if (isInserting) {
      context.missing(_recordedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {operationId};
  @override
  SyncFailure map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncFailure(
      operationId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}operation_id'])!,
      code: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}code'])!,
      message: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}message'])!,
      recordedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}recorded_at'])!,
    );
  }

  @override
  $SyncFailuresTable createAlias(String alias) {
    return $SyncFailuresTable(attachedDatabase, alias);
  }
}

class SyncFailure extends DataClass implements Insertable<SyncFailure> {
  final String operationId;
  final String code;
  final String message;
  final DateTime recordedAt;
  const SyncFailure(
      {required this.operationId,
      required this.code,
      required this.message,
      required this.recordedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['operation_id'] = Variable<String>(operationId);
    map['code'] = Variable<String>(code);
    map['message'] = Variable<String>(message);
    map['recorded_at'] = Variable<DateTime>(recordedAt);
    return map;
  }

  SyncFailuresCompanion toCompanion(bool nullToAbsent) {
    return SyncFailuresCompanion(
      operationId: Value(operationId),
      code: Value(code),
      message: Value(message),
      recordedAt: Value(recordedAt),
    );
  }

  factory SyncFailure.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncFailure(
      operationId: serializer.fromJson<String>(json['operationId']),
      code: serializer.fromJson<String>(json['code']),
      message: serializer.fromJson<String>(json['message']),
      recordedAt: serializer.fromJson<DateTime>(json['recordedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'operationId': serializer.toJson<String>(operationId),
      'code': serializer.toJson<String>(code),
      'message': serializer.toJson<String>(message),
      'recordedAt': serializer.toJson<DateTime>(recordedAt),
    };
  }

  SyncFailure copyWith(
          {String? operationId,
          String? code,
          String? message,
          DateTime? recordedAt}) =>
      SyncFailure(
        operationId: operationId ?? this.operationId,
        code: code ?? this.code,
        message: message ?? this.message,
        recordedAt: recordedAt ?? this.recordedAt,
      );
  SyncFailure copyWithCompanion(SyncFailuresCompanion data) {
    return SyncFailure(
      operationId:
          data.operationId.present ? data.operationId.value : this.operationId,
      code: data.code.present ? data.code.value : this.code,
      message: data.message.present ? data.message.value : this.message,
      recordedAt:
          data.recordedAt.present ? data.recordedAt.value : this.recordedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncFailure(')
          ..write('operationId: $operationId, ')
          ..write('code: $code, ')
          ..write('message: $message, ')
          ..write('recordedAt: $recordedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(operationId, code, message, recordedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncFailure &&
          other.operationId == this.operationId &&
          other.code == this.code &&
          other.message == this.message &&
          other.recordedAt == this.recordedAt);
}

class SyncFailuresCompanion extends UpdateCompanion<SyncFailure> {
  final Value<String> operationId;
  final Value<String> code;
  final Value<String> message;
  final Value<DateTime> recordedAt;
  final Value<int> rowid;
  const SyncFailuresCompanion({
    this.operationId = const Value.absent(),
    this.code = const Value.absent(),
    this.message = const Value.absent(),
    this.recordedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SyncFailuresCompanion.insert({
    required String operationId,
    required String code,
    required String message,
    required DateTime recordedAt,
    this.rowid = const Value.absent(),
  })  : operationId = Value(operationId),
        code = Value(code),
        message = Value(message),
        recordedAt = Value(recordedAt);
  static Insertable<SyncFailure> custom({
    Expression<String>? operationId,
    Expression<String>? code,
    Expression<String>? message,
    Expression<DateTime>? recordedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (operationId != null) 'operation_id': operationId,
      if (code != null) 'code': code,
      if (message != null) 'message': message,
      if (recordedAt != null) 'recorded_at': recordedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SyncFailuresCompanion copyWith(
      {Value<String>? operationId,
      Value<String>? code,
      Value<String>? message,
      Value<DateTime>? recordedAt,
      Value<int>? rowid}) {
    return SyncFailuresCompanion(
      operationId: operationId ?? this.operationId,
      code: code ?? this.code,
      message: message ?? this.message,
      recordedAt: recordedAt ?? this.recordedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (operationId.present) {
      map['operation_id'] = Variable<String>(operationId.value);
    }
    if (code.present) {
      map['code'] = Variable<String>(code.value);
    }
    if (message.present) {
      map['message'] = Variable<String>(message.value);
    }
    if (recordedAt.present) {
      map['recorded_at'] = Variable<DateTime>(recordedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncFailuresCompanion(')
          ..write('operationId: $operationId, ')
          ..write('code: $code, ')
          ..write('message: $message, ')
          ..write('recordedAt: $recordedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ConflictsTable extends Conflicts
    with TableInfo<$ConflictsTable, Conflict> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ConflictsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _entityTypeMeta =
      const VerificationMeta('entityType');
  @override
  late final GeneratedColumn<String> entityType = GeneratedColumn<String>(
      'entity_type', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _entityIdMeta =
      const VerificationMeta('entityId');
  @override
  late final GeneratedColumn<String> entityId = GeneratedColumn<String>(
      'entity_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _localOperationIdMeta =
      const VerificationMeta('localOperationId');
  @override
  late final GeneratedColumn<String> localOperationId = GeneratedColumn<String>(
      'local_operation_id', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _remoteOperationIdMeta =
      const VerificationMeta('remoteOperationId');
  @override
  late final GeneratedColumn<String> remoteOperationId =
      GeneratedColumn<String>('remote_operation_id', aliasedName, true,
          type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _localPayloadJsonMeta =
      const VerificationMeta('localPayloadJson');
  @override
  late final GeneratedColumn<String> localPayloadJson = GeneratedColumn<String>(
      'local_payload_json', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _remotePayloadJsonMeta =
      const VerificationMeta('remotePayloadJson');
  @override
  late final GeneratedColumn<String> remotePayloadJson =
      GeneratedColumn<String>('remote_payload_json', aliasedName, true,
          type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('OPEN'));
  static const VerificationMeta _resolvedAtMeta =
      const VerificationMeta('resolvedAt');
  @override
  late final GeneratedColumn<DateTime> resolvedAt = GeneratedColumn<DateTime>(
      'resolved_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        ownerId,
        entityType,
        entityId,
        localOperationId,
        remoteOperationId,
        localPayloadJson,
        remotePayloadJson,
        status,
        resolvedAt,
        createdAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'conflicts';
  @override
  VerificationContext validateIntegrity(Insertable<Conflict> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('entity_type')) {
      context.handle(
          _entityTypeMeta,
          entityType.isAcceptableOrUnknown(
              data['entity_type']!, _entityTypeMeta));
    } else if (isInserting) {
      context.missing(_entityTypeMeta);
    }
    if (data.containsKey('entity_id')) {
      context.handle(_entityIdMeta,
          entityId.isAcceptableOrUnknown(data['entity_id']!, _entityIdMeta));
    } else if (isInserting) {
      context.missing(_entityIdMeta);
    }
    if (data.containsKey('local_operation_id')) {
      context.handle(
          _localOperationIdMeta,
          localOperationId.isAcceptableOrUnknown(
              data['local_operation_id']!, _localOperationIdMeta));
    }
    if (data.containsKey('remote_operation_id')) {
      context.handle(
          _remoteOperationIdMeta,
          remoteOperationId.isAcceptableOrUnknown(
              data['remote_operation_id']!, _remoteOperationIdMeta));
    }
    if (data.containsKey('local_payload_json')) {
      context.handle(
          _localPayloadJsonMeta,
          localPayloadJson.isAcceptableOrUnknown(
              data['local_payload_json']!, _localPayloadJsonMeta));
    }
    if (data.containsKey('remote_payload_json')) {
      context.handle(
          _remotePayloadJsonMeta,
          remotePayloadJson.isAcceptableOrUnknown(
              data['remote_payload_json']!, _remotePayloadJsonMeta));
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('resolved_at')) {
      context.handle(
          _resolvedAtMeta,
          resolvedAt.isAcceptableOrUnknown(
              data['resolved_at']!, _resolvedAtMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Conflict map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Conflict(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      entityType: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}entity_type'])!,
      entityId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}entity_id'])!,
      localOperationId: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}local_operation_id']),
      remoteOperationId: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}remote_operation_id']),
      localPayloadJson: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}local_payload_json']),
      remotePayloadJson: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}remote_payload_json']),
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      resolvedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}resolved_at']),
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
    );
  }

  @override
  $ConflictsTable createAlias(String alias) {
    return $ConflictsTable(attachedDatabase, alias);
  }
}

class Conflict extends DataClass implements Insertable<Conflict> {
  final String id;
  final String ownerId;
  final String entityType;
  final String entityId;
  final String? localOperationId;
  final String? remoteOperationId;
  final String? localPayloadJson;
  final String? remotePayloadJson;
  final String status;
  final DateTime? resolvedAt;
  final DateTime createdAt;
  const Conflict(
      {required this.id,
      required this.ownerId,
      required this.entityType,
      required this.entityId,
      this.localOperationId,
      this.remoteOperationId,
      this.localPayloadJson,
      this.remotePayloadJson,
      required this.status,
      this.resolvedAt,
      required this.createdAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_id'] = Variable<String>(ownerId);
    map['entity_type'] = Variable<String>(entityType);
    map['entity_id'] = Variable<String>(entityId);
    if (!nullToAbsent || localOperationId != null) {
      map['local_operation_id'] = Variable<String>(localOperationId);
    }
    if (!nullToAbsent || remoteOperationId != null) {
      map['remote_operation_id'] = Variable<String>(remoteOperationId);
    }
    if (!nullToAbsent || localPayloadJson != null) {
      map['local_payload_json'] = Variable<String>(localPayloadJson);
    }
    if (!nullToAbsent || remotePayloadJson != null) {
      map['remote_payload_json'] = Variable<String>(remotePayloadJson);
    }
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || resolvedAt != null) {
      map['resolved_at'] = Variable<DateTime>(resolvedAt);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  ConflictsCompanion toCompanion(bool nullToAbsent) {
    return ConflictsCompanion(
      id: Value(id),
      ownerId: Value(ownerId),
      entityType: Value(entityType),
      entityId: Value(entityId),
      localOperationId: localOperationId == null && nullToAbsent
          ? const Value.absent()
          : Value(localOperationId),
      remoteOperationId: remoteOperationId == null && nullToAbsent
          ? const Value.absent()
          : Value(remoteOperationId),
      localPayloadJson: localPayloadJson == null && nullToAbsent
          ? const Value.absent()
          : Value(localPayloadJson),
      remotePayloadJson: remotePayloadJson == null && nullToAbsent
          ? const Value.absent()
          : Value(remotePayloadJson),
      status: Value(status),
      resolvedAt: resolvedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(resolvedAt),
      createdAt: Value(createdAt),
    );
  }

  factory Conflict.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Conflict(
      id: serializer.fromJson<String>(json['id']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      entityType: serializer.fromJson<String>(json['entityType']),
      entityId: serializer.fromJson<String>(json['entityId']),
      localOperationId: serializer.fromJson<String?>(json['localOperationId']),
      remoteOperationId:
          serializer.fromJson<String?>(json['remoteOperationId']),
      localPayloadJson: serializer.fromJson<String?>(json['localPayloadJson']),
      remotePayloadJson:
          serializer.fromJson<String?>(json['remotePayloadJson']),
      status: serializer.fromJson<String>(json['status']),
      resolvedAt: serializer.fromJson<DateTime?>(json['resolvedAt']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerId': serializer.toJson<String>(ownerId),
      'entityType': serializer.toJson<String>(entityType),
      'entityId': serializer.toJson<String>(entityId),
      'localOperationId': serializer.toJson<String?>(localOperationId),
      'remoteOperationId': serializer.toJson<String?>(remoteOperationId),
      'localPayloadJson': serializer.toJson<String?>(localPayloadJson),
      'remotePayloadJson': serializer.toJson<String?>(remotePayloadJson),
      'status': serializer.toJson<String>(status),
      'resolvedAt': serializer.toJson<DateTime?>(resolvedAt),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  Conflict copyWith(
          {String? id,
          String? ownerId,
          String? entityType,
          String? entityId,
          Value<String?> localOperationId = const Value.absent(),
          Value<String?> remoteOperationId = const Value.absent(),
          Value<String?> localPayloadJson = const Value.absent(),
          Value<String?> remotePayloadJson = const Value.absent(),
          String? status,
          Value<DateTime?> resolvedAt = const Value.absent(),
          DateTime? createdAt}) =>
      Conflict(
        id: id ?? this.id,
        ownerId: ownerId ?? this.ownerId,
        entityType: entityType ?? this.entityType,
        entityId: entityId ?? this.entityId,
        localOperationId: localOperationId.present
            ? localOperationId.value
            : this.localOperationId,
        remoteOperationId: remoteOperationId.present
            ? remoteOperationId.value
            : this.remoteOperationId,
        localPayloadJson: localPayloadJson.present
            ? localPayloadJson.value
            : this.localPayloadJson,
        remotePayloadJson: remotePayloadJson.present
            ? remotePayloadJson.value
            : this.remotePayloadJson,
        status: status ?? this.status,
        resolvedAt: resolvedAt.present ? resolvedAt.value : this.resolvedAt,
        createdAt: createdAt ?? this.createdAt,
      );
  Conflict copyWithCompanion(ConflictsCompanion data) {
    return Conflict(
      id: data.id.present ? data.id.value : this.id,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      entityType:
          data.entityType.present ? data.entityType.value : this.entityType,
      entityId: data.entityId.present ? data.entityId.value : this.entityId,
      localOperationId: data.localOperationId.present
          ? data.localOperationId.value
          : this.localOperationId,
      remoteOperationId: data.remoteOperationId.present
          ? data.remoteOperationId.value
          : this.remoteOperationId,
      localPayloadJson: data.localPayloadJson.present
          ? data.localPayloadJson.value
          : this.localPayloadJson,
      remotePayloadJson: data.remotePayloadJson.present
          ? data.remotePayloadJson.value
          : this.remotePayloadJson,
      status: data.status.present ? data.status.value : this.status,
      resolvedAt:
          data.resolvedAt.present ? data.resolvedAt.value : this.resolvedAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Conflict(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('localOperationId: $localOperationId, ')
          ..write('remoteOperationId: $remoteOperationId, ')
          ..write('localPayloadJson: $localPayloadJson, ')
          ..write('remotePayloadJson: $remotePayloadJson, ')
          ..write('status: $status, ')
          ..write('resolvedAt: $resolvedAt, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      ownerId,
      entityType,
      entityId,
      localOperationId,
      remoteOperationId,
      localPayloadJson,
      remotePayloadJson,
      status,
      resolvedAt,
      createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Conflict &&
          other.id == this.id &&
          other.ownerId == this.ownerId &&
          other.entityType == this.entityType &&
          other.entityId == this.entityId &&
          other.localOperationId == this.localOperationId &&
          other.remoteOperationId == this.remoteOperationId &&
          other.localPayloadJson == this.localPayloadJson &&
          other.remotePayloadJson == this.remotePayloadJson &&
          other.status == this.status &&
          other.resolvedAt == this.resolvedAt &&
          other.createdAt == this.createdAt);
}

class ConflictsCompanion extends UpdateCompanion<Conflict> {
  final Value<String> id;
  final Value<String> ownerId;
  final Value<String> entityType;
  final Value<String> entityId;
  final Value<String?> localOperationId;
  final Value<String?> remoteOperationId;
  final Value<String?> localPayloadJson;
  final Value<String?> remotePayloadJson;
  final Value<String> status;
  final Value<DateTime?> resolvedAt;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const ConflictsCompanion({
    this.id = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.entityType = const Value.absent(),
    this.entityId = const Value.absent(),
    this.localOperationId = const Value.absent(),
    this.remoteOperationId = const Value.absent(),
    this.localPayloadJson = const Value.absent(),
    this.remotePayloadJson = const Value.absent(),
    this.status = const Value.absent(),
    this.resolvedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ConflictsCompanion.insert({
    required String id,
    required String ownerId,
    required String entityType,
    required String entityId,
    this.localOperationId = const Value.absent(),
    this.remoteOperationId = const Value.absent(),
    this.localPayloadJson = const Value.absent(),
    this.remotePayloadJson = const Value.absent(),
    this.status = const Value.absent(),
    this.resolvedAt = const Value.absent(),
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerId = Value(ownerId),
        entityType = Value(entityType),
        entityId = Value(entityId),
        createdAt = Value(createdAt);
  static Insertable<Conflict> custom({
    Expression<String>? id,
    Expression<String>? ownerId,
    Expression<String>? entityType,
    Expression<String>? entityId,
    Expression<String>? localOperationId,
    Expression<String>? remoteOperationId,
    Expression<String>? localPayloadJson,
    Expression<String>? remotePayloadJson,
    Expression<String>? status,
    Expression<DateTime>? resolvedAt,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerId != null) 'owner_id': ownerId,
      if (entityType != null) 'entity_type': entityType,
      if (entityId != null) 'entity_id': entityId,
      if (localOperationId != null) 'local_operation_id': localOperationId,
      if (remoteOperationId != null) 'remote_operation_id': remoteOperationId,
      if (localPayloadJson != null) 'local_payload_json': localPayloadJson,
      if (remotePayloadJson != null) 'remote_payload_json': remotePayloadJson,
      if (status != null) 'status': status,
      if (resolvedAt != null) 'resolved_at': resolvedAt,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ConflictsCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerId,
      Value<String>? entityType,
      Value<String>? entityId,
      Value<String?>? localOperationId,
      Value<String?>? remoteOperationId,
      Value<String?>? localPayloadJson,
      Value<String?>? remotePayloadJson,
      Value<String>? status,
      Value<DateTime?>? resolvedAt,
      Value<DateTime>? createdAt,
      Value<int>? rowid}) {
    return ConflictsCompanion(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      entityType: entityType ?? this.entityType,
      entityId: entityId ?? this.entityId,
      localOperationId: localOperationId ?? this.localOperationId,
      remoteOperationId: remoteOperationId ?? this.remoteOperationId,
      localPayloadJson: localPayloadJson ?? this.localPayloadJson,
      remotePayloadJson: remotePayloadJson ?? this.remotePayloadJson,
      status: status ?? this.status,
      resolvedAt: resolvedAt ?? this.resolvedAt,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (entityType.present) {
      map['entity_type'] = Variable<String>(entityType.value);
    }
    if (entityId.present) {
      map['entity_id'] = Variable<String>(entityId.value);
    }
    if (localOperationId.present) {
      map['local_operation_id'] = Variable<String>(localOperationId.value);
    }
    if (remoteOperationId.present) {
      map['remote_operation_id'] = Variable<String>(remoteOperationId.value);
    }
    if (localPayloadJson.present) {
      map['local_payload_json'] = Variable<String>(localPayloadJson.value);
    }
    if (remotePayloadJson.present) {
      map['remote_payload_json'] = Variable<String>(remotePayloadJson.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (resolvedAt.present) {
      map['resolved_at'] = Variable<DateTime>(resolvedAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ConflictsCompanion(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('localOperationId: $localOperationId, ')
          ..write('remoteOperationId: $remoteOperationId, ')
          ..write('localPayloadJson: $localPayloadJson, ')
          ..write('remotePayloadJson: $remotePayloadJson, ')
          ..write('status: $status, ')
          ..write('resolvedAt: $resolvedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $BackupManifestsTable extends BackupManifests
    with TableInfo<$BackupManifestsTable, BackupManifest> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $BackupManifestsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _kindMeta = const VerificationMeta('kind');
  @override
  late final GeneratedColumn<String> kind = GeneratedColumn<String>(
      'kind', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _formatVersionMeta =
      const VerificationMeta('formatVersion');
  @override
  late final GeneratedColumn<int> formatVersion = GeneratedColumn<int>(
      'format_version', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _schemaVersionMeta =
      const VerificationMeta('schemaVersion');
  @override
  late final GeneratedColumn<int> schemaVersion = GeneratedColumn<int>(
      'schema_version', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _storageLocationMeta =
      const VerificationMeta('storageLocation');
  @override
  late final GeneratedColumn<String> storageLocation = GeneratedColumn<String>(
      'storage_location', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _checksumMeta =
      const VerificationMeta('checksum');
  @override
  late final GeneratedColumn<String> checksum = GeneratedColumn<String>(
      'checksum', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _encryptionJsonMeta =
      const VerificationMeta('encryptionJson');
  @override
  late final GeneratedColumn<String> encryptionJson = GeneratedColumn<String>(
      'encryption_json', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _expiresAtMeta =
      const VerificationMeta('expiresAt');
  @override
  late final GeneratedColumn<DateTime> expiresAt = GeneratedColumn<DateTime>(
      'expires_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        ownerId,
        kind,
        formatVersion,
        schemaVersion,
        storageLocation,
        checksum,
        encryptionJson,
        createdAt,
        expiresAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'backup_manifests';
  @override
  VerificationContext validateIntegrity(Insertable<BackupManifest> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('kind')) {
      context.handle(
          _kindMeta, kind.isAcceptableOrUnknown(data['kind']!, _kindMeta));
    } else if (isInserting) {
      context.missing(_kindMeta);
    }
    if (data.containsKey('format_version')) {
      context.handle(
          _formatVersionMeta,
          formatVersion.isAcceptableOrUnknown(
              data['format_version']!, _formatVersionMeta));
    } else if (isInserting) {
      context.missing(_formatVersionMeta);
    }
    if (data.containsKey('schema_version')) {
      context.handle(
          _schemaVersionMeta,
          schemaVersion.isAcceptableOrUnknown(
              data['schema_version']!, _schemaVersionMeta));
    } else if (isInserting) {
      context.missing(_schemaVersionMeta);
    }
    if (data.containsKey('storage_location')) {
      context.handle(
          _storageLocationMeta,
          storageLocation.isAcceptableOrUnknown(
              data['storage_location']!, _storageLocationMeta));
    } else if (isInserting) {
      context.missing(_storageLocationMeta);
    }
    if (data.containsKey('checksum')) {
      context.handle(_checksumMeta,
          checksum.isAcceptableOrUnknown(data['checksum']!, _checksumMeta));
    } else if (isInserting) {
      context.missing(_checksumMeta);
    }
    if (data.containsKey('encryption_json')) {
      context.handle(
          _encryptionJsonMeta,
          encryptionJson.isAcceptableOrUnknown(
              data['encryption_json']!, _encryptionJsonMeta));
    } else if (isInserting) {
      context.missing(_encryptionJsonMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('expires_at')) {
      context.handle(_expiresAtMeta,
          expiresAt.isAcceptableOrUnknown(data['expires_at']!, _expiresAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  BackupManifest map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return BackupManifest(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      kind: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}kind'])!,
      formatVersion: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}format_version'])!,
      schemaVersion: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}schema_version'])!,
      storageLocation: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}storage_location'])!,
      checksum: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}checksum'])!,
      encryptionJson: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}encryption_json'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      expiresAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}expires_at']),
    );
  }

  @override
  $BackupManifestsTable createAlias(String alias) {
    return $BackupManifestsTable(attachedDatabase, alias);
  }
}

class BackupManifest extends DataClass implements Insertable<BackupManifest> {
  final String id;
  final String ownerId;
  final String kind;
  final int formatVersion;
  final int schemaVersion;
  final String storageLocation;
  final String checksum;
  final String encryptionJson;
  final DateTime createdAt;
  final DateTime? expiresAt;
  const BackupManifest(
      {required this.id,
      required this.ownerId,
      required this.kind,
      required this.formatVersion,
      required this.schemaVersion,
      required this.storageLocation,
      required this.checksum,
      required this.encryptionJson,
      required this.createdAt,
      this.expiresAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_id'] = Variable<String>(ownerId);
    map['kind'] = Variable<String>(kind);
    map['format_version'] = Variable<int>(formatVersion);
    map['schema_version'] = Variable<int>(schemaVersion);
    map['storage_location'] = Variable<String>(storageLocation);
    map['checksum'] = Variable<String>(checksum);
    map['encryption_json'] = Variable<String>(encryptionJson);
    map['created_at'] = Variable<DateTime>(createdAt);
    if (!nullToAbsent || expiresAt != null) {
      map['expires_at'] = Variable<DateTime>(expiresAt);
    }
    return map;
  }

  BackupManifestsCompanion toCompanion(bool nullToAbsent) {
    return BackupManifestsCompanion(
      id: Value(id),
      ownerId: Value(ownerId),
      kind: Value(kind),
      formatVersion: Value(formatVersion),
      schemaVersion: Value(schemaVersion),
      storageLocation: Value(storageLocation),
      checksum: Value(checksum),
      encryptionJson: Value(encryptionJson),
      createdAt: Value(createdAt),
      expiresAt: expiresAt == null && nullToAbsent
          ? const Value.absent()
          : Value(expiresAt),
    );
  }

  factory BackupManifest.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return BackupManifest(
      id: serializer.fromJson<String>(json['id']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      kind: serializer.fromJson<String>(json['kind']),
      formatVersion: serializer.fromJson<int>(json['formatVersion']),
      schemaVersion: serializer.fromJson<int>(json['schemaVersion']),
      storageLocation: serializer.fromJson<String>(json['storageLocation']),
      checksum: serializer.fromJson<String>(json['checksum']),
      encryptionJson: serializer.fromJson<String>(json['encryptionJson']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      expiresAt: serializer.fromJson<DateTime?>(json['expiresAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerId': serializer.toJson<String>(ownerId),
      'kind': serializer.toJson<String>(kind),
      'formatVersion': serializer.toJson<int>(formatVersion),
      'schemaVersion': serializer.toJson<int>(schemaVersion),
      'storageLocation': serializer.toJson<String>(storageLocation),
      'checksum': serializer.toJson<String>(checksum),
      'encryptionJson': serializer.toJson<String>(encryptionJson),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'expiresAt': serializer.toJson<DateTime?>(expiresAt),
    };
  }

  BackupManifest copyWith(
          {String? id,
          String? ownerId,
          String? kind,
          int? formatVersion,
          int? schemaVersion,
          String? storageLocation,
          String? checksum,
          String? encryptionJson,
          DateTime? createdAt,
          Value<DateTime?> expiresAt = const Value.absent()}) =>
      BackupManifest(
        id: id ?? this.id,
        ownerId: ownerId ?? this.ownerId,
        kind: kind ?? this.kind,
        formatVersion: formatVersion ?? this.formatVersion,
        schemaVersion: schemaVersion ?? this.schemaVersion,
        storageLocation: storageLocation ?? this.storageLocation,
        checksum: checksum ?? this.checksum,
        encryptionJson: encryptionJson ?? this.encryptionJson,
        createdAt: createdAt ?? this.createdAt,
        expiresAt: expiresAt.present ? expiresAt.value : this.expiresAt,
      );
  BackupManifest copyWithCompanion(BackupManifestsCompanion data) {
    return BackupManifest(
      id: data.id.present ? data.id.value : this.id,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      kind: data.kind.present ? data.kind.value : this.kind,
      formatVersion: data.formatVersion.present
          ? data.formatVersion.value
          : this.formatVersion,
      schemaVersion: data.schemaVersion.present
          ? data.schemaVersion.value
          : this.schemaVersion,
      storageLocation: data.storageLocation.present
          ? data.storageLocation.value
          : this.storageLocation,
      checksum: data.checksum.present ? data.checksum.value : this.checksum,
      encryptionJson: data.encryptionJson.present
          ? data.encryptionJson.value
          : this.encryptionJson,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      expiresAt: data.expiresAt.present ? data.expiresAt.value : this.expiresAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('BackupManifest(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('kind: $kind, ')
          ..write('formatVersion: $formatVersion, ')
          ..write('schemaVersion: $schemaVersion, ')
          ..write('storageLocation: $storageLocation, ')
          ..write('checksum: $checksum, ')
          ..write('encryptionJson: $encryptionJson, ')
          ..write('createdAt: $createdAt, ')
          ..write('expiresAt: $expiresAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      ownerId,
      kind,
      formatVersion,
      schemaVersion,
      storageLocation,
      checksum,
      encryptionJson,
      createdAt,
      expiresAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is BackupManifest &&
          other.id == this.id &&
          other.ownerId == this.ownerId &&
          other.kind == this.kind &&
          other.formatVersion == this.formatVersion &&
          other.schemaVersion == this.schemaVersion &&
          other.storageLocation == this.storageLocation &&
          other.checksum == this.checksum &&
          other.encryptionJson == this.encryptionJson &&
          other.createdAt == this.createdAt &&
          other.expiresAt == this.expiresAt);
}

class BackupManifestsCompanion extends UpdateCompanion<BackupManifest> {
  final Value<String> id;
  final Value<String> ownerId;
  final Value<String> kind;
  final Value<int> formatVersion;
  final Value<int> schemaVersion;
  final Value<String> storageLocation;
  final Value<String> checksum;
  final Value<String> encryptionJson;
  final Value<DateTime> createdAt;
  final Value<DateTime?> expiresAt;
  final Value<int> rowid;
  const BackupManifestsCompanion({
    this.id = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.kind = const Value.absent(),
    this.formatVersion = const Value.absent(),
    this.schemaVersion = const Value.absent(),
    this.storageLocation = const Value.absent(),
    this.checksum = const Value.absent(),
    this.encryptionJson = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.expiresAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  BackupManifestsCompanion.insert({
    required String id,
    required String ownerId,
    required String kind,
    required int formatVersion,
    required int schemaVersion,
    required String storageLocation,
    required String checksum,
    required String encryptionJson,
    required DateTime createdAt,
    this.expiresAt = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerId = Value(ownerId),
        kind = Value(kind),
        formatVersion = Value(formatVersion),
        schemaVersion = Value(schemaVersion),
        storageLocation = Value(storageLocation),
        checksum = Value(checksum),
        encryptionJson = Value(encryptionJson),
        createdAt = Value(createdAt);
  static Insertable<BackupManifest> custom({
    Expression<String>? id,
    Expression<String>? ownerId,
    Expression<String>? kind,
    Expression<int>? formatVersion,
    Expression<int>? schemaVersion,
    Expression<String>? storageLocation,
    Expression<String>? checksum,
    Expression<String>? encryptionJson,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? expiresAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerId != null) 'owner_id': ownerId,
      if (kind != null) 'kind': kind,
      if (formatVersion != null) 'format_version': formatVersion,
      if (schemaVersion != null) 'schema_version': schemaVersion,
      if (storageLocation != null) 'storage_location': storageLocation,
      if (checksum != null) 'checksum': checksum,
      if (encryptionJson != null) 'encryption_json': encryptionJson,
      if (createdAt != null) 'created_at': createdAt,
      if (expiresAt != null) 'expires_at': expiresAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  BackupManifestsCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerId,
      Value<String>? kind,
      Value<int>? formatVersion,
      Value<int>? schemaVersion,
      Value<String>? storageLocation,
      Value<String>? checksum,
      Value<String>? encryptionJson,
      Value<DateTime>? createdAt,
      Value<DateTime?>? expiresAt,
      Value<int>? rowid}) {
    return BackupManifestsCompanion(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      kind: kind ?? this.kind,
      formatVersion: formatVersion ?? this.formatVersion,
      schemaVersion: schemaVersion ?? this.schemaVersion,
      storageLocation: storageLocation ?? this.storageLocation,
      checksum: checksum ?? this.checksum,
      encryptionJson: encryptionJson ?? this.encryptionJson,
      createdAt: createdAt ?? this.createdAt,
      expiresAt: expiresAt ?? this.expiresAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (kind.present) {
      map['kind'] = Variable<String>(kind.value);
    }
    if (formatVersion.present) {
      map['format_version'] = Variable<int>(formatVersion.value);
    }
    if (schemaVersion.present) {
      map['schema_version'] = Variable<int>(schemaVersion.value);
    }
    if (storageLocation.present) {
      map['storage_location'] = Variable<String>(storageLocation.value);
    }
    if (checksum.present) {
      map['checksum'] = Variable<String>(checksum.value);
    }
    if (encryptionJson.present) {
      map['encryption_json'] = Variable<String>(encryptionJson.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (expiresAt.present) {
      map['expires_at'] = Variable<DateTime>(expiresAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('BackupManifestsCompanion(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('kind: $kind, ')
          ..write('formatVersion: $formatVersion, ')
          ..write('schemaVersion: $schemaVersion, ')
          ..write('storageLocation: $storageLocation, ')
          ..write('checksum: $checksum, ')
          ..write('encryptionJson: $encryptionJson, ')
          ..write('createdAt: $createdAt, ')
          ..write('expiresAt: $expiresAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $AppSettingsTable extends AppSettings
    with TableInfo<$AppSettingsTable, AppSetting> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $AppSettingsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _valuesJsonMeta =
      const VerificationMeta('valuesJson');
  @override
  late final GeneratedColumn<String> valuesJson = GeneratedColumn<String>(
      'values_json', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _versionMeta =
      const VerificationMeta('version');
  @override
  late final GeneratedColumn<String> version = GeneratedColumn<String>(
      'version', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [ownerId, valuesJson, version, createdAt, updatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'settings';
  @override
  VerificationContext validateIntegrity(Insertable<AppSetting> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('values_json')) {
      context.handle(
          _valuesJsonMeta,
          valuesJson.isAcceptableOrUnknown(
              data['values_json']!, _valuesJsonMeta));
    } else if (isInserting) {
      context.missing(_valuesJsonMeta);
    }
    if (data.containsKey('version')) {
      context.handle(_versionMeta,
          version.isAcceptableOrUnknown(data['version']!, _versionMeta));
    } else if (isInserting) {
      context.missing(_versionMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {ownerId};
  @override
  AppSetting map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return AppSetting(
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      valuesJson: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}values_json'])!,
      version: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}version'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
    );
  }

  @override
  $AppSettingsTable createAlias(String alias) {
    return $AppSettingsTable(attachedDatabase, alias);
  }
}

class AppSetting extends DataClass implements Insertable<AppSetting> {
  final String ownerId;
  final String valuesJson;
  final String version;
  final DateTime createdAt;
  final DateTime updatedAt;
  const AppSetting(
      {required this.ownerId,
      required this.valuesJson,
      required this.version,
      required this.createdAt,
      required this.updatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['owner_id'] = Variable<String>(ownerId);
    map['values_json'] = Variable<String>(valuesJson);
    map['version'] = Variable<String>(version);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  AppSettingsCompanion toCompanion(bool nullToAbsent) {
    return AppSettingsCompanion(
      ownerId: Value(ownerId),
      valuesJson: Value(valuesJson),
      version: Value(version),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory AppSetting.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return AppSetting(
      ownerId: serializer.fromJson<String>(json['ownerId']),
      valuesJson: serializer.fromJson<String>(json['valuesJson']),
      version: serializer.fromJson<String>(json['version']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'ownerId': serializer.toJson<String>(ownerId),
      'valuesJson': serializer.toJson<String>(valuesJson),
      'version': serializer.toJson<String>(version),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  AppSetting copyWith(
          {String? ownerId,
          String? valuesJson,
          String? version,
          DateTime? createdAt,
          DateTime? updatedAt}) =>
      AppSetting(
        ownerId: ownerId ?? this.ownerId,
        valuesJson: valuesJson ?? this.valuesJson,
        version: version ?? this.version,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );
  AppSetting copyWithCompanion(AppSettingsCompanion data) {
    return AppSetting(
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      valuesJson:
          data.valuesJson.present ? data.valuesJson.value : this.valuesJson,
      version: data.version.present ? data.version.value : this.version,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('AppSetting(')
          ..write('ownerId: $ownerId, ')
          ..write('valuesJson: $valuesJson, ')
          ..write('version: $version, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(ownerId, valuesJson, version, createdAt, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AppSetting &&
          other.ownerId == this.ownerId &&
          other.valuesJson == this.valuesJson &&
          other.version == this.version &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class AppSettingsCompanion extends UpdateCompanion<AppSetting> {
  final Value<String> ownerId;
  final Value<String> valuesJson;
  final Value<String> version;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const AppSettingsCompanion({
    this.ownerId = const Value.absent(),
    this.valuesJson = const Value.absent(),
    this.version = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  AppSettingsCompanion.insert({
    required String ownerId,
    required String valuesJson,
    required String version,
    required DateTime createdAt,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  })  : ownerId = Value(ownerId),
        valuesJson = Value(valuesJson),
        version = Value(version),
        createdAt = Value(createdAt),
        updatedAt = Value(updatedAt);
  static Insertable<AppSetting> custom({
    Expression<String>? ownerId,
    Expression<String>? valuesJson,
    Expression<String>? version,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (ownerId != null) 'owner_id': ownerId,
      if (valuesJson != null) 'values_json': valuesJson,
      if (version != null) 'version': version,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  AppSettingsCompanion copyWith(
      {Value<String>? ownerId,
      Value<String>? valuesJson,
      Value<String>? version,
      Value<DateTime>? createdAt,
      Value<DateTime>? updatedAt,
      Value<int>? rowid}) {
    return AppSettingsCompanion(
      ownerId: ownerId ?? this.ownerId,
      valuesJson: valuesJson ?? this.valuesJson,
      version: version ?? this.version,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (valuesJson.present) {
      map['values_json'] = Variable<String>(valuesJson.value);
    }
    if (version.present) {
      map['version'] = Variable<String>(version.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('AppSettingsCompanion(')
          ..write('ownerId: $ownerId, ')
          ..write('valuesJson: $valuesJson, ')
          ..write('version: $version, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $TombstonesTable extends Tombstones
    with TableInfo<$TombstonesTable, Tombstone> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $TombstonesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerIdMeta =
      const VerificationMeta('ownerId');
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
      'owner_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _entityTypeMeta =
      const VerificationMeta('entityType');
  @override
  late final GeneratedColumn<String> entityType = GeneratedColumn<String>(
      'entity_type', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _entityIdMeta =
      const VerificationMeta('entityId');
  @override
  late final GeneratedColumn<String> entityId = GeneratedColumn<String>(
      'entity_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _versionMeta =
      const VerificationMeta('version');
  @override
  late final GeneratedColumn<String> version = GeneratedColumn<String>(
      'version', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _deletedAtMeta =
      const VerificationMeta('deletedAt');
  @override
  late final GeneratedColumn<DateTime> deletedAt = GeneratedColumn<DateTime>(
      'deleted_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _retentionUntilMeta =
      const VerificationMeta('retentionUntil');
  @override
  late final GeneratedColumn<DateTime> retentionUntil =
      GeneratedColumn<DateTime>('retention_until', aliasedName, false,
          type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        ownerId,
        entityType,
        entityId,
        version,
        deletedAt,
        retentionUntil,
        createdAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'tombstones';
  @override
  VerificationContext validateIntegrity(Insertable<Tombstone> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(_ownerIdMeta,
          ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta));
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('entity_type')) {
      context.handle(
          _entityTypeMeta,
          entityType.isAcceptableOrUnknown(
              data['entity_type']!, _entityTypeMeta));
    } else if (isInserting) {
      context.missing(_entityTypeMeta);
    }
    if (data.containsKey('entity_id')) {
      context.handle(_entityIdMeta,
          entityId.isAcceptableOrUnknown(data['entity_id']!, _entityIdMeta));
    } else if (isInserting) {
      context.missing(_entityIdMeta);
    }
    if (data.containsKey('version')) {
      context.handle(_versionMeta,
          version.isAcceptableOrUnknown(data['version']!, _versionMeta));
    } else if (isInserting) {
      context.missing(_versionMeta);
    }
    if (data.containsKey('deleted_at')) {
      context.handle(_deletedAtMeta,
          deletedAt.isAcceptableOrUnknown(data['deleted_at']!, _deletedAtMeta));
    } else if (isInserting) {
      context.missing(_deletedAtMeta);
    }
    if (data.containsKey('retention_until')) {
      context.handle(
          _retentionUntilMeta,
          retentionUntil.isAcceptableOrUnknown(
              data['retention_until']!, _retentionUntilMeta));
    } else if (isInserting) {
      context.missing(_retentionUntilMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Tombstone map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Tombstone(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_id'])!,
      entityType: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}entity_type'])!,
      entityId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}entity_id'])!,
      version: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}version'])!,
      deletedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}deleted_at'])!,
      retentionUntil: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime, data['${effectivePrefix}retention_until'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
    );
  }

  @override
  $TombstonesTable createAlias(String alias) {
    return $TombstonesTable(attachedDatabase, alias);
  }
}

class Tombstone extends DataClass implements Insertable<Tombstone> {
  final String id;
  final String ownerId;
  final String entityType;
  final String entityId;
  final String version;
  final DateTime deletedAt;
  final DateTime retentionUntil;
  final DateTime createdAt;
  const Tombstone(
      {required this.id,
      required this.ownerId,
      required this.entityType,
      required this.entityId,
      required this.version,
      required this.deletedAt,
      required this.retentionUntil,
      required this.createdAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_id'] = Variable<String>(ownerId);
    map['entity_type'] = Variable<String>(entityType);
    map['entity_id'] = Variable<String>(entityId);
    map['version'] = Variable<String>(version);
    map['deleted_at'] = Variable<DateTime>(deletedAt);
    map['retention_until'] = Variable<DateTime>(retentionUntil);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  TombstonesCompanion toCompanion(bool nullToAbsent) {
    return TombstonesCompanion(
      id: Value(id),
      ownerId: Value(ownerId),
      entityType: Value(entityType),
      entityId: Value(entityId),
      version: Value(version),
      deletedAt: Value(deletedAt),
      retentionUntil: Value(retentionUntil),
      createdAt: Value(createdAt),
    );
  }

  factory Tombstone.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Tombstone(
      id: serializer.fromJson<String>(json['id']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      entityType: serializer.fromJson<String>(json['entityType']),
      entityId: serializer.fromJson<String>(json['entityId']),
      version: serializer.fromJson<String>(json['version']),
      deletedAt: serializer.fromJson<DateTime>(json['deletedAt']),
      retentionUntil: serializer.fromJson<DateTime>(json['retentionUntil']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerId': serializer.toJson<String>(ownerId),
      'entityType': serializer.toJson<String>(entityType),
      'entityId': serializer.toJson<String>(entityId),
      'version': serializer.toJson<String>(version),
      'deletedAt': serializer.toJson<DateTime>(deletedAt),
      'retentionUntil': serializer.toJson<DateTime>(retentionUntil),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  Tombstone copyWith(
          {String? id,
          String? ownerId,
          String? entityType,
          String? entityId,
          String? version,
          DateTime? deletedAt,
          DateTime? retentionUntil,
          DateTime? createdAt}) =>
      Tombstone(
        id: id ?? this.id,
        ownerId: ownerId ?? this.ownerId,
        entityType: entityType ?? this.entityType,
        entityId: entityId ?? this.entityId,
        version: version ?? this.version,
        deletedAt: deletedAt ?? this.deletedAt,
        retentionUntil: retentionUntil ?? this.retentionUntil,
        createdAt: createdAt ?? this.createdAt,
      );
  Tombstone copyWithCompanion(TombstonesCompanion data) {
    return Tombstone(
      id: data.id.present ? data.id.value : this.id,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      entityType:
          data.entityType.present ? data.entityType.value : this.entityType,
      entityId: data.entityId.present ? data.entityId.value : this.entityId,
      version: data.version.present ? data.version.value : this.version,
      deletedAt: data.deletedAt.present ? data.deletedAt.value : this.deletedAt,
      retentionUntil: data.retentionUntil.present
          ? data.retentionUntil.value
          : this.retentionUntil,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Tombstone(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('version: $version, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('retentionUntil: $retentionUntil, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, ownerId, entityType, entityId, version,
      deletedAt, retentionUntil, createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Tombstone &&
          other.id == this.id &&
          other.ownerId == this.ownerId &&
          other.entityType == this.entityType &&
          other.entityId == this.entityId &&
          other.version == this.version &&
          other.deletedAt == this.deletedAt &&
          other.retentionUntil == this.retentionUntil &&
          other.createdAt == this.createdAt);
}

class TombstonesCompanion extends UpdateCompanion<Tombstone> {
  final Value<String> id;
  final Value<String> ownerId;
  final Value<String> entityType;
  final Value<String> entityId;
  final Value<String> version;
  final Value<DateTime> deletedAt;
  final Value<DateTime> retentionUntil;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const TombstonesCompanion({
    this.id = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.entityType = const Value.absent(),
    this.entityId = const Value.absent(),
    this.version = const Value.absent(),
    this.deletedAt = const Value.absent(),
    this.retentionUntil = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  TombstonesCompanion.insert({
    required String id,
    required String ownerId,
    required String entityType,
    required String entityId,
    required String version,
    required DateTime deletedAt,
    required DateTime retentionUntil,
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerId = Value(ownerId),
        entityType = Value(entityType),
        entityId = Value(entityId),
        version = Value(version),
        deletedAt = Value(deletedAt),
        retentionUntil = Value(retentionUntil),
        createdAt = Value(createdAt);
  static Insertable<Tombstone> custom({
    Expression<String>? id,
    Expression<String>? ownerId,
    Expression<String>? entityType,
    Expression<String>? entityId,
    Expression<String>? version,
    Expression<DateTime>? deletedAt,
    Expression<DateTime>? retentionUntil,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerId != null) 'owner_id': ownerId,
      if (entityType != null) 'entity_type': entityType,
      if (entityId != null) 'entity_id': entityId,
      if (version != null) 'version': version,
      if (deletedAt != null) 'deleted_at': deletedAt,
      if (retentionUntil != null) 'retention_until': retentionUntil,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  TombstonesCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerId,
      Value<String>? entityType,
      Value<String>? entityId,
      Value<String>? version,
      Value<DateTime>? deletedAt,
      Value<DateTime>? retentionUntil,
      Value<DateTime>? createdAt,
      Value<int>? rowid}) {
    return TombstonesCompanion(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      entityType: entityType ?? this.entityType,
      entityId: entityId ?? this.entityId,
      version: version ?? this.version,
      deletedAt: deletedAt ?? this.deletedAt,
      retentionUntil: retentionUntil ?? this.retentionUntil,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (entityType.present) {
      map['entity_type'] = Variable<String>(entityType.value);
    }
    if (entityId.present) {
      map['entity_id'] = Variable<String>(entityId.value);
    }
    if (version.present) {
      map['version'] = Variable<String>(version.value);
    }
    if (deletedAt.present) {
      map['deleted_at'] = Variable<DateTime>(deletedAt.value);
    }
    if (retentionUntil.present) {
      map['retention_until'] = Variable<DateTime>(retentionUntil.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('TombstonesCompanion(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('version: $version, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('retentionUntil: $retentionUntil, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $OwnersTable owners = $OwnersTable(this);
  late final $DevicesTable devices = $DevicesTable(this);
  late final $DevicePairingsTable devicePairings = $DevicePairingsTable(this);
  late final $FocusModesTable focusModes = $FocusModesTable(this);
  late final $FocusSessionsTable focusSessions = $FocusSessionsTable(this);
  late final $ReminderOccurrencesTable reminderOccurrences =
      $ReminderOccurrencesTable(this);
  late final $ReminderTransitionsTable reminderTransitions =
      $ReminderTransitionsTable(this);
  late final $CategoriesTable categories = $CategoriesTable(this);
  late final $CheckInsTable checkIns = $CheckInsTable(this);
  late final $CheckInRevisionsTable checkInRevisions =
      $CheckInRevisionsTable(this);
  late final $TagsTable tags = $TagsTable(this);
  late final $CheckInTagsTable checkInTags = $CheckInTagsTable(this);
  late final $SyncOperationsTable syncOperations = $SyncOperationsTable(this);
  late final $SyncCursorsTable syncCursors = $SyncCursorsTable(this);
  late final $OutboxOperationsTable outboxOperations =
      $OutboxOperationsTable(this);
  late final $SyncFailuresTable syncFailures = $SyncFailuresTable(this);
  late final $ConflictsTable conflicts = $ConflictsTable(this);
  late final $BackupManifestsTable backupManifests =
      $BackupManifestsTable(this);
  late final $AppSettingsTable appSettings = $AppSettingsTable(this);
  late final $TombstonesTable tombstones = $TombstonesTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
        owners,
        devices,
        devicePairings,
        focusModes,
        focusSessions,
        reminderOccurrences,
        reminderTransitions,
        categories,
        checkIns,
        checkInRevisions,
        tags,
        checkInTags,
        syncOperations,
        syncCursors,
        outboxOperations,
        syncFailures,
        conflicts,
        backupManifests,
        appSettings,
        tombstones
      ];
}

typedef $$OwnersTableCreateCompanionBuilder = OwnersCompanion Function({
  required String id,
  required DateTime createdAt,
  required DateTime updatedAt,
  Value<int> rowid,
});
typedef $$OwnersTableUpdateCompanionBuilder = OwnersCompanion Function({
  Value<String> id,
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<int> rowid,
});

class $$OwnersTableFilterComposer
    extends Composer<_$AppDatabase, $OwnersTable> {
  $$OwnersTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));
}

class $$OwnersTableOrderingComposer
    extends Composer<_$AppDatabase, $OwnersTable> {
  $$OwnersTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));
}

class $$OwnersTableAnnotationComposer
    extends Composer<_$AppDatabase, $OwnersTable> {
  $$OwnersTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$OwnersTableTableManager extends RootTableManager<
    _$AppDatabase,
    $OwnersTable,
    Owner,
    $$OwnersTableFilterComposer,
    $$OwnersTableOrderingComposer,
    $$OwnersTableAnnotationComposer,
    $$OwnersTableCreateCompanionBuilder,
    $$OwnersTableUpdateCompanionBuilder,
    (Owner, BaseReferences<_$AppDatabase, $OwnersTable, Owner>),
    Owner,
    PrefetchHooks Function()> {
  $$OwnersTableTableManager(_$AppDatabase db, $OwnersTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OwnersTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OwnersTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OwnersTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              OwnersCompanion(
            id: id,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required DateTime createdAt,
            required DateTime updatedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              OwnersCompanion.insert(
            id: id,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$OwnersTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $OwnersTable,
    Owner,
    $$OwnersTableFilterComposer,
    $$OwnersTableOrderingComposer,
    $$OwnersTableAnnotationComposer,
    $$OwnersTableCreateCompanionBuilder,
    $$OwnersTableUpdateCompanionBuilder,
    (Owner, BaseReferences<_$AppDatabase, $OwnersTable, Owner>),
    Owner,
    PrefetchHooks Function()>;
typedef $$DevicesTableCreateCompanionBuilder = DevicesCompanion Function({
  required String id,
  required String ownerId,
  required String publicKey,
  required String fingerprint,
  required String platform,
  Value<String?> displayName,
  Value<String?> capabilitiesJson,
  Value<bool> isOwnerDevice,
  Value<String> status,
  Value<DateTime?> lastSeenAt,
  Value<DateTime?> revokedAt,
  required DateTime createdAt,
  required DateTime updatedAt,
  Value<int> rowid,
});
typedef $$DevicesTableUpdateCompanionBuilder = DevicesCompanion Function({
  Value<String> id,
  Value<String> ownerId,
  Value<String> publicKey,
  Value<String> fingerprint,
  Value<String> platform,
  Value<String?> displayName,
  Value<String?> capabilitiesJson,
  Value<bool> isOwnerDevice,
  Value<String> status,
  Value<DateTime?> lastSeenAt,
  Value<DateTime?> revokedAt,
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<int> rowid,
});

class $$DevicesTableFilterComposer
    extends Composer<_$AppDatabase, $DevicesTable> {
  $$DevicesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get publicKey => $composableBuilder(
      column: $table.publicKey, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get fingerprint => $composableBuilder(
      column: $table.fingerprint, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get platform => $composableBuilder(
      column: $table.platform, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get displayName => $composableBuilder(
      column: $table.displayName, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get capabilitiesJson => $composableBuilder(
      column: $table.capabilitiesJson,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get isOwnerDevice => $composableBuilder(
      column: $table.isOwnerDevice, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get lastSeenAt => $composableBuilder(
      column: $table.lastSeenAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get revokedAt => $composableBuilder(
      column: $table.revokedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));
}

class $$DevicesTableOrderingComposer
    extends Composer<_$AppDatabase, $DevicesTable> {
  $$DevicesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get publicKey => $composableBuilder(
      column: $table.publicKey, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get fingerprint => $composableBuilder(
      column: $table.fingerprint, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get platform => $composableBuilder(
      column: $table.platform, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get displayName => $composableBuilder(
      column: $table.displayName, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get capabilitiesJson => $composableBuilder(
      column: $table.capabilitiesJson,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get isOwnerDevice => $composableBuilder(
      column: $table.isOwnerDevice,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get lastSeenAt => $composableBuilder(
      column: $table.lastSeenAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get revokedAt => $composableBuilder(
      column: $table.revokedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));
}

class $$DevicesTableAnnotationComposer
    extends Composer<_$AppDatabase, $DevicesTable> {
  $$DevicesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get publicKey =>
      $composableBuilder(column: $table.publicKey, builder: (column) => column);

  GeneratedColumn<String> get fingerprint => $composableBuilder(
      column: $table.fingerprint, builder: (column) => column);

  GeneratedColumn<String> get platform =>
      $composableBuilder(column: $table.platform, builder: (column) => column);

  GeneratedColumn<String> get displayName => $composableBuilder(
      column: $table.displayName, builder: (column) => column);

  GeneratedColumn<String> get capabilitiesJson => $composableBuilder(
      column: $table.capabilitiesJson, builder: (column) => column);

  GeneratedColumn<bool> get isOwnerDevice => $composableBuilder(
      column: $table.isOwnerDevice, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<DateTime> get lastSeenAt => $composableBuilder(
      column: $table.lastSeenAt, builder: (column) => column);

  GeneratedColumn<DateTime> get revokedAt =>
      $composableBuilder(column: $table.revokedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$DevicesTableTableManager extends RootTableManager<
    _$AppDatabase,
    $DevicesTable,
    Device,
    $$DevicesTableFilterComposer,
    $$DevicesTableOrderingComposer,
    $$DevicesTableAnnotationComposer,
    $$DevicesTableCreateCompanionBuilder,
    $$DevicesTableUpdateCompanionBuilder,
    (Device, BaseReferences<_$AppDatabase, $DevicesTable, Device>),
    Device,
    PrefetchHooks Function()> {
  $$DevicesTableTableManager(_$AppDatabase db, $DevicesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DevicesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DevicesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DevicesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String> publicKey = const Value.absent(),
            Value<String> fingerprint = const Value.absent(),
            Value<String> platform = const Value.absent(),
            Value<String?> displayName = const Value.absent(),
            Value<String?> capabilitiesJson = const Value.absent(),
            Value<bool> isOwnerDevice = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<DateTime?> lastSeenAt = const Value.absent(),
            Value<DateTime?> revokedAt = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              DevicesCompanion(
            id: id,
            ownerId: ownerId,
            publicKey: publicKey,
            fingerprint: fingerprint,
            platform: platform,
            displayName: displayName,
            capabilitiesJson: capabilitiesJson,
            isOwnerDevice: isOwnerDevice,
            status: status,
            lastSeenAt: lastSeenAt,
            revokedAt: revokedAt,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerId,
            required String publicKey,
            required String fingerprint,
            required String platform,
            Value<String?> displayName = const Value.absent(),
            Value<String?> capabilitiesJson = const Value.absent(),
            Value<bool> isOwnerDevice = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<DateTime?> lastSeenAt = const Value.absent(),
            Value<DateTime?> revokedAt = const Value.absent(),
            required DateTime createdAt,
            required DateTime updatedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              DevicesCompanion.insert(
            id: id,
            ownerId: ownerId,
            publicKey: publicKey,
            fingerprint: fingerprint,
            platform: platform,
            displayName: displayName,
            capabilitiesJson: capabilitiesJson,
            isOwnerDevice: isOwnerDevice,
            status: status,
            lastSeenAt: lastSeenAt,
            revokedAt: revokedAt,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$DevicesTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $DevicesTable,
    Device,
    $$DevicesTableFilterComposer,
    $$DevicesTableOrderingComposer,
    $$DevicesTableAnnotationComposer,
    $$DevicesTableCreateCompanionBuilder,
    $$DevicesTableUpdateCompanionBuilder,
    (Device, BaseReferences<_$AppDatabase, $DevicesTable, Device>),
    Device,
    PrefetchHooks Function()>;
typedef $$DevicePairingsTableCreateCompanionBuilder = DevicePairingsCompanion
    Function({
  required String id,
  required String ownerId,
  required String candidatePublicKey,
  required String candidateFingerprint,
  required String candidatePlatform,
  Value<String> status,
  Value<String?> approvedByDeviceId,
  required DateTime expiresAt,
  Value<DateTime?> approvedAt,
  Value<DateTime?> consumedAt,
  Value<DateTime?> cancelledAt,
  required DateTime createdAt,
  Value<int> rowid,
});
typedef $$DevicePairingsTableUpdateCompanionBuilder = DevicePairingsCompanion
    Function({
  Value<String> id,
  Value<String> ownerId,
  Value<String> candidatePublicKey,
  Value<String> candidateFingerprint,
  Value<String> candidatePlatform,
  Value<String> status,
  Value<String?> approvedByDeviceId,
  Value<DateTime> expiresAt,
  Value<DateTime?> approvedAt,
  Value<DateTime?> consumedAt,
  Value<DateTime?> cancelledAt,
  Value<DateTime> createdAt,
  Value<int> rowid,
});

class $$DevicePairingsTableFilterComposer
    extends Composer<_$AppDatabase, $DevicePairingsTable> {
  $$DevicePairingsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get candidatePublicKey => $composableBuilder(
      column: $table.candidatePublicKey,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get candidateFingerprint => $composableBuilder(
      column: $table.candidateFingerprint,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get candidatePlatform => $composableBuilder(
      column: $table.candidatePlatform,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get approvedByDeviceId => $composableBuilder(
      column: $table.approvedByDeviceId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get expiresAt => $composableBuilder(
      column: $table.expiresAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get approvedAt => $composableBuilder(
      column: $table.approvedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get consumedAt => $composableBuilder(
      column: $table.consumedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cancelledAt => $composableBuilder(
      column: $table.cancelledAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));
}

class $$DevicePairingsTableOrderingComposer
    extends Composer<_$AppDatabase, $DevicePairingsTable> {
  $$DevicePairingsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get candidatePublicKey => $composableBuilder(
      column: $table.candidatePublicKey,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get candidateFingerprint => $composableBuilder(
      column: $table.candidateFingerprint,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get candidatePlatform => $composableBuilder(
      column: $table.candidatePlatform,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get approvedByDeviceId => $composableBuilder(
      column: $table.approvedByDeviceId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get expiresAt => $composableBuilder(
      column: $table.expiresAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get approvedAt => $composableBuilder(
      column: $table.approvedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get consumedAt => $composableBuilder(
      column: $table.consumedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cancelledAt => $composableBuilder(
      column: $table.cancelledAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$DevicePairingsTableAnnotationComposer
    extends Composer<_$AppDatabase, $DevicePairingsTable> {
  $$DevicePairingsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get candidatePublicKey => $composableBuilder(
      column: $table.candidatePublicKey, builder: (column) => column);

  GeneratedColumn<String> get candidateFingerprint => $composableBuilder(
      column: $table.candidateFingerprint, builder: (column) => column);

  GeneratedColumn<String> get candidatePlatform => $composableBuilder(
      column: $table.candidatePlatform, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get approvedByDeviceId => $composableBuilder(
      column: $table.approvedByDeviceId, builder: (column) => column);

  GeneratedColumn<DateTime> get expiresAt =>
      $composableBuilder(column: $table.expiresAt, builder: (column) => column);

  GeneratedColumn<DateTime> get approvedAt => $composableBuilder(
      column: $table.approvedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get consumedAt => $composableBuilder(
      column: $table.consumedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get cancelledAt => $composableBuilder(
      column: $table.cancelledAt, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$DevicePairingsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $DevicePairingsTable,
    DevicePairing,
    $$DevicePairingsTableFilterComposer,
    $$DevicePairingsTableOrderingComposer,
    $$DevicePairingsTableAnnotationComposer,
    $$DevicePairingsTableCreateCompanionBuilder,
    $$DevicePairingsTableUpdateCompanionBuilder,
    (
      DevicePairing,
      BaseReferences<_$AppDatabase, $DevicePairingsTable, DevicePairing>
    ),
    DevicePairing,
    PrefetchHooks Function()> {
  $$DevicePairingsTableTableManager(
      _$AppDatabase db, $DevicePairingsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DevicePairingsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DevicePairingsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DevicePairingsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String> candidatePublicKey = const Value.absent(),
            Value<String> candidateFingerprint = const Value.absent(),
            Value<String> candidatePlatform = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<String?> approvedByDeviceId = const Value.absent(),
            Value<DateTime> expiresAt = const Value.absent(),
            Value<DateTime?> approvedAt = const Value.absent(),
            Value<DateTime?> consumedAt = const Value.absent(),
            Value<DateTime?> cancelledAt = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              DevicePairingsCompanion(
            id: id,
            ownerId: ownerId,
            candidatePublicKey: candidatePublicKey,
            candidateFingerprint: candidateFingerprint,
            candidatePlatform: candidatePlatform,
            status: status,
            approvedByDeviceId: approvedByDeviceId,
            expiresAt: expiresAt,
            approvedAt: approvedAt,
            consumedAt: consumedAt,
            cancelledAt: cancelledAt,
            createdAt: createdAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerId,
            required String candidatePublicKey,
            required String candidateFingerprint,
            required String candidatePlatform,
            Value<String> status = const Value.absent(),
            Value<String?> approvedByDeviceId = const Value.absent(),
            required DateTime expiresAt,
            Value<DateTime?> approvedAt = const Value.absent(),
            Value<DateTime?> consumedAt = const Value.absent(),
            Value<DateTime?> cancelledAt = const Value.absent(),
            required DateTime createdAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              DevicePairingsCompanion.insert(
            id: id,
            ownerId: ownerId,
            candidatePublicKey: candidatePublicKey,
            candidateFingerprint: candidateFingerprint,
            candidatePlatform: candidatePlatform,
            status: status,
            approvedByDeviceId: approvedByDeviceId,
            expiresAt: expiresAt,
            approvedAt: approvedAt,
            consumedAt: consumedAt,
            cancelledAt: cancelledAt,
            createdAt: createdAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$DevicePairingsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $DevicePairingsTable,
    DevicePairing,
    $$DevicePairingsTableFilterComposer,
    $$DevicePairingsTableOrderingComposer,
    $$DevicePairingsTableAnnotationComposer,
    $$DevicePairingsTableCreateCompanionBuilder,
    $$DevicePairingsTableUpdateCompanionBuilder,
    (
      DevicePairing,
      BaseReferences<_$AppDatabase, $DevicePairingsTable, DevicePairing>
    ),
    DevicePairing,
    PrefetchHooks Function()>;
typedef $$FocusModesTableCreateCompanionBuilder = FocusModesCompanion Function({
  required String id,
  required String ownerId,
  required String name,
  required int intervalMinutes,
  required String policyJson,
  required String version,
  Value<DateTime?> deletedAt,
  required DateTime createdAt,
  required DateTime updatedAt,
  Value<int> rowid,
});
typedef $$FocusModesTableUpdateCompanionBuilder = FocusModesCompanion Function({
  Value<String> id,
  Value<String> ownerId,
  Value<String> name,
  Value<int> intervalMinutes,
  Value<String> policyJson,
  Value<String> version,
  Value<DateTime?> deletedAt,
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<int> rowid,
});

class $$FocusModesTableFilterComposer
    extends Composer<_$AppDatabase, $FocusModesTable> {
  $$FocusModesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get intervalMinutes => $composableBuilder(
      column: $table.intervalMinutes,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get policyJson => $composableBuilder(
      column: $table.policyJson, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));
}

class $$FocusModesTableOrderingComposer
    extends Composer<_$AppDatabase, $FocusModesTable> {
  $$FocusModesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get intervalMinutes => $composableBuilder(
      column: $table.intervalMinutes,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get policyJson => $composableBuilder(
      column: $table.policyJson, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));
}

class $$FocusModesTableAnnotationComposer
    extends Composer<_$AppDatabase, $FocusModesTable> {
  $$FocusModesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<int> get intervalMinutes => $composableBuilder(
      column: $table.intervalMinutes, builder: (column) => column);

  GeneratedColumn<String> get policyJson => $composableBuilder(
      column: $table.policyJson, builder: (column) => column);

  GeneratedColumn<String> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<DateTime> get deletedAt =>
      $composableBuilder(column: $table.deletedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$FocusModesTableTableManager extends RootTableManager<
    _$AppDatabase,
    $FocusModesTable,
    FocusMode,
    $$FocusModesTableFilterComposer,
    $$FocusModesTableOrderingComposer,
    $$FocusModesTableAnnotationComposer,
    $$FocusModesTableCreateCompanionBuilder,
    $$FocusModesTableUpdateCompanionBuilder,
    (FocusMode, BaseReferences<_$AppDatabase, $FocusModesTable, FocusMode>),
    FocusMode,
    PrefetchHooks Function()> {
  $$FocusModesTableTableManager(_$AppDatabase db, $FocusModesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$FocusModesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$FocusModesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$FocusModesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String> name = const Value.absent(),
            Value<int> intervalMinutes = const Value.absent(),
            Value<String> policyJson = const Value.absent(),
            Value<String> version = const Value.absent(),
            Value<DateTime?> deletedAt = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              FocusModesCompanion(
            id: id,
            ownerId: ownerId,
            name: name,
            intervalMinutes: intervalMinutes,
            policyJson: policyJson,
            version: version,
            deletedAt: deletedAt,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerId,
            required String name,
            required int intervalMinutes,
            required String policyJson,
            required String version,
            Value<DateTime?> deletedAt = const Value.absent(),
            required DateTime createdAt,
            required DateTime updatedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              FocusModesCompanion.insert(
            id: id,
            ownerId: ownerId,
            name: name,
            intervalMinutes: intervalMinutes,
            policyJson: policyJson,
            version: version,
            deletedAt: deletedAt,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$FocusModesTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $FocusModesTable,
    FocusMode,
    $$FocusModesTableFilterComposer,
    $$FocusModesTableOrderingComposer,
    $$FocusModesTableAnnotationComposer,
    $$FocusModesTableCreateCompanionBuilder,
    $$FocusModesTableUpdateCompanionBuilder,
    (FocusMode, BaseReferences<_$AppDatabase, $FocusModesTable, FocusMode>),
    FocusMode,
    PrefetchHooks Function()>;
typedef $$FocusSessionsTableCreateCompanionBuilder = FocusSessionsCompanion
    Function({
  required String id,
  required String ownerId,
  required String focusModeId,
  Value<String?> name,
  Value<String> status,
  required String schedulePolicyJson,
  required String timezoneId,
  required DateTime startedAt,
  Value<DateTime?> endedAt,
  required String version,
  Value<DateTime?> deletedAt,
  required DateTime createdAt,
  required DateTime updatedAt,
  Value<int> rowid,
});
typedef $$FocusSessionsTableUpdateCompanionBuilder = FocusSessionsCompanion
    Function({
  Value<String> id,
  Value<String> ownerId,
  Value<String> focusModeId,
  Value<String?> name,
  Value<String> status,
  Value<String> schedulePolicyJson,
  Value<String> timezoneId,
  Value<DateTime> startedAt,
  Value<DateTime?> endedAt,
  Value<String> version,
  Value<DateTime?> deletedAt,
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<int> rowid,
});

class $$FocusSessionsTableFilterComposer
    extends Composer<_$AppDatabase, $FocusSessionsTable> {
  $$FocusSessionsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get focusModeId => $composableBuilder(
      column: $table.focusModeId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get schedulePolicyJson => $composableBuilder(
      column: $table.schedulePolicyJson,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get timezoneId => $composableBuilder(
      column: $table.timezoneId, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get startedAt => $composableBuilder(
      column: $table.startedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get endedAt => $composableBuilder(
      column: $table.endedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));
}

class $$FocusSessionsTableOrderingComposer
    extends Composer<_$AppDatabase, $FocusSessionsTable> {
  $$FocusSessionsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get focusModeId => $composableBuilder(
      column: $table.focusModeId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get schedulePolicyJson => $composableBuilder(
      column: $table.schedulePolicyJson,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get timezoneId => $composableBuilder(
      column: $table.timezoneId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get startedAt => $composableBuilder(
      column: $table.startedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get endedAt => $composableBuilder(
      column: $table.endedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));
}

class $$FocusSessionsTableAnnotationComposer
    extends Composer<_$AppDatabase, $FocusSessionsTable> {
  $$FocusSessionsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get focusModeId => $composableBuilder(
      column: $table.focusModeId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get schedulePolicyJson => $composableBuilder(
      column: $table.schedulePolicyJson, builder: (column) => column);

  GeneratedColumn<String> get timezoneId => $composableBuilder(
      column: $table.timezoneId, builder: (column) => column);

  GeneratedColumn<DateTime> get startedAt =>
      $composableBuilder(column: $table.startedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get endedAt =>
      $composableBuilder(column: $table.endedAt, builder: (column) => column);

  GeneratedColumn<String> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<DateTime> get deletedAt =>
      $composableBuilder(column: $table.deletedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$FocusSessionsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $FocusSessionsTable,
    FocusSession,
    $$FocusSessionsTableFilterComposer,
    $$FocusSessionsTableOrderingComposer,
    $$FocusSessionsTableAnnotationComposer,
    $$FocusSessionsTableCreateCompanionBuilder,
    $$FocusSessionsTableUpdateCompanionBuilder,
    (
      FocusSession,
      BaseReferences<_$AppDatabase, $FocusSessionsTable, FocusSession>
    ),
    FocusSession,
    PrefetchHooks Function()> {
  $$FocusSessionsTableTableManager(_$AppDatabase db, $FocusSessionsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$FocusSessionsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$FocusSessionsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$FocusSessionsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String> focusModeId = const Value.absent(),
            Value<String?> name = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<String> schedulePolicyJson = const Value.absent(),
            Value<String> timezoneId = const Value.absent(),
            Value<DateTime> startedAt = const Value.absent(),
            Value<DateTime?> endedAt = const Value.absent(),
            Value<String> version = const Value.absent(),
            Value<DateTime?> deletedAt = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              FocusSessionsCompanion(
            id: id,
            ownerId: ownerId,
            focusModeId: focusModeId,
            name: name,
            status: status,
            schedulePolicyJson: schedulePolicyJson,
            timezoneId: timezoneId,
            startedAt: startedAt,
            endedAt: endedAt,
            version: version,
            deletedAt: deletedAt,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerId,
            required String focusModeId,
            Value<String?> name = const Value.absent(),
            Value<String> status = const Value.absent(),
            required String schedulePolicyJson,
            required String timezoneId,
            required DateTime startedAt,
            Value<DateTime?> endedAt = const Value.absent(),
            required String version,
            Value<DateTime?> deletedAt = const Value.absent(),
            required DateTime createdAt,
            required DateTime updatedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              FocusSessionsCompanion.insert(
            id: id,
            ownerId: ownerId,
            focusModeId: focusModeId,
            name: name,
            status: status,
            schedulePolicyJson: schedulePolicyJson,
            timezoneId: timezoneId,
            startedAt: startedAt,
            endedAt: endedAt,
            version: version,
            deletedAt: deletedAt,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$FocusSessionsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $FocusSessionsTable,
    FocusSession,
    $$FocusSessionsTableFilterComposer,
    $$FocusSessionsTableOrderingComposer,
    $$FocusSessionsTableAnnotationComposer,
    $$FocusSessionsTableCreateCompanionBuilder,
    $$FocusSessionsTableUpdateCompanionBuilder,
    (
      FocusSession,
      BaseReferences<_$AppDatabase, $FocusSessionsTable, FocusSession>
    ),
    FocusSession,
    PrefetchHooks Function()>;
typedef $$ReminderOccurrencesTableCreateCompanionBuilder
    = ReminderOccurrencesCompanion Function({
  required String id,
  required String ownerId,
  required String focusSessionId,
  Value<String> state,
  required DateTime scheduledAt,
  required DateTime originalScheduledAt,
  Value<DateTime?> presentedAt,
  Value<DateTime?> resolvedAt,
  required String timezoneId,
  required String policySnapshotJson,
  required String version,
  required DateTime createdAt,
  required DateTime updatedAt,
  Value<int> rowid,
});
typedef $$ReminderOccurrencesTableUpdateCompanionBuilder
    = ReminderOccurrencesCompanion Function({
  Value<String> id,
  Value<String> ownerId,
  Value<String> focusSessionId,
  Value<String> state,
  Value<DateTime> scheduledAt,
  Value<DateTime> originalScheduledAt,
  Value<DateTime?> presentedAt,
  Value<DateTime?> resolvedAt,
  Value<String> timezoneId,
  Value<String> policySnapshotJson,
  Value<String> version,
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<int> rowid,
});

class $$ReminderOccurrencesTableFilterComposer
    extends Composer<_$AppDatabase, $ReminderOccurrencesTable> {
  $$ReminderOccurrencesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get focusSessionId => $composableBuilder(
      column: $table.focusSessionId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get state => $composableBuilder(
      column: $table.state, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get scheduledAt => $composableBuilder(
      column: $table.scheduledAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get originalScheduledAt => $composableBuilder(
      column: $table.originalScheduledAt,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get presentedAt => $composableBuilder(
      column: $table.presentedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get resolvedAt => $composableBuilder(
      column: $table.resolvedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get timezoneId => $composableBuilder(
      column: $table.timezoneId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get policySnapshotJson => $composableBuilder(
      column: $table.policySnapshotJson,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));
}

class $$ReminderOccurrencesTableOrderingComposer
    extends Composer<_$AppDatabase, $ReminderOccurrencesTable> {
  $$ReminderOccurrencesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get focusSessionId => $composableBuilder(
      column: $table.focusSessionId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get state => $composableBuilder(
      column: $table.state, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get scheduledAt => $composableBuilder(
      column: $table.scheduledAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get originalScheduledAt => $composableBuilder(
      column: $table.originalScheduledAt,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get presentedAt => $composableBuilder(
      column: $table.presentedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get resolvedAt => $composableBuilder(
      column: $table.resolvedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get timezoneId => $composableBuilder(
      column: $table.timezoneId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get policySnapshotJson => $composableBuilder(
      column: $table.policySnapshotJson,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));
}

class $$ReminderOccurrencesTableAnnotationComposer
    extends Composer<_$AppDatabase, $ReminderOccurrencesTable> {
  $$ReminderOccurrencesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get focusSessionId => $composableBuilder(
      column: $table.focusSessionId, builder: (column) => column);

  GeneratedColumn<String> get state =>
      $composableBuilder(column: $table.state, builder: (column) => column);

  GeneratedColumn<DateTime> get scheduledAt => $composableBuilder(
      column: $table.scheduledAt, builder: (column) => column);

  GeneratedColumn<DateTime> get originalScheduledAt => $composableBuilder(
      column: $table.originalScheduledAt, builder: (column) => column);

  GeneratedColumn<DateTime> get presentedAt => $composableBuilder(
      column: $table.presentedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get resolvedAt => $composableBuilder(
      column: $table.resolvedAt, builder: (column) => column);

  GeneratedColumn<String> get timezoneId => $composableBuilder(
      column: $table.timezoneId, builder: (column) => column);

  GeneratedColumn<String> get policySnapshotJson => $composableBuilder(
      column: $table.policySnapshotJson, builder: (column) => column);

  GeneratedColumn<String> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$ReminderOccurrencesTableTableManager extends RootTableManager<
    _$AppDatabase,
    $ReminderOccurrencesTable,
    ReminderOccurrence,
    $$ReminderOccurrencesTableFilterComposer,
    $$ReminderOccurrencesTableOrderingComposer,
    $$ReminderOccurrencesTableAnnotationComposer,
    $$ReminderOccurrencesTableCreateCompanionBuilder,
    $$ReminderOccurrencesTableUpdateCompanionBuilder,
    (
      ReminderOccurrence,
      BaseReferences<_$AppDatabase, $ReminderOccurrencesTable,
          ReminderOccurrence>
    ),
    ReminderOccurrence,
    PrefetchHooks Function()> {
  $$ReminderOccurrencesTableTableManager(
      _$AppDatabase db, $ReminderOccurrencesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ReminderOccurrencesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ReminderOccurrencesTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ReminderOccurrencesTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String> focusSessionId = const Value.absent(),
            Value<String> state = const Value.absent(),
            Value<DateTime> scheduledAt = const Value.absent(),
            Value<DateTime> originalScheduledAt = const Value.absent(),
            Value<DateTime?> presentedAt = const Value.absent(),
            Value<DateTime?> resolvedAt = const Value.absent(),
            Value<String> timezoneId = const Value.absent(),
            Value<String> policySnapshotJson = const Value.absent(),
            Value<String> version = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              ReminderOccurrencesCompanion(
            id: id,
            ownerId: ownerId,
            focusSessionId: focusSessionId,
            state: state,
            scheduledAt: scheduledAt,
            originalScheduledAt: originalScheduledAt,
            presentedAt: presentedAt,
            resolvedAt: resolvedAt,
            timezoneId: timezoneId,
            policySnapshotJson: policySnapshotJson,
            version: version,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerId,
            required String focusSessionId,
            Value<String> state = const Value.absent(),
            required DateTime scheduledAt,
            required DateTime originalScheduledAt,
            Value<DateTime?> presentedAt = const Value.absent(),
            Value<DateTime?> resolvedAt = const Value.absent(),
            required String timezoneId,
            required String policySnapshotJson,
            required String version,
            required DateTime createdAt,
            required DateTime updatedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              ReminderOccurrencesCompanion.insert(
            id: id,
            ownerId: ownerId,
            focusSessionId: focusSessionId,
            state: state,
            scheduledAt: scheduledAt,
            originalScheduledAt: originalScheduledAt,
            presentedAt: presentedAt,
            resolvedAt: resolvedAt,
            timezoneId: timezoneId,
            policySnapshotJson: policySnapshotJson,
            version: version,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$ReminderOccurrencesTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $ReminderOccurrencesTable,
    ReminderOccurrence,
    $$ReminderOccurrencesTableFilterComposer,
    $$ReminderOccurrencesTableOrderingComposer,
    $$ReminderOccurrencesTableAnnotationComposer,
    $$ReminderOccurrencesTableCreateCompanionBuilder,
    $$ReminderOccurrencesTableUpdateCompanionBuilder,
    (
      ReminderOccurrence,
      BaseReferences<_$AppDatabase, $ReminderOccurrencesTable,
          ReminderOccurrence>
    ),
    ReminderOccurrence,
    PrefetchHooks Function()>;
typedef $$ReminderTransitionsTableCreateCompanionBuilder
    = ReminderTransitionsCompanion Function({
  required String id,
  required String ownerId,
  required String reminderOccurrenceId,
  Value<String?> actingDeviceId,
  required String fromState,
  required String toState,
  Value<String?> reason,
  required DateTime originalScheduledAt,
  required DateTime occurredAt,
  required String operationId,
  required DateTime createdAt,
  Value<int> rowid,
});
typedef $$ReminderTransitionsTableUpdateCompanionBuilder
    = ReminderTransitionsCompanion Function({
  Value<String> id,
  Value<String> ownerId,
  Value<String> reminderOccurrenceId,
  Value<String?> actingDeviceId,
  Value<String> fromState,
  Value<String> toState,
  Value<String?> reason,
  Value<DateTime> originalScheduledAt,
  Value<DateTime> occurredAt,
  Value<String> operationId,
  Value<DateTime> createdAt,
  Value<int> rowid,
});

class $$ReminderTransitionsTableFilterComposer
    extends Composer<_$AppDatabase, $ReminderTransitionsTable> {
  $$ReminderTransitionsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get reminderOccurrenceId => $composableBuilder(
      column: $table.reminderOccurrenceId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get actingDeviceId => $composableBuilder(
      column: $table.actingDeviceId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get fromState => $composableBuilder(
      column: $table.fromState, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get toState => $composableBuilder(
      column: $table.toState, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get reason => $composableBuilder(
      column: $table.reason, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get originalScheduledAt => $composableBuilder(
      column: $table.originalScheduledAt,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get occurredAt => $composableBuilder(
      column: $table.occurredAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));
}

class $$ReminderTransitionsTableOrderingComposer
    extends Composer<_$AppDatabase, $ReminderTransitionsTable> {
  $$ReminderTransitionsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get reminderOccurrenceId => $composableBuilder(
      column: $table.reminderOccurrenceId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get actingDeviceId => $composableBuilder(
      column: $table.actingDeviceId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get fromState => $composableBuilder(
      column: $table.fromState, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get toState => $composableBuilder(
      column: $table.toState, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get reason => $composableBuilder(
      column: $table.reason, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get originalScheduledAt => $composableBuilder(
      column: $table.originalScheduledAt,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get occurredAt => $composableBuilder(
      column: $table.occurredAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$ReminderTransitionsTableAnnotationComposer
    extends Composer<_$AppDatabase, $ReminderTransitionsTable> {
  $$ReminderTransitionsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get reminderOccurrenceId => $composableBuilder(
      column: $table.reminderOccurrenceId, builder: (column) => column);

  GeneratedColumn<String> get actingDeviceId => $composableBuilder(
      column: $table.actingDeviceId, builder: (column) => column);

  GeneratedColumn<String> get fromState =>
      $composableBuilder(column: $table.fromState, builder: (column) => column);

  GeneratedColumn<String> get toState =>
      $composableBuilder(column: $table.toState, builder: (column) => column);

  GeneratedColumn<String> get reason =>
      $composableBuilder(column: $table.reason, builder: (column) => column);

  GeneratedColumn<DateTime> get originalScheduledAt => $composableBuilder(
      column: $table.originalScheduledAt, builder: (column) => column);

  GeneratedColumn<DateTime> get occurredAt => $composableBuilder(
      column: $table.occurredAt, builder: (column) => column);

  GeneratedColumn<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$ReminderTransitionsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $ReminderTransitionsTable,
    ReminderTransition,
    $$ReminderTransitionsTableFilterComposer,
    $$ReminderTransitionsTableOrderingComposer,
    $$ReminderTransitionsTableAnnotationComposer,
    $$ReminderTransitionsTableCreateCompanionBuilder,
    $$ReminderTransitionsTableUpdateCompanionBuilder,
    (
      ReminderTransition,
      BaseReferences<_$AppDatabase, $ReminderTransitionsTable,
          ReminderTransition>
    ),
    ReminderTransition,
    PrefetchHooks Function()> {
  $$ReminderTransitionsTableTableManager(
      _$AppDatabase db, $ReminderTransitionsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ReminderTransitionsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ReminderTransitionsTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ReminderTransitionsTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String> reminderOccurrenceId = const Value.absent(),
            Value<String?> actingDeviceId = const Value.absent(),
            Value<String> fromState = const Value.absent(),
            Value<String> toState = const Value.absent(),
            Value<String?> reason = const Value.absent(),
            Value<DateTime> originalScheduledAt = const Value.absent(),
            Value<DateTime> occurredAt = const Value.absent(),
            Value<String> operationId = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              ReminderTransitionsCompanion(
            id: id,
            ownerId: ownerId,
            reminderOccurrenceId: reminderOccurrenceId,
            actingDeviceId: actingDeviceId,
            fromState: fromState,
            toState: toState,
            reason: reason,
            originalScheduledAt: originalScheduledAt,
            occurredAt: occurredAt,
            operationId: operationId,
            createdAt: createdAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerId,
            required String reminderOccurrenceId,
            Value<String?> actingDeviceId = const Value.absent(),
            required String fromState,
            required String toState,
            Value<String?> reason = const Value.absent(),
            required DateTime originalScheduledAt,
            required DateTime occurredAt,
            required String operationId,
            required DateTime createdAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              ReminderTransitionsCompanion.insert(
            id: id,
            ownerId: ownerId,
            reminderOccurrenceId: reminderOccurrenceId,
            actingDeviceId: actingDeviceId,
            fromState: fromState,
            toState: toState,
            reason: reason,
            originalScheduledAt: originalScheduledAt,
            occurredAt: occurredAt,
            operationId: operationId,
            createdAt: createdAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$ReminderTransitionsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $ReminderTransitionsTable,
    ReminderTransition,
    $$ReminderTransitionsTableFilterComposer,
    $$ReminderTransitionsTableOrderingComposer,
    $$ReminderTransitionsTableAnnotationComposer,
    $$ReminderTransitionsTableCreateCompanionBuilder,
    $$ReminderTransitionsTableUpdateCompanionBuilder,
    (
      ReminderTransition,
      BaseReferences<_$AppDatabase, $ReminderTransitionsTable,
          ReminderTransition>
    ),
    ReminderTransition,
    PrefetchHooks Function()>;
typedef $$CategoriesTableCreateCompanionBuilder = CategoriesCompanion Function({
  required String id,
  required String ownerId,
  required String name,
  Value<String?> color,
  required String version,
  Value<DateTime?> deletedAt,
  required DateTime createdAt,
  required DateTime updatedAt,
  Value<int> rowid,
});
typedef $$CategoriesTableUpdateCompanionBuilder = CategoriesCompanion Function({
  Value<String> id,
  Value<String> ownerId,
  Value<String> name,
  Value<String?> color,
  Value<String> version,
  Value<DateTime?> deletedAt,
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<int> rowid,
});

class $$CategoriesTableFilterComposer
    extends Composer<_$AppDatabase, $CategoriesTable> {
  $$CategoriesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get color => $composableBuilder(
      column: $table.color, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));
}

class $$CategoriesTableOrderingComposer
    extends Composer<_$AppDatabase, $CategoriesTable> {
  $$CategoriesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get color => $composableBuilder(
      column: $table.color, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));
}

class $$CategoriesTableAnnotationComposer
    extends Composer<_$AppDatabase, $CategoriesTable> {
  $$CategoriesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get color =>
      $composableBuilder(column: $table.color, builder: (column) => column);

  GeneratedColumn<String> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<DateTime> get deletedAt =>
      $composableBuilder(column: $table.deletedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$CategoriesTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CategoriesTable,
    Category,
    $$CategoriesTableFilterComposer,
    $$CategoriesTableOrderingComposer,
    $$CategoriesTableAnnotationComposer,
    $$CategoriesTableCreateCompanionBuilder,
    $$CategoriesTableUpdateCompanionBuilder,
    (Category, BaseReferences<_$AppDatabase, $CategoriesTable, Category>),
    Category,
    PrefetchHooks Function()> {
  $$CategoriesTableTableManager(_$AppDatabase db, $CategoriesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CategoriesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CategoriesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CategoriesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String> name = const Value.absent(),
            Value<String?> color = const Value.absent(),
            Value<String> version = const Value.absent(),
            Value<DateTime?> deletedAt = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CategoriesCompanion(
            id: id,
            ownerId: ownerId,
            name: name,
            color: color,
            version: version,
            deletedAt: deletedAt,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerId,
            required String name,
            Value<String?> color = const Value.absent(),
            required String version,
            Value<DateTime?> deletedAt = const Value.absent(),
            required DateTime createdAt,
            required DateTime updatedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              CategoriesCompanion.insert(
            id: id,
            ownerId: ownerId,
            name: name,
            color: color,
            version: version,
            deletedAt: deletedAt,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CategoriesTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CategoriesTable,
    Category,
    $$CategoriesTableFilterComposer,
    $$CategoriesTableOrderingComposer,
    $$CategoriesTableAnnotationComposer,
    $$CategoriesTableCreateCompanionBuilder,
    $$CategoriesTableUpdateCompanionBuilder,
    (Category, BaseReferences<_$AppDatabase, $CategoriesTable, Category>),
    Category,
    PrefetchHooks Function()>;
typedef $$CheckInsTableCreateCompanionBuilder = CheckInsCompanion Function({
  required String id,
  required String ownerId,
  Value<String?> reminderOccurrenceId,
  Value<String?> focusSessionId,
  Value<String?> categoryId,
  Value<String?> currentRevisionId,
  required DateTime submittedAt,
  required String timezoneId,
  required String version,
  Value<DateTime?> deletedAt,
  required DateTime createdAt,
  required DateTime updatedAt,
  Value<int> rowid,
});
typedef $$CheckInsTableUpdateCompanionBuilder = CheckInsCompanion Function({
  Value<String> id,
  Value<String> ownerId,
  Value<String?> reminderOccurrenceId,
  Value<String?> focusSessionId,
  Value<String?> categoryId,
  Value<String?> currentRevisionId,
  Value<DateTime> submittedAt,
  Value<String> timezoneId,
  Value<String> version,
  Value<DateTime?> deletedAt,
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<int> rowid,
});

class $$CheckInsTableFilterComposer
    extends Composer<_$AppDatabase, $CheckInsTable> {
  $$CheckInsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get reminderOccurrenceId => $composableBuilder(
      column: $table.reminderOccurrenceId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get focusSessionId => $composableBuilder(
      column: $table.focusSessionId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get categoryId => $composableBuilder(
      column: $table.categoryId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get currentRevisionId => $composableBuilder(
      column: $table.currentRevisionId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get submittedAt => $composableBuilder(
      column: $table.submittedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get timezoneId => $composableBuilder(
      column: $table.timezoneId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));
}

class $$CheckInsTableOrderingComposer
    extends Composer<_$AppDatabase, $CheckInsTable> {
  $$CheckInsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get reminderOccurrenceId => $composableBuilder(
      column: $table.reminderOccurrenceId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get focusSessionId => $composableBuilder(
      column: $table.focusSessionId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get categoryId => $composableBuilder(
      column: $table.categoryId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get currentRevisionId => $composableBuilder(
      column: $table.currentRevisionId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get submittedAt => $composableBuilder(
      column: $table.submittedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get timezoneId => $composableBuilder(
      column: $table.timezoneId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));
}

class $$CheckInsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CheckInsTable> {
  $$CheckInsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get reminderOccurrenceId => $composableBuilder(
      column: $table.reminderOccurrenceId, builder: (column) => column);

  GeneratedColumn<String> get focusSessionId => $composableBuilder(
      column: $table.focusSessionId, builder: (column) => column);

  GeneratedColumn<String> get categoryId => $composableBuilder(
      column: $table.categoryId, builder: (column) => column);

  GeneratedColumn<String> get currentRevisionId => $composableBuilder(
      column: $table.currentRevisionId, builder: (column) => column);

  GeneratedColumn<DateTime> get submittedAt => $composableBuilder(
      column: $table.submittedAt, builder: (column) => column);

  GeneratedColumn<String> get timezoneId => $composableBuilder(
      column: $table.timezoneId, builder: (column) => column);

  GeneratedColumn<String> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<DateTime> get deletedAt =>
      $composableBuilder(column: $table.deletedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$CheckInsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CheckInsTable,
    CheckIn,
    $$CheckInsTableFilterComposer,
    $$CheckInsTableOrderingComposer,
    $$CheckInsTableAnnotationComposer,
    $$CheckInsTableCreateCompanionBuilder,
    $$CheckInsTableUpdateCompanionBuilder,
    (CheckIn, BaseReferences<_$AppDatabase, $CheckInsTable, CheckIn>),
    CheckIn,
    PrefetchHooks Function()> {
  $$CheckInsTableTableManager(_$AppDatabase db, $CheckInsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CheckInsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CheckInsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CheckInsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String?> reminderOccurrenceId = const Value.absent(),
            Value<String?> focusSessionId = const Value.absent(),
            Value<String?> categoryId = const Value.absent(),
            Value<String?> currentRevisionId = const Value.absent(),
            Value<DateTime> submittedAt = const Value.absent(),
            Value<String> timezoneId = const Value.absent(),
            Value<String> version = const Value.absent(),
            Value<DateTime?> deletedAt = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CheckInsCompanion(
            id: id,
            ownerId: ownerId,
            reminderOccurrenceId: reminderOccurrenceId,
            focusSessionId: focusSessionId,
            categoryId: categoryId,
            currentRevisionId: currentRevisionId,
            submittedAt: submittedAt,
            timezoneId: timezoneId,
            version: version,
            deletedAt: deletedAt,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerId,
            Value<String?> reminderOccurrenceId = const Value.absent(),
            Value<String?> focusSessionId = const Value.absent(),
            Value<String?> categoryId = const Value.absent(),
            Value<String?> currentRevisionId = const Value.absent(),
            required DateTime submittedAt,
            required String timezoneId,
            required String version,
            Value<DateTime?> deletedAt = const Value.absent(),
            required DateTime createdAt,
            required DateTime updatedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              CheckInsCompanion.insert(
            id: id,
            ownerId: ownerId,
            reminderOccurrenceId: reminderOccurrenceId,
            focusSessionId: focusSessionId,
            categoryId: categoryId,
            currentRevisionId: currentRevisionId,
            submittedAt: submittedAt,
            timezoneId: timezoneId,
            version: version,
            deletedAt: deletedAt,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CheckInsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CheckInsTable,
    CheckIn,
    $$CheckInsTableFilterComposer,
    $$CheckInsTableOrderingComposer,
    $$CheckInsTableAnnotationComposer,
    $$CheckInsTableCreateCompanionBuilder,
    $$CheckInsTableUpdateCompanionBuilder,
    (CheckIn, BaseReferences<_$AppDatabase, $CheckInsTable, CheckIn>),
    CheckIn,
    PrefetchHooks Function()>;
typedef $$CheckInRevisionsTableCreateCompanionBuilder
    = CheckInRevisionsCompanion Function({
  required String id,
  required String checkInId,
  Value<String?> parentRevisionId,
  required String body,
  Value<String?> authorDeviceId,
  required String operationId,
  required DateTime createdAt,
  Value<DateTime?> deletedAt,
  Value<int> rowid,
});
typedef $$CheckInRevisionsTableUpdateCompanionBuilder
    = CheckInRevisionsCompanion Function({
  Value<String> id,
  Value<String> checkInId,
  Value<String?> parentRevisionId,
  Value<String> body,
  Value<String?> authorDeviceId,
  Value<String> operationId,
  Value<DateTime> createdAt,
  Value<DateTime?> deletedAt,
  Value<int> rowid,
});

class $$CheckInRevisionsTableFilterComposer
    extends Composer<_$AppDatabase, $CheckInRevisionsTable> {
  $$CheckInRevisionsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get checkInId => $composableBuilder(
      column: $table.checkInId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get parentRevisionId => $composableBuilder(
      column: $table.parentRevisionId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get body => $composableBuilder(
      column: $table.body, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get authorDeviceId => $composableBuilder(
      column: $table.authorDeviceId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnFilters(column));
}

class $$CheckInRevisionsTableOrderingComposer
    extends Composer<_$AppDatabase, $CheckInRevisionsTable> {
  $$CheckInRevisionsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get checkInId => $composableBuilder(
      column: $table.checkInId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get parentRevisionId => $composableBuilder(
      column: $table.parentRevisionId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get body => $composableBuilder(
      column: $table.body, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get authorDeviceId => $composableBuilder(
      column: $table.authorDeviceId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnOrderings(column));
}

class $$CheckInRevisionsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CheckInRevisionsTable> {
  $$CheckInRevisionsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get checkInId =>
      $composableBuilder(column: $table.checkInId, builder: (column) => column);

  GeneratedColumn<String> get parentRevisionId => $composableBuilder(
      column: $table.parentRevisionId, builder: (column) => column);

  GeneratedColumn<String> get body =>
      $composableBuilder(column: $table.body, builder: (column) => column);

  GeneratedColumn<String> get authorDeviceId => $composableBuilder(
      column: $table.authorDeviceId, builder: (column) => column);

  GeneratedColumn<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get deletedAt =>
      $composableBuilder(column: $table.deletedAt, builder: (column) => column);
}

class $$CheckInRevisionsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CheckInRevisionsTable,
    CheckInRevision,
    $$CheckInRevisionsTableFilterComposer,
    $$CheckInRevisionsTableOrderingComposer,
    $$CheckInRevisionsTableAnnotationComposer,
    $$CheckInRevisionsTableCreateCompanionBuilder,
    $$CheckInRevisionsTableUpdateCompanionBuilder,
    (
      CheckInRevision,
      BaseReferences<_$AppDatabase, $CheckInRevisionsTable, CheckInRevision>
    ),
    CheckInRevision,
    PrefetchHooks Function()> {
  $$CheckInRevisionsTableTableManager(
      _$AppDatabase db, $CheckInRevisionsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CheckInRevisionsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CheckInRevisionsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CheckInRevisionsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> checkInId = const Value.absent(),
            Value<String?> parentRevisionId = const Value.absent(),
            Value<String> body = const Value.absent(),
            Value<String?> authorDeviceId = const Value.absent(),
            Value<String> operationId = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime?> deletedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CheckInRevisionsCompanion(
            id: id,
            checkInId: checkInId,
            parentRevisionId: parentRevisionId,
            body: body,
            authorDeviceId: authorDeviceId,
            operationId: operationId,
            createdAt: createdAt,
            deletedAt: deletedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String checkInId,
            Value<String?> parentRevisionId = const Value.absent(),
            required String body,
            Value<String?> authorDeviceId = const Value.absent(),
            required String operationId,
            required DateTime createdAt,
            Value<DateTime?> deletedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CheckInRevisionsCompanion.insert(
            id: id,
            checkInId: checkInId,
            parentRevisionId: parentRevisionId,
            body: body,
            authorDeviceId: authorDeviceId,
            operationId: operationId,
            createdAt: createdAt,
            deletedAt: deletedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CheckInRevisionsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CheckInRevisionsTable,
    CheckInRevision,
    $$CheckInRevisionsTableFilterComposer,
    $$CheckInRevisionsTableOrderingComposer,
    $$CheckInRevisionsTableAnnotationComposer,
    $$CheckInRevisionsTableCreateCompanionBuilder,
    $$CheckInRevisionsTableUpdateCompanionBuilder,
    (
      CheckInRevision,
      BaseReferences<_$AppDatabase, $CheckInRevisionsTable, CheckInRevision>
    ),
    CheckInRevision,
    PrefetchHooks Function()>;
typedef $$TagsTableCreateCompanionBuilder = TagsCompanion Function({
  required String id,
  required String ownerId,
  required String name,
  Value<String?> color,
  required String version,
  Value<DateTime?> deletedAt,
  required DateTime createdAt,
  required DateTime updatedAt,
  Value<int> rowid,
});
typedef $$TagsTableUpdateCompanionBuilder = TagsCompanion Function({
  Value<String> id,
  Value<String> ownerId,
  Value<String> name,
  Value<String?> color,
  Value<String> version,
  Value<DateTime?> deletedAt,
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<int> rowid,
});

class $$TagsTableFilterComposer extends Composer<_$AppDatabase, $TagsTable> {
  $$TagsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get color => $composableBuilder(
      column: $table.color, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));
}

class $$TagsTableOrderingComposer extends Composer<_$AppDatabase, $TagsTable> {
  $$TagsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get color => $composableBuilder(
      column: $table.color, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));
}

class $$TagsTableAnnotationComposer
    extends Composer<_$AppDatabase, $TagsTable> {
  $$TagsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get color =>
      $composableBuilder(column: $table.color, builder: (column) => column);

  GeneratedColumn<String> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<DateTime> get deletedAt =>
      $composableBuilder(column: $table.deletedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$TagsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $TagsTable,
    Tag,
    $$TagsTableFilterComposer,
    $$TagsTableOrderingComposer,
    $$TagsTableAnnotationComposer,
    $$TagsTableCreateCompanionBuilder,
    $$TagsTableUpdateCompanionBuilder,
    (Tag, BaseReferences<_$AppDatabase, $TagsTable, Tag>),
    Tag,
    PrefetchHooks Function()> {
  $$TagsTableTableManager(_$AppDatabase db, $TagsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$TagsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$TagsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$TagsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String> name = const Value.absent(),
            Value<String?> color = const Value.absent(),
            Value<String> version = const Value.absent(),
            Value<DateTime?> deletedAt = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              TagsCompanion(
            id: id,
            ownerId: ownerId,
            name: name,
            color: color,
            version: version,
            deletedAt: deletedAt,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerId,
            required String name,
            Value<String?> color = const Value.absent(),
            required String version,
            Value<DateTime?> deletedAt = const Value.absent(),
            required DateTime createdAt,
            required DateTime updatedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              TagsCompanion.insert(
            id: id,
            ownerId: ownerId,
            name: name,
            color: color,
            version: version,
            deletedAt: deletedAt,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$TagsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $TagsTable,
    Tag,
    $$TagsTableFilterComposer,
    $$TagsTableOrderingComposer,
    $$TagsTableAnnotationComposer,
    $$TagsTableCreateCompanionBuilder,
    $$TagsTableUpdateCompanionBuilder,
    (Tag, BaseReferences<_$AppDatabase, $TagsTable, Tag>),
    Tag,
    PrefetchHooks Function()>;
typedef $$CheckInTagsTableCreateCompanionBuilder = CheckInTagsCompanion
    Function({
  required String checkInId,
  required String tagId,
  Value<int> rowid,
});
typedef $$CheckInTagsTableUpdateCompanionBuilder = CheckInTagsCompanion
    Function({
  Value<String> checkInId,
  Value<String> tagId,
  Value<int> rowid,
});

class $$CheckInTagsTableFilterComposer
    extends Composer<_$AppDatabase, $CheckInTagsTable> {
  $$CheckInTagsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get checkInId => $composableBuilder(
      column: $table.checkInId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get tagId => $composableBuilder(
      column: $table.tagId, builder: (column) => ColumnFilters(column));
}

class $$CheckInTagsTableOrderingComposer
    extends Composer<_$AppDatabase, $CheckInTagsTable> {
  $$CheckInTagsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get checkInId => $composableBuilder(
      column: $table.checkInId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get tagId => $composableBuilder(
      column: $table.tagId, builder: (column) => ColumnOrderings(column));
}

class $$CheckInTagsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CheckInTagsTable> {
  $$CheckInTagsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get checkInId =>
      $composableBuilder(column: $table.checkInId, builder: (column) => column);

  GeneratedColumn<String> get tagId =>
      $composableBuilder(column: $table.tagId, builder: (column) => column);
}

class $$CheckInTagsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CheckInTagsTable,
    CheckInTag,
    $$CheckInTagsTableFilterComposer,
    $$CheckInTagsTableOrderingComposer,
    $$CheckInTagsTableAnnotationComposer,
    $$CheckInTagsTableCreateCompanionBuilder,
    $$CheckInTagsTableUpdateCompanionBuilder,
    (CheckInTag, BaseReferences<_$AppDatabase, $CheckInTagsTable, CheckInTag>),
    CheckInTag,
    PrefetchHooks Function()> {
  $$CheckInTagsTableTableManager(_$AppDatabase db, $CheckInTagsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CheckInTagsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CheckInTagsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CheckInTagsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> checkInId = const Value.absent(),
            Value<String> tagId = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CheckInTagsCompanion(
            checkInId: checkInId,
            tagId: tagId,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String checkInId,
            required String tagId,
            Value<int> rowid = const Value.absent(),
          }) =>
              CheckInTagsCompanion.insert(
            checkInId: checkInId,
            tagId: tagId,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CheckInTagsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CheckInTagsTable,
    CheckInTag,
    $$CheckInTagsTableFilterComposer,
    $$CheckInTagsTableOrderingComposer,
    $$CheckInTagsTableAnnotationComposer,
    $$CheckInTagsTableCreateCompanionBuilder,
    $$CheckInTagsTableUpdateCompanionBuilder,
    (CheckInTag, BaseReferences<_$AppDatabase, $CheckInTagsTable, CheckInTag>),
    CheckInTag,
    PrefetchHooks Function()>;
typedef $$SyncOperationsTableCreateCompanionBuilder = SyncOperationsCompanion
    Function({
  required String operationId,
  required String ownerId,
  required String deviceId,
  required int deviceSequence,
  required String entityType,
  required String entityId,
  required String kind,
  Value<String?> baseVersion,
  required String payloadJson,
  required DateTime occurredAt,
  required DateTime receivedAt,
  required String status,
  Value<String?> resultJson,
  Value<int?> sequence,
  Value<int> rowid,
});
typedef $$SyncOperationsTableUpdateCompanionBuilder = SyncOperationsCompanion
    Function({
  Value<String> operationId,
  Value<String> ownerId,
  Value<String> deviceId,
  Value<int> deviceSequence,
  Value<String> entityType,
  Value<String> entityId,
  Value<String> kind,
  Value<String?> baseVersion,
  Value<String> payloadJson,
  Value<DateTime> occurredAt,
  Value<DateTime> receivedAt,
  Value<String> status,
  Value<String?> resultJson,
  Value<int?> sequence,
  Value<int> rowid,
});

class $$SyncOperationsTableFilterComposer
    extends Composer<_$AppDatabase, $SyncOperationsTable> {
  $$SyncOperationsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get deviceId => $composableBuilder(
      column: $table.deviceId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get deviceSequence => $composableBuilder(
      column: $table.deviceSequence,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get kind => $composableBuilder(
      column: $table.kind, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get baseVersion => $composableBuilder(
      column: $table.baseVersion, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payloadJson => $composableBuilder(
      column: $table.payloadJson, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get occurredAt => $composableBuilder(
      column: $table.occurredAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get receivedAt => $composableBuilder(
      column: $table.receivedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get resultJson => $composableBuilder(
      column: $table.resultJson, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get sequence => $composableBuilder(
      column: $table.sequence, builder: (column) => ColumnFilters(column));
}

class $$SyncOperationsTableOrderingComposer
    extends Composer<_$AppDatabase, $SyncOperationsTable> {
  $$SyncOperationsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get deviceId => $composableBuilder(
      column: $table.deviceId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get deviceSequence => $composableBuilder(
      column: $table.deviceSequence,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get kind => $composableBuilder(
      column: $table.kind, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get baseVersion => $composableBuilder(
      column: $table.baseVersion, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payloadJson => $composableBuilder(
      column: $table.payloadJson, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get occurredAt => $composableBuilder(
      column: $table.occurredAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get receivedAt => $composableBuilder(
      column: $table.receivedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get resultJson => $composableBuilder(
      column: $table.resultJson, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get sequence => $composableBuilder(
      column: $table.sequence, builder: (column) => ColumnOrderings(column));
}

class $$SyncOperationsTableAnnotationComposer
    extends Composer<_$AppDatabase, $SyncOperationsTable> {
  $$SyncOperationsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get deviceId =>
      $composableBuilder(column: $table.deviceId, builder: (column) => column);

  GeneratedColumn<int> get deviceSequence => $composableBuilder(
      column: $table.deviceSequence, builder: (column) => column);

  GeneratedColumn<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => column);

  GeneratedColumn<String> get entityId =>
      $composableBuilder(column: $table.entityId, builder: (column) => column);

  GeneratedColumn<String> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<String> get baseVersion => $composableBuilder(
      column: $table.baseVersion, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
      column: $table.payloadJson, builder: (column) => column);

  GeneratedColumn<DateTime> get occurredAt => $composableBuilder(
      column: $table.occurredAt, builder: (column) => column);

  GeneratedColumn<DateTime> get receivedAt => $composableBuilder(
      column: $table.receivedAt, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get resultJson => $composableBuilder(
      column: $table.resultJson, builder: (column) => column);

  GeneratedColumn<int> get sequence =>
      $composableBuilder(column: $table.sequence, builder: (column) => column);
}

class $$SyncOperationsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $SyncOperationsTable,
    SyncOperation,
    $$SyncOperationsTableFilterComposer,
    $$SyncOperationsTableOrderingComposer,
    $$SyncOperationsTableAnnotationComposer,
    $$SyncOperationsTableCreateCompanionBuilder,
    $$SyncOperationsTableUpdateCompanionBuilder,
    (
      SyncOperation,
      BaseReferences<_$AppDatabase, $SyncOperationsTable, SyncOperation>
    ),
    SyncOperation,
    PrefetchHooks Function()> {
  $$SyncOperationsTableTableManager(
      _$AppDatabase db, $SyncOperationsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncOperationsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncOperationsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncOperationsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> operationId = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String> deviceId = const Value.absent(),
            Value<int> deviceSequence = const Value.absent(),
            Value<String> entityType = const Value.absent(),
            Value<String> entityId = const Value.absent(),
            Value<String> kind = const Value.absent(),
            Value<String?> baseVersion = const Value.absent(),
            Value<String> payloadJson = const Value.absent(),
            Value<DateTime> occurredAt = const Value.absent(),
            Value<DateTime> receivedAt = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<String?> resultJson = const Value.absent(),
            Value<int?> sequence = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              SyncOperationsCompanion(
            operationId: operationId,
            ownerId: ownerId,
            deviceId: deviceId,
            deviceSequence: deviceSequence,
            entityType: entityType,
            entityId: entityId,
            kind: kind,
            baseVersion: baseVersion,
            payloadJson: payloadJson,
            occurredAt: occurredAt,
            receivedAt: receivedAt,
            status: status,
            resultJson: resultJson,
            sequence: sequence,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String operationId,
            required String ownerId,
            required String deviceId,
            required int deviceSequence,
            required String entityType,
            required String entityId,
            required String kind,
            Value<String?> baseVersion = const Value.absent(),
            required String payloadJson,
            required DateTime occurredAt,
            required DateTime receivedAt,
            required String status,
            Value<String?> resultJson = const Value.absent(),
            Value<int?> sequence = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              SyncOperationsCompanion.insert(
            operationId: operationId,
            ownerId: ownerId,
            deviceId: deviceId,
            deviceSequence: deviceSequence,
            entityType: entityType,
            entityId: entityId,
            kind: kind,
            baseVersion: baseVersion,
            payloadJson: payloadJson,
            occurredAt: occurredAt,
            receivedAt: receivedAt,
            status: status,
            resultJson: resultJson,
            sequence: sequence,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$SyncOperationsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $SyncOperationsTable,
    SyncOperation,
    $$SyncOperationsTableFilterComposer,
    $$SyncOperationsTableOrderingComposer,
    $$SyncOperationsTableAnnotationComposer,
    $$SyncOperationsTableCreateCompanionBuilder,
    $$SyncOperationsTableUpdateCompanionBuilder,
    (
      SyncOperation,
      BaseReferences<_$AppDatabase, $SyncOperationsTable, SyncOperation>
    ),
    SyncOperation,
    PrefetchHooks Function()>;
typedef $$SyncCursorsTableCreateCompanionBuilder = SyncCursorsCompanion
    Function({
  required String ownerId,
  required String deviceId,
  Value<int> lastAppliedSequence,
  required DateTime updatedAt,
  Value<int> rowid,
});
typedef $$SyncCursorsTableUpdateCompanionBuilder = SyncCursorsCompanion
    Function({
  Value<String> ownerId,
  Value<String> deviceId,
  Value<int> lastAppliedSequence,
  Value<DateTime> updatedAt,
  Value<int> rowid,
});

class $$SyncCursorsTableFilterComposer
    extends Composer<_$AppDatabase, $SyncCursorsTable> {
  $$SyncCursorsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get deviceId => $composableBuilder(
      column: $table.deviceId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get lastAppliedSequence => $composableBuilder(
      column: $table.lastAppliedSequence,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));
}

class $$SyncCursorsTableOrderingComposer
    extends Composer<_$AppDatabase, $SyncCursorsTable> {
  $$SyncCursorsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get deviceId => $composableBuilder(
      column: $table.deviceId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get lastAppliedSequence => $composableBuilder(
      column: $table.lastAppliedSequence,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));
}

class $$SyncCursorsTableAnnotationComposer
    extends Composer<_$AppDatabase, $SyncCursorsTable> {
  $$SyncCursorsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get deviceId =>
      $composableBuilder(column: $table.deviceId, builder: (column) => column);

  GeneratedColumn<int> get lastAppliedSequence => $composableBuilder(
      column: $table.lastAppliedSequence, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$SyncCursorsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $SyncCursorsTable,
    SyncCursor,
    $$SyncCursorsTableFilterComposer,
    $$SyncCursorsTableOrderingComposer,
    $$SyncCursorsTableAnnotationComposer,
    $$SyncCursorsTableCreateCompanionBuilder,
    $$SyncCursorsTableUpdateCompanionBuilder,
    (SyncCursor, BaseReferences<_$AppDatabase, $SyncCursorsTable, SyncCursor>),
    SyncCursor,
    PrefetchHooks Function()> {
  $$SyncCursorsTableTableManager(_$AppDatabase db, $SyncCursorsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncCursorsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncCursorsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncCursorsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> ownerId = const Value.absent(),
            Value<String> deviceId = const Value.absent(),
            Value<int> lastAppliedSequence = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              SyncCursorsCompanion(
            ownerId: ownerId,
            deviceId: deviceId,
            lastAppliedSequence: lastAppliedSequence,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String ownerId,
            required String deviceId,
            Value<int> lastAppliedSequence = const Value.absent(),
            required DateTime updatedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              SyncCursorsCompanion.insert(
            ownerId: ownerId,
            deviceId: deviceId,
            lastAppliedSequence: lastAppliedSequence,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$SyncCursorsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $SyncCursorsTable,
    SyncCursor,
    $$SyncCursorsTableFilterComposer,
    $$SyncCursorsTableOrderingComposer,
    $$SyncCursorsTableAnnotationComposer,
    $$SyncCursorsTableCreateCompanionBuilder,
    $$SyncCursorsTableUpdateCompanionBuilder,
    (SyncCursor, BaseReferences<_$AppDatabase, $SyncCursorsTable, SyncCursor>),
    SyncCursor,
    PrefetchHooks Function()>;
typedef $$OutboxOperationsTableCreateCompanionBuilder
    = OutboxOperationsCompanion Function({
  required String operationId,
  required String ownerId,
  required String deviceId,
  required int deviceSequence,
  required String entityType,
  required String entityId,
  required String kind,
  Value<String?> baseVersion,
  required String payloadJson,
  required DateTime occurredAt,
  Value<int> attempts,
  required DateTime nextAttemptAt,
  Value<DateTime?> acknowledgedAt,
  required DateTime createdAt,
  Value<int> rowid,
});
typedef $$OutboxOperationsTableUpdateCompanionBuilder
    = OutboxOperationsCompanion Function({
  Value<String> operationId,
  Value<String> ownerId,
  Value<String> deviceId,
  Value<int> deviceSequence,
  Value<String> entityType,
  Value<String> entityId,
  Value<String> kind,
  Value<String?> baseVersion,
  Value<String> payloadJson,
  Value<DateTime> occurredAt,
  Value<int> attempts,
  Value<DateTime> nextAttemptAt,
  Value<DateTime?> acknowledgedAt,
  Value<DateTime> createdAt,
  Value<int> rowid,
});

class $$OutboxOperationsTableFilterComposer
    extends Composer<_$AppDatabase, $OutboxOperationsTable> {
  $$OutboxOperationsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get deviceId => $composableBuilder(
      column: $table.deviceId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get deviceSequence => $composableBuilder(
      column: $table.deviceSequence,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get kind => $composableBuilder(
      column: $table.kind, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get baseVersion => $composableBuilder(
      column: $table.baseVersion, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payloadJson => $composableBuilder(
      column: $table.payloadJson, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get occurredAt => $composableBuilder(
      column: $table.occurredAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get attempts => $composableBuilder(
      column: $table.attempts, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get nextAttemptAt => $composableBuilder(
      column: $table.nextAttemptAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get acknowledgedAt => $composableBuilder(
      column: $table.acknowledgedAt,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));
}

class $$OutboxOperationsTableOrderingComposer
    extends Composer<_$AppDatabase, $OutboxOperationsTable> {
  $$OutboxOperationsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get deviceId => $composableBuilder(
      column: $table.deviceId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get deviceSequence => $composableBuilder(
      column: $table.deviceSequence,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get kind => $composableBuilder(
      column: $table.kind, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get baseVersion => $composableBuilder(
      column: $table.baseVersion, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payloadJson => $composableBuilder(
      column: $table.payloadJson, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get occurredAt => $composableBuilder(
      column: $table.occurredAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get attempts => $composableBuilder(
      column: $table.attempts, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get nextAttemptAt => $composableBuilder(
      column: $table.nextAttemptAt,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get acknowledgedAt => $composableBuilder(
      column: $table.acknowledgedAt,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$OutboxOperationsTableAnnotationComposer
    extends Composer<_$AppDatabase, $OutboxOperationsTable> {
  $$OutboxOperationsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get deviceId =>
      $composableBuilder(column: $table.deviceId, builder: (column) => column);

  GeneratedColumn<int> get deviceSequence => $composableBuilder(
      column: $table.deviceSequence, builder: (column) => column);

  GeneratedColumn<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => column);

  GeneratedColumn<String> get entityId =>
      $composableBuilder(column: $table.entityId, builder: (column) => column);

  GeneratedColumn<String> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<String> get baseVersion => $composableBuilder(
      column: $table.baseVersion, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
      column: $table.payloadJson, builder: (column) => column);

  GeneratedColumn<DateTime> get occurredAt => $composableBuilder(
      column: $table.occurredAt, builder: (column) => column);

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);

  GeneratedColumn<DateTime> get nextAttemptAt => $composableBuilder(
      column: $table.nextAttemptAt, builder: (column) => column);

  GeneratedColumn<DateTime> get acknowledgedAt => $composableBuilder(
      column: $table.acknowledgedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$OutboxOperationsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $OutboxOperationsTable,
    OutboxOperation,
    $$OutboxOperationsTableFilterComposer,
    $$OutboxOperationsTableOrderingComposer,
    $$OutboxOperationsTableAnnotationComposer,
    $$OutboxOperationsTableCreateCompanionBuilder,
    $$OutboxOperationsTableUpdateCompanionBuilder,
    (
      OutboxOperation,
      BaseReferences<_$AppDatabase, $OutboxOperationsTable, OutboxOperation>
    ),
    OutboxOperation,
    PrefetchHooks Function()> {
  $$OutboxOperationsTableTableManager(
      _$AppDatabase db, $OutboxOperationsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OutboxOperationsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OutboxOperationsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OutboxOperationsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> operationId = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String> deviceId = const Value.absent(),
            Value<int> deviceSequence = const Value.absent(),
            Value<String> entityType = const Value.absent(),
            Value<String> entityId = const Value.absent(),
            Value<String> kind = const Value.absent(),
            Value<String?> baseVersion = const Value.absent(),
            Value<String> payloadJson = const Value.absent(),
            Value<DateTime> occurredAt = const Value.absent(),
            Value<int> attempts = const Value.absent(),
            Value<DateTime> nextAttemptAt = const Value.absent(),
            Value<DateTime?> acknowledgedAt = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              OutboxOperationsCompanion(
            operationId: operationId,
            ownerId: ownerId,
            deviceId: deviceId,
            deviceSequence: deviceSequence,
            entityType: entityType,
            entityId: entityId,
            kind: kind,
            baseVersion: baseVersion,
            payloadJson: payloadJson,
            occurredAt: occurredAt,
            attempts: attempts,
            nextAttemptAt: nextAttemptAt,
            acknowledgedAt: acknowledgedAt,
            createdAt: createdAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String operationId,
            required String ownerId,
            required String deviceId,
            required int deviceSequence,
            required String entityType,
            required String entityId,
            required String kind,
            Value<String?> baseVersion = const Value.absent(),
            required String payloadJson,
            required DateTime occurredAt,
            Value<int> attempts = const Value.absent(),
            required DateTime nextAttemptAt,
            Value<DateTime?> acknowledgedAt = const Value.absent(),
            required DateTime createdAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              OutboxOperationsCompanion.insert(
            operationId: operationId,
            ownerId: ownerId,
            deviceId: deviceId,
            deviceSequence: deviceSequence,
            entityType: entityType,
            entityId: entityId,
            kind: kind,
            baseVersion: baseVersion,
            payloadJson: payloadJson,
            occurredAt: occurredAt,
            attempts: attempts,
            nextAttemptAt: nextAttemptAt,
            acknowledgedAt: acknowledgedAt,
            createdAt: createdAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$OutboxOperationsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $OutboxOperationsTable,
    OutboxOperation,
    $$OutboxOperationsTableFilterComposer,
    $$OutboxOperationsTableOrderingComposer,
    $$OutboxOperationsTableAnnotationComposer,
    $$OutboxOperationsTableCreateCompanionBuilder,
    $$OutboxOperationsTableUpdateCompanionBuilder,
    (
      OutboxOperation,
      BaseReferences<_$AppDatabase, $OutboxOperationsTable, OutboxOperation>
    ),
    OutboxOperation,
    PrefetchHooks Function()>;
typedef $$SyncFailuresTableCreateCompanionBuilder = SyncFailuresCompanion
    Function({
  required String operationId,
  required String code,
  required String message,
  required DateTime recordedAt,
  Value<int> rowid,
});
typedef $$SyncFailuresTableUpdateCompanionBuilder = SyncFailuresCompanion
    Function({
  Value<String> operationId,
  Value<String> code,
  Value<String> message,
  Value<DateTime> recordedAt,
  Value<int> rowid,
});

class $$SyncFailuresTableFilterComposer
    extends Composer<_$AppDatabase, $SyncFailuresTable> {
  $$SyncFailuresTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get code => $composableBuilder(
      column: $table.code, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get message => $composableBuilder(
      column: $table.message, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get recordedAt => $composableBuilder(
      column: $table.recordedAt, builder: (column) => ColumnFilters(column));
}

class $$SyncFailuresTableOrderingComposer
    extends Composer<_$AppDatabase, $SyncFailuresTable> {
  $$SyncFailuresTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get code => $composableBuilder(
      column: $table.code, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get message => $composableBuilder(
      column: $table.message, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get recordedAt => $composableBuilder(
      column: $table.recordedAt, builder: (column) => ColumnOrderings(column));
}

class $$SyncFailuresTableAnnotationComposer
    extends Composer<_$AppDatabase, $SyncFailuresTable> {
  $$SyncFailuresTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => column);

  GeneratedColumn<String> get code =>
      $composableBuilder(column: $table.code, builder: (column) => column);

  GeneratedColumn<String> get message =>
      $composableBuilder(column: $table.message, builder: (column) => column);

  GeneratedColumn<DateTime> get recordedAt => $composableBuilder(
      column: $table.recordedAt, builder: (column) => column);
}

class $$SyncFailuresTableTableManager extends RootTableManager<
    _$AppDatabase,
    $SyncFailuresTable,
    SyncFailure,
    $$SyncFailuresTableFilterComposer,
    $$SyncFailuresTableOrderingComposer,
    $$SyncFailuresTableAnnotationComposer,
    $$SyncFailuresTableCreateCompanionBuilder,
    $$SyncFailuresTableUpdateCompanionBuilder,
    (
      SyncFailure,
      BaseReferences<_$AppDatabase, $SyncFailuresTable, SyncFailure>
    ),
    SyncFailure,
    PrefetchHooks Function()> {
  $$SyncFailuresTableTableManager(_$AppDatabase db, $SyncFailuresTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncFailuresTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncFailuresTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncFailuresTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> operationId = const Value.absent(),
            Value<String> code = const Value.absent(),
            Value<String> message = const Value.absent(),
            Value<DateTime> recordedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              SyncFailuresCompanion(
            operationId: operationId,
            code: code,
            message: message,
            recordedAt: recordedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String operationId,
            required String code,
            required String message,
            required DateTime recordedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              SyncFailuresCompanion.insert(
            operationId: operationId,
            code: code,
            message: message,
            recordedAt: recordedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$SyncFailuresTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $SyncFailuresTable,
    SyncFailure,
    $$SyncFailuresTableFilterComposer,
    $$SyncFailuresTableOrderingComposer,
    $$SyncFailuresTableAnnotationComposer,
    $$SyncFailuresTableCreateCompanionBuilder,
    $$SyncFailuresTableUpdateCompanionBuilder,
    (
      SyncFailure,
      BaseReferences<_$AppDatabase, $SyncFailuresTable, SyncFailure>
    ),
    SyncFailure,
    PrefetchHooks Function()>;
typedef $$ConflictsTableCreateCompanionBuilder = ConflictsCompanion Function({
  required String id,
  required String ownerId,
  required String entityType,
  required String entityId,
  Value<String?> localOperationId,
  Value<String?> remoteOperationId,
  Value<String?> localPayloadJson,
  Value<String?> remotePayloadJson,
  Value<String> status,
  Value<DateTime?> resolvedAt,
  required DateTime createdAt,
  Value<int> rowid,
});
typedef $$ConflictsTableUpdateCompanionBuilder = ConflictsCompanion Function({
  Value<String> id,
  Value<String> ownerId,
  Value<String> entityType,
  Value<String> entityId,
  Value<String?> localOperationId,
  Value<String?> remoteOperationId,
  Value<String?> localPayloadJson,
  Value<String?> remotePayloadJson,
  Value<String> status,
  Value<DateTime?> resolvedAt,
  Value<DateTime> createdAt,
  Value<int> rowid,
});

class $$ConflictsTableFilterComposer
    extends Composer<_$AppDatabase, $ConflictsTable> {
  $$ConflictsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get localOperationId => $composableBuilder(
      column: $table.localOperationId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get remoteOperationId => $composableBuilder(
      column: $table.remoteOperationId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get localPayloadJson => $composableBuilder(
      column: $table.localPayloadJson,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get remotePayloadJson => $composableBuilder(
      column: $table.remotePayloadJson,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get resolvedAt => $composableBuilder(
      column: $table.resolvedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));
}

class $$ConflictsTableOrderingComposer
    extends Composer<_$AppDatabase, $ConflictsTable> {
  $$ConflictsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get localOperationId => $composableBuilder(
      column: $table.localOperationId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get remoteOperationId => $composableBuilder(
      column: $table.remoteOperationId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get localPayloadJson => $composableBuilder(
      column: $table.localPayloadJson,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get remotePayloadJson => $composableBuilder(
      column: $table.remotePayloadJson,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get resolvedAt => $composableBuilder(
      column: $table.resolvedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$ConflictsTableAnnotationComposer
    extends Composer<_$AppDatabase, $ConflictsTable> {
  $$ConflictsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => column);

  GeneratedColumn<String> get entityId =>
      $composableBuilder(column: $table.entityId, builder: (column) => column);

  GeneratedColumn<String> get localOperationId => $composableBuilder(
      column: $table.localOperationId, builder: (column) => column);

  GeneratedColumn<String> get remoteOperationId => $composableBuilder(
      column: $table.remoteOperationId, builder: (column) => column);

  GeneratedColumn<String> get localPayloadJson => $composableBuilder(
      column: $table.localPayloadJson, builder: (column) => column);

  GeneratedColumn<String> get remotePayloadJson => $composableBuilder(
      column: $table.remotePayloadJson, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<DateTime> get resolvedAt => $composableBuilder(
      column: $table.resolvedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$ConflictsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $ConflictsTable,
    Conflict,
    $$ConflictsTableFilterComposer,
    $$ConflictsTableOrderingComposer,
    $$ConflictsTableAnnotationComposer,
    $$ConflictsTableCreateCompanionBuilder,
    $$ConflictsTableUpdateCompanionBuilder,
    (Conflict, BaseReferences<_$AppDatabase, $ConflictsTable, Conflict>),
    Conflict,
    PrefetchHooks Function()> {
  $$ConflictsTableTableManager(_$AppDatabase db, $ConflictsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ConflictsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ConflictsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ConflictsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String> entityType = const Value.absent(),
            Value<String> entityId = const Value.absent(),
            Value<String?> localOperationId = const Value.absent(),
            Value<String?> remoteOperationId = const Value.absent(),
            Value<String?> localPayloadJson = const Value.absent(),
            Value<String?> remotePayloadJson = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<DateTime?> resolvedAt = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              ConflictsCompanion(
            id: id,
            ownerId: ownerId,
            entityType: entityType,
            entityId: entityId,
            localOperationId: localOperationId,
            remoteOperationId: remoteOperationId,
            localPayloadJson: localPayloadJson,
            remotePayloadJson: remotePayloadJson,
            status: status,
            resolvedAt: resolvedAt,
            createdAt: createdAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerId,
            required String entityType,
            required String entityId,
            Value<String?> localOperationId = const Value.absent(),
            Value<String?> remoteOperationId = const Value.absent(),
            Value<String?> localPayloadJson = const Value.absent(),
            Value<String?> remotePayloadJson = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<DateTime?> resolvedAt = const Value.absent(),
            required DateTime createdAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              ConflictsCompanion.insert(
            id: id,
            ownerId: ownerId,
            entityType: entityType,
            entityId: entityId,
            localOperationId: localOperationId,
            remoteOperationId: remoteOperationId,
            localPayloadJson: localPayloadJson,
            remotePayloadJson: remotePayloadJson,
            status: status,
            resolvedAt: resolvedAt,
            createdAt: createdAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$ConflictsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $ConflictsTable,
    Conflict,
    $$ConflictsTableFilterComposer,
    $$ConflictsTableOrderingComposer,
    $$ConflictsTableAnnotationComposer,
    $$ConflictsTableCreateCompanionBuilder,
    $$ConflictsTableUpdateCompanionBuilder,
    (Conflict, BaseReferences<_$AppDatabase, $ConflictsTable, Conflict>),
    Conflict,
    PrefetchHooks Function()>;
typedef $$BackupManifestsTableCreateCompanionBuilder = BackupManifestsCompanion
    Function({
  required String id,
  required String ownerId,
  required String kind,
  required int formatVersion,
  required int schemaVersion,
  required String storageLocation,
  required String checksum,
  required String encryptionJson,
  required DateTime createdAt,
  Value<DateTime?> expiresAt,
  Value<int> rowid,
});
typedef $$BackupManifestsTableUpdateCompanionBuilder = BackupManifestsCompanion
    Function({
  Value<String> id,
  Value<String> ownerId,
  Value<String> kind,
  Value<int> formatVersion,
  Value<int> schemaVersion,
  Value<String> storageLocation,
  Value<String> checksum,
  Value<String> encryptionJson,
  Value<DateTime> createdAt,
  Value<DateTime?> expiresAt,
  Value<int> rowid,
});

class $$BackupManifestsTableFilterComposer
    extends Composer<_$AppDatabase, $BackupManifestsTable> {
  $$BackupManifestsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get kind => $composableBuilder(
      column: $table.kind, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get formatVersion => $composableBuilder(
      column: $table.formatVersion, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get schemaVersion => $composableBuilder(
      column: $table.schemaVersion, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get storageLocation => $composableBuilder(
      column: $table.storageLocation,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get checksum => $composableBuilder(
      column: $table.checksum, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get encryptionJson => $composableBuilder(
      column: $table.encryptionJson,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get expiresAt => $composableBuilder(
      column: $table.expiresAt, builder: (column) => ColumnFilters(column));
}

class $$BackupManifestsTableOrderingComposer
    extends Composer<_$AppDatabase, $BackupManifestsTable> {
  $$BackupManifestsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get kind => $composableBuilder(
      column: $table.kind, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get formatVersion => $composableBuilder(
      column: $table.formatVersion,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get schemaVersion => $composableBuilder(
      column: $table.schemaVersion,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get storageLocation => $composableBuilder(
      column: $table.storageLocation,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get checksum => $composableBuilder(
      column: $table.checksum, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get encryptionJson => $composableBuilder(
      column: $table.encryptionJson,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get expiresAt => $composableBuilder(
      column: $table.expiresAt, builder: (column) => ColumnOrderings(column));
}

class $$BackupManifestsTableAnnotationComposer
    extends Composer<_$AppDatabase, $BackupManifestsTable> {
  $$BackupManifestsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<int> get formatVersion => $composableBuilder(
      column: $table.formatVersion, builder: (column) => column);

  GeneratedColumn<int> get schemaVersion => $composableBuilder(
      column: $table.schemaVersion, builder: (column) => column);

  GeneratedColumn<String> get storageLocation => $composableBuilder(
      column: $table.storageLocation, builder: (column) => column);

  GeneratedColumn<String> get checksum =>
      $composableBuilder(column: $table.checksum, builder: (column) => column);

  GeneratedColumn<String> get encryptionJson => $composableBuilder(
      column: $table.encryptionJson, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get expiresAt =>
      $composableBuilder(column: $table.expiresAt, builder: (column) => column);
}

class $$BackupManifestsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $BackupManifestsTable,
    BackupManifest,
    $$BackupManifestsTableFilterComposer,
    $$BackupManifestsTableOrderingComposer,
    $$BackupManifestsTableAnnotationComposer,
    $$BackupManifestsTableCreateCompanionBuilder,
    $$BackupManifestsTableUpdateCompanionBuilder,
    (
      BackupManifest,
      BaseReferences<_$AppDatabase, $BackupManifestsTable, BackupManifest>
    ),
    BackupManifest,
    PrefetchHooks Function()> {
  $$BackupManifestsTableTableManager(
      _$AppDatabase db, $BackupManifestsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$BackupManifestsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$BackupManifestsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$BackupManifestsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String> kind = const Value.absent(),
            Value<int> formatVersion = const Value.absent(),
            Value<int> schemaVersion = const Value.absent(),
            Value<String> storageLocation = const Value.absent(),
            Value<String> checksum = const Value.absent(),
            Value<String> encryptionJson = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime?> expiresAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              BackupManifestsCompanion(
            id: id,
            ownerId: ownerId,
            kind: kind,
            formatVersion: formatVersion,
            schemaVersion: schemaVersion,
            storageLocation: storageLocation,
            checksum: checksum,
            encryptionJson: encryptionJson,
            createdAt: createdAt,
            expiresAt: expiresAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerId,
            required String kind,
            required int formatVersion,
            required int schemaVersion,
            required String storageLocation,
            required String checksum,
            required String encryptionJson,
            required DateTime createdAt,
            Value<DateTime?> expiresAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              BackupManifestsCompanion.insert(
            id: id,
            ownerId: ownerId,
            kind: kind,
            formatVersion: formatVersion,
            schemaVersion: schemaVersion,
            storageLocation: storageLocation,
            checksum: checksum,
            encryptionJson: encryptionJson,
            createdAt: createdAt,
            expiresAt: expiresAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$BackupManifestsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $BackupManifestsTable,
    BackupManifest,
    $$BackupManifestsTableFilterComposer,
    $$BackupManifestsTableOrderingComposer,
    $$BackupManifestsTableAnnotationComposer,
    $$BackupManifestsTableCreateCompanionBuilder,
    $$BackupManifestsTableUpdateCompanionBuilder,
    (
      BackupManifest,
      BaseReferences<_$AppDatabase, $BackupManifestsTable, BackupManifest>
    ),
    BackupManifest,
    PrefetchHooks Function()>;
typedef $$AppSettingsTableCreateCompanionBuilder = AppSettingsCompanion
    Function({
  required String ownerId,
  required String valuesJson,
  required String version,
  required DateTime createdAt,
  required DateTime updatedAt,
  Value<int> rowid,
});
typedef $$AppSettingsTableUpdateCompanionBuilder = AppSettingsCompanion
    Function({
  Value<String> ownerId,
  Value<String> valuesJson,
  Value<String> version,
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<int> rowid,
});

class $$AppSettingsTableFilterComposer
    extends Composer<_$AppDatabase, $AppSettingsTable> {
  $$AppSettingsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get valuesJson => $composableBuilder(
      column: $table.valuesJson, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));
}

class $$AppSettingsTableOrderingComposer
    extends Composer<_$AppDatabase, $AppSettingsTable> {
  $$AppSettingsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get valuesJson => $composableBuilder(
      column: $table.valuesJson, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));
}

class $$AppSettingsTableAnnotationComposer
    extends Composer<_$AppDatabase, $AppSettingsTable> {
  $$AppSettingsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get valuesJson => $composableBuilder(
      column: $table.valuesJson, builder: (column) => column);

  GeneratedColumn<String> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$AppSettingsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $AppSettingsTable,
    AppSetting,
    $$AppSettingsTableFilterComposer,
    $$AppSettingsTableOrderingComposer,
    $$AppSettingsTableAnnotationComposer,
    $$AppSettingsTableCreateCompanionBuilder,
    $$AppSettingsTableUpdateCompanionBuilder,
    (AppSetting, BaseReferences<_$AppDatabase, $AppSettingsTable, AppSetting>),
    AppSetting,
    PrefetchHooks Function()> {
  $$AppSettingsTableTableManager(_$AppDatabase db, $AppSettingsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$AppSettingsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$AppSettingsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$AppSettingsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> ownerId = const Value.absent(),
            Value<String> valuesJson = const Value.absent(),
            Value<String> version = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              AppSettingsCompanion(
            ownerId: ownerId,
            valuesJson: valuesJson,
            version: version,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String ownerId,
            required String valuesJson,
            required String version,
            required DateTime createdAt,
            required DateTime updatedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              AppSettingsCompanion.insert(
            ownerId: ownerId,
            valuesJson: valuesJson,
            version: version,
            createdAt: createdAt,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$AppSettingsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $AppSettingsTable,
    AppSetting,
    $$AppSettingsTableFilterComposer,
    $$AppSettingsTableOrderingComposer,
    $$AppSettingsTableAnnotationComposer,
    $$AppSettingsTableCreateCompanionBuilder,
    $$AppSettingsTableUpdateCompanionBuilder,
    (AppSetting, BaseReferences<_$AppDatabase, $AppSettingsTable, AppSetting>),
    AppSetting,
    PrefetchHooks Function()>;
typedef $$TombstonesTableCreateCompanionBuilder = TombstonesCompanion Function({
  required String id,
  required String ownerId,
  required String entityType,
  required String entityId,
  required String version,
  required DateTime deletedAt,
  required DateTime retentionUntil,
  required DateTime createdAt,
  Value<int> rowid,
});
typedef $$TombstonesTableUpdateCompanionBuilder = TombstonesCompanion Function({
  Value<String> id,
  Value<String> ownerId,
  Value<String> entityType,
  Value<String> entityId,
  Value<String> version,
  Value<DateTime> deletedAt,
  Value<DateTime> retentionUntil,
  Value<DateTime> createdAt,
  Value<int> rowid,
});

class $$TombstonesTableFilterComposer
    extends Composer<_$AppDatabase, $TombstonesTable> {
  $$TombstonesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get retentionUntil => $composableBuilder(
      column: $table.retentionUntil,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));
}

class $$TombstonesTableOrderingComposer
    extends Composer<_$AppDatabase, $TombstonesTable> {
  $$TombstonesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerId => $composableBuilder(
      column: $table.ownerId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get version => $composableBuilder(
      column: $table.version, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get deletedAt => $composableBuilder(
      column: $table.deletedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get retentionUntil => $composableBuilder(
      column: $table.retentionUntil,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$TombstonesTableAnnotationComposer
    extends Composer<_$AppDatabase, $TombstonesTable> {
  $$TombstonesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => column);

  GeneratedColumn<String> get entityId =>
      $composableBuilder(column: $table.entityId, builder: (column) => column);

  GeneratedColumn<String> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<DateTime> get deletedAt =>
      $composableBuilder(column: $table.deletedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get retentionUntil => $composableBuilder(
      column: $table.retentionUntil, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$TombstonesTableTableManager extends RootTableManager<
    _$AppDatabase,
    $TombstonesTable,
    Tombstone,
    $$TombstonesTableFilterComposer,
    $$TombstonesTableOrderingComposer,
    $$TombstonesTableAnnotationComposer,
    $$TombstonesTableCreateCompanionBuilder,
    $$TombstonesTableUpdateCompanionBuilder,
    (Tombstone, BaseReferences<_$AppDatabase, $TombstonesTable, Tombstone>),
    Tombstone,
    PrefetchHooks Function()> {
  $$TombstonesTableTableManager(_$AppDatabase db, $TombstonesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$TombstonesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$TombstonesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$TombstonesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerId = const Value.absent(),
            Value<String> entityType = const Value.absent(),
            Value<String> entityId = const Value.absent(),
            Value<String> version = const Value.absent(),
            Value<DateTime> deletedAt = const Value.absent(),
            Value<DateTime> retentionUntil = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              TombstonesCompanion(
            id: id,
            ownerId: ownerId,
            entityType: entityType,
            entityId: entityId,
            version: version,
            deletedAt: deletedAt,
            retentionUntil: retentionUntil,
            createdAt: createdAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerId,
            required String entityType,
            required String entityId,
            required String version,
            required DateTime deletedAt,
            required DateTime retentionUntil,
            required DateTime createdAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              TombstonesCompanion.insert(
            id: id,
            ownerId: ownerId,
            entityType: entityType,
            entityId: entityId,
            version: version,
            deletedAt: deletedAt,
            retentionUntil: retentionUntil,
            createdAt: createdAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$TombstonesTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $TombstonesTable,
    Tombstone,
    $$TombstonesTableFilterComposer,
    $$TombstonesTableOrderingComposer,
    $$TombstonesTableAnnotationComposer,
    $$TombstonesTableCreateCompanionBuilder,
    $$TombstonesTableUpdateCompanionBuilder,
    (Tombstone, BaseReferences<_$AppDatabase, $TombstonesTable, Tombstone>),
    Tombstone,
    PrefetchHooks Function()>;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$OwnersTableTableManager get owners =>
      $$OwnersTableTableManager(_db, _db.owners);
  $$DevicesTableTableManager get devices =>
      $$DevicesTableTableManager(_db, _db.devices);
  $$DevicePairingsTableTableManager get devicePairings =>
      $$DevicePairingsTableTableManager(_db, _db.devicePairings);
  $$FocusModesTableTableManager get focusModes =>
      $$FocusModesTableTableManager(_db, _db.focusModes);
  $$FocusSessionsTableTableManager get focusSessions =>
      $$FocusSessionsTableTableManager(_db, _db.focusSessions);
  $$ReminderOccurrencesTableTableManager get reminderOccurrences =>
      $$ReminderOccurrencesTableTableManager(_db, _db.reminderOccurrences);
  $$ReminderTransitionsTableTableManager get reminderTransitions =>
      $$ReminderTransitionsTableTableManager(_db, _db.reminderTransitions);
  $$CategoriesTableTableManager get categories =>
      $$CategoriesTableTableManager(_db, _db.categories);
  $$CheckInsTableTableManager get checkIns =>
      $$CheckInsTableTableManager(_db, _db.checkIns);
  $$CheckInRevisionsTableTableManager get checkInRevisions =>
      $$CheckInRevisionsTableTableManager(_db, _db.checkInRevisions);
  $$TagsTableTableManager get tags => $$TagsTableTableManager(_db, _db.tags);
  $$CheckInTagsTableTableManager get checkInTags =>
      $$CheckInTagsTableTableManager(_db, _db.checkInTags);
  $$SyncOperationsTableTableManager get syncOperations =>
      $$SyncOperationsTableTableManager(_db, _db.syncOperations);
  $$SyncCursorsTableTableManager get syncCursors =>
      $$SyncCursorsTableTableManager(_db, _db.syncCursors);
  $$OutboxOperationsTableTableManager get outboxOperations =>
      $$OutboxOperationsTableTableManager(_db, _db.outboxOperations);
  $$SyncFailuresTableTableManager get syncFailures =>
      $$SyncFailuresTableTableManager(_db, _db.syncFailures);
  $$ConflictsTableTableManager get conflicts =>
      $$ConflictsTableTableManager(_db, _db.conflicts);
  $$BackupManifestsTableTableManager get backupManifests =>
      $$BackupManifestsTableTableManager(_db, _db.backupManifests);
  $$AppSettingsTableTableManager get appSettings =>
      $$AppSettingsTableTableManager(_db, _db.appSettings);
  $$TombstonesTableTableManager get tombstones =>
      $$TombstonesTableTableManager(_db, _db.tombstones);
}
