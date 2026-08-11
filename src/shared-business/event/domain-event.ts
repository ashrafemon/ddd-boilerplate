import { createUuid } from '../../shared-kernel/utilities/uuid';
import { OutboxEventInput } from '../../shared-kernel/ports/outbox/outbox.port';

export interface DomainEventProps {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  eventId?: string;
  occurredAt?: Date;
  payload?: Record<string, unknown>;
}

export interface OutboxEventContext {
  tenantId: string;
  organizationId?: string;
  correlationId?: string;
}

/**
 * Base class for domain events.
 *
 * Domain events are created by the domain/aggregate as plain in-memory
 * records. They are never published directly by the domain — the application
 * layer turns them into outbox records which are later dispatched through the
 * platform event infrastructure.
 */
export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly eventType: string;
  public readonly aggregateType: string;
  public readonly aggregateId: string;
  public readonly occurredAt: Date;
  public readonly payload: Record<string, unknown>;

  protected constructor(props: DomainEventProps) {
    this.eventId = props.eventId ?? createUuid();
    this.eventType = props.eventType;
    this.aggregateType = props.aggregateType;
    this.aggregateId = props.aggregateId;
    this.occurredAt = props.occurredAt ?? new Date();
    this.payload = props.payload ?? {};
  }

  /**
   * Maps the typed domain event to a transactional outbox record. Every
   * outbox write is derived from the event itself, so the record shape and
   * payload always stay in sync with the event that produced them.
   */
  public toOutboxEventInput(context: OutboxEventContext): OutboxEventInput {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      aggregateType: this.aggregateType,
      aggregateId: this.aggregateId,
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      correlationId: context.correlationId,
      payload: this.payload,
    };
  }

  public toJSON(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      aggregateType: this.aggregateType,
      aggregateId: this.aggregateId,
      occurredAt: this.occurredAt.toISOString(),
      payload: this.payload,
    };
  }
}
