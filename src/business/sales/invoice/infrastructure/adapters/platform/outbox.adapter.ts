import { Injectable } from '@nestjs/common';
import { InvoicePublisherPort } from '@business/sales/invoice/application/integrations/publishes/invoice.publisher-port';
import { OutboxEvent } from '@platform/outbox/outbox.types';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';

@Injectable()
export class OutboxAdapter implements InvoicePublisherPort {
  constructor(private readonly outboxWriter: OutboxWriterPort) {}

  async send(event: OutboxEvent, invoiceId: string): Promise<void> {
    await this.outboxWriter.append(event, 'Invoice', invoiceId);
  }
}
