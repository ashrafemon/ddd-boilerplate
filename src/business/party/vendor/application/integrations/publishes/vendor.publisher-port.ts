import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';

export abstract class VendorPublisherPort {
  abstract send(event: OutboxEvent, vendorId: string): Promise<void>;
}
