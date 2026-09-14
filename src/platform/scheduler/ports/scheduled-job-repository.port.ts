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
    tenantId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ScheduledJobRecord[]>;
  abstract count(options?: {
    jobType?: string;
    status?: JobStatus | string;
    tenantId?: string;
  }): Promise<number>;
  abstract cancel(jobId: string): Promise<void>;
  abstract cancelByAggregate(aggregateType: string, aggregateId: string): Promise<void>;
  /** Only non-cancelled rows are rescheduled; bumps `version`. */
  abstract reschedule(jobId: string, nextRunAt: Date): Promise<void>;
  abstract rescheduleByAggregate(
    aggregateType: string,
    aggregateId: string,
    nextRunAt: Date,
  ): Promise<void>;
  /** Claims due PENDING rows via FOR UPDATE SKIP LOCKED; marks CLAIMED. */
  abstract claimDue(batchSize: number, lockedBy: string): Promise<ClaimedJob[]>;
  abstract findOverdue(thresholdMs: number): Promise<number>;
  /** CANCELLED/SUSPENDED rows are never resurrected; bumps `version`. */
  abstract markPendingWithNextRun(jobId: string, nextRunAt: Date, lastRunAt?: Date): Promise<void>;
  abstract touchLastRunAt(jobId: string): Promise<void>;
  /** External rows move CLAIMED -> RUNNING with a refreshed lease at handler start. */
  abstract markRunningExternal(jobId: string, lockedUntil: Date): Promise<boolean>;
  /**
   * One failed attempt: bumps retryCount and either backs the row off to
   * PENDING (RETRYING) or parks it SUSPENDED at maxRetries. Terminal statuses
   * (CANCELLED/SUSPENDED) are never touched.
   */
  abstract recordFailure(
    jobId: string,
    retry: { maxRetries: number; backoffBaseMs: number },
  ): Promise<'RETRYING' | 'SUSPENDED' | 'IGNORED'>;
  /** Releases CLAIMED/RUNNING rows whose lockedUntil has elapsed (worker died). */
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
