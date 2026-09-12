import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { ProductQuery } from '../../application/queries/product.query';
import { ProductQueryRecord } from '../../domain/types/product.types';

/**
 * Read-side use case. Skips the domain entirely — goes straight to the query
 * repository which injects the Prisma read service.
 */
@Injectable()
export class ListProductsUseCase {
  constructor(private readonly productQueryRepo: ProductQuery) {}

  async execute(query: PageQuery): Promise<PageResult<ProductQueryRecord>> {
    return this.productQueryRepo.findAll(query);
  }
}
