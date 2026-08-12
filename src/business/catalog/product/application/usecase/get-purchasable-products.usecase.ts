import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import {
  PRODUCT_QUERY_REPOSITORY,
  ProductQueryRecord,
  ProductQueryRepositoryPort,
} from '../../ports/outbound/product-query-repository.port';

/**
 * Read-side use case. Skips the domain and returns projections directly.
 */
@Injectable()
export class GetPurchasableProductsUseCase implements QueryUseCase<string[], ProductQueryRecord[]> {
  constructor(
    @Inject(PRODUCT_QUERY_REPOSITORY) private readonly productQueryRepo: ProductQueryRepositoryPort,
  ) {}

  async execute(ids: string[]): Promise<ProductQueryRecord[]> {
    return this.productQueryRepo.findPurchasableByIds(ids);
  }
}
