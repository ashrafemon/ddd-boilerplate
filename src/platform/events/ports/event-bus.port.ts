import {
  DomainEventEnvelope,
  EventHandlerRegistration,
  EventPublishResult,
} from '../event-bus.types';

/**
 * Platform-level event publication and handler dispatch boundary.
 *
 * The Event Bus answers: "Something happened. Which registered consumers
 * should be notified?"
 *
 * It owns:
 * - Event publication
 * - Event handler registration
 * - Handler dispatch
 * - Event envelope normalization
 * - Correlation/causation propagation
 * - In-process dispatch
 *
 * It does NOT own:
 * - Transactional event persistence (that is OutboxPort)
 * - Saga state
 * - Business module imports
 */
export abstract class EventBusPort {
  /** Publish an event to all registered handlers. */
  abstract publish(event: DomainEventEnvelope): Promise<EventPublishResult>;

  /** Register a handler for a specific event type + version. */
  abstract register(registration: EventHandlerRegistration): void;

  /** Unregister a handler by its registration ID. */
  abstract unregister(registrationId: string): void;
}
