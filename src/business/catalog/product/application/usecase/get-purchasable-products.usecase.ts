import { Injectable } from '@nestjs/common';
import {
  ProductQueryRepositoryPort,
} from '../../domain/domain-ports/product-query-repository.port';
import { ProductQueryRecord } from '../../domain/types/product.types';

/**
 * Read-side use case. Skips the domain and returns projections directly.
 */
@Injectable()
export class GetPurchasableProductsUseCase {
  constructor(private readonly productQueryRepo: ProductQueryRepositoryPort) {}

  async execute(ids: string[]): Promise<ProductQueryRecord[]> {
    return this.productQueryRepo.findPurchasableByIds(ids);
  }
}
