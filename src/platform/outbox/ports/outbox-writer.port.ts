import { OutboxEvent } from '@platform/events/bases/outbox-event.base';

/**
 * @deprecated Use `OutboxPort` instead. This interface exists for backward
 * compatibility with business adapters that still use the old
 * `append(event, aggregateType, aggregateId)` positional-args signature.
 *
 * New code should inject `OutboxPort` and call `append(request)`.
 */
export abstract class OutboxWriterPort {
  abstract append(event: OutboxEvent, aggregateType: string, aggregateId: string): Promise<void>;
}
