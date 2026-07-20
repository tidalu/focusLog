import { generateKeyPairSync, sign } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulid';

import { buildApp } from '../src/app.js';
import { canonicalRequest } from '../src/lib/crypto.js';

const databaseUrl = process.env.FOCUSLOG_INTEGRATION_DATABASE_URL;
const integration = describe.runIf(Boolean(databaseUrl));

integration('PostgreSQL full-text search', () => {
  const ownerId = ulid();
  const deviceId = ulid();
  const modeId = ulid();
  const sessionId = ulid();
  const categoryId = ulid();
  const tagId = ulid();
  const keys = generateKeyPairSync('ed25519');
  let prisma: PrismaClient;
  let app: Awaited<ReturnType<typeof buildApp>>;

  function headers(path: string): Record<string, string> {
    const timestamp = new Date().toISOString();
    const nonce = ulid();
    return {
      'x-focuslog-device-id': deviceId,
      'x-focuslog-timestamp': timestamp,
      'x-focuslog-nonce': nonce,
      'x-focuslog-signature': sign(
        null,
        Buffer.from(canonicalRequest('GET', path, timestamp, nonce, undefined)),
        keys.privateKey
      ).toString('base64url')
    };
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
    await prisma.owner.create({ data: { id: ownerId } });
    await prisma.device.create({
      data: {
        id: deviceId,
        ownerId,
        publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        fingerprint: ulid(),
        platform: 'WINDOWS',
        isOwnerDevice: true
      }
    });
    await prisma.focusMode.create({
      data: {
        id: modeId,
        ownerId,
        name: 'Search benchmark mode',
        intervalMinutes: 30,
        policy: {},
        version: ulid()
      }
    });
    await prisma.focusSession.create({
      data: {
        id: sessionId,
        ownerId,
        focusModeId: modeId,
        name: 'Architecture session',
        schedulePolicy: {},
        timezoneId: 'UTC',
        startedAt: new Date(),
        version: ulid()
      }
    });
    await prisma.category.create({
      data: { id: categoryId, ownerId, name: 'Deep work', version: ulid() }
    });
    await prisma.tag.create({
      data: { id: tagId, ownerId, name: 'Architecture', version: ulid() }
    });
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "check_ins" (
        id, "ownerId", "focusSessionId", "categoryId", "currentRevisionId",
        "submittedAt", "timezoneId", version, "createdAt", "updatedAt"
      )
      SELECT
        ('C' || lpad(value::text, 25, '0'))::varchar(26),
        ${ownerId},
        CASE WHEN value = 500 THEN ${sessionId} ELSE NULL END,
        CASE WHEN value = 500 THEN ${categoryId} ELSE NULL END,
        ('R' || lpad(value::text, 25, '0'))::varchar(26),
        now() - (value || ' seconds')::interval,
        'UTC',
        ('R' || lpad(value::text, 25, '0'))::varchar(26),
        now(),
        now()
      FROM generate_series(1, 10000) value
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "check_in_revisions" (
        id, "checkInId", body, "operationId", "createdAt"
      )
      SELECT
        ('R' || lpad(value::text, 25, '0'))::varchar(26),
        ('C' || lpad(value::text, 25, '0'))::varchar(26),
        CASE
          WHEN value = 500 THEN 'needle needle needle architecture planning'
          WHEN value % 100 = 0 THEN 'needle architecture planning'
          ELSE 'ordinary focus activity ' || value
        END,
        ('O' || lpad(value::text, 25, '0'))::varchar(26),
        now()
      FROM generate_series(1, 10000) value
    `);
    await prisma.checkInTag.create({
      data: { checkInId: `C${'500'.padStart(25, '0')}`, tagId }
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
  }, 60_000);

  afterAll(async () => {
    await prisma.checkInTag.deleteMany({ where: { checkIn: { ownerId } } });
    await prisma.checkInRevision.deleteMany({ where: { checkIn: { ownerId } } });
    await prisma.checkIn.deleteMany({ where: { ownerId } });
    await prisma.deviceRequestNonce.deleteMany({ where: { deviceId } });
    await prisma.focusSession.deleteMany({ where: { ownerId } });
    await prisma.focusMode.deleteMany({ where: { ownerId } });
    await prisma.tag.deleteMany({ where: { ownerId } });
    await prisma.category.deleteMany({ where: { ownerId } });
    await prisma.device.deleteMany({ where: { ownerId } });
    await prisma.owner.delete({ where: { id: ownerId } });
    await app.close();
  }, 60_000);

  it('ranks matches and applies tag/category/session filters', async () => {
    const path = `/api/v1/search?query=needle&tagId=${tagId}&categoryId=${categoryId}&sessionId=${sessionId}`;
    const response = await app.inject({ method: 'GET', url: path, headers: headers(path) });
    expect(response.statusCode, response.body).toBe(200);
    const results = response.json<{ results: Array<{ id: string; rank: number }> }>().results;
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: `C${'500'.padStart(25, '0')}`,
      rank: expect.any(Number)
    });
  });

  it('searches 10,000 server records within the benchmark budget', async () => {
    const path = '/api/v1/search?query=needle%20architecture';
    const started = performance.now();
    const response = await app.inject({ method: 'GET', url: path, headers: headers(path) });
    const elapsed = performance.now() - started;
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<{ results: unknown[] }>().results).toHaveLength(100);
    expect(elapsed).toBeLessThan(2_000);
  });
});
