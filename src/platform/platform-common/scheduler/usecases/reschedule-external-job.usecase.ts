import { Injectable } from '@nestjs/common';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';

@Injectable()
export class RescheduleExternalJobUseCase {
  constructor(private readonly jobs: ScheduledJobRepositoryPort) {}

  execute(jobId: string, nextRunAt: Date): Promise<void> {
    return this.jobs.reschedule(jobId, nextRunAt);
  }
}
