import { Injectable } from '@nestjs/common';
import { ProductQuery } from '../../application/queries/product.query';
import { ProductQueryRecord } from '../../domain/types/product.types';

@Injectable()
export class FindPurchasableProductsBySkusUseCase {
  constructor(private readonly productQueryRepo: ProductQuery) {}

  execute(skus: string[]): Promise<ProductQueryRecord[]> {
    return this.productQueryRepo.findPurchasableBySkus(skus);
  }
}
