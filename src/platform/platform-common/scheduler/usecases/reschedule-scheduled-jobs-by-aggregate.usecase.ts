import { Injectable } from '@nestjs/common';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';

@Injectable()
export class RescheduleScheduledJobsByAggregateUseCase {
  constructor(private readonly jobs: ScheduledJobRepositoryPort) {}

  execute(aggregateType: string, aggregateId: string, nextRunAt: Date): Promise<void> {
    return this.jobs.rescheduleByAggregate(aggregateType, aggregateId, nextRunAt);
  }
}
