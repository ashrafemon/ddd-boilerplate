import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { GoodsReceiptPostedConsumer } from './application/integrations/listeners/goods-receipt-posted.consumer';
import { RecordStockMovementUseCase } from './application/usecases/record-stock-movement.usecase';
import { StockMovementCommandRepository } from './domain/repositories/stock-movement-command.repository';
import { PrismaStockMovementCommandRepository } from './infrastructure/persistence/prisma-stock-movement-command.repository';

/**
 * Inventory stock-movement module (Phase 5).
 *
 * Records stock movements from goods receipts. Balances are a projection
 * updated in the same transaction as the movement insert.
 */
@Module({
  imports: [PlatformModule],
  providers: [
    RecordStockMovementUseCase,
    GoodsReceiptPostedConsumer,
    { provide: StockMovementCommandRepository, useClass: PrismaStockMovementCommandRepository },
  ],
  exports: [RecordStockMovementUseCase, StockMovementCommandRepository],
})
export class StockMovementModule {}
