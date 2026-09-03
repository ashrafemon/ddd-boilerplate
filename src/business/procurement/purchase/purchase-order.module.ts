import { Module } from '@nestjs/common';
import { PurchaseOrderController } from './presentation/http/controllers/purchase-order.controller';
import { PurchaseOrderQueryFacade } from './application/facades/purchase-order-query.facade';
import { CreatePurchaseOrderUseCase } from './application/usecase/create-purchase-order.usecase';
import { AddPurchaseOrderLineUseCase } from './application/usecase/add-purchase-order-line.usecase';
import { RemovePurchaseOrderLineUseCase } from './application/usecase/remove-purchase-order-line.usecase';
import { PurchaseOrderTransitionUseCase } from './application/usecase/purchase-order-transition.usecase';
import { GetPurchaseOrderUseCase } from './application/usecase/get-purchase-order.usecase';
import { ListPurchaseOrdersUseCase } from './application/usecase/list-purchase-orders.usecase';
import { PurchaseOrderEventEmitterListener } from './application/integrations/listeners/purchase-order.event-emitter.listener';
import { PurchaseOrderKafkaListener } from './application/integrations/listeners/purchase-order.kafka.listener';
import { PurchaseOrderRabbitMQListener } from './application/integrations/listeners/purchase-order.rabbitmq.listener';
import { PurchaseOrderSqsListener } from './application/integrations/listeners/purchase-order.sqs.listener';
import { PurchaseOrderCommandRepositoryPort } from './domain/ports/purchase-order-command-repository.port';
import { PurchaseOrderQueryRepositoryPort } from './domain/ports/purchase-order-query-repository.port';
import { PurchaseOrderIntegrationPort } from './application/integrations/publishers/purchase-order.integration-port';
import { CompanyConfigOutboundPort } from './application/outbound-ports/company-config.port';
import { PurchaseOrderQueryPort } from './public/ports/purchase-order.port';
import { PrismaPurchaseOrderCommandRepository } from './infrastructure/persistence/prisma-purchase-order-command.repository';
import { PrismaPurchaseOrderQueryRepository } from './infrastructure/persistence/prisma-purchase-order-query.repository';
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
    PurchaseOrderEventEmitterListener,
    PurchaseOrderRabbitMQListener,
    PurchaseOrderKafkaListener,
    PurchaseOrderSqsListener,
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