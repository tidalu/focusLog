import { createHash, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { ulid } from 'ulid';

import type { SecretProtector } from '../security/protected-secret.js';

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

function persistIdentity(
  filename: string,
  stored: PersistedIdentity,
  protector: SecretProtector
): void {
  const temporary = `${filename}.${process.pid}.tmp`;
  mkdirSync(dirname(filename), { recursive: true });
  writeFileSync(temporary, protector.protect(JSON.stringify(stored)), { mode: 0o600 });
  renameSync(temporary, filename);
}

function fingerprint(publicKey: string): string {
  return createHash('sha256').update(publicKey).digest('base64url');
}

/** The supplied protector keeps the private key encrypted and bound to the local device context. */
export function loadOrCreateDeviceIdentity(
  filename: string,
  protector: SecretProtector
): DeviceIdentity {
  if (!protector.isAvailable())
    throw new Error('Windows secure storage is unavailable; device identity cannot be created.');
  let stored: PersistedIdentity;
  if (existsSync(filename)) {
    const protectedIdentity = readFileSync(filename);
    try {
      stored = JSON.parse(protector.unprotect(protectedIdentity)) as PersistedIdentity;
      if (
        !stored.ownerId ||
        !stored.deviceId ||
        !stored.publicKey ||
        !stored.privateKey ||
        fingerprint(stored.publicKey).length < 32
      )
        throw new Error('identity fields are incomplete');
      if (protector.shouldReprotect?.(protectedIdentity)) {
        try {
          persistIdentity(filename, stored, protector);
        } catch (error) {
          console.warn(
            'FocusLog could not rewrap the protected device identity; existing data remains intact.',
            error
          );
        }
      }
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
    persistIdentity(filename, stored, protector);
  }
  return { ...stored, fingerprint: fingerprint(stored.publicKey) };
}

export function rebindDeviceIdentityOwner(
  filename: string,
  identity: DeviceIdentity,
  ownerId: string,
  protector: SecretProtector
): DeviceIdentity {
  const updated = { ...identity, ownerId };
  persistIdentity(filename, updated, protector);
  return updated;
}

export function restoreDeviceIdentity(
  filename: string,
  recovered: Omit<DeviceIdentity, 'fingerprint'>,
  protector: SecretProtector
): DeviceIdentity {
  const restored = { ...recovered, fingerprint: fingerprint(recovered.publicKey) };
  // Parsing the private key also rejects malformed or incompatible recovery material.
  createPrivateKey(restored.privateKey);
  persistIdentity(filename, restored, protector);
  return restored;
}

export function signDeviceMessage(identity: DeviceIdentity, message: string): string {
  return sign(null, Buffer.from(message), createPrivateKey(identity.privateKey)).toString(
    'base64url'
  );
}
