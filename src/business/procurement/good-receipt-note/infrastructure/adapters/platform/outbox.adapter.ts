import { Injectable } from '@nestjs/common';
import { GrnIntegrationPort } from '@business/procurement/good-receipt-note/application/integrations/publishers/grn.integration-port';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';

@Injectable()
export class OutboxAdapter implements GrnIntegrationPort {
  constructor(private readonly outboxWriter: OutboxWriterPort) {}

  async send(event: DomainEvent, grnId: string): Promise<void> {
    await this.outboxWriter.append(event, 'GoodReceiptNote', grnId);
  }
}