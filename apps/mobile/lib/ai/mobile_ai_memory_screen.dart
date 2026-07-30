import 'package:flutter/material.dart';

import '../design/focuslog_mobile_design.dart';
import 'mobile_ai_repository.dart';

class MobileAIMemoryScreen extends StatefulWidget {
  const MobileAIMemoryScreen({super.key, required this.repository});

  final MobileAIRepository repository;

  @override
  State<MobileAIMemoryScreen> createState() => _MobileAIMemoryScreenState();
}

class _MobileAIMemoryScreenState extends State<MobileAIMemoryScreen> {
  final _search = TextEditingController();
  final _question = TextEditingController();
  String _mode = 'hybrid';
  late Future<_MemoryViewModel> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _search.dispose();
    _question.dispose();
    super.dispose();
  }

  Future<_MemoryViewModel> _load() async => _MemoryViewModel(
        status: await widget.repository.memoryStatus(),
        results: await widget.repository.searchMemory(
          query: _search.text,
          mode: _mode,
          limit: 20,
        ),
        facts: await widget.repository.listFacts(limit: 20),
        nodes: await widget.repository.listGraphNodes(limit: 20),
        answers: await widget.repository.listMemoryAnswers(limit: 10),
      );

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _askQuestion() async {
    final operationId = await widget.repository.queueMemoryQuestion(
      question: _question.text,
      mode: _mode,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Memory Q&A request queued: $operationId')),
    );
    await _refresh();
  }

  @override
  Widget build(BuildContext context) => Column(children: [
        FocusLogPageHeader(
          eyebrow: 'Local-first derived memory',
          title: 'AI memory',
          description:
              'Synchronized semantic search, facts, graph evidence, and Q&A without raw vectors or prompts.',
          action: IconButton(
            tooltip: 'Refresh memory',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ),
        Expanded(
          child: FutureBuilder<_MemoryViewModel>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const _MemoryState(
                  icon: Icons.hourglass_empty,
                  title: 'Loading memory',
                  body: 'Reading synchronized safe cache.',
                );
              }
              if (snapshot.hasError) {
                return const _MemoryState(
                  icon: Icons.error_outline,
                  title: 'Memory unavailable',
                  body:
                      'FocusLog could not read the mobile memory projection.',
                );
              }
              final data = snapshot.data!;
              return RefreshIndicator(
                onRefresh: _refresh,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 108),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                    _NamespaceCard(
                      status: data.status,
                      onControl: (action) async {
                        await widget.repository.queueMemoryControl(
                          action: action,
                          namespaceId: data.status.activeNamespace,
                        );
                        await _refresh();
                      },
                    ),
                    const SizedBox(height: 12),
                    _SearchCard(
                      controller: _search,
                      mode: _mode,
                      onMode: (value) => setState(() => _mode = value),
                      onSearch: _refresh,
                      results: data.results,
                    ),
                    const SizedBox(height: 12),
                    _FactsCard(
                      facts: data.facts,
                      onReject: (factId) async {
                        await widget.repository.queueFactReject(factId);
                        await _refresh();
                      },
                      onReextract: (factId) async {
                        await widget.repository.queueFactReextract(factId);
                        await _refresh();
                      },
                      onCorrect: (fact) async {
                        await widget.repository.queueFactCorrection(
                          factId: fact.id,
                          correction: {
                            'subject': fact.subject,
                            'predicate': fact.predicate,
                            'value': fact.value,
                            'curatedOverlay': true,
                          },
                        );
                        await _refresh();
                      },
                    ),
                    const SizedBox(height: 12),
                    _GraphCard(
                      nodes: data.nodes,
                      onAction: (action, id) async {
                        await widget.repository.queueGraphAction(
                          action: action,
                          nodeOrEdgeId: id,
                        );
                        await _refresh();
                      },
                    ),
                    const SizedBox(height: 12),
                    _QACard(
                      controller: _question,
                      answers: data.answers,
                      onAsk: _askQuestion,
                    ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ]);
}

class _MemoryViewModel {
  const _MemoryViewModel({
    required this.status,
    required this.results,
    required this.facts,
    required this.nodes,
    required this.answers,
  });

  final MobileMemoryStatus status;
  final List<MobileMemorySearchResult> results;
  final List<MobileMemoryFact> facts;
  final List<MobileGraphNode> nodes;
  final List<MobileMemoryAnswer> answers;
}

class _NamespaceCard extends StatelessWidget {
  const _NamespaceCard({required this.status, required this.onControl});
  final MobileMemoryStatus status;
  final Future<void> Function(String action) onControl;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Namespace status',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: [
              _Chip(label: 'Active: ${status.activeNamespace}'),
              _Chip(label: 'Coverage: ${status.coverage}'),
              _Chip(label: 'Provider: ${status.provider}'),
              _Chip(label: 'Model: ${status.model}'),
              _Chip(label: 'Pending jobs: ${status.pendingJobs}'),
              _Chip(label: 'Failed jobs: ${status.failedJobs}'),
              _Chip(label: 'Stale: ${status.staleCount}'),
              _Chip(label: 'Storage: ${status.storageBytes} bytes'),
            ]),
            const SizedBox(height: 8),
            Wrap(spacing: 8, children: [
              FilledButton.tonal(
                onPressed: () => onControl(status.paused ? 'resume' : 'pause'),
                child: Text(status.paused ? 'Resume indexing' : 'Pause indexing'),
              ),
              FilledButton.tonal(
                onPressed: () => onControl('rebuild'),
                child: const Text('Request rebuild'),
              ),
              OutlinedButton(
                onPressed: () => onControl('delete'),
                child: const Text('Delete derived memory'),
              ),
            ]),
            Text(
              'Heavy embedding, fact, graph, and retrieval work runs on the authoritative desktop/backend executor.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ]),
        ),
      );
}

class _SearchCard extends StatelessWidget {
  const _SearchCard({
    required this.controller,
    required this.mode,
    required this.onMode,
    required this.onSearch,
    required this.results,
  });
  final TextEditingController controller;
  final String mode;
  final ValueChanged<String> onMode;
  final Future<void> Function() onSearch;
  final List<MobileMemorySearchResult> results;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Semantic and hybrid search',
                style: Theme.of(context).textTheme.titleMedium),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  decoration: const InputDecoration(
                    labelText: 'Query synchronized memory',
                  ),
                ),
              ),
              const SizedBox(width: 8),
              DropdownButton<String>(
                value: mode,
                items: const [
                  DropdownMenuItem(value: 'hybrid', child: Text('Hybrid')),
                  DropdownMenuItem(value: 'semantic', child: Text('Semantic')),
                  DropdownMenuItem(value: 'keyword', child: Text('Keyword')),
                  DropdownMenuItem(value: 'all', child: Text('All')),
                ],
                onChanged: (value) {
                  if (value != null) onMode(value);
                },
              ),
            ]),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: () => onSearch(),
                child: const Text('Search cache'),
              ),
            ),
            if (results.isEmpty)
              const Text('No synchronized memory results match this query.')
            else
              for (final result in results)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(result.excerpt),
                  subtitle: Text(
                    '${result.mode}; score ${result.score}; ${result.sourceType}; ${result.timestamp}\n'
                    'Namespace ${result.namespace}; model ${result.model}; ${result.staleState}',
                  ),
                ),
          ]),
        ),
      );
}

class _FactsCard extends StatelessWidget {
  const _FactsCard({
    required this.facts,
    required this.onReject,
    required this.onReextract,
    required this.onCorrect,
  });
  final List<MobileMemoryFact> facts;
  final Future<void> Function(String factId) onReject;
  final Future<void> Function(String factId) onReextract;
  final Future<void> Function(MobileMemoryFact fact) onCorrect;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Facts', style: Theme.of(context).textTheme.titleMedium),
            if (facts.isEmpty)
              const Text('No evidence-backed facts synchronized yet.')
            else
              for (final fact in facts)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('${fact.subject} ${fact.predicate} ${fact.value}'),
                  subtitle: Text(
                    '${fact.status}; confidence ${fact.confidence}; ${fact.staleState}\n'
                    'Evidence ${fact.evidence.length}; ${fact.provider}/${fact.model}',
                  ),
                  trailing: Wrap(spacing: 2, children: [
                    IconButton(
                      tooltip: 'Reject fact',
                      onPressed: () => onReject(fact.id),
                      icon: const Icon(Icons.block),
                    ),
                    IconButton(
                      tooltip: 'Correct fact',
                      onPressed: () => onCorrect(fact),
                      icon: const Icon(Icons.edit_outlined),
                    ),
                    IconButton(
                      tooltip: 'Re-extract fact',
                      onPressed: () => onReextract(fact.id),
                      icon: const Icon(Icons.refresh),
                    ),
                  ]),
                ),
          ]),
        ),
      );
}

class _GraphCard extends StatelessWidget {
  const _GraphCard({required this.nodes, required this.onAction});
  final List<MobileGraphNode> nodes;
  final Future<void> Function(String action, String id) onAction;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Knowledge graph',
                style: Theme.of(context).textTheme.titleMedium),
            if (nodes.isEmpty)
              const Text('No graph nodes synchronized yet.')
            else
              for (final node in nodes)
                ExpansionTile(
                  tilePadding: EdgeInsets.zero,
                  title: Text(node.label),
                  subtitle: Text(
                    '${node.type}; ${node.status}; confidence ${node.confidence}',
                  ),
                  children: [
                    Text(
                      'Neighbors: ${node.neighbors.map((item) => item['label'] ?? item['id']).join(', ')}',
                    ),
                    Text('Evidence: ${node.evidence.length} item(s)'),
                    Wrap(spacing: 8, children: [
                      TextButton(
                        onPressed: () => onAction('merge', node.id),
                        child: const Text('Merge request'),
                      ),
                      TextButton(
                        onPressed: () => onAction('split', node.id),
                        child: const Text('Split request'),
                      ),
                      TextButton(
                        onPressed: () => onAction('remove', node.id),
                        child: const Text('Remove request'),
                      ),
                      TextButton(
                        onPressed: () => onAction('rebuild', node.id),
                        child: const Text('Rebuild request'),
                      ),
                    ]),
                  ],
                ),
          ]),
        ),
      );
}

class _QACard extends StatelessWidget {
  const _QACard({
    required this.controller,
    required this.answers,
    required this.onAsk,
  });
  final TextEditingController controller;
  final List<MobileMemoryAnswer> answers;
  final Future<void> Function() onAsk;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Evidence-backed Q&A',
                style: Theme.of(context).textTheme.titleMedium),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'Ask about your synchronized memory',
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: () => onAsk(),
                child: const Text('Queue Q&A request'),
              ),
            ),
            if (answers.isEmpty)
              const Text('Q&A requires synchronized retrieval service results.')
            else
              for (final answer in answers)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(answer.question),
                  subtitle: Text(
                    '${answer.answer}\n${answer.provider}/${answer.model}; fallback ${answer.fallbackUsed}; '
                    'uncertainty ${answer.uncertainty}; stale ${answer.staleDisclosure}; evidence ${answer.evidence.length}',
                  ),
                ),
          ]),
        ),
      );
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Chip(
        visualDensity: VisualDensity.compact,
        label: Text(label),
      );
}

class _MemoryState extends StatelessWidget {
  const _MemoryState({
    required this.icon,
    required this.title,
    required this.body,
  });
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 40),
            const SizedBox(height: 12),
            Text(title, textAlign: TextAlign.center),
            const SizedBox(height: 6),
            Text(body, textAlign: TextAlign.center),
          ]),
        ),
      );
}
