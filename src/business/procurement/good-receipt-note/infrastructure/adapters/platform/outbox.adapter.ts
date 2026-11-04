import { Injectable } from '@nestjs/common';
import { GrnPublisherPort } from '@business/procurement/good-receipt-note/application/integrations/publishes/grn.publisher-port';
import { OutboxEvent } from '@platform/outbox/outbox.types';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';

@Injectable()
export class OutboxAdapter implements GrnPublisherPort {
  constructor(private readonly outboxWriter: OutboxWriterPort) {}

  async send(event: OutboxEvent, grnId: string): Promise<void> {
    await this.outboxWriter.append(event, 'GoodReceiptNote', grnId);
  }
}
