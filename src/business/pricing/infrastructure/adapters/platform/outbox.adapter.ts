import { PriceListPublisherPort } from '@business/pricing/application/integrations/publishers/price-list.publisher-port';
import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';
import { Injectable } from '@nestjs/common';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';

@Injectable()
export class OutboxAdapter implements PriceListPublisherPort {
  constructor(private readonly outboxWriter: OutboxWriterPort) {}

  async send(event: OutboxEvent, priceListId: string): Promise<void> {
    await this.outboxWriter.append(event, 'PriceList', priceListId);
  }
}
