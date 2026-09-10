import { Injectable } from '@nestjs/common';
import { InvoiceIntegrationPort } from '@business/sales/invoice/application/integrations/publishes/invoice.integration-port';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';

@Injectable()
export class OutboxAdapter implements InvoiceIntegrationPort {
  constructor(private readonly outboxWriter: OutboxWriterPort) {}

  async send(event: DomainEvent, invoiceId: string): Promise<void> {
    await this.outboxWriter.append(event, 'Invoice', invoiceId);
  }
}
