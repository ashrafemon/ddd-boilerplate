import { PageQuery, PageResult } from '@shared-kernal/types/pagination';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { Money } from '@business/shared-business/domain/money.value-object';

export interface ProductSummary {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  status: string;
  unitPrice: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductQueryPort {
  getProduct(id: ProductId): Promise<ProductSummary | null>;
  getPurchasableProduct(id: string): Promise<ProductSummary | null>;
  listProducts(query: PageQuery): Promise<PageResult<ProductSummary>>;
}

export const PRODUCT_QUERY_PORT = Symbol('PRODUCT_QUERY_PORT');

export { Money };
