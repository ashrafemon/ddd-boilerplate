import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InboxPort } from '@platform/platform-common/inbox/ports/inbox.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { GoodsReceiptPostedListenerEvent } from '../contracts/goods-receipt-posted.listener.event';
import { RegisterPurchaseOrderReceiptUseCase } from '../../../application/use-cases/register-purchase-order-receipt.usecase';

@Injectable()
export class GoodsReceiptPostedListener {
  private readonly logger = new Logger(GoodsReceiptPostedListener.name);

  constructor(
    private readonly inbox: InboxPort,
    private readonly registerReceipt: RegisterPurchaseOrderReceiptUseCase,
    private readonly requestContext: RequestContextPort,
  ) {}

  @OnEvent('GoodsReceiptPosted')
  async onGoodsReceiptPosted(envelope: GoodsReceiptPostedListenerEvent): Promise<void> {
    const tenantId = envelope.tenantId ?? '';
    const companyId = envelope.companyId ?? '';
    const messageId = envelope.eventId;

    await this.requestContext.run({ tenantId, companyId }, async () => {
      const delivery = await this.inbox.receive({
        tenantId,
        companyId,
        consumer: 'GoodsReceiptPostedListener',
        messageId,
        messageType: 'GoodsReceiptPosted',
        payload: envelope.payload,
        correlationId: envelope.correlationId,
        causationId: envelope.causationId,
      });

      if (delivery.status !== 'ACQUIRED') {
        return;
      }

      try {
        const payload = envelope.payload as {
          grnId?: string;
          purchaseOrderId?: string;
          lines?: Array<{ productId: string; acceptedQuantity: number }>;
        };

        if (!payload.purchaseOrderId || !Array.isArray(payload.lines)) {
          this.logger.warn('GoodsReceiptPosted payload missing purchaseOrderId/lines');
          await this.inbox.complete({ reservation: delivery.reservation });
          return;
        }

        await this.registerReceipt.execute({
          purchaseOrderId: payload.purchaseOrderId,
          lines: payload.lines.map(l => ({
            productId: l.productId,
            receivedQuantity: l.acceptedQuantity,
          })),
          actorId: 'system',
        });

        await this.inbox.complete({ reservation: delivery.reservation });
      } catch (err) {
        this.logger.error(`GoodsReceiptPosted handling failed: ${(err as Error).message}`);
        await this.inbox.fail({
          reservation: delivery.reservation,
          lastError: (err as Error).message,
        });
        throw err;
      }
    });
  }
}
