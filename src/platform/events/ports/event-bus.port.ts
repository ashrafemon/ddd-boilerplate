import { OutboxEvent } from '@platform/events/bases/outbox-event.base';

export abstract class InProcessEventBus {
  abstract publish(event: OutboxEvent): void;
  abstract publishAll(events: readonly OutboxEvent[]): void;
}
