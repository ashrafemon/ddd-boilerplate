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
import { PRODUCT_COMMAND_REPOSITORY } from './ports/outbound/product-command-repository.port';
import { PRODUCT_QUERY_REPOSITORY } from './ports/outbound/product-query-repository.port';
import { PrismaProductCommandRepository } from './infrastructure/persistence/prisma-product-command.repository';
import { PrismaProductQueryRepository } from './infrastructure/persistence/prisma-product-query.repository';

/**
 * Product aggregate module. Controllers call use cases directly — no inbound
 * ports, no facades. Repository ports are bound to this module's own
 * infrastructure adapters — no global persistence module.
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
    { provide: PRODUCT_COMMAND_REPOSITORY, useClass: PrismaProductCommandRepository },
    { provide: PRODUCT_QUERY_REPOSITORY, useClass: PrismaProductQueryRepository },
  ],
  exports: [GetPurchasableProductUseCase, GetPurchasableProductsUseCase],
})
export class ProductModule {}
