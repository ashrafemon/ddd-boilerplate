import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

const UNIT_BY_FREQUENCY: Record<RecurrenceFrequency, 'day' | 'week' | 'month' | 'year'> = {
  DAILY: 'day',
  WEEKLY: 'week',
  MONTHLY: 'month',
  YEARLY: 'year',
};

/** Safety bound for the anchor walk-forward (interval could be tiny vs a long pause). */
const MAX_ANCHOR_STEPS = 10_000;

/**
 * Pure calendar-date arithmetic. `from` and the return value are UTC-midnight
 * Dates representing a timezone-less calendar date (matching Prisma's
 * @db.Date mapping); `timeZone` only interprets the calendar rollover.
 */
export class RecurrenceEngine {
  static nextRunDate(
    frequency: RecurrenceFrequency,
    interval: number,
    from: Date,
    timeZone: string,
    anchor?: Date,
  ): Date {
    if (!Number.isInteger(interval) || interval <= 0) {
      throw new Error(`interval must be a positive integer, got ${interval}`);
    }
    const unit = UNIT_BY_FREQUENCY[frequency];

    // MONTHLY/YEARLY keep the anchor day-of-month (RFC 5545): Jan 31 →
    // Feb 28 → Mar 31 → … instead of permanently drifting to the 28th.
    if (anchor && (frequency === 'MONTHLY' || frequency === 'YEARLY')) {
      const base = dayjs.tz(wallOf(anchor), timeZone);
      for (let step = 1; step <= MAX_ANCHOR_STEPS; step++) {
        const candidate = base.add(step * interval, unit);
        if (isAfterWall(candidate, from)) {
          return utcMidnight(candidate);
        }
      }
      throw new Error(
        `Recurrence anchor walk exceeded ${MAX_ANCHOR_STEPS} steps (interval too small?)`,
      );
    }

    // dayjs's .add(n, 'month' | 'year') clamps the day-of-month to the
    // target month's last valid day — that clamping IS month-end handling.
    const next = dayjs.tz(wallOf(from), timeZone).add(interval, unit);
    return utcMidnight(next);
  }
}

function wallOf(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function utcMidnight(m: dayjs.Dayjs): Date {
  return new Date(Date.UTC(m.year(), m.month(), m.date()));
}

function isAfterWall(candidate: dayjs.Dayjs, from: Date): boolean {
  return utcMidnight(candidate).getTime() > from.getTime();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
