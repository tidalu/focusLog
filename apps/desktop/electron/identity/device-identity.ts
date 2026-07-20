import { createHash, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { safeStorage } from 'electron';
import { ulid } from 'ulid';

export interface DeviceIdentity {
  readonly ownerId: string;
  readonly deviceId: string;
  readonly publicKey: string;
  readonly privateKey: string;
  readonly fingerprint: string;
}

interface PersistedIdentity {
  ownerId: string;
  deviceId: string;
  publicKey: string;
  privateKey: string;
}

function persistIdentity(filename: string, stored: PersistedIdentity): void {
  const temporary = `${filename}.${process.pid}.tmp`;
  mkdirSync(dirname(filename), { recursive: true });
  writeFileSync(temporary, safeStorage.encryptString(JSON.stringify(stored)), { mode: 0o600 });
  renameSync(temporary, filename);
}

function fingerprint(publicKey: string): string {
  return createHash('sha256').update(publicKey).digest('base64url');
}

/** Windows safeStorage protects the private key with the current OS user context. */
export function loadOrCreateDeviceIdentity(filename: string): DeviceIdentity {
  if (!safeStorage.isEncryptionAvailable())
    throw new Error('Windows secure storage is unavailable; device identity cannot be created.');
  let stored: PersistedIdentity;
  if (existsSync(filename)) {
    try {
      stored = JSON.parse(safeStorage.decryptString(readFileSync(filename))) as PersistedIdentity;
      if (
        !stored.ownerId ||
        !stored.deviceId ||
        !stored.publicKey ||
        !stored.privateKey ||
        fingerprint(stored.publicKey).length < 32
      )
        throw new Error('identity fields are incomplete');
    } catch (error) {
      throw new Error(
        'Protected device identity exists but cannot be decrypted. Refusing to create a replacement identity.',
        { cause: error }
      );
    }
  } else {
    const keys = generateKeyPairSync('ed25519');
    stored = {
      ownerId: ulid(),
      deviceId: ulid(),
      publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      privateKey: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    };
    persistIdentity(filename, stored);
  }
  return { ...stored, fingerprint: fingerprint(stored.publicKey) };
}

export function rebindDeviceIdentityOwner(
  filename: string,
  identity: DeviceIdentity,
  ownerId: string
): DeviceIdentity {
  const updated = { ...identity, ownerId };
  persistIdentity(filename, updated);
  return updated;
}

export function restoreDeviceIdentity(
  filename: string,
  recovered: Omit<DeviceIdentity, 'fingerprint'>
): DeviceIdentity {
  const restored = { ...recovered, fingerprint: fingerprint(recovered.publicKey) };
  // Parsing the private key also rejects malformed or incompatible recovery material.
  createPrivateKey(restored.privateKey);
  persistIdentity(filename, restored);
  return restored;
}

export function signDeviceMessage(identity: DeviceIdentity, message: string): string {
  return sign(null, Buffer.from(message), createPrivateKey(identity.privateKey)).toString(
    'base64url'
  );
}
