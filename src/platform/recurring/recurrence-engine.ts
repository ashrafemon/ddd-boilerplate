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

/**
 * Pure calendar-date arithmetic. `from` and the return value are UTC-midnight
 * Dates representing a timezone-less calendar date (matching Prisma's
 * @db.Date mapping); `timeZone` only interprets the calendar rollover.
 *
 * dayjs's .add(n, 'month' | 'year') clamps the day-of-month to the target
 * month's last valid day — that clamping IS the month-end/leap-year handling.
 */
export class RecurrenceEngine {
  static nextRunDate(
    frequency: RecurrenceFrequency,
    interval: number,
    from: Date,
    timeZone: string,
  ): Date {
    if (!Number.isInteger(interval) || interval <= 0) {
      throw new Error(`interval must be a positive integer, got ${interval}`);
    }
    const wallDate = `${from.getUTCFullYear()}-${pad(from.getUTCMonth() + 1)}-${pad(from.getUTCDate())}`;
    const unit = UNIT_BY_FREQUENCY[frequency];
    const next = dayjs.tz(wallDate, timeZone).add(interval, unit);
    return new Date(Date.UTC(next.year(), next.month(), next.date()));
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
