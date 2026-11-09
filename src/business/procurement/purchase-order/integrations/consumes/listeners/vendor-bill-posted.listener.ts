import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InboxPort } from '@platform/platform-common/inbox/ports/inbox.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { VendorBillPostedListenerEvent } from './vendor-bill-posted.listener.event';
import {
  HandleVendorBillPostedUseCase,
  VendorBillPostedPayload,
} from '../../../application/usecases/handle-vendor-bill-posted.usecase';

@Injectable()
export class VendorBillPostedListener {
  private readonly logger = new Logger(VendorBillPostedListener.name);

  constructor(
    private readonly inbox: InboxPort,
    private readonly handleBill: HandleVendorBillPostedUseCase,
    private readonly requestContext: RequestContextPort,
  ) {}

  @OnEvent('VendorBillPosted')
  async onVendorBillPosted(envelope: VendorBillPostedListenerEvent): Promise<void> {
    const tenantId = envelope.tenantId ?? '';
    const companyId = envelope.companyId ?? '';
    const messageId = envelope.eventId;

    await this.requestContext.run({ tenantId, companyId }, async () => {
      const delivery = await this.inbox.receive({
        tenantId,
        companyId,
        consumer: 'VendorBillPostedListener',
        messageId,
        messageType: 'VendorBillPosted',
        payload: envelope.payload,
        correlationId: envelope.correlationId,
        causationId: envelope.causationId,
      });

      if (delivery.status !== 'ACQUIRED') {
        return;
      }

      try {
        const payload = envelope.payload as unknown as VendorBillPostedPayload;

        if (!payload.vendorId || !payload.billNumber || !Array.isArray(payload.lines)) {
          this.logger.warn('VendorBillPosted payload missing vendorId/billNumber/lines');
          await this.inbox.complete({ reservation: delivery.reservation });
          return;
        }

        await this.handleBill.execute(payload);

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
