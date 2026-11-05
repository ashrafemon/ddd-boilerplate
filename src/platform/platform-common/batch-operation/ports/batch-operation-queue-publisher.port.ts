import { BatchOperationDispatch } from '../batch-operation.types';

/**
 * Async transport for chunk messages. Sync mode bypasses this port and calls
 * the worker in-process — BullMQ is optional transport, not the boundary.
 */
export abstract class BatchOperationQueuePublisherPort {
  /**
   * Partition rowIds into fixed-size disjoint chunks and enqueue one message
   * per chunk. Payload carries only ids and opaque strings — never business data.
   */
  abstract dispatchChunks(dispatch: BatchOperationDispatch): Promise<void>;
}
