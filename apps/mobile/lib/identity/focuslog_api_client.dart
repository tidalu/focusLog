import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

import 'device_identity.dart';

/// Protocol client shared by Android pairing and authenticated synchronization.
/// Private key material never leaves [DeviceIdentityService].
class FocusLogApiClient {
  FocusLogApiClient(
      {required this.endpoint,
      required this.identity,
      required this.identityService,
      http.Client? client})
      : _client = client ?? http.Client();
  final Uri endpoint;
  final DeviceIdentity identity;
  final DeviceIdentityService identityService;
  final http.Client _client;

  Future<Map<String, dynamic>> bootstrap(
          {String displayName = 'This Android device'}) =>
      _request(
        'POST',
        '/api/v1/devices/bootstrap',
        {
          'ownerId': identity.ownerId,
          'deviceId': identity.deviceId,
          'publicKey': identity.publicKeyPem,
          'fingerprint': identity.fingerprint,
          'platform': 'ANDROID',
          'displayName': displayName,
          'proof': _proof('bootstrap'),
        },
        authenticated: false,
      );

  Future<Map<String, dynamic>> claimPairingCode(String code) => _request(
        'POST',
        '/api/v1/devices/pairing-codes/claim',
        {
          'code': code,
          'deviceId': identity.deviceId,
          'publicKey': identity.publicKeyPem,
          'fingerprint': identity.fingerprint,
          'platform': 'ANDROID',
          'displayName': 'This Android device',
          'proof': _proof('pairing-claim'),
        },
        authenticated: false,
      );

  Future<Map<String, dynamic>> consumePairing(String pairingId) => _request(
        'POST',
        '/api/v1/devices/pairing-requests/$pairingId/consume',
        {
          'proof': 'FOCUSLOG:pairing-consume:$pairingId:${identity.fingerprint}'
        },
        authenticated: false,
      );

  Future<void> permanentlyDeleteOwnerData() async {
    await _request(
      'DELETE',
      '/api/v1/data',
      {'confirmation': 'DELETE ALL FOCUSLOG DATA'},
      authenticated: true,
    );
  }

  String _proof(String kind, [String? pairingId]) {
    final prefix =
        pairingId == null ? 'FOCUSLOG:$kind' : 'FOCUSLOG:$kind:$pairingId';
    // The backend verifies this asynchronously supplied Ed25519 proof. The API
    // call below replaces this marker with a signature before it is sent.
    return '$prefix:${identity.fingerprint}:${identity.publicKeyPem}';
  }

  Future<Map<String, dynamic>> _request(
      String method, String path, Map<String, dynamic> body,
      {required bool authenticated}) async {
    final material = body['proof'] as String?;
    if (material != null) {
      body['proof'] = await identityService.sign(identity, material);
    }
    final bodyJson = jsonEncode(body);
    final request = http.Request(method, endpoint.resolve(path))
      ..headers['content-type'] = 'application/json'
      ..body = bodyJson;
    if (authenticated) {
      final timestamp = DateTime.now().toUtc().toIso8601String();
      final nonce = const Uuid().v4();
      final hash = base64UrlEncode(sha256.convert(utf8.encode(bodyJson)).bytes)
          .replaceAll('=', '');
      request.headers.addAll({
        'x-focuslog-device-id': identity.deviceId,
        'x-focuslog-timestamp': timestamp,
        'x-focuslog-nonce': nonce,
        'x-focuslog-signature': await identityService.sign(identity,
            '${method.toUpperCase()}\n$path\n$timestamp\n$nonce\n$hash'),
      });
    }
    final response =
        await http.Response.fromStream(await _client.send(request));
    final decoded = response.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FocusLogApiException(response.statusCode,
          decoded['message']?.toString() ?? 'Request failed.');
    }
    return decoded;
  }

  void dispose() => _client.close();
}

class FocusLogApiException implements Exception {
  FocusLogApiException(this.statusCode, this.message);
  final int statusCode;
  final String message;
  @override
  String toString() => message;
}
