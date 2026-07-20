import type { DesktopDatabase } from './database.js';

export function seedDesktopDatabase(database: DesktopDatabase): void {
  const timestamp = '2026-07-20T12:00:00.000Z';
  database
    .prepare('INSERT OR IGNORE INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run('01J00000000000000000000000', timestamp, timestamp);
  database
    .prepare(
      'INSERT OR IGNORE INTO focus_modes (id, owner_id, name, interval_minutes, policy_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      '01J00000000000000000000002',
      '01J00000000000000000000000',
      'Development focus',
      30,
      '{}',
      '01J00000000000000000000002',
      timestamp,
      timestamp
    );
}
