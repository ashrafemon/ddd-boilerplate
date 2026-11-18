import { GenericOutboxPublisherPort } from '@platform/platform-common/outbox/inbound/ports/generic-outbox-publisher.port';
import { OutboxEvent } from '@platform/platform-common/outbox/types/outbox.types';

export abstract class InvoicePublisherPort extends GenericOutboxPublisherPort {
  abstract send(event: OutboxEvent, invoiceId: string): Promise<void>;
}
