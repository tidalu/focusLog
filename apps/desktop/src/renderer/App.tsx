import { useEffect, useState } from 'react';

type Page = 'Dashboard' | 'History' | 'Reports' | 'Heatmap' | 'Settings' | 'Pair device';
type HistoryItem = { id: string; body: string; submittedAt: string };
type SearchFilters = Awaited<ReturnType<Window['focuslog']['searchFilters']>>;
type TimelineItem = {
  id: string;
  kind: string;
  occurredAt: string;
  title: string;
  detail: string;
  originalTimezoneId?: string;
};
type Report = {
  day: string;
  timezoneId: string;
  dayDurationMinutes: number;
  completedIntervals: number;
  missedIntervals: number;
  totalTrackedMinutes: number;
  focusScore: number;
  categories: Array<{ name: string; count: number }>;
  occurrenceStates: Array<{ state: string; count: number }>;
  timeline: TimelineItem[];
  trends: { weekly: number; monthly: number; yearly: number };
};
type YearHeatmap = Awaited<ReturnType<Window['focuslog']['heatmap']>>;

const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const todayInTimezone = (timezoneId: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezoneId,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts();
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

export function App(): React.JSX.Element {
  const [page, setPage] = useState<Page>('Dashboard');
  const [startup, setStartup] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [offline, setOffline] = useState(true);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    tags: [],
    categories: [],
    sessions: []
  });
  const [tagId, setTagId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [heatmapData, setHeatmapData] = useState<YearHeatmap | null>(null);
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [reportTimezone, setReportTimezone] = useState(systemTimezone);
  const [reportDay, setReportDay] = useState(() => todayInTimezone(systemTimezone));
  const [reportYear, setReportYear] = useState(() =>
    Number(todayInTimezone(systemTimezone).slice(0, 4))
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedDayLog, setSelectedDayLog] = useState<TimelineItem[]>([]);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    void window.focuslog.getStatus().then((status) => {
      setOffline(status.offline);
      setStartup(status.startupEnabled);
    });
  }, []);
  useEffect(() => {
    if (page === 'History') {
      void window.focuslog
        .history({
          query: search,
          ...(tagId ? { tagId } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(sessionId ? { sessionId } : {})
        })
        .then(setHistory);
      void window.focuslog.searchFilters().then(setSearchFilters);
    }
    if (page === 'Reports') {
      void window.focuslog
        .report({ day: reportDay, timezoneId: reportTimezone })
        .then((result) => {
          setReport(result);
          setReportError('');
        })
        .catch((error) => setReportError(error instanceof Error ? error.message : String(error)));
    }
    if (page === 'Heatmap') {
      void window.focuslog
        .heatmap({ year: reportYear, timezoneId: reportTimezone })
        .then((result) => {
          setHeatmapData(result);
          setReportError('');
        })
        .catch((error) => setReportError(error instanceof Error ? error.message : String(error)));
    }
  }, [page, search, tagId, categoryId, sessionId, reportDay, reportTimezone, reportYear]);

  const reportTime = (instant: string) =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: reportTimezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(instant));

  return (
    <main>
      <header>
        <h1>FocusLog</h1>
        <span role="status">
          {offline ? 'Offline - local data is safe and queued' : 'Synchronized'}
        </span>
      </header>
      <nav aria-label="Main navigation">
        {(['Dashboard', 'History', 'Reports', 'Heatmap', 'Settings', 'Pair device'] as Page[]).map(
          (item) => (
            <button
              key={item}
              aria-current={page === item ? 'page' : undefined}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          )
        )}
      </nav>
      {page === 'Dashboard' && (
        <section>
          <h2>Focus session</h2>
          <p>{activeSession ? `Active: ${activeSession}` : 'No active local session.'}</p>
          <button
            disabled={Boolean(activeSession)}
            onClick={() =>
              void window.focuslog
                .startFocusSession()
                .then((session) => setActiveSession(session.name))
            }
          >
            Start focus session
          </button>
          <button
            disabled={!activeSession}
            onClick={() =>
              void window.focuslog.stopFocusSession().then(() => setActiveSession(null))
            }
          >
            Stop session
          </button>
          <p>
            Reminders open in an always-on-top, keyboard-accessible window and are completed there.
          </p>
        </section>
      )}
      {page === 'History' && (
        <section>
          <h2>History timeline</h2>
          <input
            aria-label="Search history"
            placeholder="Search local entries"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="report-controls" aria-label="History filters">
            <label>
              Tag
              <select value={tagId} onChange={(event) => setTagId(event.target.value)}>
                <option value="">All tags</option>
                {searchFilters.tags.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">All categories</option>
                {searchFilters.categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Focus session
              <select value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
                <option value="">All sessions</option>
                {searchFilters.sessions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {history.length === 0 ? (
            <p>No matching local entries.</p>
          ) : (
            <ol>
              {history.map((entry) => (
                <li key={entry.id}>
                  <time dateTime={entry.submittedAt}>
                    {new Date(entry.submittedAt).toLocaleString()}
                  </time>
                  : {entry.body}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {page === 'Reports' && (
        <section>
          <h2>Daily report {report?.day ?? ''}</h2>
          <div className="report-controls">
            <label>
              Report date
              <input
                type="date"
                value={reportDay}
                onChange={(event) => setReportDay(event.target.value)}
              />
            </label>
            <label>
              IANA report timezone
              <input
                value={reportTimezone}
                onChange={(event) => setReportTimezone(event.target.value)}
                placeholder="Europe/Warsaw"
              />
            </label>
          </div>
          <p>
            Times are assigned to {report?.timezoneId ?? reportTimezone}. This local day contains{' '}
            {report?.dayDurationMinutes ?? 1440} minutes.
          </p>
          {reportError && <p role="alert">{reportError}</p>}
          <dl>
            <dt>Completed intervals</dt>
            <dd>{report?.completedIntervals ?? 0}</dd>
            <dt>Missed intervals</dt>
            <dd>{report?.missedIntervals ?? 0}</dd>
            <dt>Total tracked time</dt>
            <dd>{report?.totalTrackedMinutes ?? 0} minutes</dd>
            <dt>Focus score</dt>
            <dd>{report?.focusScore ?? 0}%</dd>
          </dl>
          <h3>Categories</h3>
          <p>
            {report?.categories
              .map((category) => `${category.name}: ${category.count}`)
              .join(', ') || 'No categorized check-ins.'}
          </p>
          <h3>Timeline</h3>
          {report?.timeline.length ? (
            <ol>
              {report.timeline.map((entry) => (
                <li key={entry.id}>
                  <time dateTime={entry.occurredAt}>{reportTime(entry.occurredAt)}</time>
                  {' · '}
                  <strong>{entry.title}</strong>: {entry.detail}
                  {entry.originalTimezoneId && (
                    <small> (recorded in {entry.originalTimezoneId})</small>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p>No events recorded.</p>
          )}
          <h3>Reminder states</h3>
          <p>
            {report?.occurrenceStates
              .map((item) => `${item.state.toLowerCase()}: ${item.count}`)
              .join(', ') || 'No reminder occurrences.'}
          </p>
          <h3>Productivity trends</h3>
          <p>
            Last 7 days: {report?.trends.weekly ?? 0}; last 30 days: {report?.trends.monthly ?? 0};
            last year: {report?.trends.yearly ?? 0} check-ins.
          </p>
        </section>
      )}
      {page === 'Heatmap' && (
        <section>
          <h2>Yearly heatmap</h2>
          <div className="report-controls">
            <label>
              Calendar year
              <input
                type="number"
                min="1970"
                max="9998"
                value={reportYear}
                onChange={(event) => setReportYear(Number(event.target.value))}
              />
            </label>
            <label>
              IANA report timezone
              <input
                value={reportTimezone}
                onChange={(event) => setReportTimezone(event.target.value)}
              />
            </label>
          </div>
          <p>{heatmapData?.metricDescription}</p>
          {reportError && <p role="alert">{reportError}</p>}
          <div
            aria-label={`${reportYear} activity heatmap in ${reportTimezone}`}
            className="heatmap-scroll"
          >
            <div className="heatmap">
              {Array.from(
                { length: new Date(Date.UTC(reportYear, 0, 1)).getUTCDay() },
                (_, index) => (
                  <span className="heatmap-placeholder" aria-hidden="true" key={`pad-${index}`} />
                )
              )}
              {heatmapData?.days.map((entry) => (
                <button
                  key={entry.day}
                  aria-label={`${entry.day}: ${entry.value} check-ins, intensity ${entry.intensity} of 4, report timezone ${reportTimezone}`}
                  title={`${entry.day}: ${entry.value} check-ins`}
                  data-level={entry.intensity}
                  onClick={() => {
                    setSelectedDay(entry.day);
                    void window.focuslog
                      .dayLog({ day: entry.day, timezoneId: reportTimezone })
                      .then(setSelectedDayLog);
                  }}
                >
                  <span className="visually-hidden">{entry.value}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="heatmap-alternative">
            {heatmapData?.days
              .filter((entry) => entry.value > 0)
              .map((entry) => `${entry.day}: ${entry.value}`)
              .join('; ') || `No activity in ${reportYear}.`}
          </p>
          {selectedDay && (
            <>
              <h3>{selectedDay} complete log</h3>
              {selectedDayLog.length ? (
                <ol>
                  {selectedDayLog.map((entry) => (
                    <li key={entry.id}>
                      <time dateTime={entry.occurredAt}>{reportTime(entry.occurredAt)}</time>
                      {' · '}
                      <strong>{entry.title}</strong>: {entry.detail}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No check-ins recorded.</p>
              )}
              <button
                onClick={() => {
                  setReportDay(selectedDay);
                  setPage('Reports');
                  void window.focuslog
                    .report({ day: selectedDay, timezoneId: reportTimezone })
                    .then(setReport);
                }}
              >
                View daily report
              </button>
            </>
          )}
        </section>
      )}
      {page === 'Pair device' && (
        <section>
          <h2>Pair a trusted device</h2>
          <p>
            Pairing requires approval from this owner device. Share the short-lived code with the
            trusted device.
          </p>
          <button
            onClick={() =>
              void window.focuslog
                .bootstrapDevice()
                .then(() => window.alert('Owner device registered.'))
                .catch((error) =>
                  window.alert(error instanceof Error ? error.message : String(error))
                )
            }
          >
            Register this owner device
          </button>
          <button
            onClick={() =>
              void window.focuslog
                .createPairing()
                .then(setPairing)
                .catch((error) =>
                  window.alert(error instanceof Error ? error.message : String(error))
                )
            }
          >
            Create pairing code
          </button>
          {pairing && (
            <p role="status">
              Code: <strong>{pairing.code}</strong>. Expires{' '}
              {new Date(pairing.expiresAt).toLocaleTimeString()}.
            </p>
          )}
          <button
            onClick={() =>
              void window.focuslog
                .pendingPairings()
                .then((requests) =>
                  Promise.all(requests.map((request) => window.focuslog.approvePairing(request.id)))
                )
            }
          >
            Approve pending pairing requests
          </button>
        </section>
      )}
      {page === 'Settings' && (
        <section>
          <h2>Settings</h2>
          <label>
            <input
              type="checkbox"
              checked={startup}
              onChange={async (event) =>
                setStartup(await window.focuslog.setStartup(event.target.checked))
              }
            />{' '}
            Start FocusLog when Windows starts
          </label>
          <p>
            Data mode: local-first. Offline changes remain queued until synchronization is
            available.
          </p>
          <h3>Encrypted backup and export</h3>
          <p>
            Keep the recovery key separately from the archive. It is required after reinstall and
            cannot be recovered by the service.
          </p>
          <div>
            <button
              type="button"
              onClick={async () => {
                const result = await window.focuslog.createBackup('BACKUP');
                if (result) {
                  setRecoveryKey(result.recoveryKey);
                  setSecurityMessage(`Encrypted backup written to ${result.path}`);
                }
              }}
            >
              Create encrypted backup
            </button>{' '}
            <button
              type="button"
              onClick={async () => {
                const result = await window.focuslog.createBackup('EXPORT');
                if (result) {
                  setRecoveryKey(result.recoveryKey);
                  setSecurityMessage(`Encrypted export written to ${result.path}`);
                }
              }}
            >
              Export encrypted data
            </button>
          </div>
          <label>
            Recovery key
            <input
              value={recoveryKey}
              onChange={(event) => setRecoveryKey(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>{' '}
          <button
            type="button"
            disabled={!recoveryKey.trim()}
            onClick={async () => {
              if (!confirm('Restore replaces all local FocusLog data. Continue?')) return;
              const result = await window.focuslog.restoreBackup(recoveryKey);
              if (result) setSecurityMessage(`Restored ${result.kind.toLowerCase()} successfully.`);
            }}
          >
            Restore / import
          </button>
          <h3>Permanent deletion</h3>
          <p>
            This destroys local encryption keys and, when connected, permanently deletes the owner
            data on the backend. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={async () => {
              const confirmation = prompt(
                'Type DELETE ALL FOCUSLOG DATA to permanently delete all data.'
              );
              if (confirmation !== 'DELETE ALL FOCUSLOG DATA') return;
              await window.focuslog.permanentlyDelete(confirmation);
            }}
          >
            Permanently delete all data
          </button>
          <p aria-live="polite">{securityMessage}</p>
        </section>
      )}
    </main>
  );
}
