import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3-multiple-ciphers';

import { desktopMigrations } from './migrations.js';
import { migrateDesktopDatabase, openDesktopDatabase } from './database.js';
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

  it('repairs databases where the legacy category migration occupied version 6', () => {
    const database = new Database(':memory:');
    database.exec(
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)'
    );
    const record = database.prepare(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
    );
    const appliedAt = '2026-07-21T00:00:00.000Z';
    for (const migration of desktopMigrations.filter((candidate) => candidate.version <= 5)) {
      for (const statement of migration.statements) database.exec(statement);
      record.run(migration.version, migration.name, appliedAt);
    }

    const taxonomy = desktopMigrations.find(
      (migration) =>
        migration.version === 24 && migration.name === 'multi_section_category_taxonomy'
    );
    expect(taxonomy).toBeDefined();
    for (const statement of taxonomy!.statements) database.exec(statement);
    record.run(6, 'multi_section_category_taxonomy', appliedAt);

    migrateDesktopDatabase(database);

    expect(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ai_jobs'")
        .get()
    ).toBeDefined();
    expect(
      database.prepare('SELECT name FROM schema_migrations WHERE version = 24').get()
    ).toMatchObject({ name: 'multi_section_category_taxonomy' });
    expect(
      database.prepare('SELECT name FROM schema_migrations WHERE version = 25').get()
    ).toMatchObject({ name: 'repair_ai_platform_foundation_version_collision' });

    expect(() => migrateDesktopDatabase(database)).not.toThrow();
    database.close();
  });
});
