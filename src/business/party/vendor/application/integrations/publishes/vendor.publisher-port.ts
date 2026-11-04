import { OutboxEvent } from '@platform/outbox/outbox.types';

export abstract class VendorPublisherPort {
  abstract send(event: OutboxEvent, vendorId: string): Promise<void>;
}
