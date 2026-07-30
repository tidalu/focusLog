import { safeStorage } from 'electron';

import type { SecretProtector } from './protected-secret.js';
import { createResilientSecretProtector } from './resilient-secret-protector.js';

/** Electron uses DPAPI for safeStorage on Windows, binding ciphertext to the OS user. */
const electronSafeStorageProtector: SecretProtector = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  protect: (cleartext) => safeStorage.encryptString(cleartext),
  unprotect: (ciphertext) => safeStorage.decryptString(ciphertext)
};

export const electronSecretProtector: SecretProtector = createResilientSecretProtector(
  electronSafeStorageProtector
);
