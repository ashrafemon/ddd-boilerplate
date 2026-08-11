export interface OutboxEventInput {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  tenantId: string;
  organizationId?: string;
  correlationId?: string;
  payload: Record<string, unknown>;
  availableAt?: Date;
}

/**
 * Transactional outbox port.
 *
 * Business modules append integration events through this port inside the same
 * transaction that persists the aggregate change. The outbox dispatcher
 * publishes them to the message transports only after the transaction has
 * committed.
 */
export abstract class OutboxPort {
  public abstract append(event: OutboxEventInput): Promise<void>;
  public abstract appendMany(events: OutboxEventInput[]): Promise<void>;
}
