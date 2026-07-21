import { useEffect, useMemo, useState } from 'react';

import {
  categoryLabel,
  categoryStyle,
  dateTitle,
  durationLabel,
  entryText,
  localDay,
  systemTimezone,
  timeLabel,
  type Report
} from './journal-ui';

type YearHeatmap = Awaited<ReturnType<Window['focuslog']['heatmap']>>;

function monthColumns(year: number): Array<{ name: string; column: number }> {
  const first = new Date(Date.UTC(year, 0, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 12 }, (_, month) => {
    const date = new Date(Date.UTC(year, month, 1));
    const dayOfYear = Math.floor((date.getTime() - first.getTime()) / 86_400_000);
    return {
      name: date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }),
      column: Math.floor((offset + dayOfYear) / 7) + 1
    };
  });
}

export function CalendarPage(): React.JSX.Element {
  const [year, setYear] = useState(() => Number(localDay().slice(0, 4)));
  const [timezoneId, setTimezoneId] = useState(systemTimezone);
  const [heatmap, setHeatmap] = useState<YearHeatmap | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const monthLabels = useMemo(() => monthColumns(year), [year]);
  const padding = useMemo(() => (new Date(Date.UTC(year, 0, 1)).getUTCDay() + 6) % 7, [year]);

  useEffect(() => {
    let active = true;
    void window.focuslog
      .heatmap({ year, timezoneId })
      .then((result) => {
        if (!active) return;
        setHeatmap(result);
        setError('');
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, [timezoneId, year]);

  useEffect(() => {
    if (!selectedDay) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedDay(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedDay]);

  const openDay = (day: string) => {
    setSelectedDay(day);
    setSelectedReport(null);
    void window.focuslog.report({ day, timezoneId }).then(setSelectedReport);
  };

  const activeDays = heatmap?.days.filter((day) => day.value > 0).length ?? 0;
  const totalEntries = heatmap?.days.reduce((sum, day) => sum + day.value, 0) ?? 0;

  return (
    <div className="journal-page calendar-experience">
      <header className="journal-header report-header">
        <div>
          <span className="journal-kicker">Your year in focus</span>
          <h1>{year} calendar</h1>
          <p>
            Every day stays visible. Intensity reveals the rhythm without hiding quieter seasons.
          </p>
        </div>
        <div className="year-switcher">
          <button aria-label="Previous year" onClick={() => setYear((value) => value - 1)}>
            ‹
          </button>
          <input
            aria-label="Calendar year"
            type="number"
            min="1970"
            max="9998"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          />
          <button aria-label="Next year" onClick={() => setYear((value) => value + 1)}>
            ›
          </button>
        </div>
      </header>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <section className="calendar-summary">
        <div>
          <strong>{totalEntries.toLocaleString()}</strong>
          <span>entries recorded</span>
        </div>
        <div>
          <strong>{activeDays}</strong>
          <span>active days</span>
        </div>
        <div>
          <strong>
            {heatmap?.days.reduce((best, day) => (day.value > best.value ? day : best), {
              day: '—',
              value: 0,
              intensity: 0
            }).value ?? 0}
          </strong>
          <span>most active day</span>
        </div>
        <label>
          <span>Timezone</span>
          <input value={timezoneId} onChange={(event) => setTimezoneId(event.target.value)} />
        </label>
      </section>

      <section className="contribution-card">
        <div className="contribution-topline">
          <div>
            <span className="journal-kicker">Contribution rhythm</span>
            <h2>Daily activity</h2>
          </div>
          <div className="contribution-legend">
            <span>Quiet</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <i key={level} data-level={level} />
            ))}
            <span>Focused</span>
          </div>
        </div>
        <div className="year-heatmap-scroll">
          <div className="month-labels" aria-hidden="true">
            {monthLabels.map((month) => (
              <span key={month.name} style={{ gridColumn: month.column }}>
                {month.name}
              </span>
            ))}
          </div>
          <div className="year-heatmap-wrap">
            <div className="weekday-labels" aria-hidden="true">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>
            <div className="year-heatmap" role="grid" aria-label={`${year} journal activity`}>
              {Array.from({ length: padding }, (_, index) => (
                <i className="heatmap-pad" key={`pad-${index}`} />
              ))}
              {heatmap?.days.map((day) => (
                <button
                  key={day.day}
                  role="gridcell"
                  data-level={day.intensity}
                  data-selected={day.day === selectedDay || undefined}
                  aria-label={`${day.day}: ${day.value} entries`}
                  title={`${day.day} · ${day.value} entries`}
                  onClick={() => openDay(day.day)}
                />
              ))}
            </div>
          </div>
        </div>
        <p className="heatmap-caption">
          Click any day to open its complete journal without leaving the year.
        </p>
      </section>

      {selectedDay && (
        <div className="day-drawer-layer">
          <button
            className="drawer-scrim"
            aria-label="Close day details"
            onClick={() => setSelectedDay(null)}
          />
          <aside
            className="day-drawer"
            aria-label={`${selectedDay} journal`}
            aria-modal="true"
            role="dialog"
          >
            <header>
              <div>
                <span className="journal-kicker">Complete day</span>
                <h2>{dateTitle(selectedDay, timezoneId)}</h2>
                <p>{selectedDay}</p>
              </div>
              <button
                autoFocus
                className="drawer-close"
                aria-label="Close day details"
                onClick={() => setSelectedDay(null)}
              >
                ×
              </button>
            </header>
            <section className="drawer-metrics">
              <div>
                <strong>{selectedReport?.entryCount ?? 0}</strong>
                <span>logs</span>
              </div>
              <div>
                <strong>{selectedReport?.focusScore ?? 0}%</strong>
                <span>focus</span>
              </div>
              <div>
                <strong>{durationLabel(selectedReport?.totalTrackedMinutes ?? 0)}</strong>
                <span>tracked</span>
              </div>
              <div>
                <strong>{selectedReport?.averageResponseDelaySeconds ?? 0}s</strong>
                <span>response</span>
              </div>
            </section>
            <div className="drawer-timeline">
              {selectedReport?.timeline.length ? (
                selectedReport.timeline.map((entry) => (
                  <article key={entry.id} style={categoryStyle(entry.category ?? entry.title)}>
                    <time dateTime={entry.occurredAt}>
                      {timeLabel(entry.occurredAt, timezoneId)}
                    </time>
                    <i />
                    <div>
                      <strong>{categoryLabel(entry.category ?? entry.title)}</strong>
                      <p>{entryText(entry.detail)}</p>
                      <span>
                        {entry.device
                          ? entry.device === 'android'
                            ? 'Android'
                            : 'Desktop'
                          : entry.kind.replaceAll('_', ' ').toLocaleLowerCase()}
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="journal-empty">
                  <strong>A quiet day.</strong>
                  <span>No activity recorded.</span>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
