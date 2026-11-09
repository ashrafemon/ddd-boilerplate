import { BrokerTarget, OutboxEvent } from '../outbox.types';

/** Options for a single `append` call. */
export interface AppendOutboxOptions {
  /** Target broker; defaults to `rabbitmq`. Stored in headers for the dispatcher. */
  broker?: BrokerTarget;
}

/**
 * Public Outbox capability — the ONLY outbox port business modules consume.
 *
 * One call inside the caller's `@Transactional()` scope, next to the save:
 * the event is written in the same DB transaction and nothing leaves the
 * process. The Outbox scheduler publishes it asynchronously.
 */
export abstract class OutboxWriterPort {
  abstract append(
    event: OutboxEvent,
    aggregateType: string,
    aggregateId: string,
    opts?: AppendOutboxOptions,
  ): Promise<void>;
}
