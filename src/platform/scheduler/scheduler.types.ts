/** Shared scheduler enums / DTOs — framework-free. */

export enum JobType {
  // Free-form string in persistence; enum documents known platform types.
  RECURRING = 'Recurring',
}

export enum ScheduleMode {
  CRON = 'CRON',
  EXTERNAL = 'EXTERNAL',
}

export enum JobScope {
  AGGREGATE = 'AGGREGATE',
  TENANT = 'TENANT',
  PLATFORM = 'PLATFORM',
}

export enum DispatchStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  DEAD_LETTERED = 'DEAD_LETTERED',
}

export enum JobStatus {
  PENDING = 'PENDING',
  CLAIMED = 'CLAIMED',
  RUNNING = 'RUNNING',
  FAILED = 'FAILED',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export interface ScheduledJobRecord {
  id: string;
  tenantId: string | null;
  jobType: string;
  scope: JobScope;
  scheduleMode: ScheduleMode;
  cronExpression: string | null;
  aggregateType: string | null;
  aggregateId: string | null;
  payload: Record<string, unknown> | null;
  nextRunAt: Date;
  lastRunAt: Date | null;
  status: JobStatus;
  retryCount: number;
  version: number;
  lockedUntil: Date | null;
  lockedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClaimedJob {
  id: string;
  tenantId: string | null;
  jobType: string;
  scope: JobScope;
  scheduleMode: ScheduleMode;
  cronExpression: string | null;
  aggregateType: string | null;
  aggregateId: string | null;
  payload: Record<string, unknown> | null;
  nextRunAt: Date;
  retryCount: number;
  version: number;
}

export interface ScheduledJobDispatchLogRecord {
  id: string;
  tenantId: string | null;
  scheduledJobId: string;
  jobType: string;
  dispatchedAt: Date;
  completedAt: Date | null;
  outcome: DispatchStatus;
  durationMs: number | null;
  errorMessage: string | null;
  idempotencyKey: string;
}

export interface SchedulerHealthMetrics {
  overdueCount: number;
  recentDispatchFailureCount: number;
  lastSuccessfulTickAt: Date | null;
}

export interface RegisterScheduledJobInput {
  jobType: string;
  scope: JobScope;
  scheduleMode: ScheduleMode;
  cronExpression?: string;
  nextRunAt?: Date;
  tenantId?: string;
  aggregateType?: string;
  aggregateId?: string;
  payload?: Record<string, unknown>;
}

export interface UpdateScheduledJobInput {
  jobId: string;
  expectedVersion: number;
  cronExpression?: string;
  nextRunAt?: Date;
  editedBy?: string;
}
