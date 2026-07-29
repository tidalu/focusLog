import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/data/database/app_database.dart';

void main() {
  test('creates the Drift local schema', () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);

    final result = await database
        .customSelect(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tombstones'")
        .getSingle();
    expect(result.data['name'], 'tombstones');
    final outbox = await database
        .customSelect(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'outbox_operations'")
        .getSingle();
    expect(outbox.data['name'], 'outbox_operations');
    final sections = await database
        .customSelect(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'log_sections'")
        .getSingle();
    expect(sections.data['name'], 'log_sections');
  });
}
