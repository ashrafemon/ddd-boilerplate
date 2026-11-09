import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { ProductForPurchaseFacade } from './application/facades/product-for-purchase.facade';
import { ProductPublisherPort } from './application/integrations/publishes/product.publisher-port';
import { ChangePriceUseCase } from './application/usecases/change-price.usecase';
import { CreateProductUseCase } from './application/usecases/create-product.usecase';
import { GetProductUseCase } from './application/usecases/get-product.usecase';
import { GetPurchasableProductsUseCase } from './application/usecases/get-purchasable-products.usecase';
import { GetPurchasableProductUseCase } from './application/usecases/get-purchasable-product.usecase';
import { FindPurchasableProductsBySkusUseCase } from './application/usecases/find-purchasable-products-by-skus.usecase';
import { ListProductsUseCase } from './application/usecases/list-products.usecase';
import { ProductStatusUseCase } from './application/usecases/product-status.usecase';
import { UpdateProductUseCase } from './application/usecases/update-product.usecase';
import { ProductCommandRepository } from './domain/repositories/product-command.repository';
import { ProductQuery } from './application/queries/product.query';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
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
    { provide: ProductForPurchasePort, useExisting: ProductForPurchaseFacade },
    { provide: ProductCommandRepository, useClass: PrismaProductCommandRepository },
    { provide: ProductQuery, useClass: PrismaProductQueryRepository },
    { provide: ProductPublisherPort, useClass: OutboxAdapter },
  ],
  exports: [ProductForPurchasePort],
})
export class ProductModule {}
