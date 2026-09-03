import { ProductIntegrationPort } from '@business/catalog/product/application/integrations/publishers/product.integration-port';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { Injectable } from '@nestjs/common';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';

@Injectable()
export class OutboxAdapter implements ProductIntegrationPort {
  constructor(private readonly outboxWriter: OutboxWriterPort) {}

  async send(event: DomainEvent, productId: string): Promise<void> {
    await this.outboxWriter.append(event, 'Product', productId);
  }
}
