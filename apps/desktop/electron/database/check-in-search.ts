import { reportDayBounds } from '@focuslog/shared-utils';

import type { DesktopDatabase } from './database.js';

export interface CheckInSearchFilters {
  readonly query?: string;
  readonly tagId?: string;
  readonly categoryId?: string;
  readonly sessionId?: string;
  readonly day?: string;
  readonly timezoneId?: string;
  readonly limit?: number;
}

export interface CheckInSearchResult {
  readonly id: string;
  readonly body: string;
  readonly submittedAt: string;
  readonly rank: number;
  readonly category: string;
  readonly device: string;
  readonly responseDelaySeconds: number | null;
  readonly focusSessionId: string | null;
  readonly sections: readonly {
    id: string;
    path: string;
    body: string;
    metadata: Record<string, string>;
    position: number;
  }[];
}

function ftsQuery(value: string): string {
  return value
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((term) => `"${term.replaceAll('"', '""')}"*`)
    .join(' AND ');
}

type ParsedSearch = {
  text: string;
  category?: string;
  device?: string;
  minimumDelaySeconds?: number;
  submittedFrom?: string;
};

export function parseHistorySearch(value: string, now = new Date()): ParsedSearch {
  let text = value.trim();
  const parsed: ParsedSearch = { text: '' };
  text = text.replace(/\bcategory:([^\s]+)/giu, (_match, category: string) => {
    parsed.category = category.replace(/^<|>$/gu, '').toLocaleLowerCase();
    return '';
  });
  text = text.replace(
    /\bdevice:(desktop|windows|android|mobile)\b/giu,
    (_match, device: string) => {
      parsed.device = ['desktop', 'windows'].includes(device.toLocaleLowerCase())
        ? 'windows'
        : 'android';
      return '';
    }
  );
  text = text.replace(/\bdelay>(\d+)(s|m)?\b/giu, (_match, amount: string, unit?: string) => {
    parsed.minimumDelaySeconds = Number(amount) * (unit?.toLocaleLowerCase() === 'm' ? 60 : 1);
    return '';
  });
  if (/\blast\s+week\b/iu.test(text)) {
    parsed.submittedFrom = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    text = text.replace(/\blast\s+week\b/giu, '');
  } else if (/\btoday\b/iu.test(text)) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    parsed.submittedFrom = start.toISOString();
    text = text.replace(/\btoday\b/giu, '');
  }
  parsed.text = text.trim();
  return parsed;
}

export function searchCheckIns(
  database: DesktopDatabase,
  ownerId: string,
  filters: CheckInSearchFilters
): CheckInSearchResult[] {
  const parsedSearch = parseHistorySearch(filters.query ?? '');
  const query = ftsQuery(parsedSearch.text);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 100));
  const clauses = [
    'check_ins.owner_id = ?',
    'check_ins.deleted_at IS NULL',
    'check_in_revisions.deleted_at IS NULL'
  ];
  const parameters: Array<string | number> = query
    ? [query, `%${parsedSearch.text.toLocaleLowerCase()}%`, ownerId]
    : [ownerId];
  if (filters.categoryId) {
    const selected = database
      .prepare('SELECT path FROM categories WHERE id = ? AND owner_id = ?')
      .get(filters.categoryId, ownerId) as { path: string } | undefined;
    if (selected) {
      clauses.push('(section_categories.path = ? OR section_categories.path LIKE ?)');
      parameters.push(selected.path, `${selected.path}/%`);
    }
  }
  if (parsedSearch.category) {
    if (parsedSearch.category === 'uncategorized') {
      clauses.push('log_sections.category_id IS NULL');
    } else {
      clauses.push(
        '(LOWER(section_categories.path) = ? OR LOWER(section_categories.path) LIKE ? OR LOWER(section_categories.path) LIKE ?)'
      );
      parameters.push(
        parsedSearch.category,
        `${parsedSearch.category}/%`,
        `%/${parsedSearch.category}`
      );
    }
  }
  if (parsedSearch.device) {
    clauses.push('LOWER(devices.platform) = ?');
    parameters.push(parsedSearch.device);
  }
  if (parsedSearch.minimumDelaySeconds != null) {
    clauses.push(
      'reminder_occurrences.scheduled_at IS NOT NULL AND (julianday(check_ins.submitted_at) - julianday(reminder_occurrences.scheduled_at)) * 86400 > ?'
    );
    parameters.push(parsedSearch.minimumDelaySeconds);
  }
  if (parsedSearch.submittedFrom) {
    clauses.push('check_ins.submitted_at >= ?');
    parameters.push(parsedSearch.submittedFrom);
  }
  if (filters.day) {
    const bounds = reportDayBounds(filters.day, filters.timezoneId ?? 'UTC');
    clauses.push('check_ins.submitted_at >= ? AND check_ins.submitted_at < ?');
    parameters.push(bounds.start.toISOString(), bounds.end.toISOString());
  }
  if (filters.sessionId) {
    clauses.push('check_ins.focus_session_id = ?');
    parameters.push(filters.sessionId);
  }
  if (filters.tagId) {
    clauses.push(
      'EXISTS (SELECT 1 FROM check_in_tags WHERE check_in_tags.check_in_id = check_ins.id AND check_in_tags.tag_id = ?)'
    );
    parameters.push(filters.tagId);
  }
  parameters.push(Math.min(10_000, limit * 100));
  const matchedSections = query
    ? `WITH matched_sections AS (
         SELECT rowid, -bm25(log_sections_fts, 10.0) AS rank
           FROM log_sections_fts WHERE log_sections_fts MATCH ?
         UNION ALL
         SELECT log_sections.rowid, 0.25 AS rank
           FROM log_sections
           LEFT JOIN categories ON categories.id = log_sections.category_id
          WHERE LOWER(COALESCE(categories.path, 'uncategorized')) LIKE ?
       ), ranked_sections AS (
         SELECT rowid, MAX(rank) AS rank FROM matched_sections GROUP BY rowid
       )`
    : '';
  const rank = query ? 'ranked_sections.rank' : '0.0';
  const matchedJoin = query
    ? 'JOIN ranked_sections ON ranked_sections.rowid = log_sections.rowid'
    : '';
  type SearchRow = Omit<CheckInSearchResult, 'sections'> & {
    sectionId: string;
    sectionPath: string;
    sectionBody: string;
    metadataJson: string;
    sectionPosition: number;
  };
  const rows = database
    .prepare(
      `${matchedSections}
       SELECT check_ins.id, check_in_revisions.body, check_ins.submitted_at AS submittedAt,
              ${rank} AS rank, COALESCE(section_categories.path, 'Uncategorized') AS category,
              COALESCE(devices.platform, 'unknown') AS device,
              CASE WHEN reminder_occurrences.scheduled_at IS NULL THEN NULL ELSE
                MAX(0, CAST(ROUND((julianday(check_ins.submitted_at) - julianday(reminder_occurrences.scheduled_at)) * 86400) AS INTEGER))
              END AS responseDelaySeconds,
              check_ins.focus_session_id AS focusSessionId,
              log_sections.id AS sectionId,
              COALESCE(section_categories.path, 'Uncategorized') AS sectionPath,
              log_sections.body AS sectionBody,
              log_sections.metadata_json AS metadataJson,
              log_sections.position AS sectionPosition
       FROM check_ins
       JOIN check_in_revisions ON check_in_revisions.id = check_ins.current_revision_id
       JOIN log_sections ON log_sections.revision_id = check_ins.current_revision_id
       ${matchedJoin}
       LEFT JOIN categories AS section_categories ON section_categories.id = log_sections.category_id
       LEFT JOIN devices ON devices.id = check_in_revisions.author_device_id
       LEFT JOIN reminder_occurrences ON reminder_occurrences.id = check_ins.reminder_occurrence_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY rank DESC, check_ins.submitted_at DESC, check_ins.id, log_sections.position
       LIMIT ?`
    )
    .all(...parameters) as SearchRow[];
  const grouped = new Map<string, CheckInSearchResult>();
  for (const row of rows) {
    const section = {
      id: row.sectionId,
      path: row.sectionPath,
      body: row.sectionBody,
      metadata: JSON.parse(row.metadataJson) as Record<string, string>,
      position: row.sectionPosition
    };
    const current = grouped.get(row.id);
    if (current) {
      (current.sections as (typeof section)[]).push(section);
      continue;
    }
    grouped.set(row.id, {
      id: row.id,
      body: row.body,
      submittedAt: row.submittedAt,
      rank: row.rank,
      category: row.category,
      device: row.device,
      responseDelaySeconds: row.responseDelaySeconds,
      focusSessionId: row.focusSessionId,
      sections: [section]
    });
  }
  return [...grouped.values()].slice(0, limit);
}
