import { ScheduledJobRecord } from '../scheduler.types';

export abstract class GetScheduledJobStatusPort {
  abstract execute(jobId: string): Promise<ScheduledJobRecord>;
  abstract list(options?: {
    jobType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ScheduledJobRecord[]>;
}
