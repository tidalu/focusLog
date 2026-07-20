import websocket from '@fastify/websocket';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ulid } from 'ulid';
import type { WebSocket } from 'ws';
import { z } from 'zod';

import type { ServerConfig } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { authenticateDeviceCredential } from '../plugins/device-auth.js';

export const websocketProtocolVersion = '1' as const;
export const websocketPath = '/api/v1/ws';

const envelope = z.object({
  version: z.literal(websocketProtocolVersion),
  type: z.string(),
  requestId: z.string().min(1).max(128),
  sentAt: z.string().datetime(),
  payload: z.unknown()
});

const hello = envelope.extend({
  type: z.literal('presence.hello'),
  payload: z.object({
    state: z.enum(['foreground', 'background']),
    reminderCapable: z.boolean(),
    clientVersion: z.string().min(1).max(64)
  })
});
const heartbeat = envelope.extend({
  type: z.literal('presence.heartbeat'),
  payload: z.object({ state: z.enum(['foreground', 'background']).optional() })
});
const subscribe = envelope.extend({
  type: z.literal('sync.subscribe'),
  payload: z.object({ cursor: z.string().regex(/^\d+$/) })
});
const claimRequest = envelope.extend({
  type: z.literal('reminder.claim-request'),
  payload: z.object({
    occurrenceId: z.string().length(26),
    claimTtlSeconds: z.number().int().min(5).max(120).default(30)
  })
});
const claimRelease = envelope.extend({
  type: z.literal('reminder.claim-release'),
  payload: z.object({ occurrenceId: z.string().length(26), claimId: z.string().length(26) })
});
export const websocketClientMessage = z.discriminatedUnion('type', [
  hello,
  heartbeat,
  subscribe,
  claimRequest,
  claimRelease
]);

type ClientMessage = z.infer<typeof websocketClientMessage>;
type PresenceState = 'foreground' | 'background';

interface Connection {
  readonly id: string;
  readonly ownerId: string;
  readonly deviceId: string;
  readonly socket: WebSocket;
  lastSeenAt: number;
  state: PresenceState;
  reminderCapable: boolean;
  cursor: bigint;
}

interface Claim {
  readonly claimId: string;
  readonly ownerId: string;
  readonly occurrenceId: string;
  readonly deviceId: string;
  readonly expiresAt: number;
}

interface ServerEnvelope {
  readonly version: typeof websocketProtocolVersion;
  readonly type: string;
  readonly eventId: string;
  readonly sentAt: string;
  readonly requestId?: string;
  readonly payload: Record<string, unknown>;
}

export function canonicalWebSocketHandshake(
  timestamp: string,
  nonce: string,
  protocolVersion = websocketProtocolVersion
): string {
  return ['WEBSOCKET', websocketPath, protocolVersion, timestamp, nonce].join('\n');
}

export class FocusLogWebSocketGateway {
  private readonly connections = new Map<string, Connection>();
  private readonly claims = new Map<string, Claim>();
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: ServerConfig,
    private readonly heartbeatIntervalMs = 15_000,
    private readonly heartbeatTimeoutMs = 45_000
  ) {}

  async register(app: FastifyInstance): Promise<void> {
    await app.register(websocket);
    app.get(
      websocketPath,
      { websocket: true },
      (socket, request) => void this.accept(socket, request)
    );
    this.heartbeatTimer = setInterval(() => this.expireConnections(), this.heartbeatIntervalMs);
    this.heartbeatTimer.unref();
    app.addHook('onClose', async () => {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      for (const connection of this.connections.values()) connection.socket.close(1001, 'shutdown');
      this.connections.clear();
    });
  }

  async notifySyncAvailable(
    ownerId: string,
    sourceDeviceId: string,
    nextCursor: string
  ): Promise<void> {
    this.broadcast(
      ownerId,
      'sync.available',
      { sourceDeviceId, nextCursor },
      (connection) => connection.deviceId !== sourceDeviceId
    );
  }

  notifyDeviceRevoked(ownerId: string, deviceId: string): void {
    for (const connection of this.connections.values()) {
      if (connection.ownerId !== ownerId) continue;
      if (connection.deviceId === deviceId) {
        this.send(connection, 'device.revoked', { deviceId });
        connection.socket.close(4003, 'device revoked');
      } else {
        this.send(connection, 'presence.changed', {
          deviceId,
          connected: false,
          reason: 'revoked'
        });
      }
    }
  }

  private async accept(socket: WebSocket, request: FastifyRequest): Promise<void> {
    try {
      const query = z
        .object({
          deviceId: z.string().length(26),
          timestamp: z.string().datetime(),
          nonce: z.string().min(16).max(128),
          signature: z.string().min(16),
          version: z.literal(websocketProtocolVersion)
        })
        .parse(request.query);
      const device = await authenticateDeviceCredential(
        {
          ...query,
          message: canonicalWebSocketHandshake(query.timestamp, query.nonce, query.version)
        },
        this.prisma,
        this.config
      );
      const connection: Connection = {
        id: ulid(),
        ownerId: device.ownerId,
        deviceId: device.id,
        socket,
        lastSeenAt: Date.now(),
        state: 'background',
        reminderCapable: false,
        cursor: 0n
      };
      this.connections.set(connection.id, connection);
      socket.on('message', (data) => this.onMessage(connection, data.toString()));
      socket.on('close', () => this.remove(connection));
      socket.on('error', () => this.remove(connection));
      this.send(connection, 'connection.ready', {
        connectionId: connection.id,
        heartbeatIntervalSeconds: Math.max(1, Math.floor(this.heartbeatIntervalMs / 1000))
      });
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(400, 'WEBSOCKET_HANDSHAKE_INVALID', 'WebSocket handshake is invalid.');
      this.sendRaw(socket, 'error', {
        code: apiError.code,
        message: apiError.message
      });
      socket.close(4001, apiError.code);
    }
  }

  private onMessage(connection: Connection, raw: string): void {
    try {
      const message = websocketClientMessage.parse(JSON.parse(raw));
      connection.lastSeenAt = Date.now();
      this.handle(connection, message);
    } catch {
      this.send(connection, 'error', {
        code: 'WEBSOCKET_MESSAGE_INVALID',
        message: 'Message does not match the versioned WebSocket JSON Schema.'
      });
    }
  }

  private handle(connection: Connection, message: ClientMessage): void {
    if (message.type === 'presence.hello') {
      connection.state = message.payload.state;
      connection.reminderCapable = message.payload.reminderCapable;
      this.broadcastPresence(connection.ownerId);
      return;
    }
    if (message.type === 'presence.heartbeat') {
      if (message.payload.state) connection.state = message.payload.state;
      this.send(connection, 'presence.heartbeat-ack', {}, message.requestId);
      return;
    }
    if (message.type === 'sync.subscribe') {
      connection.cursor = BigInt(message.payload.cursor);
      this.send(
        connection,
        'sync.subscribed',
        { cursor: message.payload.cursor },
        message.requestId
      );
      return;
    }
    if (message.type === 'reminder.claim-release') {
      const key = this.claimKey(connection.ownerId, message.payload.occurrenceId);
      const claim = this.claims.get(key);
      if (claim?.deviceId === connection.deviceId && claim.claimId === message.payload.claimId) {
        this.claims.delete(key);
        this.broadcast(connection.ownerId, 'reminder.claim-released', {
          occurrenceId: message.payload.occurrenceId,
          claimId: claim.claimId,
          deviceId: connection.deviceId
        });
      }
      return;
    }
    this.claimReminder(connection, message);
  }

  private claimReminder(connection: Connection, message: z.infer<typeof claimRequest>): void {
    const key = this.claimKey(connection.ownerId, message.payload.occurrenceId);
    const existing = this.claims.get(key);
    const now = Date.now();
    if (existing && existing.expiresAt > now) {
      this.send(
        connection,
        existing.deviceId === connection.deviceId
          ? 'reminder.claim-granted'
          : 'reminder.claim-denied',
        {
          occurrenceId: message.payload.occurrenceId,
          claimId: existing.claimId,
          claimedByDeviceId: existing.deviceId,
          expiresAt: new Date(existing.expiresAt).toISOString()
        },
        message.requestId
      );
      return;
    }
    this.claims.delete(key);
    const eligible = [...this.connections.values()]
      .filter(
        (candidate) =>
          candidate.ownerId === connection.ownerId &&
          candidate.reminderCapable &&
          candidate.socket.readyState === candidate.socket.OPEN
      )
      .sort(
        (left, right) =>
          Number(right.state === 'foreground') - Number(left.state === 'foreground') ||
          right.lastSeenAt - left.lastSeenAt ||
          left.deviceId.localeCompare(right.deviceId)
      );
    const winner = eligible[0];
    if (!winner || winner.deviceId !== connection.deviceId) {
      this.send(
        connection,
        'reminder.claim-denied',
        {
          occurrenceId: message.payload.occurrenceId,
          claimedByDeviceId: winner?.deviceId ?? null,
          reason: winner ? 'higher-priority-device' : 'device-not-reminder-capable'
        },
        message.requestId
      );
      return;
    }
    const claim: Claim = {
      claimId: ulid(),
      ownerId: connection.ownerId,
      occurrenceId: message.payload.occurrenceId,
      deviceId: connection.deviceId,
      expiresAt: now + message.payload.claimTtlSeconds * 1000
    };
    this.claims.set(key, claim);
    this.broadcast(connection.ownerId, 'reminder.claim-granted', {
      occurrenceId: claim.occurrenceId,
      claimId: claim.claimId,
      claimedByDeviceId: claim.deviceId,
      expiresAt: new Date(claim.expiresAt).toISOString()
    });
  }

  private expireConnections(): void {
    const now = Date.now();
    for (const connection of this.connections.values()) {
      if (now - connection.lastSeenAt > this.heartbeatTimeoutMs)
        connection.socket.close(4000, 'heartbeat timeout');
    }
    for (const [key, claim] of this.claims) if (claim.expiresAt <= now) this.claims.delete(key);
  }

  private remove(connection: Connection): void {
    if (!this.connections.delete(connection.id)) return;
    this.broadcastPresence(connection.ownerId);
  }

  private broadcastPresence(ownerId: string): void {
    const devices = [...this.connections.values()]
      .filter((connection) => connection.ownerId === ownerId)
      .map((connection) => ({
        deviceId: connection.deviceId,
        state: connection.state,
        reminderCapable: connection.reminderCapable,
        lastSeenAt: new Date(connection.lastSeenAt).toISOString()
      }));
    this.broadcast(ownerId, 'presence.snapshot', { devices });
  }

  private broadcast(
    ownerId: string,
    type: string,
    payload: Record<string, unknown>,
    predicate: (connection: Connection) => boolean = () => true
  ): void {
    for (const connection of this.connections.values())
      if (connection.ownerId === ownerId && predicate(connection))
        this.send(connection, type, payload);
  }

  private send(
    connection: Connection,
    type: string,
    payload: Record<string, unknown>,
    requestId?: string
  ): void {
    if (connection.socket.readyState !== connection.socket.OPEN) return;
    connection.socket.send(JSON.stringify(this.frame(type, payload, requestId)));
  }

  private sendRaw(socket: WebSocket, type: string, payload: Record<string, unknown>): void {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(this.frame(type, payload)));
  }

  private frame(
    type: string,
    payload: Record<string, unknown>,
    requestId?: string
  ): ServerEnvelope {
    return {
      version: websocketProtocolVersion,
      type,
      eventId: ulid(),
      sentAt: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
      payload
    };
  }

  private claimKey(ownerId: string, occurrenceId: string): string {
    return `${ownerId}:${occurrenceId}`;
  }
}
