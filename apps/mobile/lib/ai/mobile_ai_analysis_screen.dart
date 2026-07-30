import 'dart:async';

import 'package:flutter/material.dart';

import '../design/focuslog_mobile_design.dart';
import 'mobile_ai_repository.dart';

const mobileAiAnalysisLevels = <String>[
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
];

class MobileAIAnalysisScreen extends StatefulWidget {
  const MobileAIAnalysisScreen({super.key, required this.repository});

  final MobileAIRepository repository;

  @override
  State<MobileAIAnalysisScreen> createState() => _MobileAIAnalysisScreenState();
}

class _MobileAIAnalysisScreenState extends State<MobileAIAnalysisScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  late Future<_MobileAIAnalysisViewModel> _future;

  @override
  void initState() {
    super.initState();
    _tabController =
        TabController(length: mobileAiAnalysisLevels.length, vsync: this);
    _future = _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<_MobileAIAnalysisViewModel> _load() async {
    final level = mobileAiAnalysisLevels[_tabController.index];
    final results = await widget.repository.listAnalysisResults(level);
    final periods = await widget.repository.eligiblePeriods(level);
    final jobs = await widget.repository.listJobs();
    final schedule = await widget.repository.scheduleSettings(level);
    final executor = await widget.repository.executorStatus();
    final policy = await widget.repository.policySnapshot();
    return _MobileAIAnalysisViewModel(
      level: level,
      periods: periods,
      results: results,
      jobs: jobs,
      schedule: schedule,
      executor: executor,
      policy: policy,
    );
  }

  Future<void> _refresh() async {
    setState(() {
      _future = _load();
    });
    await _future;
  }

  Future<void> _queueManual(String level, String periodKey) async {
    final operationId = await widget.repository.queueManualAnalysisRequest(
      level: level,
      periodKey: periodKey,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Analyze Now queued: $operationId')),
    );
    await _refresh();
  }

  Future<void> _queueRegeneration(String level, String periodKey) async {
    final operationId = await widget.repository.queueRegenerationRequest(
      level: level,
      periodKey: periodKey,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Regeneration queued: $operationId')),
    );
    await _refresh();
  }

  Future<void> _saveSchedule(MobileAIScheduleSettings current) async {
    final updated = MobileAIScheduleSettings(
      level: current.level,
      enabled: !current.enabled,
      localTime: current.localTime,
      timezone: current.timezone,
      providerProfileId: current.providerProfileId,
      model: current.model,
      fallbackChainId: current.fallbackChainId,
      privacyMode: current.privacyMode,
      maxCostMicros: current.maxCostMicros,
      killSwitch: current.killSwitch,
      nextExpectedRun: current.nextExpectedRun,
      lastSuccessfulRun: current.lastSuccessfulRun,
      blockedReason: current.blockedReason,
    );
    final operationId = await widget.repository.saveScheduleSettings(updated);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Schedule update queued: $operationId')),
    );
    await _refresh();
  }

  Future<void> _toggleKillSwitch(MobileAIScheduleSettings current) async {
    final updated = MobileAIScheduleSettings(
      level: current.level,
      enabled: current.enabled,
      localTime: current.localTime,
      timezone: current.timezone,
      providerProfileId: current.providerProfileId,
      model: current.model,
      fallbackChainId: current.fallbackChainId,
      privacyMode: current.privacyMode,
      maxCostMicros: current.maxCostMicros,
      killSwitch: !current.killSwitch,
      nextExpectedRun: current.nextExpectedRun,
      lastSuccessfulRun: current.lastSuccessfulRun,
      blockedReason: current.blockedReason,
    );
    final operationId = await widget.repository.saveScheduleSettings(updated);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Schedule kill switch update queued: $operationId')),
    );
    await _refresh();
  }

  Future<void> _showDetail(MobileAIAnalysisListItem item) async {
    final detail = await widget.repository.analysisDetail(item.id);
    if (!mounted || detail == null) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => _AnalysisDetailScreen(
          detail: detail,
          repository: widget.repository,
          onRegenerate: () => _queueRegeneration(item.level, item.periodKey),
        ),
      ),
    );
    if (mounted) unawaited(_refresh());
  }

  @override
  Widget build(BuildContext context) => Column(
        children: [
          FocusLogPageHeader(
            eyebrow: 'Desktop-owned execution',
            title: 'AI analyses',
            description:
                'Mobile-safe daily through yearly results, schedules, queue state, and manual actions.',
            action: IconButton(
              tooltip: 'Refresh AI analyses',
              onPressed: _refresh,
              icon: const Icon(Icons.refresh),
            ),
          ),
          TabBar(
            controller: _tabController,
            isScrollable: true,
            onTap: (_) => _refresh(),
            tabs: [
              for (final level in mobileAiAnalysisLevels)
                Tab(text: '${level[0].toUpperCase()}${level.substring(1)}'),
            ],
          ),
          Expanded(
            child: FutureBuilder<_MobileAIAnalysisViewModel>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const _StateMessage(
                    icon: Icons.hourglass_empty,
                    title: 'Loading AI analyses',
                    body: 'Reading synchronized mobile-safe projections.',
                  );
                }
                if (snapshot.hasError) {
                  return _StateMessage(
                    icon: Icons.error_outline,
                    title: 'AI analyses unavailable',
                    body: _friendlyError(snapshot.error),
                  );
                }
                final data = snapshot.data!;
              return RefreshIndicator(
                onRefresh: _refresh,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 108),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                      _ExecutorCard(executor: data.executor),
                      const SizedBox(height: 12),
                      _PolicyBudgetCard(
                        policy: data.policy,
                        onPrivacyMode: (privacyMode) async {
                          await widget.repository
                              .queuePrivacyModeUpdate(privacyMode);
                          await _refresh();
                        },
                        onConsent: (granted) async {
                          await widget.repository.queueCloudConsentUpdate(
                            granted: granted,
                            purposes: const [
                              'scheduled_analyses',
                              'manual_analysis',
                            ],
                          );
                          await _refresh();
                        },
                        onBudget: (monthlyLimit, requestCap) async {
                          await widget.repository.queueBudgetUpdate(
                            monthlyLimitMicros: monthlyLimit,
                            requestCapMicros: requestCap,
                          );
                          await _refresh();
                        },
                        onKillSwitch: (switchName, enabled) async {
                          await widget.repository.queueKillSwitchUpdate(
                            switchName: switchName,
                            enabled: enabled,
                          );
                          await _refresh();
                        },
                      ),
                      const SizedBox(height: 12),
                      _ScheduleCard(
                        settings: data.schedule,
                        onToggleEnabled: () => _saveSchedule(data.schedule),
                        onToggleKillSwitch: () =>
                            _toggleKillSwitch(data.schedule),
                      ),
                      const SizedBox(height: 12),
                      _ManualPeriodCard(
                        level: data.level,
                        periods: data.periods,
                        jobs: data.jobs,
                        onAnalyze: _queueManual,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Results',
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      if (data.results.isEmpty)
                        _StateMessage(
                          icon: Icons.auto_awesome_outlined,
                          title: 'No ${data.level} result yet',
                          body:
                              'Choose an eligible period above. The request will sync to the authoritative queue when connected.',
                        )
                      else
                        for (final item in data.results)
                          _AnalysisResultTile(
                            item: item,
                            onTap: () => _showDetail(item),
                          ),
                      const SizedBox(height: 16),
                      _QueueStatusCard(
                        jobs: data.jobs,
                        onCancel: (jobId) async {
                          await widget.repository.queueCancellation(jobId);
                          await _refresh();
                        },
                        onRetry: (jobId) async {
                          await widget.repository.queueRetry(jobId);
                          await _refresh();
                        },
                      ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      );
}

class _MobileAIAnalysisViewModel {
  const _MobileAIAnalysisViewModel({
    required this.level,
    required this.periods,
    required this.results,
    required this.jobs,
    required this.schedule,
    required this.executor,
    required this.policy,
  });

  final String level;
  final List<String> periods;
  final List<MobileAIAnalysisListItem> results;
  final List<MobileAIJobListItem> jobs;
  final MobileAIScheduleSettings schedule;
  final MobileAIExecutorStatus executor;
  final MobileAIPolicySnapshot policy;
}

class _PolicyBudgetCard extends StatefulWidget {
  const _PolicyBudgetCard({
    required this.policy,
    required this.onPrivacyMode,
    required this.onConsent,
    required this.onBudget,
    required this.onKillSwitch,
  });

  final MobileAIPolicySnapshot policy;
  final Future<void> Function(String privacyMode) onPrivacyMode;
  final Future<void> Function(bool granted) onConsent;
  final Future<void> Function(String monthlyLimit, String requestCap) onBudget;
  final Future<void> Function(String switchName, bool enabled) onKillSwitch;

  @override
  State<_PolicyBudgetCard> createState() => _PolicyBudgetCardState();
}

class _PolicyBudgetCardState extends State<_PolicyBudgetCard> {
  late final TextEditingController _monthlyLimit;
  late final TextEditingController _requestCap;

  @override
  void initState() {
    super.initState();
    _monthlyLimit = TextEditingController(
      text: widget.policy.budget.monthlyLimitMicros,
    );
    _requestCap = TextEditingController(
      text: widget.policy.budget.requestCapMicros,
    );
  }

  @override
  void dispose() {
    _monthlyLimit.dispose();
    _requestCap.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final policy = widget.policy;
    final primarySwitches = [
      'provider_calls',
      'scheduled_analyses',
      'cloud_execution',
      'background_queue',
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            'Privacy, consent, and budget',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: policy.privacyMode,
            decoration: const InputDecoration(labelText: 'Privacy mode'),
            items: const [
              DropdownMenuItem(value: 'DISABLED', child: Text('Disabled')),
              DropdownMenuItem(value: 'LOCAL', child: Text('Local')),
              DropdownMenuItem(value: 'CLOUD', child: Text('Cloud')),
              DropdownMenuItem(value: 'HYBRID', child: Text('Hybrid')),
            ],
            onChanged: (value) {
              if (value != null) widget.onPrivacyMode(value);
            },
          ),
          const SizedBox(height: 8),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Cloud consent'),
            subtitle: Text(policy.cloudConsentActive
                ? 'Consent synchronized for ${policy.consentPurposes.join(', ')}'
                : 'Cloud provider upload is not authorized by mobile cache.'),
            value: policy.cloudConsentActive,
            onChanged: widget.onConsent,
          ),
          if (policy.pendingOperationCount > 0)
            Text(
              '${policy.pendingOperationCount} policy/budget change(s) pending sync.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          const Divider(height: 24),
          Wrap(spacing: 8, runSpacing: 8, children: [
            _Chip(label: 'Month: ${policy.budget.month}'),
            _Chip(label: 'Limit: ${policy.budget.monthlyLimitMicros}'),
            _Chip(label: 'Settled: ${policy.budget.settledMicros}'),
            _Chip(label: 'Reserved: ${policy.budget.reservedMicros}'),
            _Chip(label: 'Remaining: ${policy.budget.remainingMicros}'),
            _Chip(label: 'Request cap: ${policy.budget.requestCapMicros}'),
          ]),
          if (policy.budget.unknownPricingBlocked) ...[
            const SizedBox(height: 8),
            Text(
              'Unknown pricing is blocked by authoritative policy.',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _monthlyLimit,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Monthly limit micros'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _requestCap,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Request cap micros'),
              ),
            ),
          ]),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.tonal(
              onPressed: () => widget.onBudget(
                _monthlyLimit.text.trim(),
                _requestCap.text.trim(),
              ),
              child: const Text('Queue budget update'),
            ),
          ),
          const Divider(height: 24),
          Text(
            'Provider profiles',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          if (policy.providerProfiles.isEmpty)
            const Text('No provider profile metadata synchronized yet.')
          else
            for (final profile in policy.providerProfiles)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(profile.displayName),
                subtitle: Text(
                  '${profile.classification}; ${profile.endpointHost}; ${profile.validationStatus}\n'
                  'Models: ${profile.modelAvailability}; credentials: ${profile.credentialConfigured ? 'configured on authority' : 'not configured'}',
                ),
              ),
          const Divider(height: 24),
          Text('Subsystem switches',
              style: Theme.of(context).textTheme.titleSmall),
          for (final switchName in primarySwitches)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(_title(switchName)),
              subtitle: const Text('Independent switch; local viewing remains available.'),
              value: policy.killSwitches[switchName] == true,
              onChanged: (value) => widget.onKillSwitch(switchName, value),
            ),
          Text(
            'Credential mode: ${policy.mobileCredentialMode}. Provider secrets are not synchronized to mobile for desktop-owned execution.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ]),
      ),
    );
  }
}

class _ExecutorCard extends StatelessWidget {
  const _ExecutorCard({required this.executor});
  final MobileAIExecutorStatus executor;

  @override
  Widget build(BuildContext context) => Card(
        child: ListTile(
          leading: const Icon(Icons.desktop_windows_outlined),
          title: Text(_statusLabel(executor.availability)),
          subtitle: Text(
            '${executor.message}\nLast seen: ${executor.lastSeenAt ?? 'not reported yet'}',
          ),
        ),
      );
}

class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard({
    required this.settings,
    required this.onToggleEnabled,
    required this.onToggleKillSwitch,
  });

  final MobileAIScheduleSettings settings;
  final VoidCallback onToggleEnabled;
  final VoidCallback onToggleKillSwitch;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Schedule controls',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${_title(settings.level)} schedule'),
                subtitle: Text(
                  '${settings.localTime} ${settings.timezone}; next ${settings.nextExpectedRun ?? 'not scheduled'}',
                ),
                value: settings.enabled,
                onChanged: (_) => onToggleEnabled(),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Schedule kill switch'),
                subtitle: Text(settings.killSwitch
                    ? 'Disabled before enqueue; no provider is contacted.'
                    : 'Schedule may enqueue through sync if policy permits.'),
                value: settings.killSwitch,
                onChanged: (_) => onToggleKillSwitch(),
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _Chip(label: 'Provider: ${settings.providerProfileId}'),
                  _Chip(label: 'Model: ${settings.model}'),
                  _Chip(label: 'Fallback: ${settings.fallbackChainId}'),
                  _Chip(label: 'Privacy: ${settings.privacyMode}'),
                  _Chip(label: 'Cap: ${settings.maxCostMicros} micro-usd'),
                ],
              ),
              if (settings.blockedReason != null) ...[
                const SizedBox(height: 8),
                Text(
                  'Blocked: ${settings.blockedReason}',
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          ),
        ),
      );
}

class _ManualPeriodCard extends StatefulWidget {
  const _ManualPeriodCard({
    required this.level,
    required this.periods,
    required this.jobs,
    required this.onAnalyze,
  });

  final String level;
  final List<String> periods;
  final List<MobileAIJobListItem> jobs;
  final Future<void> Function(String level, String periodKey) onAnalyze;

  @override
  State<_ManualPeriodCard> createState() => _ManualPeriodCardState();
}

class _ManualPeriodCardState extends State<_ManualPeriodCard> {
  String? _selected;

  @override
  Widget build(BuildContext context) {
    final selected = _selected ?? (widget.periods.isEmpty ? '' : widget.periods.first);
    final matchingJobs = widget.jobs.where((job) {
      return job.jobType == '${widget.level}_analysis' &&
          job.idempotencyKey.contains(':$selected:');
    }).toList();
    final existing = matchingJobs.isEmpty ? null : matchingJobs.first;
    final active = existing != null &&
        const {'queued', 'leased', 'retry_wait'}.contains(existing.status);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            'Analyze Now',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: selected.isEmpty ? null : selected,
            decoration: const InputDecoration(labelText: 'Eligible period'),
            items: [
              for (final period in widget.periods)
                DropdownMenuItem(value: period, child: Text(period)),
            ],
            onChanged: (value) => setState(() => _selected = value),
          ),
          const SizedBox(height: 10),
          if (active)
            Text('Existing equivalent job: ${existing.id} (${existing.status})')
          else
            const Text(
              'Manual requests sync to the desktop-owned queue and keep dependency, privacy, consent, and budget enforcement there.',
            ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: selected.isEmpty || active
                  ? null
                  : () => widget.onAnalyze(widget.level, selected),
              icon: const Icon(Icons.play_arrow),
              label: Text(active ? 'Existing job active' : 'Analyze Now'),
            ),
          ),
        ]),
      ),
    );
  }
}

class _AnalysisResultTile extends StatelessWidget {
  const _AnalysisResultTile({required this.item, required this.onTap});

  final MobileAIAnalysisListItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
        child: ListTile(
          onTap: onTap,
          leading: Icon(
            item.staleState == 'current'
                ? Icons.auto_awesome
                : Icons.history_toggle_off,
          ),
          title: Text('${_title(item.level)} ${item.periodKey}'),
          subtitle: Text(
            '${item.summary}\nVersion ${item.resultVersion}; ${item.staleState}; ${item.costMicros} micro-usd',
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: const Icon(Icons.chevron_right),
        ),
      );
}

class _QueueStatusCard extends StatelessWidget {
  const _QueueStatusCard({
    required this.jobs,
    required this.onCancel,
    required this.onRetry,
  });

  final List<MobileAIJobListItem> jobs;
  final Future<void> Function(String jobId) onCancel;
  final Future<void> Function(String jobId) onRetry;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              'Queue status',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            if (jobs.isEmpty)
              const Text('No synchronized AI jobs yet.')
            else
              for (final job in jobs.take(8))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('${job.jobType} • ${_statusLabel(job.status)}'),
                  subtitle: Text(
                    'Updated ${job.updatedAt.toIso8601String()}\nCost ${job.costMicros} micro-usd',
                  ),
                  trailing: Wrap(
                    spacing: 4,
                    children: [
                      IconButton(
                        tooltip: 'Cancel job',
                        onPressed: _canCancel(job.status)
                            ? () => onCancel(job.id)
                            : null,
                        icon: const Icon(Icons.stop_circle_outlined),
                      ),
                      IconButton(
                        tooltip: 'Retry job',
                        onPressed:
                            _canRetry(job.status) ? () => onRetry(job.id) : null,
                        icon: const Icon(Icons.restart_alt),
                      ),
                    ],
                  ),
                ),
          ]),
        ),
      );
}

class _AnalysisDetailScreen extends StatelessWidget {
  const _AnalysisDetailScreen({
    required this.detail,
    required this.repository,
    required this.onRegenerate,
  });

  final MobileAIAnalysisDetail detail;
  final MobileAIRepository repository;
  final Future<void> Function() onRegenerate;

  @override
  Widget build(BuildContext context) {
    final item = detail.item;
    return Scaffold(
      appBar: AppBar(title: Text('${_title(item.level)} ${item.periodKey}')),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  item.summary,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 16),
                _MetadataCard(detail: detail),
                const SizedBox(height: 12),
                _StructuredSections(values: detail.structured),
                const SizedBox(height: 12),
                _ProvenanceCard(
                  provenance: detail.provenance,
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: onRegenerate,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Regenerate this period'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MetadataCard extends StatelessWidget {
  const _MetadataCard({required this.detail});
  final MobileAIAnalysisDetail detail;

  @override
  Widget build(BuildContext context) {
    final provider = detail.provider;
    final usage = detail.usage;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _Chip(label: 'Provider: ${provider['requestedProvider'] ?? 'n/a'}'),
            _Chip(label: 'Actual: ${provider['actualProvider'] ?? 'n/a'}'),
            _Chip(label: 'Model: ${provider['actualModel'] ?? provider['model'] ?? 'n/a'}'),
            _Chip(label: 'Fallback: ${detail.fallback['used'] == true ? 'used' : 'not used'}'),
            _Chip(label: 'Prompt: ${provider['promptVersion'] ?? 'n/a'}'),
            _Chip(label: 'Input tokens: ${usage['inputTokens'] ?? 'n/a'}'),
            _Chip(label: 'Output tokens: ${usage['outputTokens'] ?? 'n/a'}'),
            _Chip(label: 'Cost: ${detail.item.costMicros} micro-usd'),
            _Chip(label: 'State: ${detail.item.staleState}'),
          ],
        ),
      ),
    );
  }
}

class _StructuredSections extends StatelessWidget {
  const _StructuredSections({required this.values});
  final Map<String, dynamic> values;

  @override
  Widget build(BuildContext context) {
    final entries = values.entries.where((entry) {
      final key = entry.key.toLowerCase();
      return !key.contains('raw') && !key.contains('prompt');
    }).toList();
    if (entries.isEmpty) {
      return const _StateMessage(
        icon: Icons.notes_outlined,
        title: 'Readable summary only',
        body: 'This result may be a legacy analysis without structured sections.',
      );
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            'Structured sections',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          for (final entry in entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_title(entry.key),
                      style: Theme.of(context).textTheme.titleSmall),
                  Text(_safeValue(entry.value)),
                ],
              ),
            ),
        ]),
      ),
    );
  }
}

class _ProvenanceCard extends StatelessWidget {
  const _ProvenanceCard({
    required this.provenance,
  });

  final Map<String, dynamic> provenance;

  @override
  Widget build(BuildContext context) {
    final evidence = provenance['evidence'];
    final evidenceList = evidence is List ? evidence.whereType<Map>().toList() : const [];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            'Provenance and evidence',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          if (evidenceList.isEmpty)
            const Text('No inspectable evidence was synchronized for this result.')
          else
            for (final raw in evidenceList.take(12))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.link_outlined),
                title: Text(raw['title']?.toString() ??
                    raw['sourceId']?.toString() ??
                    'Evidence source'),
                subtitle: Text(
                  raw['deletedAt'] == null
                      ? '${raw['kind'] ?? 'source'} • ${raw['timestamp'] ?? 'time unavailable'}\n${raw['excerpt'] ?? 'Excerpt unavailable'}'
                      : 'Deleted or unavailable evidence',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          Text(
            'Deterministic statistics, AI interpretation, and user corrections are synchronized as separate provenance fields when available.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ]),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Chip(
        label: Text(label),
        visualDensity: VisualDensity.compact,
      );
}

class _StateMessage extends StatelessWidget {
  const _StateMessage({
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 40),
              const SizedBox(height: 12),
              Text(
                title,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(body, textAlign: TextAlign.center),
            ],
          ),
        ),
      );
}

bool _canCancel(String status) =>
    const {'queued', 'leased', 'retry_wait'}.contains(status);

bool _canRetry(String status) =>
    const {'failed', 'dead_lettered', 'cancelled'}.contains(status);

String _statusLabel(String status) => status
    .split('_')
    .map((part) => part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}')
    .join(' ');

String _title(String value) => value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}')
    .join(' ');

String _friendlyError(Object? error) {
  final text = error.toString();
  if (text.contains('READ_ONLY_UNSUPPORTED_AI_SCHEMA')) {
    return 'This AI data was created by a newer app version. Update mobile before viewing it.';
  }
  if (text.contains('PERMISSION')) {
    return 'This AI data belongs to another profile or workspace.';
  }
  return 'FocusLog could not read the AI mobile projection. Synchronize and try again.';
}

String _safeValue(Object? value) {
  if (value == null) return 'Not reported';
  if (value is Iterable) return value.map(_safeValue).join('\n');
  if (value is Map) {
    return value.entries
        .where((entry) {
          final key = entry.key.toString().toLowerCase();
          return !key.contains('raw') && !key.contains('prompt');
        })
        .map((entry) => '${_title(entry.key.toString())}: ${_safeValue(entry.value)}')
        .join('\n');
  }
  return value.toString();
}
