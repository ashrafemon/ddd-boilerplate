import { Module } from '@nestjs/common';
import { ProductController } from './controllers/product.controller';
import { CreateProductUseCase } from './application/use-cases/create-product.use-case';
import { UpdateProductUseCase } from './application/use-cases/update-product.use-case';
import { ChangePriceUseCase } from './application/use-cases/change-price.use-case';
import { ProductStatusUseCase } from './application/use-cases/product-status.use-case';
import { ProductQueryService } from './application/queries/product-query.service';
import { ProductCommandService } from './application/product-command.service';
import { PRODUCT_COMMAND_PORT } from './ports/inbound/product.command.port';
import { PRODUCT_QUERY_PORT } from './ports/inbound/product.query.port';

@Module({
  controllers: [ProductController],
  providers: [
    CreateProductUseCase,
    UpdateProductUseCase,
    ChangePriceUseCase,
    ProductStatusUseCase,
    ProductQueryService,
    ProductCommandService,
    { provide: PRODUCT_COMMAND_PORT, useExisting: ProductCommandService },
    { provide: PRODUCT_QUERY_PORT, useExisting: ProductQueryService },
  ],
  exports: [ProductCommandService, ProductQueryService, PRODUCT_COMMAND_PORT, PRODUCT_QUERY_PORT],
})
export class ProductModule {}
