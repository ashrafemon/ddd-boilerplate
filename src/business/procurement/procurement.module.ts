import { Module } from '@nestjs/common';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { GoodReceiptNoteModule } from './purchase-goods-receipt/purchase-goods-receipt.module';

@Module({
  imports: [PurchaseOrderModule, GoodReceiptNoteModule],
})
export class ProcurementModule {}
