import React, { useCallback, useEffect, useMemo, useState } from 'react';

type Overview = Awaited<ReturnType<Window['focuslog']['aiMemoryOverview']>>;
type SearchResult = Awaited<ReturnType<Window['focuslog']['aiMemorySearch']>>;
type Fact = Awaited<ReturnType<Window['focuslog']['aiMemoryFacts']>>[number];
type Graph = Awaited<ReturnType<Window['focuslog']['aiMemoryGraph']>>;
type Subsystem = 'embeddings' | 'facts' | 'graph' | 'retrieval';

const secretPattern =
  /api[_-]?key|authorization|lease[_-]?token|reservation[_-]?owner|raw prompt|raw provider/iu;

function safeText(value: string): string {
  return secretPattern.test(value) ? '[redacted]' : value;
}

export function MemoryOverviewPanel({ overview }: { overview: Overview }): React.JSX.Element {
  const namespace = overview.activeNamespace;
  return (
    <section className="panel memory-panel" aria-labelledby="memory-overview-title">
      <div className="section-heading">
        <div>
          <span className="section-label">AI Memory</span>
          <h2 id="memory-overview-title">Overview</h2>
        </div>
        <span className="status-pill">
          {namespace ? namespace.coverageStatus : 'No active namespace'}
        </span>
      </div>
      <div className="metric-grid">
        <div>
          <span>Facts</span>
          <strong>{overview.counts.facts}</strong>
        </div>
        <div>
          <span>Graph nodes</span>
          <strong>{overview.counts.graphNodes}</strong>
        </div>
        <div>
          <span>Graph edges</span>
          <strong>{overview.counts.graphEdges}</strong>
        </div>
        <div>
          <span>Stale memory</span>
          <strong>{overview.counts.staleMemory}</strong>
        </div>
      </div>
      {namespace ? (
        <dl className="settings-list">
          <div>
            <dt>Namespace</dt>
            <dd>{namespace.name}</dd>
          </div>
          <div>
            <dt>Provider/model</dt>
            <dd>
              {namespace.providerId} / {namespace.modelId}
            </dd>
          </div>
          <div>
            <dt>Dimensions</dt>
            <dd>{namespace.dimensions}</dd>
          </div>
          <div>
            <dt>Coverage</dt>
            <dd>
              {namespace.coverageIndexedChunks} / {namespace.coverageExpectedChunks} chunks
            </dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>{namespace.storageBytes} bytes</dd>
          </div>
          <div>
            <dt>Last indexing</dt>
            <dd>{namespace.lastIndexingAt ?? 'Not completed yet'}</dd>
          </div>
        </dl>
      ) : (
        <p className="muted">Create or rebuild a namespace to enable semantic search.</p>
      )}
      <div className="queue-summary" aria-label="Indexing progress">
        <span>{overview.indexing.pending} pending chunks</span>
        <span>{overview.indexing.failed} failed chunks</span>
      </div>
      {overview.diagnostics.length > 0 && (
        <ul className="status-list" aria-label="Memory diagnostics">
          {overview.diagnostics.map((diagnostic) => (
            <li key={`${diagnostic.code}-${diagnostic.createdAt}`}>
              <strong>{diagnostic.code}</strong> {safeText(diagnostic.message)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MemorySearchPanel({ search }: { search: SearchResult | null }): React.JSX.Element {
  return (
    <section className="panel memory-panel" aria-labelledby="memory-search-title">
      <div className="section-heading">
        <div>
          <span className="section-label">Semantic, hybrid, keyword</span>
          <h2 id="memory-search-title">Search results</h2>
        </div>
        <span className="status-pill">{search?.mode ?? 'idle'}</span>
      </div>
      {!search ? (
        <p className="muted">
          Run a search to inspect retrieved evidence, namespace/model disclosure, and exclusion
          reasons.
        </p>
      ) : (
        <>
          <p className="muted">
            Namespace {search.namespace?.id ?? 'unavailable'} · Model{' '}
            {search.namespace?.modelId ?? 'unavailable'} · Plan {search.planId}
          </p>
          <ul className="status-list" aria-label="Retrieval explanation">
            {search.explanation.map((item) => (
              <li key={item}>{safeText(item)}</li>
            ))}
          </ul>
          {search.results.length === 0 ? (
            <p className="empty-state">No available authorized memory matched this query.</p>
          ) : (
            <div className="result-stack">
              {search.results.map((result) => (
                <article className="analysis-card" key={result.id}>
                  <div className="card-heading">
                    <h3>{safeText(result.title)}</h3>
                    <span>
                      {result.sourceType} · score {result.score.toFixed(2)}
                    </span>
                  </div>
                  <p>{safeText(result.excerptRedacted)}</p>
                  <p className="muted">
                    {result.staleState} · {result.classification} · {result.tokenEstimate} tokens
                    {result.openSource ? ` · open source ${result.openSource.checkInId}` : ''}
                  </p>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function MemoryFactCard({ fact }: { fact: Fact }): React.JSX.Element {
  return (
    <article className="analysis-card">
      <div className="card-heading">
        <h3>{safeText(fact.subject)}</h3>
        <span>
          {fact.status} · confidence {fact.confidence}
        </span>
      </div>
      <p>
        {safeText(fact.predicate)}: {safeText(fact.objectValue)}
      </p>
      <p className="muted">
        {fact.origin === 'user_overlay' ? 'User-curated overlay' : 'Automated extraction'} ·{' '}
        {fact.evidenceCount} evidence item(s) · {fact.providerProfileId ?? 'no provider'} /{' '}
        {fact.modelId ?? 'no model'}
      </p>
    </article>
  );
}

export function MemoryGraphPanel({ graph }: { graph: Graph }): React.JSX.Element {
  return (
    <section className="panel memory-panel" aria-labelledby="memory-graph-title">
      <div className="section-heading">
        <div>
          <span className="section-label">Knowledge graph</span>
          <h2 id="memory-graph-title">Graph inspection</h2>
        </div>
        <span className="status-pill">{graph.nodes.length} nodes</span>
      </div>
      {graph.nodes.length === 0 ? (
        <p className="empty-state">No graph entities are currently available.</p>
      ) : (
        <div className="result-stack">
          {graph.nodes.map((node) => (
            <article className="analysis-card" key={node.id}>
              <h3>{safeText(node.name)}</h3>
              <p className="muted">
                {node.type} · {node.status} · confidence {node.confidence}
              </p>
            </article>
          ))}
        </div>
      )}
      <ul className="status-list" aria-label="Graph relation evidence">
        {graph.edges.map((edge) => (
          <li key={edge.id}>
            {safeText(edge.source)} {edge.predicate} {safeText(edge.target)} · {edge.status} ·{' '}
            {edge.evidenceCount} evidence item(s)
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AIMemoryPage({ notify }: { notify: (message: string) => void }): React.JSX.Element {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [graph, setGraph] = useState<Graph>({ nodes: [], edges: [] });
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'semantic' | 'hybrid' | 'keyword'>('hybrid');
  const [factFilter, setFactFilter] = useState('');
  const [graphFilter, setGraphFilter] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextOverview, nextFacts, nextGraph] = await Promise.all([
        window.focuslog.aiMemoryOverview(),
        window.focuslog.aiMemoryFacts({ query: factFilter || undefined, limit: 25 }),
        window.focuslog.aiMemoryGraph({ query: graphFilter || undefined, limit: 40 })
      ]);
      setOverview(nextOverview);
      setFacts(nextFacts);
      setGraph(nextGraph);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? safeText(err.message) : 'Memory controls are unavailable.');
    } finally {
      setLoading(false);
    }
  }, [factFilter, graphFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subsystemEntries = useMemo(
    () => Object.entries(overview?.subsystems ?? {}) as Array<[Subsystem, boolean]>,
    [overview]
  );

  async function runSearch(): Promise<void> {
    if (!query.trim()) return;
    try {
      setSearch(await window.focuslog.aiMemorySearch({ query, mode, limit: 20 }));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? safeText(err.message) : 'Search failed safely.');
    }
  }

  async function rejectFact(fact: Fact): Promise<void> {
    await window.focuslog.aiMemoryRejectFact(fact.id, 'Rejected from Memory UI');
    notify('Fact rejected; extraction history is preserved.');
    await refresh();
  }

  async function correctFact(fact: Fact): Promise<void> {
    const corrected = await window.focuslog.aiMemoryCorrectFact(fact.id, {
      subject: fact.subject,
      predicate: fact.predicate,
      objectValue: fact.objectValue,
      factType: 'custom',
      confidence: 1,
      reason: 'Corrected from Memory UI'
    });
    notify(`Created user-curated correction ${corrected.id}.`);
    await refresh();
  }

  return (
    <div className="page memory-page">
      <div className="page-title">
        <span className="eyebrow">Local-first derived memory</span>
        <h1>AI Memory</h1>
        <p>
          Inspect semantic search, facts, graph evidence, stale state, and derived-memory controls
          without exposing raw vectors, prompts, credentials, leases, or reservation internals.
        </p>
      </div>

      {loading && (
        <section className="panel" role="status">
          Loading AI memory controls…
        </section>
      )}
      {error && (
        <section className="panel danger" role="alert">
          {error}
        </section>
      )}
      {overview && <MemoryOverviewPanel overview={overview} />}

      <section className="panel memory-panel" aria-labelledby="memory-controls-title">
        <div className="section-heading">
          <div>
            <span className="section-label">Controls</span>
            <h2 id="memory-controls-title">Subsystem switches and safe rebuild/delete</h2>
          </div>
        </div>
        <div className="switch-grid">
          {subsystemEntries.map(([name, enabled]) => (
            <label className="switch" key={name}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={async (event) => {
                  setOverview(
                    await window.focuslog.aiMemorySetSubsystem({
                      subsystem: name,
                      enabled: event.target.checked
                    })
                  );
                  notify(`${name} ${event.target.checked ? 'enabled' : 'paused'}.`);
                }}
              />
              <span>{name}</span>
            </label>
          ))}
        </div>
        <div className="action-row">
          <button
            onClick={async () =>
              notify(
                (await window.focuslog.aiMemoryRebuildNamespace()).queued
                  ? 'Namespace rebuild queued through durable queue.'
                  : 'No active namespace to rebuild.'
              )
            }
          >
            Rebuild active namespace
          </button>
          <button
            onClick={async () =>
              notify(
                `Prepared safe memory export v${(await window.focuslog.aiMemoryExport()).schemaVersion}.`
              )
            }
          >
            Prepare safe export
          </button>
        </div>
        <label>
          <span>
            Type DELETE DERIVED MEMORY to remove derived facts/graph or embeddings. Canonical logs
            are not deleted here.
          </span>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            aria-label="Derived memory deletion confirmation"
          />
        </label>
        <div className="action-row">
          <button
            className="danger-button"
            onClick={async () => {
              setOverview(
                await window.focuslog.aiMemoryDeleteDerived({ target: 'embeddings', confirmation })
              );
              notify('Derived embeddings deleted; canonical logs remain.');
            }}
          >
            Delete embeddings
          </button>
          <button
            className="danger-button"
            onClick={async () => {
              setOverview(
                await window.focuslog.aiMemoryDeleteDerived({ target: 'facts_graph', confirmation })
              );
              setFacts([]);
              setGraph({ nodes: [], edges: [] });
              notify('Derived facts and graph deleted; canonical logs remain.');
            }}
          >
            Delete facts and graph
          </button>
        </div>
      </section>

      <section className="panel memory-panel" aria-labelledby="memory-search-form-title">
        <h2 id="memory-search-form-title">Semantic search</h2>
        <div className="filter-row">
          <label>
            <span>Query</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label>
            <span>Mode</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
              <option value="hybrid">Hybrid</option>
              <option value="semantic">Semantic</option>
              <option value="keyword">Keyword</option>
            </select>
          </label>
          <button onClick={() => void runSearch()}>Search memory</button>
        </div>
      </section>
      <MemorySearchPanel search={search} />

      <section className="panel memory-panel" aria-labelledby="memory-facts-title">
        <div className="section-heading">
          <div>
            <span className="section-label">Facts</span>
            <h2 id="memory-facts-title">Fact inspection and correction</h2>
          </div>
          <label>
            <span>Filter</span>
            <input value={factFilter} onChange={(event) => setFactFilter(event.target.value)} />
          </label>
        </div>
        {facts.length === 0 ? (
          <p className="empty-state">No facts match the current filter.</p>
        ) : (
          <div className="result-stack">
            {facts.map((fact) => (
              <div key={fact.id}>
                <MemoryFactCard fact={fact} />
                <div className="action-row">
                  <button onClick={() => void rejectFact(fact)}>Reject</button>
                  <button onClick={() => void correctFact(fact)}>Create correction overlay</button>
                  <button
                    onClick={async () =>
                      notify(
                        `Re-extract requested for ${fact.id} through derived-memory queue policy.`
                      )
                    }
                  >
                    Re-extract
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel memory-panel" aria-labelledby="memory-graph-filter-title">
        <div className="section-heading">
          <div>
            <span className="section-label">Graph</span>
            <h2 id="memory-graph-filter-title">Graph workflows</h2>
          </div>
          <label>
            <span>Filter</span>
            <input value={graphFilter} onChange={(event) => setGraphFilter(event.target.value)} />
          </label>
        </div>
        <button
          disabled={graph.nodes.length === 0}
          onClick={async () => {
            const first = graph.nodes[0];
            if (!first) return;
            const split = await window.focuslog.aiMemorySplitEntity({
              entityId: first.id,
              name: `${first.name} split`,
              type: first.type
            });
            notify(`Created split graph entity ${split.id}.`);
            await refresh();
          }}
        >
          Split first visible entity
        </button>
      </section>
      <MemoryGraphPanel graph={graph} />
    </div>
  );
}
