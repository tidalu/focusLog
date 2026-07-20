import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve('prisma/migrations/202607200001_initial_persistence/migration.sql');
const searchMigrationPath = resolve(
  'prisma/migrations/202607200005_full_text_search/migration.sql'
);

describe('initial persistence migration', () => {
  it('creates all required synchronized tables and indexes', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    for (const table of [
      'devices',
      'device_pairings',
      'focus_modes',
      'focus_sessions',
      'reminder_occurrences',
      'reminder_transitions',
      'check_ins',
      'tags',
      'categories',
      'sync_operations',
      'sync_cursors',
      'conflicts',
      'backup_manifests',
      'settings',
      'tombstones'
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
    expect(migration).toContain('TIMESTAMPTZ(3)');
    expect(migration).toContain(
      'CREATE INDEX "reminder_occurrences_ownerId_state_scheduledAt_idx"'
    );
    expect(migration).toContain('CREATE INDEX "check_ins_ownerId_submittedAt_idx"');
    expect(migration).toContain('UNIQUE("ownerId", "entityType", "entityId")');
  });

  it('installs indexed PostgreSQL full-text search', async () => {
    const migration = await readFile(searchMigrationPath, 'utf8');
    expect(migration).toContain('tsvector');
    expect(migration).toContain('USING GIN');
    expect(migration).toContain('check_in_revisions_search_document_idx');
  });
});
