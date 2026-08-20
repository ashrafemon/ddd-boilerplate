import { Injectable } from '@nestjs/common';
import { ProductQueryRepositoryPort, ProductQueryRecord } from '../../domain/domain-ports';

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
