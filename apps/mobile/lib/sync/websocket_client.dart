import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:uuid/uuid.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../identity/device_identity.dart';

class FocusLogWebSocketClient {
  FocusLogWebSocketClient({
    required this.endpoint,
    required this.identity,
    required this.onSyncAvailable,
    DeviceIdentityService? identityService,
  }) : _identityService = identityService ?? DeviceIdentityService();

  final Uri endpoint;
  final DeviceIdentity identity;
  final Future<void> Function() onSyncAvailable;
  final DeviceIdentityService _identityService;
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _heartbeat;
  Timer? _reconnect;
  var _attempt = 0;
  var _stopped = true;
  var _foreground = true;

  Future<void> start() async {
    if (!_stopped) return;
    _stopped = false;
    await _connect();
  }

  Future<void> stop() async {
    _stopped = true;
    _heartbeat?.cancel();
    _reconnect?.cancel();
    await _subscription?.cancel();
    await _channel?.sink.close(1000, 'client shutdown');
    _channel = null;
  }

  void setForeground(bool foreground) {
    _foreground = foreground;
    _send('presence.heartbeat',
        {'state': foreground ? 'foreground' : 'background'});
  }

  String requestReminderClaim(String occurrenceId, {int claimTtlSeconds = 30}) {
    return _send('reminder.claim-request',
        {'occurrenceId': occurrenceId, 'claimTtlSeconds': claimTtlSeconds});
  }

  Future<void> _connect() async {
    if (_stopped) return;
    final timestamp = DateTime.now().toUtc().toIso8601String();
    final nonce = const Uuid().v4();
    const version = '1';
    final signature = await _identityService.sign(identity,
        ['WEBSOCKET', '/api/v1/ws', version, timestamp, nonce].join('\n'));
    final uri = endpoint.replace(
      scheme: endpoint.scheme == 'https' ? 'wss' : 'ws',
      path: '/api/v1/ws',
      queryParameters: {
        'deviceId': identity.deviceId,
        'timestamp': timestamp,
        'nonce': nonce,
        'signature': signature,
        'version': version,
      },
    );
    try {
      final channel = WebSocketChannel.connect(uri);
      await channel.ready;
      if (_stopped) {
        await channel.sink.close();
        return;
      }
      _channel = channel;
      _attempt = 0;
      _subscription = channel.stream.listen(
        _handle,
        onError: (_) => _scheduleReconnect(channel),
        onDone: () => _scheduleReconnect(channel),
        cancelOnError: true,
      );
      _send('presence.hello', {
        'state': _foreground ? 'foreground' : 'background',
        'reminderCapable': true,
        'clientVersion': 'android-0.1.0',
      });
      _send('sync.subscribe', {'cursor': '0'});
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _handle(dynamic data) {
    try {
      final frame = jsonDecode(data.toString()) as Map<String, dynamic>;
      if (frame['version'] != '1') return;
      final payload = (frame['payload'] as Map<dynamic, dynamic>?)
              ?.cast<String, dynamic>() ??
          const <String, dynamic>{};
      if (frame['type'] == 'connection.ready') {
        final seconds =
            (payload['heartbeatIntervalSeconds'] as num?)?.toInt() ?? 15;
        _heartbeat?.cancel();
        _heartbeat = Timer.periodic(
          Duration(seconds: max(1, seconds)),
          (_) => _send('presence.heartbeat',
              {'state': _foreground ? 'foreground' : 'background'}),
        );
      } else if (frame['type'] == 'sync.available') {
        unawaited(onSyncAvailable());
      } else if (frame['type'] == 'device.revoked') {
        unawaited(stop());
      }
    } on FormatException {
      // Invalid frames are ignored; the server contract remains authoritative.
    }
  }

  String _send(String type, Map<String, dynamic> payload) {
    final requestId = const Uuid().v4();
    _channel?.sink.add(jsonEncode({
      'version': '1',
      'type': type,
      'requestId': requestId,
      'sentAt': DateTime.now().toUtc().toIso8601String(),
      'payload': payload,
    }));
    return requestId;
  }

  void _scheduleReconnect([WebSocketChannel? channelOrNull]) {
    if (_stopped || (channelOrNull != null && _channel != channelOrNull)) {
      return;
    }
    _heartbeat?.cancel();
    _reconnect?.cancel();
    _channel = null;
    final baseSeconds = min(30, 1 << min(_attempt++, 5));
    final jitter = 0.8 + Random().nextDouble() * 0.4;
    _reconnect = Timer(
      Duration(milliseconds: (baseSeconds * 1000 * jitter).round()),
      () => unawaited(_connect()),
    );
  }
}
