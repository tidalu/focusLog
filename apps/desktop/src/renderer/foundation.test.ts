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

  it('enforces the Windows reminder as a focus-retaining full-screen overlay', () => {
    const mainSource = readFileSync(resolve(import.meta.dirname, '../../electron/main.ts'), 'utf8');
    const overlaySource = mainSource.slice(
      mainSource.indexOf('function createReminderOverlay'),
      mainSource.indexOf('function createMainWindow')
    );

    expect(overlaySource).toContain('fullscreen: true');
    expect(overlaySource).toContain('kiosk: true');
    expect(overlaySource).toContain('frame: false');
    expect(overlaySource).toContain('minimizable: false');
    expect(overlaySource).toContain('maximizable: false');
    expect(overlaySource).toContain("overlay.on('blur'");
    expect(overlaySource).toContain('overlay.focus()');
    expect(overlaySource).not.toContain('Snooze');
    expect(overlaySource).not.toContain('Emergency dismiss');
    expect(overlaySource).not.toContain('Cancel');
  });

  it('renders only the mandatory response workflow in the reminder content', () => {
    const mainSource = readFileSync(resolve(import.meta.dirname, '../../electron/main.ts'), 'utf8');
    const overlaySource = mainSource.slice(
      mainSource.indexOf('const html = `<!doctype html>'),
      mainSource.indexOf('overlay.loadURL')
    );

    expect(overlaySource).toContain('What did you accomplish during the last');
    expect(overlaySource).toContain('minlength="20"');
    expect(overlaySource).toContain('Submit check-in');
    expect(overlaySource).not.toContain('Settings');
    expect(overlaySource).not.toContain('Navigation');
  });
});
