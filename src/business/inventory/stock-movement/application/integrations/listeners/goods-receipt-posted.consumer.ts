import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import type { OutboxEnvelope } from '@platform/outbox/outbox.types';
import { InboxPort } from '@platform/inbox/ports/inbox.port';
import { RecordStockMovementUseCase } from '../../usecases/record-stock-movement.usecase';
import { MovementType } from '../../../domain/types/stock-movement.types';

const EXCHANGE = 'erp.events';
const QUEUE = 'goods-receipt-posted.erp';

/**
 * Inventory consumer for GoodsReceiptPosted.
 *
 * Receives the canonical OutboxEnvelope, dedupes via InboxPort (keyed on
 * tenantId+companyId+consumer+eventId), then delegates to RecordStockMovementUseCase.
 * Never logic inline.
 */
@Injectable()
export class GoodsReceiptPostedConsumer {
  private readonly logger = new Logger(GoodsReceiptPostedConsumer.name);

  constructor(
    private readonly inbox: InboxPort,
    private readonly recordStockMovement: RecordStockMovementUseCase,
  ) {}

  @OnEvent('GoodsReceiptPosted')
  async onGoodsReceiptPosted(envelope: OutboxEnvelope): Promise<void> {
    await this.handle(envelope);
  }

  @RabbitSubscribe({
    exchange: EXCHANGE,
    routingKey: 'GoodsReceiptPosted',
    queue: QUEUE,
    queueOptions: { durable: true },
  })
  async onRabbitMessage(envelope: OutboxEnvelope): Promise<void> {
    await this.handle(envelope);
  }

  private async handle(envelope: OutboxEnvelope): Promise<void> {
    const consumer = 'inventory.goods-receipt-posted';
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
        purchaseOrderId: string;
        lines: Array<{
          grnLineId: string;
          productId: string;
          acceptedQuantity: number;
          unitPrice: number;
        }>;
      };

      for (const line of payload.lines) {
        await this.recordStockMovement.execute({
          grnLineId: line.grnLineId,
          productId: line.productId,
          quantity: line.acceptedQuantity,
          movementType: MovementType.GOODS_RECEIPT,
          sourceDocumentId: payload.grnId,
          sourceDocumentType: 'GoodReceiptNote',
          companyId: envelope.companyId ?? '',
          tenantId: envelope.tenantId ?? '',
        });
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
