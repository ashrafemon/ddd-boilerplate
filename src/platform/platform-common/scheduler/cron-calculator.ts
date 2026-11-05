import { BadRequestException } from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';

/** Pure next-run math — no I/O, so a static value object service, not a port. */
export class CronCalculator {
  static nextRunAt(cronExpression: string, from: Date = new Date()): Date {
    try {
      const expression = CronExpressionParser.parse(cronExpression, {
        currentDate: from,
        tz: 'UTC',
      });
      return expression.next().toDate();
    } catch (err) {
      throw new BadRequestException(
        `Invalid cron expression '${cronExpression}': ${FailureMessage.of(err)}`,
      );
    }
  }
}
