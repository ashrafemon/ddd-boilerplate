import { CronCalculator } from './cron-calculator';

describe('computeNextRunAt', () => {
  it('returns a date after the from timestamp for a valid cron', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const next = CronCalculator.nextRunAt('0 0 * * *', from);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });

  it('throws InvalidCronExpressionError for garbage input', () => {
    expect(() => CronCalculator.nextRunAt('not-a-cron')).toThrow(/Invalid cron expression/);
  });
});
