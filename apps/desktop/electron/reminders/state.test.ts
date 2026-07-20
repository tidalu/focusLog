import { describe, expect, it } from 'vitest';
import { transitionReminder } from './state.js';

describe('reminder state machine', () => {
  it('supports due, snooze, due, presented, and completed lifecycle', () => {
    expect(transitionReminder('SCHEDULED', 'DUE')).toBe('DUE');
    expect(transitionReminder('DUE', 'SNOOZED')).toBe('SNOOZED');
    expect(transitionReminder('SNOOZED', 'DUE')).toBe('DUE');
    expect(transitionReminder('DUE', 'PRESENTED')).toBe('PRESENTED');
    expect(transitionReminder('PRESENTED', 'COMPLETED', 'Writing the production test suite')).toBe(
      'COMPLETED'
    );
  });
  it('supports missed reminders and rejects short completion text', () => {
    expect(transitionReminder('DUE', 'MISSED')).toBe('MISSED');
    expect(() => transitionReminder('DUE', 'COMPLETED', 'short')).toThrow('20 Unicode');
  });
});
