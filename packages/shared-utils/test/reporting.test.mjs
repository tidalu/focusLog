import assert from 'node:assert/strict';
import test from 'node:test';

import { heatmapDays, localDayForInstant, reportDayBounds, reportYearDays } from '../dist/index.js';

test('report day bounds follow Europe/Warsaw spring DST', () => {
  const bounds = reportDayBounds('2026-03-29', 'Europe/Warsaw');
  assert.equal(bounds.start.toISOString(), '2026-03-28T23:00:00.000Z');
  assert.equal(bounds.end.toISOString(), '2026-03-29T22:00:00.000Z');
  assert.equal(bounds.durationMinutes, 23 * 60);
});

test('report day bounds follow Europe/Warsaw autumn DST', () => {
  const bounds = reportDayBounds('2026-10-25', 'Europe/Warsaw');
  assert.equal(bounds.start.toISOString(), '2026-10-24T22:00:00.000Z');
  assert.equal(bounds.end.toISOString(), '2026-10-25T23:00:00.000Z');
  assert.equal(bounds.durationMinutes, 25 * 60);
  assert.equal(localDayForInstant('2026-10-25T22:30:00.000Z', 'Europe/Warsaw'), '2026-10-25');
});

test('calendar years include every date and leap day', () => {
  assert.equal(reportYearDays(2025).length, 365);
  const leap = reportYearDays(2024);
  assert.equal(leap.length, 366);
  assert.ok(leap.includes('2024-02-29'));
});

test('heatmap uses active-day quartiles and retains zero days', () => {
  const result = heatmapDays(
    2025,
    new Map([
      ['2025-01-01', 1],
      ['2025-01-02', 2],
      ['2025-01-03', 3],
      ['2025-01-04', 9]
    ])
  );
  assert.deepEqual(result.thresholds, [1, 2, 3]);
  assert.deepEqual(
    result.days.slice(0, 5).map(({ value, intensity }) => [value, intensity]),
    [
      [1, 1],
      [2, 2],
      [3, 3],
      [9, 4],
      [0, 0]
    ]
  );
});
