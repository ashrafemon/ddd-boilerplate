import { Module } from '@nestjs/common';
import { PurchasableProductFacade } from './application/facades';
import {
  ProductEventEmitterConsumer,
  ProductKafkaConsumer,
  ProductRabbitMQConsumer,
  ProductSqsConsumer,
} from './application/integrations';
import { ProductIntegrationPort } from './application/integrations/publishers/product.integration-port';
import { CompanyConfigOutboundPort } from './application/outbound-ports/company-config.port';
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
import './domain/domain-events/product.registry';
import { ProductCommandRepositoryPort, ProductQueryRepositoryPort } from './domain/domain-ports';
import { CompanyConfigOutboundAdapter } from './infrastructure/adapters/platform/company-config.adapter';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
import {
  PrismaProductCommandRepository,
  PrismaProductQueryRepository,
} from './infrastructure/persistence';
import { ProductController } from './presentation/http/product.controller';
import { PurchasableProductPort } from './public/ports/purchasable-product.port';

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
    PurchasableProductFacade,
    { provide: PurchasableProductPort, useExisting: PurchasableProductFacade },
    { provide: ProductCommandRepositoryPort, useClass: PrismaProductCommandRepository },
    { provide: ProductQueryRepositoryPort, useClass: PrismaProductQueryRepository },
    { provide: ProductIntegrationPort, useClass: OutboxAdapter },
    { provide: CompanyConfigOutboundPort, useClass: CompanyConfigOutboundAdapter },
  ],
  exports: [PurchasableProductPort],
})
export class ProductModule {}
