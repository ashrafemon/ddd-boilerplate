import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

/**
 * Send raised domain events to the transactional outbox (implemented by
 * infrastructure/adapters/platform/OutboxAdapter on the platform
 * OutboxWriterPort).
 */
export abstract class InvoiceIntegrationPort {
  abstract send(event: DomainEvent, invoiceId: string): Promise<void>;
}
