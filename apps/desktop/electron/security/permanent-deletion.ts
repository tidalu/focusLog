import { existsSync, unlinkSync } from 'node:fs';

import type { DesktopDatabase } from '../database/database.js';

export function permanentlyDeleteLocalData(
  database: DesktopDatabase,
  paths: readonly string[]
): void {
  database.close();
  // Key destruction is the security boundary on flash storage, where reliable
  // sector overwrite cannot be promised. Callers put key paths first.
  for (const filename of paths) {
    if (existsSync(filename)) unlinkSync(filename);
  }
}
