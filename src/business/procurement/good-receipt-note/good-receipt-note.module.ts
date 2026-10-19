import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { PurchaseOrderModule } from '@business/procurement/purchase-order/purchase-order.module';
import { GrnForPurchaseOrderFacade } from './application/facades/grn-for-purchase-order.facade';
import { GrnEventEmitterListener } from './application/integrations/listeners/grn.created.event-emitter.listener-event';
import { GrnKafkaListener } from './application/integrations/listeners/grn.created.kafka.listener-event';
import { GrnRabbitMQListener } from './application/integrations/listeners/grn.created.rabbitmq.listener-event';
import { GrnSqsListener } from './application/integrations/listeners/grn.sqs.listener-event';
import { GrnIntegrationPort } from './application/integrations/publishes/grn.integration-port';
import { PurchaseOrderPort } from './application/outbound-ports/purchase-order-query.port';
import { CompanyConfigPort } from './application/outbound-ports/company-config.port';
import { NumberingPort } from './application/outbound-ports/numbering.port';
import { NumberingAdapter } from './infrastructure/adapters/platform/numbering.adapter';
import { CreateGrnUseCase } from './application/usecases/create-grn.usecase';
import { AddGrnLineUseCase } from './application/usecases/add-grn-line.usecase';
import { ReceiveGrnUseCase } from './application/usecases/receive-grn.usecase';
import { CompleteGrnUseCase } from './application/usecases/complete-grn.usecase';
import { CancelGrnUseCase } from './application/usecases/cancel-grn.usecase';
import { PostGrnUseCase } from './application/usecases/post-grn.usecase';
import { ReverseGrnUseCase } from './application/usecases/reverse-grn.usecase';
import { RecordInspectionResultUseCase } from './application/usecases/record-inspection-result.usecase';
import { GetGrnUseCase } from './application/usecases/get-grn.usecase';
import { ListGrnsUseCase } from './application/usecases/list-grns.usecase';
import { GrnCommandRepository } from './domain/repositories/grn-command.repository';
import { GrnQuery } from './application/queries/grn.query';
import { CompanyConfigAdapter } from './infrastructure/adapters/platform/company-config.adapter';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
import { PurchaseOrderAdapter } from './infrastructure/adapters/module/purchase-order.adapter';
import { PrismaGrnCommandRepository } from './infrastructure/persistence/prisma-grn-command.repository';
import { PrismaGrnQueryRepository } from './infrastructure/persistence/prisma-grn-query.repository';
import { GrnController } from './presentation/http/grn.controller';
import { GrnForPurchaseOrderPort } from '@business/procurement/good-receipt-note/public';
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
    ReceiveGrnUseCase,
    CompleteGrnUseCase,
    // Read-model cache (plan §1.6): controllers, batch adapter and the PO-facing
    // facade all read through the caching decorator; commands invalidate.
    GetGrnUseCase,
    ListGrnsUseCase,
    CancelGrnUseCase,
    PostGrnUseCase,
    ReverseGrnUseCase,
    RecordInspectionResultUseCase,
    GrnEventEmitterListener,
    GrnKafkaListener,
    GrnRabbitMQListener,
    GrnSqsListener,
    GrnForPurchaseOrderFacade,
    { provide: GrnForPurchaseOrderPort, useExisting: GrnForPurchaseOrderFacade },
    { provide: GrnCommandRepository, useClass: PrismaGrnCommandRepository },
    { provide: GrnQuery, useClass: PrismaGrnQueryRepository },
    { provide: GrnIntegrationPort, useClass: OutboxAdapter },
    { provide: CompanyConfigPort, useClass: CompanyConfigAdapter },
    { provide: PurchaseOrderPort, useClass: PurchaseOrderAdapter },
    { provide: NumberingPort, useClass: NumberingAdapter },
  ],
  exports: [GrnForPurchaseOrderPort],
})
export class GoodReceiptNoteModule {}
