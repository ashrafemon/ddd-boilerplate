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
 * Pure calendar-date arithmetic — no I/O, no Nest, no Prisma. `from` and the
 * return value are UTC-midnight `Date`s representing a timezone-less
 * calendar date (matching Prisma's `@db.Date` mapping); `timeZone` is used
 * only to interpret the calendar rollover correctly, never to attach a
 * time-of-day.
 *
 * dayjs's `.add(n, 'month' | 'year')` clamps the day-of-month to the target
 * month's last valid day (Jan 31 + 1 month -> Feb 28/29; Feb 29 + 1 year ->
 * Feb 28) — that clamping IS the month-end/leap-year handling required here;
 * no extra logic sits on top of it. Because only the calendar date (not a
 * time-of-day) is carried through `dayjs.tz`, a DST transition falling on or
 * near the computed date never skips or doubles a day.
 */
export function computeNextRunDate(
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

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
