import { GenericOutboxPublisherPort } from '@platform/platform-common/outbox/ports/generic-outbox-publisher.port';
import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';

export abstract class VendorPublisherPort extends GenericOutboxPublisherPort {
  abstract send(event: OutboxEvent, vendorId: string): Promise<void>;
}
