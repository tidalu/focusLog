import { randomUUID } from 'node:crypto';

import WebSocket from 'ws';

import type { DeviceIdentity } from '../identity/device-identity.js';
import { signDeviceMessage } from '../identity/device-identity.js';

const protocolVersion = '1';

function canonicalHandshake(timestamp: string, nonce: string): string {
  return ['WEBSOCKET', '/api/v1/ws', protocolVersion, timestamp, nonce].join('\n');
}

export class FocusLogWebSocketClient {
  private socket?: WebSocket;
  private heartbeat?: NodeJS.Timeout;
  private reconnect?: NodeJS.Timeout;
  private reconnectAttempt = 0;
  private stopped = true;

  constructor(
    private readonly apiBase: URL,
    private readonly identity: DeviceIdentity,
    private readonly onSyncAvailable: () => void,
    private readonly onRevoked: () => void = () => undefined
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.reconnect) clearTimeout(this.reconnect);
    this.socket?.close(1000, 'client shutdown');
    this.socket = undefined;
  }

  requestReminderClaim(occurrenceId: string, claimTtlSeconds = 30): string {
    return this.send('reminder.claim-request', { occurrenceId, claimTtlSeconds });
  }

  releaseReminderClaim(occurrenceId: string, claimId: string): void {
    this.send('reminder.claim-release', { occurrenceId, claimId });
  }

  private connect(): void {
    if (this.stopped) return;
    const timestamp = new Date().toISOString();
    const nonce = randomUUID();
    const url = new URL('/api/v1/ws', this.apiBase);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.search = new URLSearchParams({
      deviceId: this.identity.deviceId,
      timestamp,
      nonce,
      signature: signDeviceMessage(this.identity, canonicalHandshake(timestamp, nonce)),
      version: protocolVersion
    }).toString();
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.on('open', () => {
      this.reconnectAttempt = 0;
      this.send('presence.hello', {
        state: 'foreground',
        reminderCapable: true,
        clientVersion: 'desktop-0.1.0'
      });
      this.send('sync.subscribe', { cursor: '0' });
    });
    socket.on('message', (data) => this.handle(data.toString()));
    socket.on('close', () => this.scheduleReconnect(socket));
    socket.on('error', () => socket.close());
  }

  private handle(raw: string): void {
    let frame: {
      version?: string;
      type?: string;
      payload?: Record<string, unknown>;
    };
    try {
      frame = JSON.parse(raw) as typeof frame;
    } catch {
      return;
    }
    if (frame.version !== protocolVersion) return;
    if (frame.type === 'connection.ready') {
      const seconds = Number(frame.payload?.heartbeatIntervalSeconds ?? 15);
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = setInterval(
        () => this.send('presence.heartbeat', { state: 'foreground' }),
        Math.max(1, seconds) * 1000
      );
      this.heartbeat.unref();
    } else if (frame.type === 'sync.available') {
      this.onSyncAvailable();
    } else if (frame.type === 'device.revoked') {
      this.onRevoked();
      this.stop();
    }
  }

  private send(type: string, payload: Record<string, unknown>): string {
    const requestId = randomUUID();
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(
        JSON.stringify({
          version: protocolVersion,
          type,
          requestId,
          sentAt: new Date().toISOString(),
          payload
        })
      );
    return requestId;
  }

  private scheduleReconnect(socket: WebSocket): void {
    if (this.socket !== socket || this.stopped) return;
    if (this.heartbeat) clearInterval(this.heartbeat);
    const exponential = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempt++);
    const delay = Math.round(exponential * (0.8 + Math.random() * 0.4));
    this.reconnect = setTimeout(() => this.connect(), delay);
    this.reconnect.unref();
  }
}
