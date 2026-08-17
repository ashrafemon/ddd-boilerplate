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
import { ProductCommandRepositoryPort } from './domain/domain-ports';
import { ProductQueryRepositoryPort } from './domain/domain-ports';
import { PurchasableProductQueryPort } from '@business/procurement/purchase';
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
