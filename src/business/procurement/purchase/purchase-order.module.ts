import { Module } from '@nestjs/common';
import { PurchaseOrderController } from './presentation/http/controllers';
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
import { PURCHASE_ORDER_COMMAND_REPOSITORY } from './domain/ports';
import { PURCHASE_ORDER_QUERY_REPOSITORY } from './domain/ports';
import { PrismaPurchaseOrderCommandRepository } from './infrastructure/persistence';
import { PrismaPurchaseOrderQueryRepository } from './infrastructure/persistence';

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
