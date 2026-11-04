import { Injectable } from '@nestjs/common';
import { PurchaseOrderPublisherPort } from '@business/procurement/purchase-order/application/integrations/publishes/purchase-order.publisher-port';
import { OutboxEvent } from '@platform/outbox/outbox.types';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';

@Injectable()
export class OutboxAdapter implements PurchaseOrderPublisherPort {
  constructor(private readonly outboxWriter: OutboxWriterPort) {}

  async send(event: OutboxEvent, purchaseOrderId: string): Promise<void> {
    await this.outboxWriter.append(event, 'PurchaseOrder', purchaseOrderId);
  }
}
