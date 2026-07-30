import 'package:flutter/material.dart';

import '../design/focuslog_mobile_design.dart';
import 'mobile_ai_repository.dart';

class MobileAISecurityScreen extends StatefulWidget {
  const MobileAISecurityScreen({super.key, required this.repository});

  final MobileAIRepository repository;

  @override
  State<MobileAISecurityScreen> createState() => _MobileAISecurityScreenState();
}

class _MobileAISecurityScreenState extends State<MobileAISecurityScreen> {
  late Future<_MobileAISecurityViewModel> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_MobileAISecurityViewModel> _load() async =>
      _MobileAISecurityViewModel(
        review: await widget.repository.mobileSecurityReview(),
        resources: await widget.repository.mobileResourcePolicy(),
        performance: await widget.repository.mobilePerformanceSnapshot(),
        packaging: widget.repository.mobilePackagingReadiness(),
        releaseGate: await widget.repository.mobileReleaseGateSnapshot(),
        diagnostics: await widget.repository.mobileDiagnosticsBundle(),
      );

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  @override
  Widget build(BuildContext context) => Column(children: [
        FocusLogPageHeader(
          eyebrow: 'Private by design',
          title: 'AI safety',
          description:
              'Security, accessibility, resource limits, packaging readiness, and bounded diagnostics.',
          action: IconButton(
            tooltip: 'Refresh AI safety review',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ),
        Expanded(
          child: FutureBuilder<_MobileAISecurityViewModel>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const _SafetyState(
                  icon: Icons.hourglass_empty,
                  title: 'Loading AI safety review',
                  body:
                      'Reading bounded, privacy-safe diagnostics and thresholds.',
                );
              }
              if (snapshot.hasError) {
                return const _SafetyState(
                  icon: Icons.error_outline,
                  title: 'AI safety review unavailable',
                  body:
                      'FocusLog could not read the local safe diagnostics. No provider credentials or raw prompts are shown here.',
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
                    _SecurityReviewCard(review: data.review),
                    const SizedBox(height: 12),
                    _ResourceCard(resources: data.resources),
                    const SizedBox(height: 12),
                    _PerformanceCard(performance: data.performance),
                    const SizedBox(height: 12),
                    _PackagingCard(packaging: data.packaging),
                    const SizedBox(height: 12),
                    _ReleaseGateCard(releaseGate: data.releaseGate),
                    const SizedBox(height: 12),
                    _DiagnosticsCard(diagnostics: data.diagnostics),
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

class _MobileAISecurityViewModel {
  const _MobileAISecurityViewModel({
    required this.review,
    required this.resources,
    required this.performance,
    required this.packaging,
    required this.releaseGate,
    required this.diagnostics,
  });

  final MobileAISecurityReview review;
  final MobileAIResourcePolicy resources;
  final MobileAIPerformanceSnapshot performance;
  final MobileAIPackagingReadiness packaging;
  final MobileAIReleaseGateSnapshot releaseGate;
  final Map<String, Object?> diagnostics;
}

class _SecurityReviewCard extends StatelessWidget {
  const _SecurityReviewCard({required this.review});

  final MobileAISecurityReview review;

  @override
  Widget build(BuildContext context) => _SectionCard(
        title: 'Security and privacy review',
        children: [
          _KeyValue('Credential mode', review.credentialStorage),
          _KeyValue('Transport', review.cloudTransport),
          _KeyValue('Deep links', review.deepLinks),
          _KeyValue('Notifications', review.notifications),
          _KeyValue('Exports', review.exports),
          _KeyValue('Imports', review.imports),
          _KeyValue('Prompt-injection boundary', review.promptInjectionBoundary),
          _KeyValue('Platform configuration', review.platformConfiguration),
          _KeyValue('Screenshots and clipboard', review.screenshotAndClipboardPolicy),
          _KeyValue('Diagnostics', review.safeDiagnostics),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final finding in review.findings)
                Chip(label: Text(finding)),
              if (review.findings.isEmpty)
                const Chip(label: Text('No local release-blocking finding')),
            ],
          ),
        ],
      );
}

class _ResourceCard extends StatelessWidget {
  const _ResourceCard({required this.resources});

  final MobileAIResourcePolicy resources;

  @override
  Widget build(BuildContext context) => _SectionCard(
        title: 'Resource controls',
        children: [
          _KeyValue(
            'Cache',
            '${resources.currentCachedRecords}/${resources.maxCachedRecords} records',
          ),
          _KeyValue(
            'Outbox',
            '${resources.currentOutboxActions}/${resources.maxOutboxActions} actions',
          ),
          _KeyValue(
            'Diagnostics',
            '${resources.currentDiagnosticRows}/200 rows',
          ),
          _KeyValue('Response cap', '${resources.maxResponseBytes} bytes'),
          _KeyValue('Import cap', '${resources.maxImportBytes} bytes'),
          _KeyValue('Context preview cap',
              '${resources.maxContextPreviewBytes} bytes'),
          _KeyValue('Streaming buffer cap',
              '${resources.maxStreamingBufferBytes} bytes'),
          _KeyValue(
              'Background retry cap', '${resources.maxBackgroundRetries} attempts'),
          _KeyValue('Recovery', resources.recovery),
          Semantics(
            liveRegion: true,
            child: Chip(
              label: Text(resources.limitReached
                  ? 'Resource limit reached'
                  : 'Within resource limits'),
            ),
          ),
        ],
      );
}

class _PerformanceCard extends StatelessWidget {
  const _PerformanceCard({required this.performance});

  final MobileAIPerformanceSnapshot performance;

  @override
  Widget build(BuildContext context) => _SectionCard(
        title: 'Synthetic performance snapshot',
        children: [
          _KeyValue('Fixture', performance.fixture),
          _KeyValue('Synthetic data only', performance.syntheticDataOnly.toString()),
          _KeyValue('Analysis rows', performance.analysisRows.toString()),
          _KeyValue('Memory rows', performance.memoryRows.toString()),
          _KeyValue('Fact rows', performance.factRows.toString()),
          _KeyValue('Graph rows', performance.graphRows.toString()),
          _KeyValue('Pending jobs', performance.pendingJobRows.toString()),
          _KeyValue('Playground rows', performance.playgroundRows.toString()),
          _KeyValue('Startup threshold', '${performance.startupBudgetMs} ms'),
          _KeyValue('Navigation threshold', '${performance.navigationBudgetMs} ms'),
          _KeyValue('Search render threshold',
              '${performance.searchRenderBudgetMs} ms'),
          _KeyValue('Sync apply threshold', '${performance.syncApplyBudgetMs} ms'),
          _KeyValue('UI thread policy', performance.uiThreadPolicy),
          _KeyValue('Background policy', performance.backgroundPolicy),
        ],
      );
}

class _PackagingCard extends StatelessWidget {
  const _PackagingCard({required this.packaging});

  final MobileAIPackagingReadiness packaging;

  @override
  Widget build(BuildContext context) => _SectionCard(
        title: 'Packaging readiness',
        children: [
          _KeyValue('Android', packaging.androidTarget),
          _KeyValue('iOS', packaging.iosTarget),
          _KeyValue('Native dependencies', packaging.nativeDependencies.join(', ')),
          _KeyValue('Permissions', packaging.permissions.join(', ')),
          _KeyValue('Release exclusions', packaging.releaseExclusions.join(', ')),
          _KeyValue('Upgrade compatibility', packaging.upgradeCompatibility),
          _KeyValue('Install smoke', packaging.installSmokePreparedFor),
        ],
      );
}

class _ReleaseGateCard extends StatelessWidget {
  const _ReleaseGateCard({required this.releaseGate});

  final MobileAIReleaseGateSnapshot releaseGate;

  @override
  Widget build(BuildContext context) => _SectionCard(
        title: 'Mobile release gate',
        children: [
          _KeyValue('Platform', releaseGate.platform),
          _KeyValue('Schema version', releaseGate.schemaVersion.toString()),
          _KeyValue('Android verification', releaseGate.androidVerification),
          _KeyValue('Blocking gate', releaseGate.blockingGate),
          _KeyValue('Acceptance', releaseGate.acceptanceStatus),
          _KeyValue('Release artifact', releaseGate.releaseArtifact),
          _KeyValue('Install smoke', releaseGate.installSmoke),
          _KeyValue('Upgrade smoke', releaseGate.upgradeSmoke),
          for (final limitation in releaseGate.knownLimitations)
            _KeyValue('Known limitation', limitation),
        ],
      );
}

class _DiagnosticsCard extends StatelessWidget {
  const _DiagnosticsCard({required this.diagnostics});

  final Map<String, Object?> diagnostics;

  @override
  Widget build(BuildContext context) => _SectionCard(
        title: 'Privacy-safe diagnostics',
        children: [
          _KeyValue('Schema', diagnostics['mobileSchemaVersion'].toString()),
          _KeyValue(
            'Pending outbox',
            diagnostics['pendingOutboxActions'].toString(),
          ),
          _KeyValue(
            'Executor',
            '${diagnostics['executionOwner']} / ${diagnostics['executorAvailability']}',
          ),
          _KeyValue(
            'Private content',
            diagnostics['privateContentRequest'].toString(),
          ),
          const Text(
            'Diagnostics exclude credentials, raw prompts, raw provider responses, authorization data, lease tokens, and reservation ownership tokens by default.',
          ),
        ],
      );
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              ...children,
            ],
          ),
        ),
      );
}

class _KeyValue extends StatelessWidget {
  const _KeyValue(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Semantics(
          label: '$label: $value',
          child: RichText(
            text: TextSpan(
              style: Theme.of(context).textTheme.bodyMedium,
              children: [
                TextSpan(
                  text: '$label: ',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                TextSpan(text: value),
              ],
            ),
          ),
        ),
      );
}

class _SafetyState extends StatelessWidget {
  const _SafetyState({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => Center(
        child: Semantics(
          liveRegion: true,
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon, size: 40),
              const SizedBox(height: 12),
              Text(title,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(body, textAlign: TextAlign.center),
            ]),
          ),
        ),
      );
}
