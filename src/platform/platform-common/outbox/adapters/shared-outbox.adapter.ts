import { Injectable } from '@nestjs/common';
import { GenericOutboxPublisherPort } from '@platform/platform-common/outbox/ports/generic-outbox-publisher.port';
import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';

/**
 * Single reusable Outbox adapter for all business modules.
 * Each module binds its own publisher port to this adapter via a factory
 * provider that supplies the aggregate type string (e.g. 'PurchaseOrder').
 */
@Injectable()
export class SharedOutboxAdapter implements GenericOutboxPublisherPort {
  constructor(
    private readonly outboxWriter: OutboxWriterPort,
    private readonly aggregateType: string,
  ) {}

  async send(event: OutboxEvent, aggregateId: string): Promise<void> {
    await this.outboxWriter.append(event, this.aggregateType, aggregateId);
  }
}
