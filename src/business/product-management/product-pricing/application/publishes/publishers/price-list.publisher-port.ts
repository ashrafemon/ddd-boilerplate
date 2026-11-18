import { GenericOutboxPublisherPort } from '@platform/platform-common/outbox/inbound/ports/generic-outbox-publisher.port';
import { OutboxEvent } from '@platform/platform-common/outbox/types/outbox.types';

export abstract class PriceListPublisherPort extends GenericOutboxPublisherPort {
  abstract send(event: OutboxEvent, priceListId: string): Promise<void>;
}
