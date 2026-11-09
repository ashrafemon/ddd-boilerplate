import { PageQuery, PageResult } from '@common/application/types/pagination';
import { ProductQueryRecord } from '../../domain/types/product.types';

export abstract class ProductQuery {
  abstract findById(id: string): Promise<ProductQueryRecord | null>;
  abstract findBySku(sku: string): Promise<ProductQueryRecord | null>;
  abstract findPurchasableById(id: string): Promise<ProductQueryRecord | null>;
  abstract findPurchasableByIds(ids: string[]): Promise<ProductQueryRecord[]>;
  abstract findPurchasableBySkus(skus: string[]): Promise<ProductQueryRecord[]>;
  abstract findAll(query: PageQuery): Promise<PageResult<ProductQueryRecord>>;
}
