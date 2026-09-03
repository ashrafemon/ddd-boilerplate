import { Module } from '@nestjs/common';
import { PurchaseOrderModule } from './purchase/purchase-order.module';
import { GoodReceiptNoteModule } from './good-receipt-note/good-receipt-note.module';

@Module({
  imports: [PurchaseOrderModule, GoodReceiptNoteModule],
})
export class ProcurementModule {}
