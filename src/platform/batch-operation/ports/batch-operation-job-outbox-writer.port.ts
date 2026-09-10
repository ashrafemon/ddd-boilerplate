import { BatchOperationJobRecord } from '../batch-operation.types';

/**
 * Writes a job-lifecycle event to the transactional outbox for RabbitMQ fanout
 * (summary notification / audit consumers). A failed write must never re-run the job.
 */
export abstract class BatchOperationJobOutboxWriterPort {
  abstract writeJobCompletedEvent(job: BatchOperationJobRecord): Promise<void>;
}
