import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import {
  ProductQueryRepositoryPort,
  ProductQueryRecord,
} from '../../domain/domain-ports';

/**
 * Read-side use case. Skips the domain entirely — goes straight to the query
 * repository which injects the Prisma read service.
 */
@Injectable()
export class ListProductsUseCase {
  constructor(private readonly productQueryRepo: ProductQueryRepositoryPort) {}

  async execute(query: PageQuery): Promise<PageResult<ProductQueryRecord>> {
    return this.productQueryRepo.findAll(query);
  }
}
