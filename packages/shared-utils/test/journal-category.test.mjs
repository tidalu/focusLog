import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeJournalCategory, parseJournalEntry } from '../dist/index.js';

test('parses only a leading category token and separates the journal text', () => {
  assert.deepEqual(parseJournalEntry('<study> Solved a sliding window problem.'), {
    category: 'study',
    text: 'Solved a sliding window problem.',
    hasCategoryToken: true
  });
  assert.deepEqual(parseJournalEntry('Watching YouTube'), {
    category: 'Uncategorized',
    text: 'Watching YouTube',
    hasCategoryToken: false
  });
  assert.equal(parseJournalEntry('Worked on <study> notes').category, 'Uncategorized');
});

test('normalizes category identity without changing authored entry storage', () => {
  assert.equal(normalizeJournalCategory('  Deep   Work  '), 'deep work');
  assert.equal(parseJournalEntry('<Deep Work> Plan the release').category, 'deep work');
});
