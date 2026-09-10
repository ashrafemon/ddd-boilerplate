import {
  ClaimedJob,
  JobStatus,
  RegisterScheduledJobInput,
  ScheduledJobRecord,
  ScheduleMode,
} from '../scheduler.types';

export interface CreateScheduledJobData extends RegisterScheduledJobInput {
  nextRunAt: Date;
}

/** DI token (abstract class port). Implemented by PrismaScheduledJobRepository. */
export abstract class ScheduledJobRepositoryPort {
  abstract create(data: CreateScheduledJobData): Promise<string>;
  abstract findById(jobId: string): Promise<ScheduledJobRecord | null>;
  abstract list(options?: {
    jobType?: string;
    status?: JobStatus | string;
    limit?: number;
    offset?: number;
  }): Promise<ScheduledJobRecord[]>;
  abstract cancel(jobId: string): Promise<void>;
  abstract cancelByAggregate(aggregateType: string, aggregateId: string): Promise<void>;
  abstract reschedule(jobId: string, nextRunAt: Date): Promise<void>;
  abstract rescheduleByAggregate(
    aggregateType: string,
    aggregateId: string,
    nextRunAt: Date,
  ): Promise<void>;
  /** Claims due PENDING rows via FOR UPDATE SKIP LOCKED; marks CLAIMED. */
  abstract claimDue(batchSize: number, lockedBy: string): Promise<ClaimedJob[]>;
  abstract findOverdue(thresholdMs: number): Promise<number>;
  abstract markPendingWithNextRun(jobId: string, nextRunAt: Date, lastRunAt?: Date): Promise<void>;
  abstract touchLastRunAt(jobId: string): Promise<void>;
  abstract markFailed(jobId: string): Promise<void>;
  /** Releases CLAIMED rows whose lockedUntil has elapsed (Redis lock gone). */
  abstract releaseStaleClaims(): Promise<number>;
  abstract updateWithVersionCheck(
    jobId: string,
    expectedVersion: number,
    data: {
      cronExpression?: string | null;
      nextRunAt?: Date;
      scheduleMode?: ScheduleMode;
    },
  ): Promise<boolean>;
}
