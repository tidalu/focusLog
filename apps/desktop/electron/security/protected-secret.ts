import { randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { dirname } from 'node:path';

export interface SecretProtector {
  isAvailable(): boolean;
  protect(cleartext: string): Buffer;
  unprotect(ciphertext: Buffer): string;
}

function writePrivateFileAtomically(filename: string, content: Buffer): void {
  mkdirSync(dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.tmp`;
  writeFileSync(temporary, content, { mode: 0o600 });
  renameSync(temporary, filename);
}

export function loadOrCreateProtectedSecret(
  filename: string,
  protector: SecretProtector,
  byteLength = 32
): Buffer {
  if (!protector.isAvailable())
    throw new Error('Windows secure credential storage is unavailable.');

  if (existsSync(filename)) {
    try {
      const decoded = Buffer.from(protector.unprotect(readFileSync(filename)), 'base64url');
      if (decoded.length !== byteLength) throw new Error('invalid secret length');
      return decoded;
    } catch (error) {
      throw new Error(
        'Protected credential data exists but cannot be decrypted. Refusing to replace it.',
        { cause: error }
      );
    }
  }

  const secret = randomBytes(byteLength);
  writePrivateFileAtomically(filename, protector.protect(secret.toString('base64url')));
  return secret;
}

export function deleteProtectedSecret(filename: string): void {
  if (existsSync(filename)) unlinkSync(filename);
}
