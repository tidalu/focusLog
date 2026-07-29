/// <reference types="vite/client" />

type AIMemoryOverview = {
  activeNamespace: {
    id: string;
    name: string;
    providerId: string;
    modelId: string;
    dimensions: number;
    coverageStatus: string;
    coverageExpectedChunks: number;
    coverageIndexedChunks: number;
    storageBytes: string;
    lastIndexingAt: string | null;
  } | null;
  indexing: { pending: number; failed: number };
  counts: { facts: number; graphNodes: number; graphEdges: number; staleMemory: number };
  subsystems: Record<'embeddings' | 'facts' | 'graph' | 'retrieval', boolean>;
  diagnostics: Array<{ code: string; message: string; createdAt: string }>;
};

type AIMemoryFact = {
  id: string;
  subject: string;
  predicate: string;
  objectValue: string;
  status: string;
  confidence: string;
  origin: string;
  validFrom: string | null;
  validTo: string | null;
  evidenceCount: number;
  providerProfileId: string | null;
  modelId: string | null;
};

type AIMemoryGraph = {
  nodes: Array<{ id: string; name: string; type: string; status: string; confidence: string }>;
  edges: Array<{
    id: string;
    source: string;
    predicate: string;
    target: string;
    status: string;
    confidence: string;
    evidenceCount: number;
  }>;
};

type AIMemorySearchResult = {
  planId: string;
  mode: 'semantic' | 'hybrid' | 'keyword';
  namespace: { id: string; modelId: string } | null;
  explanation: string[];
  results: Array<{
    id: string;
    sourceType: 'fact' | 'graph_relation' | 'summary' | 'raw_log';
    sourceId: string;
    sourceRevisionId: string | null;
    sourceVersion: string | null;
    staleState: string;
    classification: string;
    title: string;
    excerptRedacted: string;
    tokenEstimate: number;
    score: number;
    metadata: Record<string, unknown>;
    openSource: { checkInId: string; revisionId: string | null } | null;
  }>;
};

type AIPlaygroundGateStatus = {
  counts: {
    sessions: number;
    prompts: number;
    contextSnapshots: number;
    comparisonGroups: number;
    embeddingInspections: number;
    retrievalInspections: number;
    structuredWorkbenchRuns: number;
    datasets: number;
    evaluationRuns: number;
    exchangeRecords: number;
    benchmarkResults: number;
  };
  recentRuns: Array<{
    id: string;
    status: string;
    provider: string;
    model: string;
    totalTokens: number | null;
    costMicros: string;
    fallbackUsed: boolean;
    errorCode: string | null;
  }>;
  recentEvaluations: Array<{
    id: string;
    status: string;
    caseCount: number;
    passed: number;
    failed: number;
    modelEvaluatorLabel: string | null;
  }>;
  switches: Array<{
    subsystem: string;
    disabled: boolean;
    reason: string | null;
    effectiveBlocked: boolean;
    blockingSwitch: string | null;
  }>;
  capabilities: Array<{
    providerId: string;
    label: string;
    generation: boolean;
    streaming: boolean;
    structuredOutput: boolean;
    embeddings: boolean;
  }>;
  states: string[];
};

type AIPhase4Certification = {
  adversarialCases: number;
  sanitized: boolean;
  isolation: Record<string, boolean>;
  diagnostics: Array<{ code: string; message: string }>;
};

interface Window {
  focuslog: {
    platform: string;
    getAIState(): Promise<{
      descriptors: Array<{
        id: string;
        label: string;
        kind: 'LOCAL' | 'CLOUD';
        defaultEndpoint?: string;
        documentationUrl: string;
        credentialLabel?: string;
        capabilities: Record<string, boolean>;
      }>;
      profiles: Array<{
        id: string;
        name: string;
        providerId: string;
        enabled: boolean;
        endpoint: string | null;
        generationModel: string | null;
        embeddingModel: string | null;
        temperature: number;
        topP: number;
        maxOutputTokens: number;
        timeoutMs: number;
        credentialConfigured: boolean;
      }>;
      settings: {
        mode: 'DISABLED' | 'LOCAL' | 'CLOUD' | 'HYBRID';
        maxContextTokens: number;
        maxOutputTokens: number;
        monthlyCloudBudgetUsd: number | null;
        requestCostCapUsd: number | null;
        dataSharingPreview: boolean;
        automaticAnalysis: boolean;
        featureFlags: Record<'analyses' | 'facts' | 'graph' | 'embeddings' | 'playground', boolean>;
      };
    }>;
    saveAISettings(
      settings: Awaited<ReturnType<Window['focuslog']['getAIState']>>['settings']
    ): Promise<Awaited<ReturnType<Window['focuslog']['getAIState']>>['settings']>;
    saveAIProfile(profile: {
      id?: string;
      name: string;
      providerId: string;
      endpoint?: string | null;
      generationModel?: string | null;
      embeddingModel?: string | null;
      enabled?: boolean;
      temperature?: number;
      topP?: number;
      maxOutputTokens?: number;
      timeoutMs?: number;
      credential?: string;
    }): Promise<Awaited<ReturnType<Window['focuslog']['getAIState']>>['profiles'][number]>;
    deleteAIProfile(profileId: string): Promise<void>;
    testAIProfile(profileId: string): Promise<{
      ok: boolean;
      latencyMs: number;
      endpoint: string;
      selectedModel: string | null;
      capabilities: Record<string, boolean>;
      models: Array<{ id: string; displayName: string; contextWindow?: number }>;
      modelsStale: boolean;
      error?: { code: string; message: string };
    }>;
    refreshAIModels(
      profileId: string
    ): Promise<{ models: Array<{ id: string; displayName: string }>; stale: boolean }>;
    grantAICloudConsent(profileId: string): Promise<{ granted: true }>;
    analyzeDaily(
      profileId: string,
      day: string
    ): Promise<{ id: string; status: string; localDate: string; createdAt: string }>;
    aiQueueCounts(): Promise<Record<string, number>>;
    aiQueueJobs(input?: { limit?: number; status?: string }): Promise<
      Array<{
        id: string;
        kind: string;
        status: string;
        priority: number;
        createdAt: string;
        scheduledAt: string | null;
        startedAt: string | null;
        finishedAt: string | null;
        attempts: number;
        maxAttempts: number;
        runAfter: string;
        cancellationRequested: boolean;
        providerName: string | null;
        providerType: string | null;
        requestedModelId: string | null;
        actualModelId: string | null;
        durationMs: number | null;
        inputTokens: number | null;
        outputTokens: number | null;
        estimatedCostUsd: number | null;
        errorCode: string | null;
        errorMessage: string | null;
        resultReference: string | null;
        actions: { canCancel: boolean; canRetry: boolean };
      }>
    >;
    aiQueueJob(
      id: string
    ): Promise<Awaited<ReturnType<Window['focuslog']['aiQueueJobs']>>[number] | null>;
    cancelAIJob(
      id: string
    ): Promise<Awaited<ReturnType<Window['focuslog']['aiQueueJobs']>>[number] | null>;
    retryAIJob(
      id: string
    ): Promise<Awaited<ReturnType<Window['focuslog']['aiQueueJobs']>>[number] | null>;
    wakeAIQueue(): Promise<{ running: boolean }>;
    aiFallbackChains(): Promise<
      Array<{
        id: string;
        name: string;
        version: number;
        enabled: boolean;
        scope: string;
        purpose: string | null;
      }>
    >;
    aiBudgetSummary(period?: string): Promise<{
      periodKey: string;
      currency: 'USD';
      limitMicros: string | null;
      settledMicros: string;
      reservedMicros: string;
      remainingMicros: string | null;
      requestCapMicros: string | null;
    }>;
    aiKillSwitches(): Promise<
      Array<{
        scope: 'global' | 'provider' | 'chain';
        targetId: string;
        enabled: boolean;
        reason: string | null;
      }>
    >;
    setAIKillSwitch(input: {
      scope: 'global' | 'provider' | 'chain';
      targetId: string;
      enabled: boolean;
    }): Promise<
      Array<{
        scope: 'global' | 'provider' | 'chain';
        targetId: string;
        enabled: boolean;
        reason: string | null;
      }>
    >;
    aiCircuitBreakers(): Promise<
      Array<{
        profileId: string;
        operation: string;
        state: 'closed' | 'open' | 'half_open';
        failures: number;
        openUntil: string | null;
        reason: string | null;
        probeActive: boolean;
      }>
    >;
    aiConcurrency(): Promise<{
      globalLimit: number;
      active: number;
      waiting: number;
      providers: Array<{ profileId: string; active: number; waiting: number }>;
    }>;
    aiAnalysisSchedules(): Promise<
      Array<{
        level: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
        enabled: boolean;
        localTime: string;
        timezone: string;
        providerProfileId: string | null;
        modelMode: 'profile_default' | 'fixed';
        modelId: string | null;
        fallbackChainId: string | null;
        privacyMode: 'DISABLED' | 'LOCAL' | 'CLOUD' | 'HYBRID';
        maxCostMicros: string | null;
        killSwitchEnabled: boolean;
        catchUpLimit: number;
        lastEvaluationAt: string | null;
        lastEligiblePeriodId: string | null;
        nextExpectedRunAt: string | null;
        lastSuccessAt: string | null;
        diagnostic: { code: string; message: string; at: string } | null;
      }>
    >;
    saveAIAnalysisSchedule(input: {
      level: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
      enabled: boolean;
      localTime: string;
      timezone: string;
      providerProfileId: string;
      modelMode?: 'profile_default' | 'fixed';
      modelId?: string | null;
      fallbackChainId?: string | null;
      privacyMode: 'DISABLED' | 'LOCAL' | 'CLOUD' | 'HYBRID';
      maxCostMicros?: string | null;
      killSwitchEnabled?: boolean;
      catchUpLimit?: number;
    }): Promise<Awaited<ReturnType<Window['focuslog']['aiAnalysisSchedules']>>[number]>;
    analyzeNow(input: {
      level: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
      localAnchor: string;
      timezone: string;
      providerProfileId: string;
      modelId?: string | null;
      fallbackChainId?: string | null;
      privacyMode?: 'DISABLED' | 'LOCAL' | 'CLOUD' | 'HYBRID';
      maxCostMicros?: string | null;
      regenerate?: boolean;
    }): Promise<{
      job: Awaited<ReturnType<Window['focuslog']['aiQueueJobs']>>[number] | null;
      period: Record<string, string>;
      regeneration: number;
      missingDependencies: Array<{ level: string; periodId: string }>;
    }>;
    aiAnalysisVersions(input: {
      level: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
      limit?: number;
    }): Promise<
      Array<{
        id: string;
        level: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
        periodId: string;
        timezone: string;
        version: number;
        status: 'current' | 'stale' | 'superseded' | 'legacy';
        staleReason: string | null;
        summary: string;
        confidence: string | null;
        completeness: string | null;
        providerProfileId: string | null;
        providerName: string | null;
        providerId: string | null;
        modelId: string | null;
        fallbackUsed: boolean;
        promptVersion: string;
        schemaVersion: string;
        inputTokens: number | null;
        outputTokens: number | null;
        totalTokens: number | null;
        costMicros: string | null;
        jobId: string | null;
        createdAt: string;
      }>
    >;
    aiAnalysisResult(id: string): Promise<
      Awaited<ReturnType<Window['focuslog']['aiAnalysisVersions']>>[number] & {
        structured: Record<string, unknown> | null;
        children: Array<{
          id: string;
          level: string;
          periodId: string;
          version: number;
          status: string | null;
        }>;
        evidence: Array<{
          evidenceId: string;
          checkInId: string;
          revisionId: string;
          occurredAt: string;
          available: boolean;
          preview: string | null;
        }>;
        history: Awaited<ReturnType<Window['focuslog']['aiAnalysisVersions']>>;
      }
    >;
    aiAnalysisDependencies(input: {
      level: string;
      periodId: string;
    }): Promise<Array<{ level: string; periodId: string; status: 'available' | 'missing' }>>;
    aiSchedulerStatus(): Promise<{
      schedules: number;
      diagnostics: Array<{ level: string; code: string; message: string; createdAt: string }>;
    }>;
    aiMemoryOverview(): Promise<AIMemoryOverview>;
    aiMemorySearch(input: {
      query: string;
      mode?: 'semantic' | 'hybrid' | 'keyword';
      limit?: number;
      sourceType?: 'fact' | 'graph_relation' | 'summary' | 'raw_log';
      dateStart?: string;
      dateEnd?: string;
      entity?: string;
    }): Promise<AIMemorySearchResult>;
    aiMemoryFacts(input?: {
      query?: string;
      status?: string;
      limit?: number;
    }): Promise<AIMemoryFact[]>;
    aiMemoryGraph(input?: { query?: string; limit?: number }): Promise<AIMemoryGraph>;
    aiMemoryRejectFact(id: string, reason?: string): Promise<AIMemoryFact>;
    aiMemoryCorrectFact(
      id: string,
      input: {
        subject: string;
        predicate: string;
        objectValue: string;
        factType?: string;
        confidence?: number;
        reason: string;
        validFrom?: string;
        validTo?: string;
      }
    ): Promise<AIMemoryFact>;
    aiMemorySplitEntity(input: {
      entityId: string;
      name: string;
      type: string;
    }): Promise<{ id: string }>;
    aiMemorySetSubsystem(input: {
      subsystem: 'embeddings' | 'facts' | 'graph' | 'retrieval';
      enabled: boolean;
    }): Promise<AIMemoryOverview>;
    aiMemoryRebuildNamespace(): Promise<{ queued: boolean; namespaceId: string | null }>;
    aiMemoryDeleteDerived(input: {
      target: 'embeddings' | 'facts_graph';
      confirmation: string;
    }): Promise<AIMemoryOverview>;
    aiMemoryExport(): Promise<{
      schemaVersion: 1;
      overview: AIMemoryOverview;
      facts: AIMemoryFact[];
      graph: AIMemoryGraph;
    }>;
    aiPlaygroundGateStatus(): Promise<AIPlaygroundGateStatus>;
    aiPlaygroundPhase4Certification(inputs: string[]): Promise<AIPhase4Certification>;
    aiPhase5DCertification(): Promise<{
      uxStates: Array<{
        screen: 'AI settings' | 'AI analyses' | 'AI memory' | 'AI Playground' | 'Diagnostics';
        state: string;
        dataSafety: string;
        retryAppropriate: boolean;
        nextAction: string;
      }>;
      accessibility: Array<{ category: string; evidence: string; status: 'passed' | 'blocked' }>;
      diagnostics: Awaited<ReturnType<Window['focuslog']['aiDiagnosticExport']>>;
      packaging: Array<{ scenario: string; evidence: string; status: 'passed' | 'blocked' }>;
      ci: Array<{
        lane: 'fast-pr' | 'nightly' | 'release-candidate';
        commands: string[];
        protectedSecrets: boolean;
        status: 'passed' | 'blocked';
      }>;
      passed: boolean;
    }>;
    aiDiagnosticExport(input?: { includePrivateContent?: boolean }): Promise<{
      schemaVersion: 1;
      generatedAt: string;
      app: { name: 'FocusLog'; desktopPackageVersion: string; schemaVersion: number };
      queue: {
        historyWindow: string;
        normalizedErrorCodes: string[];
        deadLetterDisclosure: string;
      };
      providers: {
        breakerStates: string[];
        credentialValuesIncluded: false;
        rawProviderResponsesIncluded: false;
      };
      memory: { namespaceCoverage: string; staleCounts: string; rebuildProgress: string };
      usage: {
        exactMoneyFormat: 'micro-usd-string';
        settledMicros: string;
        reservedMicros: string;
      };
      environment: { node: string; platform: string; arch: string };
      exclusions: string[];
      userContentIncluded: boolean;
      privateContentWarning: string | null;
      diagnostics: Array<{ code: string; message: string }>;
    }>;
    latestDailyAnalysis(
      day: string
    ): Promise<{ id: string; content: string; createdAt: string; sourceCount: number } | null>;
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
    widgetSettings(): Promise<{
      enabled: boolean;
      mode: 'minimal' | 'productivity' | 'insight';
      privacy: 'hidden' | 'redacted' | 'full';
      alwaysOnTop: boolean;
      width: number;
      height: number;
      x?: number;
      y?: number;
    }>;
    saveWidgetSettings(
      patch: Record<string, unknown>
    ): Promise<Awaited<ReturnType<Window['focuslog']['widgetSettings']>>>;
    showWidget(): Promise<{ shown: true }>;
    hideWidget(): Promise<{ hidden: true }>;
    openWidgetQuickAdd(): Promise<{ opened: true }>;
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
