import { describe, expect, it } from 'vitest';

import { openDesktopDatabase } from '../database/database.js';
import { FactGraphService, type FactCandidate } from './fact-graph-service.js';
import { AIJobQueue } from './job-queue.js';
import { AIJobWorker } from './job-worker.js';

function fixture() {
  const database = openDesktopDatabase(':memory:');
  database.prepare("INSERT INTO owners VALUES ('owner','2026-01-01','2026-01-01')").run();
  database.prepare("INSERT INTO owners VALUES ('other','2026-01-01','2026-01-01')").run();
  const service = new FactGraphService(database, 'owner');
  return { database, service };
}

function addLog(
  database: ReturnType<typeof openDesktopDatabase>,
  id = 'log',
  body = 'FocusLog supports Playground prompts. api_key=SECRET'
) {
  database
    .prepare(
      "INSERT INTO check_ins (id, owner_id, current_revision_id, submitted_at, timezone_id, version, created_at, updated_at) VALUES (?, 'owner', ?, '2026-07-21T10:00:00.000Z', 'UTC', 'v1', '2026-07-21', '2026-07-21')"
    )
    .run(id, `${id}-rev`);
  database
    .prepare(
      'INSERT INTO check_in_revisions (id, check_in_id, body, operation_id, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(`${id}-rev`, id, body, `${id}-op`, '2026-07-21');
}

const fact = (overrides: Partial<FactCandidate> = {}): FactCandidate => ({
  subject: 'FocusLog',
  predicate: 'supports',
  objectValue: 'Playground prompts',
  factType: 'project',
  confidence: 0.82,
  evidenceRevisionIds: ['log-rev'],
  ...overrides
});

describe('FactGraphService', () => {
  it('requires valid evidence, rejects unsupported output, and redacts safe diagnostics', () => {
    const { database, service } = fixture();
    addLog(database);

    expect(() =>
      service.extractFactsFromSource('log', [fact({ evidenceRevisionIds: [] })])
    ).toThrow('evidence');
    expect(() => service.extractFactsFromSource('log', [fact({ predicate: 'leaks' })])).toThrow(
      'Unsupported fact predicate'
    );
    expect(() =>
      service.extractFactsFromSource('log', [fact({ evidenceRevisionIds: ['missing-rev'] })])
    ).toThrow('unsupported source revisions');

    const [created] = service.extractFactsFromSource('log', [fact()], {
      promptId: 'fact-extract',
      promptVersion: '1'
    });
    expect(created).toMatchObject({ subject: 'FocusLog', status: 'proposed', evidenceCount: 1 });
    service.updateGraphFromFact(created.id);
    expect(service.safeDiagnostics()).not.toContain('SECRET');
    database.close();
  });

  it('handles reinforcement, contradiction, temporal facts, rejection, correction overlay, and stale propagation', () => {
    const { database, service } = fixture();
    addLog(database);
    const [first] = service.extractFactsFromSource('log', [fact()]);
    const [same] = service.extractFactsFromSource('log', [fact({ confidence: 0.7 })]);
    const [conflict] = service.extractFactsFromSource('log', [
      fact({ objectValue: 'only local widgets' })
    ]);
    const [temporal] = service.extractFactsFromSource('log', [
      fact({
        subject: 'FocusLog beta',
        predicate: 'has_status',
        objectValue: 'temporary',
        factType: 'temporal',
        temporalQualifier: 'during July 2026'
      })
    ]);

    service.reconcileSubject('FocusLog');
    expect(service.fact(first.id).status).toBe('contradicted');
    expect(service.fact(same.id).status).toBe('superseded');
    expect(service.fact(conflict.id).status).toBe('contradicted');
    expect(service.fact(temporal.id).temporalQualifier).toBe('during July 2026');

    expect(service.rejectFact(conflict.id, 'User rejected this automated claim.').status).toBe(
      'rejected'
    );
    const corrected = service.correctFact(first.id, {
      ...fact({ objectValue: 'Playground prompt tooling', confidence: 1 }),
      reason: 'User correction'
    });
    expect(corrected).toMatchObject({ status: 'corrected', origin: 'user_overlay' });
    expect(service.markSourceStale('log')).toBeGreaterThan(0);
    expect(service.fact(corrected.id).status).toBe('stale');
    database.close();
  });

  it('creates evidence-backed graph records, stores conservative aliases, splits safely, and rejects alias cycles', () => {
    const { database, service } = fixture();
    addLog(database);
    const [created] = service.extractFactsFromSource('log', [fact()]);
    const graph = service.updateGraphFromFact(created.id);

    expect(graph.entities.length).toBe(1);
    expect(graph.relations).toHaveLength(1);
    expect(graph.relations[0]).toMatchObject({ predicate: 'supports', evidenceCount: 1 });

    const entityId = graph.entities[0]!.id;
    expect(service.resolveEntity(entityId, 'Focus Log', 0.6)).toBe(entityId);
    const split = service.splitEntity(entityId, 'FocusLog App', 'project');
    expect(split).not.toBe(entityId);
    expect(() =>
      service.createRelation({
        sourceName: 'FocusLog',
        sourceType: 'project',
        predicate: 'alias_of',
        targetName: 'FocusLog',
        targetType: 'project',
        confidence: 0.99,
        evidenceRevisionIds: ['log-rev']
      })
    ).toThrow('Cyclic alias');
    database.close();
  });

  it('runs fact and graph jobs through the durable worker without duplicate results', async () => {
    const { database, service } = fixture();
    addLog(database);
    const queue = new AIJobQueue(database, 'owner');
    const worker = new AIJobWorker(queue, service.queueHandlers(), {
      pollIntervalMs: 5,
      leaseDurationMs: 500,
      leaseRenewalMs: 50
    });
    const job = service.enqueue(
      queue,
      'fact_extract_source',
      { sourceId: 'log', candidates: [fact()] },
      'log'
    );
    const duplicate = service.enqueue(
      queue,
      'fact_extract_source',
      { sourceId: 'log', candidates: [fact()] },
      'log'
    );
    expect(duplicate.id).toBe(job.id);

    worker.start();
    worker.wake();
    await new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const current = queue.get(job.id);
        if (current?.status === 'succeeded') {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - started > 2_000) {
          clearInterval(timer);
          reject(new Error(`Timed out waiting for fact job, current=${current?.status}`));
        }
      }, 10);
    });
    await worker.stop();

    const facts = service.factsBySubject('FocusLog');
    expect(facts).toHaveLength(1);
    const graphJob = service.enqueue(
      queue,
      'graph_update_from_fact',
      { factId: facts[0]!.id },
      facts[0]!.id
    );
    worker.start();
    worker.wake();
    await new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const current = queue.get(graphJob.id);
        if (current?.status === 'succeeded') {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - started > 2_000) {
          clearInterval(timer);
          reject(new Error(`Timed out waiting for graph job, current=${current?.status}`));
        }
      }, 10);
    });
    await worker.stop();
    expect(service.graphProjection('FocusLog').relations).toHaveLength(1);
    database.close();
  });

  it('keeps owner isolation and excludes deleted evidence from active support', () => {
    const { database, service } = fixture();
    addLog(database);
    database.prepare("UPDATE check_ins SET deleted_at = '2026-07-22' WHERE id = 'log'").run();
    expect(() => service.extractFactsFromSource('log', [fact()])).toThrow(
      'Deleted source revisions'
    );
    expect(new FactGraphService(database, 'other').factsBySubject('FocusLog')).toHaveLength(0);
    database.close();
  });
});
