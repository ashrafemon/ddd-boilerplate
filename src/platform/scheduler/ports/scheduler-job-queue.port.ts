import { SchedulerJobDueEvent } from './scheduler-event-publisher.port';

/** Payload enqueued for async execution. Carries idempotencyKey for BullMQ jobId + handler dedupe. */
export type SchedulerQueuedJob = SchedulerJobDueEvent;

/**
 * Hands a claimed due job to the async worker. Dispatch must not run handlers inline.
 * DI token (abstract class port). Implemented by BullMqSchedulerJobQueue.
 */
export abstract class SchedulerJobQueuePort {
  abstract enqueue(job: SchedulerQueuedJob): Promise<void>;
}
