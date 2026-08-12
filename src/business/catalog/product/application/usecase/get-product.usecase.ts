import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import {
  PRODUCT_QUERY_REPOSITORY,
  ProductQueryRecord,
  ProductQueryRepositoryPort,
} from '../../ports/outbound/product-query-repository.port';

/**
 * Read-side use case. Skips the domain and returns the projection directly.
 */
@Injectable()
export class GetProductUseCase implements QueryUseCase<string, ProductQueryRecord | null> {
  constructor(
    @Inject(PRODUCT_QUERY_REPOSITORY) private readonly productQueryRepo: ProductQueryRepositoryPort,
  ) {}

  async execute(id: string): Promise<ProductQueryRecord | null> {
    return this.productQueryRepo.findById(id);
  }
}
