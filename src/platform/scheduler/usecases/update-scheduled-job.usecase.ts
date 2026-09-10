import { Injectable } from '@nestjs/common';
import { UpdateScheduledJobPort } from '../ports/update-scheduled-job.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { ScheduledJobEditLogRepositoryPort } from '../ports/scheduled-job-edit-log-repository.port';
import { UpdateScheduledJobInput, ScheduleMode } from '../scheduler.types';
import {
  JobNotFoundError,
  OptimisticConcurrencyError,
  InvalidCronExpressionError,
} from '../scheduler.errors';
import { computeNextRunAt } from '../cron-calculator';

@Injectable()
export class UpdateScheduledJobUseCase implements UpdateScheduledJobPort {
  constructor(
    private readonly jobs: ScheduledJobRepositoryPort,

    private readonly editLogs: ScheduledJobEditLogRepositoryPort,
  ) {}

  async execute(input: UpdateScheduledJobInput): Promise<void> {
    const existing = await this.jobs.findById(input.jobId);
    if (!existing) {
      throw new JobNotFoundError(input.jobId);
    }

    const changedFields: Record<string, unknown> = {};
    let cronExpression = existing.cronExpression;
    let nextRunAt = existing.nextRunAt;

    if (input.cronExpression !== undefined) {
      if (existing.scheduleMode !== ScheduleMode.CRON) {
        throw new InvalidCronExpressionError(
          input.cronExpression,
          'cronExpression only valid for CRON schedule mode',
        );
      }
      nextRunAt = computeNextRunAt(input.cronExpression, new Date());
      cronExpression = input.cronExpression;
      changedFields.cronExpression = input.cronExpression;
      changedFields.nextRunAt = nextRunAt.toISOString();
    }

    if (input.nextRunAt !== undefined) {
      nextRunAt = input.nextRunAt;
      changedFields.nextRunAt = input.nextRunAt.toISOString();
    }

    if (Object.keys(changedFields).length === 0) {
      return;
    }

    const ok = await this.jobs.updateWithVersionCheck(input.jobId, input.expectedVersion, {
      cronExpression,
      nextRunAt,
    });
    if (!ok) {
      throw new OptimisticConcurrencyError(input.jobId, input.expectedVersion);
    }

    await this.editLogs.insert({
      scheduledJobId: input.jobId,
      editedBy: input.editedBy ?? null,
      changedFields,
    });
  }
}
