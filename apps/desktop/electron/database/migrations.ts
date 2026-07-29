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
    name: 'ai_platform_foundation',
    statements: [
      `CREATE TABLE ai_settings (owner_id TEXT PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'DISABLED' CHECK(mode IN ('DISABLED','LOCAL','CLOUD','HYBRID')), max_context_tokens INTEGER NOT NULL DEFAULT 12000, max_output_tokens INTEGER NOT NULL DEFAULT 2048, monthly_cloud_budget_usd REAL, request_cost_cap_usd REAL, data_sharing_preview INTEGER NOT NULL DEFAULT 1, automatic_analysis INTEGER NOT NULL DEFAULT 0, analyses_enabled INTEGER NOT NULL DEFAULT 1, facts_enabled INTEGER NOT NULL DEFAULT 1, graph_enabled INTEGER NOT NULL DEFAULT 1, embeddings_enabled INTEGER NOT NULL DEFAULT 1, playground_enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_provider_profiles (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, provider_id TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, endpoint TEXT, generation_model TEXT, embedding_model TEXT, temperature REAL NOT NULL DEFAULT 0.2, top_p REAL NOT NULL DEFAULT 1, max_output_tokens INTEGER NOT NULL DEFAULT 2048, timeout_ms INTEGER NOT NULL DEFAULT 30000, retry_limit INTEGER NOT NULL DEFAULT 2, concurrency_limit INTEGER NOT NULL DEFAULT 1, automatic_analysis INTEGER NOT NULL DEFAULT 0, priority INTEGER NOT NULL DEFAULT 100, monthly_budget_usd REAL, credential_configured INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner_id, name), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_cloud_consents (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, provider_profile_id TEXT NOT NULL, mode TEXT NOT NULL, consented_at TEXT NOT NULL, UNIQUE(owner_id, provider_profile_id, mode), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(provider_profile_id) REFERENCES ai_provider_profiles(id))`,
      `CREATE TABLE ai_provider_model_cache (profile_id TEXT NOT NULL, model_id TEXT NOT NULL, display_name TEXT NOT NULL, context_window INTEGER, cached_at TEXT NOT NULL, expires_at TEXT NOT NULL, PRIMARY KEY(profile_id, model_id), FOREIGN KEY(profile_id) REFERENCES ai_provider_profiles(id) ON DELETE CASCADE)`,
      `CREATE TABLE ai_usage_records (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, job_id TEXT, purpose TEXT NOT NULL, provider_profile_id TEXT, model_id TEXT, prompt_version TEXT, duration_ms INTEGER NOT NULL, input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER, usage_reported INTEGER NOT NULL, estimated_cost_usd REAL, pricing_version TEXT, retry_index INTEGER NOT NULL DEFAULT 0, fallback_chain_id TEXT, outcome TEXT NOT NULL, error_code TEXT, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(provider_profile_id) REFERENCES ai_provider_profiles(id))`,
      `CREATE TABLE ai_jobs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL, idempotency_key TEXT NOT NULL, payload_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'QUEUED', attempts INTEGER NOT NULL DEFAULT 0, run_after TEXT NOT NULL, lease_owner TEXT, lease_expires_at TEXT, last_error_code TEXT, last_error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT, UNIQUE(owner_id, idempotency_key), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_memories (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, period_kind TEXT NOT NULL, period_key TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL, content TEXT NOT NULL, schema_version TEXT NOT NULL, prompt_version TEXT NOT NULL, provider_profile_id TEXT, source_revision_watermark TEXT, superseded_at TEXT, created_at TEXT NOT NULL, UNIQUE(owner_id, period_kind, period_key, version), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_memory_sources (memory_id TEXT NOT NULL, check_in_id TEXT NOT NULL, revision_id TEXT NOT NULL, PRIMARY KEY(memory_id, revision_id), FOREIGN KEY(memory_id) REFERENCES ai_memories(id) ON DELETE CASCADE, FOREIGN KEY(check_in_id) REFERENCES check_ins(id))`,
      `CREATE TABLE ai_embedding_namespaces (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, provider_profile_id TEXT, model_id TEXT NOT NULL, dimensions INTEGER, chunking_version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TEXT NOT NULL, UNIQUE(owner_id, name, model_id, chunking_version), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_embedding_records (id TEXT PRIMARY KEY, namespace_id TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL, source_revision_id TEXT, chunk_index INTEGER NOT NULL, text_hash TEXT NOT NULL, vector_json TEXT NOT NULL, invalidated_at TEXT, created_at TEXT NOT NULL, UNIQUE(namespace_id, source_id, source_revision_id, chunk_index), FOREIGN KEY(namespace_id) REFERENCES ai_embedding_namespaces(id) ON DELETE CASCADE)`,
      `CREATE TABLE ai_facts (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, subject TEXT NOT NULL, predicate TEXT NOT NULL, object_value TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PROPOSED', confidence REAL, locked_at TEXT, superseded_at TEXT, schema_version TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_fact_evidence (fact_id TEXT NOT NULL, check_in_id TEXT NOT NULL, revision_id TEXT NOT NULL, PRIMARY KEY(fact_id, revision_id), FOREIGN KEY(fact_id) REFERENCES ai_facts(id) ON DELETE CASCADE, FOREIGN KEY(check_in_id) REFERENCES check_ins(id))`,
      `CREATE TABLE ai_graph_nodes (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, canonical_name TEXT NOT NULL, node_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PROPOSED', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner_id, canonical_name, node_type), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_graph_edges (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, source_node_id TEXT NOT NULL, predicate TEXT NOT NULL, target_node_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PROPOSED', confidence REAL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(source_node_id) REFERENCES ai_graph_nodes(id), FOREIGN KEY(target_node_id) REFERENCES ai_graph_nodes(id))`,
      `CREATE TABLE ai_playground_prompts (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, content TEXT NOT NULL, built_in INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_playground_runs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, prompt_id TEXT, provider_profile_id TEXT NOT NULL, model_id TEXT NOT NULL, rendered_prompt_hash TEXT NOT NULL, context_hash TEXT NOT NULL, response TEXT, status TEXT NOT NULL, duration_ms INTEGER, usage_json TEXT, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(prompt_id) REFERENCES ai_playground_prompts(id), FOREIGN KEY(provider_profile_id) REFERENCES ai_provider_profiles(id))`,
      `CREATE INDEX ai_provider_profiles_owner_enabled_idx ON ai_provider_profiles(owner_id, enabled, priority)`,
      `CREATE INDEX ai_jobs_ready_idx ON ai_jobs(status, run_after, lease_expires_at)`,
      `CREATE INDEX ai_usage_owner_created_idx ON ai_usage_records(owner_id, created_at)`,
      `CREATE INDEX ai_memories_owner_period_idx ON ai_memories(owner_id, period_kind, period_key, created_at)`,
      `CREATE INDEX ai_embedding_records_namespace_live_idx ON ai_embedding_records(namespace_id, invalidated_at)`,
      `CREATE INDEX ai_facts_owner_status_idx ON ai_facts(owner_id, status, updated_at)`
    ]
  },
  {
    version: 7,
    name: 'durable_ai_job_queue',
    statements: [
      `UPDATE ai_jobs SET status = lower(status)`,
      `ALTER TABLE ai_jobs ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE ai_jobs ADD COLUMN priority INTEGER NOT NULL DEFAULT 100`,
      `ALTER TABLE ai_jobs ADD COLUMN scheduled_at TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN started_at TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN finished_at TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3`,
      `ALTER TABLE ai_jobs ADD COLUMN lease_token TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN lease_acquired_at TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN cancellation_requested INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE ai_jobs ADD COLUMN progress_json TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN requested_profile_id TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN requested_model_id TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN actual_profile_id TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN actual_model_id TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN privacy_mode TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN prompt_id TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN prompt_version TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN output_schema_version TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN parameters_json TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN duration_ms INTEGER`,
      `ALTER TABLE ai_jobs ADD COLUMN input_tokens INTEGER`,
      `ALTER TABLE ai_jobs ADD COLUMN output_tokens INTEGER`,
      `ALTER TABLE ai_jobs ADD COLUMN estimated_cost_usd REAL`,
      `ALTER TABLE ai_jobs ADD COLUMN error_detail TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN result_reference TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN dead_letter_reason TEXT`,
      `ALTER TABLE ai_jobs ADD COLUMN superseded_by_job_id TEXT`,
      `CREATE INDEX ai_jobs_owner_status_ready_idx ON ai_jobs(owner_id, status, run_after, priority, created_at)`,
      `CREATE INDEX ai_jobs_lease_expiry_idx ON ai_jobs(status, lease_expires_at)`
    ]
  },
  {
    version: 8,
    name: 'ai_daily_analysis_job_result_link',
    statements: [
      `ALTER TABLE ai_memories ADD COLUMN job_id TEXT`,
      `CREATE UNIQUE INDEX ai_memories_owner_job_idx ON ai_memories(owner_id, job_id) WHERE job_id IS NOT NULL`
    ]
  },
  {
    version: 9,
    name: 'ai_queue_recovery_diagnostics',
    statements: [
      `CREATE TABLE ai_queue_diagnostics (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, job_id TEXT, code TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(job_id) REFERENCES ai_jobs(id))`,
      `CREATE INDEX ai_queue_diagnostics_owner_created_idx ON ai_queue_diagnostics(owner_id, created_at DESC)`
    ]
  },
  {
    version: 10,
    name: 'ai_provider_resilience_controls',
    statements: [
      `CREATE TABLE ai_fallback_chains (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, scope TEXT NOT NULL, purpose TEXT, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner_id, name), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_fallback_chain_entries (id TEXT PRIMARY KEY, chain_id TEXT NOT NULL, position INTEGER NOT NULL, provider_profile_id TEXT NOT NULL, model_override TEXT, required_capabilities_json TEXT NOT NULL DEFAULT '[]', enabled INTEGER NOT NULL DEFAULT 1, max_attempt_cost_micros INTEGER, classification TEXT NOT NULL CHECK(classification IN ('LOCAL','CLOUD')), allowed_tasks_json TEXT, error_policy_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(chain_id, position), UNIQUE(chain_id, provider_profile_id, model_override), FOREIGN KEY(chain_id) REFERENCES ai_fallback_chains(id) ON DELETE CASCADE, FOREIGN KEY(provider_profile_id) REFERENCES ai_provider_profiles(id))`,
      `CREATE TABLE ai_job_fallback_snapshots (job_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, chain_id TEXT, chain_version INTEGER, snapshot_json TEXT NOT NULL, request_cap_micros INTEGER, privacy_mode TEXT NOT NULL, consent_purpose TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(job_id) REFERENCES ai_jobs(id) ON DELETE CASCADE, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_provider_attempts (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, job_id TEXT NOT NULL, sequence INTEGER NOT NULL, queue_attempt INTEGER NOT NULL, fallback_position INTEGER, provider_profile_id TEXT, provider_type TEXT, model_id TEXT, operation_type TEXT NOT NULL, required_capabilities_json TEXT NOT NULL DEFAULT '[]', started_at TEXT, finished_at TEXT, duration_ms INTEGER, outcome TEXT NOT NULL, error_code TEXT, error_detail TEXT, retry_decision TEXT, fallback_decision TEXT, breaker_before TEXT, breaker_after TEXT, input_tokens INTEGER, output_tokens INTEGER, reported_cost_micros INTEGER, estimated_cost_micros INTEGER, reserved_cost_micros INTEGER, settled_cost_micros INTEGER, currency TEXT NOT NULL DEFAULT 'USD', cost_precision TEXT NOT NULL DEFAULT 'estimated', structured_mode TEXT, structured_repair_count INTEGER NOT NULL DEFAULT 0, cancellation_state TEXT, privacy_classification TEXT, consent_reference TEXT, diagnostic_schema_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(job_id, sequence), FOREIGN KEY(job_id) REFERENCES ai_jobs(id) ON DELETE CASCADE, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_circuit_breakers (owner_id TEXT NOT NULL, provider_profile_id TEXT NOT NULL, operation_class TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'closed' CHECK(state IN ('closed','open','half_open')), consecutive_failures INTEGER NOT NULL DEFAULT 0, window_failures INTEGER NOT NULL DEFAULT 0, window_started_at TEXT, last_failure_at TEXT, last_success_at TEXT, open_until TEXT, probe_owner TEXT, probe_token TEXT, probe_expires_at TEXT, reason TEXT, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, PRIMARY KEY(owner_id, provider_profile_id, operation_class), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(provider_profile_id) REFERENCES ai_provider_profiles(id))`,
      `CREATE TABLE ai_budget_settings (owner_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, currency TEXT NOT NULL DEFAULT 'USD', monthly_hard_limit_micros INTEGER, monthly_soft_limit_micros INTEGER, request_hard_limit_micros INTEGER, timezone_id TEXT NOT NULL DEFAULT 'UTC', global_concurrency_limit INTEGER NOT NULL DEFAULT 2, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_budget_reservations (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, job_id TEXT NOT NULL, provider_attempt_id TEXT, planned_attempt_key TEXT NOT NULL, provider_profile_id TEXT, period_key TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'USD', reserved_micros INTEGER NOT NULL, settled_micros INTEGER, status TEXT NOT NULL CHECK(status IN ('reserved','settled','released','expired')), expires_at TEXT NOT NULL, settlement_source TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(job_id, planned_attempt_key), FOREIGN KEY(job_id) REFERENCES ai_jobs(id) ON DELETE CASCADE, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(provider_attempt_id) REFERENCES ai_provider_attempts(id), FOREIGN KEY(provider_profile_id) REFERENCES ai_provider_profiles(id))`,
      `CREATE INDEX ai_provider_attempts_job_sequence_idx ON ai_provider_attempts(job_id, sequence)`,
      `CREATE INDEX ai_budget_reservations_owner_period_idx ON ai_budget_reservations(owner_id, period_key, status)`,
      `CREATE INDEX ai_circuit_breakers_open_idx ON ai_circuit_breakers(owner_id, state, open_until)`
    ]
  },
  {
    version: 11,
    name: 'ai_execution_kill_switches',
    statements: [
      `CREATE TABLE ai_execution_kill_switches (owner_id TEXT NOT NULL, scope TEXT NOT NULL CHECK(scope IN ('global','provider','chain')), target_id TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 0, reason TEXT, updated_at TEXT NOT NULL, PRIMARY KEY(owner_id, scope, target_id), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE INDEX ai_execution_kill_switches_owner_enabled_idx ON ai_execution_kill_switches(owner_id, enabled)`
    ]
  },
  {
    version: 12,
    name: 'ai_daily_structured_result_v1',
    statements: [
      `ALTER TABLE ai_memories ADD COLUMN structured_result_json TEXT`,
      `ALTER TABLE ai_memories ADD COLUMN structured_schema_version INTEGER`,
      `ALTER TABLE ai_memories ADD COLUMN validation_status TEXT NOT NULL DEFAULT 'legacy'`
    ]
  },
  {
    version: 13,
    name: 'ai_budget_recovery_state',
    statements: [
      `ALTER TABLE ai_provider_attempts ADD COLUMN provider_started_at TEXT`,
      `CREATE TABLE ai_budget_recovery_diagnostics (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, reservation_id TEXT NOT NULL, job_id TEXT NOT NULL, category TEXT NOT NULL, prior_state TEXT NOT NULL, resulting_state TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(owner_id, reservation_id, category, resulting_state), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(reservation_id) REFERENCES ai_budget_reservations(id), FOREIGN KEY(job_id) REFERENCES ai_jobs(id))`,
      `CREATE INDEX ai_budget_recovery_diagnostics_owner_created_idx ON ai_budget_recovery_diagnostics(owner_id, created_at DESC)`
    ]
  },
  {
    version: 14,
    name: 'ai_budget_pricing_snapshot',
    statements: [
      `ALTER TABLE ai_budget_reservations ADD COLUMN pricing_version TEXT`,
      `ALTER TABLE ai_budget_reservations ADD COLUMN pricing_snapshot_json TEXT`
    ]
  },
  {
    version: 15,
    name: 'ai_hierarchical_analysis_versions',
    statements: [
      `CREATE TABLE ai_analysis_results (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, level TEXT NOT NULL CHECK(level IN ('daily','weekly','monthly','quarterly','yearly')), period_id TEXT NOT NULL, timezone_id TEXT NOT NULL, local_start TEXT NOT NULL, local_end TEXT NOT NULL, period_start_utc TEXT NOT NULL, period_end_utc TEXT NOT NULL, boundary_policy_version TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('current','superseded','stale')), stale_reason TEXT, superseded_by_result_id TEXT, source_revision_hash TEXT NOT NULL, statistics_json TEXT NOT NULL, structured_result_json TEXT NOT NULL, readable_summary TEXT NOT NULL, prompt_id TEXT NOT NULL, prompt_version TEXT NOT NULL, schema_version TEXT NOT NULL, generation_metadata_json TEXT NOT NULL, provider_profile_id TEXT, provider_id TEXT, model_id TEXT, fallback_used INTEGER NOT NULL DEFAULT 0, usage_record_id TEXT, estimated_cost_usd REAL, job_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner_id, level, period_id, source_revision_hash, prompt_version, schema_version), UNIQUE(owner_id, job_id), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(job_id) REFERENCES ai_jobs(id))`,
      `CREATE UNIQUE INDEX ai_analysis_results_current_idx ON ai_analysis_results(owner_id, level, period_id) WHERE status = 'current'`,
      `CREATE INDEX ai_analysis_results_owner_level_period_idx ON ai_analysis_results(owner_id, level, period_id, created_at)`,
      `CREATE INDEX ai_analysis_results_stale_idx ON ai_analysis_results(owner_id, status, level, period_id)`,
      `CREATE TABLE ai_analysis_child_sources (analysis_result_id TEXT NOT NULL, owner_id TEXT NOT NULL, child_result_id TEXT NOT NULL, child_level TEXT NOT NULL, child_period_id TEXT NOT NULL, child_version INTEGER NOT NULL, child_source_kind TEXT NOT NULL CHECK(child_source_kind IN ('ai_analysis_results','ai_memories')), PRIMARY KEY(analysis_result_id, child_result_id), FOREIGN KEY(analysis_result_id) REFERENCES ai_analysis_results(id) ON DELETE CASCADE, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE INDEX ai_analysis_child_sources_child_idx ON ai_analysis_child_sources(owner_id, child_level, child_period_id, child_result_id)`,
      `CREATE TABLE ai_analysis_log_sources (analysis_result_id TEXT NOT NULL, owner_id TEXT NOT NULL, evidence_id TEXT NOT NULL, check_in_id TEXT NOT NULL, revision_id TEXT NOT NULL, occurred_at TEXT NOT NULL, PRIMARY KEY(analysis_result_id, evidence_id), FOREIGN KEY(analysis_result_id) REFERENCES ai_analysis_results(id) ON DELETE CASCADE, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(check_in_id) REFERENCES check_ins(id))`,
      `CREATE INDEX ai_analysis_log_sources_revision_idx ON ai_analysis_log_sources(owner_id, revision_id)`,
      `CREATE TABLE ai_analysis_dependency_events (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, source_result_id TEXT NOT NULL, dependent_result_id TEXT NOT NULL, event_type TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(owner_id, source_result_id, dependent_result_id, event_type), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE INDEX ai_analysis_dependency_events_owner_created_idx ON ai_analysis_dependency_events(owner_id, created_at DESC)`
    ]
  },
  {
    version: 16,
    name: 'ai_analysis_schedules',
    statements: [
      `CREATE TABLE ai_analysis_schedules (owner_id TEXT NOT NULL, level TEXT NOT NULL CHECK(level IN ('daily','weekly','monthly','quarterly','yearly')), enabled INTEGER NOT NULL DEFAULT 0, local_time TEXT NOT NULL DEFAULT '03:00', timezone_id TEXT NOT NULL DEFAULT 'UTC', provider_profile_id TEXT, model_mode TEXT NOT NULL DEFAULT 'profile_default' CHECK(model_mode IN ('profile_default','fixed')), model_id TEXT, fallback_chain_id TEXT, privacy_mode TEXT NOT NULL DEFAULT 'LOCAL' CHECK(privacy_mode IN ('DISABLED','LOCAL','CLOUD','HYBRID')), max_cost_micros TEXT, kill_switch_enabled INTEGER NOT NULL DEFAULT 0, catch_up_limit INTEGER NOT NULL DEFAULT 3, last_evaluation_at TEXT, last_eligible_period_id TEXT, next_expected_run_at TEXT, last_success_at TEXT, diagnostic_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(owner_id, level), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(provider_profile_id) REFERENCES ai_provider_profiles(id), FOREIGN KEY(fallback_chain_id) REFERENCES ai_fallback_chains(id))`,
      `CREATE TABLE ai_analysis_schedule_diagnostics (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, level TEXT NOT NULL, code TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE INDEX ai_analysis_schedule_diagnostics_owner_created_idx ON ai_analysis_schedule_diagnostics(owner_id, created_at DESC)`,
      `CREATE INDEX ai_analysis_schedules_enabled_idx ON ai_analysis_schedules(owner_id, enabled, kill_switch_enabled)`
    ]
  },
  {
    version: 17,
    name: 'ai_embedding_lifecycle_v2',
    statements: [
      `CREATE TABLE ai_vector_namespaces (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, provider_profile_id TEXT NOT NULL, provider_id TEXT NOT NULL, model_id TEXT NOT NULL, dimensions INTEGER NOT NULL CHECK(dimensions > 0), distance_metric TEXT NOT NULL CHECK(distance_metric IN ('cosine','dot','l2')), privacy_mode TEXT NOT NULL CHECK(privacy_mode IN ('LOCAL','CLOUD','HYBRID')), privacy_class TEXT NOT NULL CHECK(privacy_class IN ('local','cloud')), chunking_version TEXT NOT NULL, chunking_schema_version INTEGER NOT NULL, source_types_json TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('building','active','deprecated','failed','deleted')), coverage_status TEXT NOT NULL CHECK(coverage_status IN ('not_started','incomplete','verified','failed')), coverage_expected_chunks INTEGER NOT NULL DEFAULT 0, coverage_indexed_chunks INTEGER NOT NULL DEFAULT 0, storage_bytes INTEGER NOT NULL DEFAULT 0, rebuild_of_namespace_id TEXT, replacement_namespace_id TEXT, active_at TEXT, deprecated_at TEXT, deleted_at TEXT, last_rebuild_started_at TEXT, last_rebuild_completed_at TEXT, last_error_code TEXT, last_error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(provider_profile_id) REFERENCES ai_provider_profiles(id))`,
      `CREATE UNIQUE INDEX ai_vector_namespaces_active_name_idx ON ai_vector_namespaces(owner_id, name) WHERE status = 'active'`,
      `CREATE INDEX ai_vector_namespaces_owner_status_idx ON ai_vector_namespaces(owner_id, status, updated_at DESC)`,
      `CREATE INDEX ai_vector_namespaces_rebuild_idx ON ai_vector_namespaces(owner_id, rebuild_of_namespace_id, status)`,
      `CREATE TABLE ai_vector_chunks (id TEXT PRIMARY KEY, namespace_id TEXT NOT NULL, owner_id TEXT NOT NULL, source_type TEXT NOT NULL CHECK(source_type IN ('check_in_revision','daily_analysis','analysis_result')), source_id TEXT NOT NULL, source_revision_id TEXT, chunk_index INTEGER NOT NULL, chunking_version TEXT NOT NULL, content_hash TEXT NOT NULL, source_hash TEXT NOT NULL, text_length INTEGER NOT NULL, token_estimate INTEGER NOT NULL, char_start INTEGER NOT NULL, char_end INTEGER NOT NULL, metadata_json TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','embedded','invalidated','failed')), invalidated_at TEXT, failure_code TEXT, failure_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(namespace_id) REFERENCES ai_vector_namespaces(id) ON DELETE CASCADE, FOREIGN KEY(owner_id) REFERENCES owners(id), UNIQUE(namespace_id, id))`,
      `CREATE UNIQUE INDEX ai_vector_chunks_source_unique_idx ON ai_vector_chunks(namespace_id, source_type, source_id, COALESCE(source_revision_id, ''), chunk_index)`,
      `CREATE INDEX ai_vector_chunks_namespace_status_idx ON ai_vector_chunks(namespace_id, status, source_type, source_id)`,
      `CREATE INDEX ai_vector_chunks_source_idx ON ai_vector_chunks(owner_id, source_type, source_id, source_revision_id)`,
      `CREATE TABLE ai_vector_records (id TEXT PRIMARY KEY, namespace_id TEXT NOT NULL, chunk_id TEXT NOT NULL, owner_id TEXT NOT NULL, dimensions INTEGER NOT NULL CHECK(dimensions > 0), distance_metric TEXT NOT NULL CHECK(distance_metric IN ('cosine','dot','l2')), vector_json TEXT NOT NULL, vector_hash TEXT NOT NULL, usage_record_id TEXT, status TEXT NOT NULL CHECK(status IN ('active','invalidated','failed')), failure_code TEXT, failure_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(namespace_id) REFERENCES ai_vector_namespaces(id) ON DELETE CASCADE, FOREIGN KEY(chunk_id) REFERENCES ai_vector_chunks(id) ON DELETE CASCADE, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(usage_record_id) REFERENCES ai_usage_records(id), UNIQUE(namespace_id, chunk_id))`,
      `CREATE INDEX ai_vector_records_namespace_status_idx ON ai_vector_records(namespace_id, status)`,
      `CREATE TABLE ai_vector_namespace_events (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, namespace_id TEXT NOT NULL, event_type TEXT NOT NULL, prior_status TEXT, resulting_status TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(namespace_id) REFERENCES ai_vector_namespaces(id) ON DELETE CASCADE)`,
      `CREATE INDEX ai_vector_namespace_events_owner_created_idx ON ai_vector_namespace_events(owner_id, created_at DESC)`
    ]
  },
  {
    version: 18,
    name: 'ai_playground_prompt_context_tooling',
    statements: [
      `CREATE TABLE ai_playground_prompt_definitions_v2 (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','archived')), origin TEXT NOT NULL CHECK(origin IN ('playground','production_copy','imported')), production_prompt_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, UNIQUE(owner_id, name), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_playground_prompt_versions_v2 (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, prompt_id TEXT NOT NULL, version INTEGER NOT NULL, system_instructions TEXT NOT NULL, developer_instructions TEXT, user_template TEXT NOT NULL, variables_json TEXT NOT NULL, structured_schema_json TEXT, delimiters_json TEXT NOT NULL, metadata_json TEXT NOT NULL, validation_json TEXT NOT NULL, created_at TEXT NOT NULL, restored_from_version_id TEXT, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(prompt_id) REFERENCES ai_playground_prompt_definitions_v2(id) ON DELETE CASCADE, UNIQUE(prompt_id, version))`,
      `CREATE INDEX ai_playground_prompt_versions_prompt_idx ON ai_playground_prompt_versions_v2(prompt_id, version DESC)`,
      `CREATE TABLE ai_playground_context_snapshots (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, prompt_version_id TEXT, max_context_tokens INTEGER NOT NULL, reserved_output_tokens INTEGER NOT NULL, total_tokens INTEGER NOT NULL, provider_upload_required INTEGER NOT NULL, privacy_mode TEXT NOT NULL CHECK(privacy_mode IN ('DISABLED','LOCAL','CLOUD','HYBRID')), final_prompt_redacted TEXT NOT NULL, truncation_json TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(prompt_version_id) REFERENCES ai_playground_prompt_versions_v2(id))`,
      `CREATE TABLE ai_playground_context_items (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, snapshot_id TEXT NOT NULL, position INTEGER NOT NULL, source_type TEXT NOT NULL CHECK(source_type IN ('manual_text','selected_log','date_range','category','project','daily_summary','weekly_summary','monthly_summary','quarterly_summary','yearly_summary','fact','graph_neighbor','semantic_result','imported_document','synthetic_fixture')), source_id TEXT, source_revision_id TEXT, classification TEXT NOT NULL CHECK(classification IN ('canonical','derived','playground')), stale_state TEXT NOT NULL CHECK(stale_state IN ('current','stale','deleted','unavailable')), retrieval_score REAL, privacy_class TEXT NOT NULL CHECK(privacy_class IN ('local','cloud','playground')), token_estimate INTEGER NOT NULL, truncated INTEGER NOT NULL, provider_upload_required INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(snapshot_id) REFERENCES ai_playground_context_snapshots(id) ON DELETE CASCADE, UNIQUE(snapshot_id, position))`,
      `CREATE INDEX ai_playground_context_items_snapshot_idx ON ai_playground_context_items(snapshot_id, position)`,
      `CREATE TABLE ai_playground_prompt_events (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, prompt_id TEXT, event_type TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(prompt_id) REFERENCES ai_playground_prompt_definitions_v2(id) ON DELETE CASCADE)`,
      `CREATE INDEX ai_playground_prompt_events_owner_created_idx ON ai_playground_prompt_events(owner_id, created_at DESC)`
    ]
  },
  {
    version: 19,
    name: 'ai_fact_graph_lifecycle_v2',
    statements: [
      `CREATE TABLE ai_fact_records (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, subject TEXT NOT NULL, predicate TEXT NOT NULL, object_value TEXT NOT NULL, normalized_value_json TEXT NOT NULL, fact_type TEXT NOT NULL CHECK(fact_type IN ('identity','preference','project','habit','goal','relationship','status','temporal','custom')), status TEXT NOT NULL CHECK(status IN ('proposed','active','reinforced','superseded','contradicted','stale','rejected','corrected')), confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1), valid_from TEXT, valid_to TEXT, temporal_qualifier TEXT, origin TEXT NOT NULL CHECK(origin IN ('automated','user_overlay','imported')), prompt_id TEXT, prompt_version TEXT, schema_version TEXT NOT NULL, provider_profile_id TEXT, model_id TEXT, extraction_version TEXT NOT NULL, superseded_by_fact_id TEXT, corrected_by_fact_id TEXT, user_overlay_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE INDEX ai_fact_records_owner_subject_idx ON ai_fact_records(owner_id, subject, status, updated_at DESC)`,
      `CREATE UNIQUE INDEX ai_fact_records_active_unique_idx ON ai_fact_records(owner_id, subject, predicate, object_value, COALESCE(valid_from,''), COALESCE(valid_to,'')) WHERE status IN ('active','reinforced','corrected')`,
      `CREATE TABLE ai_fact_record_evidence (fact_id TEXT NOT NULL, owner_id TEXT NOT NULL, source_type TEXT NOT NULL CHECK(source_type IN ('check_in_revision','analysis_result','ai_memory')), source_id TEXT NOT NULL, revision_id TEXT NOT NULL, evidence_hash TEXT NOT NULL, excerpt_redacted TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(fact_id, revision_id), FOREIGN KEY(fact_id) REFERENCES ai_fact_records(id) ON DELETE CASCADE, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE INDEX ai_fact_record_evidence_source_idx ON ai_fact_record_evidence(owner_id, source_type, source_id, revision_id)`,
      `CREATE TABLE ai_fact_status_history (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, fact_id TEXT NOT NULL, prior_status TEXT, resulting_status TEXT NOT NULL, reason TEXT NOT NULL, actor TEXT NOT NULL CHECK(actor IN ('system','user','recovery')), created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(fact_id) REFERENCES ai_fact_records(id) ON DELETE CASCADE)`,
      `CREATE INDEX ai_fact_status_history_fact_idx ON ai_fact_status_history(fact_id, created_at)`,
      `CREATE TABLE ai_fact_corrections (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, fact_id TEXT, corrected_fact_id TEXT, action TEXT NOT NULL CHECK(action IN ('reject','correct','supersede')), correction_json TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(fact_id) REFERENCES ai_fact_records(id), FOREIGN KEY(corrected_fact_id) REFERENCES ai_fact_records(id))`,
      `CREATE TABLE ai_graph_entities (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, canonical_name TEXT NOT NULL, node_type TEXT NOT NULL CHECK(node_type IN ('person','project','habit','goal','place','organization','topic','feature','custom')), normalized_name TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','alias','merged','split','stale','tombstoned')), confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1), origin TEXT NOT NULL CHECK(origin IN ('automated','user_overlay','imported')), extraction_version TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, tombstoned_at TEXT, UNIQUE(owner_id, normalized_name, node_type), FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE INDEX ai_graph_entities_owner_status_idx ON ai_graph_entities(owner_id, status, updated_at DESC)`,
      `CREATE TABLE ai_graph_aliases (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, entity_id TEXT NOT NULL, alias TEXT NOT NULL, normalized_alias TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','rejected','tombstoned')), confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1), source TEXT NOT NULL CHECK(source IN ('automated','user')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner_id, normalized_alias), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(entity_id) REFERENCES ai_graph_entities(id) ON DELETE CASCADE)`,
      `CREATE TABLE ai_graph_relations (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, source_entity_id TEXT NOT NULL, predicate TEXT NOT NULL CHECK(predicate IN ('related_to','works_on','prefers','blocked_by','supports','contradicts','alias_of','custom')), target_entity_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('proposed','active','stale','unsupported','rejected','tombstoned')), confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1), valid_from TEXT, valid_to TEXT, origin TEXT NOT NULL CHECK(origin IN ('automated','user_overlay','imported')), extraction_version TEXT NOT NULL, source_fact_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(source_entity_id) REFERENCES ai_graph_entities(id), FOREIGN KEY(target_entity_id) REFERENCES ai_graph_entities(id), FOREIGN KEY(source_fact_id) REFERENCES ai_fact_records(id))`,
      `CREATE UNIQUE INDEX ai_graph_relations_unique_active_idx ON ai_graph_relations(owner_id, source_entity_id, predicate, target_entity_id, COALESCE(valid_from,''), COALESCE(valid_to,'')) WHERE status IN ('proposed','active')`,
      `CREATE INDEX ai_graph_relations_entity_idx ON ai_graph_relations(owner_id, source_entity_id, target_entity_id, status)`,
      `CREATE TABLE ai_graph_relation_evidence (relation_id TEXT NOT NULL, owner_id TEXT NOT NULL, fact_id TEXT, source_type TEXT NOT NULL, source_id TEXT NOT NULL, revision_id TEXT NOT NULL, evidence_hash TEXT NOT NULL, excerpt_redacted TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(relation_id, revision_id), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(relation_id) REFERENCES ai_graph_relations(id) ON DELETE CASCADE, FOREIGN KEY(fact_id) REFERENCES ai_fact_records(id))`,
      `CREATE TABLE ai_graph_events (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, entity_id TEXT, relation_id TEXT, event_type TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(entity_id) REFERENCES ai_graph_entities(id), FOREIGN KEY(relation_id) REFERENCES ai_graph_relations(id))`,
      `CREATE INDEX ai_graph_events_owner_created_idx ON ai_graph_events(owner_id, created_at DESC)`
    ]
  },
  {
    version: 20,
    name: 'ai_memory_retrieval_plans',
    statements: [
      `CREATE TABLE ai_memory_staleness_events (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL, revision_id TEXT, affected_json TEXT NOT NULL, recompute_order_json TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE INDEX ai_memory_staleness_events_owner_created_idx ON ai_memory_staleness_events(owner_id, created_at DESC)`,
      `CREATE TABLE ai_retrieval_plans (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, query TEXT NOT NULL, query_type TEXT NOT NULL, privacy_mode TEXT NOT NULL CHECK(privacy_mode IN ('LOCAL','CLOUD','HYBRID')), token_budget INTEGER NOT NULL, cost_budget_micros TEXT, evidence_required INTEGER NOT NULL, stale_disclosure INTEGER NOT NULL, provider_profile_id TEXT, model_id TEXT, exclusion_reasons_json TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_retrieval_plan_items (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, plan_id TEXT NOT NULL, position INTEGER NOT NULL, source_type TEXT NOT NULL CHECK(source_type IN ('fact','graph_relation','summary','raw_log')), source_id TEXT NOT NULL, source_revision_id TEXT, source_version TEXT, stale_state TEXT NOT NULL CHECK(stale_state IN ('current','stale','superseded','contradicted','unsupported')), classification TEXT NOT NULL CHECK(classification IN ('canonical','derived')), title TEXT NOT NULL, excerpt_redacted TEXT NOT NULL, token_estimate INTEGER NOT NULL, score REAL NOT NULL, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(plan_id) REFERENCES ai_retrieval_plans(id) ON DELETE CASCADE, UNIQUE(plan_id, position))`,
      `CREATE INDEX ai_retrieval_plan_items_plan_idx ON ai_retrieval_plan_items(plan_id, position)`,
      `CREATE TABLE ai_memory_qa_answers (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, plan_id TEXT NOT NULL, job_id TEXT, question TEXT NOT NULL, answer_redacted TEXT NOT NULL, structured_json TEXT NOT NULL, provider_profile_id TEXT, model_id TEXT, fallback_used INTEGER NOT NULL, weak_evidence INTEGER NOT NULL, contradiction_disclosed INTEGER NOT NULL, stale_disclosed INTEGER NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(plan_id) REFERENCES ai_retrieval_plans(id) ON DELETE CASCADE, FOREIGN KEY(job_id) REFERENCES ai_jobs(id))`,
      `CREATE INDEX ai_memory_qa_answers_owner_created_idx ON ai_memory_qa_answers(owner_id, created_at DESC)`
    ]
  },
  {
    version: 21,
    name: 'ai_playground_persistent_chat',
    statements: [
      `ALTER TABLE ai_playground_runs RENAME TO ai_playground_legacy_runs`,
      `CREATE TABLE ai_playground_sessions (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','archived','deleted')), root_message_id TEXT, current_branch_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT, deleted_at TEXT, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE INDEX ai_playground_sessions_owner_status_idx ON ai_playground_sessions(owner_id, status, updated_at DESC)`,
      `CREATE TABLE ai_playground_branches (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, session_id TEXT NOT NULL, parent_message_id TEXT, name TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(session_id) REFERENCES ai_playground_sessions(id) ON DELETE CASCADE)`,
      `CREATE INDEX ai_playground_branches_session_idx ON ai_playground_branches(owner_id, session_id, created_at)`,
      `CREATE TABLE ai_playground_messages (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, session_id TEXT NOT NULL, branch_id TEXT NOT NULL, parent_message_id TEXT, role TEXT NOT NULL CHECK(role IN ('system','user','assistant','tool')), content TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','edited','regenerated','cancelled','deleted')), run_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(session_id) REFERENCES ai_playground_sessions(id) ON DELETE CASCADE, FOREIGN KEY(branch_id) REFERENCES ai_playground_branches(id) ON DELETE CASCADE)`,
      `CREATE INDEX ai_playground_messages_session_branch_idx ON ai_playground_messages(owner_id, session_id, branch_id, created_at)`,
      `CREATE TABLE ai_playground_runs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, session_id TEXT NOT NULL, request_message_id TEXT NOT NULL, assistant_message_id TEXT, job_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('queued','running','streaming','succeeded','failed','cancelled','interrupted')), prompt_snapshot_id TEXT, context_snapshot_id TEXT, provider_profile_id TEXT NOT NULL, provider_id TEXT NOT NULL, model_id TEXT NOT NULL, fallback_used INTEGER NOT NULL DEFAULT 0, parameters_json TEXT NOT NULL, input_snapshot_json TEXT NOT NULL, output_text TEXT, structured_output_json TEXT, partial_output_text TEXT, latency_ms INTEGER, input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER, estimated_cost_micros TEXT NOT NULL DEFAULT '0', usage_record_id TEXT, stop_reason TEXT, error_code TEXT, error_message TEXT, cancellation_requested INTEGER NOT NULL DEFAULT 0, started_at TEXT, finished_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(session_id) REFERENCES ai_playground_sessions(id) ON DELETE CASCADE, FOREIGN KEY(request_message_id) REFERENCES ai_playground_messages(id), FOREIGN KEY(assistant_message_id) REFERENCES ai_playground_messages(id), FOREIGN KEY(job_id) REFERENCES ai_jobs(id), FOREIGN KEY(prompt_snapshot_id) REFERENCES ai_playground_prompt_versions_v2(id), FOREIGN KEY(context_snapshot_id) REFERENCES ai_playground_context_snapshots(id), FOREIGN KEY(provider_profile_id) REFERENCES ai_provider_profiles(id), FOREIGN KEY(usage_record_id) REFERENCES ai_usage_records(id))`,
      `CREATE INDEX ai_playground_runs_owner_status_idx ON ai_playground_runs(owner_id, status, updated_at DESC)`,
      `CREATE UNIQUE INDEX ai_playground_runs_job_idx ON ai_playground_runs(owner_id, job_id)`,
      `CREATE TABLE ai_playground_run_events (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, run_id TEXT NOT NULL, sequence INTEGER NOT NULL, event_type TEXT NOT NULL CHECK(event_type IN ('delta','usage','complete','error','cancelled','recovered')), content_redacted TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(run_id, sequence), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(run_id) REFERENCES ai_playground_runs(id) ON DELETE CASCADE)`,
      `CREATE INDEX ai_playground_run_events_run_idx ON ai_playground_run_events(run_id, sequence)`,
      `CREATE TABLE ai_playground_namespace_refs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, session_id TEXT NOT NULL, namespace_id TEXT NOT NULL, purpose TEXT NOT NULL CHECK(purpose IN ('chat','retrieval','embedding_inspector')), status TEXT NOT NULL CHECK(status IN ('active','deleted')), created_at TEXT NOT NULL, deleted_at TEXT, UNIQUE(owner_id, session_id, namespace_id, purpose), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(session_id) REFERENCES ai_playground_sessions(id) ON DELETE CASCADE, FOREIGN KEY(namespace_id) REFERENCES ai_vector_namespaces(id))`,
      `CREATE TABLE ai_playground_attachments (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, session_id TEXT NOT NULL, message_id TEXT, name TEXT NOT NULL, media_type TEXT NOT NULL, storage_ref TEXT NOT NULL, size_bytes INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','deleted')), created_at TEXT NOT NULL, deleted_at TEXT, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(session_id) REFERENCES ai_playground_sessions(id) ON DELETE CASCADE, FOREIGN KEY(message_id) REFERENCES ai_playground_messages(id))`
    ]
  },
  {
    version: 22,
    name: 'ai_playground_comparison_and_inspectors',
    statements: [
      `CREATE TABLE ai_playground_comparison_groups (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, prompt_snapshot_id TEXT, context_snapshot_id TEXT, input_hash TEXT NOT NULL, parameters_json TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('running','completed','cancelled','failed')), evaluation_metadata_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(prompt_snapshot_id) REFERENCES ai_playground_prompt_versions_v2(id), FOREIGN KEY(context_snapshot_id) REFERENCES ai_playground_context_snapshots(id))`,
      `CREATE INDEX ai_playground_comparison_groups_owner_created_idx ON ai_playground_comparison_groups(owner_id, created_at DESC)`,
      `CREATE TABLE ai_playground_comparison_runs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, group_id TEXT NOT NULL, job_id TEXT NOT NULL, position INTEGER NOT NULL, provider_profile_id TEXT NOT NULL, provider_id TEXT NOT NULL, model_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed','cancelled')), output_text TEXT, latency_ms INTEGER, input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER, estimated_cost_micros TEXT NOT NULL DEFAULT '0', stop_reason TEXT, fallback_used INTEGER NOT NULL DEFAULT 0, structured_valid INTEGER NOT NULL DEFAULT 0, repairs INTEGER NOT NULL DEFAULT 0, capability_json TEXT NOT NULL, error_code TEXT, error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(group_id, position), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(group_id) REFERENCES ai_playground_comparison_groups(id) ON DELETE CASCADE, FOREIGN KEY(job_id) REFERENCES ai_jobs(id), FOREIGN KEY(provider_profile_id) REFERENCES ai_provider_profiles(id))`,
      `CREATE INDEX ai_playground_comparison_runs_group_idx ON ai_playground_comparison_runs(group_id, position)`,
      `CREATE TABLE ai_playground_embedding_inspections (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, session_id TEXT, namespace_id TEXT NOT NULL, provider_profile_id TEXT NOT NULL, provider_id TEXT NOT NULL, model_id TEXT NOT NULL, dimensions INTEGER NOT NULL, input_count INTEGER NOT NULL, vector_sample_json TEXT NOT NULL, similarity_json TEXT NOT NULL, usage_json TEXT NOT NULL, estimated_cost_micros TEXT NOT NULL DEFAULT '0', metadata_json TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(session_id) REFERENCES ai_playground_sessions(id), FOREIGN KEY(namespace_id) REFERENCES ai_vector_namespaces(id), FOREIGN KEY(provider_profile_id) REFERENCES ai_provider_profiles(id))`,
      `CREATE INDEX ai_playground_embedding_inspections_owner_created_idx ON ai_playground_embedding_inspections(owner_id, created_at DESC)`,
      `CREATE TABLE ai_playground_retrieval_inspections (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, plan_id TEXT NOT NULL, query_normalized TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('keyword','semantic','hybrid')), filters_json TEXT NOT NULL, keyword_candidates_json TEXT NOT NULL, semantic_candidates_json TEXT NOT NULL, exclusions_json TEXT NOT NULL, final_context_json TEXT NOT NULL, token_truncation_json TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(plan_id) REFERENCES ai_retrieval_plans(id))`,
      `CREATE INDEX ai_playground_retrieval_inspections_owner_created_idx ON ai_playground_retrieval_inspections(owner_id, created_at DESC)`,
      `CREATE TABLE ai_playground_structured_workbench_runs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, job_id TEXT NOT NULL, provider_profile_id TEXT NOT NULL, provider_id TEXT NOT NULL, model_id TEXT NOT NULL, schema_json TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('provider_native','prompt_json_fallback')), prompt TEXT NOT NULL, raw_response_redacted TEXT, parsed_json TEXT, validation_errors_json TEXT NOT NULL, repaired INTEGER NOT NULL DEFAULT 0, repair_attempts INTEGER NOT NULL DEFAULT 0, accepted_output_json TEXT, status TEXT NOT NULL CHECK(status IN ('accepted','invalid','failed','cancelled')), usage_json TEXT NOT NULL, latency_ms INTEGER, estimated_cost_micros TEXT NOT NULL DEFAULT '0', export_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(job_id) REFERENCES ai_jobs(id), FOREIGN KEY(provider_profile_id) REFERENCES ai_provider_profiles(id))`,
      `CREATE INDEX ai_playground_structured_workbench_owner_created_idx ON ai_playground_structured_workbench_runs(owner_id, created_at DESC)`
    ]
  },
  {
    version: 23,
    name: 'ai_playground_evaluation_exchange_switches',
    statements: [
      `CREATE TABLE ai_playground_eval_datasets (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','archived')), current_version_id TEXT, privacy_class TEXT NOT NULL CHECK(privacy_class IN ('playground','local_snapshot','production_reference')), origin TEXT NOT NULL CHECK(origin IN ('synthetic','manual','json_import','jsonl_import','local_data_snapshot')), import_metadata_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE INDEX ai_playground_eval_datasets_owner_idx ON ai_playground_eval_datasets(owner_id, updated_at DESC)`,
      `CREATE TABLE ai_playground_eval_dataset_versions (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, dataset_id TEXT NOT NULL, version INTEGER NOT NULL, case_count INTEGER NOT NULL, expected_properties_json TEXT NOT NULL, reference_answers_json TEXT NOT NULL, frozen_metadata_json TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(dataset_id, version), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(dataset_id) REFERENCES ai_playground_eval_datasets(id) ON DELETE CASCADE)`,
      `CREATE TABLE ai_playground_eval_cases (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, dataset_version_id TEXT NOT NULL, case_key TEXT NOT NULL, input_json TEXT NOT NULL, expected_json TEXT NOT NULL, reference_answer TEXT, privacy_class TEXT NOT NULL, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(dataset_version_id, case_key), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(dataset_version_id) REFERENCES ai_playground_eval_dataset_versions(id) ON DELETE CASCADE)`,
      `CREATE INDEX ai_playground_eval_cases_version_idx ON ai_playground_eval_cases(dataset_version_id, case_key)`,
      `CREATE TABLE ai_playground_eval_runs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, dataset_version_id TEXT NOT NULL, prompt_version_id TEXT, context_snapshot_id TEXT, comparison_group_id TEXT, provider_profile_id TEXT, model_id TEXT, evaluator_profile_id TEXT, status TEXT NOT NULL CHECK(status IN ('completed','failed','blocked')), evaluator_config_json TEXT NOT NULL, frozen_input_json TEXT NOT NULL, app_version TEXT NOT NULL, schema_version TEXT NOT NULL, deterministic_summary_json TEXT NOT NULL, model_evaluator_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(dataset_version_id) REFERENCES ai_playground_eval_dataset_versions(id), FOREIGN KEY(prompt_version_id) REFERENCES ai_playground_prompt_versions_v2(id), FOREIGN KEY(context_snapshot_id) REFERENCES ai_playground_context_snapshots(id), FOREIGN KEY(comparison_group_id) REFERENCES ai_playground_comparison_groups(id), FOREIGN KEY(provider_profile_id) REFERENCES ai_provider_profiles(id), FOREIGN KEY(evaluator_profile_id) REFERENCES ai_provider_profiles(id))`,
      `CREATE INDEX ai_playground_eval_runs_owner_created_idx ON ai_playground_eval_runs(owner_id, created_at DESC)`,
      `CREATE TABLE ai_playground_eval_case_results (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, eval_run_id TEXT NOT NULL, case_id TEXT NOT NULL, actual_json TEXT NOT NULL, deterministic_scores_json TEXT NOT NULL, passed INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(eval_run_id, case_id), FOREIGN KEY(owner_id) REFERENCES owners(id), FOREIGN KEY(eval_run_id) REFERENCES ai_playground_eval_runs(id) ON DELETE CASCADE, FOREIGN KEY(case_id) REFERENCES ai_playground_eval_cases(id))`,
      `CREATE TABLE ai_playground_exchange_records (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, direction TEXT NOT NULL CHECK(direction IN ('import','export')), artifact_type TEXT NOT NULL, artifact_id TEXT, status TEXT NOT NULL CHECK(status IN ('completed','rejected')), validation_json TEXT NOT NULL, manifest_json TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE INDEX ai_playground_exchange_records_owner_created_idx ON ai_playground_exchange_records(owner_id, created_at DESC)`,
      `CREATE TABLE ai_playground_retrieval_configs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, config_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_playground_benchmark_results (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, command TEXT NOT NULL, environment_json TEXT NOT NULL, metrics_json TEXT NOT NULL, artifact_json TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(owner_id) REFERENCES owners(id))`,
      `CREATE TABLE ai_subsystem_switches (owner_id TEXT NOT NULL, subsystem TEXT NOT NULL CHECK(subsystem IN ('provider_calls','scheduled_analyses','embeddings','fact_extraction','graph_updates','retrieval_qa','playground_execution','cloud_execution','background_queue')), disabled INTEGER NOT NULL DEFAULT 0, reason TEXT, updated_at TEXT NOT NULL, PRIMARY KEY(owner_id, subsystem), FOREIGN KEY(owner_id) REFERENCES owners(id))`
    ]
  },
  {
    version: 24,
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
