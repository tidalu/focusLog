export interface ReminderPolicy {
  cadence: 'FIXED_FROM_SESSION_START';
  intervalMinutes: number;
  responseWindowMinutes: number;
  snoozeMinutes: number[];
  maxSnoozes: number;
  allowLateCompletion: boolean;
}

export const defaultReminderPolicy: ReminderPolicy = {
  cadence: 'FIXED_FROM_SESSION_START',
  intervalMinutes: 30,
  responseWindowMinutes: 60,
  snoozeMinutes: [5, 10, 15],
  maxSnoozes: 3,
  allowLateCompletion: true
};

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

export function parseReminderPolicy(value: unknown): ReminderPolicy {
  let candidate: Record<string, unknown> = {};
  try {
    candidate =
      typeof value === 'string'
        ? (JSON.parse(value) as Record<string, unknown>)
        : ((value as Record<string, unknown>) ?? {});
  } catch {
    candidate = {};
  }
  const snoozes = Array.isArray(candidate.snoozeMinutes)
    ? candidate.snoozeMinutes
        .map((minutes) => boundedInteger(minutes, 0, 1, 120))
        .filter((minutes) => minutes > 0)
        .slice(0, 5)
    : defaultReminderPolicy.snoozeMinutes;
  return {
    cadence: 'FIXED_FROM_SESSION_START',
    intervalMinutes: boundedInteger(
      candidate.intervalMinutes,
      defaultReminderPolicy.intervalMinutes,
      1,
      1440
    ),
    responseWindowMinutes: boundedInteger(
      candidate.responseWindowMinutes,
      defaultReminderPolicy.responseWindowMinutes,
      5,
      1440
    ),
    snoozeMinutes: snoozes.length ? [...new Set(snoozes)] : defaultReminderPolicy.snoozeMinutes,
    maxSnoozes: boundedInteger(candidate.maxSnoozes, defaultReminderPolicy.maxSnoozes, 0, 10),
    allowLateCompletion:
      typeof candidate.allowLateCompletion === 'boolean'
        ? candidate.allowLateCompletion
        : defaultReminderPolicy.allowLateCompletion
  };
}
