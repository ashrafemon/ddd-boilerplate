import { Module } from '@nestjs/common';
import { PurchaseOrderModule } from './purchase';

@Module({
  imports: [PurchaseOrderModule],
})
export class ProcurementModule {}
