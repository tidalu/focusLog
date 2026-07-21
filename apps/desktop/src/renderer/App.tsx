import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CalendarPage } from './CalendarPage';
import { HistoryPage } from './HistoryPage';
import { ReportsPage } from './ReportsPage';

type Page = 'Dashboard' | 'History' | 'Reports' | 'Calendar' | 'Settings' | 'Pair device';
type IconName =
  | 'calendar'
  | 'check'
  | 'dashboard'
  | 'devices'
  | 'history'
  | 'moon'
  | 'pause'
  | 'play'
  | 'plus'
  | 'reports'
  | 'search'
  | 'settings'
  | 'stop'
  | 'sun';
type DesktopStatus = Awaited<ReturnType<Window['focuslog']['getStatus']>>;
type DashboardSummary = Awaited<ReturnType<Window['focuslog']['getDashboardSummary']>>;
type ReminderPreferences = Awaited<ReturnType<Window['focuslog']['getReminderPreferences']>>;
const navigation: Array<{ page: Page; label: string; icon: IconName; shortcut: number }> = [
  { page: 'Dashboard', label: 'Today', icon: 'dashboard', shortcut: 1 },
  { page: 'History', label: 'History', icon: 'history', shortcut: 2 },
  { page: 'Reports', label: 'Reports', icon: 'reports', shortcut: 3 },
  { page: 'Calendar', label: 'Calendar', icon: 'calendar', shortcut: 4 },
  { page: 'Settings', label: 'Settings', icon: 'settings', shortcut: 5 },
  { page: 'Pair device', label: 'Pair device', icon: 'devices', shortcut: 6 }
];

function Icon({ name, size = 19 }: { name: IconName; size?: number }): React.JSX.Element {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  };
  const paths: Record<IconName, React.JSX.Element> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    reports: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21H9.6v-.08a1.7 1.7 0 0 0-1.1-1.52 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H3V9.6h.08A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V3h4v.08A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.37.35.7.6 1 .28.3.64.43 1 .4h.08v4H21a1.7 1.7 0 0 0-1.6.6Z" />
      </>
    ),
    devices: (
      <>
        <rect x="3" y="4" width="13" height="10" rx="2" />
        <path d="M8 20h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-1M7 18h5M9.5 14v4" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7Z" />,
    pause: (
      <>
        <path d="M9 5v14M15 5v14" />
      </>
    ),
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.41M17.66 6.34l1.41-1.41" />
      </>
    ),
    moon: <path d="M20.5 14.1A8.4 8.4 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z" />,
    check: <path d="m5 12 4 4L19 6" />
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function formatDuration(milliseconds: number): string {
  if (milliseconds <= 0) return 'Due now';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function PageTitle({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}): React.JSX.Element {
  return (
    <div className="page-title">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

export function App(): React.JSX.Element {
  const [page, setPage] = useState<Page>('Dashboard');
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [preferences, setPreferences] = useState<ReminderPreferences | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('focuslog-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [startup, setStartup] = useState(false);
  const [closeBehavior, setCloseBehavior] = useState<'tray' | 'exit'>('tray');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [knownCategories, setKnownCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [notice, setNotice] = useState('');
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [customInterval, setCustomInterval] = useState('15');
  const searchRef = useRef<HTMLInputElement>(null);

  const refreshCore = useCallback(async () => {
    const [nextStatus, nextSummary, nextPreferences] = await Promise.all([
      window.focuslog.getStatus(),
      window.focuslog.getDashboardSummary(),
      window.focuslog.getReminderPreferences()
    ]);
    setStatus(nextStatus);
    setSummary(nextSummary);
    setPreferences(nextPreferences);
    setStartup(nextStatus.startupEnabled);
    setCloseBehavior(nextStatus.closeBehavior);
    setCustomInterval(String(nextPreferences.intervalMinutes));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('focuslog-theme', theme);
  }, [theme]);

  useEffect(() => {
    void refreshCore();
    const statusTimer = setInterval(() => void refreshCore(), 15_000);
    const clockTimer = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearInterval(statusTimer);
      clearInterval(clockTimer);
    };
  }, [refreshCore]);

  useEffect(() => {
    if (!manualOpen) return;
    void window.focuslog.searchFilters().then((filters) => setKnownCategories(filters.categories));
  }, [manualOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;
      const destination = navigation.find((item) => String(item.shortcut) === event.key);
      if (destination) {
        event.preventDefault();
        setPage(destination.page);
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setManualOpen(true);
      } else if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPage('History');
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    };
    addEventListener('keydown', onKeyDown);
    return () => removeEventListener('keydown', onKeyDown);
  }, []);

  const runAction = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      setNotice(message);
      await refreshCore();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const nextReminderText = summary?.nextReminder
    ? formatDuration(new Date(summary.nextReminder.dueAt).getTime() - now)
    : 'No reminder scheduled';
  const sessionElapsed = summary?.activeSession
    ? formatDuration(now - new Date(summary.activeSession.startedAt).getTime())
    : '—';
  const syncLabel = status?.offline
    ? status?.queuedOperations
      ? `Offline · ${status.queuedOperations} queued`
      : 'Offline-ready'
    : 'Synchronized';
  const navDescription = useMemo(
    () => navigation.find((item) => item.page === page)?.label ?? page,
    [page]
  );
  const categorySuggestions = useMemo(() => {
    const match = /(?:^|\n)((?:<[^>\n]+>)*)<([^>\n]*)$/u.exec(manualText);
    if (!match) return [];
    const parentPath = [...(match[1] ?? '').matchAll(/<([^>]+)>/gu)].map((token) =>
      (token[1] ?? '').trim().toLocaleLowerCase()
    );
    const prefix = (match[2] ?? '').trim().toLocaleLowerCase();
    return knownCategories
      .map((category) => ({ ...category, segments: category.name.split('/') }))
      .filter(
        (category) =>
          category.segments.length === parentPath.length + 1 &&
          parentPath.every((segment, index) => category.segments[index] === segment) &&
          (category.segments.at(-1) ?? '').startsWith(prefix)
      )
      .slice(0, 6);
  }, [knownCategories, manualText]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>FocusLog</span>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              className="nav-item"
              key={item.page}
              aria-current={page === item.page ? 'page' : undefined}
              onClick={() => setPage(item.page)}
              title={`${item.label} (Ctrl+${item.shortcut})`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              <kbd>{item.shortcut}</kbd>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className={`sync-pill ${status?.offline ? 'offline' : 'online'}`}>
            <span aria-hidden="true" />
            <div>
              <strong>{syncLabel}</strong>
              <small>
                {status?.lastSynchronizedAt
                  ? `Updated ${new Date(status.lastSynchronizedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}`
                  : 'Local data is protected'}
              </small>
            </div>
          </div>
          <button
            className="icon-button"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
      </aside>

      <main className="content" aria-label={navDescription}>
        <div className="mobile-topbar">
          <div className="brand">FocusLog</div>
          <button
            className="icon-button"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>

        {page === 'Dashboard' && (
          <div className="page dashboard-page">
            <PageTitle
              eyebrow={new Intl.DateTimeFormat(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              }).format(new Date())}
              title="Make the next interval count."
              description="A calm view of your current focus session and today’s progress."
            />

            <section className="hero-card">
              <div>
                <span className="section-label">Current session</span>
                <h2>{summary?.activeSession?.name ?? 'Ready when you are'}</h2>
                <p>
                  {summary?.activeSession
                    ? summary.activeSession.status === 'PAUSED'
                      ? 'Paused — your next reminder will be scheduled when you resume.'
                      : `In focus for ${sessionElapsed}`
                    : 'Start a session to schedule local, offline-ready check-ins.'}
                </p>
              </div>
              <div className="hero-timer" aria-live="polite">
                <span>Next reminder</span>
                <strong>{nextReminderText}</strong>
                <small>
                  {summary?.activeSession
                    ? `${summary.reminderIntervalMinutes} minute interval`
                    : 'No active session'}
                </small>
              </div>
            </section>

            <section className="metric-grid" aria-label="Today’s focus summary">
              <article className="metric-card">
                <span>Completion</span>
                <strong>{summary?.todayCompletionPercentage ?? 0}%</strong>
                <div className="progress-track">
                  <span style={{ width: `${summary?.todayCompletionPercentage ?? 0}%` }} />
                </div>
              </article>
              <article className="metric-card">
                <span>Completed</span>
                <strong>{summary?.completedToday ?? 0}</strong>
                <small>check-ins today</small>
              </article>
              <article className="metric-card">
                <span>Missed</span>
                <strong>{summary?.missedToday ?? 0}</strong>
                <small>intervals today</small>
              </article>
              <article className="metric-card">
                <span>Current interval</span>
                <strong>{summary?.reminderIntervalMinutes ?? 15}</strong>
                <small>minutes</small>
              </article>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="section-label">Quick actions</span>
                  <h2>Stay in flow</h2>
                </div>
                <span className="keyboard-hint">Ctrl+N for a manual entry</span>
              </div>
              <div className="action-grid">
                {!summary?.activeSession && (
                  <button
                    className="action-tile primary"
                    onClick={() =>
                      void runAction(
                        () => window.focuslog.startFocusSession(),
                        'Focus session started.'
                      )
                    }
                  >
                    <Icon name="play" />
                    <span>Start session</span>
                  </button>
                )}
                {summary?.activeSession?.status === 'ACTIVE' && (
                  <button
                    className="action-tile"
                    onClick={() =>
                      void runAction(
                        () => window.focuslog.pauseFocusSession(),
                        'Focus session paused.'
                      )
                    }
                  >
                    <Icon name="pause" />
                    <span>Pause session</span>
                  </button>
                )}
                {summary?.activeSession?.status === 'PAUSED' && (
                  <button
                    className="action-tile primary"
                    onClick={() =>
                      void runAction(
                        () => window.focuslog.resumeFocusSession(),
                        'Focus session resumed.'
                      )
                    }
                  >
                    <Icon name="play" />
                    <span>Resume session</span>
                  </button>
                )}
                {summary?.activeSession && (
                  <button
                    className="action-tile"
                    onClick={() =>
                      void runAction(
                        () => window.focuslog.stopFocusSession(),
                        'Focus session completed.'
                      )
                    }
                  >
                    <Icon name="stop" />
                    <span>Stop session</span>
                  </button>
                )}
                <button className="action-tile" onClick={() => setManualOpen(true)}>
                  <Icon name="plus" />
                  <span>Manual entry</span>
                </button>
                <button className="action-tile" onClick={() => setPage('History')}>
                  <Icon name="history" />
                  <span>Open history</span>
                </button>
                <button className="action-tile" onClick={() => setPage('Reports')}>
                  <Icon name="reports" />
                  <span>Daily report</span>
                </button>
                <button className="action-tile" onClick={() => setPage('Calendar')}>
                  <Icon name="calendar" />
                  <span>Year calendar</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {page === 'History' && <HistoryPage searchRef={searchRef} />}

        {page === 'Reports' && <ReportsPage />}

        {page === 'Calendar' && <CalendarPage />}

        {page === 'Settings' && (
          <div className="page settings-page">
            <PageTitle
              eyebrow="Personalize"
              title="Settings"
              description="Tune your reminder rhythm, appearance, startup, and private data controls."
            />
            <section className="panel setting-section">
              <div className="setting-copy">
                <span className="section-label">Reminder rhythm</span>
                <h2>Check-in interval</h2>
                <p>Changes reschedule future reminders immediately and remain available offline.</p>
              </div>
              <div className="interval-grid">
                {preferences?.choices.map((minutes) => (
                  <button
                    key={minutes}
                    className={
                      preferences.intervalMinutes === minutes ? 'interval active' : 'interval'
                    }
                    onClick={() =>
                      void runAction(
                        () => window.focuslog.setReminderInterval(minutes),
                        `Reminder interval changed to ${minutes} minutes.`
                      )
                    }
                  >
                    {minutes}
                    <small>min</small>
                  </button>
                ))}
              </div>
              <div className="custom-interval">
                <label>
                  <span>Custom interval</span>
                  <input
                    type="number"
                    min={preferences?.minimum ?? 5}
                    max={preferences?.maximum ?? 240}
                    value={customInterval}
                    onChange={(event) => setCustomInterval(event.target.value)}
                  />
                </label>
                <button
                  className="secondary-button"
                  onClick={() =>
                    void runAction(
                      () => window.focuslog.setReminderInterval(Number(customInterval)),
                      `Reminder interval changed to ${customInterval} minutes.`
                    )
                  }
                >
                  Save custom interval
                </button>
                <small>Any whole number from 5 to 240 minutes.</small>
              </div>
            </section>

            <section className="panel setting-row">
              <div>
                <h2>Start with Windows</h2>
                <p>Launch quietly at sign-in so reminder recovery is always ready.</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={startup}
                  onChange={async (event) =>
                    setStartup(await window.focuslog.setStartup(event.target.checked))
                  }
                />
                <span />
                <span className="visually-hidden">Start FocusLog when Windows starts</span>
              </label>
            </section>

            <section className="panel setting-row">
              <div>
                <h2>When I close the window</h2>
                <p>
                  Keep reminders running in the system tray, or explicitly exit the entire
                  application.
                </p>
              </div>
              <label>
                <span className="visually-hidden">Close button behavior</span>
                <select
                  value={closeBehavior}
                  onChange={async (event) => {
                    const behavior = event.target.value as 'tray' | 'exit';
                    setCloseBehavior(await window.focuslog.setCloseBehavior(behavior));
                  }}
                >
                  <option value="tray">Close button minimizes to tray</option>
                  <option value="exit">Exit application completely</option>
                </select>
              </label>
            </section>

            <section className="panel setting-section">
              <div className="setting-copy">
                <span className="section-label">Private by design</span>
                <h2>Encrypted backup and export</h2>
                <p>
                  Keep the recovery key separately. The service cannot recover encrypted archives.
                </p>
              </div>
              <div className="button-row">
                <button
                  className="primary-button"
                  onClick={async () => {
                    const result = await window.focuslog.createBackup('BACKUP');
                    if (result) {
                      setRecoveryKey(result.recoveryKey);
                      setSecurityMessage(`Encrypted backup written to ${result.path}`);
                    }
                  }}
                >
                  Create backup
                </button>
                <button
                  className="secondary-button"
                  onClick={async () => {
                    const result = await window.focuslog.createBackup('EXPORT');
                    if (result) {
                      setRecoveryKey(result.recoveryKey);
                      setSecurityMessage(`Encrypted export written to ${result.path}`);
                    }
                  }}
                >
                  Export data
                </button>
              </div>
              <label className="stacked-field">
                <span>Recovery key</span>
                <input
                  value={recoveryKey}
                  onChange={(event) => setRecoveryKey(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <button
                className="secondary-button fit"
                disabled={!recoveryKey.trim()}
                onClick={async () => {
                  if (!confirm('Restore replaces all local FocusLog data. Continue?')) return;
                  const result = await window.focuslog.restoreBackup(recoveryKey);
                  if (result)
                    setSecurityMessage(`Restored ${result.kind.toLowerCase()} successfully.`);
                }}
              >
                Restore or import
              </button>
              <p aria-live="polite">{securityMessage}</p>
            </section>

            <section className="panel danger-zone">
              <div>
                <h2>Permanent deletion</h2>
                <p>
                  Destroys local encryption keys and connected owner data. This cannot be undone.
                </p>
              </div>
              <button
                onClick={async () => {
                  const confirmation = prompt(
                    'Type DELETE ALL FOCUSLOG DATA to permanently delete all data.'
                  );
                  if (confirmation !== 'DELETE ALL FOCUSLOG DATA') return;
                  await window.focuslog.permanentlyDelete(confirmation);
                }}
              >
                Delete all data
              </button>
            </section>
          </div>
        )}

        {page === 'Pair device' && (
          <div className="page">
            <PageTitle
              eyebrow="Trusted devices"
              title="Pair a device"
              description="Approve another device without accounts, passwords, or shared private keys."
            />
            <section className="pair-card">
              <div className="pair-visual" aria-hidden="true">
                <Icon name="devices" size={56} />
              </div>
              <div>
                <h2>Secure, short-lived pairing</h2>
                <p>
                  Register this owner device, create a temporary code, then approve the request from
                  your Android device.
                </p>
                <div className="button-row">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      void runAction(
                        () => window.focuslog.bootstrapDevice(),
                        'This owner device is registered.'
                      )
                    }
                  >
                    Register this device
                  </button>
                  <button
                    className="primary-button"
                    onClick={async () => {
                      try {
                        setPairing(await window.focuslog.createPairing());
                      } catch (error) {
                        setNotice(error instanceof Error ? error.message : String(error));
                      }
                    }}
                  >
                    Create pairing code
                  </button>
                </div>
              </div>
              {pairing && (
                <div className="pair-code" role="status">
                  <span>Pairing code</span>
                  <strong>{pairing.code}</strong>
                  <small>Expires {new Date(pairing.expiresAt).toLocaleTimeString()}</small>
                </div>
              )}
              <button
                className="secondary-button fit"
                onClick={() =>
                  void runAction(async () => {
                    const requests = await window.focuslog.pendingPairings();
                    if (requests.length === 0) throw new Error('No pending pairing requests.');
                    await Promise.all(
                      requests.map((request) => window.focuslog.approvePairing(request.id))
                    );
                  }, 'Pending pairing request approved.')
                }
              >
                Approve pending request
              </button>
            </section>
          </div>
        )}
      </main>

      {manualOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="manual-title">
            <span className="section-label">Quick capture</span>
            <h2 id="manual-title">Write a manual entry</h2>
            <p>
              Use one or more tag blocks per section, such as{' '}
              <code>&lt;study&gt;&lt;leetcode&gt;</code>. Start another tagged line to add a second
              section.
            </p>
            <textarea
              autoFocus
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              placeholder={
                '<study><leetcode>\nSolved a sliding window problem…\n\n<sleep>\nSlept well.'
              }
            />
            {categorySuggestions.length > 0 && (
              <div className="category-autocomplete" aria-label="Category suggestions">
                {categorySuggestions.map((category) => (
                  <button
                    key={category.id}
                    onClick={() =>
                      setManualText(
                        `${manualText.slice(0, manualText.lastIndexOf('<'))}<${category.segments.at(-1)}> `
                      )
                    }
                  >
                    &lt;{category.name}&gt;
                  </button>
                ))}
              </div>
            )}
            <div className="button-row end">
              <button
                className="secondary-button"
                onClick={() => {
                  setManualOpen(false);
                  setManualText('');
                }}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={!manualText.trim()}
                onClick={() =>
                  void runAction(async () => {
                    await window.focuslog.createManualEntry(manualText);
                    setManualOpen(false);
                    setManualText('');
                  }, 'Manual entry saved locally.')
                }
              >
                Save entry
              </button>
            </div>
          </section>
        </div>
      )}

      {notice && (
        <button className="toast" onClick={() => setNotice('')} aria-live="polite">
          <Icon name="check" />
          <span>{notice}</span>
        </button>
      )}
    </div>
  );
}
