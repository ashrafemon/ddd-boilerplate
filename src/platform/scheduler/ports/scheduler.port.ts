/**
 * Facade port — the main inbound surface business code (e.g. Recurring)
 * injects for simple aggregate-scoped scheduling. Granular ports
 * (Register/Cancel/Reschedule/…) exist for direct use where preferred.
 */
export interface ScheduleJobInput {
  jobType: string;
  aggregateType: string;
  aggregateId: string;
  nextRunAt: Date;
  tenantId?: string;
}

export abstract class SchedulerPort {
  abstract schedule(input: ScheduleJobInput): Promise<string>;
  abstract reschedule(jobId: string, nextRunAt: Date): Promise<void>;
  abstract cancel(jobId: string): Promise<void>;
  abstract cancelByAggregate(aggregateType: string, aggregateId: string): Promise<void>;
  abstract rescheduleByAggregate(
    aggregateType: string,
    aggregateId: string,
    nextRunAt: Date,
  ): Promise<void>;
}
