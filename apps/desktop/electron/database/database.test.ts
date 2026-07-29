import { describe, expect, it } from 'vitest';

import { openDesktopDatabase } from './database.js';
import { seedDesktopDatabase } from './seed.js';

describe('desktop SQLite migrations', () => {
  it('creates the local persistence schema and seed records', () => {
    const database = openDesktopDatabase(':memory:');
    seedDesktopDatabase(database);

    const tableRows = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const tables = tableRows.map((row) => row.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        'devices',
        'device_pairings',
        'focus_modes',
        'focus_sessions',
        'reminder_occurrences',
        'reminder_transitions',
        'check_ins',
        'log_sections',
        'tags',
        'categories',
        'sync_operations',
        'sync_cursors',
        'conflicts',
        'backup_manifests',
        'settings',
        'tombstones'
      ])
    );
    expect(database.prepare('SELECT COUNT(*) AS count FROM devices').get()).toMatchObject({
      count: 0
    });
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'tombstones_owner_retention_idx'"
        )
        .get()
    ).toBeDefined();
    database.close();
  });
});
