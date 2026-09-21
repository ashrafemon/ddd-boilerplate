/**
 * Event Bus types — envelopes, registrations, handler contracts.
 */

/** Normalized event envelope for dispatch. */
export interface DomainEventEnvelope {
  eventId: string;

  eventType: string;
  eventVersion: number;

  tenantId?: string | null;
  organizationId?: string | null;

  aggregateType: string;
  aggregateId: string;

  payload: unknown;

  occurredAt: Date;

  correlationId?: string;
  causationId?: string;

  headers?: Record<string, string>;
}

/** Contract for an event handler that processes a typed payload. */
export interface DomainEventHandler<T = unknown> {
  handle(event: DomainEventEnvelope & { payload: T }): Promise<void>;
}

/** Registration record for a handler bound to an event type + version. */
export interface EventHandlerRegistration {
  registrationId: string;

  eventType: string;
  eventVersion: number;

  handler: DomainEventHandler;

  /** Optional company/tenant scope — when set, handler only fires for that scope. */
  tenantId?: string;
  organizationId?: string;
}

/** Result of publishing an event through the bus. */
export interface EventPublishResult {
  eventId: string;
  dispatchedHandlers: number;
}

/** Event Bus configuration. */
export interface IEventBusConfig {
  provider: 'nest' | 'kafka' | 'redis';
  maxHandlerConcurrency: number;
  handlerTimeoutMs: number;
  failFast: boolean;
  retryEnabled: boolean;
  maxAttempts: number;
}
