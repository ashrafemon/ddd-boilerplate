import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { ScheduledJobEditLogRepositoryPort } from '../ports/scheduled-job-edit-log-repository.port';
import { UpdateScheduledJobInput, ScheduleMode } from '../scheduler.types';
import { CronCalculator } from '../cron-calculator';

@Injectable()
export class UpdateScheduledJobUseCase {
  constructor(
    private readonly jobs: ScheduledJobRepositoryPort,

    private readonly editLogs: ScheduledJobEditLogRepositoryPort,
  ) {}

  async execute(input: UpdateScheduledJobInput): Promise<void> {
    const existing = await this.jobs.findById(input.jobId);
    if (!existing) {
      throw new NotFoundException(`Scheduled job '${input.jobId}' not found`);
    }

    const changedFields: Record<string, unknown> = {};
    let cronExpression = existing.cronExpression;
    let nextRunAt = existing.nextRunAt;

    if (input.cronExpression !== undefined) {
      if (existing.scheduleMode !== ScheduleMode.CRON) {
        throw new BadRequestException(
          'Invalid cron expression: cronExpression only valid for CRON schedule mode',
        );
      }
      nextRunAt = CronCalculator.nextRunAt(input.cronExpression, new Date());
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
      throw new ConflictException(
        `Scheduled job '${input.jobId}' was modified concurrently (expected version ${input.expectedVersion})`,
      );
    }

    await this.editLogs.insert({
      scheduledJobId: input.jobId,
      editedBy: input.editedBy ?? null,
      changedFields,
    });
  }
}
