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

export interface RecordDispatchOutcomeInput {
  idempotencyKey: string;
  scheduledJobId: string;
  jobType: string;
  tenantId?: string | null;
  dispatchedAt: Date;
  completedAt: Date;
  outcome: DispatchStatus;
  durationMs?: number | null;
  errorMessage?: string | null;
}

/** DI token (abstract class port). Implemented by PrismaScheduledJobDispatchLogRepository. */
export abstract class ScheduledJobDispatchLogRepositoryPort {
  /** Idempotent on idempotencyKey — a re-fired dispatch slot does not duplicate. */
  abstract insert(input: InsertDispatchLogInput): Promise<void>;
  /** Upsert the outcome row for a dispatch attempt (enqueue-time and worker-time merge). */
  abstract recordOutcome(input: RecordDispatchOutcomeInput): Promise<void>;
  abstract listByJobId(
    jobId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ScheduledJobDispatchLogRecord[]>;
  abstract countFailuresSince(since: Date): Promise<number>;
}
