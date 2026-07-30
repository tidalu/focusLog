import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { homedir, hostname, platform, userInfo } from 'node:os';

import type { SecretProtector } from './protected-secret.js';

const fallbackPrefix = Buffer.from('FocusLogProtectedSecret:v1:fallback-aes-256-gcm:');
const fallbackIvLength = 12;
const fallbackTagLength = 16;

function startsWith(buffer: Buffer, prefix: Buffer): boolean {
  return buffer.length >= prefix.length && buffer.subarray(0, prefix.length).equals(prefix);
}

function localFallbackContext(): string {
  let username = 'unknown-user';
  try {
    username = userInfo().username || username;
  } catch {
    // Keep the fallback deterministic even in restricted OS user contexts.
  }
  return [
    'focuslog-secure-local-fallback-v1',
    platform(),
    process.arch,
    hostname(),
    username,
    homedir()
  ].join('\0');
}

function fallbackKey(): Buffer {
  return createHash('sha256').update(localFallbackContext()).digest();
}

function fallbackEncrypt(cleartext: string): Buffer {
  const iv = randomBytes(fallbackIvLength);
  const cipher = createCipheriv('aes-256-gcm', fallbackKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(cleartext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([fallbackPrefix, iv, tag, ciphertext]);
}

function fallbackDecrypt(payload: Buffer): string {
  if (!startsWith(payload, fallbackPrefix)) throw new Error('not a FocusLog fallback secret');
  const encrypted = payload.subarray(fallbackPrefix.length);
  if (encrypted.length <= fallbackIvLength + fallbackTagLength)
    throw new Error('incomplete FocusLog fallback secret');
  const iv = encrypted.subarray(0, fallbackIvLength);
  const tag = encrypted.subarray(fallbackIvLength, fallbackIvLength + fallbackTagLength);
  const ciphertext = encrypted.subarray(fallbackIvLength + fallbackTagLength);
  const decipher = createDecipheriv('aes-256-gcm', fallbackKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function createResilientSecretProtector(primary: SecretProtector): SecretProtector {
  return {
    isAvailable: () => true,
    protect: (cleartext) => fallbackEncrypt(cleartext),
    unprotect: (ciphertext) => {
      if (startsWith(ciphertext, fallbackPrefix)) return fallbackDecrypt(ciphertext);
      return primary.unprotect(ciphertext);
    },
    shouldReprotect: (ciphertext) => !startsWith(ciphertext, fallbackPrefix)
  };
}

export const focusLogFallbackSecretPrefix = fallbackPrefix.toString('utf8');
