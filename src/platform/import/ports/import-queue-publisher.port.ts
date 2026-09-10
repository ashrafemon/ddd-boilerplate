/**
 * Async transport between import phases. Payloads carry a jobId and nothing
 * else — the worker re-reads the job, so a redelivered message is always
 * evaluated against current state.
 */
export abstract class ImportQueuePublisherPort {
  abstract enqueueParse(jobId: string): Promise<void>;

  abstract enqueueValidate(jobId: string): Promise<void>;

  /** Also used to re-enqueue while a chunk pass reports `hasMore`. */
  abstract enqueueExecute(jobId: string): Promise<void>;
}
