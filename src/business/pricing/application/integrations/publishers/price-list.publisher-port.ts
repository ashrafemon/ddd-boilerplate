import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';

export abstract class PriceListPublisherPort {
  abstract send(event: OutboxEvent, priceListId: string): Promise<void>;
}
