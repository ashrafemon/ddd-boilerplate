import { PurchasableProductQueryPort } from '@business/procurement/purchase';
import { Module } from '@nestjs/common';
import { ProductQueryAdapter } from './application/inbound-adapters';
import {
  ProductEventEmitterConsumer,
  ProductKafkaConsumer,
  ProductRabbitMQConsumer,
  ProductSqsConsumer,
} from './application/integrations';
import {
  ChangePriceUseCase,
  CreateProductUseCase,
  GetProductUseCase,
  GetPurchasableProductsUseCase,
  GetPurchasableProductUseCase,
  ListProductsUseCase,
  ProductStatusUseCase,
  UpdateProductUseCase,
} from './application/usecase';
import { ProductCommandRepositoryPort, ProductQueryRepositoryPort } from './domain/domain-ports';
import {
  PrismaProductCommandRepository,
  PrismaProductQueryRepository,
} from './infrastructure/persistence';
import { ProductController } from './presentation/http/product.controller';

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
    { provide: PurchasableProductQueryPort, useExisting: ProductQueryAdapter },
    { provide: ProductCommandRepositoryPort, useClass: PrismaProductCommandRepository },
    { provide: ProductQueryRepositoryPort, useClass: PrismaProductQueryRepository },
  ],
  exports: [
    GetPurchasableProductUseCase,
    GetPurchasableProductsUseCase,
    PurchasableProductQueryPort,
  ],
})
export class ProductModule {}
