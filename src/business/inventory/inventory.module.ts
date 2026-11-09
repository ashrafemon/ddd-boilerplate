import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { StockMovementController } from './presentation/http/stock-movement.controller';
import { RecordStockMovementUseCase } from './application/use-cases/record-stock-movement.usecase';
import { ReverseStockMovementUseCase } from './application/use-cases/reverse-stock-movement.usecase';
import { GetProductStockBalanceUseCase } from './application/use-cases/get-product-stock-balance.usecase';
import { ListStockMovementsUseCase } from './application/use-cases/list-stock-movements.usecase';
import { StockReadFacade } from './application/facades/stock-read.facade';
import {
  StockMovementCommandRepository,
  StockBalanceRepository,
} from './domain/repositories/stock-movement-command.repository';
import { StockMovementQuery } from './application/queries/stock-movement.query';
import { InventoryPublisherPort } from './application/publishes/publishers/inventory.publisher-port';
import { StockBalanceQueryPort } from './application/outbound-ports/stock-balance-query.port';
import { StockReadPort } from '@business/inventory/public/ports/stock-read.port';
import { SharedOutboxAdapter } from '@platform/platform-common/outbox/adapters/shared-outbox.adapter';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';
import { PrismaStockMovementCommandRepository } from './infrastructure/persistence/prisma/prisma-stock-movement-command.repository';
import { PrismaStockBalanceRepository } from './infrastructure/persistence/prisma/prisma-stock-movement-command.repository';
import { PrismaStockMovementQueryRepository } from './infrastructure/persistence/prisma/prisma-stock-movement-query.repository';

@Module({
  imports: [PlatformModule],
  controllers: [StockMovementController],
  providers: [
    RecordStockMovementUseCase,
    ReverseStockMovementUseCase,
    GetProductStockBalanceUseCase,
    ListStockMovementsUseCase,
    StockReadFacade,
    { provide: StockMovementCommandRepository, useClass: PrismaStockMovementCommandRepository },
    { provide: StockBalanceRepository, useClass: PrismaStockBalanceRepository },
    { provide: StockMovementQuery, useClass: PrismaStockMovementQueryRepository },
    {
      provide: InventoryPublisherPort,
      useFactory: (outboxWriter: OutboxWriterPort) =>
        new SharedOutboxAdapter(outboxWriter, 'StockMovement'),
      inject: [OutboxWriterPort],
    },
    { provide: StockBalanceQueryPort, useClass: PrismaStockMovementQueryRepository },
    { provide: StockReadPort, useExisting: StockReadFacade },
    PrismaStockBalanceRepository,
  ],
  exports: [StockBalanceQueryPort, StockReadPort],
})
export class InventoryModule {}
