import { BadRequestException, Injectable } from '@nestjs/common';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { RegisterScheduledJobInput, JobScope, ScheduleMode } from '../scheduler.types';
import { CronCalculator } from '../cron-calculator';

@Injectable()
export class RegisterScheduledJobUseCase {
  constructor(private readonly jobs: ScheduledJobRepositoryPort) {}

  async execute(input: RegisterScheduledJobInput): Promise<string> {
    this.assertScopeTenant(input);
    this.assertAggregatePairing(input);
    this.assertScheduleMode(input);

    let nextRunAt = input.nextRunAt;
    if (input.scheduleMode === ScheduleMode.CRON) {
      if (!input.cronExpression) {
        throw new BadRequestException(
          'Invalid cron expression: cronExpression is required in CRON schedule mode',
        );
      }
      nextRunAt = CronCalculator.nextRunAt(input.cronExpression, new Date());
    }
    if (!nextRunAt) {
      throw new BadRequestException('nextRunAt is required for EXTERNAL schedule mode');
    }

    return this.jobs.create({ ...input, nextRunAt });
  }

  private assertScopeTenant(input: RegisterScheduledJobInput): void {
    if (input.scope === JobScope.PLATFORM && input.tenantId) {
      throw new BadRequestException('PLATFORM scope forbids tenantId');
    }
    if (input.scope === JobScope.TENANT && !input.tenantId) {
      throw new BadRequestException('TENANT scope requires tenantId');
    }
  }

  private assertAggregatePairing(input: RegisterScheduledJobInput): void {
    if (input.scope === JobScope.AGGREGATE) {
      if (!input.aggregateType || !input.aggregateId) {
        throw new BadRequestException('AGGREGATE scope requires aggregateType and aggregateId');
      }
    } else if (input.aggregateType || input.aggregateId) {
      throw new BadRequestException('Non-AGGREGATE scope forbids aggregateType/aggregateId');
    }
  }

  private assertScheduleMode(input: RegisterScheduledJobInput): void {
    if (input.scheduleMode === ScheduleMode.CRON && !input.cronExpression) {
      throw new BadRequestException(
        'Invalid cron expression: cronExpression is required in CRON schedule mode',
      );
    }
    if (input.scheduleMode === ScheduleMode.EXTERNAL && input.cronExpression) {
      throw new BadRequestException('EXTERNAL schedule mode forbids cronExpression');
    }
  }
}
