import { safeStorage } from 'electron';

import type { SecretProtector } from './protected-secret.js';

/** Electron uses DPAPI for safeStorage on Windows, binding ciphertext to the OS user. */
export const electronSecretProtector: SecretProtector = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  protect: (cleartext) => safeStorage.encryptString(cleartext),
  unprotect: (ciphertext) => safeStorage.decryptString(ciphertext)
};
