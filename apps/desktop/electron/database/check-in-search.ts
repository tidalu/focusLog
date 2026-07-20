import type { DesktopDatabase } from './database.js';

export interface CheckInSearchFilters {
  readonly query?: string;
  readonly tagId?: string;
  readonly categoryId?: string;
  readonly sessionId?: string;
  readonly limit?: number;
}

export interface CheckInSearchResult {
  readonly id: string;
  readonly body: string;
  readonly submittedAt: string;
  readonly rank: number;
}

function ftsQuery(value: string): string {
  return value
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((term) => `"${term.replaceAll('"', '""')}"*`)
    .join(' AND ');
}

export function searchCheckIns(
  database: DesktopDatabase,
  ownerId: string,
  filters: CheckInSearchFilters
): CheckInSearchResult[] {
  const query = ftsQuery(filters.query ?? '');
  const limit = Math.min(100, Math.max(1, filters.limit ?? 100));
  const clauses = [
    'check_ins.owner_id = ?',
    'check_ins.deleted_at IS NULL',
    'check_in_revisions.deleted_at IS NULL'
  ];
  const parameters: Array<string | number> = [ownerId];
  if (filters.categoryId) {
    clauses.push('check_ins.category_id = ?');
    parameters.push(filters.categoryId);
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
  if (query) {
    clauses.push('check_in_revisions_fts MATCH ?');
    parameters.push(query);
  }
  parameters.push(limit);
  const rank = query ? '-bm25(check_in_revisions_fts, 10.0)' : '0.0';
  const ftsJoin = query
    ? 'JOIN check_in_revisions_fts ON check_in_revisions_fts.rowid = check_in_revisions.rowid'
    : '';
  return database
    .prepare(
      `SELECT check_ins.id, check_in_revisions.body, check_ins.submitted_at AS submittedAt, ${rank} AS rank
       FROM check_ins
       JOIN check_in_revisions ON check_in_revisions.id = check_ins.current_revision_id
       ${ftsJoin}
       WHERE ${clauses.join(' AND ')}
       ORDER BY rank DESC, check_ins.submitted_at DESC, check_ins.id
       LIMIT ?`
    )
    .all(...parameters) as CheckInSearchResult[];
}
