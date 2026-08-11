import { Module } from '@nestjs/common';
import { ActivateProductUseCase, DeactivateProductUseCase } from './application/use-case/update-product/product-status.use-case';
import { CreateProductUseCase } from './application/use-case/create-product/create-product.use-case';
import { GetProductUseCase } from './application/use-case/get-product/get-product.use-case';
import { UpdateProductUseCase } from './application/use-case/update-product/update-product.use-case';
import { CreateProductPort } from './application/port/create-product.port';
import { GetProductPort } from './application/port/get-product.port';
import {
  ActivateProductPort,
  DeactivateProductPort,
  UpdateProductPort,
} from './application/port/update-product.port';
import { ProductWriteRepositoryPort } from './domain/port/product-write-repository.port';
import { ProductReadRepositoryPort } from './domain/port/product-read-repository.port';
import { ProductBuilder } from './domain/service/product-builder.service';
import { PrismaProductReadRepositoryAdapter } from './infrastructure/persistence/read/product-read-repository.adapter';
import { PrismaProductWriteRepositoryAdapter } from './infrastructure/persistence/write/product-write-repository.adapter';
import { ProductController } from './presentation/http/controller/product.controller';

/**
 * Product bounded context.
 */
@Module({
  controllers: [ProductController],
  providers: [
    ProductBuilder,
    CreateProductUseCase,
    GetProductUseCase,
    UpdateProductUseCase,
    ActivateProductUseCase,
    DeactivateProductUseCase,
    { provide: CreateProductPort, useExisting: CreateProductUseCase },
    { provide: GetProductPort, useExisting: GetProductUseCase },
    { provide: UpdateProductPort, useExisting: UpdateProductUseCase },
    { provide: ActivateProductPort, useExisting: ActivateProductUseCase },
    { provide: DeactivateProductPort, useExisting: DeactivateProductUseCase },
    { provide: ProductWriteRepositoryPort, useClass: PrismaProductWriteRepositoryAdapter },
    { provide: ProductReadRepositoryPort, useClass: PrismaProductReadRepositoryAdapter },
  ],
  exports: [
    CreateProductPort,
    GetProductPort,
    UpdateProductPort,
    ActivateProductPort,
    DeactivateProductPort,
  ],
})
export class ProductModule {}
