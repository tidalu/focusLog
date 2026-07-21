import { parseJournalEntry } from '@focuslog/shared-utils';
import { ulid } from 'ulid';

import type { DesktopDatabase } from './database.js';

export function inferredCategoryId(
  database: DesktopDatabase,
  ownerId: string,
  body: string,
  occurredAt: string
): string | null {
  const parsed = parseJournalEntry(body);
  if (!parsed.hasCategoryToken) return null;
  const existing = database
    .prepare('SELECT id, deleted_at FROM categories WHERE owner_id = ? AND name = ?')
    .get(ownerId, parsed.category) as { id: string; deleted_at: string | null } | undefined;
  if (existing) {
    if (existing.deleted_at) {
      database
        .prepare('UPDATE categories SET deleted_at = NULL, updated_at = ? WHERE id = ?')
        .run(occurredAt, existing.id);
    }
    return existing.id;
  }
  const categoryId = ulid();
  database
    .prepare(
      'INSERT INTO categories (id, owner_id, name, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(categoryId, ownerId, parsed.category, ulid(), occurredAt, occurredAt);
  return categoryId;
}

export function updateInferredCategory(
  database: DesktopDatabase,
  ownerId: string,
  checkInId: string,
  body: string,
  occurredAt: string
): string | null {
  const categoryId = inferredCategoryId(database, ownerId, body, occurredAt);
  database.prepare('UPDATE check_ins SET category_id = ? WHERE id = ?').run(categoryId, checkInId);
  return categoryId;
}
