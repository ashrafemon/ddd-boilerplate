import { Module } from '@nestjs/common';
import { ProductController } from './presentation/http/controllers';
import { CreateProductUseCase } from './application/usecase';
import { UpdateProductUseCase } from './application/usecase';
import { ChangePriceUseCase } from './application/usecase';
import { ProductStatusUseCase } from './application/usecase';
import { GetProductUseCase } from './application/usecase';
import { ListProductsUseCase } from './application/usecase';
import { GetPurchasableProductUseCase } from './application/usecase';
import { GetPurchasableProductsUseCase } from './application/usecase';
import { ProductRabbitMQConsumer } from './application/consumers';
import { ProductKafkaConsumer } from './application/consumers';
import { ProductSqsConsumer } from './application/consumers';
import { ProductEventEmitterConsumer } from './application/consumers';
import { ProductQueryAdapter } from './application/adapters';
import { PRODUCT_COMMAND_REPOSITORY } from './domain/ports';
import { PRODUCT_QUERY_REPOSITORY } from './domain/ports';
import { PURCHASE_ORDER_PRODUCT_PORT } from '@business/procurement/purchase/application/ports/outbound/product-query.port';
import { PrismaProductCommandRepository } from './infrastructure/persistence';
import { PrismaProductQueryRepository } from './infrastructure/persistence';

/**
 * Product aggregate module. Controllers call use cases directly — no inbound
 * ports, no facades. ProductQueryAdapter implements PurchaseOrder's outbound
 * port contract in this module; the binding is exported so PurchaseOrder can
 * resolve it through the ModuleRef without importing this module.
 */
@Module({
  controllers: [ProductController],
  providers: [
    CreateProductUseCase,
    UpdateProductUseCase,
    ChangePriceUseCase,
    ProductStatusUseCase,
    GetProductUseCase,
    ListProductsUseCase,
    GetPurchasableProductUseCase,
    GetPurchasableProductsUseCase,
    ProductRabbitMQConsumer,
    ProductKafkaConsumer,
    ProductSqsConsumer,
    ProductEventEmitterConsumer,
    ProductQueryAdapter,
    { provide: PURCHASE_ORDER_PRODUCT_PORT, useExisting: ProductQueryAdapter },
    { provide: PRODUCT_COMMAND_REPOSITORY, useClass: PrismaProductCommandRepository },
    { provide: PRODUCT_QUERY_REPOSITORY, useClass: PrismaProductQueryRepository },
  ],
  exports: [
    GetPurchasableProductUseCase,
    GetPurchasableProductsUseCase,
    PURCHASE_ORDER_PRODUCT_PORT,
  ],
})
export class ProductModule {}
