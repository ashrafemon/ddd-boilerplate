import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { ProductForPurchaseFacade } from './application/facades/product-for-purchase.facade';
import { ProductEventEmitterListener } from './application/integrations/listeners/product.created.event-emitter.listener-event';
import { ProductKafkaListener } from './application/integrations/listeners/product.created.kafka.listener-event';
import { ProductRabbitMQListener } from './application/integrations/listeners/product.created.rabbitmq.listener-event';
import { ProductSqsListener } from './application/integrations/listeners/product.sqs.listener-event';
import { ProductIntegrationPort } from './application/integrations/publishes/product.integration-port';
import { CompanyConfigPort } from './application/outbound-ports/company-config.port';
import { ChangePriceUseCase } from './application/usecases/change-price.usecase';
import { CreateProductUseCase } from './application/usecases/create-product.usecase';
import { GetProductUseCase } from './application/usecases/get-product.usecase';
import { GetPurchasableProductsUseCase } from './application/usecases/get-purchasable-products.usecase';
import { GetPurchasableProductUseCase } from './application/usecases/get-purchasable-product.usecase';
import { ListProductsUseCase } from './application/usecases/list-products.usecase';
import { ProductStatusUseCase } from './application/usecases/product-status.usecase';
import { UpdateProductUseCase } from './application/usecases/update-product.usecase';
import './domain/events/product.registry';
import { ProductCommandRepository } from './domain/repositories/product-command.repository';
import { ProductQuery } from './application/queries/product.query';
import { CompanyConfigAdapter } from './infrastructure/adapters/platform/company-config.adapter';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
import { PrismaProductCommandRepository } from './infrastructure/persistence/prisma-product-command.repository';
import { PrismaProductQueryRepository } from './infrastructure/persistence/prisma-product-query.repository';
import { ProductController } from './presentation/http/product.controller';
import { ProductForPurchasePort } from '@business/catalog/product/public';

/**
 * Product aggregate module. Controllers call use cases directly — no inbound
 * ports, no facades. ProductQueryAdapter implements PurchaseOrder's outbound
 * port contract in this module; the binding is exported so PurchaseOrder can
 * implement the public contract and inject its own use cases.
 */
@Module({
  imports: [PlatformModule],
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
    ProductForPurchaseFacade,
    { provide: ProductForPurchasePort, useExisting: ProductForPurchaseFacade },
    { provide: ProductCommandRepository, useClass: PrismaProductCommandRepository },
    { provide: ProductQuery, useClass: PrismaProductQueryRepository },
    { provide: ProductIntegrationPort, useClass: OutboxAdapter },
    { provide: CompanyConfigPort, useClass: CompanyConfigAdapter },
  ],
  exports: [ProductForPurchasePort],
})
export class ProductModule {}
