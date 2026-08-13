import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import {
  PRODUCT_QUERY_REPOSITORY,
  ProductQueryRecord,
  ProductQueryRepositoryPort,
} from '../../domain/ports';

/**
 * Cross-aggregate query surface. Other modules (e.g. purchase) depend on the
 * Product inbound query port only; this use case serves them through the query
 * repository, never the domain.
 */
@Injectable()
export class GetPurchasableProductUseCase implements QueryUseCase<
  string,
  ProductQueryRecord | null
> {
  constructor(
    @Inject(PRODUCT_QUERY_REPOSITORY) private readonly productQueryRepo: ProductQueryRepositoryPort,
  ) {}

  async execute(id: string): Promise<ProductQueryRecord | null> {
    return this.productQueryRepo.findPurchasableById(id);
  }
}
