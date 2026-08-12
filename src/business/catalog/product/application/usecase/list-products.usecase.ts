import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import {
  PRODUCT_QUERY_REPOSITORY,
  ProductQueryRecord,
  ProductQueryRepositoryPort,
} from '../../ports/outbound/product-query-repository.port';

/**
 * Read-side use case. Skips the domain entirely — goes straight to the query
 * repository which injects the Prisma read service.
 */
@Injectable()
export class ListProductsUseCase implements QueryUseCase<
  PageQuery,
  PageResult<ProductQueryRecord>
> {
  constructor(
    @Inject(PRODUCT_QUERY_REPOSITORY) private readonly productQueryRepo: ProductQueryRepositoryPort,
  ) {}

  async execute(query: PageQuery): Promise<PageResult<ProductQueryRecord>> {
    return this.productQueryRepo.findAll(query);
  }
}
