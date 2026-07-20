/// <reference types="vite/client" />

interface Window {
  focuslog: {
    platform: string;
    getStatus(): Promise<{ offline: boolean; databaseReady: boolean; startupEnabled: boolean }>;
    getDeviceIdentity(): Promise<{
      ownerId: string;
      deviceId: string;
      fingerprint: string;
      registered: boolean;
    }>;
    bootstrapDevice(apiUrl?: string): Promise<{ ownerId: string; deviceId: string }>;
    setStartup(enabled: boolean): Promise<boolean>;
    createBackup(kind: 'BACKUP' | 'EXPORT'): Promise<{ path: string; recoveryKey: string } | null>;
    restoreBackup(
      recoveryKey: string
    ): Promise<{ ownerId: string; createdAt: string; kind: 'BACKUP' | 'EXPORT' } | null>;
    permanentlyDelete(confirmation: string): Promise<{ deleted: true }>;
    preserveDraft(occurrenceId: string, text: string): Promise<void>;
    getDraft(occurrenceId: string): Promise<string>;
    completeReminder(occurrenceId: string, text: string): Promise<{ completed: boolean }>;
    snoozeReminder(occurrenceId: string, minutes: number): Promise<{ snoozed: boolean }>;
    emergencyDismissReminder(occurrenceId: string): Promise<{ dismissed: boolean }>;
    startFocusSession(): Promise<{ id: string; name: string }>;
    stopFocusSession(): Promise<{ id: string } | null>;
    history(filters: {
      query?: string;
      tagId?: string;
      categoryId?: string;
      sessionId?: string;
    }): Promise<Array<{ id: string; body: string; submittedAt: string; rank: number }>>;
    searchFilters(): Promise<{
      tags: Array<{ id: string; name: string }>;
      categories: Array<{ id: string; name: string }>;
      sessions: Array<{ id: string; name: string }>;
    }>;
    report(selection: { day: string; timezoneId: string }): Promise<{
      day: string;
      timezoneId: string;
      dayDurationMinutes: number;
      completedIntervals: number;
      missedIntervals: number;
      totalTrackedMinutes: number;
      focusScore: number;
      categories: Array<{ name: string; count: number }>;
      occurrenceStates: Array<{ state: string; count: number }>;
      timeline: Array<{
        id: string;
        kind:
          | 'CHECK_IN'
          | 'REMINDER'
          | 'REMINDER_TRANSITION'
          | 'SESSION_START'
          | 'SESSION_END'
          | 'CONFLICT';
        occurredAt: string;
        title: string;
        detail: string;
        originalTimezoneId?: string;
      }>;
      trends: { weekly: number; monthly: number; yearly: number };
    }>;
    heatmap(selection: { year: number; timezoneId: string }): Promise<{
      year: number;
      timezoneId: string;
      metric: 'check-ins';
      metricDescription: string;
      thresholds: number[];
      days: Array<{ day: string; value: number; intensity: 0 | 1 | 2 | 3 | 4 }>;
    }>;
    dayLog(selection: { day: string; timezoneId: string }): Promise<
      Array<{
        id: string;
        kind: string;
        occurredAt: string;
        title: string;
        detail: string;
        originalTimezoneId?: string;
      }>
    >;
    createPairing(): Promise<{ pairingId: string; code: string; expiresAt: string }>;
    pendingPairings(): Promise<
      Array<{ id: string; candidateDeviceId: string; candidatePlatform: string; expiresAt: string }>
    >;
    approvePairing(pairingId: string): Promise<void>;
  };
}
