import React, { useEffect, useMemo, useState } from 'react';

type AIState = Awaited<ReturnType<Window['focuslog']['getAIState']>>;
type QueueJob = Awaited<ReturnType<Window['focuslog']['aiQueueJobs']>>[number];
type AIControls = {
  chains: Awaited<ReturnType<Window['focuslog']['aiFallbackChains']>>;
  budget: Awaited<ReturnType<Window['focuslog']['aiBudgetSummary']>>;
  switches: Awaited<ReturnType<Window['focuslog']['aiKillSwitches']>>;
  breakers: Awaited<ReturnType<Window['focuslog']['aiCircuitBreakers']>>;
  concurrency: Awaited<ReturnType<Window['focuslog']['aiConcurrency']>>;
};
type AnalysisLevel = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
type AnalysisSchedule = Awaited<ReturnType<Window['focuslog']['aiAnalysisSchedules']>>[number];
type AnalysisVersion = Awaited<ReturnType<Window['focuslog']['aiAnalysisVersions']>>[number];
type AnalysisResult = Awaited<ReturnType<Window['focuslog']['aiAnalysisResult']>>;
type Phase5DCertification = Awaited<ReturnType<Window['focuslog']['aiPhase5DCertification']>>;
const analysisLevels: AnalysisLevel[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
const money = (value: string | null) => (value === null ? 'not set' : `${value} micro-USD`);

const emptyProfile = {
  name: '',
  providerId: 'ollama',
  endpoint: 'http://127.0.0.1:11434',
  generationModel: '',
  temperature: 0.2,
  topP: 1,
  maxOutputTokens: 2048,
  timeoutMs: 30_000,
  credential: '',
  enabled: true
};

export function AnalysisResultCard({ result }: { result: AnalysisResult }): React.JSX.Element {
  return (
    <article className="ai-analysis" aria-label="Analysis result">
      <h3>{result.periodId} summary</h3>
      <p>{result.summary}</p>
      <dl className="analysis-disclosure">
        <dt>Status</dt>
        <dd>{result.status}</dd>
        <dt>Timezone</dt>
        <dd>{result.timezone}</dd>
        <dt>Provider</dt>
        <dd>
          {result.providerName ?? result.providerId ?? 'unknown'} /{' '}
          {result.modelId ?? 'unknown model'}
        </dd>
        <dt>Fallback</dt>
        <dd>{result.fallbackUsed ? 'used' : 'not used'}</dd>
        <dt>Prompt/schema</dt>
        <dd>
          {result.promptVersion} / {result.schemaVersion}
        </dd>
        <dt>Tokens</dt>
        <dd>
          {result.totalTokens ?? 'unknown'} total ({result.inputTokens ?? 'unknown'} in,{' '}
          {result.outputTokens ?? 'unknown'} out)
        </dd>
        <dt>Cost</dt>
        <dd>{money(result.costMicros)}</dd>
      </dl>
      {result.structured && 'result' in result.structured && (
        <div className="structured-sections">
          {Object.entries((result.structured.result ?? {}) as Record<string, unknown>)
            .filter(([key]) => key !== 'summary')
            .slice(0, 8)
            .map(([key, value]) => (
              <section key={key}>
                <h4>{key}</h4>
                <pre>{JSON.stringify(value, null, 2)}</pre>
              </section>
            ))}
        </div>
      )}
      <details>
        <summary>Provenance and version history</summary>
        <p>
          {result.children.length} child version(s), {result.evidence.length} evidence item(s),{' '}
          {result.history.length} retained version(s).
        </p>
        <ul>
          {result.children.slice(0, 50).map((child) => (
            <li key={child.id}>
              {child.level} {child.periodId} v{child.version}: {child.status ?? 'unavailable'}
            </li>
          ))}
        </ul>
        <ul>
          {result.evidence.slice(0, 50).map((item) => (
            <li key={`${item.evidenceId}:${item.revisionId}`}>
              {item.available ? item.preview : 'Evidence unavailable or unauthorized'} (
              {item.revisionId})
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

export function AISettingsPage({ notify }: { notify(message: string): void }): React.JSX.Element {
  const [state, setState] = useState<AIState | null>(null);
  const [draft, setDraft] = useState(emptyProfile);
  const [testing, setTesting] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [dailyProfile, setDailyProfile] = useState('');
  const [dailyContent, setDailyContent] = useState('');
  const [dailyJob, setDailyJob] = useState<QueueJob | null>(null);
  const [modelOptions, setModelOptions] = useState<
    Record<string, Array<{ id: string; displayName: string }>>
  >({});
  const [controls, setControls] = useState<AIControls | null>(null);
  const [schedules, setSchedules] = useState<AnalysisSchedule[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<AnalysisLevel>('daily');
  const [versions, setVersions] = useState<AnalysisVersion[]>([]);
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);
  const [analysisJob, setAnalysisJob] = useState<QueueJob | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<Awaited<
    ReturnType<Window['focuslog']['aiSchedulerStatus']>
  > | null>(null);
  const [phase5D, setPhase5D] = useState<Phase5DCertification | null>(null);
  const [diagnosticExportPreview, setDiagnosticExportPreview] = useState('');

  const reload = async () => setState(await window.focuslog.getAIState());
  const reloadAnalysis = async (level: AnalysisLevel = selectedLevel) => {
    const [nextSchedules, nextVersions, nextSchedulerStatus] = await Promise.all([
      window.focuslog.aiAnalysisSchedules(),
      window.focuslog.aiAnalysisVersions({ level, limit: 25 }),
      window.focuslog.aiSchedulerStatus()
    ]);
    setSchedules(nextSchedules);
    setVersions(nextVersions);
    setSchedulerStatus(nextSchedulerStatus);
    setSelectedResult(
      nextVersions[0] ? await window.focuslog.aiAnalysisResult(nextVersions[0].id) : null
    );
  };
  useEffect(() => {
    void reload();
    void reloadAnalysis();
    void Promise.all([
      window.focuslog.aiFallbackChains(),
      window.focuslog.aiBudgetSummary(),
      window.focuslog.aiKillSwitches(),
      window.focuslog.aiCircuitBreakers(),
      window.focuslog.aiConcurrency()
    ])
      .then(([chains, budget, switches, breakers, concurrency]) =>
        setControls({ chains, budget, switches, breakers, concurrency })
      )
      .catch(() => setControls(null));
    void window.focuslog
      .aiPhase5DCertification()
      .then(setPhase5D)
      .catch(() => setPhase5D(null));
  }, []);
  useEffect(() => {
    void reloadAnalysis(selectedLevel);
  }, [selectedLevel]);
  useEffect(() => {
    if (
      !dailyJob ||
      ['succeeded', 'failed', 'cancelled', 'dead_lettered'].includes(dailyJob.status)
    )
      return;
    const interval = window.setInterval(() => {
      void window.focuslog.aiQueueJob(dailyJob.id).then(setDailyJob);
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [dailyJob]);
  const descriptor = useMemo(
    () => state?.descriptors.find((item) => item.id === draft.providerId),
    [state, draft.providerId]
  );
  const enabledProfiles =
    state?.profiles.filter((profile) => profile.enabled && profile.generationModel) ?? [];
  const selectedSchedule = schedules.find((schedule) => schedule.level === selectedLevel);
  const defaultProfileId =
    dailyProfile || selectedSchedule?.providerProfileId || enabledProfiles[0]?.id || '';
  const today = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  if (!state)
    return (
      <section className="panel">
        <p>Loading AI settings…</p>
      </section>
    );
  const updateSettings = async (changes: Partial<AIState['settings']>) => {
    const next = { ...state.settings, ...changes };
    const saved = await window.focuslog.saveAISettings(next);
    setState({ ...state, settings: saved });
  };

  return (
    <div className="ai-settings">
      <section className="panel setting-section">
        <div className="setting-copy">
          <span className="section-label">Privacy boundary</span>
          <h2>AI privacy mode</h2>
          <p>
            Local mode never falls back to a cloud provider. Cloud requests require a one-time
            consent for each configured profile.
          </p>
        </div>
        <label>
          <span className="visually-hidden">AI privacy mode</span>
          <select
            value={state.settings.mode}
            onChange={(event) =>
              void updateSettings({ mode: event.target.value as AIState['settings']['mode'] })
            }
          >
            <option value="DISABLED">AI disabled</option>
            <option value="LOCAL">Local only</option>
            <option value="CLOUD">Cloud</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </label>
        <label className="switch">
          <input
            type="checkbox"
            checked={state.settings.dataSharingPreview}
            onChange={(event) => void updateSettings({ dataSharingPreview: event.target.checked })}
          />
          <span />
          <span>Show data-sharing preview before cloud requests</span>
        </label>
      </section>

      <section className="panel setting-section">
        <div className="setting-copy">
          <span className="section-label">Execution controls</span>
          <h2>Budget, fallback, and provider safety</h2>
        </div>
        {!controls ? (
          <p>Loading AI execution status…</p>
        ) : (
          <>
            <p>
              Budget ({controls.budget.periodKey}): settled {controls.budget.settledMicros} μUSD ·
              reserved {controls.budget.reservedMicros} μUSD · remaining{' '}
              {controls.budget.remainingMicros ?? 'unlimited'}.
            </p>
            <p>
              Concurrency: {controls.concurrency.active}/{controls.concurrency.globalLimit} active,{' '}
              {controls.concurrency.waiting} waiting.
            </p>
            <p>
              Fallback chains:{' '}
              {controls.chains.length
                ? controls.chains.map((chain) => `${chain.name} v${chain.version}`).join(', ')
                : 'none configured'}
              .
            </p>
            <div className="ai-flag-grid">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={controls.switches.some(
                    (item) => item.scope === 'global' && item.enabled
                  )}
                  onChange={async (event) => {
                    const switches = await window.focuslog.setAIKillSwitch({
                      scope: 'global',
                      targetId: '',
                      enabled: event.target.checked
                    });
                    setControls({ ...controls, switches });
                  }}
                />
                <span />
                <span>Pause all AI execution</span>
              </label>
            </div>
            {controls.breakers.length > 0 && (
              <ul>
                {controls.breakers.map((breaker) => (
                  <li key={`${breaker.profileId}:${breaker.operation}`}>
                    {breaker.profileId}: {breaker.state} ({breaker.failures} failures)
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="panel setting-section">
        <div className="setting-copy">
          <span className="section-label">Feature switches</span>
          <h2>Control each AI subsystem</h2>
          <p>
            Turning off one feature leaves the rest of FocusLog and the other AI features untouched.
          </p>
        </div>
        <div className="ai-flag-grid">
          {Object.entries(state.settings.featureFlags).map(([key, enabled]) => (
            <label className="switch" key={key}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) =>
                  void updateSettings({
                    featureFlags: { ...state.settings.featureFlags, [key]: event.target.checked }
                  })
                }
              />
              <span />
              <span>{key}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="panel setting-section" aria-labelledby="ai-recovery-title">
        <div className="setting-copy">
          <span className="section-label">Recovery and diagnostics</span>
          <h2 id="ai-recovery-title">
            AI recovery, accessibility, packaging, and diagnostic export
          </h2>
          <p>
            Recovery messages explain what happened, whether your data is safe, whether retry is
            appropriate, and the next action. The default diagnostic export excludes credentials,
            authorization headers, raw prompts, raw provider responses, lease tokens,
            reservation-owner tokens, deleted payloads, debug dumps, and secret endpoints.
          </p>
        </div>
        {!phase5D ? (
          <p role="status">Loading AI release diagnostics…</p>
        ) : (
          <>
            <div className="metric-grid" aria-label="AI recovery certification summary">
              <div>
                <span>UX states</span>
                <strong>{phase5D.uxStates.length}</strong>
              </div>
              <div>
                <span>Accessibility</span>
                <strong>
                  {phase5D.accessibility.filter((item) => item.status === 'passed').length}
                </strong>
              </div>
              <div>
                <span>Packaging</span>
                <strong>
                  {phase5D.packaging.filter((item) => item.status === 'passed').length}
                </strong>
              </div>
              <div>
                <span>CI lanes</span>
                <strong>{phase5D.ci.length}</strong>
              </div>
            </div>
            <ul className="status-list" aria-label="AI recovery states">
              {phase5D.uxStates.slice(0, 8).map((item) => (
                <li key={`${item.screen}:${item.state}`}>
                  <strong>{item.screen}</strong> · {item.state}: {item.dataSafety} Next action:{' '}
                  {item.nextAction}
                  {item.retryAppropriate
                    ? ' Retry can be appropriate.'
                    : ' Retry is not the first action.'}
                </li>
              ))}
            </ul>
            <ul className="status-list" aria-label="Diagnostic export exclusions">
              {phase5D.diagnostics.exclusions.slice(0, 10).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={async () => {
                const exported = await window.focuslog.aiDiagnosticExport();
                setDiagnosticExportPreview(
                  JSON.stringify(
                    {
                      schemaVersion: exported.schemaVersion,
                      generatedAt: exported.generatedAt,
                      app: exported.app,
                      exclusions: exported.exclusions,
                      diagnostics: exported.diagnostics
                    },
                    null,
                    2
                  )
                );
              }}
            >
              Preview safe diagnostic export
            </button>
            {diagnosticExportPreview && (
              <pre aria-label="Safe diagnostic export preview">{diagnosticExportPreview}</pre>
            )}
          </>
        )}
      </section>

      <section className="panel setting-section">
        <div className="setting-copy">
          <span className="section-label">Provider profiles</span>
          <h2>Add a provider</h2>
          <p>
            Keys are sent straight to Windows protected storage and are never saved in FocusLog’s
            database or renderer state.
          </p>
        </div>
        <div className="ai-form-grid">
          <label>
            Name
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="My local Ollama"
            />
          </label>
          <label>
            Provider
            <select
              value={draft.providerId}
              onChange={(event) => {
                const next = state.descriptors.find((item) => item.id === event.target.value);
                setDraft({
                  ...draft,
                  providerId: event.target.value,
                  endpoint: next?.defaultEndpoint ?? ''
                });
              }}
            >
              {state.descriptors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.kind.toLowerCase()})
                </option>
              ))}
            </select>
          </label>
          <label>
            Endpoint
            <input
              value={draft.endpoint}
              onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })}
              placeholder={descriptor?.defaultEndpoint ?? 'https://…'}
            />
          </label>
          <label>
            Generation model
            <input
              value={draft.generationModel}
              onChange={(event) => setDraft({ ...draft, generationModel: event.target.value })}
              placeholder="Choose after testing"
            />
          </label>
          {descriptor?.credentialLabel && (
            <label>
              Credential
              <input
                type="password"
                value={draft.credential}
                onChange={(event) => setDraft({ ...draft, credential: event.target.value })}
                placeholder={descriptor.credentialLabel}
                autoComplete="off"
              />
            </label>
          )}
          <label>
            Timeout (ms)
            <input
              type="number"
              min="1000"
              max="120000"
              value={draft.timeoutMs}
              onChange={(event) => setDraft({ ...draft, timeoutMs: Number(event.target.value) })}
            />
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
            />
            <span />
            <span>Enable this profile</span>
          </label>
        </div>
        <div className="button-row">
          <button
            className="primary-button"
            onClick={async () => {
              try {
                await window.focuslog.saveAIProfile({
                  ...draft,
                  generationModel: draft.generationModel || null,
                  credential: draft.credential || undefined
                });
                setDraft({ ...emptyProfile });
                await reload();
                notify('AI provider profile saved. Test the connection before using it.');
              } catch (error) {
                notify(error instanceof Error ? error.message : String(error));
              }
            }}
          >
            Save provider profile
          </button>
          {descriptor && (
            <a href={descriptor.documentationUrl} target="_blank" rel="noreferrer">
              Provider setup guide
            </a>
          )}
        </div>
      </section>

      <section className="panel setting-section">
        <div className="setting-copy">
          <span className="section-label">Configured providers</span>
          <h2>Connection and models</h2>
        </div>
        {state.profiles.length === 0 ? (
          <p>No providers configured yet. FocusLog remains fully functional without AI.</p>
        ) : (
          <div className="ai-profile-list">
            {state.profiles.map((profile) => (
              <article className="ai-profile" key={profile.id}>
                <div>
                  <strong>{profile.name}</strong>
                  <small>
                    {profile.providerId} ·{' '}
                    {profile.credentialConfigured
                      ? 'credential protected'
                      : 'no credential configured'}
                  </small>
                  <small>{profile.endpoint}</small>
                </div>
                <div className="button-row">
                  <button
                    className="secondary-button"
                    disabled={testing === profile.id}
                    onClick={async () => {
                      setTesting(profile.id);
                      setResult('');
                      try {
                        const test = await window.focuslog.testAIProfile(profile.id);
                        setModelOptions((current) => ({ ...current, [profile.id]: test.models }));
                        setResult(
                          test.ok
                            ? `${profile.name}: connected in ${test.latencyMs} ms; ${test.models.length} model(s) discovered.`
                            : `${profile.name}: ${test.error?.message ?? 'connection failed'}`
                        );
                        await reload();
                      } catch (error) {
                        setResult(error instanceof Error ? error.message : String(error));
                      } finally {
                        setTesting(null);
                      }
                    }}
                  >
                    {testing === profile.id ? 'Testing…' : 'Test connection'}
                  </button>
                  {state.settings.mode !== 'LOCAL' &&
                    profile.providerId !== 'ollama' &&
                    profile.providerId !== 'lm-studio' && (
                      <button
                        className="secondary-button"
                        onClick={async () => {
                          try {
                            await window.focuslog.grantAICloudConsent(profile.id);
                            notify(`Cloud consent recorded for ${profile.name}.`);
                          } catch (error) {
                            notify(error instanceof Error ? error.message : String(error));
                          }
                        }}
                      >
                        Allow cloud data
                      </button>
                    )}
                  <button
                    className="secondary-button"
                    onClick={async () => {
                      if (
                        !confirm(
                          `Remove ${profile.name}? Its protected credential will also be removed.`
                        )
                      )
                        return;
                      await window.focuslog.deleteAIProfile(profile.id);
                      await reload();
                      notify('AI provider profile removed.');
                    }}
                  >
                    Remove
                  </button>
                </div>
                <label className="model-picker">
                  Generation model
                  <select
                    value={profile.generationModel ?? ''}
                    onChange={async (event) => {
                      try {
                        await window.focuslog.saveAIProfile({
                          id: profile.id,
                          name: profile.name,
                          providerId: profile.providerId,
                          endpoint: profile.endpoint,
                          generationModel: event.target.value || null,
                          enabled: profile.enabled,
                          temperature: profile.temperature,
                          topP: profile.topP,
                          maxOutputTokens: profile.maxOutputTokens,
                          timeoutMs: profile.timeoutMs
                        });
                        await reload();
                      } catch (error) {
                        notify(error instanceof Error ? error.message : String(error));
                      }
                    }}
                  >
                    <option value="">Choose after testing</option>
                    {profile.generationModel && (
                      <option value={profile.generationModel}>{profile.generationModel}</option>
                    )}
                    {(modelOptions[profile.id] ?? [])
                      .filter((model) => model.id !== profile.generationModel)
                      .map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.displayName}
                        </option>
                      ))}
                  </select>
                </label>
              </article>
            ))}
          </div>
        )}
        {result && <p aria-live="polite">{result}</p>}
      </section>

      <section className="panel setting-section">
        <div className="setting-copy">
          <span className="section-label">Analyses</span>
          <h2>Schedules, jobs, and results</h2>
          <p>
            Schedules and manual controls enqueue durable jobs only. Results disclose status,
            provenance, provider, fallback, token, and cost metadata without exposing prompts or
            secrets.
          </p>
        </div>
        <div className="analysis-tabs" role="tablist" aria-label="Analysis levels">
          {analysisLevels.map((level) => (
            <button
              key={level}
              role="tab"
              aria-selected={selectedLevel === level}
              className={selectedLevel === level ? 'active' : ''}
              onClick={() => setSelectedLevel(level)}
            >
              {level}
            </button>
          ))}
        </div>
        <div className="ai-form-grid">
          <label>
            Schedule state
            <select
              id={`${selectedLevel}-enabled`}
              defaultValue={selectedSchedule?.enabled ? 'enabled' : 'disabled'}
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label>
            Local time
            <input
              id={`${selectedLevel}-time`}
              type="time"
              defaultValue={selectedSchedule?.localTime ?? '03:00'}
            />
          </label>
          <label>
            Timezone
            <input
              id={`${selectedLevel}-timezone`}
              defaultValue={
                selectedSchedule?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
              }
            />
          </label>
          <label>
            Provider
            <select
              value={dailyProfile || (selectedSchedule?.providerProfileId ?? '')}
              onChange={(event) => setDailyProfile(event.target.value)}
            >
              <option value="">Choose a configured model</option>
              {enabledProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} - {profile.generationModel}
                </option>
              ))}
            </select>
          </label>
          <label>
            Model selection
            <select
              id={`${selectedLevel}-model-mode`}
              defaultValue={selectedSchedule?.modelMode ?? 'profile_default'}
            >
              <option value="profile_default">Use provider default</option>
              <option value="fixed">Fixed model</option>
            </select>
          </label>
          <label>
            Fallback chain
            <select
              id={`${selectedLevel}-fallback`}
              defaultValue={selectedSchedule?.fallbackChainId ?? ''}
            >
              <option value="">No fallback chain</option>
              {(controls?.chains ?? []).map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name} v{chain.version}
                </option>
              ))}
            </select>
          </label>
          <label>
            Max run cost
            <input
              id={`${selectedLevel}-cost`}
              inputMode="numeric"
              defaultValue={selectedSchedule?.maxCostMicros ?? ''}
              placeholder="micro-USD"
            />
          </label>
          <label>
            Catch-up limit
            <input
              id={`${selectedLevel}-catchup`}
              type="number"
              min="1"
              max="30"
              defaultValue={selectedSchedule?.catchUpLimit ?? 3}
            />
          </label>
          <label className="switch">
            <input
              id={`${selectedLevel}-kill`}
              type="checkbox"
              defaultChecked={selectedSchedule?.killSwitchEnabled ?? false}
            />
            <span />
            <span>Schedule kill switch</span>
          </label>
        </div>
        <div className="button-row">
          <button
            className="secondary-button"
            disabled={!defaultProfileId}
            onClick={async () => {
              try {
                const localTime =
                  (document.getElementById(`${selectedLevel}-time`) as HTMLInputElement | null)
                    ?.value || '03:00';
                const timezone =
                  (document.getElementById(`${selectedLevel}-timezone`) as HTMLInputElement | null)
                    ?.value || 'UTC';
                const modelMode = ((
                  document.getElementById(`${selectedLevel}-model-mode`) as HTMLSelectElement | null
                )?.value || 'profile_default') as 'profile_default' | 'fixed';
                const fallbackChainId =
                  (document.getElementById(`${selectedLevel}-fallback`) as HTMLSelectElement | null)
                    ?.value || null;
                const maxCostMicros =
                  (document.getElementById(`${selectedLevel}-cost`) as HTMLInputElement | null)
                    ?.value || null;
                const catchUpLimit = Number(
                  (document.getElementById(`${selectedLevel}-catchup`) as HTMLInputElement | null)
                    ?.value || 3
                );
                const killSwitchEnabled = Boolean(
                  (document.getElementById(`${selectedLevel}-kill`) as HTMLInputElement | null)
                    ?.checked
                );
                const enabled =
                  ((document.getElementById(`${selectedLevel}-enabled`) as HTMLSelectElement | null)
                    ?.value || 'disabled') === 'enabled';
                await window.focuslog.saveAIAnalysisSchedule({
                  level: selectedLevel,
                  enabled,
                  localTime,
                  timezone,
                  providerProfileId: defaultProfileId,
                  modelMode,
                  fallbackChainId,
                  maxCostMicros,
                  catchUpLimit,
                  killSwitchEnabled,
                  privacyMode: state.settings.mode
                });
                await reloadAnalysis(selectedLevel);
                notify(`${selectedLevel} schedule saved.`);
              } catch (error) {
                notify(error instanceof Error ? error.message : String(error));
              }
            }}
          >
            Save schedule
          </button>
          <button
            className="primary-button"
            disabled={!defaultProfileId}
            onClick={async () => {
              try {
                const run = await window.focuslog.analyzeNow({
                  level: selectedLevel,
                  localAnchor: today,
                  timezone:
                    selectedSchedule?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
                  providerProfileId: defaultProfileId,
                  privacyMode: state.settings.mode
                });
                setAnalysisJob(run.job);
                setDailyContent(
                  run.missingDependencies.length
                    ? `${run.missingDependencies.length} dependency period(s) will be resolved through the queue.`
                    : 'Analysis job queued or reused.'
                );
                await reloadAnalysis(selectedLevel);
                notify(`${selectedLevel} analysis queued.`);
              } catch (error) {
                notify(error instanceof Error ? error.message : String(error));
              }
            }}
          >
            Analyze now
          </button>
          <button
            className="secondary-button"
            disabled={!defaultProfileId}
            onClick={async () => {
              try {
                const run = await window.focuslog.analyzeNow({
                  level: selectedLevel,
                  localAnchor: today,
                  timezone:
                    selectedSchedule?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
                  providerProfileId: defaultProfileId,
                  privacyMode: state.settings.mode,
                  regenerate: true
                });
                setAnalysisJob(run.job);
                await reloadAnalysis(selectedLevel);
                notify(`${selectedLevel} regeneration queued.`);
              } catch (error) {
                notify(error instanceof Error ? error.message : String(error));
              }
            }}
          >
            Regenerate
          </button>
        </div>
        {schedulerStatus && (
          <p>
            Scheduler: {schedulerStatus.schedules} schedule(s).{' '}
            {schedulerStatus.diagnostics[0]?.message ?? 'No catch-up or policy blocks.'}
          </p>
        )}
        {(analysisJob ?? dailyJob) && (
          <div className="ai-queue-status" role="status">
            <span>
              {selectedLevel} job: {(analysisJob ?? dailyJob)!.status.replace('_', ' ')}
            </span>
            {(analysisJob ?? dailyJob)!.errorMessage && (
              <span>{(analysisJob ?? dailyJob)!.errorMessage}</span>
            )}
            {(analysisJob ?? dailyJob)!.actions.canCancel && (
              <button
                onClick={async () =>
                  setAnalysisJob(await window.focuslog.cancelAIJob((analysisJob ?? dailyJob)!.id))
                }
              >
                Cancel
              </button>
            )}
            {(analysisJob ?? dailyJob)!.actions.canRetry && (
              <button
                onClick={async () =>
                  setAnalysisJob(await window.focuslog.retryAIJob((analysisJob ?? dailyJob)!.id))
                }
              >
                Retry
              </button>
            )}
          </div>
        )}
        {dailyContent && <p aria-live="polite">{dailyContent}</p>}
        <div className="analysis-results-grid">
          <aside className="analysis-version-list" aria-label={`${selectedLevel} version history`}>
            {versions.length === 0 ? (
              <p>No {selectedLevel} results yet.</p>
            ) : (
              versions.map((version) => (
                <button
                  key={version.id}
                  className={selectedResult?.id === version.id ? 'active' : ''}
                  onClick={async () =>
                    setSelectedResult(await window.focuslog.aiAnalysisResult(version.id))
                  }
                >
                  <strong>
                    {version.periodId} v{version.version}
                  </strong>
                  <span>
                    {version.status}
                    {version.staleReason ? ` - ${version.staleReason}` : ''}
                  </span>
                </button>
              ))
            )}
          </aside>
          {selectedResult ? (
            <AnalysisResultCard result={selectedResult} />
          ) : (
            <article className="ai-analysis">
              <p>
                Select or generate an analysis result to inspect version history, provenance,
                tokens, and cost.
              </p>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
