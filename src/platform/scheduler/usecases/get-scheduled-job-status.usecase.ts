import { Injectable } from '@nestjs/common';
import { GetScheduledJobStatusPort } from '../ports/get-scheduled-job-status.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { ScheduledJobRecord } from '../scheduler.types';
import { JobNotFoundError } from '../scheduler.errors';

@Injectable()
export class GetScheduledJobStatusUseCase implements GetScheduledJobStatusPort {
  constructor(private readonly jobs: ScheduledJobRepositoryPort) {}

  async execute(jobId: string): Promise<ScheduledJobRecord> {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      throw new JobNotFoundError(jobId);
    }
    return job;
  }

  list(options?: {
    jobType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ScheduledJobRecord[]> {
    return this.jobs.list(options);
  }
}
