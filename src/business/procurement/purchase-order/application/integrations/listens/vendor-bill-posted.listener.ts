import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InboxPort } from '@platform/platform-common/inbox/ports/inbox.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { OutboxEnvelope } from '@platform/platform-common/outbox/outbox.types';

@Injectable()
export class VendorBillPostedListener {
  private readonly logger = new Logger(VendorBillPostedListener.name);

  constructor(
    private readonly inbox: InboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @OnEvent('VendorBillPosted')
  async onVendorBillPosted(envelope: OutboxEnvelope): Promise<void> {
    const tenantId = envelope.tenantId ?? '';
    const companyId = envelope.companyId ?? '';

    await this.requestContext.run({ tenantId, companyId }, async () => {
      const delivery = await this.inbox.receive({
        tenantId,
        companyId,
        consumer: 'VendorBillPostedListener',
        messageId: envelope.eventId,
        messageType: 'VendorBillPosted',
        payload: envelope.payload,
        correlationId: envelope.correlationId,
        causationId: envelope.causationId,
      });

      if (delivery.status !== 'ACQUIRED') {
        return;
      }

      try {
        this.logger.log(`Received VendorBillPosted for ${envelope.aggregateId}`);
        await this.inbox.complete({ reservation: delivery.reservation });
      } catch (err) {
        this.logger.error(`VendorBillPosted handling failed: ${(err as Error).message}`);
        await this.inbox.fail({
          reservation: delivery.reservation,
          lastError: (err as Error).message,
        });
        throw err;
      }
    });
  }
}
