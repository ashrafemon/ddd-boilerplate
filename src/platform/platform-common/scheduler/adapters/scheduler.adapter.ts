import { Injectable } from '@nestjs/common';
import { ScheduleJobInput, SchedulerPort } from '../ports/scheduler.port';
import { RegisterScheduledJobUseCase } from '../usecases/register-scheduled-job.usecase';
import { CancelScheduledJobUseCase } from '../usecases/cancel-scheduled-job.usecase';
import { RescheduleExternalJobUseCase } from '../usecases/reschedule-external-job.usecase';
import { JobScope, ScheduleMode } from '../scheduler.types';

/**
 * SchedulerPort is the single inbound surface business code (e.g. Recurring)
 * injects for aggregate-scoped scheduling — this adapter is the only thing
 * that implements it, delegating to the Register/Cancel/RescheduleExternal
 * usecases directly (those usecases no longer have their own granular ports).
 */
@Injectable()
export class SchedulerAdapter implements SchedulerPort {
  constructor(
    private readonly registerUseCase: RegisterScheduledJobUseCase,
    private readonly cancelUseCase: CancelScheduledJobUseCase,
    private readonly rescheduleUseCase: RescheduleExternalJobUseCase,
  ) {}

  schedule(input: ScheduleJobInput): Promise<string> {
    return this.registerUseCase.execute({
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
    return this.rescheduleUseCase.execute(jobId, nextRunAt);
  }

  cancel(jobId: string): Promise<void> {
    return this.cancelUseCase.execute(jobId);
  }

  cancelByAggregate(aggregateType: string, aggregateId: string): Promise<void> {
    return this.cancelUseCase.executeByAggregate(aggregateType, aggregateId);
  }

  rescheduleByAggregate(
    aggregateType: string,
    aggregateId: string,
    nextRunAt: Date,
  ): Promise<void> {
    return this.rescheduleUseCase.executeByAggregate(aggregateType, aggregateId, nextRunAt);
  }
}
