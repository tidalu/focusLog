import { useEffect, useMemo, useState, type CSSProperties, type RefObject } from 'react';

import {
  categoryLabel,
  categoryStyle,
  dateTitle,
  delayLabel,
  durationLabel,
  localDay,
  periodFor,
  systemTimezone,
  timeLabel,
  type HistoryItem,
  type Report
} from './journal-ui';

type SearchFilters = Awaited<ReturnType<Window['focuslog']['searchFilters']>>;

type HistoryPageProps = {
  searchRef: RefObject<HTMLInputElement | null>;
};

const quickFilters = [
  { label: 'Everything', query: '' },
  { label: 'Today', query: 'today' },
  { label: 'Last week', query: 'last week' },
  { label: 'Delayed', query: 'delay>30s' },
  { label: 'Desktop', query: 'device:desktop' },
  { label: 'Android', query: 'device:android' }
] as const;

function monthDays(month: Date): Array<{ day: string; label: number; inMonth: boolean }> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, monthIndex, index - mondayOffset + 1, 12);
    return {
      day: localDay(date),
      label: date.getDate(),
      inMonth: date.getMonth() === monthIndex
    };
  });
}

export function HistoryPage({ searchRef }: HistoryPageProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState(() => localDay());
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [categoryId, setCategoryId] = useState('');
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({ tags: [], categories: [], sessions: [] });
  const [loading, setLoading] = useState(true);
  const days = useMemo(() => monthDays(visibleMonth), [visibleMonth]);
  const isRangeSearch = /\blast\s+week\b/iu.test(query);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const spansMultipleDays = /\b(?:today|last\s+week)\b/iu.test(query);
    void Promise.all([
      window.focuslog.history({
        query,
        ...(!spansMultipleDays ? { day: selectedDay } : {}),
        timezoneId: systemTimezone,
        ...(categoryId ? { categoryId } : {})
      }),
      window.focuslog.report({ day: selectedDay, timezoneId: systemTimezone }),
      window.focuslog.searchFilters()
    ]).then(([nextItems, nextReport, nextFilters]) => {
      if (!active) return;
      setItems(nextItems);
      setReport(nextReport);
      setFilters(nextFilters);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [categoryId, query, selectedDay]);

  const grouped = useMemo(() => {
    const result = new Map<string, HistoryItem[]>();
    for (const item of items) {
      const period = periodFor(item.submittedAt);
      result.set(period, [...(result.get(period) ?? []), item]);
    }
    return result;
  }, [items]);

  const commonCategory = report?.categories[0]?.name ?? '—';
  const maxCategoryCount = Math.max(...(report?.categories.map((item) => item.count) ?? [0]), 1);

  return (
    <div className="journal-page history-experience">
      <header className="journal-header">
        <div>
          <span className="journal-kicker">Your journal</span>
          <h1>History</h1>
          <p>A quiet, chronological record of where your attention went.</p>
        </div>
        <div className="spotlight-search" role="search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={searchRef}
            aria-label="Search journal"
            placeholder="Search entries or try category:study, last week, delay>30s…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>Ctrl K</kbd>
        </div>
      </header>

      <div className="history-layout">
        <aside className="journal-rail" aria-label="Choose journal date">
          <div className="mini-calendar-heading">
            <button
              aria-label="Previous month"
              onClick={() =>
                setVisibleMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                )
              }
            >
              ‹
            </button>
            <strong>
              {visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </strong>
            <button
              aria-label="Next month"
              onClick={() =>
                setVisibleMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                )
              }
            >
              ›
            </button>
          </div>
          <div className="mini-calendar-weekdays" aria-hidden="true">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mini-calendar-grid">
            {days.map((item) => (
              <button
                key={item.day}
                className={item.inMonth ? undefined : 'outside-month'}
                aria-pressed={selectedDay === item.day}
                aria-label={item.day}
                onClick={() => setSelectedDay(item.day)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="category-filter-list">
            <span>Categories</span>
            <button aria-pressed={!categoryId} onClick={() => setCategoryId('')}>
              <i style={categoryStyle('Uncategorized')} /> All entries
            </button>
            {filters.categories.slice(0, 8).map((category) => (
              <button
                key={category.id}
                aria-pressed={categoryId === category.id}
                onClick={() => setCategoryId(category.id)}
              >
                <i style={categoryStyle(category.name)} /> {categoryLabel(category.name)}
              </button>
            ))}
          </div>
        </aside>

        <main className="journal-stream">
          <div className="stream-heading">
            <div>
              <span>{isRangeSearch ? 'Last 7 days' : dateTitle(selectedDay)}</span>
              <h2>{items.length} entries</h2>
            </div>
            <div className="quick-filter-row" aria-label="Quick filters">
              {quickFilters.map((filter) => (
                <button
                  key={filter.label}
                  aria-pressed={query === filter.query}
                  onClick={() => {
                    setQuery(filter.query);
                    if (filter.query === 'today') setSelectedDay(localDay());
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="journal-empty">Gathering your journal…</div>
          ) : items.length === 0 ? (
            <div className="journal-empty">
              <strong>A clear page.</strong>
              <span>No entries match this day and filter.</span>
            </div>
          ) : (
            ['Morning', 'Afternoon', 'Evening'].map((period) => {
              const periodItems = grouped.get(period);
              if (!periodItems?.length) return null;
              return (
                <section className="timeline-period" key={period}>
                  <div className="period-heading">
                    <span>{period}</span>
                    <i />
                  </div>
                  <div className="journal-card-list">
                    {periodItems.map((item) => (
                      <article
                        className="journal-card"
                        key={item.id}
                        style={categoryStyle(item.category)}
                      >
                        <time dateTime={item.submittedAt}>{timeLabel(item.submittedAt)}</time>
                        <span className="category-orb" aria-hidden="true" />
                        <div className="journal-card-body">
                          <div className="journal-card-heading">
                            <strong>{categoryLabel(item.category)}</strong>
                            <span>{delayLabel(item.responseDelaySeconds)}</span>
                          </div>
                          <div className="journal-card-sections">
                            {item.sections.map((section) => (
                              <section key={section.id} style={categoryStyle(section.path)}>
                                <span>{categoryLabel(section.path)}</span>
                                <p>{section.body || 'Empty journal section'}</p>
                                {Object.keys(section.metadata).length > 0 && (
                                  <small>
                                    {Object.entries(section.metadata)
                                      .map(([key, value]) => `${key}: ${value}`)
                                      .join(' · ')}
                                  </small>
                                )}
                              </section>
                            ))}
                          </div>
                          <footer>
                            <span>{item.device === 'android' ? 'Android' : 'Desktop'}</span>
                            {item.responseDelaySeconds != null &&
                              item.responseDelaySeconds > 30 && <em>Delayed</em>}
                          </footer>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </main>

        <aside className="journal-stats" aria-label="Selected day statistics">
          <span className="stats-label">Day at a glance</span>
          <div
            className="focus-ring"
            style={{ '--score': report?.focusScore ?? 0 } as CSSProperties}
          >
            <div>
              <strong>{report?.focusScore ?? 0}%</strong>
              <span>focus</span>
            </div>
          </div>
          <dl>
            <div>
              <dt>Entries</dt>
              <dd>{report?.entryCount ?? 0}</dd>
            </div>
            <div>
              <dt>Top category</dt>
              <dd>{categoryLabel(commonCategory)}</dd>
            </div>
            <div>
              <dt>Longest streak</dt>
              <dd>{durationLabel(report?.longestFocusStreakMinutes ?? 0)}</dd>
            </div>
            <div>
              <dt>Most active</dt>
              <dd>{report?.mostActiveHour == null ? '—' : `${report.mostActiveHour}:00`}</dd>
            </div>
            <div>
              <dt>Avg. response</dt>
              <dd>{report ? `${report.averageResponseDelaySeconds}s` : '—'}</dd>
            </div>
          </dl>
          <div className="mini-distribution" aria-label="Category distribution">
            {report?.categories.slice(0, 4).map((category) => (
              <span
                key={category.name}
                style={{
                  ...categoryStyle(category.name),
                  width: `${(category.count / maxCategoryCount) * 100}%`
                }}
                title={`${categoryLabel(category.name)}: ${category.count}`}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
