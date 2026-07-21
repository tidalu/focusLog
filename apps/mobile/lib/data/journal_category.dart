class JournalEntryParts {
  const JournalEntryParts({
    required this.category,
    required this.text,
    required this.hasCategoryToken,
  });

  final String category;
  final String text;
  final bool hasCategoryToken;
}

String normalizeJournalCategory(String value) =>
    value.trim().replaceAll(RegExp(r'\s+'), ' ').toLowerCase();

JournalEntryParts parseJournalEntry(String value) {
  final body = value.trim();
  final match = RegExp(r'^<([^<>\r\n]{1,80})>\s*').firstMatch(body);
  if (match == null) {
    return JournalEntryParts(
      category: 'Uncategorized',
      text: body,
      hasCategoryToken: false,
    );
  }
  final category = normalizeJournalCategory(match.group(1) ?? '');
  if (category.isEmpty) {
    return JournalEntryParts(
      category: 'Uncategorized',
      text: body,
      hasCategoryToken: false,
    );
  }
  return JournalEntryParts(
    category: category,
    text: body.substring(match.end).trim(),
    hasCategoryToken: true,
  );
}
