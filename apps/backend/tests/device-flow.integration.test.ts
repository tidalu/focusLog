import { generateKeyPairSync, sign } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulid';

import { buildApp } from '../src/app.js';
import { canonicalRequest } from '../src/lib/crypto.js';

const databaseUrl = process.env.FOCUSLOG_INTEGRATION_DATABASE_URL;
const integration = describe.runIf(Boolean(databaseUrl));

interface TestIdentity {
  ownerId: string;
  deviceId: string;
  publicKey: string;
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];
  fingerprint: string;
}

function identity(ownerId = ulid()): TestIdentity {
  const keys = generateKeyPairSync('ed25519');
  return {
    ownerId,
    deviceId: ulid(),
    publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey: keys.privateKey,
    fingerprint: ulid()
  };
}

function proof(action: string, device: TestIdentity): string {
  return sign(
    null,
    Buffer.from(`FOCUSLOG:${action}:${device.fingerprint}:${device.publicKey}`),
    device.privateKey
  ).toString('base64url');
}

function signedHeaders(
  method: string,
  url: string,
  body: unknown,
  device: TestIdentity
): Record<string, string> {
  const timestamp = new Date().toISOString();
  const nonce = ulid();
  return {
    'x-focuslog-device-id': device.deviceId,
    'x-focuslog-timestamp': timestamp,
    'x-focuslog-nonce': nonce,
    'x-focuslog-signature': sign(
      null,
      Buffer.from(canonicalRequest(method, url, timestamp, nonce, body)),
      device.privateKey
    ).toString('base64url')
  };
}

integration('device identity, pairing, authenticated synchronization, and revocation', () => {
  let prisma: PrismaClient;
  const owner = identity();
  const candidate = identity();
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
    app = await buildApp(
      {
        NODE_ENV: 'test',
        BACKEND_HOST: '127.0.0.1',
        BACKEND_PORT: 3000,
        DATABASE_URL: databaseUrl!,
        LOG_LEVEL: 'error',
        API_RATE_LIMIT_MAX: 120,
        DEVICE_AUTH_MAX_AGE_SECONDS: 300,
        REQUIRE_TLS: false
      },
      prisma
    );
  }, 60_000);

  afterAll(async () => {
    await prisma.logSection.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.checkInRevision.deleteMany({
      where: { checkIn: { ownerId: owner.ownerId } }
    });
    await prisma.checkIn.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.tombstone.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.conflict.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.syncOperation.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.syncCursor.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.devicePairing.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.device.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.setting.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.ownerSyncState.deleteMany({ where: { ownerId: owner.ownerId } });
    await prisma.owner.deleteMany({ where: { id: owner.ownerId } });
    await app.close();
  }, 60_000);

  it('bootstraps, pairs, authenticates, pushes, pulls, and revokes', async () => {
    const bootstrapBody = {
      ownerId: owner.ownerId,
      deviceId: owner.deviceId,
      publicKey: owner.publicKey,
      fingerprint: owner.fingerprint,
      platform: 'WINDOWS',
      proof: proof('bootstrap', owner)
    };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/devices/bootstrap',
          payload: bootstrapBody
        })
      ).statusCode
    ).toBe(201);

    const codeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/devices/pairing-codes',
      headers: signedHeaders('POST', '/api/v1/devices/pairing-codes', {}, owner),
      payload: {}
    });
    expect(codeResponse.statusCode).toBe(201);
    const code = codeResponse.json<{ pairingId: string; code: string }>();

    const claimBody = {
      code: code.code,
      deviceId: candidate.deviceId,
      publicKey: candidate.publicKey,
      fingerprint: candidate.fingerprint,
      platform: 'ANDROID',
      proof: proof('pairing-claim', candidate)
    };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/devices/pairing-codes/claim',
          payload: claimBody
        })
      ).statusCode
    ).toBe(201);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/devices/pairing-requests/${code.pairingId}/approve`,
          headers: signedHeaders(
            'POST',
            `/api/v1/devices/pairing-requests/${code.pairingId}/approve`,
            {},
            owner
          ),
          payload: {}
        })
      ).statusCode
    ).toBe(200);

    const consumeBody = {
      proof: sign(
        null,
        Buffer.from(`FOCUSLOG:pairing-consume:${code.pairingId}:${candidate.fingerprint}`),
        candidate.privateKey
      ).toString('base64url')
    };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/devices/pairing-requests/${code.pairingId}/consume`,
          payload: consumeBody
        })
      ).statusCode
    ).toBe(201);

    const submittedAt = new Date();
    const operation = {
      operationId: ulid(),
      deviceSequence: 1,
      entityType: 'check_in',
      entityId: ulid(),
      kind: 'check_in.create',
      payload: {
        revisionId: ulid(),
        body: 'Authenticated paired-device check-in',
        submittedAt: submittedAt.toISOString(),
        timezoneId: 'UTC',
        reminderCompletion: false
      },
      occurredAt: new Date().toISOString()
    };
    const push = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/push',
      headers: signedHeaders('POST', '/api/v1/sync/push', { operations: [operation] }, candidate),
      payload: { operations: [operation] }
    });
    expect(push.statusCode, push.body).toBe(200);
    expect(push.json<{ results: Array<{ status: string }> }>().results[0]?.status).toBe('accepted');

    const pull = await app.inject({
      method: 'GET',
      url: '/api/v1/sync/pull?cursor=0',
      headers: signedHeaders('GET', '/api/v1/sync/pull?cursor=0', undefined, owner)
    });
    expect(pull.statusCode).toBe(200);
    expect(
      pull
        .json<{ changes: Array<{ operationId: string }> }>()
        .changes.map((change) => change.operationId)
    ).toContain(operation.operationId);

    const reportDay = submittedAt.toISOString().slice(0, 10);
    const reportUrl = `/api/v1/reports/daily?day=${reportDay}&timezoneId=UTC`;
    const dailyReport = await app.inject({
      method: 'GET',
      url: reportUrl,
      headers: signedHeaders('GET', reportUrl, undefined, owner)
    });
    expect(dailyReport.statusCode, dailyReport.body).toBe(200);
    expect(dailyReport.json()).toMatchObject({
      day: reportDay,
      timezoneId: 'UTC',
      dayDurationMinutes: 1440,
      timeline: expect.arrayContaining([
        expect.objectContaining({ id: operation.entityId, kind: 'CHECK_IN' })
      ])
    });

    const reportYear = submittedAt.getUTCFullYear();
    const heatmapUrl = `/api/v1/reports/heatmap?year=${reportYear}&timezoneId=UTC`;
    const heatmap = await app.inject({
      method: 'GET',
      url: heatmapUrl,
      headers: signedHeaders('GET', heatmapUrl, undefined, owner)
    });
    expect(heatmap.statusCode, heatmap.body).toBe(200);
    expect(heatmap.json<{ days: Array<{ day: string; value: number }> }>().days).toHaveLength(
      new Date(Date.UTC(reportYear, 1, 29)).getUTCMonth() === 1 ? 366 : 365
    );
    expect(
      heatmap
        .json<{ days: Array<{ day: string; value: number }> }>()
        .days.find((day) => day.day === reportDay)?.value
    ).toBe(1);

    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/devices/${candidate.deviceId}/revoke`,
          headers: signedHeaders('POST', `/api/v1/devices/${candidate.deviceId}/revoke`, {}, owner),
          payload: {}
        })
      ).statusCode
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/sync/pull?cursor=0',
          headers: signedHeaders('GET', '/api/v1/sync/pull?cursor=0', undefined, candidate)
        })
      ).statusCode
    ).toBe(401);

    const deletionBody = { confirmation: 'DELETE ALL FOCUSLOG DATA' };
    const deletion = await app.inject({
      method: 'DELETE',
      url: '/api/v1/data',
      headers: signedHeaders('DELETE', '/api/v1/data', deletionBody, owner),
      payload: deletionBody
    });
    expect(deletion.statusCode, deletion.body).toBe(200);
    expect(await prisma.owner.findUnique({ where: { id: owner.ownerId } })).toBeNull();
  });
});
