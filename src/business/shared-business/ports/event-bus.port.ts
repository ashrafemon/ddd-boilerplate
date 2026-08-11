import { DomainEvent } from '../domain/bases/event.base';

/**
 * In-process domain event bus. Used for local reactions (sagas, listeners)
 * where external delivery guarantees are not required.
 */
export interface InProcessEventBus {
  publish(event: DomainEvent): void;
  publishAll(events: readonly DomainEvent[]): void;
}

export const IN_PROCESS_EVENT_BUS = Symbol('IN_PROCESS_EVENT_BUS');
