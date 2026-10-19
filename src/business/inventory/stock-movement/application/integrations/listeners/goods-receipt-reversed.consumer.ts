import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import type { OutboxEnvelope } from '@platform/outbox/outbox.types';
import { InboxPort } from '@platform/inbox/ports/inbox.port';
import { RecordStockMovementReversalUseCase } from '../../usecases/record-stock-movement-reversal.usecase';

const EXCHANGE = 'erp.events';
const QUEUE = 'goods-receipt-reversed.erp';

/**
 * Inventory consumer for `GoodsReceiptReversed` (plan Phase 5 / Phase 4.1).
 *
 * Same discipline as the posted consumer: canonical envelope in, `InboxPort`
 * dedupe keyed on tenantId+companyId+consumer+eventId, then a thin per-line
 * delegation to `RecordStockMovementReversalUseCase` — no logic inline. The
 * delegated use case links `reversalOfId` and skips lines whose original
 * receipt never entered stock.
 */
@Injectable()
export class GoodsReceiptReversedConsumer {
  private readonly logger = new Logger(GoodsReceiptReversedConsumer.name);

  constructor(
    private readonly inbox: InboxPort,
    private readonly recordReversal: RecordStockMovementReversalUseCase,
  ) {}

  @OnEvent('GoodsReceiptReversed')
  async onGoodsReceiptReversed(envelope: OutboxEnvelope): Promise<void> {
    await this.handle(envelope);
  }

  @RabbitSubscribe({
    exchange: EXCHANGE,
    routingKey: 'GoodsReceiptReversed',
    queue: QUEUE,
    queueOptions: { durable: true },
  })
  async onRabbitMessage(envelope: OutboxEnvelope): Promise<void> {
    await this.handle(envelope);
  }

  private async handle(envelope: OutboxEnvelope): Promise<void> {
    const consumer = 'inventory.goods-receipt-reversed';
    const delivery = await this.inbox.receive({
      tenantId: envelope.tenantId ?? '',
      companyId: envelope.companyId ?? '',
      consumer,
      messageId: envelope.eventId,
      messageType: envelope.eventType,
      payload: envelope.payload,
    });

    if (delivery.status !== 'ACQUIRED') {
      return;
    }

    try {
      const payload = envelope.payload as {
        grnId: string;
        reversalOfId: string;
        purchaseOrderId: string;
        lines: Array<{
          grnLineId: string;
          productId: string;
          acceptedQuantity: number;
          unitPrice: number;
        }>;
      };

      for (const line of payload.lines) {
        const originalGrnLineId = `${payload.reversalOfId}:${line.productId}`;
        const movement = await this.recordReversal.execute({
          grnLineId: line.grnLineId,
          originalGrnLineId,
          productId: line.productId,
          quantity: line.acceptedQuantity,
          sourceDocumentId: payload.grnId,
          sourceDocumentType: 'GoodReceiptNote',
          companyId: envelope.companyId ?? '',
          tenantId: envelope.tenantId ?? '',
        });
        if (!movement) {
          this.logger.warn(
            `No original GOODS_RECEIPT movement for ${originalGrnLineId}; compensation skipped`,
          );
        }
      }

      await this.inbox.complete({ reservation: delivery.reservation });
    } catch (error) {
      await this.inbox.fail({
        reservation: delivery.reservation,
        lastError: (error as Error).message,
      });
      throw error;
    }
  }
}
