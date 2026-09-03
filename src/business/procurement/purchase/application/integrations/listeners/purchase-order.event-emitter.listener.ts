import { PurchaseOrderCreated } from '../../../domain/events/purchase-order.created.event';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class PurchaseOrderEventEmitterListener {
  private readonly logger = new Logger(PurchaseOrderEventEmitterListener.name);

  @OnEvent('PurchaseOrderCreated')
  onPurchaseOrderCreated(event: PurchaseOrderCreated): void {
    this.logger.log(`[EventEmitter] PurchaseOrder ${event.purchaseOrderId.toString()} created`);
  }
}