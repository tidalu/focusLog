import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import viteConfig from '../../vite.config.js';

describe('desktop foundation', () => {
  it('uses file-relative renderer assets for packaged Electron', () => {
    expect(viteConfig).toMatchObject({ base: './' });
  });

  it('uses a CommonJS preload compatible with Electron sandboxing', () => {
    const mainSource = readFileSync(resolve(import.meta.dirname, '../../electron/main.ts'), 'utf8');
    expect(mainSource).toContain("'preload.cjs'");
  });
});
