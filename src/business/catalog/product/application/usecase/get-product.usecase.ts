import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import {
  ProductQueryRepositoryPort,
  ProductQueryRecord,
  ProductQueryRepositoryPort,
} from '../../domain/domain-ports';

/**
 * Read-side use case. Skips the domain and returns the projection directly.
 */
@Injectable()
export class GetProductUseCase implements QueryUseCase<string, ProductQueryRecord | null> {
  constructor(
    @Inject(ProductQueryRepositoryPort)
    private readonly productQueryRepo: ProductQueryRepositoryPort,
  ) {}

  async execute(id: string): Promise<ProductQueryRecord | null> {
    return this.productQueryRepo.findById(id);
  }
}
