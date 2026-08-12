import { Module } from '@nestjs/common';
import { ProductController } from './presentation/http/controllers/product.controller';
import { CreateProductUseCase } from './application/usecase/create-product.usecase';
import { UpdateProductUseCase } from './application/usecase/update-product.usecase';
import { ChangePriceUseCase } from './application/usecase/change-price.usecase';
import { ProductStatusUseCase } from './application/usecase/product-status.usecase';
import { GetProductUseCase } from './application/usecase/get-product.usecase';
import { ListProductsUseCase } from './application/usecase/list-products.usecase';
import { GetPurchasableProductUseCase } from './application/usecase/get-purchasable-product.usecase';
import { GetPurchasableProductsUseCase } from './application/usecase/get-purchasable-products.usecase';
import { ProductRabbitMQConsumer } from './application/consumers/product.rabbitmq.consumer';
import { ProductKafkaConsumer } from './application/consumers/product.kafka.consumer';
import { ProductSqsConsumer } from './application/consumers/product.sqs.consumer';
import { ProductEventEmitterConsumer } from './application/consumers/product.event-emitter.consumer';
import { ProductQueryAdapter } from './application/adapters/product-query.adapter';
import { PRODUCT_COMMAND_REPOSITORY } from './domain/ports/product-command-repository.port';
import { PRODUCT_QUERY_REPOSITORY } from './domain/ports/product-query-repository.port';
import { PURCHASE_ORDER_PRODUCT_PORT } from '@business/procurement/purchase/application/ports/outbound/product-query.port';
import { PrismaProductCommandRepository } from './infrastructure/persistence/prisma-product-command.repository';
import { PrismaProductQueryRepository } from './infrastructure/persistence/prisma-product-query.repository';

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
