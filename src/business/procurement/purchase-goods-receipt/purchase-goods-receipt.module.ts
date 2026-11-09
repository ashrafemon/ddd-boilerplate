import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { PurchaseOrderModule } from '@business/procurement/purchase-order/purchase-order.module';
import { GrnForPurchaseOrderFacade } from './application/facades/grn-for-purchase-order.facade';
import { GrnPublisherPort } from './application/publishes/publishers/grn.publisher-port';
import { SharedOutboxAdapter } from '@platform/platform-common/outbox/adapters/shared-outbox.adapter';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';
import { PurchaseOrderPort } from './application/outbound-ports/purchase-order-query.port';
import { NumberingPort } from './application/outbound-ports/numbering.port';
import { ReadCachePort } from './application/outbound-ports/read-cache.port';
import { NumberingAdapter } from './infrastructure/adapters/platform/numbering.adapter';
import { ReadCacheAdapter } from './infrastructure/adapters/platform/read-cache.adapter';
import { CreateGrnUseCase } from './application/use-cases/create-grn.usecase';
import { AddGrnLineUseCase } from './application/use-cases/add-grn-line.usecase';
import { SetGrnLineTrackingUseCase } from './application/use-cases/set-grn-line-tracking.usecase';
import { ReceiveGrnUseCase } from './application/use-cases/receive-grn.usecase';
import { CancelGrnUseCase } from './application/use-cases/cancel-grn.usecase';
import { PostGrnUseCase } from './application/use-cases/post-grn.usecase';
import { ReverseGrnUseCase } from './application/use-cases/reverse-grn.usecase';
import { RecordInspectionResultUseCase } from './application/use-cases/record-inspection-result.usecase';
import { GetGrnUseCase } from './application/use-cases/get-grn.usecase';
import { ListGrnsUseCase } from './application/use-cases/list-grns.usecase';
import { GrnCommandRepository } from './domain/repositories/grn-command.repository';
import { GrnQuery } from './application/queries/grn.query';
import { PurchaseOrderAdapter } from './infrastructure/adapters/business-aggregate/purchase-order.adapter';
import { PrismaGrnCommandRepository } from './infrastructure/persistence/prisma/prisma-grn-command.repository';
import { PrismaGrnQueryRepository } from './infrastructure/persistence/prisma/prisma-grn-query.repository';
import { GrnController } from './presentation/http/grn.controller';
import { GrnForPurchaseOrderPort } from '@business/procurement/purchase-goods-receipt/public/ports/grn-for-purchase-order.port';
import { GrnBatchOperationAdapter } from './infrastructure/adapters/platform/grn-batch-operation.adapter';
import { GrnNotificationAdapter } from './infrastructure/adapters/platform/grn-notification.adapter';

@Module({
  imports: [PlatformModule, PurchaseOrderModule],
  controllers: [GrnController],
  providers: [
    GrnBatchOperationAdapter,
    GrnNotificationAdapter,
    CreateGrnUseCase,
    AddGrnLineUseCase,
    SetGrnLineTrackingUseCase,
    ReceiveGrnUseCase,
    // Read-model cache (plan §1.6): controllers, batch adapter and the PO-facing
    // facade all read through the caching decorator; commands invalidate.
    GetGrnUseCase,
    ListGrnsUseCase,
    CancelGrnUseCase,
    PostGrnUseCase,
    ReverseGrnUseCase,
    RecordInspectionResultUseCase,
    GrnForPurchaseOrderFacade,
    { provide: GrnForPurchaseOrderPort, useExisting: GrnForPurchaseOrderFacade },
    { provide: GrnCommandRepository, useClass: PrismaGrnCommandRepository },
    { provide: GrnQuery, useClass: PrismaGrnQueryRepository },
    {
      provide: GrnPublisherPort,
      useFactory: (outboxWriter: OutboxWriterPort) =>
        new SharedOutboxAdapter(outboxWriter, 'GoodReceiptNote'),
      inject: [OutboxWriterPort],
    },
    { provide: PurchaseOrderPort, useClass: PurchaseOrderAdapter },
    { provide: NumberingPort, useClass: NumberingAdapter },
    { provide: ReadCachePort, useClass: ReadCacheAdapter },
  ],
  exports: [GrnForPurchaseOrderPort],
})
export class GoodReceiptNoteModule {}
