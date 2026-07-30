import { describe, expect, it } from 'vitest';
import { openDesktopDatabase } from '../database/database.js';
import { ExecutionPolicyService } from './execution-policy-service.js';

describe('attempt-time execution policy', () => {
  it('revalidates kill switches, local privacy, and cloud consent', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    const policy = new ExecutionPolicyService(db, 'owner');
    expect(() =>
      policy.assertAllowed({
        providerId: 'openai',
        profileId: 'cloud',
        privacyMode: 'LOCAL',
        consented: true
      })
    ).toThrow('Local privacy');
    expect(() =>
      policy.assertAllowed({
        providerId: 'openai',
        profileId: 'cloud',
        privacyMode: 'CLOUD',
        consented: false
      })
    ).toThrow('consent');
    policy.set('provider', 'local', true);
    expect(() =>
      policy.assertAllowed({
        providerId: 'ollama',
        profileId: 'local',
        privacyMode: 'LOCAL',
        consented: true
      })
    ).toThrow('disabled');
    db.close();
  });
  it('reads current profile, privacy, consent and persisted switch state for each attempt', () => {
    const db = openDesktopDatabase(':memory:');
    db.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
    db.prepare(
      "INSERT INTO ai_provider_profiles (id,owner_id,name,provider_id,enabled,generation_model,created_at,updated_at) VALUES ('cloud','owner','Cloud','openai',1,'gpt','2026-01-01','2026-01-01')"
    ).run();
    db.prepare(
      "INSERT INTO ai_settings (owner_id,mode,updated_at) VALUES ('owner','CLOUD','2026-01-01')"
    ).run();
    const policy = new ExecutionPolicyService(db, 'owner');
    expect(() => policy.assertCurrentAttempt('cloud')).toThrow('consent');
    db.prepare(
      "INSERT INTO ai_cloud_consents VALUES ('consent','owner','cloud','CLOUD','2026-01-01')"
    ).run();
    expect(policy.assertCurrentAttempt('cloud')).toEqual({
      providerId: 'openai',
      privacyMode: 'CLOUD'
    });
    policy.set('global', '', true, 'maintenance');
    expect(() => policy.assertCurrentAttempt('cloud')).toThrow('disabled');
    expect(policy.read()).toEqual([
      { scope: 'global', targetId: '', enabled: true, reason: 'maintenance' }
    ]);
    db.close();
  });
});
