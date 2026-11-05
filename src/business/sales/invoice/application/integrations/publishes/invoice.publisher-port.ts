import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';

/**
 * Send raised domain events to the transactional outbox (implemented by
 * infrastructure/adapters/platform/OutboxAdapter on the platform
 * OutboxWriterPort).
 */
export abstract class InvoicePublisherPort {
  abstract send(event: OutboxEvent, invoiceId: string): Promise<void>;
}
