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

class JournalLogSection {
  const JournalLogSection({
    required this.categoryPath,
    required this.path,
    required this.text,
    required this.metadata,
    required this.position,
  });

  final List<String> categoryPath;
  final String path;
  final String text;
  final Map<String, String> metadata;
  final int position;
}

class JournalLogParts {
  const JournalLogParts({required this.sections});

  final List<JournalLogSection> sections;
}

String normalizeJournalCategory(String value) => value
    .trim()
    .replaceAll(RegExp(r'[\\/]+'), ' ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .toLowerCase();

final _sectionHeader = RegExp(
  r'^[\t ]*((?:<[^<>\r\n]{1,80}>[\t ]*)+)(.*)$',
  multiLine: true,
);
final _categoryToken = RegExp(r'<([^<>\r\n]{1,80})>');
final _metadataLine = RegExp(
  r'^\s*#([a-zA-Z][a-zA-Z0-9_.-]{0,63})\s*=\s*(.*?)\s*$',
);

({String text, Map<String, String> metadata}) _extractMetadata(String value) {
  final metadata = <String, String>{};
  final bodyLines = <String>[];
  for (final line in value.split(RegExp(r'\r?\n'))) {
    final match = _metadataLine.firstMatch(line);
    if (match == null) {
      bodyLines.add(line);
    } else {
      metadata[match.group(1)!.toLowerCase()] = match.group(2)!.trim();
    }
  }
  return (text: bodyLines.join('\n').trim(), metadata: metadata);
}

JournalLogParts parseJournalLog(String value) {
  final source = value.trim();
  if (source.isEmpty) {
    return const JournalLogParts(
      sections: [
        JournalLogSection(
          categoryPath: [],
          path: 'Uncategorized',
          text: '',
          metadata: {},
          position: 0,
        ),
      ],
    );
  }

  final headers = _sectionHeader.allMatches(source).toList(growable: false);
  final sections = <JournalLogSection>[];

  void addSection(List<String> categoryPath, String body) {
    final extracted = _extractMetadata(body);
    sections.add(
      JournalLogSection(
        categoryPath: categoryPath,
        path: categoryPath.isEmpty ? 'Uncategorized' : categoryPath.join('/'),
        text: extracted.text,
        metadata: extracted.metadata,
        position: sections.length,
      ),
    );
  }

  if (headers.isEmpty) {
    addSection(const [], source);
    return JournalLogParts(sections: sections);
  }

  final leadingText = source.substring(0, headers.first.start).trim();
  if (leadingText.isNotEmpty) addSection(const [], leadingText);

  for (var index = 0; index < headers.length; index += 1) {
    final header = headers[index];
    final categoryPath = _categoryToken
        .allMatches(header.group(1) ?? '')
        .map((match) => normalizeJournalCategory(match.group(1) ?? ''))
        .where((segment) => segment.isNotEmpty)
        .toList(growable: false);
    final inlineText = (header.group(2) ?? '').trim();
    final bodyStart = header.end;
    final bodyEnd =
        index + 1 < headers.length ? headers[index + 1].start : source.length;
    final followingText = source.substring(bodyStart, bodyEnd).trim();
    final body = [inlineText, followingText]
        .where((part) => part.isNotEmpty)
        .join('\n')
        .trim();
    addSection(categoryPath, body);
  }

  return JournalLogParts(sections: sections);
}

JournalEntryParts parseJournalEntry(String value) {
  final section = parseJournalLog(value).sections.first;
  return JournalEntryParts(
    category: section.categoryPath.isEmpty ? 'Uncategorized' : section.path,
    text: section.text,
    hasCategoryToken: section.categoryPath.isNotEmpty,
  );
}
