import { DispatchStatus, ScheduledJobDispatchLogRecord } from '../scheduler.types';

export interface InsertDispatchLogInput {
  id: string;
  tenantId?: string | null;
  scheduledJobId: string;
  jobType: string;
  dispatchedAt: Date;
  completedAt?: Date | null;
  outcome: DispatchStatus;
  durationMs?: number | null;
  errorMessage?: string | null;
  idempotencyKey: string;
}

/** DI token (abstract class port). Implemented by PrismaScheduledJobDispatchLogRepository. */
export abstract class ScheduledJobDispatchLogRepositoryPort {
  abstract insert(input: InsertDispatchLogInput): Promise<void>;
  abstract listByJobId(
    jobId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ScheduledJobDispatchLogRecord[]>;
  abstract countFailuresSince(since: Date): Promise<number>;
}
