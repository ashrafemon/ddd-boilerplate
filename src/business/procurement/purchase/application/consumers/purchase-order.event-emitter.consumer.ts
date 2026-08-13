import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PurchaseOrderCreated } from '../../domain/events';

@Injectable()
export class PurchaseOrderEventEmitterConsumer {
  private readonly logger = new Logger(PurchaseOrderEventEmitterConsumer.name);

  @OnEvent('PurchaseOrderCreated')
  onPurchaseOrderCreated(event: PurchaseOrderCreated): void {
    this.logger.log(`[EventEmitter] PurchaseOrder ${event.purchaseOrderId.toString()} created`);
  }
}
