import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  screen,
  session as electronSession,
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
import { createOfflineCheckIn } from './database/local-sync.js';
import { defaultReminderPolicy, parseReminderPolicy } from './reminders/policy.js';
import { queueReminderSchedule, transitionReminderOffline } from './reminders/operations.js';
import {
  closeBehavior,
  maximumReminderInterval,
  minimumReminderInterval,
  readOwnerSettings,
  reminderIntervalChoices,
  reminderIntervalMinutes,
  setCloseBehavior,
  setReminderInterval,
  type CloseBehavior,
  writeOwnerSettings
} from './reminders/preferences.js';
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
import { AIService } from './ai/ai-service.js';
import { DesktopCredentialStore } from './ai/credentials.js';
import type { AISettings, ProviderProfile } from './ai/types.js';
import { AnalysisService } from './ai/analysis-service.js';
import { AIJobQueue } from './ai/job-queue.js';
import type { AIJobWorker } from './ai/job-worker.js';
import type { QueueReadService } from './ai/queue-read-service.js';
import { createAIQueueRuntime } from './ai/queue-runtime.js';
import type { AIQueueRuntime } from './ai/queue-runtime.js';
import { registerQueueRuntimeLifecycle } from './ai/queue-runtime-lifecycle.js';
import { registerAIQueueIpcHandlers } from './ai/queue-ipc.js';
import { providerCapacityFor } from './ai/provider-execution-coordinator.js';
import { AnalysisSchedulerRuntime, AnalysisSchedulerService } from './ai/analysis-scheduler.js';
import { AnalysisReadService } from './ai/analysis-read-service.js';
import {
  AIMemoryControlService,
  registerAIMemoryIpcHandlers
} from './ai/memory-control-service.js';
import { PlaygroundEvaluationService } from './ai/playground-evaluation-service.js';
import { Phase5UXDiagnosticsPackagingService } from './ai/phase5-ux-diagnostics-packaging-service.js';
import {
  readWidgetSettings,
  updateWidgetSettings,
  WidgetService,
  type WidgetSettings
} from './widgets/widget-service.js';

let scheduler: ReminderScheduler | undefined;
let tray: Tray | undefined;
let mainWindow: BrowserWindow | undefined;
let desktopDatabase: ReturnType<typeof openDesktopDatabase> | undefined;
let identity: DeviceIdentity | undefined;
let ownerId = '';
let deviceId = '';
const reminderOverlays = new Map<string, BrowserWindow>();
let isQuitting = false;
let suspendedAt: Date | undefined;
let websocketClient: FocusLogWebSocketClient | undefined;
let synchronizationOnline = false;
let lastSynchronizedAt: string | undefined;
let lastSynchronizationError: string | undefined;
let aiService: AIService | undefined;
let analysisService: AnalysisService | undefined;
let aiJobQueue: AIJobQueue | undefined;
let aiJobWorker: AIJobWorker | undefined;
let queueReadService: QueueReadService | undefined;
let aiQueueRuntime: AIQueueRuntime | undefined;
let aiAnalysisScheduler: AnalysisSchedulerRuntime | undefined;
let aiAnalysisSchedulerService: AnalysisSchedulerService | undefined;
let aiAnalysisReadService: AnalysisReadService | undefined;
let aiMemoryControlService: AIMemoryControlService | undefined;
let playgroundEvaluationService: PlaygroundEvaluationService | undefined;
let phase5DService: Phase5UXDiagnosticsPackagingService | undefined;
let widgetWindow: BrowserWindow | undefined;
let widgetService: WidgetService | undefined;
let requestSynchronization: (() => void) | undefined;
const focusLogApiUrl =
  process.env.FOCUSLOG_API_URL?.trim() || 'https://focuslog-backend.onrender.com';
const startedInBackground = process.argv.includes('--background');

export const focusLogContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https: http://127.0.0.1:* http://localhost:*",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'"
].join('; ');

let securityHeadersRegistered = false;

export function registerSecurityHeaders(
  targetSession = electronSession.defaultSession,
  contentSecurityPolicy = focusLogContentSecurityPolicy
): void {
  if (securityHeadersRegistered) return;
  securityHeadersRegistered = true;
  targetSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy],
        'X-Content-Type-Options': ['nosniff'],
        'Referrer-Policy': ['no-referrer']
      }
    });
  });
}

function showMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

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
  mainWindow = window;

  window.once('ready-to-show', () => window.show());
  window.on('close', (event) => {
    if (isQuitting || !desktopDatabase) return;
    if (closeBehavior(desktopDatabase, ownerId) === 'exit') {
      isQuitting = true;
      app.quit();
      return;
    }
    event.preventDefault();
    window.hide();
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined;
  });
  window.webContents.on('render-process-gone', () => {
    if (isQuitting) return;
    const wasVisible = window.isVisible();
    if (!window.isDestroyed()) window.destroy();
    setTimeout(() => {
      if (!isQuitting && wasVisible) showMainWindow();
    }, 250);
  });
  void window.loadFile(join(import.meta.dirname, '../dist/renderer/index.html'));
  return window;
}

function widgetSettings(): WidgetSettings {
  return readWidgetSettings(readOwnerSettings(desktopDatabase!, ownerId));
}

function saveWidgetSettings(patch: Partial<WidgetSettings>): WidgetSettings {
  const values = readOwnerSettings(desktopDatabase!, ownerId);
  const next = updateWidgetSettings(values, patch);
  writeOwnerSettings(desktopDatabase!, ownerId, values);
  return next;
}

function widgetMarkup(): string {
  // This renderer receives only a privacy-filtered snapshot over the preload bridge.
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FocusLog widget</title><style>html{background:transparent}body{margin:0;padding:10px;background:transparent;color:#f8f8ff;font:13px/1.35 "Segoe UI",system-ui,sans-serif;user-select:none}main{min-height:calc(100vh - 20px);box-sizing:border-box;padding:16px;border:1px solid #ffffff24;border-radius:18px;background:linear-gradient(145deg,#25243beF,#14141feF);box-shadow:0 12px 32px #0006;display:grid;gap:12px;-webkit-app-region:drag}button{border:0;border-radius:10px;padding:8px 10px;background:#7774f2;color:white;font:600 12px inherit;cursor:pointer;-webkit-app-region:no-drag}button:focus-visible{outline:3px solid white;outline-offset:2px}.top,.numbers,.actions{display:flex;align-items:center;justify-content:space-between;gap:10px}.brand{font-weight:750}.muted{color:#b8b7ca}.progress{height:8px;border-radius:99px;background:#ffffff16;overflow:hidden}.progress i{display:block;height:100%;border-radius:inherit;background:#9896ff}.metric{font-size:25px;font-weight:750}.card{padding:10px;border-radius:12px;background:#ffffff0d}.insight{white-space:pre-wrap;max-height:118px;overflow:hidden}.hidden{display:none}</style></head><body><main><div class="top"><span class="brand">FocusLog</span><button id="hide" aria-label="Hide widget">Hide</button></div><div><div class="numbers"><span class="metric" id="completion">—</span><span class="muted" id="logs"></span></div><div class="progress"><i id="bar"></i></div></div><div id="details" class="card muted">Loading local data…</div><div id="insight" class="card insight hidden"></div><div class="actions"><button id="add">Add log</button><button id="session">Start focus</button></div></main><script>const $=id=>document.getElementById(id);const text=(id,value)=>$(id).textContent=value;const minute=n=>n==null?'No recent log':n===0?'Just now':n+' min ago';async function render(){try{const s=await window.focuslog.widgetSnapshot();text('completion',s.dailyCompletionPercentage+'%');$('bar').style.width=s.dailyCompletionPercentage+'%';text('logs',s.logsToday+' log'+(s.logsToday===1?'':'s')+' today');const parts=[];if(s.activeSession)parts.push(s.activeSession.status==='PAUSED'?'Focus paused':'Focusing: '+s.activeSession.name);if(s.nextReminderAt)parts.push('Next reminder in '+s.timeUntilNextReminderMinutes+' min');else parts.push('No reminder scheduled');if(s.currentActivity)parts.push('Last: '+s.currentActivity);text('details',parts.join(' · '));if(s.latestInsight){$('insight').classList.remove('hidden');text('insight',s.latestInsight.content+(s.latestInsight.stale?' (stale)':''));}else $('insight').classList.add('hidden');text('session',s.activeSession?'Stop focus':'Start focus');}catch{ text('details','FocusLog data is temporarily unavailable.'); }}$('add').onclick=()=>window.focuslog.openWidgetQuickAdd();$('session').onclick=()=>window.focuslog.widgetFocusAction().then(render);$('hide').onclick=()=>window.focuslog.hideWidget();window.focuslog.onWidgetUpdated(render);render();setInterval(render,60000);</script></body></html>`;
}

function showWidget(): BrowserWindow {
  const settings = widgetSettings();
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.show();
    widgetWindow.focus();
    return widgetWindow;
  }
  const workArea = screen.getPrimaryDisplay().workArea;
  const x = Math.min(
    Math.max(settings.x ?? workArea.x + workArea.width - settings.width - 24, workArea.x),
    workArea.x + workArea.width - settings.width
  );
  const y = Math.min(
    Math.max(settings.y ?? workArea.y + workArea.height - settings.height - 24, workArea.y),
    workArea.y + workArea.height - settings.height
  );
  const window = new BrowserWindow({
    width: settings.width,
    height: settings.height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: true,
    minWidth: 260,
    minHeight: 160,
    alwaysOnTop: settings.alwaysOnTop,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(import.meta.dirname, 'preload.cjs')
    }
  });
  widgetWindow = window;
  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });
  window.on('moved', () => {
    const [nextX, nextY] = window.getPosition();
    saveWidgetSettings({ x: nextX, y: nextY });
  });
  window.on('resized', () => {
    const [width, height] = window.getSize();
    saveWidgetSettings({ width, height });
  });
  window.on('closed', () => {
    if (widgetWindow === window) widgetWindow = undefined;
  });
  void window.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(widgetMarkup())}`);
  window.once('ready-to-show', () => window.show());
  return window;
}

function notifyWidget(): void {
  if (widgetWindow && !widgetWindow.isDestroyed())
    widgetWindow.webContents.send('focuslog:widget-updated');
}

function showWidgetQuickAdd(): void {
  const quickEntry = new BrowserWindow({
    width: 440,
    height: 310,
    parent: widgetWindow,
    modal: false,
    resizable: false,
    title: 'Add FocusLog entry',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(import.meta.dirname, 'preload.cjs')
    }
  });
  const quickEntryMarkup = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:22px;background:#181824;color:#fff;font:14px "Segoe UI",system-ui,sans-serif}form{display:grid;gap:12px}textarea{min-height:100px;padding:12px;border-radius:10px;border:1px solid #ffffff33;background:#ffffff10;color:#fff;font:inherit}button{padding:10px 14px;border:0;border-radius:9px;background:#7774f2;color:white;font:600 14px inherit}.error{color:#ffb4ab;min-height:20px}</style></head><body><form><strong>Quick add</strong><label>Use &lt;category&gt; syntax to categorize automatically.<textarea autofocus required placeholder="&lt;work&gt; Finished the outline"></textarea></label><span class="error"></span><button>Save log</button></form><script>const f=document.querySelector('form'),t=document.querySelector('textarea'),e=document.querySelector('.error');f.onsubmit=async x=>{x.preventDefault();e.textContent='';try{await window.focuslog.widgetCreateLog(t.value);window.close()}catch(err){e.textContent=err instanceof Error?err.message:'Unable to save this log.'}}</script></body></html>`;
  void quickEntry.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(quickEntryMarkup)}`);
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

function trayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#5b5bd6"/><circle cx="16" cy="16" r="8" fill="none" stroke="white" stroke-width="3"/><circle cx="16" cy="16" r="2.5" fill="white"/></svg>`;
  return nativeImage
    .createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
    .resize({ width: 16, height: 16 });
}

function configureWindowsStartup(database: ReturnType<typeof openDesktopDatabase>): void {
  if (process.platform !== 'win32') return;
  const values = readOwnerSettings(database, ownerId);
  const enabled = typeof values.startupEnabled === 'boolean' ? values.startupEnabled : true;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
    args: enabled ? ['--background'] : []
  });
  writeOwnerSettings(database, ownerId, {
    ...values,
    startupEnabled: enabled,
    closeBehavior: values.closeBehavior === 'exit' ? 'exit' : 'tray',
    reminderIntervalMinutes:
      typeof values.reminderIntervalMinutes === 'number'
        ? values.reminderIntervalMinutes
        : defaultReminderPolicy.intervalMinutes
  });
}

function createReminderOverlay(occurrenceId: string): void {
  const existing = reminderOverlays.get(occurrenceId);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }
  const occurrence = desktopDatabase!
    .prepare('SELECT policy_snapshot_json FROM reminder_occurrences WHERE id = ?')
    .get(occurrenceId) as { policy_snapshot_json: string } | undefined;
  const intervalMinutes = parseReminderPolicy(
    occurrence?.policy_snapshot_json ?? defaultReminderPolicy
  ).intervalMinutes;
  const overlay = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    frame: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    closable: false,
    focusable: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    backgroundColor: '#07080d',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(import.meta.dirname, 'preload.cjs')
    }
  });
  reminderOverlays.set(occurrenceId, overlay);
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setKiosk(true);
  overlay.setFullScreen(true);
  overlay.on('close', (event) => {
    if (!isQuitting) event.preventDefault();
  });
  overlay.on('blur', () => {
    setTimeout(() => {
      if (overlay.isDestroyed() || isQuitting) return;
      overlay.show();
      overlay.setAlwaysOnTop(true, 'screen-saver');
      overlay.moveTop();
      overlay.focus();
    }, 80);
  });
  overlay.on('minimize', () => {
    if (!overlay.isDestroyed()) {
      overlay.restore();
      overlay.focus();
    }
  });
  overlay.on('leave-full-screen', () => {
    if (!overlay.isDestroyed() && !isQuitting) overlay.setFullScreen(true);
  });
  overlay.webContents.on('before-input-event', (event, input) => {
    if (
      input.key === 'Escape' ||
      input.key === 'F11' ||
      (input.alt && input.key.toLowerCase() === 'f4')
    ) {
      event.preventDefault();
    }
  });
  overlay.webContents.on('render-process-gone', () => {
    if (isQuitting || !desktopDatabase) return;
    const row = desktopDatabase
      .prepare('SELECT state FROM reminder_occurrences WHERE id = ?')
      .get(occurrenceId) as { state: string } | undefined;
    if (
      !row ||
      ['COMPLETED', 'MISSED', 'SKIPPED', 'EMERGENCY_DISMISSED', 'SUPERSEDED'].includes(row.state)
    )
      return;
    reminderOverlays.delete(occurrenceId);
    if (!overlay.isDestroyed()) overlay.destroy();
    setTimeout(() => {
      if (!isQuitting) createReminderOverlay(occurrenceId);
    }, 250);
  });
  overlay.on('closed', () => reminderOverlays.delete(occurrenceId));
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FocusLog reminder</title><style>:root{color-scheme:dark;font-family:Inter,"Segoe UI",system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 15%,#272b3c 0,#101119 42%,#07080d 100%);color:#f7f7fb;animation:appear .24s ease-out}body::before{content:"";position:fixed;inset:0;background:rgba(5,6,10,.42);backdrop-filter:blur(18px)}main{position:relative;width:min(820px,calc(100vw - 64px));display:grid;gap:30px}h1{max-width:760px;margin:0;font-size:clamp(34px,4.3vw,64px);font-weight:650;letter-spacing:-.045em;line-height:1.05}form{display:grid;gap:14px}label{font-size:14px;font-weight:650;color:#aeb2c3;letter-spacing:.02em}textarea{width:100%;min-height:230px;resize:none;border:1px solid #ffffff24;border-radius:24px;padding:24px 26px;background:#171922e8;color:#fff;box-shadow:0 24px 70px #0008,inset 0 1px #ffffff12;font:500 clamp(20px,2vw,28px)/1.45 inherit;outline:none;transition:border-color .18s,box-shadow .18s}textarea:focus{border-color:#8d91ff;box-shadow:0 0 0 4px #777cff2b,0 30px 90px #0009}.suggestions{display:flex;flex-wrap:wrap;gap:8px}.suggestions:empty{display:none}.suggestions button{padding:7px 11px;border:1px solid #ffffff24;background:#202331;color:#cfd1ff;font-size:12px;box-shadow:none}.footer{display:flex;align-items:center;justify-content:space-between;gap:20px}.counter{margin:0;color:#aeb2c3;font-size:15px}.counter.ready{color:#7ce7ae}button{border:0;border-radius:16px;padding:15px 28px;background:linear-gradient(135deg,#8a8fff,#6d63ef);color:white;font:700 16px inherit;box-shadow:0 12px 30px #6d63ef42;cursor:pointer;transition:transform .16s,opacity .16s}button:hover:not(:disabled){transform:translateY(-2px)}button:focus-visible{outline:3px solid #fff;outline-offset:4px}button:disabled{cursor:not-allowed;opacity:.36;box-shadow:none}body.resolved{animation:resolve .24s ease-in forwards}@keyframes appear{from{opacity:0;transform:scale(1.015)}to{opacity:1;transform:none}}@keyframes resolve{to{opacity:0;transform:scale(.985)}}@media(max-width:640px){main{width:calc(100vw - 32px)}.footer{align-items:stretch;flex-direction:column}button{width:100%}}</style></head><body><main aria-labelledby="question"><h1 id="question">What did you accomplish during the last ${intervalMinutes} minutes?</h1><form id="form"><label for="response">Your response</label><textarea id="response" required minlength="20" aria-describedby="counter" autocomplete="off" spellcheck="true" placeholder="&lt;study&gt;&lt;leetcode&gt;&#10;Describe what you completed…"></textarea><div id="suggestions" class="suggestions" aria-label="Category suggestions"></div><div class="footer"><p id="counter" class="counter" aria-live="polite">0 / 20</p><button id="submit" type="submit" disabled>Submit check-in</button></div></form></main><script>const id=${JSON.stringify(occurrenceId)};const field=document.querySelector('#response');const button=document.querySelector('#submit');const counter=document.querySelector('#counter');const suggestions=document.querySelector('#suggestions');let categories=[];let saving;function renderSuggestions(){suggestions.replaceChildren();const match=/(?:^|\n)((?:<[^>\n]+>)*)<([^>\n]*)$/.exec(field.value);if(!match)return;const parents=[...match[1].matchAll(/<([^>]+)>/g)].map(value=>value[1].trim().toLowerCase());const prefix=match[2].trim().toLowerCase();for(const path of categories.filter(value=>{const parts=value.split('/');return parts.length===parents.length+1&&parents.every((parent,index)=>parts[index]===parent)&&parts.at(-1).startsWith(prefix)}).slice(0,5)){const choice=document.createElement('button');choice.type='button';choice.textContent='<'+path+'>';choice.addEventListener('click',()=>{field.value=field.value.slice(0,field.value.lastIndexOf('<'))+'<'+path.split('/').at(-1)+'> ';field.setSelectionRange(field.value.length,field.value.length);update();field.focus()});suggestions.append(choice)}}function update(){const count=[...field.value.trim()].length;button.disabled=count<20;counter.textContent=count+' / 20'+(count>=20?' ✓':'');counter.classList.toggle('ready',count>=20);renderSuggestions();clearTimeout(saving);saving=setTimeout(()=>window.focuslog.preserveDraft(id,field.value),80)}field.addEventListener('input',update);document.querySelector('#form').addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;try{await window.focuslog.completeReminder(id,field.value);document.body.classList.add('resolved')}catch(error){button.disabled=false;counter.textContent=error instanceof Error?error.message:'Unable to save your response'}});window.focuslog.searchFilters().then(filters=>{categories=filters.categories.map(category=>category.name);renderSuggestions()});window.focuslog.getDraft(id).then(text=>{field.value=text;update();field.focus();field.setSelectionRange(field.value.length,field.value.length)});window.addEventListener('focus',()=>field.focus());</script></body></html>`;
  // The HTML is a template literal, so regex `\n` escapes become real line
  // breaks before Electron parses the embedded script. Restore the escapes so
  // the overlay controller can parse and enable submission after 20 characters.
  const executableHtml = html.replaceAll(String.fromCharCode(10), String.raw`\n`);
  void overlay.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(executableHtml)}`);
  overlay.once('ready-to-show', () => {
    overlay.show();
    overlay.focus();
  });
}

function scheduleSessionReminder(
  database: ReturnType<typeof openDesktopDatabase>,
  sessionId: string,
  intervalMinutes: number,
  policyJson: string,
  now = new Date()
): string {
  const session = database
    .prepare('SELECT timezone_id AS timezoneId FROM focus_sessions WHERE id = ?')
    .get(sessionId) as { timezoneId: string } | undefined;
  if (!session) throw new Error('Focus session was not found.');
  const timestamp = now.toISOString();
  const dueAt = new Date(now.getTime() + intervalMinutes * 60_000).toISOString();
  const occurrenceId = ulid();
  database
    .prepare(
      `INSERT INTO reminder_occurrences
        (id, owner_id, focus_session_id, state, scheduled_at, original_scheduled_at,
         timezone_id, policy_snapshot_json, version, created_at, updated_at)
       VALUES (?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      occurrenceId,
      ownerId,
      sessionId,
      dueAt,
      dueAt,
      session.timezoneId,
      policyJson,
      ulid(),
      timestamp,
      timestamp
    );
  queueReminderSchedule(database, {
    ownerId,
    deviceId,
    occurrenceId,
    occurredAt: timestamp
  });
  return occurrenceId;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}
app.on('second-instance', () => showMainWindow());
void app
  .whenReady()
  .then(() => {
    if (!hasSingleInstanceLock) return;
    registerSecurityHeaders();
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
    aiService = new AIService(
      database,
      ownerId,
      new DesktopCredentialStore(userDataPath, electronSecretProtector)
    );
    analysisService = new AnalysisService(database, ownerId, aiService);
    aiQueueRuntime = createAIQueueRuntime(database, ownerId, analysisService, undefined, aiService);
    aiJobQueue = aiQueueRuntime.queue;
    queueReadService = aiQueueRuntime.read;
    aiJobWorker = aiQueueRuntime.worker;
    aiAnalysisSchedulerService = new AnalysisSchedulerService(
      database,
      ownerId,
      aiService,
      analysisService,
      undefined,
      aiJobQueue
    );
    aiAnalysisReadService = new AnalysisReadService(database, ownerId);
    aiMemoryControlService = new AIMemoryControlService(database, ownerId);
    playgroundEvaluationService = new PlaygroundEvaluationService(database, ownerId, aiService);
    phase5DService = new Phase5UXDiagnosticsPackagingService(app.getAppPath());
    aiAnalysisScheduler = new AnalysisSchedulerRuntime(aiAnalysisSchedulerService, () =>
      aiQueueRuntime?.wake()
    );
    void aiQueueRuntime.start();
    aiAnalysisScheduler.start();
    registerQueueRuntimeLifecycle(app, aiQueueRuntime, undefined, aiAnalysisScheduler);
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
    const reporting = new ReportingService(database, ownerId);
    widgetService = new WidgetService(database, ownerId, reporting, () => !synchronizationOnline);
    if (focusLogApiUrl) {
      const client = new AuthenticatedFocusLogClient(new URL(focusLogApiUrl), identity!);
      const synchronize = async () => {
        try {
          await drainOutbox(database, client, new Date(), deviceId);
          synchronizationOnline = true;
          lastSynchronizedAt = new Date().toISOString();
          lastSynchronizationError = undefined;
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
          notifyWidget();
        } catch (error) {
          synchronizationOnline = false;
          lastSynchronizationError = error instanceof Error ? error.message : String(error);
        }
      };
      void synchronize();
      requestSynchronization = () => void synchronize();
      setInterval(() => void synchronize(), 30_000);
      websocketClient = new FocusLogWebSocketClient(
        new URL(focusLogApiUrl),
        identity!,
        () => void synchronize(),
        () => {
          dialog.showErrorBox(
            'FocusLog device revoked',
            'This device is no longer trusted. Synchronization has been stopped.'
          );
        }
      );
      websocketClient.start();
    }
    tray = new Tray(trayIcon());
    tray.setToolTip('FocusLog reminders are running');
    tray.on('double-click', () => showMainWindow());
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open FocusLog', click: () => showMainWindow() },
        { label: 'Show widget', click: () => showWidget() },
        { label: 'Hide widget', click: () => widgetWindow?.hide() },
        { label: 'Quick add log', click: () => showWidgetQuickAdd() },
        {
          label: 'Start / stop focus',
          click: () => {
            const active = database
              .prepare(
                "SELECT id FROM focus_sessions WHERE owner_id = ? AND status IN ('ACTIVE', 'PAUSED') LIMIT 1"
              )
              .get(ownerId) as { id: string } | undefined;
            const command = active ? 'stopFocusSession' : 'startFocusSession';
            const window = showMainWindow();
            void window.webContents.executeJavaScript(`window.focuslog.${command}()`);
          }
        },
        {
          label: 'Quit',
          click: () => {
            const overlay = reminderOverlays.values().next().value as BrowserWindow | undefined;
            if (overlay && !overlay.isDestroyed()) {
              overlay.show();
              overlay.focus();
              return;
            }
            app.quit();
          }
        }
      ])
    );
    if (widgetSettings().enabled) showWidget();
    ipcMain.handle('focuslog:status', () => {
      const queuedOperations = (
        database
          .prepare('SELECT COUNT(*) AS count FROM outbox_operations WHERE acknowledged_at IS NULL')
          .get() as { count: number }
      ).count;
      return {
        offline: !synchronizationOnline,
        databaseReady: Boolean(desktopDatabase),
        startupEnabled:
          process.platform === 'win32' ? app.getLoginItemSettings().openAtLogin : false,
        closeBehavior: closeBehavior(database, ownerId),
        queuedOperations,
        lastSynchronizedAt,
        lastSynchronizationError
      };
    });
    ipcMain.handle('focuslog:ai-state', () => ({
      descriptors: aiService!.descriptors(),
      profiles: aiService!.profiles(),
      settings: aiService!.getSettings()
    }));
    ipcMain.handle('focuslog:save-ai-settings', (_event, settings: AISettings) =>
      aiService!.saveSettings(settings)
    );
    ipcMain.handle(
      'focuslog:save-ai-profile',
      (
        _event,
        profile: Partial<ProviderProfile> & {
          name: string;
          providerId: ProviderProfile['providerId'];
          credential?: string;
        }
      ) => aiService!.saveProfile(profile)
    );
    ipcMain.handle('focuslog:delete-ai-profile', (_event, profileId: string) =>
      aiService!.removeProfile(profileId)
    );
    ipcMain.handle('focuslog:test-ai-profile', (_event, profileId: string) =>
      aiService!.testConnection(profileId)
    );
    ipcMain.handle('focuslog:refresh-ai-models', (_event, profileId: string) =>
      aiService!.refreshModels(profileId)
    );
    ipcMain.handle('focuslog:grant-ai-cloud-consent', (_event, profileId: string) => {
      aiService!.grantCloudConsent(profileId);
      return { granted: true };
    });
    registerAIQueueIpcHandlers({
      ipcMain,
      ai: aiService!,
      analysis: analysisService!,
      queue: aiJobQueue!,
      worker: aiJobWorker!,
      read: queueReadService!,
      database,
      ownerId,
      capacity: providerCapacityFor(database),
      scheduler: aiAnalysisSchedulerService,
      analysisRead: aiAnalysisReadService
    });
    registerAIMemoryIpcHandlers({ ipcMain, service: () => aiMemoryControlService! });
    ipcMain.handle('focuslog:ai-playground-gate-status', () =>
      playgroundEvaluationService!.readGateStatus()
    );
    ipcMain.handle('focuslog:ai-playground-phase4-certification', (_event, inputs: unknown) => {
      const attacks = Array.isArray(inputs)
        ? inputs.filter((item): item is string => typeof item === 'string').slice(0, 50)
        : [];
      return playgroundEvaluationService!.certifyPhase4Gate(attacks);
    });
    ipcMain.handle('focuslog:ai-phase5d-certification', () => phase5DService!.certify());
    ipcMain.handle('focuslog:ai-diagnostic-export', (_event, input: unknown) => {
      const includePrivateContent =
        input !== null &&
        typeof input === 'object' &&
        'includePrivateContent' in input &&
        (input as { includePrivateContent?: unknown }).includePrivateContent === true;
      return phase5DService!.diagnosticExport({ includePrivateContent });
    });
    ipcMain.handle('focuslog:latest-daily-analysis', (_event, day: string) =>
      analysisService!.latestDaily(day)
    );
    ipcMain.handle('focuslog:dashboard-summary', () => {
      const session = database
        .prepare(
          `SELECT id, COALESCE(name, 'Focus session') AS name, status,
                  started_at AS startedAt
             FROM focus_sessions
            WHERE owner_id = ? AND status IN ('ACTIVE', 'PAUSED')
            ORDER BY started_at DESC LIMIT 1`
        )
        .get(ownerId) as
        { id: string; name: string; status: 'ACTIVE' | 'PAUSED'; startedAt: string } | undefined;
      const nextReminder = database
        .prepare(
          `SELECT id, state, scheduled_at AS dueAt
             FROM reminder_occurrences
            WHERE owner_id = ?
              AND state IN ('SCHEDULED', 'DUE', 'PRESENTED', 'SNOOZED')
            ORDER BY scheduled_at LIMIT 1`
        )
        .get(ownerId) as { id: string; state: string; dueAt: string } | undefined;
      const timezoneId = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const day = localDayForInstant(new Date(), timezoneId);
      const today = reporting.daily({ day, timezoneId });
      return {
        activeSession: session ?? null,
        nextReminder: nextReminder ?? null,
        reminderIntervalMinutes: reminderIntervalMinutes(database, ownerId),
        todayCompletionPercentage: today.focusScore,
        completedToday: today.completedIntervals,
        missedToday: today.missedIntervals
      };
    });
    ipcMain.handle('focuslog:widget-snapshot', () => widgetService!.snapshot(widgetSettings()));
    ipcMain.handle('focuslog:widget-settings', () => widgetSettings());
    ipcMain.handle('focuslog:save-widget-settings', (_event, patch: Partial<WidgetSettings>) => {
      if (!patch || typeof patch !== 'object') throw new Error('Widget settings are invalid.');
      const settings = saveWidgetSettings(patch);
      if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.setAlwaysOnTop(settings.alwaysOnTop);
        widgetWindow.setSize(settings.width, settings.height);
      }
      if (settings.enabled) showWidget();
      else widgetWindow?.hide();
      notifyWidget();
      return settings;
    });
    ipcMain.handle('focuslog:show-widget', () => {
      showWidget();
      return { shown: true };
    });
    ipcMain.handle('focuslog:hide-widget', () => {
      widgetWindow?.hide();
      return { hidden: true };
    });
    ipcMain.handle('focuslog:widget-quick-add', () => {
      showWidgetQuickAdd();
      return { opened: true };
    });
    ipcMain.handle('focuslog:widget-create-log', async (_event, text: unknown) => {
      if (typeof text !== 'string' || !text.trim())
        throw new Error('Enter a short log before saving.');
      const result = createOfflineCheckIn(database, {
        ownerId,
        deviceId,
        body: text.trim(),
        timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      notifyWidget();
      requestSynchronization?.();
      return result;
    });
    ipcMain.handle('focuslog:widget-focus-action', () => {
      showMainWindow();
      return { action: 'open-main' };
    });
    ipcMain.handle('focuslog:reminder-preferences', () => ({
      intervalMinutes: reminderIntervalMinutes(database, ownerId),
      choices: [...reminderIntervalChoices],
      minimum: minimumReminderInterval,
      maximum: maximumReminderInterval
    }));
    ipcMain.handle('focuslog:set-reminder-interval', (_event, intervalMinutes: number) => {
      const saved = setReminderInterval(database, ownerId, deviceId, intervalMinutes);
      scheduler?.tick();
      return saved;
    });
    ipcMain.handle('focuslog:device-identity', () => ({
      ownerId,
      deviceId,
      fingerprint: identity!.fingerprint,
      registered: Boolean(focusLogApiUrl)
    }));
    ipcMain.handle('focuslog:bootstrap-device', async (_event, apiUrl?: string) => {
      const address = apiUrl || focusLogApiUrl;
      if (!address) throw new Error('Set FOCUSLOG_API_URL before registering this owner device.');
      const client = new AuthenticatedFocusLogClient(new URL(address), identity!);
      return client.bootstrap('This Windows device');
    });
    ipcMain.handle('focuslog:set-startup', (_event, enabled: boolean) => {
      if (process.platform === 'win32') {
        app.setLoginItemSettings({
          openAtLogin: enabled,
          openAsHidden: true,
          args: enabled ? ['--background'] : []
        });
        writeOwnerSettings(database, ownerId, {
          ...readOwnerSettings(database, ownerId),
          startupEnabled: enabled
        });
      }
      return enabled;
    });
    ipcMain.handle('focuslog:set-close-behavior', (_event, behavior: CloseBehavior) =>
      setCloseBehavior(database, ownerId, behavior)
    );
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
      aiService = new AIService(
        database,
        ownerId,
        new DesktopCredentialStore(userDataPath, electronSecretProtector)
      );
      analysisService = new AnalysisService(database, ownerId, aiService);
      aiAnalysisSchedulerService = new AnalysisSchedulerService(
        database,
        ownerId,
        aiService,
        analysisService,
        undefined,
        aiJobQueue
      );
      aiAnalysisReadService = new AnalysisReadService(database, ownerId);
      aiMemoryControlService = new AIMemoryControlService(database, ownerId);
      phase5DService = new Phase5UXDiagnosticsPackagingService(app.getAppPath());
      scheduler?.recover('restart');
      return { ownerId: result.ownerId, createdAt: result.createdAt, kind: result.kind };
    });
    ipcMain.handle('focuslog:permanent-delete', async (_event, confirmation: string) => {
      if (confirmation !== 'DELETE ALL FOCUSLOG DATA')
        throw new Error('Permanent deletion confirmation did not match.');
      if (focusLogApiUrl) {
        await new AuthenticatedFocusLogClient(
          new URL(focusLogApiUrl),
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
      const overlay = reminderOverlays.get(occurrenceId);
      if (overlay && !overlay.isDestroyed()) {
        setTimeout(() => {
          if (!overlay.isDestroyed()) overlay.destroy();
        }, 220);
      }
      notifyWidget();
      return { completed: true };
    });
    ipcMain.handle('focuslog:snooze-reminder', (_event, occurrenceId: string, minutes: number) => {
      scheduler?.snooze(occurrenceId, minutes);
      reminderOverlays.get(occurrenceId)?.destroy();
      notifyWidget();
      return { snoozed: true };
    });
    ipcMain.handle('focuslog:emergency-dismiss-reminder', (_event, occurrenceId: string) => {
      scheduler?.emergencyDismiss(occurrenceId);
      reminderOverlays.get(occurrenceId)?.destroy();
      notifyWidget();
      return { dismissed: true };
    });
    ipcMain.handle('focuslog:start-focus-session', () => {
      const existing = database
        .prepare(
          `SELECT id FROM focus_sessions
            WHERE owner_id = ? AND status IN ('ACTIVE', 'PAUSED')
            ORDER BY started_at DESC LIMIT 1`
        )
        .get(ownerId) as { id: string } | undefined;
      if (existing) throw new Error('A focus session is already active.');
      const now = new Date().toISOString();
      const intervalMinutes = reminderIntervalMinutes(database, ownerId);
      const mode = database
        .prepare(
          'SELECT id, name FROM focus_modes WHERE owner_id = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 1'
        )
        .get(ownerId) as { id: string; name: string } | undefined;
      const policy = { ...defaultReminderPolicy, intervalMinutes };
      const policyJson = JSON.stringify(policy);
      const modeId = mode?.id ?? ulid();
      if (!mode) {
        database
          .prepare(
            "INSERT INTO focus_modes (id, owner_id, name, interval_minutes, policy_json, version, created_at, updated_at) VALUES (?, ?, 'Default focus', ?, ?, ?, ?, ?)"
          )
          .run(modeId, ownerId, intervalMinutes, policyJson, ulid(), now, now);
      } else {
        database
          .prepare(
            `UPDATE focus_modes
                SET interval_minutes = ?, policy_json = ?, version = ?, updated_at = ?
              WHERE id = ?`
          )
          .run(intervalMinutes, policyJson, ulid(), now, modeId);
      }
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
      scheduleSessionReminder(database, id, intervalMinutes, policyJson, new Date(now));
      notifyWidget();
      return { id, name: 'Focus session', status: 'ACTIVE' };
    });
    ipcMain.handle('focuslog:pause-focus-session', () => {
      const active = database
        .prepare(
          "SELECT id FROM focus_sessions WHERE owner_id = ? AND status = 'ACTIVE' ORDER BY started_at DESC LIMIT 1"
        )
        .get(ownerId) as { id: string } | undefined;
      if (!active) return null;
      const pending = database
        .prepare(
          `SELECT id, state FROM reminder_occurrences
            WHERE focus_session_id = ?
              AND state IN ('SCHEDULED', 'DUE', 'PRESENTED', 'SNOOZED')
            ORDER BY scheduled_at LIMIT 1`
        )
        .get(active.id) as { id: string; state: string } | undefined;
      if (pending && (pending.state === 'DUE' || pending.state === 'PRESENTED')) {
        throw new Error('Complete the current reminder before pausing this session.');
      }
      const timestamp = new Date().toISOString();
      database.transaction(() => {
        if (pending) {
          transitionReminderOffline(database, {
            ownerId,
            deviceId,
            occurrenceId: pending.id,
            to: 'SUPERSEDED',
            occurredAt: timestamp,
            reason: 'focus-session-paused'
          });
        }
        database
          .prepare("UPDATE focus_sessions SET status = 'PAUSED', updated_at = ? WHERE id = ?")
          .run(timestamp, active.id);
      })();
      notifyWidget();
      return { id: active.id, status: 'PAUSED' };
    });
    ipcMain.handle('focuslog:resume-focus-session', () => {
      const paused = database
        .prepare(
          "SELECT id, schedule_policy_json AS policyJson FROM focus_sessions WHERE owner_id = ? AND status = 'PAUSED' ORDER BY started_at DESC LIMIT 1"
        )
        .get(ownerId) as { id: string; policyJson: string } | undefined;
      if (!paused) return null;
      const intervalMinutes = reminderIntervalMinutes(database, ownerId);
      const policyJson = JSON.stringify({
        ...parseReminderPolicy(paused.policyJson),
        intervalMinutes
      });
      const timestamp = new Date().toISOString();
      database
        .prepare(
          "UPDATE focus_sessions SET status = 'ACTIVE', schedule_policy_json = ?, updated_at = ? WHERE id = ?"
        )
        .run(policyJson, timestamp, paused.id);
      scheduleSessionReminder(database, paused.id, intervalMinutes, policyJson);
      notifyWidget();
      return { id: paused.id, status: 'ACTIVE' };
    });
    ipcMain.handle('focuslog:stop-focus-session', () => {
      const active = database
        .prepare(
          "SELECT id FROM focus_sessions WHERE owner_id = ? AND status IN ('ACTIVE', 'PAUSED') ORDER BY started_at DESC LIMIT 1"
        )
        .get(ownerId) as { id: string } | undefined;
      if (!active) return null;
      const pending = database
        .prepare(
          `SELECT id, state FROM reminder_occurrences
            WHERE focus_session_id = ?
              AND state IN ('SCHEDULED', 'DUE', 'PRESENTED', 'SNOOZED')
            ORDER BY scheduled_at LIMIT 1`
        )
        .get(active.id) as { id: string; state: string } | undefined;
      if (pending && (pending.state === 'DUE' || pending.state === 'PRESENTED')) {
        throw new Error('Complete the current reminder before stopping this session.');
      }
      const timestamp = new Date().toISOString();
      database.transaction(() => {
        if (pending) {
          transitionReminderOffline(database, {
            ownerId,
            deviceId,
            occurrenceId: pending.id,
            to: 'SUPERSEDED',
            occurredAt: timestamp,
            reason: 'focus-session-stopped'
          });
        }
        database
          .prepare(
            "UPDATE focus_sessions SET status = 'COMPLETED', ended_at = ?, updated_at = ? WHERE id = ?"
          )
          .run(timestamp, timestamp, active.id);
      })();
      notifyWidget();
      return active;
    });
    ipcMain.handle('focuslog:create-manual-entry', (_event, text: string) => {
      if (!text.trim()) throw new Error('Manual entry cannot be empty.');
      const created = createOfflineCheckIn(database, {
        ownerId,
        deviceId,
        body: text,
        timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      notifyWidget();
      requestSynchronization?.();
      return created;
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
          'SELECT id, COALESCE(path, name) AS name FROM categories WHERE owner_id = ? AND deleted_at IS NULL ORDER BY depth, path, id'
        )
        .all(ownerId),
      sessions: database
        .prepare(
          'SELECT id, COALESCE(name, ?) AS name FROM focus_sessions WHERE owner_id = ? AND deleted_at IS NULL ORDER BY started_at DESC, id'
        )
        .all('Focus session', ownerId)
    }));
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
      if (!focusLogApiUrl)
        throw new Error('Set FOCUSLOG_API_URL and register this owner device before pairing.');
      return new AuthenticatedFocusLogClient(
        new URL(focusLogApiUrl),
        identity!
      ).createPairingCode();
    });
    ipcMain.handle('focuslog:pending-pairings', () => {
      if (!focusLogApiUrl) throw new Error('Set FOCUSLOG_API_URL before pairing.');
      return new AuthenticatedFocusLogClient(new URL(focusLogApiUrl), identity!).pendingPairings();
    });
    ipcMain.handle('focuslog:approve-pairing', (_event, pairingId: string) => {
      if (!focusLogApiUrl) throw new Error('Set FOCUSLOG_API_URL before pairing.');
      return new AuthenticatedFocusLogClient(new URL(focusLogApiUrl), identity!).approvePairing(
        pairingId
      );
    });
    if (!startedInBackground) showMainWindow();

    app.on('activate', () => {
      showMainWindow();
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
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  websocketClient?.stop();
  scheduler?.stop();
});
