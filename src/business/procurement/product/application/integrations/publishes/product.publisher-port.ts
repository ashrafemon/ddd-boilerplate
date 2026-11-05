import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';

export abstract class ProductPublisherPort {
  abstract send(event: OutboxEvent, productId: string): Promise<void>;
}
