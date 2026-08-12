import { Module } from '@nestjs/common';
import { PurchaseOrderController } from './presentation/http/controllers/purchase-order.controller';
import { CreatePurchaseOrderUseCase } from './application/usecase/create-purchase-order.usecase';
import { AddPurchaseOrderLineUseCase } from './application/usecase/add-purchase-order-line.usecase';
import { RemovePurchaseOrderLineUseCase } from './application/usecase/remove-purchase-order-line.usecase';
import { PurchaseOrderTransitionUseCase } from './application/usecase/purchase-order-transition.usecase';
import { VendorQueryAdapter } from './application/adapters/vendor-query.adapter';
import { ProductQueryAdapter } from './application/adapters/product-query.adapter';
import { GetPurchaseOrderUseCase } from './application/usecase/get-purchase-order.usecase';
import { ListPurchaseOrdersUseCase } from './application/usecase/list-purchase-orders.usecase';
import { PurchaseOrderRabbitMQConsumer } from './application/consumers/purchase-order.rabbitmq.consumer';
import { PurchaseOrderKafkaConsumer } from './application/consumers/purchase-order.kafka.consumer';
import { PurchaseOrderSqsConsumer } from './application/consumers/purchase-order.sqs.consumer';
import { PurchaseOrderEventEmitterConsumer } from './application/consumers/purchase-order.event-emitter.consumer';
import { PURCHASE_ORDER_VENDOR_PORT } from './ports/outbound/vendor-query.port';
import { PURCHASE_ORDER_PRODUCT_PORT } from './ports/outbound/product-query.port';
import { PURCHASE_ORDER_COMMAND_REPOSITORY } from './ports/outbound/purchase-order-command-repository.port';
import { PURCHASE_ORDER_QUERY_REPOSITORY } from './ports/outbound/purchase-order-query-repository.port';
import { PrismaPurchaseOrderCommandRepository } from './infrastructure/persistence/prisma-purchase-order-command.repository';
import { PrismaPurchaseOrderQueryRepository } from './infrastructure/persistence/prisma-purchase-order-query.repository';

/**
 * PurchaseOrder aggregate module (procurement context). Controllers call use
 * cases directly — no inbound ports, no facades. Cross-aggregate calls go
 * through outbound ports whose adapters resolve the Vendor/Product query use
 * cases via the ModulePortResolver — this module does NOT import
 * VendorModule/ProductModule. Repository ports are bound to this module's own
 * infrastructure adapters.
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
    VendorQueryAdapter,
    ProductQueryAdapter,
    PurchaseOrderEventEmitterConsumer,
    PurchaseOrderRabbitMQConsumer,
    PurchaseOrderKafkaConsumer,
    PurchaseOrderSqsConsumer,
    { provide: PURCHASE_ORDER_VENDOR_PORT, useExisting: VendorQueryAdapter },
    { provide: PURCHASE_ORDER_PRODUCT_PORT, useExisting: ProductQueryAdapter },
    { provide: PURCHASE_ORDER_COMMAND_REPOSITORY, useClass: PrismaPurchaseOrderCommandRepository },
    { provide: PURCHASE_ORDER_QUERY_REPOSITORY, useClass: PrismaPurchaseOrderQueryRepository },
  ],
})
export class PurchaseOrderModule {}
