import { CronExpressionParser } from 'cron-parser';
import { InvalidCronExpressionError } from './scheduler.errors';

/**
 * Pure next-run calculator — not behind a port (no external I/O to swap).
 */
export function computeNextRunAt(cronExpression: string, from: Date = new Date()): Date {
  try {
    const expression = CronExpressionParser.parse(cronExpression, {
      currentDate: from,
      tz: 'UTC',
    });
    return expression.next().toDate();
  } catch (err) {
    throw new InvalidCronExpressionError(
      cronExpression,
      err instanceof Error ? err.message : String(err),
    );
  }
}
