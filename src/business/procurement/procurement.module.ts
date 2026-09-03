import { Module } from '@nestjs/common';
import { PurchaseOrderModule } from './purchase/purchase-order.module';

@Module({
  imports: [PurchaseOrderModule],
})
export class ProcurementModule {}
