import { Module } from '@nestjs/common';
import { PurchaseOrderController } from './presentation/http/controllers';
import { PurchaseOrderQueryFacade } from './application/facades';
import { CreatePurchaseOrderUseCase } from './application/usecase';
import { AddPurchaseOrderLineUseCase } from './application/usecase';
import { RemovePurchaseOrderLineUseCase } from './application/usecase';
import { PurchaseOrderTransitionUseCase } from './application/usecase';
import { GetPurchaseOrderUseCase } from './application/usecase';
import { ListPurchaseOrdersUseCase } from './application/usecase';
import { PurchaseOrderRabbitMQConsumer } from './application/consumers';
import { PurchaseOrderKafkaConsumer } from './application/consumers';
import { PurchaseOrderSqsConsumer } from './application/consumers';
import { PurchaseOrderEventEmitterConsumer } from './application/consumers';
import { PurchaseOrderCommandRepositoryPort } from './domain/ports';
import { PurchaseOrderQueryRepositoryPort } from './domain/ports';
import { PurchaseOrderIntegrationPort } from './application/integrations/publishers/purchase-order.integration-port';
import { CompanyConfigOutboundPort } from './application/outbound-ports/company-config.port';
import { PurchaseOrderQueryPort } from './public/ports/purchase-order.port';
import { PrismaPurchaseOrderCommandRepository } from './infrastructure/persistence';
import { PrismaPurchaseOrderQueryRepository } from './infrastructure/persistence';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
import { CompanyConfigOutboundAdapter } from './infrastructure/adapters/platform/company-config.adapter';
import './domain/events/purchase-order.registry';

@Module({
  controllers: [PurchaseOrderController],
  providers: [
    CreatePurchaseOrderUseCase,
    AddPurchaseOrderLineUseCase,
    RemovePurchaseOrderLineUseCase,
    PurchaseOrderTransitionUseCase,
    GetPurchaseOrderUseCase,
    ListPurchaseOrdersUseCase,
    PurchaseOrderEventEmitterConsumer,
    PurchaseOrderRabbitMQConsumer,
    PurchaseOrderKafkaConsumer,
    PurchaseOrderSqsConsumer,
    PurchaseOrderQueryFacade,
    { provide: PurchaseOrderQueryPort, useExisting: PurchaseOrderQueryFacade },
    { provide: PurchaseOrderCommandRepositoryPort, useClass: PrismaPurchaseOrderCommandRepository },
    { provide: PurchaseOrderQueryRepositoryPort, useClass: PrismaPurchaseOrderQueryRepository },
    { provide: PurchaseOrderIntegrationPort, useClass: OutboxAdapter },
    { provide: CompanyConfigOutboundPort, useClass: CompanyConfigOutboundAdapter },
  ],
  exports: [PurchaseOrderQueryPort],
})
export class PurchaseOrderModule {}