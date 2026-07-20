import Database from 'better-sqlite3-multiple-ciphers';
import { existsSync, readFileSync, statSync } from 'node:fs';

import { desktopMigrations } from './migrations.js';

export type DesktopDatabase = Database.Database;

function now(): string {
  return new Date().toISOString();
}

export function migrateDesktopDatabase(database: DesktopDatabase): void {
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  database.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)'
  );

  const rows = database.prepare('SELECT version FROM schema_migrations').all() as {
    version: number;
  }[];
  const applied = new Set<number>(rows.map((row) => row.version));
  const recordMigration = database.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
  );

  for (const migration of desktopMigrations) {
    if (applied.has(migration.version)) continue;
    database.transaction(() => {
      for (const statement of migration.statements) database.exec(statement);
      recordMigration.run(migration.version, migration.name, now());
    })();
  }
}

function keyDatabase(database: DesktopDatabase, key: Buffer): void {
  database.pragma("cipher='sqlcipher'");
  database.pragma('legacy=4');
  database.pragma(`key="x'${key.toString('hex')}'"`);
}

function isPlaintextDatabase(filename: string): boolean {
  if (filename === ':memory:' || !existsSync(filename) || statSync(filename).size === 0)
    return false;
  return readFileSync(filename, { encoding: null })
    .subarray(0, 16)
    .equals(Buffer.from('SQLite format 3\0'));
}

function encryptLegacyPlaintextDatabase(filename: string, key: Buffer): void {
  const database = new Database(filename);
  try {
    database.pragma('wal_checkpoint(TRUNCATE)');
    database.pragma("cipher='sqlcipher'");
    database.pragma('legacy=4');
    database.pragma(`rekey="x'${key.toString('hex')}'"`);
  } finally {
    database.close();
  }
}

export function openDesktopDatabase(filename: string, key?: Buffer): DesktopDatabase {
  if (!key && filename !== ':memory:')
    throw new Error('An OS-protected database encryption key is required.');
  if (key && key.length !== 32) throw new Error('Database encryption key must contain 32 bytes.');
  if (key && isPlaintextDatabase(filename)) encryptLegacyPlaintextDatabase(filename, key);
  const database = new Database(filename);
  try {
    if (key) keyDatabase(database, key);
    database.prepare('SELECT count(*) FROM sqlite_master').get();
    migrateDesktopDatabase(database);
    return database;
  } catch (error) {
    database.close();
    throw new Error('The encrypted desktop database could not be opened or validated.', {
      cause: error
    });
  }
}
