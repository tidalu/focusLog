import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('focuslog', {
  platform: process.platform,
  getStatus: () => ipcRenderer.invoke('focuslog:status'),
  getAIState: () => ipcRenderer.invoke('focuslog:ai-state'),
  saveAISettings: (settings: unknown) => ipcRenderer.invoke('focuslog:save-ai-settings', settings),
  saveAIProfile: (profile: unknown) => ipcRenderer.invoke('focuslog:save-ai-profile', profile),
  deleteAIProfile: (profileId: string) =>
    ipcRenderer.invoke('focuslog:delete-ai-profile', profileId),
  testAIProfile: (profileId: string) => ipcRenderer.invoke('focuslog:test-ai-profile', profileId),
  refreshAIModels: (profileId: string) =>
    ipcRenderer.invoke('focuslog:refresh-ai-models', profileId),
  grantAICloudConsent: (profileId: string) =>
    ipcRenderer.invoke('focuslog:grant-ai-cloud-consent', profileId),
  analyzeDaily: (profileId: string, day: string) =>
    ipcRenderer.invoke('focuslog:analyze-daily', profileId, day),
  aiQueueCounts: () => ipcRenderer.invoke('focuslog:ai-queue-counts'),
  aiQueueJobs: (input?: { limit?: number; status?: string }) =>
    ipcRenderer.invoke('focuslog:ai-queue-jobs', input),
  aiQueueJob: (id: string) => ipcRenderer.invoke('focuslog:ai-queue-job', id),
  aiQueueExecution: (id: string) => ipcRenderer.invoke('focuslog:ai-queue-execution', id),
  cancelAIJob: (id: string) => ipcRenderer.invoke('focuslog:cancel-ai-job', id),
  retryAIJob: (id: string) => ipcRenderer.invoke('focuslog:retry-ai-job', id),
  wakeAIQueue: () => ipcRenderer.invoke('focuslog:wake-ai-queue'),
  aiFallbackChains: () => ipcRenderer.invoke('focuslog:ai-fallback-chains'),
  aiBudgetSummary: (period?: string) => ipcRenderer.invoke('focuslog:ai-budget-summary', period),
  aiKillSwitches: () => ipcRenderer.invoke('focuslog:ai-kill-switches'),
  setAIKillSwitch: (input: {
    scope: 'global' | 'provider' | 'chain';
    targetId: string;
    enabled: boolean;
  }) => ipcRenderer.invoke('focuslog:set-ai-kill-switch', input),
  aiCircuitBreakers: () => ipcRenderer.invoke('focuslog:ai-circuit-breakers'),
  aiConcurrency: () => ipcRenderer.invoke('focuslog:ai-concurrency'),
  aiAnalysisSchedules: () => ipcRenderer.invoke('focuslog:ai-analysis-schedules'),
  saveAIAnalysisSchedule: (input: unknown) =>
    ipcRenderer.invoke('focuslog:save-ai-analysis-schedule', input),
  analyzeNow: (input: unknown) => ipcRenderer.invoke('focuslog:analyze-now', input),
  aiAnalysisVersions: (input: unknown) =>
    ipcRenderer.invoke('focuslog:ai-analysis-versions', input),
  aiAnalysisResult: (id: string) => ipcRenderer.invoke('focuslog:ai-analysis-result', id),
  aiAnalysisDependencies: (input: unknown) =>
    ipcRenderer.invoke('focuslog:ai-analysis-dependencies', input),
  aiSchedulerStatus: () => ipcRenderer.invoke('focuslog:ai-scheduler-status'),
  aiMemoryOverview: () => ipcRenderer.invoke('focuslog:ai-memory-overview'),
  aiMemorySearch: (input: unknown) => ipcRenderer.invoke('focuslog:ai-memory-search', input),
  aiMemoryFacts: (input?: unknown) => ipcRenderer.invoke('focuslog:ai-memory-facts', input),
  aiMemoryGraph: (input?: unknown) => ipcRenderer.invoke('focuslog:ai-memory-graph', input),
  aiMemoryRejectFact: (id: string, reason?: string) =>
    ipcRenderer.invoke('focuslog:ai-memory-reject-fact', id, reason),
  aiMemoryCorrectFact: (id: string, input: unknown) =>
    ipcRenderer.invoke('focuslog:ai-memory-correct-fact', id, input),
  aiMemorySplitEntity: (input: unknown) =>
    ipcRenderer.invoke('focuslog:ai-memory-split-entity', input),
  aiMemorySetSubsystem: (input: unknown) =>
    ipcRenderer.invoke('focuslog:ai-memory-set-subsystem', input),
  aiMemoryRebuildNamespace: () => ipcRenderer.invoke('focuslog:ai-memory-rebuild-namespace'),
  aiMemoryDeleteDerived: (input: unknown) =>
    ipcRenderer.invoke('focuslog:ai-memory-delete-derived', input),
  aiMemoryExport: () => ipcRenderer.invoke('focuslog:ai-memory-export'),
  aiPlaygroundGateStatus: () => ipcRenderer.invoke('focuslog:ai-playground-gate-status'),
  aiPlaygroundPhase4Certification: (inputs: string[]) =>
    ipcRenderer.invoke('focuslog:ai-playground-phase4-certification', inputs),
  aiPhase5DCertification: () => ipcRenderer.invoke('focuslog:ai-phase5d-certification'),
  aiDiagnosticExport: (input?: { includePrivateContent?: boolean }) =>
    ipcRenderer.invoke('focuslog:ai-diagnostic-export', input),
  latestDailyAnalysis: (day: string) => ipcRenderer.invoke('focuslog:latest-daily-analysis', day),
  getDashboardSummary: () => ipcRenderer.invoke('focuslog:dashboard-summary'),
  getReminderPreferences: () => ipcRenderer.invoke('focuslog:reminder-preferences'),
  setReminderInterval: (intervalMinutes: number) =>
    ipcRenderer.invoke('focuslog:set-reminder-interval', intervalMinutes),
  getDeviceIdentity: () => ipcRenderer.invoke('focuslog:device-identity'),
  bootstrapDevice: (apiUrl?: string) => ipcRenderer.invoke('focuslog:bootstrap-device', apiUrl),
  setStartup: (enabled: boolean) => ipcRenderer.invoke('focuslog:set-startup', enabled),
  setCloseBehavior: (behavior: 'tray' | 'exit') =>
    ipcRenderer.invoke('focuslog:set-close-behavior', behavior),
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
  widgetSnapshot: () => ipcRenderer.invoke('focuslog:widget-snapshot'),
  widgetSettings: () => ipcRenderer.invoke('focuslog:widget-settings'),
  saveWidgetSettings: (patch: unknown) =>
    ipcRenderer.invoke('focuslog:save-widget-settings', patch),
  showWidget: () => ipcRenderer.invoke('focuslog:show-widget'),
  hideWidget: () => ipcRenderer.invoke('focuslog:hide-widget'),
  openWidgetQuickAdd: () => ipcRenderer.invoke('focuslog:widget-quick-add'),
  widgetCreateLog: (text: string) => ipcRenderer.invoke('focuslog:widget-create-log', text),
  widgetFocusAction: () => ipcRenderer.invoke('focuslog:widget-focus-action'),
  onWidgetUpdated: (listener: () => void) => {
    ipcRenderer.removeAllListeners('focuslog:widget-updated');
    ipcRenderer.on('focuslog:widget-updated', listener);
  },
  history: (filters: {
    query?: string;
    tagId?: string;
    categoryId?: string;
    sessionId?: string;
    day?: string;
    timezoneId?: string;
  }) => ipcRenderer.invoke('focuslog:history', filters),
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
