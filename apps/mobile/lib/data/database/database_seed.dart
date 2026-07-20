import 'app_database.dart';

Future<void> seedDatabase(AppDatabase database) async {
  const ownerId = '01J00000000000000000000000';
  final now = DateTime.utc(2026, 7, 20, 12);

  await database.customStatement(
      'INSERT OR IGNORE INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)',
      [ownerId, now.millisecondsSinceEpoch, now.millisecondsSinceEpoch]);
}
