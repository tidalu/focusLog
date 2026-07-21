import { generateKeyPairSync, sign } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulid';

import { openDesktopDatabase } from '../../desktop/electron/database/database.js';
import {
  createOfflineCheckIn,
  deleteOfflineCheckIn,
  reviseOfflineCheckIn
} from '../../desktop/electron/database/local-sync.js';
import { drainOutbox, type SyncTransport } from '../../desktop/electron/database/sync-worker.js';
import {
  completeReminderOffline,
  queueReminderSchedule,
  transitionReminderOffline
} from '../../desktop/electron/reminders/operations.js';
import { buildApp } from '../src/app.js';
import { canonicalRequest } from '../src/lib/crypto.js';

const databaseUrl = process.env.FOCUSLOG_INTEGRATION_DATABASE_URL;
const integration = describe.runIf(Boolean(databaseUrl));

interface Identity {
  ownerId: string;
  deviceId: string;
  publicKey: string;
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];
  fingerprint: string;
}

function identity(ownerId = ulid()): Identity {
  const keys = generateKeyPairSync('ed25519');
  return {
    ownerId,
    deviceId: ulid(),
    publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey: keys.privateKey,
    fingerprint: ulid()
  };
}

function proof(action: string, device: Identity): string {
  return sign(
    null,
    Buffer.from(`FOCUSLOG:${action}:${device.fingerprint}:${device.publicKey}`),
    device.privateKey
  ).toString('base64url');
}

class RealSyncTransport implements SyncTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly device: Identity
  ) {}

  async push(operations: unknown[]) {
    const normalized = operations.map((value) => {
      const operation = value as Record<string, unknown>;
      return {
        operationId: operation.operation_id,
        deviceSequence: operation.device_sequence,
        entityType: operation.entity_type,
        entityId: operation.entity_id,
        kind: operation.kind,
        ...(operation.base_version ? { baseVersion: operation.base_version } : {}),
        payload: JSON.parse(String(operation.payload_json)) as Record<string, unknown>,
        occurredAt: operation.occurred_at
      };
    });
    return this.request<Awaited<ReturnType<SyncTransport['push']>>>('POST', '/api/v1/sync/push', {
      operations: normalized
    });
  }

  pull(cursor: string) {
    return this.request<{
      changes: Array<Record<string, unknown>>;
      nextCursor: string;
    }>('GET', `/api/v1/sync/pull?cursor=${cursor}`);
  }

  async acknowledge(cursor: string): Promise<void> {
    await this.request('POST', '/api/v1/sync/ack', { cursor });
  }

  request<T = Record<string, unknown>>(
    method: string,
    path: string,
    body?: unknown,
    authenticated = true
  ): Promise<T> {
    const timestamp = new Date().toISOString();
    const nonce = ulid();
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (authenticated) {
      headers['x-focuslog-device-id'] = this.device.deviceId;
      headers['x-focuslog-timestamp'] = timestamp;
      headers['x-focuslog-nonce'] = nonce;
      headers['x-focuslog-signature'] = sign(
        null,
        Buffer.from(canonicalRequest(method, path, timestamp, nonce, body)),
        this.device.privateKey
      ).toString('base64url');
    }
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(async (response) => {
      if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
      return response.json() as Promise<T>;
    });
  }
}

function initializeLocalDatabase(device: Identity, isOwnerDevice: boolean) {
  const database = openDesktopDatabase(':memory:');
  const now = new Date().toISOString();
  database
    .prepare('INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run(device.ownerId, now, now);
  database
    .prepare(
      "INSERT INTO devices (id, owner_id, public_key, fingerprint, platform, display_name, is_owner_device, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)"
    )
    .run(
      device.deviceId,
      device.ownerId,
      device.publicKey,
      device.fingerprint,
      isOwnerDevice ? 'windows' : 'android',
      isOwnerDevice ? 'Test desktop' : 'Test Android',
      isOwnerDevice ? 1 : 0,
      now,
      now
    );
  return database;
}

integration('real offline, cross-device, conflict, and tombstone synchronization', () => {
  const owner = identity();
  const candidateBeforePairing = identity();
  let candidate: Identity;
  let prisma: PrismaClient;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let baseUrl: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
    app = await buildApp(
      {
        NODE_ENV: 'test',
        BACKEND_HOST: '127.0.0.1',
        BACKEND_PORT: 0,
        DATABASE_URL: databaseUrl!,
        LOG_LEVEL: 'error',
        API_RATE_LIMIT_MAX: 500,
        DEVICE_AUTH_MAX_AGE_SECONDS: 300,
        REQUIRE_TLS: false
      },
      prisma
    );
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.checkInRevision.deleteMany({ where: { checkIn: { ownerId: owner.ownerId } } });
      await prisma.checkIn.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.reminderTransition.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.reminderOccurrence.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.focusSession.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.focusMode.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.tombstone.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.conflict.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.syncOperation.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.syncCursor.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.devicePairing.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.device.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.category.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.setting.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.ownerSyncState.deleteMany({ where: { ownerId: owner.ownerId } });
      await prisma.owner.deleteMany({ where: { id: owner.ownerId } });
    }
    if (app) await app.close();
  });

  it('retries a real offline check-in, transfers Android data, and preserves concurrent edits', async () => {
    const desktopDatabase = initializeLocalDatabase(owner, true);
    const offline = createOfflineCheckIn(desktopDatabase, {
      ownerId: owner.ownerId,
      deviceId: owner.deviceId,
      body: '<work> Desktop check-in created while the backend is unavailable',
      timezoneId: 'UTC'
    });

    await drainOutbox(
      desktopDatabase,
      new RealSyncTransport('http://127.0.0.1:1', owner),
      new Date()
    );
    expect(
      desktopDatabase.prepare('SELECT attempts, acknowledged_at FROM outbox_operations').get()
    ).toMatchObject({ attempts: 1, acknowledged_at: null });

    baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
    const ownerTransport = new RealSyncTransport(baseUrl, owner);
    await ownerTransport.request(
      'POST',
      '/api/v1/devices/bootstrap',
      {
        ownerId: owner.ownerId,
        deviceId: owner.deviceId,
        publicKey: owner.publicKey,
        fingerprint: owner.fingerprint,
        platform: 'WINDOWS',
        displayName: 'Test desktop',
        proof: proof('bootstrap', owner)
      },
      false
    );

    const pairing = await ownerTransport.request<{ pairingId: string; code: string }>(
      'POST',
      '/api/v1/devices/pairing-codes',
      {}
    );
    await ownerTransport.request(
      'POST',
      '/api/v1/devices/pairing-codes/claim',
      {
        code: pairing.code,
        deviceId: candidateBeforePairing.deviceId,
        publicKey: candidateBeforePairing.publicKey,
        fingerprint: candidateBeforePairing.fingerprint,
        platform: 'ANDROID',
        displayName: 'Test Android',
        proof: proof('pairing-claim', candidateBeforePairing)
      },
      false
    );
    await ownerTransport.request(
      'POST',
      `/api/v1/devices/pairing-requests/${pairing.pairingId}/approve`,
      {}
    );
    await ownerTransport.request(
      'POST',
      `/api/v1/devices/pairing-requests/${pairing.pairingId}/consume`,
      {
        proof: sign(
          null,
          Buffer.from(
            `FOCUSLOG:pairing-consume:${pairing.pairingId}:${candidateBeforePairing.fingerprint}`
          ),
          candidateBeforePairing.privateKey
        ).toString('base64url')
      },
      false
    );
    candidate = { ...candidateBeforePairing, ownerId: owner.ownerId };
    const androidDatabase = initializeLocalDatabase(candidate, false);
    const androidTransport = new RealSyncTransport(baseUrl, candidate);

    await drainOutbox(desktopDatabase, ownerTransport, new Date(Date.now() + 5_000));
    const retryFailure = desktopDatabase
      .prepare('SELECT message FROM sync_failures ORDER BY recorded_at DESC LIMIT 1')
      .get() as { message?: string } | undefined;
    expect(
      await prisma.checkIn.findUnique({
        where: { id: offline.checkInId },
        include: { revisions: true, category: true }
      }),
      retryFailure?.message
    ).toMatchObject({
      id: offline.checkInId,
      category: { name: 'work' },
      revisions: [{ body: '<work> Desktop check-in created while the backend is unavailable' }]
    });
    const duplicate = await ownerTransport.push(
      desktopDatabase
        .prepare('SELECT * FROM outbox_operations WHERE operation_id = ?')
        .all(offline.operationId)
    );
    expect(duplicate.results).toMatchObject([
      { operationId: offline.operationId, status: 'duplicate' }
    ]);
    expect(await prisma.checkInRevision.count({ where: { checkInId: offline.checkInId } })).toBe(1);

    await drainOutbox(androidDatabase, androidTransport);
    expect(
      androidDatabase
        .prepare(
          'SELECT check_ins.id, categories.name FROM check_ins LEFT JOIN categories ON categories.id = check_ins.category_id WHERE check_ins.id = ?'
        )
        .get(offline.checkInId)
    ).toMatchObject({ id: offline.checkInId, name: 'work' });

    const androidCheckIn = createOfflineCheckIn(androidDatabase, {
      ownerId: owner.ownerId,
      deviceId: candidate.deviceId,
      body: 'Android check-in synchronized to the desktop',
      timezoneId: 'UTC'
    });
    await drainOutbox(androidDatabase, androidTransport);
    await drainOutbox(desktopDatabase, ownerTransport);
    expect(
      desktopDatabase
        .prepare(
          'SELECT body FROM check_in_revisions WHERE check_in_id = ? ORDER BY created_at DESC LIMIT 1'
        )
        .get(androidCheckIn.checkInId)
    ).toMatchObject({ body: 'Android check-in synchronized to the desktop' });

    reviseOfflineCheckIn(desktopDatabase, {
      ownerId: owner.ownerId,
      deviceId: owner.deviceId,
      checkInId: offline.checkInId,
      body: 'Desktop concurrent edit is preserved'
    });
    reviseOfflineCheckIn(androidDatabase, {
      ownerId: owner.ownerId,
      deviceId: candidate.deviceId,
      checkInId: offline.checkInId,
      body: 'Android concurrent edit is preserved'
    });
    await drainOutbox(desktopDatabase, ownerTransport);
    await drainOutbox(androidDatabase, androidTransport);
    await drainOutbox(desktopDatabase, ownerTransport);

    expect(await prisma.conflict.count({ where: { ownerId: owner.ownerId } })).toBe(1);
    expect(
      (
        androidDatabase
          .prepare("SELECT COUNT(*) AS count FROM conflicts WHERE status = 'OPEN'")
          .get() as { count: number }
      ).count
    ).toBeGreaterThan(0);
    expect(
      (
        desktopDatabase
          .prepare("SELECT COUNT(*) AS count FROM conflicts WHERE status = 'OPEN'")
          .get() as { count: number }
      ).count
    ).toBeGreaterThan(0);
    expect(
      androidDatabase
        .prepare(
          'SELECT body FROM check_in_revisions WHERE id = (SELECT current_revision_id FROM check_ins WHERE id = ?)'
        )
        .get(offline.checkInId)
    ).toMatchObject({ body: 'Android concurrent edit is preserved' });

    deleteOfflineCheckIn(androidDatabase, {
      ownerId: owner.ownerId,
      deviceId: candidate.deviceId,
      checkInId: androidCheckIn.checkInId
    });
    await drainOutbox(androidDatabase, androidTransport);
    await drainOutbox(desktopDatabase, ownerTransport);
    expect(
      await prisma.tombstone.findFirst({
        where: { ownerId: owner.ownerId, entityId: androidCheckIn.checkInId }
      })
    ).toBeTruthy();
    expect(
      desktopDatabase
        .prepare('SELECT entity_id FROM tombstones WHERE owner_id = ? AND entity_id = ?')
        .get(owner.ownerId, androidCheckIn.checkInId)
    ).toBeTruthy();

    const now = new Date().toISOString();
    const modeId = ulid();
    const sessionId = ulid();
    const occurrenceId = ulid();
    const occurrenceVersion = ulid();
    const policy = {
      cadence: 'FIXED_FROM_SESSION_START',
      intervalMinutes: 30,
      responseWindowMinutes: 60,
      snoozeMinutes: [5, 10, 15],
      maxSnoozes: 3,
      allowLateCompletion: true
    };
    desktopDatabase
      .prepare(
        "INSERT INTO focus_modes (id, owner_id, name, interval_minutes, policy_json, version, created_at, updated_at) VALUES (?, ?, 'Reminder integration mode', 30, ?, ?, ?, ?)"
      )
      .run(modeId, owner.ownerId, JSON.stringify(policy), ulid(), now, now);
    desktopDatabase
      .prepare(
        "INSERT INTO focus_sessions (id, owner_id, focus_mode_id, name, status, schedule_policy_json, timezone_id, started_at, version, created_at, updated_at) VALUES (?, ?, ?, 'Cross-device reminders', 'ACTIVE', ?, 'UTC', ?, ?, ?, ?)"
      )
      .run(sessionId, owner.ownerId, modeId, JSON.stringify(policy), now, ulid(), now, now);
    desktopDatabase
      .prepare(
        "INSERT INTO reminder_occurrences (id, owner_id, focus_session_id, state, scheduled_at, original_scheduled_at, timezone_id, policy_snapshot_json, version, created_at, updated_at) VALUES (?, ?, ?, 'SCHEDULED', ?, ?, 'UTC', ?, ?, ?, ?)"
      )
      .run(
        occurrenceId,
        owner.ownerId,
        sessionId,
        now,
        now,
        JSON.stringify(policy),
        occurrenceVersion,
        now,
        now
      );
    queueReminderSchedule(desktopDatabase, {
      ownerId: owner.ownerId,
      deviceId: owner.deviceId,
      occurrenceId,
      occurredAt: now
    });
    transitionReminderOffline(desktopDatabase, {
      ownerId: owner.ownerId,
      deviceId: owner.deviceId,
      occurrenceId,
      to: 'DUE',
      occurredAt: now
    });
    transitionReminderOffline(desktopDatabase, {
      ownerId: owner.ownerId,
      deviceId: owner.deviceId,
      occurrenceId,
      to: 'PRESENTED',
      occurredAt: now
    });
    const pushedReminderOperations = await drainOutbox(desktopDatabase, ownerTransport);
    expect(pushedReminderOperations).toBe(3);
    expect(
      await prisma.reminderOccurrence.findUnique({ where: { id: occurrenceId } })
    ).toMatchObject({ state: 'PRESENTED' });
    await drainOutbox(androidDatabase, androidTransport);
    expect(
      androidDatabase
        .prepare('SELECT state FROM reminder_occurrences WHERE id = ?')
        .get(occurrenceId)
    ).toMatchObject({ state: 'PRESENTED' });
    const presentedVersion = (
      desktopDatabase
        .prepare('SELECT version FROM reminder_occurrences WHERE id = ?')
        .get(occurrenceId) as { version: string }
    ).version;
    const nextDeviceSequence = (
      desktopDatabase
        .prepare(
          'SELECT COALESCE(MAX(device_sequence), 0) + 1 AS next FROM outbox_operations WHERE owner_id = ? AND device_id = ?'
        )
        .get(owner.ownerId, owner.deviceId) as { next: number }
    ).next;
    await expect(
      ownerTransport.push([
        {
          operation_id: ulid(),
          device_sequence: nextDeviceSequence,
          entity_type: 'reminder_occurrence',
          entity_id: occurrenceId,
          kind: 'reminder.complete',
          base_version: presentedVersion,
          payload_json: JSON.stringify({
            transitionId: ulid(),
            checkInId: ulid(),
            revisionId: ulid(),
            body: 'too short',
            completedAt: new Date().toISOString()
          }),
          occurred_at: new Date().toISOString()
        }
      ])
    ).rejects.toThrow('400');

    const desktopCompletion = completeReminderOffline(desktopDatabase, {
      ownerId: owner.ownerId,
      deviceId: owner.deviceId,
      occurrenceId,
      text: 'Desktop completed the shared reminder first'
    });
    completeReminderOffline(androidDatabase, {
      ownerId: owner.ownerId,
      deviceId: candidate.deviceId,
      occurrenceId,
      text: 'Android preserved its simultaneous reminder response'
    });
    await drainOutbox(desktopDatabase, ownerTransport);
    await drainOutbox(androidDatabase, androidTransport);
    await drainOutbox(desktopDatabase, ownerTransport);

    expect(
      await prisma.checkIn.findUnique({
        where: { reminderOccurrenceId: occurrenceId },
        include: { revisions: true }
      })
    ).toMatchObject({
      id: desktopCompletion.checkInId,
      revisions: [{ body: 'Desktop completed the shared reminder first' }]
    });
    expect(await prisma.checkIn.count({ where: { reminderOccurrenceId: occurrenceId } })).toBe(1);
    expect(
      await prisma.conflict.count({
        where: { ownerId: owner.ownerId, entityType: 'reminder_occurrence', entityId: occurrenceId }
      })
    ).toBeGreaterThan(0);
    expect(
      (
        androidDatabase
          .prepare(
            "SELECT COUNT(*) AS count FROM conflicts WHERE entity_type = 'reminder_occurrence' AND entity_id = ?"
          )
          .get(occurrenceId) as { count: number }
      ).count
    ).toBeGreaterThan(0);

    desktopDatabase.close();
    androidDatabase.close();
  });
});
