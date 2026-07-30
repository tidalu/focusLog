import 'package:flutter/material.dart';

import 'mobile_ai_repository.dart';

class MobileAIPlaygroundScreen extends StatefulWidget {
  const MobileAIPlaygroundScreen({super.key, required this.repository});

  final MobileAIRepository repository;

  @override
  State<MobileAIPlaygroundScreen> createState() =>
      _MobileAIPlaygroundScreenState();
}

class _MobileAIPlaygroundScreenState extends State<MobileAIPlaygroundScreen> {
  late Future<_PlaygroundViewModel> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_PlaygroundViewModel> _load() async {
    final sessions = await widget.repository.listPlaygroundSessions();
    return _PlaygroundViewModel(
      decision: widget.repository.playgroundDecision(),
      sessions: sessions,
      evaluations: await widget.repository.listPlaygroundEvaluations(),
      diagnostics: await widget.repository.mobileDiagnosticsBundle(),
      exportPreview: await widget.repository.safePlaygroundExportPreview(
        includeSessions: true,
        includeEvaluations: true,
        includeDiagnostics: true,
      ),
    );
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  @override
  Widget build(BuildContext context) => Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'AI Playground',
                    style: Theme.of(context)
                        .textTheme
                        .headlineSmall
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  Text(
                    'Desktop-only execution with mobile-safe shared metadata.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Refresh Playground',
              onPressed: _refresh,
              icon: const Icon(Icons.refresh),
            ),
          ]),
        ),
        Expanded(
          child: FutureBuilder<_PlaygroundViewModel>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return const Center(
                  child: Text('Playground metadata is unavailable.'),
                );
              }
              final data = snapshot.data!;
              return RefreshIndicator(
                onRefresh: _refresh,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                    _DecisionCard(decision: data.decision),
                    const SizedBox(height: 12),
                    _SessionsCard(sessions: data.sessions),
                    const SizedBox(height: 12),
                    _EvaluationCard(evaluations: data.evaluations),
                    const SizedBox(height: 12),
                    _DiagnosticsCard(
                      diagnostics: data.diagnostics,
                      exportPreview: data.exportPreview,
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

class _PlaygroundViewModel {
  const _PlaygroundViewModel({
    required this.decision,
    required this.sessions,
    required this.evaluations,
    required this.diagnostics,
    required this.exportPreview,
  });

  final MobileAIPlaygroundDecision decision;
  final List<MobileAIPlaygroundSession> sessions;
  final List<MobileAIPlaygroundEvaluation> evaluations;
  final Map<String, Object?> diagnostics;
  final Map<String, Object?> exportPreview;
}

class _DecisionCard extends StatelessWidget {
  const _DecisionCard({required this.decision});
  final MobileAIPlaygroundDecision decision;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Mobile Playground decision',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text('Scope: ${decision.scope}'),
            Text(decision.reason),
            const SizedBox(height: 8),
            const Text(
              'Android can inspect synchronized sessions and diagnostics, but cannot run prompts, edit production prompts, compare models, or promote Playground data into production memory.',
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Chip(
                  label: Text(decision.mobileExecutionSupported
                      ? 'Mobile execution enabled'
                      : 'Execution requires desktop'),
                ),
                Chip(
                  label: Text(decision.readOnlySharedSessions
                      ? 'Read-only shared sessions'
                      : 'No mobile session access'),
                ),
              ],
            ),
          ]),
        ),
      );
}

class _SessionsCard extends StatelessWidget {
  const _SessionsCard({required this.sessions});
  final List<MobileAIPlaygroundSession> sessions;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Shared sessions',
                style: Theme.of(context).textTheme.titleMedium),
            if (sessions.isEmpty)
              const Text('No synchronized Playground sessions.')
            else
              for (final session in sessions)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(session.title),
                  subtitle: Text(
                    '${session.status}; messages ${session.messageCount}; runs ${session.runCount}; branches ${session.branchCount}\n'
                    '${session.provider}/${session.model}; latest ${session.latestRunStatus}; ${session.costMicros} micro-usd',
                  ),
                ),
          ]),
        ),
      );
}

class _EvaluationCard extends StatelessWidget {
  const _EvaluationCard({required this.evaluations});
  final List<MobileAIPlaygroundEvaluation> evaluations;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Evaluation and comparison',
                style: Theme.of(context).textTheme.titleMedium),
            const Text(
              'Scores are deterministic unless explicitly labelled subjective; one run is not model superiority.',
            ),
            if (evaluations.isEmpty)
              const Text('No synchronized evaluation summaries.')
            else
              for (final evaluation in evaluations)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(evaluation.dataset),
                  subtitle: Text(
                    '${evaluation.status}; score ${evaluation.deterministicScore}; subjective ${evaluation.subjectiveLabel}\n'
                    '${evaluation.versionSummary}; ${evaluation.costMicros} micro-usd',
                  ),
                ),
          ]),
        ),
      );
}

class _DiagnosticsCard extends StatelessWidget {
  const _DiagnosticsCard({
    required this.diagnostics,
    required this.exportPreview,
  });
  final Map<String, Object?> diagnostics;
  final Map<String, Object?> exportPreview;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Diagnostics and exchange',
                style: Theme.of(context).textTheme.titleMedium),
            Text('Executor: ${diagnostics['executorAvailability']}'),
            Text('Pending outbox: ${diagnostics['pendingOutboxActions']}'),
            Text('Schema: ${diagnostics['mobileSchemaVersion']}'),
            Text('Playground switch: ${diagnostics['playgroundSwitchEnabled']}'),
            const SizedBox(height: 8),
            Text('Export format: ${exportPreview['format']}'),
            const Text(
              'Exports and diagnostics exclude credentials, raw prompts, raw provider responses, authorization data, and production data by default.',
            ),
          ]),
        ),
      );
}
