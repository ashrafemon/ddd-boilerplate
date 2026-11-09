import { GenericOutboxPublisherPort } from '@platform/platform-common/outbox/ports/generic-outbox-publisher.port';
import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';

export abstract class InvoicePublisherPort extends GenericOutboxPublisherPort {
  abstract send(event: OutboxEvent, invoiceId: string): Promise<void>;
}
