import { Injectable } from '@nestjs/common';
import { InvoicePublisherPort } from '@business/sales/invoice/application/integrations/publishes/invoice.publisher-port';
import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';

@Injectable()
export class OutboxAdapter implements InvoicePublisherPort {
  constructor(private readonly outboxWriter: OutboxWriterPort) {}

  async send(event: OutboxEvent, invoiceId: string): Promise<void> {
    await this.outboxWriter.append(event, 'Invoice', invoiceId);
  }
}
