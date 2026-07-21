import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import PlainDatabase from 'better-sqlite3-multiple-ciphers';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createEncryptedArchive,
  formatRecoveryKey,
  restoreEncryptedArchive
} from '../backup/encrypted-backup.js';
import { openDesktopDatabase } from '../database/database.js';
import { seedDesktopDatabase } from '../database/seed.js';
import { loadOrCreateProtectedSecret, type SecretProtector } from './protected-secret.js';
import { permanentlyDeleteLocalData } from './permanent-deletion.js';

const directories: string[] = [];
const temporaryDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'focuslog-security-'));
  directories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('desktop encrypted persistence', () => {
  it('encrypts a new SQLite file and opens it again with the protected key', () => {
    const filename = join(temporaryDirectory(), 'focuslog.sqlite');
    const key = randomBytes(32);
    const database = openDesktopDatabase(filename, key);
    seedDesktopDatabase(database);
    database.close();

    expect(readFileSync(filename).subarray(0, 16).toString()).not.toBe('SQLite format 3\0');
    const withoutKey = new PlainDatabase(filename);
    try {
      expect(() => withoutKey.prepare('SELECT * FROM owners').all()).toThrow();
    } finally {
      withoutKey.close();
    }

    const reopened = openDesktopDatabase(filename, key);
    expect(reopened.prepare('SELECT count(*) AS count FROM owners').get()).toMatchObject({
      count: 1
    });
    reopened.close();
  });

  it('migrates an existing plaintext database without losing data', () => {
    const filename = join(temporaryDirectory(), 'legacy.sqlite');
    const plaintext = new PlainDatabase(filename);
    plaintext.exec('CREATE TABLE legacy_value (value TEXT NOT NULL)');
    plaintext.prepare('INSERT INTO legacy_value VALUES (?)').run('preserved');
    plaintext.close();

    const encrypted = openDesktopDatabase(filename, randomBytes(32));
    expect(encrypted.prepare('SELECT value FROM legacy_value').get()).toMatchObject({
      value: 'preserved'
    });
    encrypted.close();
    expect(readFileSync(filename).subarray(0, 16).toString()).not.toBe('SQLite format 3\0');
  });

  it('recovers a protected key after application reinstall and rejects corrupt storage', () => {
    const filename = join(temporaryDirectory(), 'database-key.bin');
    const protector: SecretProtector = {
      isAvailable: () => true,
      protect: (value) => Buffer.from(`protected:${value}`),
      unprotect: (value) => value.toString().replace(/^protected:/, '')
    };
    const first = loadOrCreateProtectedSecret(filename, protector);
    const afterReinstall = loadOrCreateProtectedSecret(filename, protector);
    expect(afterReinstall).toEqual(first);

    writeFileSync(filename, 'corrupt');
    expect(() => loadOrCreateProtectedSecret(filename, protector)).toThrow(/Refusing to replace/);
  });

  it('permanently deletes the encryption key before local database artifacts', () => {
    const directory = temporaryDirectory();
    const databasePath = join(directory, 'focuslog.sqlite');
    const keyPath = join(directory, 'database-key.bin');
    const identityPath = join(directory, 'device-identity.bin');
    const database = openDesktopDatabase(databasePath, randomBytes(32));
    seedDesktopDatabase(database);
    writeFileSync(keyPath, randomBytes(32));
    writeFileSync(identityPath, randomBytes(32));

    permanentlyDeleteLocalData(database, [keyPath, identityPath, databasePath]);
    expect(existsSync(keyPath)).toBe(false);
    expect(existsSync(identityPath)).toBe(false);
    expect(existsSync(databasePath)).toBe(false);
  });
});

describe('encrypted backup restore', () => {
  it('restores a complete backup into a clean reinstall database', () => {
    const source = openDesktopDatabase(':memory:');
    seedDesktopDatabase(source);
    source
      .prepare(
        'INSERT INTO check_ins (id, owner_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        '01J00000000000000000000003',
        '01J00000000000000000000000',
        '2026-07-20T12:30:00.000Z',
        'Europe/Warsaw',
        '01J00000000000000000000004',
        '2026-07-20T12:30:00.000Z',
        '2026-07-20T12:30:00.000Z'
      );
    source
      .prepare(
        'INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(
        '01J00000000000000000000005',
        '01J00000000000000000000003',
        '<study><leetcode> Solved problem 904.',
        '01J00000000000000000000008',
        '2026-07-20T12:30:00.000Z'
      );
    source
      .prepare(
        'INSERT INTO categories (id, owner_id, name, path, depth, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        '01J00000000000000000000006',
        '01J00000000000000000000000',
        'leetcode',
        'study/leetcode',
        1,
        '01J00000000000000000000004',
        '2026-07-20T12:30:00.000Z',
        '2026-07-20T12:30:00.000Z'
      );
    source
      .prepare(
        'INSERT INTO log_sections (id, owner_id, check_in_id, revision_id, category_id, position, body, metadata_json, occurred_at, timezone_id, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        '01J00000000000000000000007',
        '01J00000000000000000000000',
        '01J00000000000000000000003',
        '01J00000000000000000000005',
        '01J00000000000000000000006',
        0,
        'Solved problem 904.',
        '{"difficulty":"Hard"}',
        '2026-07-20T12:30:00.000Z',
        'Europe/Warsaw',
        '01J00000000000000000000004',
        '2026-07-20T12:30:00.000Z'
      );
    const recoveryKey = randomBytes(32);
    const keys = generateKeyPairSync('ed25519');
    const recoveryIdentity = {
      ownerId: '01J00000000000000000000000',
      deviceId: '01J00000000000000000000001',
      publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      privateKey: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      fingerprint: 'verified-in-device-identity-service'
    };
    const archive = createEncryptedArchive(source, recoveryKey, 'BACKUP', recoveryIdentity);

    const reinstalled = openDesktopDatabase(':memory:');
    const result = restoreEncryptedArchive(reinstalled, archive, formatRecoveryKey(recoveryKey));
    expect(reinstalled.prepare('SELECT count(*) AS count FROM check_ins').get()).toMatchObject({
      count: 1
    });
    expect(
      reinstalled
        .prepare(
          'SELECT categories.path, log_sections.body, log_sections.metadata_json FROM log_sections JOIN categories ON categories.id = log_sections.category_id'
        )
        .get()
    ).toMatchObject({
      path: 'study/leetcode',
      body: 'Solved problem 904.',
      metadata_json: '{"difficulty":"Hard"}'
    });
    expect(result.recoveryIdentity?.deviceId).toBe(recoveryIdentity.deviceId);
    source.close();
    reinstalled.close();
  });

  it('rejects a modified or incorrectly keyed backup before changing live data', () => {
    const database = openDesktopDatabase(':memory:');
    seedDesktopDatabase(database);
    const archive = createEncryptedArchive(database, randomBytes(32));
    const parsed = JSON.parse(archive.toString()) as { ciphertext: string };
    parsed.ciphertext = `${parsed.ciphertext.slice(0, -2)}AA`;

    expect(() =>
      restoreEncryptedArchive(
        database,
        Buffer.from(JSON.stringify(parsed)),
        formatRecoveryKey(randomBytes(32))
      )
    ).toThrow(/authentication failed/);
    expect(database.prepare('SELECT count(*) AS count FROM owners').get()).toMatchObject({
      count: 1
    });
    database.close();
  });
});
