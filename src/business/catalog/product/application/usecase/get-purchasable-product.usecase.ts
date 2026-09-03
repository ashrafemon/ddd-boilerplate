import { Injectable } from '@nestjs/common';
import {
  ProductQueryRepositoryPort,
  ProductQueryRecord,
} from '../../domain/domain-ports';

/**
 * Cross-aggregate query surface. Other modules (e.g. purchase) depend on the
 * Product inbound query port only; this use case serves them through the query
 * repository, never the domain.
 */
@Injectable()
export class GetPurchasableProductUseCase {
  constructor(private readonly productQueryRepo: ProductQueryRepositoryPort) {}

  async execute(id: string): Promise<ProductQueryRecord | null> {
    return this.productQueryRepo.findPurchasableById(id);
  }
}
