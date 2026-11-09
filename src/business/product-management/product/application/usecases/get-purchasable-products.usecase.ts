import { Injectable } from '@nestjs/common';
import { ProductQuery } from '../../application/queries/product.query';
import { ProductQueryRecord } from '../../domain/types/product.types';

/**
 * Read-side use case. Skips the domain and returns projections directly.
 */
@Injectable()
export class GetPurchasableProductsUseCase {
  constructor(private readonly productQueryRepo: ProductQuery) {}

  async execute(ids: string[]): Promise<ProductQueryRecord[]> {
    return this.productQueryRepo.findPurchasableByIds(ids);
  }
}
