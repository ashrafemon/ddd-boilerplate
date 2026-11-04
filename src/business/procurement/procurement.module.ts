import { Module } from '@nestjs/common';
import { ProductModule } from './product/product.module';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { GoodReceiptNoteModule } from './good-receipt-note/good-receipt-note.module';
import { GoodsReturnModule } from './goods-return/goods-return.module';

@Module({
  imports: [ProductModule, PurchaseOrderModule, GoodReceiptNoteModule, GoodsReturnModule],
})
export class ProcurementModule {}
