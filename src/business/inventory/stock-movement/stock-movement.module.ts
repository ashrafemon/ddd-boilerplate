import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { GoodsReceiptPostedConsumer } from './application/integrations/listeners/goods-receipt-posted.consumer';
import { GoodsReceiptReversedConsumer } from './application/integrations/listeners/goods-receipt-reversed.consumer';
import { StockQueryFacade } from './application/facades/stock-query.facade';
import { RecordStockMovementUseCase } from './application/usecases/record-stock-movement.usecase';
import { RecordStockMovementReversalUseCase } from './application/usecases/record-stock-movement-reversal.usecase';
import { GetStockLevelUseCase } from './application/usecases/get-stock-level.usecase';
import { StockQuery } from './application/queries/stock.query';
import { StockMovementCommandRepository } from './domain/repositories/stock-movement-command.repository';
import { PrismaStockMovementCommandRepository } from './infrastructure/persistence/prisma-stock-movement-command.repository';
import { PrismaStockQueryRepository } from './infrastructure/persistence/prisma-stock-query.repository';
import { StockQueryPort } from './public';

/**
 * Inventory stock-movement module (Phase 5).
 *
 * Records stock movements from goods receipts and their reversals. Balances
 * are a projection updated in the same transaction as the movement insert.
 * Consumers wrap every delivery in `InboxPort` and delegate to one use case
 * per file. The only export is the `public/` contract — internals stay put.
 */
@Module({
  imports: [PlatformModule],
  providers: [
    RecordStockMovementUseCase,
    RecordStockMovementReversalUseCase,
    GetStockLevelUseCase,
    StockQueryFacade,
    GoodsReceiptPostedConsumer,
    GoodsReceiptReversedConsumer,
    { provide: StockMovementCommandRepository, useClass: PrismaStockMovementCommandRepository },
    { provide: StockQuery, useClass: PrismaStockQueryRepository },
    { provide: StockQueryPort, useExisting: StockQueryFacade },
  ],
  exports: [StockQueryPort],
})
export class StockMovementModule {}
