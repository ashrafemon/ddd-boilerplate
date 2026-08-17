import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import {
  ProductQueryRepositoryPort,
  ProductQueryRecord,
  ProductQueryRepositoryPort,
} from '../../domain/domain-ports';

/**
 * Read-side use case. Skips the domain and returns projections directly.
 */
@Injectable()
export class GetPurchasableProductsUseCase implements QueryUseCase<string[], ProductQueryRecord[]> {
  constructor(
    @Inject(ProductQueryRepositoryPort)
    private readonly productQueryRepo: ProductQueryRepositoryPort,
  ) {}

  async execute(ids: string[]): Promise<ProductQueryRecord[]> {
    return this.productQueryRepo.findPurchasableByIds(ids);
  }
}
