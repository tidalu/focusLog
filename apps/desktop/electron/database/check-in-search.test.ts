import { performance } from 'node:perf_hooks';

import { afterEach, describe, expect, it } from 'vitest';
import { ulid } from 'ulid';

import { parseHistorySearch, searchCheckIns } from './check-in-search.js';
import { openDesktopDatabase, type DesktopDatabase } from './database.js';

describe('SQLite FTS5 check-in search', () => {
  let database: DesktopDatabase | undefined;

  afterEach(() => database?.close());

  it('parses Spotlight-style search operators without sending them to FTS', () => {
    expect(
      parseHistorySearch(
        'leetcode category:study device:desktop delay>2m last week',
        new Date('2026-07-21T12:00:00.000Z')
      )
    ).toMatchObject({
      text: 'leetcode',
      category: 'study',
      device: 'windows',
      minimumDelaySeconds: 120,
      submittedFrom: '2026-07-14T12:00:00.000Z'
    });
  });

  it('ranks full-text matches and applies tag, category, and session filters', () => {
    database = openDesktopDatabase(':memory:');
    const ownerId = ulid();
    const categoryId = ulid();
    const tagId = ulid();
    const modeId = ulid();
    const sessionId = ulid();
    const now = new Date().toISOString();
    database.prepare('INSERT INTO owners VALUES (?, ?, ?)').run(ownerId, now, now);
    database
      .prepare(
        'INSERT INTO categories (id, owner_id, name, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(categoryId, ownerId, 'Deep work', ulid(), now, now);
    database
      .prepare(
        'INSERT INTO tags (id, owner_id, name, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(tagId, ownerId, 'Architecture', ulid(), now, now);
    database
      .prepare(
        'INSERT INTO focus_modes (id, owner_id, name, interval_minutes, policy_json, version, created_at, updated_at) VALUES (?, ?, ?, 30, ?, ?, ?, ?)'
      )
      .run(modeId, ownerId, 'Test mode', '{}', ulid(), now, now);
    database
      .prepare(
        "INSERT INTO focus_sessions (id, owner_id, focus_mode_id, name, status, schedule_policy_json, timezone_id, started_at, version, created_at, updated_at) VALUES (?, ?, ?, ?, 'ACTIVE', '{}', 'UTC', ?, ?, ?, ?)"
      )
      .run(sessionId, ownerId, modeId, 'Build', now, ulid(), now, now);

    const insert = (body: string, filtered: boolean) => {
      const checkInId = ulid();
      const revisionId = ulid();
      database!
        .prepare(
          'INSERT INTO check_ins (id, owner_id, focus_session_id, category_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          checkInId,
          ownerId,
          filtered ? sessionId : null,
          filtered ? categoryId : null,
          revisionId,
          now,
          'UTC',
          revisionId,
          now,
          now
        );
      database!
        .prepare(
          'INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(revisionId, checkInId, body, ulid(), now);
      if (filtered)
        database!
          .prepare('INSERT INTO check_in_tags (check_in_id, tag_id) VALUES (?, ?)')
          .run(checkInId, tagId);
      return checkInId;
    };
    const strongest = insert('architecture architecture architecture planning', true);
    insert('architecture planning', false);

    const results = searchCheckIns(database, ownerId, {
      query: 'architecture',
      tagId,
      categoryId,
      sessionId
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: strongest });
    expect(results[0]!.rank).toBeGreaterThan(0);
  });

  it('searches 10,000 local check-ins within the benchmark budget', () => {
    database = openDesktopDatabase(':memory:');
    const ownerId = ulid();
    const now = new Date().toISOString();
    database.prepare('INSERT INTO owners VALUES (?, ?, ?)').run(ownerId, now, now);
    const transaction = database.transaction(() => {
      for (let index = 0; index < 10_000; index++) {
        const checkInId = ulid();
        const revisionId = ulid();
        database!
          .prepare(
            "INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, 'UTC', ?, ?, ?)"
          )
          .run(checkInId, ownerId, revisionId, now, revisionId, now, now);
        database!
          .prepare(
            'INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES (?, ?, ?, ?, ?)'
          )
          .run(
            revisionId,
            checkInId,
            index % 100 === 0
              ? `needle architecture result ${index}`
              : `ordinary focus activity ${index}`,
            ulid(),
            now
          );
      }
    });
    transaction();
    const started = performance.now();
    const results = searchCheckIns(database, ownerId, { query: 'needle architecture' });
    const elapsed = performance.now() - started;
    expect(results).toHaveLength(100);
    expect(elapsed).toBeLessThan(1_500);
  }, 20_000);
});
