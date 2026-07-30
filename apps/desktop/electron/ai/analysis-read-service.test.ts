import { describe, expect, it } from 'vitest';

import { openDesktopDatabase } from '../database/database.js';
import { AnalysisReadService } from './analysis-read-service.js';

function fixture() {
  const database = openDesktopDatabase(':memory:');
  database.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
  database.prepare("INSERT INTO owners VALUES ('other','2026-01-01','2026-01-01')").run();
  database
    .prepare(
      "INSERT INTO ai_provider_profiles (id, owner_id, name, provider_id, enabled, generation_model, created_at, updated_at) VALUES ('profile','owner','Local','ollama',1,'qwen','2026-01-01','2026-01-01')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES ('check','owner','rev','2026-07-21T10:00:00.000Z','UTC','v1','2026-07-21','2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES ('rev','check','Visible evidence with SECRET_API_KEY','op','2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_jobs (id, owner_id, kind, idempotency_key, payload_json, status, run_after, created_at, updated_at) VALUES ('job','owner','weekly_analysis','job-key','{}','succeeded','2026-07-21','2026-07-21','2026-07-21')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_usage_records (id, owner_id, job_id, purpose, provider_profile_id, model_id, prompt_version, duration_ms, input_tokens, output_tokens, total_tokens, usage_reported, estimated_cost_usd, outcome, created_at) VALUES ('usage','owner','job','weekly-analysis','profile','qwen','1.0.0',10,11,12,23,1,NULL,'SUCCESS','2026-07-21')"
    )
    .run();
  const structured = JSON.stringify({
    schemaVersion: 1,
    level: 'weekly',
    periodId: '2026-W30',
    result: {
      summary: 'Weekly summary',
      patterns: [],
      changes: [],
      difficulties: [],
      projects: [],
      habits: [],
      distractions: [],
      reflectionQuestions: [],
      nextSteps: [],
      confidence: 'high',
      completeness: 'medium'
    }
  });
  database
    .prepare(
      `INSERT INTO ai_analysis_results (id, owner_id, level, period_id, timezone_id, local_start, local_end, period_start_utc, period_end_utc, boundary_policy_version, version, status, source_revision_hash, statistics_json, structured_result_json, readable_summary, prompt_id, prompt_version, schema_version, generation_metadata_json, provider_profile_id, provider_id, model_id, fallback_used, usage_record_id, estimated_cost_usd, job_id, created_at, updated_at) VALUES ('result-old','owner','weekly','2026-W30','UTC','2026-07-20','2026-07-27','2026-07-20T00:00:00.000Z','2026-07-27T00:00:00.000Z','calendar-v1',1,'superseded','hash-old','{}',?,'Old summary','weekly','1.0.0','1','{}','profile','ollama','qwen',0,NULL,NULL,NULL,'2026-07-20','2026-07-20')`
    )
    .run(structured);
  database
    .prepare(
      `INSERT INTO ai_analysis_results (id, owner_id, level, period_id, timezone_id, local_start, local_end, period_start_utc, period_end_utc, boundary_policy_version, version, status, stale_reason, source_revision_hash, statistics_json, structured_result_json, readable_summary, prompt_id, prompt_version, schema_version, generation_metadata_json, provider_profile_id, provider_id, model_id, fallback_used, usage_record_id, estimated_cost_usd, job_id, created_at, updated_at) VALUES ('result','owner','weekly','2026-W30','UTC','2026-07-20','2026-07-27','2026-07-20T00:00:00.000Z','2026-07-27T00:00:00.000Z','calendar-v1',2,'stale','Daily changed','hash','{}',?,'Weekly summary','weekly','1.0.0','1','{}','profile','ollama','qwen',1,'usage',42,'job','2026-07-21','2026-07-21')`
    )
    .run(structured);
  database
    .prepare(
      "INSERT INTO ai_analysis_child_sources VALUES ('result','owner','daily-child','daily','2026-07-21',1,'ai_memories')"
    )
    .run();
  database
    .prepare(
      "INSERT INTO ai_analysis_log_sources VALUES ('result','owner','check','check','rev','2026-07-21T10:00:00.000Z')"
    )
    .run();
  return { database, read: new AnalysisReadService(database, 'owner') };
}

describe('analysis read service', () => {
  it('returns safe version and result disclosure without secret-bearing internals', () => {
    const { database, read } = fixture();
    const list = read.list('weekly');
    expect(list[0]).toMatchObject({
      id: 'result',
      status: 'stale',
      fallbackUsed: true,
      costMicros: '42',
      totalTokens: 23
    });
    const result = read.get('result');
    expect(result.history).toHaveLength(2);
    expect(result.children).toEqual([
      { id: 'daily-child', level: 'daily', periodId: '2026-07-21', version: 1, status: null }
    ]);
    expect(result.evidence[0]).toMatchObject({
      available: true,
      preview: expect.stringContaining('Visible evidence')
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('lease');
    expect(serialized).not.toContain('Authorization');
    expect(serialized).not.toContain('raw prompt');
    database.close();
  });

  it('rejects invalid levels and cross-owner result reads', () => {
    const { database, read } = fixture();
    database
      .prepare(
        `INSERT INTO ai_analysis_results (id, owner_id, level, period_id, timezone_id, local_start, local_end, period_start_utc, period_end_utc, boundary_policy_version, version, status, source_revision_hash, statistics_json, structured_result_json, readable_summary, prompt_id, prompt_version, schema_version, generation_metadata_json, created_at, updated_at) VALUES ('other-result','other','weekly','2026-W30','UTC','2026-07-20','2026-07-27','2026-07-20','2026-07-27','calendar-v1',1,'current','x','{}','{}','Other','weekly','1','1','{}','2026-07-21','2026-07-21')`
      )
      .run();
    expect(() => read.list('bad')).toThrow('valid analysis level');
    expect(() => read.get('other-result')).toThrow('unavailable');
    database.close();
  });
});
