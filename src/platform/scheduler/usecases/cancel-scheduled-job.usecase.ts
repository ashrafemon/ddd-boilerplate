import { Injectable } from '@nestjs/common';
import { CancelScheduledJobPort } from '../ports/cancel-scheduled-job.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';

@Injectable()
export class CancelScheduledJobUseCase implements CancelScheduledJobPort {
  constructor(private readonly jobs: ScheduledJobRepositoryPort) {}

  execute(jobId: string): Promise<void> {
    return this.jobs.cancel(jobId);
  }

  executeByAggregate(aggregateType: string, aggregateId: string): Promise<void> {
    return this.jobs.cancelByAggregate(aggregateType, aggregateId);
  }
}
