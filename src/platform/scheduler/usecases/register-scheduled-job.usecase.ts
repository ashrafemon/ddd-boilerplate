import { Injectable } from '@nestjs/common';
import { RegisterScheduledJobPort } from '../ports/register-scheduled-job.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { RegisterScheduledJobInput, JobScope, ScheduleMode } from '../scheduler.types';
import { InvalidScopeTenantError, InvalidCronExpressionError } from '../scheduler.errors';
import { computeNextRunAt } from '../cron-calculator';

@Injectable()
export class RegisterScheduledJobUseCase implements RegisterScheduledJobPort {
  constructor(private readonly jobs: ScheduledJobRepositoryPort) {}

  async execute(input: RegisterScheduledJobInput): Promise<string> {
    this.assertScopeTenant(input);
    this.assertAggregatePairing(input);
    this.assertScheduleMode(input);

    let nextRunAt = input.nextRunAt;
    if (input.scheduleMode === ScheduleMode.CRON) {
      if (!input.cronExpression) {
        throw new InvalidCronExpressionError('(missing)');
      }
      nextRunAt = computeNextRunAt(input.cronExpression, new Date());
    }
    if (!nextRunAt) {
      throw new InvalidScopeTenantError('nextRunAt is required for EXTERNAL schedule mode');
    }

    return this.jobs.create({ ...input, nextRunAt });
  }

  private assertScopeTenant(input: RegisterScheduledJobInput): void {
    if (input.scope === JobScope.PLATFORM && input.tenantId) {
      throw new InvalidScopeTenantError('PLATFORM scope forbids tenantId', {
        scope: input.scope,
        tenantId: input.tenantId,
      });
    }
    if (input.scope === JobScope.TENANT && !input.tenantId) {
      throw new InvalidScopeTenantError('TENANT scope requires tenantId', { scope: input.scope });
    }
  }

  private assertAggregatePairing(input: RegisterScheduledJobInput): void {
    if (input.scope === JobScope.AGGREGATE) {
      if (!input.aggregateType || !input.aggregateId) {
        throw new InvalidScopeTenantError(
          'AGGREGATE scope requires aggregateType and aggregateId',
          { scope: input.scope },
        );
      }
    } else if (input.aggregateType || input.aggregateId) {
      throw new InvalidScopeTenantError('Non-AGGREGATE scope forbids aggregateType/aggregateId', {
        scope: input.scope,
      });
    }
  }

  private assertScheduleMode(input: RegisterScheduledJobInput): void {
    if (input.scheduleMode === ScheduleMode.CRON && !input.cronExpression) {
      throw new InvalidCronExpressionError('(missing)');
    }
    if (input.scheduleMode === ScheduleMode.EXTERNAL && input.cronExpression) {
      throw new InvalidScopeTenantError('EXTERNAL schedule mode forbids cronExpression');
    }
  }
}
