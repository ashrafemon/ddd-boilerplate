import { Module } from '@nestjs/common';
import { PurchaseOrderController } from './presentation/http/controllers/purchase-order.controller';
import { CreatePurchaseOrderUseCase } from './application/usecase/create-purchase-order.usecase';
import { AddPurchaseOrderLineUseCase } from './application/usecase/add-purchase-order-line.usecase';
import { RemovePurchaseOrderLineUseCase } from './application/usecase/remove-purchase-order-line.usecase';
import { PurchaseOrderTransitionUseCase } from './application/usecase/purchase-order-transition.usecase';
import { GetPurchaseOrderUseCase } from './application/usecase/get-purchase-order.usecase';
import { ListPurchaseOrdersUseCase } from './application/usecase/list-purchase-orders.usecase';
import { PurchaseOrderRabbitMQConsumer } from './application/consumers/purchase-order.rabbitmq.consumer';
import { PurchaseOrderKafkaConsumer } from './application/consumers/purchase-order.kafka.consumer';
import { PurchaseOrderSqsConsumer } from './application/consumers/purchase-order.sqs.consumer';
import { PurchaseOrderEventEmitterConsumer } from './application/consumers/purchase-order.event-emitter.consumer';
import { PURCHASE_ORDER_COMMAND_REPOSITORY } from './domain/ports/purchase-order-command-repository.port';
import { PURCHASE_ORDER_QUERY_REPOSITORY } from './domain/ports/purchase-order-query-repository.port';
import { PrismaPurchaseOrderCommandRepository } from './infrastructure/persistence/prisma-purchase-order-command.repository';
import { PrismaPurchaseOrderQueryRepository } from './infrastructure/persistence/prisma-purchase-order-query.repository';

/**
 * PurchaseOrder aggregate module (procurement context). Controllers call use
 * cases directly — no inbound ports, no facades. Cross-aggregate calls go
 * through outbound ports that are implemented in the Vendor/Product modules
 * and resolved at runtime via the ModulePortResolver — this module does NOT
 * import VendorModule/ProductModule. Repository ports are bound to this
 * module's own infrastructure adapters.
 */
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
    { provide: PURCHASE_ORDER_COMMAND_REPOSITORY, useClass: PrismaPurchaseOrderCommandRepository },
    { provide: PURCHASE_ORDER_QUERY_REPOSITORY, useClass: PrismaPurchaseOrderQueryRepository },
  ],
})
export class PurchaseOrderModule {}
