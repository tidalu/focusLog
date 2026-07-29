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

  test('parses ordered hierarchical sections and metadata', () {
    final parsed = parseJournalLog('''<shopping>
Bought groceries.

<study><leetcode>
Solved problem 904.
#difficulty=Hard''');

    expect(parsed.sections, hasLength(2));
    expect(parsed.sections.first.path, 'shopping');
    expect(parsed.sections.last.categoryPath, ['study', 'leetcode']);
    expect(parsed.sections.last.text, 'Solved problem 904.');
    expect(parsed.sections.last.metadata, {'difficulty': 'Hard'});
  });
}
