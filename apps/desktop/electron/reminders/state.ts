export type ReminderState =
  | 'SCHEDULED'
  | 'DUE'
  | 'PRESENTED'
  | 'SNOOZED'
  | 'COMPLETED'
  | 'MISSED'
  | 'SKIPPED'
  | 'EMERGENCY_DISMISSED'
  | 'SUPERSEDED';

const terminal = new Set<ReminderState>([
  'COMPLETED',
  'MISSED',
  'SKIPPED',
  'EMERGENCY_DISMISSED',
  'SUPERSEDED'
]);

export function transitionReminder(
  from: ReminderState,
  to: ReminderState,
  responseText?: string
): ReminderState {
  if (terminal.has(from)) throw new Error(`Cannot transition terminal reminder state ${from}.`);
  const allowed: Record<ReminderState, ReminderState[]> = {
    SCHEDULED: ['DUE', 'SUPERSEDED'],
    DUE: ['PRESENTED', 'SNOOZED', 'MISSED', 'COMPLETED', 'SKIPPED', 'EMERGENCY_DISMISSED'],
    PRESENTED: ['COMPLETED', 'SNOOZED', 'MISSED', 'SKIPPED', 'EMERGENCY_DISMISSED'],
    SNOOZED: ['DUE', 'SUPERSEDED'],
    COMPLETED: [],
    MISSED: [],
    SKIPPED: [],
    EMERGENCY_DISMISSED: [],
    SUPERSEDED: []
  };
  if (!allowed[from].includes(to)) throw new Error(`Invalid reminder transition ${from} -> ${to}.`);
  if (to === 'COMPLETED' && [...(responseText?.trim() ?? '')].length < 20)
    throw new Error('Reminder completion requires at least 20 Unicode characters.');
  return to;
}
