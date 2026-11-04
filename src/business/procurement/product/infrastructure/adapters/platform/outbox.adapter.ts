import { ProductPublisherPort } from '@business/procurement/product/application/integrations/publishes/product.publisher-port';
import { OutboxEvent } from '@platform/outbox/outbox.types';
import { Injectable } from '@nestjs/common';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';

@Injectable()
export class OutboxAdapter implements ProductPublisherPort {
  constructor(private readonly outboxWriter: OutboxWriterPort) {}

  async send(event: OutboxEvent, productId: string): Promise<void> {
    await this.outboxWriter.append(event, 'Product', productId);
  }
}
