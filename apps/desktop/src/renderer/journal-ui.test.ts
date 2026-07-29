import { describe, expect, it } from 'vitest';

import { newestHistoryFirst } from './journal-ui';

describe('journal history ordering', () => {
  it('places the most recently submitted log first without mutating the source list', () => {
    const entries = [
      { id: 'morning', submittedAt: '2026-07-21T08:08:00.000Z' },
      { id: 'afternoon', submittedAt: '2026-07-21T14:10:00.000Z' },
      { id: 'early', submittedAt: '2026-07-21T03:41:00.000Z' }
    ];

    expect(newestHistoryFirst(entries).map((entry) => entry.id)).toEqual([
      'afternoon',
      'morning',
      'early'
    ]);
    expect(entries.map((entry) => entry.id)).toEqual(['morning', 'afternoon', 'early']);
  });
});
