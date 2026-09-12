import { Module } from '@nestjs/common';
import { ProductModule } from './product/product.module';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { GoodReceiptNoteModule } from './good-receipt-note/good-receipt-note.module';

@Module({
  imports: [ProductModule, PurchaseOrderModule, GoodReceiptNoteModule],
})
export class ProcurementModule {}
