import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import {
  ProductQueryRepositoryPort,
  ProductQueryRecord,
  ProductQueryRepositoryPort,
} from '../../domain/domain-ports';

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
    @Inject(ProductQueryRepositoryPort)
    private readonly productQueryRepo: ProductQueryRepositoryPort,
  ) {}

  async execute(query: PageQuery): Promise<PageResult<ProductQueryRecord>> {
    return this.productQueryRepo.findAll(query);
  }
}
