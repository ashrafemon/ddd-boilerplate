import { GenericOutboxPublisherPort } from '@platform/platform-common/outbox/ports/generic-outbox-publisher.port';
import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';

export abstract class ProductPublisherPort extends GenericOutboxPublisherPort {
  abstract send(event: OutboxEvent, productId: string): Promise<void>;
}
