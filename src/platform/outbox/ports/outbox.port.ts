import { AppendOutboxEventRequest, OutboxMessage } from '../outbox.types';

/**
 * Public Outbox capability — the ONLY port business modules consume.
 *
 * Business use cases call `append()` inside their `@Transactional()` scope
 * to persist an event atomically with the aggregate change.
 *
 * `appendMany()` is the batch variant for multi-event use cases.
 *
 * The Outbox dispatcher is wired internally and publishes asynchronously.
 */
export abstract class OutboxPort {
  /** Append a single event to the outbox (inside the caller's transaction). */
  abstract append(request: AppendOutboxEventRequest): Promise<OutboxMessage>;

  /** Append multiple events to the outbox (inside the caller's transaction). */
  abstract appendMany(requests: AppendOutboxEventRequest[]): Promise<OutboxMessage[]>;
}
