/// <reference types="vite/client" />

interface Window {
  focuslog: {
    platform: string;
    getStatus(): Promise<{
      offline: boolean;
      databaseReady: boolean;
      startupEnabled: boolean;
      closeBehavior: 'tray' | 'exit';
      queuedOperations: number;
      lastSynchronizedAt?: string;
      lastSynchronizationError?: string;
    }>;
    getDashboardSummary(): Promise<{
      activeSession: {
        id: string;
        name: string;
        status: 'ACTIVE' | 'PAUSED';
        startedAt: string;
      } | null;
      nextReminder: { id: string; state: string; dueAt: string } | null;
      reminderIntervalMinutes: number;
      todayCompletionPercentage: number;
      completedToday: number;
      missedToday: number;
    }>;
    getReminderPreferences(): Promise<{
      intervalMinutes: number;
      choices: number[];
      minimum: number;
      maximum: number;
    }>;
    setReminderInterval(intervalMinutes: number): Promise<number>;
    getDeviceIdentity(): Promise<{
      ownerId: string;
      deviceId: string;
      fingerprint: string;
      registered: boolean;
    }>;
    bootstrapDevice(apiUrl?: string): Promise<{ ownerId: string; deviceId: string }>;
    setStartup(enabled: boolean): Promise<boolean>;
    setCloseBehavior(behavior: 'tray' | 'exit'): Promise<'tray' | 'exit'>;
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
    startFocusSession(): Promise<{ id: string; name: string; status: 'ACTIVE' }>;
    pauseFocusSession(): Promise<{ id: string; status: 'PAUSED' } | null>;
    resumeFocusSession(): Promise<{ id: string; status: 'ACTIVE' } | null>;
    stopFocusSession(): Promise<{ id: string } | null>;
    createManualEntry(
      text: string
    ): Promise<{ checkInId: string; revisionId: string; operationId: string }>;
    history(filters: {
      query?: string;
      tagId?: string;
      categoryId?: string;
      sessionId?: string;
      day?: string;
      timezoneId?: string;
    }): Promise<
      Array<{
        id: string;
        body: string;
        submittedAt: string;
        rank: number;
        category: string;
        device: string;
        responseDelaySeconds: number | null;
        focusSessionId: string | null;
        sections: Array<{
          id: string;
          path: string;
          body: string;
          metadata: Record<string, string>;
          position: number;
        }>;
      }>
    >;
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
      completionPercentage: number;
      averageResponseDelayMinutes: number;
      averageResponseDelaySeconds: number;
      longestFocusStreak: number;
      longestFocusStreakMinutes: number;
      entryCount: number;
      mostActiveHour: number | null;
      hourlyActivity: Array<{ hour: number; count: number }>;
      mostProductivePeriod: string | null;
      biggestDistraction: string | null;
      mostCommonActivity: string | null;
      wordCloud: Array<{ word: string; count: number }>;
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
        category?: string;
        device?: string;
        responseDelaySeconds?: number;
        sections?: Array<{
          id: string;
          path: string;
          body: string;
          metadata: Record<string, string>;
          position: number;
        }>;
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
