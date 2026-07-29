import { afterEach, describe, expect, it } from 'vitest';
import { ulid } from 'ulid';

import { createOfflineCheckIn, reviseOfflineCheckIn } from './local-sync.js';
import { openDesktopDatabase, type DesktopDatabase } from './database.js';

describe('journal category inference', () => {
  let database: DesktopDatabase | undefined;

  afterEach(() => database?.close());

  it('creates ordered hierarchical sections and keeps the authored body intact', () => {
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
      body: '<Study><Leetcode>\nSolved a sliding window problem.\n#difficulty=Hard\n\n<Sleep>\nSlept for eight hours.',
      submittedAt: now,
      timezoneId: 'UTC'
    });

    expect(
      database
        .prepare(
          'SELECT categories.path, check_in_revisions.body FROM check_ins JOIN categories ON categories.id = check_ins.category_id JOIN check_in_revisions ON check_in_revisions.id = check_ins.current_revision_id WHERE check_ins.id = ?'
        )
        .get(created.checkInId)
    ).toEqual({
      path: 'study/leetcode',
      body: '<Study><Leetcode>\nSolved a sliding window problem.\n#difficulty=Hard\n\n<Sleep>\nSlept for eight hours.'
    });
    expect(
      database
        .prepare(
          'SELECT categories.path, log_sections.body, log_sections.metadata_json AS metadata FROM log_sections LEFT JOIN categories ON categories.id = log_sections.category_id WHERE log_sections.check_in_id = ? ORDER BY log_sections.position'
        )
        .all(created.checkInId)
    ).toEqual([
      {
        path: 'study/leetcode',
        body: 'Solved a sliding window problem.',
        metadata: '{"difficulty":"Hard"}'
      },
      { path: 'sleep', body: 'Slept for eight hours.', metadata: '{}' }
    ]);

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
