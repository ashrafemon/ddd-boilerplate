import { Module } from '@nestjs/common';
import { PurchaseOrderController } from './presentation/http/purchase-order.controller';
import { PurchaseOrderQueryFacade } from './application/facades/purchase-order-query.facade';
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
import { CompanyConfigOutboundPort } from './application/outbound-ports/company-config.port';
import { PurchaseOrderQueryPort } from '@business/procurement/purchase-order/public';
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
    { provide: PurchaseOrderCommandRepository, useClass: PrismaPurchaseOrderCommandRepository },
    { provide: PurchaseOrderQuery, useClass: PrismaPurchaseOrderQueryRepository },
    { provide: PurchaseOrderIntegrationPort, useClass: OutboxAdapter },
    { provide: CompanyConfigOutboundPort, useClass: CompanyConfigOutboundAdapter },
  ],
  exports: [PurchaseOrderQueryPort],
})
export class PurchaseOrderModule {}
