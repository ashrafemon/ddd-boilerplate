import { Injectable } from '@nestjs/common';
import { VendorIntegrationPort } from '@business/party/vendor/application/integrations/publishers/vendor.integration-port';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';

@Injectable()
export class OutboxAdapter implements VendorIntegrationPort {
  constructor(private readonly outboxWriter: OutboxWriterPort) {}

  async send(event: DomainEvent, vendorId: string): Promise<void> {
    await this.outboxWriter.append(event, 'Vendor', vendorId);
  }
}