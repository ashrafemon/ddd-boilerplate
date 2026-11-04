import { Injectable } from '@nestjs/common';
import { VendorPublisherPort } from '@business/party/vendor/application/integrations/publishes/vendor.publisher-port';
import { OutboxEvent } from '@platform/outbox/outbox.types';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';

@Injectable()
export class OutboxAdapter implements VendorPublisherPort {
  constructor(private readonly outboxWriter: OutboxWriterPort) {}

  async send(event: OutboxEvent, vendorId: string): Promise<void> {
    await this.outboxWriter.append(event, 'Vendor', vendorId);
  }
}
