import { Injectable } from '@nestjs/common';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';

@Injectable()
export class CancelScheduledJobsByAggregateUseCase {
  constructor(private readonly jobs: ScheduledJobRepositoryPort) {}

  execute(aggregateType: string, aggregateId: string): Promise<void> {
    return this.jobs.cancelByAggregate(aggregateType, aggregateId);
  }
}
