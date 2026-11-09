import { Injectable } from '@nestjs/common';
import { ProductQuery } from '../../application/queries/product.query';
import { ProductQueryRecord } from '../../domain/types/product.types';

/**
 * Cross-aggregate query surface. Other modules (e.g. purchase) depend on the
 * Product inbound query port only; this use case serves them through the query
 * repository, never the domain.
 */
@Injectable()
export class GetPurchasableProductUseCase {
  constructor(private readonly productQueryRepo: ProductQuery) {}

  async execute(id: string): Promise<ProductQueryRecord | null> {
    return this.productQueryRepo.findPurchasableById(id);
  }
}
