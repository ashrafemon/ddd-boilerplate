import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { ProductQueryRecord } from '../types/product.types';

export abstract class ProductQueryRepositoryPort {
  abstract findById(id: string): Promise<ProductQueryRecord | null>;
  abstract findBySku(sku: string): Promise<ProductQueryRecord | null>;
  abstract findPurchasableById(id: string): Promise<ProductQueryRecord | null>;
  abstract findPurchasableByIds(ids: string[]): Promise<ProductQueryRecord[]>;
  abstract findAll(query: PageQuery): Promise<PageResult<ProductQueryRecord>>;
}
