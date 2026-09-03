import { Injectable } from '@nestjs/common';
import { ProductQueryRepositoryPort } from '../../domain/domain-ports/product-query-repository.port';
import { ProductQueryRecord } from '../../domain/types/product.types';

/**
 * Read-side use case. Skips the domain and returns the projection directly.
 */
@Injectable()
export class GetProductUseCase {
  constructor(private readonly productQueryRepo: ProductQueryRepositoryPort) {}

  async execute(id: string): Promise<ProductQueryRecord | null> {
    return this.productQueryRepo.findById(id);
  }
}
