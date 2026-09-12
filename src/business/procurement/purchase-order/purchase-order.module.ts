import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { BatchOperationHandlerRegistry } from '@platform/batch-operation/batch-operation-handler.registry';
import { PlatformModule } from '@platform/platform.module';
import { ProductModule } from '@business/procurement/product/product.module';
import { VendorModule } from '@business/party/vendor/vendor.module';
import { PurchaseOrderController } from './presentation/http/purchase-order.controller';
import { PurchaseOrderForGrnFacade } from './application/facades/purchase-order-for-grn.facade';
import { CreatePurchaseOrderUseCase } from './application/usecases/create-purchase-order.usecase';
import { AddPurchaseOrderLineUseCase } from './application/usecases/add-purchase-order-line.usecase';
import { RemovePurchaseOrderLineUseCase } from './application/usecases/remove-purchase-order-line.usecase';
import { PurchaseOrderTransitionUseCase } from './application/usecases/purchase-order-transition.usecase';
import { GetPurchaseOrderUseCase } from './application/usecases/get-purchase-order.usecase';
import { ListPurchaseOrdersUseCase } from './application/usecases/list-purchase-orders.usecase';
import { PurchaseOrderEventEmitterListener } from './application/integrations/listeners/purchase-order.created.event-emitter.listener-event';
import { PurchaseOrderKafkaListener } from './application/integrations/listeners/purchase-order.created.kafka.listener-event';
import { PurchaseOrderRabbitMQListener } from './application/integrations/listeners/purchase-order.created.rabbitmq.listener-event';
import { PurchaseOrderSqsListener } from './application/integrations/listeners/purchase-order.sqs.listener-event';
import { PurchaseOrderCommandRepository } from './domain/repositories/purchase-order-command.repository';
import { PurchaseOrderQuery } from './application/queries/purchase-order.query';
import { PurchaseOrderIntegrationPort } from './application/integrations/publishes/purchase-order.integration-port';
import { PurchasableProductPort } from './application/outbound-ports/product-query.port';
import { OrderableVendorPort } from './application/outbound-ports/vendor-query.port';
import { CompanyConfigPort } from './application/outbound-ports/company-config.port';
import { PurchaseOrderForGrnPort } from '@business/procurement/purchase-order/public';
import { PrismaPurchaseOrderCommandRepository } from './infrastructure/persistence/prisma-purchase-order-command.repository';
import { PrismaPurchaseOrderQueryRepository } from './infrastructure/persistence/prisma-purchase-order-query.repository';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
import { CompanyConfigAdapter } from './infrastructure/adapters/platform/company-config.adapter';
import { PurchasableProductAdapter } from './infrastructure/adapters/module/purchasable-product.adapter';
import { OrderableVendorAdapter } from './infrastructure/adapters/module/orderable-vendor.adapter';
import './domain/events/purchase-order.registry';
import { PurchaseOrderBatchOperationAdapter } from './infrastructure/adapters/platform/purchase-order-batch-operation.adapter';

@Module({
  imports: [PlatformModule, ProductModule, VendorModule],
  controllers: [PurchaseOrderController],
  providers: [
    PurchaseOrderBatchOperationAdapter,
    CreatePurchaseOrderUseCase,
    AddPurchaseOrderLineUseCase,
    RemovePurchaseOrderLineUseCase,
    PurchaseOrderTransitionUseCase,
    GetPurchaseOrderUseCase,
    ListPurchaseOrdersUseCase,
    PurchaseOrderEventEmitterListener,
    PurchaseOrderRabbitMQListener,
    PurchaseOrderKafkaListener,
    PurchaseOrderSqsListener,
    PurchaseOrderForGrnFacade,
    { provide: PurchaseOrderForGrnPort, useExisting: PurchaseOrderForGrnFacade },
    { provide: PurchaseOrderCommandRepository, useClass: PrismaPurchaseOrderCommandRepository },
    { provide: PurchaseOrderQuery, useClass: PrismaPurchaseOrderQueryRepository },
    { provide: PurchaseOrderIntegrationPort, useClass: OutboxAdapter },
    { provide: CompanyConfigPort, useClass: CompanyConfigAdapter },
    { provide: PurchasableProductPort, useClass: PurchasableProductAdapter },
    { provide: OrderableVendorPort, useClass: OrderableVendorAdapter },
  ],
  exports: [PurchaseOrderForGrnPort],
})
export class PurchaseOrderModule implements OnApplicationBootstrap {
  constructor(
    private readonly batchHandlers: BatchOperationHandlerRegistry,
    private readonly batchOperationHandler: PurchaseOrderBatchOperationAdapter,
  ) {}

  /** Opt-in: register this aggregate's batch handler directly on the platform registry. */
  onApplicationBootstrap(): void {
    this.batchHandlers.register(
      'PurchaseOrder',
      ['submit', 'approve', 'reject', 'cancel'],
      this.batchOperationHandler,
    );
  }
}
