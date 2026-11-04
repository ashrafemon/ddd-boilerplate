import { OutboxEvent } from '@platform/outbox/outbox.types';

export abstract class ProductPublisherPort {
  abstract send(event: OutboxEvent, productId: string): Promise<void>;
}
