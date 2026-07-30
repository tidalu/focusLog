import { describe, expect, it } from 'vitest';
import { openDesktopDatabase } from '../database/database.js';
import { FallbackChainService } from './fallback-chain-service.js';

describe('fallback chain service', () => {
  it('validates local classification and snapshots immutable ordered entries', () => {
    const database = openDesktopDatabase(':memory:');
    database.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    const profile = database.prepare(
      `INSERT INTO ai_provider_profiles (id, owner_id, name, provider_id, enabled, generation_model, temperature, top_p, max_output_tokens, timeout_ms, retry_limit, concurrency_limit, automatic_analysis, priority, credential_configured, created_at, updated_at) VALUES (?, 'owner', ?, ?, 1, 'model', .2, 1, 10, 30000, 1, 1, 0, 1, 0, '2026-01-01', '2026-01-01')`
    );
    profile.run('local', 'Local', 'ollama');
    profile.run('cloud', 'Cloud', 'openai');
    const service = new FallbackChainService(database, 'owner');
    expect(() =>
      service.save({ name: 'bad', entries: [{ providerProfileId: 'cloud' }] }, 'LOCAL')
    ).toThrow('Local privacy');
    const id = service.save(
      { name: 'local', entries: [{ providerProfileId: 'local', maxSameProviderRetries: 1 }] },
      'LOCAL'
    );
    const first = service.snapshot(id, 'LOCAL');
    service.save(
      {
        name: 'local changed',
        entries: [{ providerProfileId: 'local', maxSameProviderRetries: 0 }]
      },
      'LOCAL',
      id
    );
    expect(first.entries[0]).toMatchObject({
      providerProfileId: 'local',
      maxSameProviderRetries: 1
    });
    expect(service.snapshot(id, 'LOCAL').entries[0]?.maxSameProviderRetries).toBe(0);
    database.close();
  });
  it('lists, reads, and deletes only chains not referenced by queued snapshots', () => {
    const database = openDesktopDatabase(':memory:');
    database.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    database
      .prepare(
        "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('p','owner','Local','ollama',1,'m','2026-01-01','2026-01-01')"
      )
      .run();
    const service = new FallbackChainService(database, 'owner');
    const id = service.save({ name: 'Editable', entries: [{ providerProfileId: 'p' }] }, 'LOCAL');
    expect(service.list()).toEqual([expect.objectContaining({ id, name: 'Editable' })]);
    expect(service.read(id)).toMatchObject({ id, entries: [{ providerProfileId: 'p' }] });
    expect(service.deleteUnused(id)).toBe(true);
    expect(service.read(id)).toBeNull();
    database.close();
  });
});
