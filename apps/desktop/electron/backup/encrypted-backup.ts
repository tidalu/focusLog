import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';

import Database from 'better-sqlite3-multiple-ciphers';

import { migrateDesktopDatabase, type DesktopDatabase } from '../database/database.js';
import type { DeviceIdentity } from '../identity/device-identity.js';

const magic = 'FOCUSLOG-ENCRYPTED-BACKUP';
const formatVersion = 1;
const currentSchemaVersion = 3;
const hkdfInfo = Buffer.from('FocusLog portable backup v1');

export const portableTables = [
  'owners',
  'devices',
  'device_pairings',
  'focus_modes',
  'focus_sessions',
  'reminder_occurrences',
  'reminder_transitions',
  'categories',
  'check_ins',
  'check_in_revisions',
  'tags',
  'check_in_tags',
  'sync_operations',
  'sync_cursors',
  'outbox_operations',
  'sync_failures',
  'conflicts',
  'backup_manifests',
  'settings',
  'tombstones',
  'reminder_drafts'
] as const;

interface TableSnapshot {
  columns: string[];
  rows: unknown[][];
}

type RecoveryIdentity =
  | {
      platform: 'WINDOWS';
      format: 'PKCS8-PEM';
      ownerId: string;
      deviceId: string;
      publicKey: string;
      privateKey: string;
    }
  | {
      platform: 'ANDROID';
      format: 'ED25519-RAW';
      ownerId: string;
      deviceId: string;
      publicKeyPem: string;
      publicKey: string;
      privateKey: string;
    };

interface BackupPayload {
  kind: 'BACKUP' | 'EXPORT';
  schemaVersion: number;
  createdAt: string;
  sourceOwnerId: string;
  tables: Record<string, TableSnapshot>;
  recoveryIdentity?: RecoveryIdentity;
}

interface BackupEnvelope {
  magic: typeof magic;
  formatVersion: typeof formatVersion;
  cipher: 'AES-256-GCM';
  kdf: 'HKDF-SHA-256';
  salt: string;
  nonce: string;
  ciphertext: string;
  authenticationTag: string;
  payloadSha256: string;
}

function parseRecoveryKey(encoded: string): Buffer {
  const normalized = encoded.trim().replace(/^FLRK1-/, '');
  const key = Buffer.from(normalized, 'base64url');
  if (key.length !== 32)
    throw new Error('Recovery key is invalid; expected a FocusLog 256-bit recovery key.');
  return key;
}

export function formatRecoveryKey(key: Buffer): string {
  if (key.length !== 32) throw new Error('Recovery key must contain 32 bytes.');
  return `FLRK1-${key.toString('base64url')}`;
}

function deriveEncryptionKey(recoveryKey: Buffer, salt: Buffer): Buffer {
  return Buffer.from(hkdfSync('sha256', recoveryKey, salt, hkdfInfo, 32));
}

function serializePayload(
  database: DesktopDatabase,
  kind: BackupPayload['kind'],
  identity?: DeviceIdentity
): Buffer {
  const owner = database.prepare('SELECT id FROM owners ORDER BY created_at LIMIT 1').get() as
    { id: string } | undefined;
  if (!owner) throw new Error('Cannot create a backup before the local owner exists.');
  const tables: Record<string, TableSnapshot> = {};
  for (const table of portableTables) {
    const columns = (
      database.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]
    ).map((column) => column.name);
    if (columns.length === 0) throw new Error(`Required backup table ${table} is missing.`);
    const records = database.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
    tables[table] = {
      columns,
      rows: records.map((record) => columns.map((column) => record[column] ?? null))
    };
  }
  return Buffer.from(
    JSON.stringify({
      kind,
      schemaVersion: currentSchemaVersion,
      createdAt: new Date().toISOString(),
      sourceOwnerId: owner.id,
      tables,
      recoveryIdentity:
        kind === 'BACKUP' && identity
          ? {
              platform: 'WINDOWS',
              format: 'PKCS8-PEM',
              ownerId: identity.ownerId,
              deviceId: identity.deviceId,
              publicKey: identity.publicKey,
              privateKey: identity.privateKey
            }
          : undefined
    } satisfies BackupPayload)
  );
}

export function createEncryptedArchive(
  database: DesktopDatabase,
  recoveryKey: Buffer,
  kind: BackupPayload['kind'] = 'BACKUP',
  identity?: DeviceIdentity
): Buffer {
  if (recoveryKey.length !== 32) throw new Error('Recovery key must contain 32 bytes.');
  const payload = serializePayload(database, kind, identity);
  const salt = randomBytes(32);
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveEncryptionKey(recoveryKey, salt), nonce);
  cipher.setAAD(Buffer.from(`${magic}:${formatVersion}`));
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const envelope: BackupEnvelope = {
    magic,
    formatVersion,
    cipher: 'AES-256-GCM',
    kdf: 'HKDF-SHA-256',
    salt: salt.toString('base64url'),
    nonce: nonce.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    authenticationTag: cipher.getAuthTag().toString('base64url'),
    payloadSha256: createHash('sha256').update(payload).digest('base64url')
  };
  return Buffer.from(JSON.stringify(envelope));
}

function decodeArchive(archive: Buffer, recoveryKey: Buffer): BackupPayload {
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(archive.toString('utf8')) as BackupEnvelope;
  } catch {
    throw new Error('Backup is not valid FocusLog JSON.');
  }
  if (
    envelope.magic !== magic ||
    envelope.formatVersion !== formatVersion ||
    envelope.cipher !== 'AES-256-GCM' ||
    envelope.kdf !== 'HKDF-SHA-256'
  )
    throw new Error('Backup format or encryption metadata is unsupported.');
  try {
    const salt = Buffer.from(envelope.salt, 'base64url');
    const nonce = Buffer.from(envelope.nonce, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', deriveEncryptionKey(recoveryKey, salt), nonce);
    decipher.setAAD(Buffer.from(`${magic}:${formatVersion}`));
    decipher.setAuthTag(Buffer.from(envelope.authenticationTag, 'base64url'));
    const payloadBytes = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
      decipher.final()
    ]);
    const digest = createHash('sha256').update(payloadBytes).digest('base64url');
    if (digest !== envelope.payloadSha256) throw new Error('payload digest mismatch');
    const payload = JSON.parse(payloadBytes.toString('utf8')) as BackupPayload;
    validatePayload(payload);
    return payload;
  } catch (error) {
    throw new Error('Backup authentication failed. The key is wrong or the file was modified.', {
      cause: error
    });
  }
}

function validatePayload(payload: BackupPayload): void {
  if (
    !payload ||
    !['BACKUP', 'EXPORT'].includes(payload.kind) ||
    payload.schemaVersion < 1 ||
    payload.schemaVersion > currentSchemaVersion ||
    !payload.sourceOwnerId
  )
    throw new Error('Backup payload metadata is invalid or incompatible.');
  for (const table of portableTables) {
    const snapshot = payload.tables?.[table];
    if (
      !snapshot ||
      !Array.isArray(snapshot.columns) ||
      !Array.isArray(snapshot.rows) ||
      snapshot.columns.some((column) => !/^[a-z_]+$/.test(column)) ||
      snapshot.rows.some((row) => !Array.isArray(row) || row.length !== snapshot.columns.length)
    )
      throw new Error(`Backup table ${table} is invalid.`);
  }
  if (
    payload.recoveryIdentity &&
    (payload.recoveryIdentity.ownerId !== payload.sourceOwnerId ||
      !payload.recoveryIdentity.deviceId ||
      !payload.recoveryIdentity.publicKey ||
      !payload.recoveryIdentity.privateKey ||
      (payload.recoveryIdentity.platform === 'WINDOWS'
        ? payload.recoveryIdentity.format !== 'PKCS8-PEM'
        : payload.recoveryIdentity.platform === 'ANDROID'
          ? payload.recoveryIdentity.format !== 'ED25519-RAW' ||
            !payload.recoveryIdentity.publicKeyPem
          : true))
  )
    throw new Error('Backup recovery identity is invalid.');
}

function importPayload(database: DesktopDatabase, payload: BackupPayload): void {
  database.pragma('foreign_keys = OFF');
  try {
    database.transaction(() => {
      for (const table of [...portableTables].reverse())
        database.prepare(`DELETE FROM "${table}"`).run();
      for (const table of portableTables) {
        const snapshot = payload.tables[table]!;
        if (snapshot.rows.length === 0) continue;
        const columns = snapshot.columns.map((column) => `"${column}"`).join(', ');
        const placeholders = snapshot.columns.map(() => '?').join(', ');
        const insert = database.prepare(
          `INSERT INTO "${table}" (${columns}) VALUES (${placeholders})`
        );
        for (const row of snapshot.rows) insert.run(...row);
      }
    })();
  } finally {
    database.pragma('foreign_keys = ON');
  }
  const problems = database.pragma('foreign_key_check') as unknown[];
  if (problems.length > 0) throw new Error('Restored data violates referential integrity.');
}

function validateInStaging(payload: BackupPayload): void {
  const staging = new Database(':memory:');
  try {
    migrateDesktopDatabase(staging);
    importPayload(staging, payload);
    const owner = staging.prepare('SELECT id FROM owners WHERE id = ?').get(payload.sourceOwnerId);
    if (!owner) throw new Error('Backup owner record is missing.');
    staging.prepare('PRAGMA integrity_check').get();
  } finally {
    staging.close();
  }
}

export function restoreEncryptedArchive(
  database: DesktopDatabase,
  archive: Buffer,
  encodedRecoveryKey: string
): {
  ownerId: string;
  createdAt: string;
  kind: BackupPayload['kind'];
  recoveryIdentity?: BackupPayload['recoveryIdentity'];
} {
  const payload = decodeArchive(archive, parseRecoveryKey(encodedRecoveryKey));
  validateInStaging(payload);
  importPayload(database, payload);
  return {
    ownerId: payload.sourceOwnerId,
    createdAt: payload.createdAt,
    kind: payload.kind,
    recoveryIdentity: payload.recoveryIdentity
  };
}

export function writeArchiveAtomically(filename: string, archive: Buffer): void {
  const temporary = `${filename}.${process.pid}.tmp`;
  writeFileSync(temporary, archive, { mode: 0o600 });
  try {
    JSON.parse(readFileSync(temporary, 'utf8'));
    renameSync(temporary, filename);
  } catch (error) {
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}
