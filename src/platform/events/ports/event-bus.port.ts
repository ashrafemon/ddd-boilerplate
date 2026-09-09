import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

export abstract class InProcessEventBus {
  abstract publish(event: DomainEvent): void;
  abstract publishAll(events: readonly DomainEvent[]): void;
}
