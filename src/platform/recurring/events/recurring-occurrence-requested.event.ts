import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

/**
 * Raised by RecurringGenerationHandler after a claimed, eligible occurrence.
 * Persisted through the transactional outbox; business consumers (PurchaseOrder,
 * Invoice, ...) subscribe on RabbitMQ and create the document.
 */
export interface RecurringOccurrenceRequestedPayload {
  executionId: string;
  recurringTemplateId: string;
  targetEntityType: string;
  partyId: string | null;
  partyType: string | null;
  currency: string;
  autoPost: boolean;
  triggerKey: string;
  traceId: string;
  tenantId?: string;
  headerOverrides: Record<string, unknown> | null;
  lines: unknown[];
  eventPayload?: Record<string, unknown>;
}

export class RecurringOccurrenceRequested extends DomainEvent {
  constructor(
    public readonly executionId: string,
    public readonly recurringTemplateId: string,
    public readonly targetEntityType: string,
    public readonly partyId: string | null,
    public readonly partyType: string | null,
    public readonly currency: string,
    public readonly autoPost: boolean,
    public readonly triggerKey: string,
    public readonly traceId: string,
    public readonly headerOverrides: Record<string, unknown> | null,
    public readonly lines: unknown[],
    public readonly tenantId?: string,
    public readonly eventPayload?: Record<string, unknown>,
  ) {
    super();
  }
}
