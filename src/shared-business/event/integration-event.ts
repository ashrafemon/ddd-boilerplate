import { DomainEvent, DomainEventProps } from './domain-event';

export interface IntegrationEventProps extends DomainEventProps {
  tenantId?: string;
  organizationId?: string;
  correlationId?: string;
}

/**
 * Base class for integration events.
 *
 * Integration events cross bounded-context (and often process/service)
 * boundaries. They carry the tenant/organization context and a correlation id
 * so consumers can re-establish the request context in CLS.
 *
 * Integration events are published through the Outbox + messaging
 * infrastructure, never directly from domain code.
 */
export abstract class IntegrationEvent extends DomainEvent {
  public readonly tenantId?: string;
  public readonly organizationId?: string;
  public readonly correlationId?: string;

  protected constructor(props: IntegrationEventProps) {
    super(props);
    this.tenantId = props.tenantId;
    this.organizationId = props.organizationId;
    this.correlationId = props.correlationId;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      correlationId: this.correlationId,
    };
  }
}
