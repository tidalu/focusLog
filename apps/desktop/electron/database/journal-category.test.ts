import { afterEach, describe, expect, it } from 'vitest';
import { ulid } from 'ulid';

import { createOfflineCheckIn, reviseOfflineCheckIn } from './local-sync.js';
import { openDesktopDatabase, type DesktopDatabase } from './database.js';

describe('journal category inference', () => {
  let database: DesktopDatabase | undefined;

  afterEach(() => database?.close());

  it('creates categories from leading tokens and keeps the authored body intact', () => {
    database = openDesktopDatabase(':memory:');
    const ownerId = ulid();
    const deviceId = ulid();
    const now = new Date().toISOString();
    database.prepare('INSERT INTO owners VALUES (?, ?, ?)').run(ownerId, now, now);
    database
      .prepare(
        "INSERT INTO devices (id, owner_id, public_key, fingerprint, platform, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'windows', 'ACTIVE', ?, ?)"
      )
      .run(deviceId, ownerId, 'public-key', 'fingerprint', now, now);

    const created = createOfflineCheckIn(database, {
      ownerId,
      deviceId,
      body: '<Study> Solved a sliding window problem.',
      submittedAt: now,
      timezoneId: 'UTC'
    });

    expect(
      database
        .prepare(
          'SELECT categories.name, check_in_revisions.body FROM check_ins JOIN categories ON categories.id = check_ins.category_id JOIN check_in_revisions ON check_in_revisions.id = check_ins.current_revision_id WHERE check_ins.id = ?'
        )
        .get(created.checkInId)
    ).toEqual({
      name: 'study',
      body: '<Study> Solved a sliding window problem.'
    });

    reviseOfflineCheckIn(database, {
      ownerId,
      deviceId,
      checkInId: created.checkInId,
      body: 'Continued without a category token.',
      createdAt: new Date(Date.parse(now) + 1_000).toISOString()
    });

    expect(
      database.prepare('SELECT category_id FROM check_ins WHERE id = ?').get(created.checkInId)
    ).toEqual({ category_id: null });
  });
});
