import { Injectable } from '@nestjs/common';
import { RescheduleExternalJobPort } from '../ports/reschedule-external-job.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';

@Injectable()
export class RescheduleExternalJobUseCase implements RescheduleExternalJobPort {
  constructor(private readonly jobs: ScheduledJobRepositoryPort) {}

  execute(jobId: string, nextRunAt: Date): Promise<void> {
    return this.jobs.reschedule(jobId, nextRunAt);
  }

  executeByAggregate(aggregateType: string, aggregateId: string, nextRunAt: Date): Promise<void> {
    return this.jobs.rescheduleByAggregate(aggregateType, aggregateId, nextRunAt);
  }
}
