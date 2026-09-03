import { Module } from '@nestjs/common';
import { PurchasableProductFacade } from './application/facades/purchasable-product.facade';
import { ProductEventEmitterListener } from './application/integrations/listeners/product.event-emitter.listener';
import { ProductKafkaListener } from './application/integrations/listeners/product.kafka.listener';
import { ProductRabbitMQListener } from './application/integrations/listeners/product.rabbitmq.listener';
import { ProductSqsListener } from './application/integrations/listeners/product.sqs.listener';
import { ProductIntegrationPort } from './application/integrations/publishers/product.integration-port';
import { CompanyConfigOutboundPort } from './application/outbound-ports/company-config.port';
import { ChangePriceUseCase } from './application/usecase/change-price.usecase';
import { CreateProductUseCase } from './application/usecase/create-product.usecase';
import { GetProductUseCase } from './application/usecase/get-product.usecase';
import { GetPurchasableProductsUseCase } from './application/usecase/get-purchasable-products.usecase';
import { GetPurchasableProductUseCase } from './application/usecase/get-purchasable-product.usecase';
import { ListProductsUseCase } from './application/usecase/list-products.usecase';
import { ProductStatusUseCase } from './application/usecase/product-status.usecase';
import { UpdateProductUseCase } from './application/usecase/update-product.usecase';
import './domain/domain-events/product.registry';
import { ProductCommandRepositoryPort } from './domain/domain-ports/product-command-repository.port';
import { ProductQueryRepositoryPort } from './domain/domain-ports/product-query-repository.port';
import { CompanyConfigOutboundAdapter } from './infrastructure/adapters/platform/company-config.adapter';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
import { PrismaProductCommandRepository } from './infrastructure/persistence/prisma-product-command.repository';
import { PrismaProductQueryRepository } from './infrastructure/persistence/prisma-product-query.repository';
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
    ProductRabbitMQListener,
    ProductKafkaListener,
    ProductSqsListener,
    ProductEventEmitterListener,
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
