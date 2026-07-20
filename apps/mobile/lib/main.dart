import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:dynamic_color/dynamic_color.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/services.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import 'data/database/app_database.dart';
import 'data/mobile_repository.dart';
import 'identity/device_identity.dart';
import 'identity/focuslog_api_client.dart';
import 'reminders/android_reminder_scheduler.dart';
import 'reminders/reminder_scheduler.dart';
import 'sync/sync_worker.dart';
import 'sync/websocket_client.dart';
import 'security/encrypted_backup.dart';
import 'security/permanent_deletion.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  tzdata.initializeTimeZones();
  final databaseKey = await DatabaseKeyService().loadOrCreate();
  final database = AppDatabase.encrypted(databaseKey);
  final identity = await DeviceIdentityService().loadOrCreate();
  final repository = FocusLogRepository(database, identity);
  await repository.ensureIdentity();
  await repository.recoverOverdueReminders(reason: 'process-start');
  final scheduler = AndroidReminderScheduler(FlutterLocalNotificationsPlugin());
  await scheduler.initialize();
  for (final reminder in await repository.scheduledReminders()) {
    await scheduler.schedule(reminder.id, reminder.dueAt);
  }
  await scheduler.recoverAfterStartup();
  runApp(FocusLogApp(repository: repository, scheduler: scheduler));
}

class FocusLogApp extends StatelessWidget {
  const FocusLogApp(
      {super.key, required this.repository, required this.scheduler});
  final FocusLogRepository repository;
  final ReminderScheduler scheduler;

  @override
  Widget build(BuildContext context) => DynamicColorBuilder(
        builder: (lightDynamic, darkDynamic) {
          const seed = Color(0xff5b5bd6);
          ThemeData theme(ColorScheme colors) => ThemeData(
                colorScheme: colors,
                useMaterial3: true,
                scaffoldBackgroundColor: colors.surface,
                cardTheme: CardThemeData(
                  elevation: 0,
                  color: colors.surfaceContainerLow,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(22),
                    side: BorderSide(color: colors.outlineVariant),
                  ),
                ),
                inputDecorationTheme: InputDecorationTheme(
                  filled: true,
                  fillColor: colors.surfaceContainerLow,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                ),
                filledButtonTheme: FilledButtonThemeData(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 52),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              );

          return MaterialApp(
            title: 'FocusLog',
            debugShowCheckedModeBanner: false,
            theme: theme(lightDynamic ??
                ColorScheme.fromSeed(
                    seedColor: seed, brightness: Brightness.light)),
            darkTheme: theme(darkDynamic ??
                ColorScheme.fromSeed(
                    seedColor: seed, brightness: Brightness.dark)),
            themeMode: ThemeMode.system,
            home: FocusLogHome(repository: repository, scheduler: scheduler),
          );
        },
      );
}

class FocusLogHome extends StatefulWidget {
  const FocusLogHome(
      {super.key, required this.repository, required this.scheduler});
  final FocusLogRepository repository;
  final ReminderScheduler scheduler;

  @override
  State<FocusLogHome> createState() => _FocusLogHomeState();
}

class _FocusLogHomeState extends State<FocusLogHome>
    with WidgetsBindingObserver {
  int _index = 0;
  String _syncStatus = 'Offline ready';
  bool _reminderVisible = false;
  StreamSubscription<String>? _notificationSubscription;
  FocusLogWebSocketClient? _websocket;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _notificationSubscription =
        widget.scheduler.notificationTaps.listen(_openReminder);
    unawaited(widget.scheduler.launchedOccurrence().then((occurrenceId) {
      if (occurrenceId != null) _openReminder(occurrenceId);
    }));
    const apiUrl = String.fromEnvironment('FOCUSLOG_API_URL');
    if (apiUrl.isNotEmpty) {
      _websocket = FocusLogWebSocketClient(
        endpoint: Uri.parse(apiUrl),
        identity: widget.repository.identity,
        onSyncAvailable: _sync,
      );
      unawaited(_websocket!.start());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    final subscription = _notificationSubscription;
    if (subscription != null) unawaited(subscription.cancel());
    unawaited(_websocket?.stop());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _websocket?.setForeground(state == AppLifecycleState.resumed);
    if (state == AppLifecycleState.resumed) {
      unawaited(widget.scheduler.recoverAfterWake());
      unawaited(widget.repository
          .recoverOverdueReminders(reason: 'app-resume')
          .then((_) async {
        final reminder = await widget.repository.nextScheduledReminder();
        if (reminder != null &&
            (reminder.state == 'DUE' || reminder.state == 'PRESENTED')) {
          await _openReminder(reminder.id);
        } else if (mounted) {
          setState(() {});
        }
      }));
    }
  }

  Future<void> _openReminder(String occurrenceId) async {
    if (_reminderVisible) return;
    await widget.repository.recoverOverdueReminders(reason: 'notification-tap');
    await widget.repository.presentReminder(occurrenceId);
    if (!mounted) return;
    _reminderVisible = true;
    try {
      await widget.scheduler.beginPresentation(occurrenceId);
    } on PlatformException {
      // Android can deny a foreground-service or full-screen presentation.
      // The foreground route remains the supported graceful fallback.
    }
    if (!mounted) return;
    try {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          fullscreenDialog: true,
          builder: (_) => _ReminderScreen(
            repository: widget.repository,
            scheduler: widget.scheduler,
            occurrenceId: occurrenceId,
          ),
        ),
      );
    } finally {
      _reminderVisible = false;
      if (mounted) setState(() {});
    }
  }

  Future<void> _start() async {
    final session = await widget.repository.startFocusSession();
    final reminder = await widget.repository.nextScheduledReminder();
    if (reminder != null) {
      await widget.scheduler.schedule(reminder.id, reminder.dueAt);
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(
              '${session.name} started; next check-in is scheduled locally.')));
    }
    setState(() {});
  }

  Future<void> _sync() async {
    setState(() => _syncStatus = 'Synchronizing…');
    final worker = SyncWorker(
        database: widget.repository.database,
        identity: widget.repository.identity,
        endpoint: Uri.parse(const String.fromEnvironment('FOCUSLOG_API_URL',
            defaultValue: 'https://localhost')));
    final result = await worker.synchronize();
    worker.dispose();
    for (final occurrenceId in await widget.repository.resolvedReminderIds()) {
      await widget.scheduler.cancel(occurrenceId);
    }
    await widget.repository.recoverOverdueReminders(reason: 'foreground-sync');
    if (mounted) {
      setState(() => _syncStatus = result.status == 'synced'
          ? 'Synchronized ${result.pushed} operation(s)'
          : result.message ?? result.status);
    }
  }

  void _openPairing() {
    Navigator.of(context).push<void>(MaterialPageRoute(
      builder: (_) => Scaffold(
        appBar: AppBar(title: const Text('Pair a device')),
        body: SafeArea(child: _Pairing(repository: widget.repository)),
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      _Dashboard(
          repository: widget.repository,
          scheduler: widget.scheduler,
          onStart: _start,
          onReminder: _openReminder),
      _History(repository: widget.repository),
      _Reports(repository: widget.repository),
      _Heatmap(repository: widget.repository),
      _Settings(
          repository: widget.repository,
          scheduler: widget.scheduler,
          syncStatus: _syncStatus,
          onSync: _sync,
          onPair: _openPairing),
    ];
    const destinations = [
      NavigationDestination(icon: Icon(Icons.timer_outlined), label: 'Focus'),
      NavigationDestination(icon: Icon(Icons.history), label: 'History'),
      NavigationDestination(
          icon: Icon(Icons.insights_outlined), label: 'Reports'),
      NavigationDestination(
          icon: Icon(Icons.calendar_month_outlined), label: 'Calendar'),
      NavigationDestination(
          icon: Icon(Icons.settings_outlined), label: 'Settings'),
    ];
    return LayoutBuilder(builder: (context, constraints) {
      final wide = constraints.maxWidth >= 760;
      final content = SafeArea(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 220),
          child: KeyedSubtree(key: ValueKey(_index), child: pages[_index]),
        ),
      );
      return Scaffold(
        appBar: wide
            ? null
            : AppBar(
                title: const _BrandMark(),
                actions: [
                  Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: Tooltip(
                      message: _syncStatus,
                      child: Icon(
                        _syncStatus.startsWith('Synchronized')
                            ? Icons.cloud_done_outlined
                            : Icons.cloud_off_outlined,
                        semanticLabel: _syncStatus,
                      ),
                    ),
                  ),
                ],
              ),
        body: wide
            ? Row(children: [
                NavigationRail(
                  extended: constraints.maxWidth >= 1050,
                  selectedIndex: _index,
                  leading: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: _BrandMark(),
                  ),
                  onDestinationSelected: (value) =>
                      setState(() => _index = value),
                  destinations: [
                    for (final item in destinations)
                      NavigationRailDestination(
                        icon: item.icon,
                        label: Text(item.label),
                      ),
                  ],
                ),
                const VerticalDivider(width: 1),
                Expanded(child: content),
              ])
            : content,
        bottomNavigationBar: wide
            ? null
            : NavigationBar(
                selectedIndex: _index,
                onDestinationSelected: (value) =>
                    setState(() => _index = value),
                destinations: destinations,
              ),
      );
    });
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) =>
      Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primary,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(Icons.adjust,
              size: 20, color: Theme.of(context).colorScheme.onPrimary),
        ),
        const SizedBox(width: 10),
        Text('FocusLog',
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w700)),
      ]);
}

class _Dashboard extends StatefulWidget {
  const _Dashboard({
    required this.repository,
    required this.scheduler,
    required this.onStart,
    required this.onReminder,
  });
  final FocusLogRepository repository;
  final ReminderScheduler scheduler;
  final Future<void> Function() onStart;
  final Future<void> Function(String) onReminder;

  @override
  State<_Dashboard> createState() => _DashboardState();
}

class _DashboardState extends State<_Dashboard> {
  Timer? _clock;

  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(
        const Duration(seconds: 1), (_) => mounted ? setState(() {}) : null);
  }

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  Future<_DashboardData> _load() async {
    final session = await widget.repository.activeSession();
    final reminder = await widget.repository.nextScheduledReminder();
    final interval = await widget.repository.reminderIntervalMinutes();
    final timezone = await widget.repository.reportTimezoneId();
    final local = tz.TZDateTime.now(tz.getLocation(timezone));
    final report = await widget.repository.dailyReport(
      day: _reportDayString(local),
      timezoneId: timezone,
    );
    return _DashboardData(session, reminder, interval, report);
  }

  Future<void> _sessionAction(Future<void> Function() action) async {
    try {
      await action();
      final reminder = await widget.repository.nextScheduledReminder();
      if (reminder != null &&
          (reminder.state == 'SCHEDULED' || reminder.state == 'SNOOZED')) {
        await widget.scheduler.schedule(reminder.id, reminder.dueAt);
      }
      if (mounted) setState(() {});
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_friendlyError(error))));
      }
    }
  }

  Future<void> _quickLog() async {
    final controller = TextEditingController();
    final value = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
            20, 20, 20, MediaQuery.viewInsetsOf(context).bottom + 24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('Quick check-in',
              style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          TextField(
            controller: controller,
            autofocus: true,
            minLines: 3,
            maxLines: 6,
            decoration:
                const InputDecoration(hintText: 'What are you working on?'),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => Navigator.pop(context, controller.text),
              child: const Text('Save check-in'),
            ),
          ),
        ]),
      ),
    );
    controller.dispose();
    if (value == null || value.trim().isEmpty) return;
    await widget.repository.createCheckIn(value);
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<_DashboardData>(
        future: _load(),
        builder: (context, snapshot) {
          final data = snapshot.data;
          final session = data?.session;
          final reminder = data?.reminder;
          final due = reminder != null &&
              (reminder.state == 'DUE' || reminder.state == 'PRESENTED');
          final countdown = reminder == null
              ? '--:--'
              : _countdown(reminder.dueAt.difference(DateTime.now().toUtc()));
          return RefreshIndicator(
            onRefresh: () async => setState(() {}),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
              children: [
                Text(_greeting(), style: Theme.of(context).textTheme.bodyLarge),
                Text(
                  session == null ? 'Ready when you are.' : 'Stay in flow.',
                  style: Theme.of(context)
                      .textTheme
                      .displaySmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 22),
                Card(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  child: Padding(
                    padding: const EdgeInsets.all(22),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Icon(
                            session == null
                                ? Icons.pause_circle_outline
                                : Icons.bolt,
                            color: Theme.of(context)
                                .colorScheme
                                .onPrimaryContainer,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            session == null
                                ? 'No active session'
                                : session.status == 'PAUSED'
                                    ? 'Session paused'
                                    : 'Focus session active',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                        ]),
                        const SizedBox(height: 18),
                        Text(
                          due ? 'CHECK-IN DUE' : 'NEXT CHECK-IN',
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                        Text(
                          due ? 'Now' : countdown,
                          style: Theme.of(context)
                              .textTheme
                              .displayMedium
                              ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  fontFeatures: const [
                                FontFeature.tabularFigures()
                              ]),
                        ),
                        Text('Every ${data?.interval ?? 15} minutes'),
                        const SizedBox(height: 20),
                        if (session == null)
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.icon(
                              onPressed: widget.onStart,
                              icon: const Icon(Icons.play_arrow),
                              label: const Text('Start focus session'),
                            ),
                          )
                        else if (due)
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              onPressed: () => widget.onReminder(reminder.id),
                              child: const Text('Complete check-in'),
                            ),
                          )
                        else
                          Wrap(spacing: 10, runSpacing: 10, children: [
                            FilledButton.tonalIcon(
                              onPressed: () => _sessionAction(
                                session.status == 'PAUSED'
                                    ? widget.repository.resumeFocusSession
                                    : widget.repository.pauseFocusSession,
                              ),
                              icon: Icon(session.status == 'PAUSED'
                                  ? Icons.play_arrow
                                  : Icons.pause),
                              label: Text(session.status == 'PAUSED'
                                  ? 'Resume'
                                  : 'Pause'),
                            ),
                            OutlinedButton.icon(
                              onPressed: () => _sessionAction(
                                  widget.repository.stopFocusSession),
                              icon: const Icon(Icons.stop),
                              label: const Text('Stop'),
                            ),
                          ]),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                Row(children: [
                  Expanded(
                    child: _StatCard(
                      label: 'Tracked today',
                      value: '${data?.report.totalTrackedMinutes ?? 0}m',
                      icon: Icons.schedule,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      label: 'Focus score',
                      value: '${data?.report.focusScore ?? 0}%',
                      icon: Icons.auto_graph,
                    ),
                  ),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: _StatCard(
                      label: 'Completed',
                      value: '${data?.report.completedIntervals ?? 0}',
                      icon: Icons.check_circle_outline,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      label: 'Missed',
                      value: '${data?.report.missedIntervals ?? 0}',
                      icon: Icons.timelapse,
                    ),
                  ),
                ]),
                const SizedBox(height: 22),
                Text('Quick actions',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 10),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.edit_note),
                    title: const Text('Log what you are doing'),
                    subtitle: const Text('Saved locally and synced later'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: _quickLog,
                  ),
                ),
              ],
            ),
          );
        },
      );
}

class _DashboardData {
  const _DashboardData(this.session, this.reminder, this.interval, this.report);
  final FocusSessionSummary? session;
  final ReminderSummary? reminder;
  final int interval;
  final DailyReport report;
}

class _StatCard extends StatelessWidget {
  const _StatCard(
      {required this.label, required this.value, required this.icon});
  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            Text(value,
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w700)),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
          ]),
        ),
      );
}

class _ReminderScreen extends StatefulWidget {
  const _ReminderScreen({
    required this.repository,
    required this.scheduler,
    required this.occurrenceId,
  });
  final FocusLogRepository repository;
  final ReminderScheduler scheduler;
  final String occurrenceId;

  @override
  State<_ReminderScreen> createState() => _ReminderScreenState();
}

class _ReminderScreenState extends State<_ReminderScreen>
    with WidgetsBindingObserver {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  bool _submitting = false;
  bool _completed = false;
  int _interval = 15;

  int get _length => _controller.text.trim().runes.length;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_load());
    _controller.addListener(_changed);
  }

  Future<void> _load() async {
    _controller.text =
        await widget.repository.reminderDraft(widget.occurrenceId);
    _interval = await widget.repository.reminderIntervalMinutes();
    if (mounted) {
      setState(() {});
      _focusNode.requestFocus();
    }
  }

  void _changed() {
    unawaited(widget.repository
        .preserveReminderDraft(widget.occurrenceId, _controller.text));
    if (mounted) setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_completed) {
      unawaited(widget.scheduler
          .beginPresentation(widget.occurrenceId)
          .onError<PlatformException>((_, __) {}));
      _focusNode.requestFocus();
    }
  }

  Future<void> _submit() async {
    if (_length < 20 || _submitting) return;
    setState(() => _submitting = true);
    try {
      await widget.repository
          .completeReminder(widget.occurrenceId, _controller.text);
      await widget.repository.deleteReminderDraft(widget.occurrenceId);
      try {
        await widget.scheduler.endPresentation(widget.occurrenceId);
        for (final reminder in await widget.repository.scheduledReminders()) {
          await widget.scheduler.schedule(reminder.id, reminder.dueAt);
        }
      } on PlatformException {
        // Completion is already durable. Recovery will reconcile platform
        // notifications the next time Android permits scheduler work.
      }
      _completed = true;
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_friendlyError(error))));
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.removeListener(_changed);
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PopScope(
        canPop: _completed,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop && !_completed) _focusNode.requestFocus();
        },
        child: Scaffold(
          body: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 680),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Icon(Icons.adjust,
                          size: 44,
                          color: Theme.of(context).colorScheme.primary),
                      const SizedBox(height: 28),
                      Text(
                        'What did you accomplish during the last $_interval minutes?',
                        textAlign: TextAlign.center,
                        style: Theme.of(context)
                            .textTheme
                            .displaySmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 28),
                      TextField(
                        controller: _controller,
                        focusNode: _focusNode,
                        autofocus: true,
                        minLines: 7,
                        maxLines: 12,
                        textInputAction: TextInputAction.newline,
                        decoration: InputDecoration(
                          hintText:
                              'Describe what you completed, decided, or learned.',
                          helperText: _length < 20
                              ? '${20 - _length} more characters required'
                              : 'Ready to submit',
                          suffixText: '$_length / 20',
                        ),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed:
                            _length >= 20 && !_submitting ? _submit : null,
                        child: _submitting
                            ? const SizedBox.square(
                                dimension: 22,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Submit check-in'),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Your unfinished response is saved on this device.',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
}

class _History extends StatefulWidget {
  const _History({required this.repository});
  final FocusLogRepository repository;
  @override
  State<_History> createState() => _HistoryState();
}

class _HistoryState extends State<_History> {
  String _query = '';
  String? _tagId;
  String? _categoryId;
  String? _sessionId;
  SearchFilterOptions _filters =
      const SearchFilterOptions(tags: [], categories: [], sessions: []);

  @override
  void initState() {
    super.initState();
    widget.repository.searchFilterOptions().then((filters) {
      if (mounted) setState(() => _filters = filters);
    });
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<CheckInSummary>>(
      future: widget.repository.history(_query,
          tagId: _tagId, categoryId: _categoryId, sessionId: _sessionId),
      builder: (context, snapshot) =>
          ListView(padding: const EdgeInsets.all(20), children: [
            TextField(
                decoration: const InputDecoration(
                    labelText: 'Search check-ins',
                    prefixIcon: Icon(Icons.search)),
                onChanged: (value) => setState(() => _query = value)),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _tagId,
              decoration: const InputDecoration(labelText: 'Tag'),
              items: [
                const DropdownMenuItem(value: null, child: Text('All tags')),
                for (final item in _filters.tags)
                  DropdownMenuItem(value: item.id, child: Text(item.name))
              ],
              onChanged: (value) => setState(() => _tagId = value),
            ),
            DropdownButtonFormField<String>(
              initialValue: _categoryId,
              decoration: const InputDecoration(labelText: 'Category'),
              items: [
                const DropdownMenuItem(
                    value: null, child: Text('All categories')),
                for (final item in _filters.categories)
                  DropdownMenuItem(value: item.id, child: Text(item.name))
              ],
              onChanged: (value) => setState(() => _categoryId = value),
            ),
            DropdownButtonFormField<String>(
              initialValue: _sessionId,
              decoration: const InputDecoration(labelText: 'Focus session'),
              items: [
                const DropdownMenuItem(
                    value: null, child: Text('All sessions')),
                for (final item in _filters.sessions)
                  DropdownMenuItem(value: item.id, child: Text(item.name))
              ],
              onChanged: (value) => setState(() => _sessionId = value),
            ),
            const SizedBox(height: 16),
            for (final item in snapshot.data ?? [])
              ListTile(
                  title: Text(item.body),
                  subtitle: Text(item.submittedAt.toLocal().toString()))
          ]));
}

String _reportDayString(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-'
    '${date.month.toString().padLeft(2, '0')}-'
    '${date.day.toString().padLeft(2, '0')}';

String _reportTime(DateTime instant, String timezoneId) {
  final local = tz.TZDateTime.from(instant.toUtc(), tz.getLocation(timezoneId));
  return '${local.hour.toString().padLeft(2, '0')}:'
      '${local.minute.toString().padLeft(2, '0')}:'
      '${local.second.toString().padLeft(2, '0')}';
}

class _Reports extends StatefulWidget {
  const _Reports({required this.repository});
  final FocusLogRepository repository;

  @override
  State<_Reports> createState() => _ReportsState();
}

class _ReportsState extends State<_Reports> {
  final _timezone = TextEditingController(text: 'UTC');
  String _day = _reportDayString(DateTime.now().toUtc());
  Future<DailyReport>? _report;
  String? _error;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    final timezoneId = await widget.repository.reportTimezoneId();
    final local = tz.TZDateTime.now(tz.getLocation(timezoneId));
    _timezone.text = timezoneId;
    _day = _reportDayString(local);
    _refresh();
  }

  void _refresh() {
    setState(() {
      _error = null;
      _report = widget.repository
          .dailyReport(day: _day, timezoneId: _timezone.text.trim())
          .catchError((Object error) {
        if (mounted) setState(() => _error = error.toString());
        throw error;
      });
    });
  }

  Future<void> _chooseDay() async {
    final parts = _day.split('-').map(int.parse).toList();
    final selected = await showDatePicker(
      context: context,
      initialDate: DateTime(parts[0], parts[1], parts[2]),
      firstDate: DateTime(1970),
      lastDate: DateTime(9998, 12, 31),
    );
    if (selected != null) {
      _day = _reportDayString(selected);
      _refresh();
    }
  }

  Future<void> _applyTimezone() async {
    try {
      await widget.repository.setReportTimezoneId(_timezone.text.trim());
      _refresh();
    } catch (error) {
      setState(() => _error = error.toString());
    }
  }

  @override
  void dispose() {
    _timezone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<DailyReport>(
      future: _report,
      builder: (context, snapshot) {
        final report = snapshot.data;
        return ListView(padding: const EdgeInsets.all(20), children: [
          Text('Daily report · $_day',
              style: Theme.of(context).textTheme.headlineMedium),
          Wrap(spacing: 8, runSpacing: 8, children: [
            OutlinedButton.icon(
              onPressed: _chooseDay,
              icon: const Icon(Icons.calendar_today),
              label: const Text('Choose date'),
            ),
            SizedBox(
              width: 220,
              child: TextField(
                controller: _timezone,
                decoration:
                    const InputDecoration(labelText: 'IANA report timezone'),
                onSubmitted: (_) => _applyTimezone(),
              ),
            ),
            FilledButton(
                onPressed: _applyTimezone, child: const Text('Apply timezone')),
          ]),
          if (_error != null)
            Text(_error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error)),
          const SizedBox(height: 16),
          Wrap(spacing: 10, runSpacing: 10, children: [
            _Metric(
                'Completed', '${report?.completedIntervals ?? 0}', Icons.done),
            _Metric(
                'Missed', '${report?.missedIntervals ?? 0}', Icons.timelapse),
            _Metric('Tracked', '${report?.totalTrackedMinutes ?? 0} min',
                Icons.schedule),
            _Metric(
                'Focus score', '${report?.focusScore ?? 0}%', Icons.auto_graph),
            _Metric('Completion', '${report?.completionPercentage ?? 0}%',
                Icons.task_alt),
            _Metric(
                'Average delay',
                '${report?.averageResponseDelayMinutes ?? 0} min',
                Icons.av_timer),
            _Metric('Longest streak', '${report?.longestFocusStreak ?? 0}',
                Icons.local_fire_department_outlined),
          ]),
          Card(
            child: ListTile(
              leading: const Icon(Icons.psychology_alt_outlined),
              title: const Text('Most common activity'),
              subtitle:
                  Text(report?.mostCommonActivity ?? 'No activity recorded'),
            ),
          ),
          Text(
              'Report timezone: ${report?.timezoneId ?? _timezone.text}; local day length: ${report?.dayDurationMinutes ?? 1440} minutes'),
          Text(
              'Categories: ${report?.categories.entries.map((entry) => '${entry.key}: ${entry.value}').join(', ') ?? 'none'}'),
          Text(
              'Reminder states: ${report?.occurrenceStates.entries.map((entry) => '${entry.key.toLowerCase()}: ${entry.value}').join(', ') ?? 'none'}'),
          const SizedBox(height: 16),
          Text('Complete timeline',
              style: Theme.of(context).textTheme.titleLarge),
          if (report != null && report.timeline.isEmpty)
            const Text('No events recorded.'),
          for (final item in report?.timeline ?? <ReportTimelineItem>[])
            ListTile(
              dense: true,
              title: Text(item.title),
              subtitle: Text(
                  '${_reportTime(item.occurredAt, report!.timezoneId)} · ${item.detail}'
                  '${item.originalTimezoneId == null ? '' : '\nRecorded in ${item.originalTimezoneId}'}'),
            ),
          if (report != null && report.wordCloud.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Activity words',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final word in report.wordCloud.entries)
                  Chip(label: Text('${word.key}  ${word.value}')),
              ],
            ),
          ],
          const SizedBox(height: 16),
          Text(
              'Trends: week ${report?.weekly ?? 0}, month ${report?.monthly ?? 0}, year ${report?.yearly ?? 0} check-ins')
        ]);
      });
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value, this.icon);
  final String label;
  final String value;
  final IconData icon;
  @override
  Widget build(BuildContext context) => SizedBox(
        width: 164,
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 12),
              Text(value,
                  style: Theme.of(context)
                      .textTheme
                      .headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w700)),
              Text(label),
            ]),
          ),
        ),
      );
}

class _Heatmap extends StatefulWidget {
  const _Heatmap({required this.repository});
  final FocusLogRepository repository;

  @override
  State<_Heatmap> createState() => _HeatmapState();
}

class _HeatmapState extends State<_Heatmap> {
  final _timezone = TextEditingController(text: 'UTC');
  int _year = DateTime.now().toUtc().year;
  Future<YearHeatmap>? _heatmap;
  String? _error;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    final timezoneId = await widget.repository.reportTimezoneId();
    final local = tz.TZDateTime.now(tz.getLocation(timezoneId));
    _timezone.text = timezoneId;
    _year = local.year;
    _refresh();
  }

  void _refresh() {
    setState(() {
      _error = null;
      _heatmap = widget.repository
          .heatmap(_year, timezoneId: _timezone.text.trim())
          .catchError((Object error) {
        if (mounted) setState(() => _error = error.toString());
        throw error;
      });
    });
  }

  Future<void> _applyTimezone() async {
    try {
      await widget.repository.setReportTimezoneId(_timezone.text.trim());
      _refresh();
    } catch (error) {
      setState(() => _error = error.toString());
    }
  }

  @override
  void dispose() {
    _timezone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<YearHeatmap>(
      future: _heatmap,
      builder: (context, snapshot) {
        final heatmap = snapshot.data;
        final days = heatmap?.days ?? <HeatmapDay>[];
        final leadingDays = DateTime.utc(_year, 1, 1).weekday % 7;
        return ListView(padding: const EdgeInsets.all(20), children: [
          Text('$_year activity calendar',
              style: Theme.of(context).textTheme.headlineSmall),
          Wrap(spacing: 8, runSpacing: 8, children: [
            IconButton(
                tooltip: 'Previous year',
                onPressed: _year <= 1970
                    ? null
                    : () {
                        _year -= 1;
                        _refresh();
                      },
                icon: const Icon(Icons.chevron_left)),
            Text('$_year', style: Theme.of(context).textTheme.titleLarge),
            IconButton(
                tooltip: 'Next year',
                onPressed: _year >= 9998
                    ? null
                    : () {
                        _year += 1;
                        _refresh();
                      },
                icon: const Icon(Icons.chevron_right)),
            SizedBox(
              width: 220,
              child: TextField(
                controller: _timezone,
                decoration:
                    const InputDecoration(labelText: 'IANA report timezone'),
                onSubmitted: (_) => _applyTimezone(),
              ),
            ),
            FilledButton(
                onPressed: _applyTimezone, child: const Text('Apply timezone')),
          ]),
          if (_error != null)
            Text(_error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error)),
          Text(heatmap?.metricDescription ?? ''),
          const SizedBox(height: 12),
          Semantics(
            label:
                '$_year activity heatmap in ${heatmap?.timezoneId ?? _timezone.text}',
            child: SizedBox(
              height: 7 * 34,
              child: GridView.builder(
                scrollDirection: Axis.horizontal,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7,
                  mainAxisSpacing: 2,
                  crossAxisSpacing: 2,
                ),
                itemCount: leadingDays + days.length,
                itemBuilder: (context, index) {
                  if (index < leadingDays) return const SizedBox.shrink();
                  final day = days[index - leadingDays];
                  return _DayCell(
                    day: day.day,
                    count: day.value,
                    intensity: day.intensity,
                    timezoneId: heatmap!.timezoneId,
                    onSelected: () async {
                      final report = await widget.repository.dailyReport(
                          day: day.day, timezoneId: heatmap.timezoneId);
                      if (context.mounted) {
                        showModalBottomSheet<void>(
                          context: context,
                          isScrollControlled: true,
                          builder: (context) => ListView(
                            padding: const EdgeInsets.all(20),
                            children: [
                              Text('${day.day} complete log',
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineSmall),
                              Text('Report timezone: ${heatmap.timezoneId}'),
                              const SizedBox(height: 12),
                              Wrap(spacing: 8, runSpacing: 8, children: [
                                Chip(
                                    label: Text(
                                        '${report.completedIntervals} completed')),
                                Chip(
                                    label: Text(
                                        '${report.missedIntervals} missed')),
                                Chip(
                                    label: Text(
                                        '${report.completionPercentage}% completion')),
                                Chip(
                                    label: Text(
                                        '${report.averageResponseDelayMinutes}m average delay')),
                                Chip(
                                    label: Text(
                                        '${report.totalTrackedMinutes}m tracked')),
                              ]),
                              const SizedBox(height: 12),
                              if (report.timeline.isEmpty)
                                const Text('No activity recorded.'),
                              for (final entry in report.timeline)
                                ListTile(
                                  title: Text(entry.title),
                                  subtitle: Text(
                                      '${_reportTime(entry.occurredAt, heatmap.timezoneId)} · ${entry.detail}'),
                                ),
                            ],
                          ),
                        );
                      }
                    },
                  );
                },
              ),
            ),
          ),
          Text(
            days
                    .where((day) => day.value > 0)
                    .map((day) => '${day.day}: ${day.value}')
                    .join('; ')
                    .isEmpty
                ? 'No activity in $_year.'
                : days
                    .where((day) => day.value > 0)
                    .map((day) => '${day.day}: ${day.value}')
                    .join('; '),
            semanticsLabel: 'Text alternative for the activity heatmap',
          ),
        ]);
      });
}

class _DayCell extends StatelessWidget {
  const _DayCell(
      {required this.day,
      required this.count,
      required this.intensity,
      required this.timezoneId,
      required this.onSelected});
  final String day;
  final int count;
  final int intensity;
  final String timezoneId;
  final Future<void> Function() onSelected;
  @override
  Widget build(BuildContext context) => Semantics(
      label:
          '$day: $count check-ins, intensity $intensity of 4, report timezone $timezoneId',
      button: true,
      child: Tooltip(
          message: '$day: $count check-ins',
          child: InkWell(
              onTap: () => onSelected(),
              child: Card(
                  color: intensity == 0
                      ? null
                      : Colors.green.withValues(alpha: 0.2 + intensity * 0.18),
                  child: const SizedBox.square(dimension: 28)))));
}

class _Settings extends StatefulWidget {
  const _Settings({
    required this.repository,
    required this.scheduler,
    required this.syncStatus,
    required this.onSync,
    required this.onPair,
  });
  final FocusLogRepository repository;
  final ReminderScheduler scheduler;
  final String syncStatus;
  final Future<void> Function() onSync;
  final VoidCallback onPair;
  @override
  State<_Settings> createState() => _SettingsState();
}

class _SettingsState extends State<_Settings> {
  final _recoveryKey = TextEditingController();
  final _customInterval = TextEditingController();
  int _interval = 15;
  String _status = '';

  @override
  void initState() {
    super.initState();
    widget.repository.reminderIntervalMinutes().then((value) {
      if (mounted) setState(() => _interval = value);
    });
  }

  @override
  void dispose() {
    _recoveryKey.dispose();
    _customInterval.dispose();
    super.dispose();
  }

  Future<void> _setInterval(int value) async {
    try {
      await widget.repository.setReminderInterval(value);
      final reminder = await widget.repository.nextScheduledReminder();
      if (reminder != null &&
          (reminder.state == 'SCHEDULED' || reminder.state == 'SNOOZED')) {
        await widget.scheduler.schedule(reminder.id, reminder.dueAt);
      }
      if (mounted) {
        setState(() {
          _interval = value;
          _status = 'Check-in interval updated to $value minutes.';
        });
      }
    } catch (error) {
      if (mounted) setState(() => _status = _friendlyError(error));
    }
  }

  Future<void> _createArchive(String kind) async {
    final key = await BackupRecoveryKeyService().loadOrCreate();
    final service = MobileBackupService(
      widget.repository.database,
      identity: widget.repository.identity,
    );
    final bytes = await service.createArchive(key, kind: kind);
    final directory = await getApplicationDocumentsDirectory();
    final extension = kind == 'EXPORT' ? 'focuslog-export' : 'focuslog-backup';
    final suggested =
        'FocusLog-${DateTime.now().toUtc().toIso8601String().substring(0, 10)}.$extension';
    final selected = await FilePicker.platform.saveFile(
      dialogTitle:
          kind == 'EXPORT' ? 'Export FocusLog data' : 'Create encrypted backup',
      fileName: suggested,
      type: FileType.custom,
      allowedExtensions: [extension],
      bytes: Uint8List.fromList(bytes),
    );
    final destination = selected ?? path.join(directory.path, suggested);
    if (selected == null) {
      await service.writeArchiveAtomically(File(destination), bytes);
    }
    if (!mounted) return;
    setState(() {
      _recoveryKey.text = formatRecoveryKey(key);
      _status = 'Encrypted ${kind.toLowerCase()} written to $destination';
    });
  }

  Future<void> _restore() async {
    final selection = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['focuslog-backup', 'focuslog-export'],
      withData: true,
    );
    if (selection == null) return;
    final selected = selection.files.single;
    final bytes = selected.bytes ??
        (selected.path == null
            ? null
            : await File(selected.path!).readAsBytes());
    if (bytes == null) {
      throw StateError('The selected backup could not be read.');
    }
    await MobileBackupService(widget.repository.database).restoreArchive(
      bytes,
      _recoveryKey.text,
      identityService: DeviceIdentityService(),
      fallbackIdentity: widget.repository.identity,
    );
    if (mounted) {
      setState(() =>
          _status = 'Backup restored and validated. Restarting FocusLog…');
    }
    await SystemNavigator.pop();
  }

  Future<void> _permanentDelete() async {
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Permanently delete all data?'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Type DELETE ALL FOCUSLOG DATA',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(
              context,
              controller.text == 'DELETE ALL FOCUSLOG DATA',
            ),
            child: const Text('Delete permanently'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (confirmed != true) return;
    final endpoint = const String.fromEnvironment('FOCUSLOG_API_URL');
    FocusLogApiClient? client;
    if (endpoint.isNotEmpty) {
      client = FocusLogApiClient(
        endpoint: Uri.parse(endpoint),
        identity: widget.repository.identity,
        identityService: DeviceIdentityService(),
      );
    }
    try {
      await PermanentDeletionService(
        database: widget.repository.database,
        identityService: DeviceIdentityService(),
        databaseKeyService: DatabaseKeyService(),
        backupKeyService: BackupRecoveryKeyService(),
      ).deleteAll(remote: client);
    } finally {
      client?.dispose();
    }
    await SystemNavigator.pop();
  }

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Settings', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 12),
          Text('Check-in interval',
              style: Theme.of(context).textTheme.titleLarge),
          Text('Current interval: $_interval minutes'),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final value in const [
                5,
                10,
                15,
                20,
                25,
                30,
                45,
                60,
                90,
                120
              ])
                ChoiceChip(
                  label: Text('${value}m'),
                  selected: _interval == value,
                  onSelected: (_) => _setInterval(value),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _customInterval,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Custom minutes',
                  helperText: '5–240 minutes',
                ),
              ),
            ),
            const SizedBox(width: 10),
            FilledButton.tonal(
              onPressed: () {
                final value = int.tryParse(_customInterval.text);
                if (value == null) {
                  setState(() => _status = 'Enter a whole number from 5–240.');
                } else {
                  _setInterval(value);
                }
              },
              child: const Text('Apply'),
            ),
          ]),
          const Divider(height: 36),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Synchronization'),
            subtitle: Text(widget.syncStatus),
            trailing: FilledButton(
                onPressed: widget.onSync, child: const Text('Sync now')),
          ),
          const ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('Battery optimization'),
            subtitle: Text(
              'FocusLog does not disable Android battery controls. If reminders are delayed, allow notifications and review the app battery setting.',
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.devices_outlined),
            title: const Text('Pair a trusted device'),
            subtitle: const Text('Use a temporary code from the owner desktop'),
            trailing: const Icon(Icons.chevron_right),
            onTap: widget.onPair,
          ),
          const Divider(),
          Text('Encrypted backup and export',
              style: Theme.of(context).textTheme.titleLarge),
          const Text(
              'Keep the recovery key separately. The service cannot recover it.'),
          Wrap(
            spacing: 8,
            children: [
              FilledButton(
                onPressed: () => _createArchive('BACKUP'),
                child: const Text('Create backup'),
              ),
              OutlinedButton(
                onPressed: () => _createArchive('EXPORT'),
                child: const Text('Export data'),
              ),
            ],
          ),
          TextField(
            controller: _recoveryKey,
            autocorrect: false,
            enableSuggestions: false,
            decoration: const InputDecoration(labelText: 'Recovery key'),
          ),
          OutlinedButton(
            onPressed: _restore,
            child: const Text('Restore / import'),
          ),
          const Divider(),
          FilledButton(
            onPressed: _permanentDelete,
            child: const Text('Permanently delete all data'),
          ),
          Text(_status, semanticsLabel: 'Security operation status: $_status'),
        ],
      );
}

class _Pairing extends StatefulWidget {
  const _Pairing({required this.repository});
  final FocusLogRepository repository;
  @override
  State<_Pairing> createState() => _PairingState();
}

class _PairingState extends State<_Pairing> {
  final _endpoint = TextEditingController(
      text: const String.fromEnvironment('FOCUSLOG_API_URL'));
  final _code = TextEditingController();
  String? _pairingId;
  String _status = 'Enter the temporary code displayed by the owner desktop.';
  @override
  void dispose() {
    _endpoint.dispose();
    _code.dispose();
    super.dispose();
  }

  FocusLogApiClient _client() {
    final value = _endpoint.text.trim();
    if (value.isEmpty) throw StateError('Enter the FocusLog server address.');
    return FocusLogApiClient(
        endpoint: Uri.parse(value),
        identity: widget.repository.identity,
        identityService: DeviceIdentityService());
  }

  Future<void> _claim() async {
    final client = _client();
    try {
      final result = await client.claimPairingCode(_code.text);
      if (mounted) {
        setState(() {
          _pairingId = result['pairingId'] as String;
          _status =
              'Pairing request sent. Approve it on the owner desktop, then select Finish pairing.';
        });
      }
    } finally {
      client.dispose();
    }
  }

  Future<void> _finish() async {
    final pairingId = _pairingId;
    if (pairingId == null) return;
    final service = DeviceIdentityService();
    final client = FocusLogApiClient(
        endpoint: Uri.parse(_endpoint.text.trim()),
        identity: widget.repository.identity,
        identityService: service);
    try {
      final result = await client.consumePairing(pairingId);
      await widget.repository
          .adoptPairedOwner(result['ownerId'] as String, service);
      await widget.repository.ensureIdentity();
      if (mounted) {
        setState(() => _status = 'This Android device is now trusted.');
      }
    } finally {
      client.dispose();
    }
  }

  @override
  Widget build(BuildContext context) =>
      ListView(padding: const EdgeInsets.all(20), children: [
        Text('Pair trusted device',
            style: Theme.of(context).textTheme.headlineMedium),
        const Text(
            'FocusLog has one owner and trusted devices. Pairing needs approval on the owner desktop.'),
        TextField(
            controller: _endpoint,
            keyboardType: TextInputType.url,
            decoration:
                const InputDecoration(labelText: 'FocusLog server URL')),
        TextField(
            controller: _code,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(labelText: 'Pairing code')),
        const SizedBox(height: 16),
        FilledButton(
            onPressed: () async {
              try {
                await _claim();
              } catch (error) {
                if (mounted) setState(() => _status = _friendlyError(error));
              }
            },
            child: const Text('Request pairing')),
        OutlinedButton(
            onPressed: () async {
              try {
                await _finish();
              } catch (error) {
                if (mounted) setState(() => _status = _friendlyError(error));
              }
            },
            child: const Text('Finish after approval')),
        const SizedBox(height: 12),
        Text(_status)
      ]);
}

String _countdown(Duration duration) {
  if (duration.isNegative) return '00:00';
  final hours = duration.inHours;
  final minutes = duration.inMinutes.remainder(60);
  final seconds = duration.inSeconds.remainder(60);
  if (hours > 0) {
    return '${hours.toString().padLeft(2, '0')}:'
        '${minutes.toString().padLeft(2, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }
  return '${minutes.toString().padLeft(2, '0')}:'
      '${seconds.toString().padLeft(2, '0')}';
}

String _greeting() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

String _friendlyError(Object error) {
  final message = error.toString();
  if (message.contains('Failed host lookup') ||
      message.contains('SocketException') ||
      message.contains('Connection refused')) {
    return 'FocusLog cannot reach the server. Your work is safe offline; check your connection and try again.';
  }
  return message
      .replaceFirst('ClientException with SocketException: ', '')
      .replaceFirst('Exception: ', '');
}
