import { ScheduledJobDispatchLogRecord } from '../scheduler.types';

export abstract class ListScheduledJobDispatchLogPort {
  abstract execute(
    jobId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ScheduledJobDispatchLogRecord[]>;
}
