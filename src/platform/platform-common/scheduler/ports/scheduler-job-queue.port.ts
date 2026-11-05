import { SchedulerJobDueEvent } from './scheduler-event-publisher.port';
import { ScheduleMode } from '../scheduler.types';

/**
 * Payload enqueued for async execution. Carries idempotencyKey for BullMQ
 * jobId + handler dedupe. `scheduleMode`/`cronExpression` are dispatch
 * metadata (lease policy in the worker); the RabbitMQ fallback publisher only
 * reads the base event fields.
 */
export type SchedulerQueuedJob = SchedulerJobDueEvent & {
  scheduleMode: ScheduleMode;
  cronExpression: string | null;
};

/**
 * Hands a claimed due job to the async worker. Dispatch must not run handlers inline.
 * DI token (abstract class port). Implemented by BullMqSchedulerQueueAdapter.
 */
export abstract class SchedulerJobQueuePort {
  abstract enqueue(job: SchedulerQueuedJob): Promise<void>;
}
