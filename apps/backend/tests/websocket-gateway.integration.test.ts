import { generateKeyPairSync, sign } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { ulid } from 'ulid';

import { buildApp } from '../src/app.js';
import { canonicalRequest } from '../src/lib/crypto.js';
import {
  canonicalWebSocketHandshake,
  websocketProtocolVersion
} from '../src/services/websocket-gateway.js';

const databaseUrl = process.env.FOCUSLOG_INTEGRATION_DATABASE_URL;
const integration = describe.runIf(Boolean(databaseUrl));

interface Identity {
  ownerId: string;
  deviceId: string;
  publicKey: string;
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];
}

function identity(ownerId = ulid()): Identity {
  const keys = generateKeyPairSync('ed25519');
  return {
    ownerId,
    deviceId: ulid(),
    publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey: keys.privateKey
  };
}

function signedHeaders(
  method: string,
  path: string,
  body: unknown,
  device: Identity
): Record<string, string> {
  const timestamp = new Date().toISOString();
  const nonce = ulid();
  return {
    'x-focuslog-device-id': device.deviceId,
    'x-focuslog-timestamp': timestamp,
    'x-focuslog-nonce': nonce,
    'x-focuslog-signature': sign(
      null,
      Buffer.from(canonicalRequest(method, path, timestamp, nonce, body)),
      device.privateKey
    ).toString('base64url')
  };
}

function connectionUrl(baseUrl: string, device: Identity): string {
  const timestamp = new Date().toISOString();
  const nonce = ulid();
  const signature = sign(
    null,
    Buffer.from(canonicalWebSocketHandshake(timestamp, nonce)),
    device.privateKey
  ).toString('base64url');
  const query = new URLSearchParams({
    deviceId: device.deviceId,
    timestamp,
    nonce,
    signature,
    version: websocketProtocolVersion
  });
  return `${baseUrl.replace('http:', 'ws:')}/api/v1/ws?${query}`;
}

function send(socket: WebSocket, type: string, payload: Record<string, unknown>): string {
  const requestId = ulid();
  socket.send(
    JSON.stringify({
      version: websocketProtocolVersion,
      type,
      requestId,
      sentAt: new Date().toISOString(),
      payload
    })
  );
  return requestId;
}

interface TestFrame {
  readonly version: string;
  readonly type: string;
  readonly requestId?: string;
  readonly payload: {
    readonly devices?: Array<{ deviceId: string }>;
    readonly occurrenceId?: string;
    readonly claimedByDeviceId?: string | null;
    readonly nextCursor?: string;
    readonly sourceDeviceId?: string;
    readonly code?: string;
    readonly heartbeatIntervalSeconds?: number;
  };
}

function nextMessage(
  socket: WebSocket,
  predicate: (frame: TestFrame) => boolean,
  timeoutMs = 5_000
): Promise<TestFrame> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', listener);
      reject(new Error('Timed out waiting for WebSocket frame.'));
    }, timeoutMs);
    const listener = (data: WebSocket.RawData) => {
      const frame = JSON.parse(data.toString()) as TestFrame;
      if (!predicate(frame)) return;
      clearTimeout(timer);
      socket.off('message', listener);
      resolve(frame);
    };
    socket.on('message', listener);
  });
}

integration('authenticated WebSocket gateway', () => {
  const owner = identity();
  const peer = identity(owner.ownerId);
  let prisma: PrismaClient;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let baseUrl: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
    await prisma.owner.create({ data: { id: owner.ownerId } });
    await prisma.ownerSyncState.create({ data: { ownerId: owner.ownerId } });
    await prisma.device.createMany({
      data: [
        {
          id: owner.deviceId,
          ownerId: owner.ownerId,
          publicKey: owner.publicKey,
          fingerprint: ulid(),
          platform: 'WINDOWS',
          isOwnerDevice: true
        },
        {
          id: peer.deviceId,
          ownerId: owner.ownerId,
          publicKey: peer.publicKey,
          fingerprint: ulid(),
          platform: 'ANDROID'
        }
      ]
    });
    await prisma.syncCursor.createMany({
      data: [
        { ownerId: owner.ownerId, deviceId: owner.deviceId },
        { ownerId: owner.ownerId, deviceId: peer.deviceId }
      ]
    });
    app = await buildApp(
      {
        NODE_ENV: 'test',
        BACKEND_HOST: '127.0.0.1',
        BACKEND_PORT: 0,
        DATABASE_URL: databaseUrl!,
        LOG_LEVEL: 'error',
        API_RATE_LIMIT_MAX: 1000,
        DEVICE_AUTH_MAX_AGE_SECONDS: 300,
        REQUIRE_TLS: false
      },
      prisma
    );
    baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  }, 60_000);

  afterAll(async () => {
    await prisma.checkInRevision.deleteMany({ where: { checkIn: { ownerId: owner.ownerId } } });
    await prisma.checkIn.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.conflict.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.syncOperation.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.deviceRequestNonce.deleteMany({
      where: { device: { ownerId: owner.ownerId } }
    });
    await prisma.syncCursor.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.device.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.ownerSyncState.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.owner.delete({ where: { id: owner.ownerId } });
    await app.close();
  }, 60_000);

  it('authenticates, tracks presence and heartbeat, coordinates claims, notifies sync, and reconnects', async () => {
    const ownerSocket = new WebSocket(connectionUrl(baseUrl, owner));
    await nextMessage(ownerSocket, (frame) => frame.type === 'connection.ready');
    const peerSocket = new WebSocket(connectionUrl(baseUrl, peer));
    await nextMessage(peerSocket, (frame) => frame.type === 'connection.ready');

    const ownerPresence = nextMessage(
      ownerSocket,
      (frame) =>
        frame.type === 'presence.snapshot' &&
        frame.payload.devices?.some((device) => device.deviceId === peer.deviceId) === true
    );
    send(ownerSocket, 'presence.hello', {
      state: 'background',
      reminderCapable: true,
      clientVersion: 'test'
    });
    send(peerSocket, 'presence.hello', {
      state: 'foreground',
      reminderCapable: true,
      clientVersion: 'test'
    });
    expect((await ownerPresence).payload.devices).toHaveLength(2);

    const heartbeatRequest = send(peerSocket, 'presence.heartbeat', { state: 'foreground' });
    expect(
      await nextMessage(
        peerSocket,
        (frame) => frame.type === 'presence.heartbeat-ack' && frame.requestId === heartbeatRequest
      )
    ).toMatchObject({ version: '1', type: 'presence.heartbeat-ack' });

    const occurrenceId = ulid();
    const deniedPromise = nextMessage(
      ownerSocket,
      (frame) =>
        frame.type === 'reminder.claim-denied' && frame.payload.occurrenceId === occurrenceId
    );
    send(ownerSocket, 'reminder.claim-request', { occurrenceId, claimTtlSeconds: 30 });
    expect((await deniedPromise).payload.claimedByDeviceId).toBe(peer.deviceId);

    const grantedPromise = nextMessage(
      ownerSocket,
      (frame) =>
        frame.type === 'reminder.claim-granted' && frame.payload.occurrenceId === occurrenceId
    );
    send(peerSocket, 'reminder.claim-request', { occurrenceId, claimTtlSeconds: 30 });
    const granted = await grantedPromise;
    expect(granted.payload).toMatchObject({ claimedByDeviceId: peer.deviceId });

    const operation = {
      operationId: ulid(),
      deviceSequence: 1,
      entityType: 'check_in',
      entityId: ulid(),
      kind: 'check_in.create',
      payload: {
        revisionId: ulid(),
        body: 'WebSocket sync notification integration test',
        submittedAt: new Date().toISOString(),
        timezoneId: 'UTC',
        reminderCompletion: false
      },
      occurredAt: new Date().toISOString()
    };
    const notification = nextMessage(
      peerSocket,
      (frame) => frame.type === 'sync.available' && frame.payload.sourceDeviceId === owner.deviceId
    );
    const push = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/push',
      headers: signedHeaders('POST', '/api/v1/sync/push', { operations: [operation] }, owner),
      payload: { operations: [operation] }
    });
    expect(push.statusCode, push.body).toBe(200);
    expect((await notification).payload.nextCursor).toBe('1');

    peerSocket.close();
    await new Promise<void>((resolve) => peerSocket.once('close', () => resolve()));
    const reconnected = new WebSocket(connectionUrl(baseUrl, peer));
    expect(
      await nextMessage(reconnected, (frame) => frame.type === 'connection.ready')
    ).toMatchObject({
      version: '1',
      payload: { heartbeatIntervalSeconds: expect.any(Number) }
    });
    reconnected.close();
    ownerSocket.close();
  });

  it('rejects an invalid signed handshake', async () => {
    const url = new URL(connectionUrl(baseUrl, owner));
    url.searchParams.set('signature', 'invalid-signature-value');
    const socket = new WebSocket(url);
    const error = await nextMessage(socket, (frame) => frame.type === 'error');
    expect(error.payload.code).toBe('DEVICE_SIGNATURE_INVALID');
    await new Promise<void>((resolve) => socket.once('close', () => resolve()));
  });
});
