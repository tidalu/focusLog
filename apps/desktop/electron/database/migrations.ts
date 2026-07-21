export interface SqliteMigration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

export const desktopMigrations: readonly SqliteMigration[] = [
  {
    version: 1,
    name: 'initial_local_persistence',
    statements: [
      `CREATE TABLE owners (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
      `CREATE TABLE devices (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, public_key TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL UNIQUE, platform TEXT NOT NULL, display_name TEXT, capabilities_json TEXT, is_owner_device INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'ACTIVE', last_seen_at TEXT, revoked_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE device_pairings (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, candidate_public_key TEXT NOT NULL, candidate_fingerprint TEXT NOT NULL, candidate_platform TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', approved_by_device_id TEXT, expires_at TEXT NOT NULL, approved_at TEXT, consumed_at TEXT, cancelled_at TEXT, created_at TEXT NOT NULL, UNIQUE(owner_id, candidate_fingerprint), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(approved_by_device_id) REFERENCES devices(id))`,
      `CREATE TABLE focus_modes (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, interval_minutes INTEGER NOT NULL, policy_json TEXT NOT NULL, version TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner_id, name), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE focus_sessions (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, focus_mode_id TEXT NOT NULL, name TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE', schedule_policy_json TEXT NOT NULL, timezone_id TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT, version TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(focus_mode_id) REFERENCES focus_modes(id))`,
      `CREATE TABLE reminder_occurrences (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, focus_session_id TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'SCHEDULED', scheduled_at TEXT NOT NULL, original_scheduled_at TEXT NOT NULL, presented_at TEXT, resolved_at TEXT, timezone_id TEXT NOT NULL, policy_snapshot_json TEXT NOT NULL, version TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(focus_session_id) REFERENCES focus_sessions(id))`,
      `CREATE TABLE reminder_transitions (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, reminder_occurrence_id TEXT NOT NULL, acting_device_id TEXT, from_state TEXT NOT NULL, to_state TEXT NOT NULL, reason TEXT, original_scheduled_at TEXT NOT NULL, occurred_at TEXT NOT NULL, operation_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, FOREIGN KEY(reminder_occurrence_id) REFERENCES reminder_occurrences(id), FOREIGN KEY(acting_device_id) REFERENCES devices(id))`,
      `CREATE TABLE categories (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT, version TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner_id, name), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE check_ins (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, reminder_occurrence_id TEXT UNIQUE, focus_session_id TEXT, category_id TEXT, current_revision_id TEXT, submitted_at TEXT NOT NULL, timezone_id TEXT NOT NULL, version TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(reminder_occurrence_id) REFERENCES reminder_occurrences(id), FOREIGN KEY(focus_session_id) REFERENCES focus_sessions(id), FOREIGN KEY(category_id) REFERENCES categories(id))`,
      `CREATE TABLE check_in_revisions (id TEXT PRIMARY KEY, check_in_id TEXT NOT NULL, parent_revision_id TEXT, body TEXT NOT NULL, author_device_id TEXT, operation_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, deleted_at TEXT, FOREIGN KEY(check_in_id) REFERENCES check_ins(id))`,
      `CREATE TABLE tags (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT, version TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner_id, name), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE check_in_tags (check_in_id TEXT NOT NULL, tag_id TEXT NOT NULL, PRIMARY KEY(check_in_id, tag_id), FOREIGN KEY(check_in_id) REFERENCES check_ins(id), FOREIGN KEY(tag_id) REFERENCES tags(id))`,
      `CREATE TABLE sync_operations (operation_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, device_id TEXT NOT NULL, device_sequence INTEGER NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, kind TEXT NOT NULL, base_version TEXT, payload_json TEXT NOT NULL, occurred_at TEXT NOT NULL, received_at TEXT NOT NULL, status TEXT NOT NULL, result_json TEXT, sequence INTEGER, UNIQUE(owner_id, device_id, device_sequence), UNIQUE(owner_id, sequence), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(device_id) REFERENCES devices(id))`,
      `CREATE TABLE sync_cursors (owner_id TEXT NOT NULL, device_id TEXT NOT NULL UNIQUE, last_applied_sequence INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY(owner_id, device_id), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(device_id) REFERENCES devices(id))`,
      `CREATE TABLE conflicts (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, local_operation_id TEXT, remote_operation_id TEXT, local_payload_json TEXT, remote_payload_json TEXT, status TEXT NOT NULL DEFAULT 'OPEN', resolved_at TEXT, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE backup_manifests (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL, format_version INTEGER NOT NULL, schema_version INTEGER NOT NULL, storage_location TEXT NOT NULL, checksum TEXT NOT NULL, encryption_json TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE settings (owner_id TEXT PRIMARY KEY, values_json TEXT NOT NULL, version TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE tombstones (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, version TEXT NOT NULL, deleted_at TEXT NOT NULL, retention_until TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(owner_id, entity_type, entity_id), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE INDEX devices_owner_status_idx ON devices(owner_id, status)`,
      `CREATE INDEX device_pairings_owner_status_expiry_idx ON device_pairings(owner_id, status, expires_at)`,
      `CREATE INDEX focus_sessions_owner_status_started_idx ON focus_sessions(owner_id, status, started_at)`,
      `CREATE INDEX reminder_occurrences_owner_state_due_idx ON reminder_occurrences(owner_id, state, scheduled_at)`,
      `CREATE INDEX reminder_transitions_occurrence_at_idx ON reminder_transitions(reminder_occurrence_id, occurred_at)`,
      `CREATE INDEX check_ins_owner_submitted_idx ON check_ins(owner_id, submitted_at)`,
      `CREATE INDEX check_ins_owner_deleted_idx ON check_ins(owner_id, deleted_at)`,
      `CREATE INDEX check_in_revisions_check_in_created_idx ON check_in_revisions(check_in_id, created_at)`,
      `CREATE INDEX sync_operations_owner_received_idx ON sync_operations(owner_id, received_at)`,
      `CREATE INDEX sync_operations_owner_entity_idx ON sync_operations(owner_id, entity_type, entity_id)`,
      `CREATE INDEX conflicts_owner_status_idx ON conflicts(owner_id, status, created_at)`,
      `CREATE INDEX tombstones_owner_retention_idx ON tombstones(owner_id, retention_until)`
    ]
  },
  {
    version: 2,
    name: 'sync_outbox',
    statements: [
      `CREATE TABLE outbox_operations (operation_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, device_id TEXT NOT NULL, device_sequence INTEGER NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, kind TEXT NOT NULL, base_version TEXT, payload_json TEXT NOT NULL, occurred_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL, acknowledged_at TEXT, created_at TEXT NOT NULL, UNIQUE(owner_id, device_id, device_sequence))`,
      `CREATE TABLE sync_failures (operation_id TEXT PRIMARY KEY, code TEXT NOT NULL, message TEXT NOT NULL, recorded_at TEXT NOT NULL, FOREIGN KEY(operation_id) REFERENCES outbox_operations(operation_id))`,
      `CREATE INDEX outbox_operations_ready_idx ON outbox_operations(acknowledged_at, next_attempt_at)`,
      `CREATE INDEX outbox_operations_owner_device_idx ON outbox_operations(owner_id, device_id, device_sequence)`
    ]
  },
  {
    version: 3,
    name: 'persistent_reminder_drafts',
    statements: [
      `CREATE TABLE reminder_drafts (occurrence_id TEXT PRIMARY KEY, text TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(occurrence_id) REFERENCES reminder_occurrences(id))`
    ]
  },
  {
    version: 4,
    name: 'reporting_query_indexes',
    statements: [
      `CREATE INDEX reminder_occurrences_owner_resolved_idx ON reminder_occurrences(owner_id, resolved_at)`,
      `CREATE INDEX reminder_transitions_owner_occurred_idx ON reminder_transitions(owner_id, occurred_at)`,
      `CREATE INDEX focus_sessions_owner_started_ended_idx ON focus_sessions(owner_id, started_at, ended_at)`
    ]
  },
  {
    version: 5,
    name: 'check_in_fts5_search',
    statements: [
      `CREATE VIRTUAL TABLE check_in_revisions_fts USING fts5(body, content='check_in_revisions', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2')`,
      `CREATE TRIGGER check_in_revisions_fts_insert AFTER INSERT ON check_in_revisions BEGIN INSERT INTO check_in_revisions_fts(rowid, body) VALUES (new.rowid, new.body); END`,
      `CREATE TRIGGER check_in_revisions_fts_delete AFTER DELETE ON check_in_revisions BEGIN INSERT INTO check_in_revisions_fts(check_in_revisions_fts, rowid, body) VALUES ('delete', old.rowid, old.body); END`,
      `CREATE TRIGGER check_in_revisions_fts_update AFTER UPDATE OF body ON check_in_revisions BEGIN INSERT INTO check_in_revisions_fts(check_in_revisions_fts, rowid, body) VALUES ('delete', old.rowid, old.body); INSERT INTO check_in_revisions_fts(rowid, body) VALUES (new.rowid, new.body); END`,
      `INSERT INTO check_in_revisions_fts(check_in_revisions_fts) VALUES ('rebuild')`,
      `CREATE INDEX check_in_tags_tag_check_in_idx ON check_in_tags(tag_id, check_in_id)`,
      `CREATE INDEX check_ins_owner_category_session_idx ON check_ins(owner_id, category_id, focus_session_id, submitted_at)`
    ]
  },
  {
    version: 6,
    name: 'multi_section_category_taxonomy',
    statements: [
      `ALTER TABLE categories ADD COLUMN parent_id TEXT REFERENCES categories(id)`,
      `ALTER TABLE categories ADD COLUMN path TEXT`,
      `ALTER TABLE categories ADD COLUMN depth INTEGER NOT NULL DEFAULT 1`,
      `UPDATE check_ins SET category_id = (SELECT canonical.id FROM categories AS current JOIN categories AS canonical ON canonical.owner_id = current.owner_id AND LOWER(TRIM(canonical.name)) = LOWER(TRIM(current.name)) WHERE current.id = check_ins.category_id ORDER BY canonical.created_at, canonical.id LIMIT 1) WHERE category_id IS NOT NULL`,
      `DELETE FROM categories WHERE EXISTS (SELECT 1 FROM categories AS canonical WHERE canonical.owner_id = categories.owner_id AND LOWER(TRIM(canonical.name)) = LOWER(TRIM(categories.name)) AND (canonical.created_at < categories.created_at OR (canonical.created_at = categories.created_at AND canonical.id < categories.id)))`,
      `UPDATE categories SET path = LOWER(TRIM(name)) WHERE path IS NULL`,
      `CREATE UNIQUE INDEX categories_owner_path_idx ON categories(owner_id, path)`,
      `CREATE INDEX categories_owner_parent_idx ON categories(owner_id, parent_id, deleted_at)`,
      `CREATE TABLE log_sections (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, check_in_id TEXT NOT NULL, revision_id TEXT NOT NULL, category_id TEXT, position INTEGER NOT NULL, body TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', occurred_at TEXT NOT NULL, timezone_id TEXT NOT NULL, version TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(revision_id, position), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(check_in_id) REFERENCES check_ins(id), FOREIGN KEY(revision_id) REFERENCES check_in_revisions(id), FOREIGN KEY(category_id) REFERENCES categories(id))`,
      `INSERT INTO log_sections (id, owner_id, check_in_id, revision_id, category_id, position, body, metadata_json, occurred_at, timezone_id, version, created_at) SELECT check_in_revisions.id, check_ins.owner_id, check_ins.id, check_in_revisions.id, check_ins.category_id, 0, check_in_revisions.body, '{}', check_ins.submitted_at, check_ins.timezone_id, check_in_revisions.id, check_in_revisions.created_at FROM check_in_revisions JOIN check_ins ON check_ins.id = check_in_revisions.check_in_id`,
      `CREATE INDEX log_sections_check_in_revision_position_idx ON log_sections(check_in_id, revision_id, position)`,
      `CREATE INDEX log_sections_owner_occurred_idx ON log_sections(owner_id, occurred_at)`,
      `CREATE INDEX log_sections_category_occurred_idx ON log_sections(category_id, occurred_at)`,
      `CREATE VIRTUAL TABLE log_sections_fts USING fts5(body, content='log_sections', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2')`,
      `CREATE TRIGGER log_sections_fts_insert AFTER INSERT ON log_sections BEGIN INSERT INTO log_sections_fts(rowid, body) VALUES (new.rowid, new.body); END`,
      `CREATE TRIGGER log_sections_fts_delete AFTER DELETE ON log_sections BEGIN INSERT INTO log_sections_fts(log_sections_fts, rowid, body) VALUES ('delete', old.rowid, old.body); END`,
      `CREATE TRIGGER log_sections_fts_update AFTER UPDATE OF body ON log_sections BEGIN INSERT INTO log_sections_fts(log_sections_fts, rowid, body) VALUES ('delete', old.rowid, old.body); INSERT INTO log_sections_fts(rowid, body) VALUES (new.rowid, new.body); END`,
      `INSERT INTO log_sections_fts(log_sections_fts) VALUES ('rebuild')`
    ]
  }
];
