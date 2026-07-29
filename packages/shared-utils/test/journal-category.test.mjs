import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeJournalCategory, parseJournalEntry, parseJournalLog } from '../dist/index.js';

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

test('parses ordered sections and hierarchical category paths', () => {
  assert.deepEqual(
    parseJournalLog(
      `<shopping>\nBought milk, eggs and chicken.\n\n<sleep>\nSlept well.\n\n<study><leetcode>\nSolved problem 904.`
    ),
    {
      sections: [
        {
          categoryPath: ['shopping'],
          path: 'shopping',
          text: 'Bought milk, eggs and chicken.',
          metadata: {},
          position: 0
        },
        {
          categoryPath: ['sleep'],
          path: 'sleep',
          text: 'Slept well.',
          metadata: {},
          position: 1
        },
        {
          categoryPath: ['study', 'leetcode'],
          path: 'study/leetcode',
          text: 'Solved problem 904.',
          metadata: {},
          position: 2
        }
      ]
    }
  );
});

test('supports inline bodies, untagged leading text, and optional metadata', () => {
  assert.deepEqual(
    parseJournalLog(
      `A note before tags.\n\n<study><books> Read chapter 6.\n#duration=95m\n#score=8/10`
    ).sections,
    [
      {
        categoryPath: [],
        path: 'Uncategorized',
        text: 'A note before tags.',
        metadata: {},
        position: 0
      },
      {
        categoryPath: ['study', 'books'],
        path: 'study/books',
        text: 'Read chapter 6.',
        metadata: { duration: '95m', score: '8/10' },
        position: 1
      }
    ]
  );
});
