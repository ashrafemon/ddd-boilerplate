import { OutboxEvent } from '@platform/events/bases/outbox-event.base';

export abstract class OutboxWriterPort {
  abstract append(event: OutboxEvent, aggregateType: string, aggregateId: string): Promise<void>;
}
