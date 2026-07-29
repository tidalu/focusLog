import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { dirname, join } from 'node:path';

import type { SecretProtector } from '../security/protected-secret.js';

function credentialFilename(root: string, profileId: string): string {
  const digest = createHash('sha256').update(profileId).digest('hex');
  return join(root, 'ai-credentials', `${digest}.bin`);
}

export class DesktopCredentialStore {
  constructor(
    private readonly root: string,
    private readonly protector: SecretProtector
  ) {}

  isConfigured(profileId: string): boolean {
    return existsSync(credentialFilename(this.root, profileId));
  }

  get(profileId: string): string | undefined {
    const filename = credentialFilename(this.root, profileId);
    if (!existsSync(filename)) return undefined;
    try {
      return this.protector.unprotect(readFileSync(filename));
    } catch {
      throw new Error('The configured provider credential could not be decrypted.');
    }
  }

  set(profileId: string, secret: string): void {
    if (!this.protector.isAvailable())
      throw new Error('Windows secure credential storage is unavailable.');
    if (!secret.trim()) throw new Error('Provider credential cannot be empty.');
    const filename = credentialFilename(this.root, profileId);
    mkdirSync(dirname(filename), { recursive: true });
    const temporary = `${filename}.${process.pid}.tmp`;
    writeFileSync(temporary, this.protector.protect(secret.trim()), { mode: 0o600 });
    renameSync(temporary, filename);
  }

  delete(profileId: string): void {
    const filename = credentialFilename(this.root, profileId);
    if (existsSync(filename)) unlinkSync(filename);
  }
}
