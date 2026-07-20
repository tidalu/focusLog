import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  Tray
} from 'electron';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ulid } from 'ulid';
import { openDesktopDatabase } from './database/database.js';
import {
  loadOrCreateDeviceIdentity,
  rebindDeviceIdentityOwner,
  restoreDeviceIdentity,
  type DeviceIdentity
} from './identity/device-identity.js';
import { ReminderScheduler } from './reminders/scheduler.js';
import { AuthenticatedFocusLogClient } from './sync/authenticated-client.js';
import { FocusLogWebSocketClient } from './sync/websocket-client.js';
import { drainOutbox } from './database/sync-worker.js';
import { defaultReminderPolicy } from './reminders/policy.js';
import { queueReminderSchedule } from './reminders/operations.js';
import { loadOrCreateProtectedSecret } from './security/protected-secret.js';
import { electronSecretProtector } from './security/electron-secret-protector.js';
import {
  createEncryptedArchive,
  formatRecoveryKey,
  restoreEncryptedArchive,
  writeArchiveAtomically
} from './backup/encrypted-backup.js';
import { permanentlyDeleteLocalData } from './security/permanent-deletion.js';
import { ReportingService, type ReportSelection } from './reporting/reporting-service.js';
import { localDayForInstant } from '@focuslog/shared-utils';
import { searchCheckIns, type CheckInSearchFilters } from './database/check-in-search.js';

let scheduler: ReminderScheduler | undefined;
let tray: Tray | undefined;
let desktopDatabase: ReturnType<typeof openDesktopDatabase> | undefined;
let identity: DeviceIdentity | undefined;
let ownerId = '';
let deviceId = '';
const reminderOverlays = new Map<string, BrowserWindow>();
let isQuitting = false;
let suspendedAt: Date | undefined;
let websocketClient: FocusLogWebSocketClient | undefined;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(import.meta.dirname, 'preload.cjs')
    }
  });

  window.once('ready-to-show', () => window.show());
  void window.loadFile(join(import.meta.dirname, '../dist/renderer/index.html'));
  return window;
}

function ensureLocalIdentity(): void {
  const database = desktopDatabase!;
  const current = identity!;
  const timestamp = new Date().toISOString();
  database
    .prepare('INSERT OR IGNORE INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)')
    .run(current.ownerId, timestamp, timestamp);
  database
    .prepare(
      "INSERT OR IGNORE INTO devices (id, owner_id, public_key, fingerprint, platform, display_name, is_owner_device, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'windows', 'This Windows device', 1, 'ACTIVE', ?, ?)"
    )
    .run(
      current.deviceId,
      current.ownerId,
      current.publicKey,
      current.fingerprint,
      timestamp,
      timestamp
    );
}

function configureWindowsStartup(database: ReturnType<typeof openDesktopDatabase>): void {
  if (process.platform !== 'win32') return;
  const row = database
    .prepare('SELECT values_json FROM settings WHERE owner_id = ?')
    .get(ownerId) as { values_json: string } | undefined;
  const values = row ? (JSON.parse(row.values_json) as Record<string, unknown>) : {};
  const enabled = typeof values.startupEnabled === 'boolean' ? values.startupEnabled : true;
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true });
  if (!row) {
    const now = new Date().toISOString();
    database
      .prepare(
        'INSERT INTO settings (owner_id, values_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(ownerId, JSON.stringify({ startupEnabled: enabled }), ulid(), now, now);
  }
}

function createReminderOverlay(occurrenceId: string): void {
  const existing = reminderOverlays.get(occurrenceId);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }
  const overlay = new BrowserWindow({
    width: 520,
    height: 360,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(import.meta.dirname, 'preload.cjs')
    }
  });
  reminderOverlays.set(occurrenceId, overlay);
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.on('close', (event) => {
    if (!isQuitting) event.preventDefault();
  });
  overlay.on('closed', () => reminderOverlays.delete(occurrenceId));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>FocusLog reminder</title><style>body{font-family:system-ui;margin:2rem;background:#101827;color:#fff}textarea{width:100%;min-height:8rem;font:inherit}.actions{display:flex;gap:.5rem;flex-wrap:wrap}button{margin-top:1rem;padding:.7rem 1rem}#status{min-height:1.5rem}.secondary{background:#243044;color:#fff;border:1px solid #64748b}</style></head><body><main aria-labelledby="title"><h1 id="title">FocusLog reminder</h1><p>Describe what you are doing to complete this reminder. Closing the window is disabled until the reminder is resolved.</p><form id="form"><label for="response">Current activity (at least 20 characters)</label><textarea id="response" required minlength="20" aria-describedby="status"></textarea><p id="status" aria-live="polite"></p><div class="actions"><button id="complete" type="submit" disabled>Complete reminder</button><button class="secondary" type="button" data-snooze="5">Snooze 5 min</button><button class="secondary" type="button" data-snooze="10">Snooze 10 min</button><button class="secondary" id="emergency" type="button">Emergency dismiss</button></div></form></main><script>const id=${JSON.stringify(occurrenceId)};const field=document.querySelector('#response');const button=document.querySelector('#complete');const status=document.querySelector('#status');function update(){const remaining=Math.max(0,20-[...field.value.trim()].length);button.disabled=remaining>0;status.textContent=remaining?remaining+' characters remaining':'Ready to complete';window.focuslog.preserveDraft(id,field.value)}field.addEventListener('input',update);document.querySelectorAll('[data-snooze]').forEach(item=>item.addEventListener('click',async()=>{try{await window.focuslog.snoozeReminder(id,Number(item.dataset.snooze))}catch(error){status.textContent=error instanceof Error?error.message:'Unable to snooze'}}));document.querySelector('#emergency').addEventListener('click',async()=>{if(confirm('Emergency dismissal records this interval without completing it. Continue?'))await window.focuslog.emergencyDismissReminder(id)});document.querySelector('#form').addEventListener('submit',async event=>{event.preventDefault();try{await window.focuslog.completeReminder(id,field.value)}catch(error){status.textContent=error instanceof Error?error.message:'Unable to complete reminder'}});window.focuslog.getDraft(id).then(text=>{field.value=text;update()});</script></body></html>`;
  void overlay.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
}

app
  .whenReady()
  .then(() => {
    const userDataPath = app.getPath('userData');
    const databasePath = join(userDataPath, 'focuslog.sqlite');
    const databaseKeyPath = join(userDataPath, 'database-key.bin');
    const identityPath = join(userDataPath, 'device-identity.bin');
    const backupKeyPath = join(userDataPath, 'backup-recovery-key.bin');
    const databaseKey = loadOrCreateProtectedSecret(databaseKeyPath, electronSecretProtector);
    const database = openDesktopDatabase(databasePath, databaseKey);
    desktopDatabase = database;
    identity = loadOrCreateDeviceIdentity(identityPath);
    ownerId = identity.ownerId;
    deviceId = identity.deviceId;
    ensureLocalIdentity();
    configureWindowsStartup(database);
    scheduler = new ReminderScheduler(database, ownerId, deviceId, (occurrenceId) => {
      scheduler?.present(occurrenceId);
      createReminderOverlay(occurrenceId);
    });
    scheduler.start();
    powerMonitor.on('suspend', () => {
      suspendedAt = new Date();
    });
    powerMonitor.on('resume', () => {
      scheduler?.recover(suspendedAt ? 'resume' : 'clock-change');
      suspendedAt = undefined;
    });
    powerMonitor.on('unlock-screen', () => scheduler?.recover('unlock'));
    if (process.env.FOCUSLOG_API_URL) {
      const client = new AuthenticatedFocusLogClient(
        new URL(process.env.FOCUSLOG_API_URL),
        identity!
      );
      const synchronize = () =>
        void drainOutbox(database, client, new Date(), deviceId).then(() => {
          for (const [occurrenceId, overlay] of reminderOverlays) {
            const row = database
              .prepare('SELECT state FROM reminder_occurrences WHERE id = ?')
              .get(occurrenceId) as { state: string } | undefined;
            if (
              row &&
              ['COMPLETED', 'MISSED', 'SKIPPED', 'EMERGENCY_DISMISSED', 'SUPERSEDED'].includes(
                row.state
              )
            )
              overlay.destroy();
          }
          scheduler?.tick();
        });
      synchronize();
      setInterval(synchronize, 30_000);
      websocketClient = new FocusLogWebSocketClient(
        new URL(process.env.FOCUSLOG_API_URL),
        identity!,
        synchronize,
        () => {
          dialog.showErrorBox(
            'FocusLog device revoked',
            'This device is no longer trusted. Synchronization has been stopped.'
          );
        }
      );
      websocketClient.start();
    }
    tray = new Tray(nativeImage.createEmpty());
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open FocusLog', click: () => createWindow() },
        { label: 'Quit', click: () => app.quit() }
      ])
    );
    ipcMain.handle('focuslog:status', () => ({
      offline: true,
      databaseReady: Boolean(desktopDatabase),
      startupEnabled: process.platform === 'win32' ? app.getLoginItemSettings().openAtLogin : false
    }));
    ipcMain.handle('focuslog:device-identity', () => ({
      ownerId,
      deviceId,
      fingerprint: identity!.fingerprint,
      registered: Boolean(process.env.FOCUSLOG_API_URL)
    }));
    ipcMain.handle('focuslog:bootstrap-device', async (_event, apiUrl?: string) => {
      const address = apiUrl || process.env.FOCUSLOG_API_URL;
      if (!address) throw new Error('Set FOCUSLOG_API_URL before registering this owner device.');
      const client = new AuthenticatedFocusLogClient(new URL(address), identity!);
      return client.bootstrap('This Windows device');
    });
    ipcMain.handle('focuslog:set-startup', (_event, enabled: boolean) => {
      if (process.platform === 'win32') {
        app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true });
        const current = database
          .prepare('SELECT values_json FROM settings WHERE owner_id = ?')
          .get(ownerId) as { values_json: string } | undefined;
        const values = current ? (JSON.parse(current.values_json) as Record<string, unknown>) : {};
        values.startupEnabled = enabled;
        const now = new Date().toISOString();
        database
          .prepare(
            'INSERT INTO settings (owner_id, values_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET values_json = excluded.values_json, version = excluded.version, updated_at = excluded.updated_at'
          )
          .run(ownerId, JSON.stringify(values), ulid(), now, now);
      }
      return enabled;
    });
    ipcMain.handle('focuslog:create-backup', async (_event, kind: 'BACKUP' | 'EXPORT') => {
      const extension = kind === 'EXPORT' ? 'focuslog-export' : 'focuslog-backup';
      const selection = await dialog.showSaveDialog({
        title: kind === 'EXPORT' ? 'Export FocusLog data' : 'Create encrypted backup',
        defaultPath: `FocusLog-${new Date().toISOString().slice(0, 10)}.${extension}`,
        filters: [{ name: 'FocusLog encrypted archive', extensions: [extension] }]
      });
      if (selection.canceled || !selection.filePath) return null;
      const backupKey = loadOrCreateProtectedSecret(backupKeyPath, electronSecretProtector);
      writeArchiveAtomically(
        selection.filePath,
        createEncryptedArchive(database, backupKey, kind, identity!)
      );
      return {
        path: selection.filePath,
        recoveryKey: formatRecoveryKey(backupKey)
      };
    });
    ipcMain.handle('focuslog:restore-backup', async (_event, recoveryKey: string) => {
      const selection = await dialog.showOpenDialog({
        title: 'Restore or import encrypted FocusLog data',
        properties: ['openFile'],
        filters: [
          {
            name: 'FocusLog encrypted archive',
            extensions: ['focuslog-backup', 'focuslog-export']
          }
        ]
      });
      if (selection.canceled || selection.filePaths.length !== 1) return null;
      const result = restoreEncryptedArchive(
        database,
        readFileSync(selection.filePaths[0]!),
        recoveryKey
      );
      if (result.recoveryIdentity?.platform === 'WINDOWS') {
        identity = restoreDeviceIdentity(identityPath, result.recoveryIdentity);
        ownerId = identity.ownerId;
        deviceId = identity.deviceId;
        ensureLocalIdentity();
      } else if (identity!.ownerId !== result.ownerId) {
        identity = rebindDeviceIdentityOwner(identityPath, identity!, result.ownerId);
        ownerId = result.ownerId;
        ensureLocalIdentity();
      }
      scheduler?.recover('restart');
      return { ownerId: result.ownerId, createdAt: result.createdAt, kind: result.kind };
    });
    ipcMain.handle('focuslog:permanent-delete', async (_event, confirmation: string) => {
      if (confirmation !== 'DELETE ALL FOCUSLOG DATA')
        throw new Error('Permanent deletion confirmation did not match.');
      if (process.env.FOCUSLOG_API_URL) {
        await new AuthenticatedFocusLogClient(
          new URL(process.env.FOCUSLOG_API_URL),
          identity!
        ).permanentlyDeleteOwnerData();
      }
      scheduler?.stop();
      for (const overlay of reminderOverlays.values()) overlay.destroy();
      permanentlyDeleteLocalData(database, [
        databaseKeyPath,
        identityPath,
        backupKeyPath,
        databasePath,
        `${databasePath}-wal`,
        `${databasePath}-shm`
      ]);
      setImmediate(() => app.quit());
      return { deleted: true };
    });
    ipcMain.handle('focuslog:save-draft', (_event, occurrenceId: string, text: string) => {
      database
        .prepare(
          'CREATE TABLE IF NOT EXISTS reminder_drafts (occurrence_id TEXT PRIMARY KEY, text TEXT NOT NULL, updated_at TEXT NOT NULL)'
        )
        .run();
      database
        .prepare(
          'INSERT OR REPLACE INTO reminder_drafts (occurrence_id, text, updated_at) VALUES (?, ?, ?)'
        )
        .run(occurrenceId, text, new Date().toISOString());
    });
    ipcMain.handle('focuslog:get-draft', (_event, occurrenceId: string) => {
      const row = database
        .prepare('SELECT text FROM reminder_drafts WHERE occurrence_id = ?')
        .get(occurrenceId) as { text: string } | undefined;
      return row?.text ?? '';
    });
    ipcMain.handle('focuslog:complete-reminder', (_event, occurrenceId: string, text: string) => {
      if ([...text.trim()].length < 20)
        throw new Error('Reminder completion requires at least 20 characters.');
      scheduler?.complete(occurrenceId, text);
      database.prepare('DELETE FROM reminder_drafts WHERE occurrence_id = ?').run(occurrenceId);
      reminderOverlays.get(occurrenceId)?.destroy();
      return { completed: true };
    });
    ipcMain.handle('focuslog:snooze-reminder', (_event, occurrenceId: string, minutes: number) => {
      scheduler?.snooze(occurrenceId, minutes);
      reminderOverlays.get(occurrenceId)?.destroy();
      return { snoozed: true };
    });
    ipcMain.handle('focuslog:emergency-dismiss-reminder', (_event, occurrenceId: string) => {
      scheduler?.emergencyDismiss(occurrenceId);
      reminderOverlays.get(occurrenceId)?.destroy();
      return { dismissed: true };
    });
    ipcMain.handle('focuslog:start-focus-session', () => {
      const now = new Date().toISOString();
      const mode = database
        .prepare(
          'SELECT id, name FROM focus_modes WHERE owner_id = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 1'
        )
        .get(ownerId) as { id: string; name: string } | undefined;
      const policy = { ...defaultReminderPolicy, intervalMinutes: 30 };
      const policyJson = JSON.stringify(policy);
      const modeId = mode?.id ?? ulid();
      if (!mode)
        database
          .prepare(
            "INSERT INTO focus_modes (id, owner_id, name, interval_minutes, policy_json, version, created_at, updated_at) VALUES (?, ?, 'Default focus', 30, ?, ?, ?, ?)"
          )
          .run(modeId, ownerId, policyJson, ulid(), now, now);
      const id = ulid();
      database
        .prepare(
          "INSERT INTO focus_sessions (id, owner_id, focus_mode_id, name, status, schedule_policy_json, timezone_id, started_at, version, created_at, updated_at) VALUES (?, ?, ?, 'Focus session', 'ACTIVE', ?, ?, ?, ?, ?, ?)"
        )
        .run(
          id,
          ownerId,
          modeId,
          policyJson,
          Intl.DateTimeFormat().resolvedOptions().timeZone,
          now,
          ulid(),
          now,
          now
        );
      const firstReminderAt = new Date(Date.now() + 30 * 60_000).toISOString();
      const reminderId = ulid();
      database
        .prepare(
          "INSERT INTO reminder_occurrences (id, owner_id, focus_session_id, state, scheduled_at, original_scheduled_at, timezone_id, policy_snapshot_json, version, created_at, updated_at) VALUES (?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          reminderId,
          ownerId,
          id,
          firstReminderAt,
          firstReminderAt,
          Intl.DateTimeFormat().resolvedOptions().timeZone,
          policyJson,
          ulid(),
          now,
          now
        );
      queueReminderSchedule(database, {
        ownerId,
        deviceId,
        occurrenceId: reminderId,
        occurredAt: now
      });
      return { id, name: 'Focus session' };
    });
    ipcMain.handle('focuslog:stop-focus-session', () => {
      const active = database
        .prepare(
          "SELECT id FROM focus_sessions WHERE owner_id = ? AND status = 'ACTIVE' ORDER BY started_at DESC LIMIT 1"
        )
        .get(ownerId) as { id: string } | undefined;
      if (!active) return null;
      database
        .prepare(
          "UPDATE focus_sessions SET status = 'COMPLETED', ended_at = ?, updated_at = ? WHERE id = ?"
        )
        .run(new Date().toISOString(), new Date().toISOString(), active.id);
      return active;
    });
    ipcMain.handle('focuslog:history', (_event, queryOrFilters: string | CheckInSearchFilters) =>
      searchCheckIns(
        database,
        ownerId,
        typeof queryOrFilters === 'string' ? { query: queryOrFilters } : queryOrFilters
      )
    );
    ipcMain.handle('focuslog:search-filters', () => ({
      tags: database
        .prepare(
          'SELECT id, name FROM tags WHERE owner_id = ? AND deleted_at IS NULL ORDER BY name, id'
        )
        .all(ownerId),
      categories: database
        .prepare(
          'SELECT id, name FROM categories WHERE owner_id = ? AND deleted_at IS NULL ORDER BY name, id'
        )
        .all(ownerId),
      sessions: database
        .prepare(
          'SELECT id, COALESCE(name, ?) AS name FROM focus_sessions WHERE owner_id = ? AND deleted_at IS NULL ORDER BY started_at DESC, id'
        )
        .all('Focus session', ownerId)
    }));
    const reporting = new ReportingService(database, ownerId);
    ipcMain.handle('focuslog:report', (_event, requested?: Partial<ReportSelection>) => {
      const timezoneId =
        requested?.timezoneId ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
      const day = requested?.day ?? localDayForInstant(new Date(), timezoneId);
      return reporting.daily({ day, timezoneId });
    });
    ipcMain.handle('focuslog:heatmap', (_event, requested: { year: number; timezoneId: string }) =>
      reporting.heatmap(requested.year, requested.timezoneId)
    );
    ipcMain.handle(
      'focuslog:day-log',
      (_event, requested: ReportSelection) => reporting.daily(requested).timeline
    );
    ipcMain.handle('focuslog:create-pairing', () => {
      if (!process.env.FOCUSLOG_API_URL)
        throw new Error('Set FOCUSLOG_API_URL and register this owner device before pairing.');
      return new AuthenticatedFocusLogClient(
        new URL(process.env.FOCUSLOG_API_URL),
        identity!
      ).createPairingCode();
    });
    ipcMain.handle('focuslog:pending-pairings', () => {
      if (!process.env.FOCUSLOG_API_URL) throw new Error('Set FOCUSLOG_API_URL before pairing.');
      return new AuthenticatedFocusLogClient(
        new URL(process.env.FOCUSLOG_API_URL),
        identity!
      ).pendingPairings();
    });
    ipcMain.handle('focuslog:approve-pairing', (_event, pairingId: string) => {
      if (!process.env.FOCUSLOG_API_URL) throw new Error('Set FOCUSLOG_API_URL before pairing.');
      return new AuthenticatedFocusLogClient(
        new URL(process.env.FOCUSLOG_API_URL),
        identity!
      ).approvePairing(pairingId);
    });
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error('FocusLog failed during secure startup.', message);
    dialog.showErrorBox(
      'FocusLog could not start',
      'Secure local storage could not be initialized. FocusLog did not modify or replace existing data.'
    );
    app.exit(1);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  websocketClient?.stop();
  scheduler?.stop();
});
