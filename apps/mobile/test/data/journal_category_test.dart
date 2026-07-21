import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/data/journal_category.dart';

void main() {
  test('infers only a leading category token', () {
    final parsed = parseJournalEntry('<Study> Solved a graph problem.');
    expect(parsed.category, 'study');
    expect(parsed.text, 'Solved a graph problem.');
    expect(parsed.hasCategoryToken, isTrue);

    final uncategorized = parseJournalEntry('Watching YouTube');
    expect(uncategorized.category, 'Uncategorized');
    expect(uncategorized.text, 'Watching YouTube');
    expect(uncategorized.hasCategoryToken, isFalse);
  });
}
