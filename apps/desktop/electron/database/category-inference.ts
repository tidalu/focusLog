import { normalizeJournalCategory, parseJournalLog } from '@focuslog/shared-utils';
import { ulid } from 'ulid';

import type { DesktopDatabase } from './database.js';

export type MaterializedLogSection = {
  id: string;
  path: string;
  categoryPath: string[];
  body: string;
  metadata: Record<string, string>;
  position: number;
};

export function sectionPayload(body: string): MaterializedLogSection[] {
  return parseJournalLog(body).sections.map((section) => ({
    id: ulid(),
    path: section.path,
    categoryPath: section.categoryPath,
    body: section.text,
    metadata: section.metadata,
    position: section.position
  }));
}

function ensureCategoryPath(
  database: DesktopDatabase,
  ownerId: string,
  segments: readonly string[],
  occurredAt: string
): string | null {
  if (!segments.length) return null;
  const normalizedSegments = segments.map(normalizeJournalCategory).filter(Boolean);
  if (!normalizedSegments.length) return null;
  let parentId: string | null = null;
  let leafId: string | null = null;
  for (let depth = 1; depth <= normalizedSegments.length; depth += 1) {
    const path = normalizedSegments.slice(0, depth).join('/');
    const existing = database
      .prepare('SELECT id, deleted_at FROM categories WHERE owner_id = ? AND path = ?')
      .get(ownerId, path) as { id: string; deleted_at: string | null } | undefined;
    if (existing) {
      if (existing.deleted_at) {
        database
          .prepare('UPDATE categories SET deleted_at = NULL, updated_at = ? WHERE id = ?')
          .run(occurredAt, existing.id);
      }
      leafId = existing.id;
    } else {
      leafId = ulid();
      database
        .prepare(
          'INSERT INTO categories (id, owner_id, parent_id, name, path, depth, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          leafId,
          ownerId,
          parentId,
          normalizedSegments[depth - 1],
          path,
          depth,
          ulid(),
          occurredAt,
          occurredAt
        );
    }
    parentId = leafId;
  }
  return leafId;
}

export function materializeLogSections(
  database: DesktopDatabase,
  input: {
    ownerId: string;
    checkInId: string;
    revisionId: string;
    body: string;
    occurredAt: string;
    timezoneId: string;
    sections?: readonly MaterializedLogSection[];
  }
): { categoryId: string | null; sections: MaterializedLogSection[] } {
  const sections = input.sections?.length ? [...input.sections] : sectionPayload(input.body);
  let firstCategoryId: string | null = null;
  const insert = database.prepare(
    'INSERT OR IGNORE INTO log_sections (id, owner_id, check_in_id, revision_id, category_id, position, body, metadata_json, occurred_at, timezone_id, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const section of sections) {
    const categoryId = ensureCategoryPath(
      database,
      input.ownerId,
      section.categoryPath,
      input.occurredAt
    );
    firstCategoryId ??= categoryId;
    insert.run(
      section.id,
      input.ownerId,
      input.checkInId,
      input.revisionId,
      categoryId,
      section.position,
      section.body,
      JSON.stringify(section.metadata),
      input.occurredAt,
      input.timezoneId,
      input.revisionId,
      input.occurredAt
    );
  }
  database
    .prepare('UPDATE check_ins SET category_id = ? WHERE id = ?')
    .run(firstCategoryId, input.checkInId);
  return { categoryId: firstCategoryId, sections };
}
