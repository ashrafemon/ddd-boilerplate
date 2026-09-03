import { Injectable } from '@nestjs/common';
import {
  ProductQueryRepositoryPort,
  ProductQueryRecord,
} from '../../domain/domain-ports';

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
