import { Injectable } from '@nestjs/common';
import { ListScheduledJobDispatchLogPort } from '../ports/list-scheduled-job-dispatch-log.port';
import { ScheduledJobDispatchLogRepositoryPort } from '../ports/scheduled-job-dispatch-log-repository.port';
import { ScheduledJobDispatchLogRecord } from '../scheduler.types';

@Injectable()
export class ListScheduledJobDispatchLogUseCase implements ListScheduledJobDispatchLogPort {
  constructor(private readonly logs: ScheduledJobDispatchLogRepositoryPort) {}

  execute(
    jobId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ScheduledJobDispatchLogRecord[]> {
    return this.logs.listByJobId(jobId, options);
  }
}
