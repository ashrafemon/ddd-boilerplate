import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { ProductForPurchaseFacade } from './application/facades/product-for-purchase.facade';
import { ProductForSalesFacade } from './application/facades/product-for-sales.facade';
import { ProductPublisherPort } from './application/publishes/publishers/product.publisher-port';
import { SharedOutboxAdapter } from '@platform/platform-common/outbox/adapters/shared-outbox.adapter';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';
import { ChangePriceUseCase } from './application/use-cases/change-price.usecase';
import { CreateProductUseCase } from './application/use-cases/create-product.usecase';
import { GetProductUseCase } from './application/use-cases/get-product.usecase';
import { GetPurchasableProductsUseCase } from './application/use-cases/get-purchasable-products.usecase';
import { GetPurchasableProductUseCase } from './application/use-cases/get-purchasable-product.usecase';
import { FindPurchasableProductsBySkusUseCase } from './application/use-cases/find-purchasable-products-by-skus.usecase';
import { ListProductsUseCase } from './application/use-cases/list-products.usecase';
import { ProductStatusUseCase } from './application/use-cases/product-status.usecase';
import { UpdateProductUseCase } from './application/use-cases/update-product.usecase';
import { ProductCommandRepository } from './domain/repositories/product-command.repository';
import { ProductQuery } from './application/queries/product.query';
import { PrismaProductCommandRepository } from './infrastructure/persistence/prisma/prisma-product-command.repository';
import { PrismaProductQueryRepository } from './infrastructure/persistence/prisma/prisma-product-query.repository';
import { ProductController } from './presentation/http/product.controller';
import { ProductForPurchasePort } from '@business/product-management/product/public/ports/product-for-purchase.port';

/**
 * Product aggregate module. Controllers call use cases directly — no inbound
 * ports, no facades. ProductQueryAdapter implements PurchaseOrder's outbound
 * port contract in this module; the binding is exported so PurchaseOrder can
 * implement the public contract and inject its own use cases.
 *
 * Command usecases now read company configuration from the global CLS
 * `RequestContext` (stamped by middleware) instead of injecting
 * `CompanyConfigPort` directly (Rule 8).
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
    FindPurchasableProductsBySkusUseCase,
    GetPurchasableProductsUseCase,
    ProductForPurchaseFacade,
    ProductForSalesFacade,
    { provide: ProductForPurchasePort, useExisting: ProductForPurchaseFacade },
    { provide: ProductCommandRepository, useClass: PrismaProductCommandRepository },
    { provide: ProductQuery, useClass: PrismaProductQueryRepository },
    {
      provide: ProductPublisherPort,
      useFactory: (outboxWriter: OutboxWriterPort) =>
        new SharedOutboxAdapter(outboxWriter, 'Product'),
      inject: [OutboxWriterPort],
    },
  ],
  exports: [ProductForPurchasePort],
})
export class ProductModule {}
