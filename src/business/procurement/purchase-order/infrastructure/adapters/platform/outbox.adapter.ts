import { Injectable } from '@nestjs/common';
import { PurchaseOrderPublisherPort } from '@business/procurement/purchase-order/application/integrations/publishes/purchase-order.publisher-port';
import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';

@Injectable()
export class OutboxAdapter implements PurchaseOrderPublisherPort {
  constructor(private readonly outboxWriter: OutboxWriterPort) {}

  async send(event: OutboxEvent, purchaseOrderId: string): Promise<void> {
    await this.outboxWriter.append(event, 'PurchaseOrder', purchaseOrderId);
  }
}
