import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GoodsReceiptPostedListenerEvent } from './goods-receipt-posted.listener.event';

@Injectable()
export class GoodsReceiptPostedListener {
  private readonly logger = new Logger(GoodsReceiptPostedListener.name);

  @OnEvent('GoodsReceiptPosted')
  onGoodsReceiptPosted(envelope: GoodsReceiptPostedListenerEvent): void {
    this.logger.log(`Received GoodsReceiptPosted for ${envelope.aggregateId}`);
  }
}
