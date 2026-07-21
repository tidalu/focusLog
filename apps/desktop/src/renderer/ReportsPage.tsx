import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import {
  categoryLabel,
  categoryStyle,
  dateTitle,
  durationLabel,
  localDay,
  systemTimezone,
  type Report
} from './journal-ui';

function hourLabel(hour: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(2026, 0, 1, hour));
}

export function ReportsPage(): React.JSX.Element {
  const [day, setDay] = useState(() => localDay());
  const [timezoneId, setTimezoneId] = useState(systemTimezone);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void window.focuslog
      .report({ day, timezoneId })
      .then((nextReport) => {
        if (!active) return;
        setReport(nextReport);
        setError('');
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, [day, timezoneId]);

  const totalCategories =
    report?.categories.reduce((sum, category) => sum + category.count, 0) ?? 0;
  const maxHourly = Math.max(...(report?.hourlyActivity.map((hour) => hour.count) ?? [0]), 1);
  const wordMaximum = Math.max(...(report?.wordCloud.map((word) => word.count) ?? [0]), 1);
  const insight = useMemo(
    () => [
      {
        label: 'Most productive period',
        value: report?.mostProductivePeriod ?? 'Not enough activity yet',
        detail:
          report?.mostActiveHour == null
            ? 'Keep logging to reveal your rhythm.'
            : 'Your strongest four-hour window.'
      },
      {
        label: 'Biggest distraction',
        value: report?.biggestDistraction
          ? categoryLabel(report.biggestDistraction)
          : 'No pattern detected',
        detail: 'Based on entertainment and distraction categories.'
      },
      {
        label: 'Longest uninterrupted streak',
        value: durationLabel(report?.longestFocusStreakMinutes ?? 0),
        detail: `${report?.longestFocusStreak ?? 0} consecutive completed check-ins.`
      },
      {
        label: 'Most frequent activity',
        value: report?.mostCommonActivity ?? 'No repeated activity yet',
        detail: 'The activity that appears most often in this day.'
      }
    ],
    [report]
  );

  return (
    <div className="journal-page reports-experience">
      <header className="journal-header report-header">
        <div>
          <span className="journal-kicker">Daily reflection</span>
          <h1>{dateTitle(day, timezoneId)}</h1>
          <p>Patterns and signals from your day—without turning your journal into a spreadsheet.</p>
        </div>
        <div className="report-date-controls">
          <label>
            <span>Date</span>
            <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </label>
          <label>
            <span>Timezone</span>
            <input value={timezoneId} onChange={(event) => setTimezoneId(event.target.value)} />
          </label>
        </div>
      </header>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <section className="report-hero-grid" aria-label="Daily productivity metrics">
        <article className="score-hero">
          <span>Productivity score</span>
          <strong>
            {report?.focusScore ?? 0}
            <small>%</small>
          </strong>
          <div>
            <i style={{ width: `${report?.focusScore ?? 0}%` }} />
          </div>
          <p>
            {report?.completedIntervals ?? 0} completed · {report?.missedIntervals ?? 0} missed
          </p>
        </article>
        <article className="report-stat-card">
          <span>Entries</span>
          <strong>{report?.entryCount ?? 0}</strong>
          <p>{report?.trends.weekly ?? 0} in the last 7 days</p>
        </article>
        <article className="report-stat-card">
          <span>Response time</span>
          <strong>
            {report?.averageResponseDelaySeconds ?? 0}
            <small>s</small>
          </strong>
          <p>Average after reminder due</p>
        </article>
        <article className="report-stat-card">
          <span>Tracked time</span>
          <strong>{durationLabel(report?.totalTrackedMinutes ?? 0)}</strong>
          <p>{report?.dayDurationMinutes ?? 1440}-minute local day</p>
        </article>
      </section>

      <div className="analytics-grid">
        <section className="analytics-card category-analytics">
          <header>
            <div>
              <span>Attention mix</span>
              <h2>Categories</h2>
            </div>
            <small>{totalCategories} entries</small>
          </header>
          <div className="distribution-bar" aria-hidden="true">
            {report?.categories.map((category) => (
              <i
                key={category.name}
                style={{
                  ...categoryStyle(category.name),
                  width: `${(category.count / Math.max(totalCategories, 1)) * 100}%`
                }}
              />
            ))}
          </div>
          <div className="distribution-list">
            {report?.categories.length ? (
              report.categories.map((category) => {
                const percentage = Math.round(
                  (category.count / Math.max(totalCategories, 1)) * 100
                );
                return (
                  <div key={category.name} style={categoryStyle(category.name)}>
                    <i />
                    <span>{categoryLabel(category.name)}</span>
                    <div>
                      <b style={{ width: `${percentage}%` }} />
                    </div>
                    <strong>{percentage}%</strong>
                  </div>
                );
              })
            ) : (
              <p className="analytics-empty">
                Categories appear automatically when you begin an entry with &lt;category&gt;.
              </p>
            )}
          </div>
        </section>

        <section className="analytics-card hourly-analytics">
          <header>
            <div>
              <span>Daily rhythm</span>
              <h2>Hourly activity</h2>
            </div>
            <small>Local time</small>
          </header>
          <div className="hourly-chart" aria-label="Entries by hour">
            {report?.hourlyActivity.map((hour) => (
              <div key={hour.hour} title={`${hourLabel(hour.hour)}: ${hour.count} entries`}>
                <i style={{ height: `${Math.max(4, (hour.count / maxHourly) * 100)}%` }} />
                {hour.hour % 3 === 0 && <span>{hour.hour.toString().padStart(2, '0')}</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="analytics-card language-analytics">
          <header>
            <div>
              <span>Language</span>
              <h2>Word cloud</h2>
            </div>
            <small>Meaningful words</small>
          </header>
          <div className="premium-word-cloud" aria-label="Most used words">
            {report?.wordCloud.length ? (
              report.wordCloud.map((word, index) => (
                <span
                  key={word.word}
                  data-emphasis={index < 3 || undefined}
                  style={{ fontSize: `${0.88 + (word.count / wordMaximum) * 0.75}rem` }}
                >
                  {word.word}
                </span>
              ))
            ) : (
              <p className="analytics-empty">Your recurring words will surface here.</p>
            )}
          </div>
        </section>

        <section className="analytics-card response-analytics">
          <header>
            <div>
              <span>Responsiveness</span>
              <h2>Reminder quality</h2>
            </div>
          </header>
          <div
            className="response-orbit"
            style={{ '--score': report?.completionPercentage ?? 0 } as CSSProperties}
          >
            <div>
              <strong>{report?.completionPercentage ?? 0}%</strong>
              <span>completion</span>
            </div>
          </div>
          <dl>
            <div>
              <dt>Completed</dt>
              <dd>{report?.completedIntervals ?? 0}</dd>
            </div>
            <div>
              <dt>Missed</dt>
              <dd>{report?.missedIntervals ?? 0}</dd>
            </div>
            <div>
              <dt>Average delay</dt>
              <dd>{report?.averageResponseDelaySeconds ?? 0}s</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="insights-section">
        <header>
          <span className="journal-kicker">Daily insights</span>
          <h2>What today is telling you</h2>
        </header>
        <div className="insight-grid">
          {insight.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
