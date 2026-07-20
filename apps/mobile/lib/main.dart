import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
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
  Widget build(BuildContext context) => MaterialApp(
        title: 'FocusLog',
        theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
        home: FocusLogHome(repository: repository, scheduler: scheduler),
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
  String _syncStatus = 'Offline-ready';
  final _response = TextEditingController();
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
    _response.dispose();
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
          .then((_) {
        if (mounted) setState(() {});
      }));
    }
  }

  Future<void> _openReminder(String occurrenceId) async {
    await widget.repository.recoverOverdueReminders(reason: 'notification-tap');
    await widget.repository.presentReminder(occurrenceId);
    if (!mounted) return;
    setState(() => _index = 0);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        unawaited(showReminderCompletion(
            context, widget.repository, widget.scheduler, occurrenceId));
      }
    });
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

  @override
  Widget build(BuildContext context) {
    final pages = [
      _Dashboard(
          repository: widget.repository,
          scheduler: widget.scheduler,
          onStart: _start),
      _History(repository: widget.repository),
      _Reports(repository: widget.repository),
      _Heatmap(repository: widget.repository),
      _Settings(
          repository: widget.repository,
          syncStatus: _syncStatus,
          onSync: _sync),
      _Pairing(repository: widget.repository)
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('FocusLog'), actions: [
        Padding(
            padding: const EdgeInsets.all(12),
            child: Center(
                child: Text(_syncStatus,
                    semanticsLabel: 'Synchronization status: $_syncStatus')))
      ]),
      body: SafeArea(child: pages[_index]),
      bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (value) => setState(() => _index = value),
          destinations: const [
            NavigationDestination(
                icon: Icon(Icons.timer_outlined), label: 'Focus'),
            NavigationDestination(icon: Icon(Icons.history), label: 'History'),
            NavigationDestination(
                icon: Icon(Icons.bar_chart), label: 'Reports'),
            NavigationDestination(
                icon: Icon(Icons.calendar_month), label: 'Calendar'),
            NavigationDestination(
                icon: Icon(Icons.settings), label: 'Settings'),
            NavigationDestination(icon: Icon(Icons.devices), label: 'Pair')
          ]),
    );
  }
}

class _Dashboard extends StatelessWidget {
  const _Dashboard(
      {required this.repository,
      required this.scheduler,
      required this.onStart});
  final FocusLogRepository repository;
  final ReminderScheduler scheduler;
  final Future<void> Function() onStart;
  @override
  Widget build(BuildContext context) => FutureBuilder<FocusSessionSummary?>(
      future: repository.activeSession(),
      builder: (context, sessionSnapshot) {
        final active = sessionSnapshot.data;
        return FutureBuilder<ReminderSummary?>(
            future: repository.nextScheduledReminder(),
            builder: (context, reminderSnapshot) {
              final reminder = reminderSnapshot.data;
              return ListView(padding: const EdgeInsets.all(20), children: [
                Text('Focus session',
                    style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 12),
                Text(active == null
                    ? 'No active focus session.'
                    : '${active.name} began ${active.startedAt.toLocal()}'),
                const SizedBox(height: 16),
                FilledButton.icon(
                    onPressed: active == null ? onStart : null,
                    icon: const Icon(Icons.play_arrow),
                    label: const Text('Start focus session')),
                OutlinedButton.icon(
                    onPressed: active == null
                        ? null
                        : () async {
                            await repository.stopFocusSession();
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                      content: Text('Focus session stopped.')));
                            }
                          },
                    icon: const Icon(Icons.stop),
                    label: const Text('Stop session')),
                if (reminder?.state == 'DUE' || reminder?.state == 'PRESENTED')
                  Card(
                      child: ListTile(
                          title: const Text('Check-in due'),
                          subtitle: const Text(
                              'A response of at least 20 characters is required.'),
                          trailing: FilledButton(
                              onPressed: () => showReminderCompletion(
                                  context, repository, scheduler, reminder!.id),
                              child: const Text('Respond')))),
                const Divider(height: 40),
                const Text(
                    'Reminders use standard Android notifications. Android may delay them during battery saving, app force-stop, or OEM task management; FocusLog recovers durable reminders when Android next permits execution.')
              ]);
            });
      });
}

Future<void> showReminderCompletion(
  BuildContext context,
  FocusLogRepository repository,
  ReminderScheduler scheduler,
  String occurrenceId,
) async {
  await repository.presentReminder(occurrenceId);
  if (!context.mounted) return;
  final controller =
      TextEditingController(text: await repository.reminderDraft(occurrenceId));
  if (!context.mounted) {
    controller.dispose();
    return;
  }
  var allowPop = false;
  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (dialogContext) => StatefulBuilder(
      builder: (dialogContext, setDialogState) => PopScope(
        canPop: allowPop,
        child: AlertDialog(
          title: const Text('Complete check-in'),
          content: TextField(
            controller: controller,
            minLines: 4,
            maxLines: 8,
            autofocus: true,
            onChanged: (value) {
              unawaited(repository.preserveReminderDraft(occurrenceId, value));
            },
            decoration: const InputDecoration(
              labelText: 'What are you doing?',
              helperText: 'At least 20 characters',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () async {
                await repository.snoozeReminder(occurrenceId, 5);
                final reminder = await repository.nextScheduledReminder();
                if (reminder != null) {
                  await scheduler.schedule(reminder.id, reminder.dueAt);
                }
                if (dialogContext.mounted) {
                  setDialogState(() => allowPop = true);
                  Navigator.pop(dialogContext);
                }
              },
              child: const Text('Snooze 5 min'),
            ),
            TextButton(
              onPressed: () async {
                await repository.emergencyDismissReminder(occurrenceId);
                await repository.deleteReminderDraft(occurrenceId);
                await scheduler.cancel(occurrenceId);
                if (dialogContext.mounted) {
                  setDialogState(() => allowPop = true);
                  Navigator.pop(dialogContext);
                }
              },
              child: const Text('Emergency dismiss'),
            ),
            FilledButton(
              onPressed: () async {
                try {
                  await repository.completeReminder(
                      occurrenceId, controller.text);
                  await repository.deleteReminderDraft(occurrenceId);
                  await scheduler.cancel(occurrenceId);
                  for (final reminder
                      in await repository.scheduledReminders()) {
                    await scheduler.schedule(reminder.id, reminder.dueAt);
                  }
                  if (dialogContext.mounted) {
                    setDialogState(() => allowPop = true);
                    Navigator.pop(dialogContext);
                  }
                } on ArgumentError catch (error) {
                  if (dialogContext.mounted) {
                    ScaffoldMessenger.of(dialogContext).showSnackBar(
                      SnackBar(content: Text(error.message.toString())),
                    );
                  }
                }
              },
              child: const Text('Complete'),
            ),
          ],
        ),
      ),
    ),
  );
  controller.dispose();
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
          _Metric('Completed intervals', report?.completedIntervals ?? 0),
          _Metric('Missed intervals', report?.missedIntervals ?? 0),
          _Metric('Tracked minutes', report?.totalTrackedMinutes ?? 0),
          _Metric('Focus score', report?.focusScore ?? 0),
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
          const SizedBox(height: 16),
          Text(
              'Trends: week ${report?.weekly ?? 0}, month ${report?.monthly ?? 0}, year ${report?.yearly ?? 0} check-ins')
        ]);
      });
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value);
  final String label;
  final int value;
  @override
  Widget build(BuildContext context) => Card(
      child: ListTile(
          title: Text(label),
          trailing: Text('$value',
              style: Theme.of(context).textTheme.headlineMedium)));
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
                      final log = await widget.repository.dayLog(
                        day.day,
                        timezoneId: heatmap.timezoneId,
                      );
                      if (context.mounted) {
                        showModalBottomSheet<void>(
                          context: context,
                          builder: (context) => ListView(
                            padding: const EdgeInsets.all(20),
                            children: [
                              Text('${day.day} complete log',
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineSmall),
                              Text('Report timezone: ${heatmap.timezoneId}'),
                              if (log.isEmpty)
                                const Text('No activity recorded.'),
                              for (final entry in log)
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
    required this.syncStatus,
    required this.onSync,
  });
  final FocusLogRepository repository;
  final String syncStatus;
  final Future<void> Function() onSync;
  @override
  State<_Settings> createState() => _SettingsState();
}

class _SettingsState extends State<_Settings> {
  final _recoveryKey = TextEditingController();
  String _status = '';

  @override
  void dispose() {
    _recoveryKey.dispose();
    super.dispose();
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
          ListTile(
            title: const Text('Synchronization'),
            subtitle: Text(widget.syncStatus),
            trailing: FilledButton(
                onPressed: widget.onSync, child: const Text('Sync now')),
          ),
          const ListTile(
            title: Text('Battery optimization'),
            subtitle: Text(
              'FocusLog does not disable Android battery controls. If reminders are delayed, allow notifications and review the app battery setting.',
            ),
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
                if (mounted) setState(() => _status = error.toString());
              }
            },
            child: const Text('Request pairing')),
        OutlinedButton(
            onPressed: () async {
              try {
                await _finish();
              } catch (error) {
                if (mounted) setState(() => _status = error.toString());
              }
            },
            child: const Text('Finish after approval')),
        const SizedBox(height: 12),
        Text(_status)
      ]);
}
