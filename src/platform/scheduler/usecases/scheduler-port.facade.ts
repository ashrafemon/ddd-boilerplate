import { Injectable } from '@nestjs/common';
import { ScheduleJobInput, SchedulerPort } from '../ports/scheduler.port';
import { RegisterScheduledJobPort } from '../ports/register-scheduled-job.port';
import { CancelScheduledJobPort } from '../ports/cancel-scheduled-job.port';
import { RescheduleExternalJobPort } from '../ports/reschedule-external-job.port';
import { JobScope, ScheduleMode } from '../scheduler.types';

/**
 * Thin facade so Recurring (and other legacy callers) keep compiling against SchedulerPort.
 */
@Injectable()
export class SchedulerPortFacade implements SchedulerPort {
  constructor(
    private readonly registerPort: RegisterScheduledJobPort,
    private readonly cancelPort: CancelScheduledJobPort,
    private readonly reschedulePort: RescheduleExternalJobPort,
  ) {}

  schedule(input: ScheduleJobInput): Promise<string> {
    return this.registerPort.execute({
      jobType: input.jobType,
      scope: JobScope.AGGREGATE,
      scheduleMode: ScheduleMode.EXTERNAL,
      nextRunAt: input.nextRunAt,
      tenantId: input.tenantId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
    });
  }

  reschedule(jobId: string, nextRunAt: Date): Promise<void> {
    return this.reschedulePort.execute(jobId, nextRunAt);
  }

  cancel(jobId: string): Promise<void> {
    return this.cancelPort.execute(jobId);
  }

  cancelByAggregate(aggregateType: string, aggregateId: string): Promise<void> {
    return this.cancelPort.executeByAggregate(aggregateType, aggregateId);
  }

  rescheduleByAggregate(
    aggregateType: string,
    aggregateId: string,
    nextRunAt: Date,
  ): Promise<void> {
    return this.reschedulePort.executeByAggregate(aggregateType, aggregateId, nextRunAt);
  }
}
