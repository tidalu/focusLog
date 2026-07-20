import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('focuslog', {
  platform: process.platform,
  getStatus: () => ipcRenderer.invoke('focuslog:status'),
  getDashboardSummary: () => ipcRenderer.invoke('focuslog:dashboard-summary'),
  getReminderPreferences: () => ipcRenderer.invoke('focuslog:reminder-preferences'),
  setReminderInterval: (intervalMinutes: number) =>
    ipcRenderer.invoke('focuslog:set-reminder-interval', intervalMinutes),
  getDeviceIdentity: () => ipcRenderer.invoke('focuslog:device-identity'),
  bootstrapDevice: (apiUrl?: string) => ipcRenderer.invoke('focuslog:bootstrap-device', apiUrl),
  setStartup: (enabled: boolean) => ipcRenderer.invoke('focuslog:set-startup', enabled),
  createBackup: (kind: 'BACKUP' | 'EXPORT') => ipcRenderer.invoke('focuslog:create-backup', kind),
  restoreBackup: (recoveryKey: string) =>
    ipcRenderer.invoke('focuslog:restore-backup', recoveryKey),
  permanentlyDelete: (confirmation: string) =>
    ipcRenderer.invoke('focuslog:permanent-delete', confirmation),
  preserveDraft: (occurrenceId: string, text: string) =>
    ipcRenderer.invoke('focuslog:save-draft', occurrenceId, text),
  getDraft: (occurrenceId: string) => ipcRenderer.invoke('focuslog:get-draft', occurrenceId),
  completeReminder: (occurrenceId: string, text: string) =>
    ipcRenderer.invoke('focuslog:complete-reminder', occurrenceId, text),
  snoozeReminder: (occurrenceId: string, minutes: number) =>
    ipcRenderer.invoke('focuslog:snooze-reminder', occurrenceId, minutes),
  emergencyDismissReminder: (occurrenceId: string) =>
    ipcRenderer.invoke('focuslog:emergency-dismiss-reminder', occurrenceId),
  startFocusSession: () => ipcRenderer.invoke('focuslog:start-focus-session'),
  pauseFocusSession: () => ipcRenderer.invoke('focuslog:pause-focus-session'),
  resumeFocusSession: () => ipcRenderer.invoke('focuslog:resume-focus-session'),
  stopFocusSession: () => ipcRenderer.invoke('focuslog:stop-focus-session'),
  createManualEntry: (text: string) => ipcRenderer.invoke('focuslog:create-manual-entry', text),
  history: (filters: { query?: string; tagId?: string; categoryId?: string; sessionId?: string }) =>
    ipcRenderer.invoke('focuslog:history', filters),
  searchFilters: () => ipcRenderer.invoke('focuslog:search-filters'),
  report: (selection: { day: string; timezoneId: string }) =>
    ipcRenderer.invoke('focuslog:report', selection),
  heatmap: (selection: { year: number; timezoneId: string }) =>
    ipcRenderer.invoke('focuslog:heatmap', selection),
  dayLog: (selection: { day: string; timezoneId: string }) =>
    ipcRenderer.invoke('focuslog:day-log', selection),
  createPairing: () => ipcRenderer.invoke('focuslog:create-pairing'),
  pendingPairings: () => ipcRenderer.invoke('focuslog:pending-pairings'),
  approvePairing: (pairingId: string) => ipcRenderer.invoke('focuslog:approve-pairing', pairingId)
});
