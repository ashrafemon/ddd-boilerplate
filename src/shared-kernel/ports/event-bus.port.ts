import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

/**
 * In-process domain event bus. Used for local reactions (sagas, listeners)
 * where external delivery guarantees are not required.
 */
export abstract class InProcessEventBus {
  abstract publish(event: DomainEvent): void;
  abstract publishAll(events: readonly DomainEvent[]): void;
}
