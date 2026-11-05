import { NotificationDispatch } from '../notification.types';

/**
 * Async transport for chunk messages. Sync mode bypasses this port and calls
 * the worker in-process — BullMQ is optional transport, not the boundary.
 */
export abstract class NotificationQueuePublisherPort {
  /**
   * Partition messageIds into fixed-size disjoint chunks and enqueue one
   * message per chunk. Payload carries only ids and opaque strings — never a
   * rendered body or an address.
   */
  abstract dispatchChunks(dispatch: NotificationDispatch): Promise<void>;
}
