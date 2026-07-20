import 'dart:convert';
import 'dart:math';

import 'package:cryptography/cryptography.dart';
import 'package:crypto/crypto.dart' as crypto;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

String _id() {
  final random = Random.secure();
  return List.generate(26, (_) => _alphabet[random.nextInt(_alphabet.length)])
      .join();
}

/// Synchronization identifiers fit the shared 26-character database contract.
String generateSyncId() => _id();

String _pem(String label, List<int> der) {
  final encoded = base64Encode(der);
  final lines = RegExp('.{1,64}')
      .allMatches(encoded)
      .map((match) => match.group(0))
      .join('\n');
  return '-----BEGIN $label-----\n$lines\n-----END $label-----\n';
}

String _publicKeyPem(List<int> publicKey) => _pem('PUBLIC KEY', [
      ...[
        0x30,
        0x2a,
        0x30,
        0x05,
        0x06,
        0x03,
        0x2b,
        0x65,
        0x70,
        0x03,
        0x21,
        0x00
      ],
      ...publicKey
    ]);

class DeviceIdentity {
  DeviceIdentity(
      {required this.ownerId,
      required this.deviceId,
      required this.publicKeyPem,
      required this.privateKey,
      required this.publicKey});
  String ownerId;
  final String deviceId;
  final String publicKeyPem;
  final List<int> privateKey;
  final List<int> publicKey;
  String get fingerprint =>
      base64UrlEncode(crypto.sha256.convert(utf8.encode(publicKeyPem)).bytes)
          .replaceAll('=', '');
}

class DeviceIdentityService {
  DeviceIdentityService({FlutterSecureStorage? storage})
      : _storage = storage ?? secureCredentialStorage;
  final FlutterSecureStorage _storage;
  static const _key = 'focuslog.deviceIdentity.v1';

  Future<DeviceIdentity> loadOrCreate() async {
    final stored = await _storage.read(key: _key);
    if (stored != null) {
      final value = jsonDecode(stored) as Map<String, dynamic>;
      return DeviceIdentity(
          ownerId: value['ownerId'] as String,
          deviceId: value['deviceId'] as String,
          publicKeyPem: value['publicKeyPem'] as String,
          privateKey: base64Url.decode(value['privateKey'] as String),
          publicKey: base64Url.decode(value['publicKey'] as String));
    }
    final algorithm = Ed25519();
    final pair = await algorithm.newKeyPair();
    final publicKey = (await pair.extractPublicKey()).bytes;
    final privateKey = await pair.extractPrivateKeyBytes();
    final identity = DeviceIdentity(
        ownerId: _id(),
        deviceId: _id(),
        publicKeyPem: _publicKeyPem(publicKey),
        privateKey: privateKey,
        publicKey: publicKey);
    await save(identity);
    return identity;
  }

  Future<void> save(DeviceIdentity identity) => _storage.write(
      key: _key,
      value: jsonEncode({
        'ownerId': identity.ownerId,
        'deviceId': identity.deviceId,
        'publicKeyPem': identity.publicKeyPem,
        'privateKey': base64UrlEncode(identity.privateKey),
        'publicKey': base64UrlEncode(identity.publicKey)
      }));

  Future<void> delete() => _storage.delete(key: _key);

  Map<String, dynamic> recoveryPayload(DeviceIdentity identity) => {
        'platform': 'ANDROID',
        'format': 'ED25519-RAW',
        'ownerId': identity.ownerId,
        'deviceId': identity.deviceId,
        'publicKeyPem': identity.publicKeyPem,
        'privateKey': base64UrlEncode(identity.privateKey),
        'publicKey': base64UrlEncode(identity.publicKey),
      };

  Future<void> restoreFromBackup(Map<String, dynamic> value) async {
    if (value['platform'] != 'ANDROID' || value['format'] != 'ED25519-RAW') {
      throw const FormatException(
          'Backup identity is not compatible with Android.');
    }
    final privateKey = base64Url.decode(value['privateKey'] as String);
    final publicKey = base64Url.decode(value['publicKey'] as String);
    final pair = await Ed25519().newKeyPairFromSeed(privateKey);
    final derivedPublicKey = (await pair.extractPublicKey()).bytes;
    if (base64UrlEncode(publicKey) != base64UrlEncode(derivedPublicKey)) {
      throw const FormatException('Backup device key pair failed validation.');
    }
    await save(DeviceIdentity(
      ownerId: value['ownerId'] as String,
      deviceId: value['deviceId'] as String,
      publicKeyPem: value['publicKeyPem'] as String,
      privateKey: privateKey,
      publicKey: publicKey,
    ));
  }

  Future<String> sign(DeviceIdentity identity, String message) async {
    final signature = await Ed25519().sign(utf8.encode(message),
        keyPair: SimpleKeyPairData(identity.privateKey,
            publicKey:
                SimplePublicKey(identity.publicKey, type: KeyPairType.ed25519),
            type: KeyPairType.ed25519));
    return base64UrlEncode(signature.bytes).replaceAll('=', '');
  }
}

const secureCredentialStorage = FlutterSecureStorage(
  aOptions: AndroidOptions(
    encryptedSharedPreferences: true,
    resetOnError: false,
  ),
);

/// Generates the SQLCipher key once and keeps it wrapped by Android Keystore.
/// A storage failure is propagated: silently replacing this key would make the
/// existing encrypted database permanently unreadable.
class DatabaseKeyService {
  DatabaseKeyService({FlutterSecureStorage? storage})
      : _storage = storage ?? secureCredentialStorage;

  final FlutterSecureStorage _storage;
  static const _key = 'focuslog.databaseKey.v1';

  Future<List<int>> loadOrCreate() async {
    final stored = await _storage.read(key: _key);
    if (stored != null) {
      final decoded = base64Url.decode(stored);
      if (decoded.length != 32) {
        throw const FormatException(
            'Stored database key has an invalid length.');
      }
      return decoded;
    }
    final random = Random.secure();
    final key = List<int>.generate(32, (_) => random.nextInt(256));
    await _storage.write(key: _key, value: base64UrlEncode(key));
    return key;
  }

  Future<void> delete() => _storage.delete(key: _key);
}
