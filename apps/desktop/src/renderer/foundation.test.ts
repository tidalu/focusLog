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
      mainSource.indexOf('function scheduleSessionReminder')
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

  it('keeps the main process alive when the window closes and recovers renderer crashes', () => {
    const mainSource = readFileSync(resolve(import.meta.dirname, '../../electron/main.ts'), 'utf8');

    expect(mainSource).toContain("closeBehavior(desktopDatabase, ownerId) === 'exit'");
    expect(mainSource).toContain('event.preventDefault()');
    expect(mainSource).toContain('window.hide()');
    expect(mainSource).toContain("window.webContents.on('render-process-gone'");
    expect(mainSource).toContain("overlay.webContents.on('render-process-gone'");
    expect(mainSource).toContain("process.platform !== 'win32'");
  });

  it('registers hidden Windows login startup while the main-process scheduler remains active', () => {
    const mainSource = readFileSync(resolve(import.meta.dirname, '../../electron/main.ts'), 'utf8');

    expect(mainSource).toContain("args: enabled ? ['--background'] : []");
    expect(mainSource).toContain("process.argv.includes('--background')");
    expect(mainSource).toContain('scheduler.start()');
    expect(mainSource).toContain('if (!startedInBackground) showMainWindow()');
    expect(mainSource.indexOf('scheduler.start()')).toBeLessThan(
      mainSource.indexOf('if (!startedInBackground) showMainWindow()')
    );
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

  it('uses journal timelines, analytics dashboards, and an in-place calendar drawer', () => {
    const historySource = readFileSync(resolve(import.meta.dirname, 'HistoryPage.tsx'), 'utf8');
    const reportsSource = readFileSync(resolve(import.meta.dirname, 'ReportsPage.tsx'), 'utf8');
    const calendarSource = readFileSync(resolve(import.meta.dirname, 'CalendarPage.tsx'), 'utf8');

    expect(historySource).toContain("['Morning', 'Afternoon', 'Evening']");
    expect(historySource).toContain('category:study');
    expect(historySource).toContain('journal-card');
    expect(reportsSource).toContain('<h2>Categories</h2>');
    expect(reportsSource).toContain('Hourly activity');
    expect(reportsSource).toContain('<h2>Word cloud</h2>');
    expect(reportsSource).not.toContain('Complete timeline');
    expect(calendarSource).toContain('year-heatmap');
    expect(calendarSource).toContain('role="dialog"');
    expect(calendarSource).toContain('Click any day');
  });

  it('offers inferred-category completion without a category management form', () => {
    const rendererSource = readFileSync(resolve(import.meta.dirname, 'App.tsx'), 'utf8');

    expect(rendererSource).toContain('<code>&lt;study&gt;&lt;leetcode&gt;</code>');
    expect(rendererSource).toContain('categorySuggestions');
    expect(rendererSource).not.toContain('Create category');
    expect(rendererSource).not.toContain('Manage categories');
  });
});
