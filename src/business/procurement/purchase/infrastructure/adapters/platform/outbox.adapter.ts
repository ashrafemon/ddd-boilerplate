import { Injectable } from '@nestjs/common';
import { PurchaseOrderIntegrationPort } from '@business/procurement/purchase/application/integrations/publishers/purchase-order.integration-port';
import { DomainEvent } from '@business/shared-business';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';

@Injectable()
export class OutboxAdapter implements PurchaseOrderIntegrationPort {
  constructor(private readonly outboxWriter: OutboxWriterPort) {}

  async send(event: DomainEvent, purchaseOrderId: string): Promise<void> {
    await this.outboxWriter.append(event, 'PurchaseOrder', purchaseOrderId);
  }
}